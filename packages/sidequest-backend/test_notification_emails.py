import asyncio
import os
import smtplib
import threading
import unittest
from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from notification_emails import (
    EmailSettings,
    NotificationEmailWorker,
    build_notification_email,
    listen_for_notification_emails,
    notification_email_lifespan,
    send_notification_email,
)


ENV = {
    "NOTIFICATION_EMAIL_ENABLED": "true",
    "SUPABASE_URL": "https://example.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "synthetic-service-role-key",
    "SMTP_HOST": "smtp.example.invalid",
    "SMTP_USERNAME": "synthetic-user",
    "SMTP_PASSWORD": "synthetic-password",
    "NOTIFICATION_EMAIL_FROM": "notifications@example.invalid",
    "SIDEQUEST_APP_URL": "https://sidequest.example.invalid",
}
JOB = {
    "notification_id": "00000000-0000-4000-8000-000000000001",
    "lease_token": "00000000-0000-4000-8000-000000000002",
    "recipient_email": "recipient@example.invalid",
    "type": "project_like",
    "actor_id": "00000000-0000-4000-8000-000000000003",
    "actor_name": "Test Maker",
    "project_id": "00000000-0000-4000-8000-000000000004",
    "project_title": "Paper garden",
    "created_at": "2026-11-15T12:00:00Z",
}


class SettingsTests(unittest.TestCase):
    def test_disabled_by_default_without_credentials(self):
        self.assertIsNone(EmailSettings.from_env({}))
        self.assertIsNone(EmailSettings.from_env({"NOTIFICATION_EMAIL_ENABLED": "false"}))

    def test_enabled_requires_complete_server_configuration(self):
        for field in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SMTP_HOST",
                      "NOTIFICATION_EMAIL_FROM", "SIDEQUEST_APP_URL"):
            env = {key: value for key, value in ENV.items() if key != field}
            with self.subTest(field=field), self.assertRaises(ValueError):
                EmailSettings.from_env(env)
        with self.assertRaises(ValueError):
            EmailSettings.from_env({**ENV, "SUPABASE_SERVICE_ROLE_KEY": "sb_publishable_not-secret"})

    def test_secret_key_fallback_and_credentials_are_not_in_repr(self):
        env = {key: value for key, value in ENV.items() if key != "SUPABASE_SERVICE_ROLE_KEY"}
        settings = EmailSettings.from_env({**env, "SUPABASE_SECRET_KEY": "synthetic-secret"})
        self.assertEqual(settings.supabase_key, "synthetic-secret")
        self.assertNotIn("synthetic-secret", repr(settings))
        self.assertNotIn(ENV["SMTP_USERNAME"], repr(settings))
        self.assertNotIn(ENV["SMTP_PASSWORD"], repr(settings))

    def test_invalid_ports_modes_and_partial_credentials_are_rejected(self):
        for change in ({"SMTP_PORT": "0"}, {"SMTP_PORT": "65536"},
                       {"SMTP_PORT": "bad"}, {"SMTP_SECURITY": "none"},
                       {"SMTP_PASSWORD": ""}, {"NOTIFICATION_EMAIL_ENABLED": "maybe"}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                EmailSettings.from_env({**ENV, **change})

    def test_tls_required_remotely_and_plain_smtp_allowed_only_for_local_testing(self):
        with self.assertRaises(ValueError):
            EmailSettings.from_env({**ENV, "SMTP_SECURITY": "plain"})
        settings = EmailSettings.from_env({**ENV, "SMTP_SECURITY": "plain", "SMTP_HOST": "127.0.0.1"})
        self.assertEqual(settings.smtp_security, "plain")
        self.assertEqual(EmailSettings.from_env({**ENV, "SMTP_SECURITY": "ssl"}).smtp_port, 465)

    def test_invalid_app_links_and_sender_addresses_cannot_enter_messages(self):
        for url in ("javascript:alert(1)", "https://user:password@example.invalid",
                    "https://example.invalid/?token=secret", "http://example.invalid", "https://example.invalid/\nbad"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                EmailSettings.from_env({**ENV, "SIDEQUEST_APP_URL": url})
        self.assertEqual(EmailSettings.from_env({**ENV, "SIDEQUEST_APP_URL": "http://localhost:5173/"}).site_url,
                         "http://localhost:5173")
        for sender in ("not-an-address", "a@example.invalid,b@example.invalid", "a@example.invalid\nBcc: b@example.invalid"):
            with self.subTest(sender=sender), self.assertRaises(ValueError):
                EmailSettings.from_env({**ENV, "NOTIFICATION_EMAIL_FROM": sender})


class TemplateTests(unittest.TestCase):
    def setUp(self):
        self.settings = EmailSettings.from_env(ENV)

    def test_like_email_has_plain_html_and_correct_private_destination(self):
        message = build_notification_email(JOB, self.settings)
        self.assertEqual(message["To"].addresses[0].addr_spec, JOB["recipient_email"])
        self.assertIn('Test Maker liked your project "Paper garden".', message.get_body(preferencelist=("plain",)).get_content())
        self.assertIn(f"/projects/{JOB['project_id']}", message.get_body(preferencelist=("html",)).get_content())
        self.assertEqual(message["Message-ID"], build_notification_email(JOB, self.settings)["Message-ID"])

    def test_follow_email_opens_actor_profile_and_future_events_open_inbox(self):
        for event, target in (("user_follow", f"/profile/{JOB['actor_id']}"), ("future_event", "/notifications")):
            message = build_notification_email({**JOB, "type": event, "project_id": None, "project_title": None}, self.settings)
            self.assertIn(target, message.get_body(preferencelist=("plain",)).get_content())
        self.assertIn("started following you", build_notification_email({**JOB, "type": "user_follow"}, self.settings).get_body(preferencelist=("plain",)).get_content())

    def test_user_content_is_escaped_and_cannot_add_headers(self):
        message = build_notification_email({**JOB, "actor_name": '<script>\r\nBcc: injected@example.invalid',
                                            "project_title": '<img src=x onerror="attack()">'}, self.settings)
        self.assertIsNone(message["Bcc"])
        html = message.get_body(preferencelist=("html",)).get_content()
        self.assertNotIn("<script>", html)
        self.assertNotIn("<img", html)
        self.assertIn("&lt;script&gt;", html)

    def test_payload_cannot_add_recipients_or_inject_links(self):
        for change in ({"recipient_email": "victim@example.invalid\nBcc: other@example.invalid"},
                       {"recipient_email": "a@example.invalid,b@example.invalid"},
                       {"project_id": "../../malicious"}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                build_notification_email({**JOB, **change}, self.settings)


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.settings = EmailSettings.from_env(ENV)

    def test_smtp_uses_tls_and_sends_to_one_resolved_recipient(self):
        with patch("notification_emails.smtplib.SMTP") as smtp_factory:
            smtp = smtp_factory.return_value.__enter__.return_value
            smtp.send_message.return_value = {}
            send_notification_email(build_notification_email(JOB, self.settings), self.settings)
            smtp.starttls.assert_called_once()
            smtp.login.assert_called_once_with(ENV["SMTP_USERNAME"], ENV["SMTP_PASSWORD"])
            self.assertEqual(smtp.send_message.call_args.kwargs["to_addrs"], [JOB["recipient_email"]])
            methods = [call[0] for call in smtp.method_calls]
            self.assertLess(methods.index("starttls"), methods.index("login"))

    def test_implicit_tls_and_local_smtp_modes(self):
        for mode in ("ssl", "plain"):
            with patch("notification_emails.smtplib.SMTP") as plain, patch("notification_emails.smtplib.SMTP_SSL") as secure:
                factory = secure if mode == "ssl" else plain
                smtp = factory.return_value.__enter__.return_value
                smtp.send_message.return_value = {}
                settings = replace(self.settings, smtp_security=mode, smtp_username="", smtp_password="")
                send_notification_email(build_notification_email(JOB, settings), settings)
                factory.assert_called_once()
                smtp.starttls.assert_not_called()
                smtp.login.assert_not_called()

    def test_refused_recipient_is_not_reported_as_success(self):
        with patch("notification_emails.smtplib.SMTP") as factory:
            factory.return_value.__enter__.return_value.send_message.return_value = {JOB["recipient_email"]: (550, b"rejected")}
            with self.assertRaises(smtplib.SMTPRecipientsRefused):
                send_notification_email(build_notification_email(JOB, self.settings), self.settings)

    def test_worker_acknowledges_success_and_does_not_resend_an_empty_queue(self):
        client = MagicMock()
        client.rpc.return_value.execute.side_effect = [SimpleNamespace(data=JOB), SimpleNamespace(data=True), SimpleNamespace(data=None)]
        send = MagicMock()
        worker = NotificationEmailWorker(client, self.settings, send=send)
        self.assertTrue(worker.deliver_one())
        self.assertFalse(worker.deliver_one())
        send.assert_called_once()
        self.assertEqual(client.rpc.call_args_list[1].args, ("finish_notification_email", {
            "p_notification_id": JOB["notification_id"], "p_lease_token": JOB["lease_token"], "p_sent": True,
        }))

    def test_failed_delivery_retries_without_logging_the_address_or_password(self):
        client = MagicMock()
        client.rpc.return_value.execute.side_effect = [SimpleNamespace(data=JOB), SimpleNamespace(data=True)]
        send = MagicMock(side_effect=RuntimeError(f"{JOB['recipient_email']} {ENV['SMTP_PASSWORD']}"))
        with self.assertLogs("notification_emails", level="WARNING") as logs:
            NotificationEmailWorker(client, self.settings, send=send).deliver_one()
        self.assertIs(client.rpc.call_args.args[1]["p_sent"], False)
        self.assertNotIn(JOB["recipient_email"], str(logs.output))
        self.assertNotIn(ENV["SMTP_PASSWORD"], str(logs.output))

    def test_unacknowledged_send_does_not_immediately_send_again(self):
        client = MagicMock()
        client.rpc.return_value.execute.side_effect = [SimpleNamespace(data=JOB), SimpleNamespace(data=False)]
        send = MagicMock()
        with self.assertRaises(RuntimeError):
            NotificationEmailWorker(client, self.settings, send=send).deliver_one()
        send.assert_called_once()

    def test_disabled_lifespan_never_creates_a_worker(self):
        with patch.dict(os.environ, {}, clear=True), patch("notification_emails.run_email_worker") as run, \
                patch("notification_emails.listen_for_notification_emails", new_callable=AsyncMock) as listen:
            with TestClient(FastAPI(lifespan=notification_email_lifespan)):
                run.assert_not_called()
                listen.assert_not_called()

    def test_enabled_lifespan_starts_and_stops_its_worker(self):
        with patch.dict(os.environ, ENV, clear=True), patch("notification_emails.run_email_worker") as run, \
                patch("notification_emails.listen_for_notification_emails", new_callable=AsyncMock) as listen:
            with TestClient(FastAPI(lifespan=notification_email_lifespan)):
                pass
            run.assert_called_once()
            self.assertTrue(run.call_args.args[1].is_set())
            self.assertTrue(run.call_args.args[2].is_set())
            listen.assert_called_once_with(run.call_args.args[0], run.call_args.args[2])

    def test_queue_outage_is_logged_and_worker_waits_before_retrying(self):
        client = MagicMock()
        client.rpc.side_effect = RuntimeError("private server response")
        stop = threading.Event()
        wake = threading.Event()
        with patch.object(wake, "wait", side_effect=lambda seconds: stop.set()) as wait:
            with self.assertLogs("notification_emails", level="ERROR") as logs:
                NotificationEmailWorker(client, self.settings).run(stop, wake)
        wait.assert_called_once_with(30)
        self.assertNotIn("private server response", str(logs.output))

    def test_realtime_signal_wakes_an_idle_delivery_worker_before_reconciliation(self):
        stop, wake = threading.Event(), threading.Event()
        idle, processed = threading.Event(), threading.Event()
        worker = NotificationEmailWorker(MagicMock(), self.settings)

        def deliver():
            if not idle.is_set():
                idle.set()
            else:
                processed.set()
                stop.set()
            return False

        worker.deliver_one = MagicMock(side_effect=deliver)
        thread = threading.Thread(target=worker.run, args=(stop, wake), daemon=True)
        thread.start()
        try:
            self.assertTrue(idle.wait(2))
            wake.set()  # Same signal used by the Supabase Realtime callback.
            self.assertTrue(processed.wait(2), "Realtime should wake delivery without the 30-second fallback")
        finally:
            stop.set()
            wake.set()
            thread.join(2)
        self.assertFalse(thread.is_alive())


class RealtimeTests(unittest.IsolatedAsyncioTestCase):
    def make_client(self, ready, *, failed=False):
        client = MagicMock()
        channel = client.channel.return_value
        channel.is_joined = True
        client.realtime.is_connected = True
        client.remove_all_channels = AsyncMock()
        client.realtime.close = AsyncMock()

        async def subscribe(callback):
            callback("CHANNEL_ERROR" if failed else "SUBSCRIBED", RuntimeError("private response") if failed else None)
            ready.set()
            return channel

        channel.subscribe = AsyncMock(side_effect=subscribe)
        return client

    async def test_fastapi_listener_subscribes_to_notification_inserts_and_cleans_up(self):
        ready = asyncio.Event()
        client = self.make_client(ready)
        wake = threading.Event()
        with patch("notification_emails.create_async_client", new_callable=AsyncMock, return_value=client) as create:
            task = asyncio.create_task(listen_for_notification_emails(EmailSettings.from_env(ENV), wake))
            try:
                await asyncio.wait_for(ready.wait(), 2)
                client.channel.assert_called_once_with("server-notification-emails")
                binding = client.channel.return_value.on_postgres_changes.call_args
                self.assertEqual(binding.args, ("INSERT",))
                self.assertEqual(binding.kwargs["table"], "notifications")
                self.assertEqual(binding.kwargs["schema"], "public")
                self.assertTrue(wake.is_set(), "Subscribing must reconcile missed startup/reconnect events")
                wake.clear()
                binding.kwargs["callback"]({"recipient_email": "forged@example.invalid"})
                self.assertTrue(wake.is_set())
                client.rpc.assert_not_called()  # Payload content never sends arbitrary mail.
                options = create.call_args.kwargs["options"]
                self.assertFalse(options.persist_session)
                self.assertFalse(options.auto_refresh_token)
            finally:
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
            client.remove_all_channels.assert_awaited_once()
            client.realtime.close.assert_awaited_once()

    async def test_subscription_failure_reconnects_and_reconciles_without_exposing_response(self):
        first_ready, connected = asyncio.Event(), asyncio.Event()
        first = self.make_client(first_ready, failed=True)
        second = self.make_client(connected)
        wake = threading.Event()
        with patch("notification_emails.create_async_client", new_callable=AsyncMock, side_effect=[first, second]) as create, \
                patch("notification_emails.asyncio.sleep", new_callable=AsyncMock), \
                self.assertLogs("notification_emails", level="WARNING") as logs:
            task = asyncio.create_task(listen_for_notification_emails(EmailSettings.from_env(ENV), wake))
            try:
                await asyncio.wait_for(connected.wait(), 2)
                self.assertEqual(create.await_count, 2)
                self.assertTrue(wake.is_set())
                first.remove_all_channels.assert_awaited_once()
            finally:
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
        self.assertNotIn("private response", str(logs.output))
        second.realtime.close.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()

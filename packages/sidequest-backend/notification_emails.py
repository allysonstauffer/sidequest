"""Deliver inbox notifications from a private, transactional database outbox."""

import asyncio
import base64
import logging
import os
import smtplib
import ssl
import threading
from contextlib import asynccontextmanager
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import datetime
from email.headerregistry import Address
from email.message import EmailMessage
from email.utils import format_datetime
from html import escape
from pathlib import Path
from urllib.parse import urlparse
from uuid import UUID

import httpx
from supabase import AsyncClientOptions, ClientOptions, create_async_client, create_client

logger = logging.getLogger(__name__)
EMAIL_LOGO = Path(__file__).with_name("sidequest-icon.png")
EMAIL_LOGO_CID = "sidequest-logo"


def email_address(value):
    if not isinstance(value, str) or "\r" in value or "\n" in value:
        raise ValueError("A single valid email address is required.")
    address = Address(addr_spec=value)
    if not address.username or not address.domain:
        raise ValueError("A single valid email address is required.")
    return address


def app_url(value):
    parsed = urlparse(value)
    if (parsed.scheme not in {"https", "http"} or not parsed.hostname
            or parsed.username or parsed.password or parsed.query or parsed.fragment
            or any(character.isspace() for character in value)
            or (parsed.scheme == "http" and parsed.hostname not in {"localhost", "127.0.0.1", "::1"})):
        raise ValueError("SIDEQUEST_APP_URL must be HTTPS, or HTTP on localhost for development.")
    return value.rstrip("/")


@dataclass(frozen=True)
class EmailSettings:
    supabase_url: str
    supabase_key: str = field(repr=False)
    smtp_host: str
    smtp_port: int
    smtp_security: str
    smtp_username: str = field(repr=False)
    smtp_password: str = field(repr=False)
    from_email: str
    site_url: str
    provider: str = "smtp"
    cloudflare_account_id: str = ""
    cloudflare_api_token: str = field(default="", repr=False)

    @classmethod
    def from_env(cls, env=None):
        env = os.environ if env is None else env
        enabled = env.get("NOTIFICATION_EMAIL_ENABLED", "false").strip().lower()
        if enabled in {"", "false", "0", "no"}:
            return None
        if enabled not in {"true", "1", "yes"}:
            raise ValueError("NOTIFICATION_EMAIL_ENABLED must be true or false.")

        provider = env.get("NOTIFICATION_EMAIL_PROVIDER", "smtp").strip().lower()
        if provider not in {"smtp", "cloudflare"}:
            raise ValueError("NOTIFICATION_EMAIL_PROVIDER must be smtp or cloudflare.")
        required = ("SUPABASE_URL", "NOTIFICATION_EMAIL_FROM", "SIDEQUEST_APP_URL")
        if provider == "smtp":
            required += ("SMTP_HOST",)
        else:
            required += ("CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_EMAIL_API_TOKEN")
        for name in required:
            if not env.get(name, "").strip():
                raise ValueError(f"{name} is required when notification emails are enabled.")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SECRET_KEY")
        if not key or key.startswith("sb_publishable_"):
            raise ValueError("A backend SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is required.")
        security, host, port, username, password = "", "", 0, "", ""
        if provider == "smtp":
            security = env.get("SMTP_SECURITY", "starttls").strip().lower()
            if security not in {"starttls", "ssl", "plain"}:
                raise ValueError("SMTP_SECURITY must be starttls, ssl, or plain.")
            host = env["SMTP_HOST"].strip()
            if security == "plain" and host not in {"localhost", "127.0.0.1", "::1"}:
                raise ValueError("Plain SMTP is only supported on localhost.")
            port = int(env.get("SMTP_PORT", "465" if security == "ssl" else "587"))
            if not 1 <= port <= 65535:
                raise ValueError("SMTP_PORT must be a valid port number.")
            username = env.get("SMTP_USERNAME", "")
            password = env.get("SMTP_PASSWORD", "")
            if bool(username) != bool(password):
                raise ValueError("Set both SMTP_USERNAME and SMTP_PASSWORD, or neither.")
        sender = env["NOTIFICATION_EMAIL_FROM"].strip()
        email_address(sender)
        account_id = env.get("CLOUDFLARE_ACCOUNT_ID", "").strip() if provider == "cloudflare" else ""
        if provider == "cloudflare" and (len(account_id) != 32 or any(c not in "0123456789abcdefABCDEF" for c in account_id)):
            raise ValueError("CLOUDFLARE_ACCOUNT_ID must be a 32-character hexadecimal ID.")
        return cls(env["SUPABASE_URL"].strip(), key, host, port, security,
                   username, password, sender, app_url(env["SIDEQUEST_APP_URL"].strip()),
                   provider, account_id, env.get("CLOUDFLARE_EMAIL_API_TOKEN", "").strip() if provider == "cloudflare" else "")


def build_notification_email(job, settings):
    notification_id = str(UUID(job["notification_id"]))
    recipient = email_address(job["recipient_email"])
    sender = email_address(settings.from_email)
    # User-controlled names/titles cannot inject mail headers or HTML.
    actor = " ".join(str(job.get("actor_name") or "A hobbyist").split())[:120]
    title = " ".join(str(job.get("project_title") or "your project").split())[:200]
    sidequest_title = " ".join(str(job.get("sidequest_title") or "a sidequest").split())[:200]
    if job["type"] == "user_follow":
        subject = "You have a new SideQuest follower"
        summary = f"{actor} started following you."
        destination = f"/profile/{UUID(job['actor_id'])}"
    elif job["type"] == "project_like":
        subject = "Someone liked your SideQuest project"
        summary = f'{actor} liked your project "{title}".'
        destination = f"/projects/{UUID(job['project_id'])}"
    elif job["type"] == "project_comment":
        subject = "New comment on your SideQuest project"
        summary = f'{actor} commented on your project "{title}".'
        destination = f"/projects/{UUID(job['project_id'])}"
    elif job["type"] == "sidequest_comment":
        subject = "New comment on your SideQuest event"
        summary = f'{actor} commented on your sidequest "{sidequest_title}".'
        destination = "/feed"
    elif job["type"] == "cohost_invite":
        subject = "You were added as a SideQuest co-host"
        summary = f'{actor} added you as a co-host of "{sidequest_title}".'
        destination = "/feed"
    elif job["type"] == "collaboration_request":
        subject = "New SideQuest collaboration request"
        summary = f'{actor} requested to collaborate on "{title}".'
        destination = "/collaborations"
    else:
        subject = "You have a new SideQuest notification"
        summary = "You have a new notification in your SideQuest inbox."
        destination = "/notifications"
    link = settings.site_url + destination
    inbox_link = settings.site_url + "/notifications"
    message = EmailMessage()
    message["From"] = Address(display_name="SideQuest", addr_spec=sender.addr_spec)
    message["To"] = recipient
    message["Subject"] = subject
    message["Date"] = format_datetime(datetime.fromisoformat(job["created_at"].replace("Z", "+00:00")))
    # Stable across retries. SMTP providers may use it for deduplication; SMTP
    # itself cannot guarantee exactly-once delivery after an ambiguous timeout.
    message["Message-ID"] = f"<notification-{notification_id}@{sender.domain}>"
    message.set_content(f"{summary}\n\nView on SideQuest: {link}\n\nYour notifications: {inbox_link}\n")
    message.add_alternative(
        f'<p><img src="cid:{EMAIL_LOGO_CID}" alt="SideQuest" width="57" height="56"></p>'
        f'<h1>SideQuest</h1><p>{escape(summary)}</p>'
        f'<p><a href="{escape(link, quote=True)}">View on SideQuest</a></p>'
        f'<p><a href="{escape(inbox_link, quote=True)}">Your notifications</a></p>',
        subtype="html",
    )
    message.get_body(preferencelist=("html",)).add_related(
        EMAIL_LOGO.read_bytes(), maintype="image", subtype="png",
        cid=f"<{EMAIL_LOGO_CID}>", filename="sidequest-icon.png",
    )
    return message


def send_notification_email(message, settings):
    if settings.provider == "cloudflare":
        recipient = message["To"].addresses[0].addr_spec
        payload = {
            "to": recipient,
            "from": {
                "address": settings.from_email,
                "name": message["From"].addresses[0].display_name,
            },
            "subject": str(message["Subject"]),
            "text": message.get_body(preferencelist=("plain",)).get_content(),
            "html": message.get_body(preferencelist=("html",)).get_content(),
        }
        payload["attachments"] = [
            {
                "content": base64.b64encode(part.get_content()).decode("ascii"),
                "filename": part.get_filename(),
                "type": part.get_content_type(),
                "disposition": "inline",
                "content_id": part["Content-ID"].strip("<>"),
            }
            for part in message.walk() if part.get_content_maintype() == "image"
            and part["Content-ID"]
        ]
        with httpx.Client(timeout=15) as client:
            response = client.post(
                f"https://api.cloudflare.com/client/v4/accounts/{settings.cloudflare_account_id}/email/sending/send",
                headers={"Authorization": f"Bearer {settings.cloudflare_api_token}"},
                json=payload,
            )
            response.raise_for_status()
            result = response.json()
        delivery = result.get("result") or {}
        if (result.get("success") is not True or recipient in delivery.get("permanent_bounces", [])
                or recipient not in delivery.get("delivered", []) + delivery.get("queued", [])):
            raise RuntimeError("Cloudflare did not accept the notification email.")
        return
    context = ssl.create_default_context()
    if settings.smtp_security == "ssl":
        connection = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10, context=context)
    else:
        connection = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
    with connection as smtp:
        smtp.ehlo()
        if settings.smtp_security == "starttls":
            smtp.starttls(context=context)
            smtp.ehlo()
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        refused = smtp.send_message(message, from_addr=settings.from_email,
                                    to_addrs=[message["To"].addresses[0].addr_spec])
        if refused:
            raise smtplib.SMTPRecipientsRefused(refused)


class NotificationEmailWorker:
    def __init__(self, client, settings, send=send_notification_email):
        self.client = client
        self.settings = settings
        self.send = send

    def deliver_one(self):
        job = self.client.rpc("claim_notification_email", {}).execute().data
        if job is None:
            return False
        notification_id = str(UUID(job["notification_id"]))
        lease_token = str(UUID(job["lease_token"]))
        sent = False
        try:
            self.send(build_notification_email(job, self.settings), self.settings)
            sent = True
        except Exception as exc:
            # Provider errors can contain recipient addresses and credentials.
            # Log only status and numeric provider codes, never error text.
            if isinstance(exc, httpx.HTTPStatusError):
                codes = []
                try:
                    codes = [error["code"] for error in exc.response.json().get("errors", [])
                             if isinstance(error.get("code"), int)]
                except (ValueError, TypeError, KeyError, AttributeError):
                    pass
                logger.warning("Notification email delivery failed (HTTP %s; codes %s).",
                               exc.response.status_code, codes)
            else:
                logger.warning("Notification email delivery failed (%s).", type(exc).__name__)
        confirmed = self.client.rpc("finish_notification_email", {
            "p_notification_id": notification_id,
            "p_lease_token": lease_token,
            "p_sent": sent,
        }).execute().data
        if confirmed is not True:
            raise RuntimeError("Notification email result was not acknowledged.")
        return True

    def run(self, stop, wake=None):
        wake = threading.Event() if wake is None else wake
        while not stop.is_set():
            # Clear before draining: an event arriving during delivery remains
            # set and schedules another pass, rather than being lost at wait().
            wake.clear()
            try:
                for _ in range(10):
                    if stop.is_set() or not self.deliver_one():
                        break
                else:
                    wake.set()  # Drain a burst without waiting for another event.
            except Exception:
                logger.error("Notification email queue unavailable; delivery will retry.")
                wake.clear()  # Back off if the database is unavailable.
            if not stop.is_set():
                # Reconcile missed events, scheduled retries, and expired leases.
                wake.wait(30)


def run_email_worker(settings, stop, wake):
    try:
        with httpx.Client(timeout=15) as transport:
            client = create_client(settings.supabase_url, settings.supabase_key,
                                   options=ClientOptions(persist_session=False, auto_refresh_token=False,
                                                         httpx_client=transport))
            NotificationEmailWorker(client, settings).run(stop, wake)
    except Exception:
        logger.error("Could not initialize the notification email worker. Check backend configuration.")


async def listen_for_notification_emails(settings, wake):
    """Realtime is the delivery signal; the private outbox is the source of truth."""
    while True:
        client = None
        try:
            async with httpx.AsyncClient(timeout=15) as transport:
                client = await create_async_client(
                    settings.supabase_url, settings.supabase_key,
                    options=AsyncClientOptions(
                        persist_session=False, auto_refresh_token=False,
                        httpx_client=transport,
                        realtime={"auto_reconnect": True, "max_retries": 1},
                    ),
                )
                reconnect = asyncio.Event()

                def changed(_payload):
                    # Never send mail directly from a WebSocket payload. The
                    # guarded claim RPC resolves authoritative recipients/jobs.
                    wake.set()

                def subscription_state(status, _error):
                    if status == "SUBSCRIBED":
                        logger.info("Notification email Realtime subscription connected.")
                        wake.set()  # Catch events missed during startup/reconnect.
                    else:
                        reconnect.set()

                channel = client.channel("server-notification-emails")
                channel.on_postgres_changes(
                    "INSERT", callback=changed, schema="public", table="notifications"
                )
                await asyncio.wait_for(channel.subscribe(subscription_state), timeout=20)
                while not reconnect.is_set():
                    try:
                        await asyncio.wait_for(reconnect.wait(), timeout=30)
                    except TimeoutError:
                        if not client.realtime.is_connected or not channel.is_joined:
                            break
                logger.warning("Notification email Realtime subscription reconnecting.")
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.warning("Notification email Realtime unavailable; queue recovery remains active.")
        finally:
            if client is not None:
                try:
                    await asyncio.wait_for(client.remove_all_channels(), timeout=5)
                except Exception:
                    logger.warning("Notification email Realtime channel cleanup failed.")
                finally:
                    with suppress(Exception):
                        await asyncio.wait_for(client.realtime.close(), timeout=5)
        await asyncio.sleep(5)


@asynccontextmanager
async def notification_email_lifespan(app):
    settings = EmailSettings.from_env()
    if settings is None:
        logger.info("Notification emails are disabled; set NOTIFICATION_EMAIL_ENABLED=true to enable delivery.")
        yield
        return
    stop = threading.Event()
    wake = threading.Event()
    worker = threading.Thread(target=run_email_worker, args=(settings, stop, wake),
                              name="notification-emails", daemon=True)
    worker.start()
    realtime = asyncio.create_task(listen_for_notification_emails(settings, wake))
    logger.info("Notification email worker started.")
    try:
        yield
    finally:
        stop.set()
        wake.set()
        realtime.cancel()
        with suppress(asyncio.CancelledError):
            await realtime
        await asyncio.to_thread(worker.join, 15)

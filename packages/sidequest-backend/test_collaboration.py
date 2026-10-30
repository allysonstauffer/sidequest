import json
import os
import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
from supabase import create_client

import post_handling as upload


class CollaborationTests(unittest.TestCase):
    def setUp(self):
        self.project = "33333333-3333-4333-8333-333333333333"
        self.user = "11111111-1111-4111-8111-111111111111"
        self.request_id = "44444444-4444-4444-8444-444444444444"
        self.calls = []
        self.failure = None
        env = patch.dict(os.environ, {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_KEY": "synthetic-key",
        }, clear=True)
        env.start()
        self.addCleanup(env.stop)

        def factory(url, key, options):
            options.httpx_client = httpx.Client(transport=httpx.MockTransport(self.handle))
            self.addCleanup(options.httpx_client.close)
            return create_client(url, key, options=options)

        mock = patch.object(upload, "create_client", side_effect=factory)
        mock.start()
        self.addCleanup(mock.stop)
        self.client = TestClient(upload.app)
        self.addCleanup(self.client.close)

    def handle(self, request):
        self.calls.append(request)
        self.assertEqual(request.headers["authorization"], "Bearer synthetic-user-token")
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={
                "id": self.user, "aud": "authenticated", "role": "authenticated",
                "email": "test@example.invalid", "app_metadata": {}, "user_metadata": {},
                "created_at": "2026-01-01T00:00:00Z",
            })
        if self.failure:
            return httpx.Response(400, json={
                "code": self.failure, "message": "Request cannot be answered.",
                "details": None, "hint": None,
            })
        data = json.loads(request.content)
        return httpx.Response(200, json={
            "id": self.request_id, "project_id": self.project,
            "status": data.get("p_status", "pending"),
        })

    def send(self, message="I can help with painting", headers=None):
        return self.client.post(
            f"/api/projects/{self.project}/collaboration-requests",
            json={"message": message},
            headers=headers if headers is not None else {"Authorization": "Bearer synthetic-user-token"},
        )

    def respond(self, status):
        return self.client.post(
            f"/api/collaboration-requests/{self.request_id}/response",
            json={"status": status}, headers={"Authorization": "Bearer synthetic-user-token"},
        )

    def test_send_uses_user_jwt_and_server_derived_identity(self):
        response = self.send("  I can help  ")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["request"]["status"], "pending")
        self.assertEqual(self.calls[-1].url.path, "/rest/v1/rpc/request_project_collaboration")
        self.assertEqual(json.loads(self.calls[-1].content), {
            "p_project_id": self.project, "p_message": "I can help",
        })

    def test_owner_response_uses_rpc(self):
        for status in ("accepted", "declined"):
            response = self.respond(status)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["request"]["status"], status)

    def test_unauthenticated_request_cannot_write(self):
        self.assertEqual(self.send(headers={}).status_code, 401)
        self.assertEqual(self.calls, [])

    def test_invalid_message_cannot_write(self):
        for message in ("", " " * 3, "x" * 1001):
            self.assertIn(self.send(message).status_code, (400, 422))
        self.assertEqual(self.calls, [])

    def test_invalid_status_cannot_write(self):
        self.assertEqual(self.respond("pending").status_code, 422)
        self.assertEqual(self.calls, [])

    def test_permission_failure_is_forbidden(self):
        self.failure = "42501"
        self.assertEqual(self.respond("accepted").status_code, 403)

    def test_stale_decision_returns_actionable_error(self):
        self.failure = "22023"
        response = self.respond("accepted")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Request cannot be answered.")

    def test_database_outage_is_not_a_permission_error(self):
        self.failure = "PGRST000"
        with self.assertLogs(level="ERROR"):
            self.assertEqual(self.send().status_code, 502)

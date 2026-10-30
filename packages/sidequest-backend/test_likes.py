import json
import os
import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
from supabase import create_client

import post_handling as upload


class LikeTests(unittest.TestCase):
    def setUp(self):
        self.project = "33333333-3333-4333-8333-333333333333"
        self.user = "11111111-1111-4111-8111-111111111111"
        self.calls = []
        self.failure = None
        env = patch.dict(os.environ, {
            "SUPABASE_URL": "https://example.supabase.co", "SUPABASE_KEY": "synthetic-key",
        }, clear=True)
        env.start()
        self.addCleanup(env.stop)

        def factory(url, key, options):
            options.httpx_client = httpx.Client(transport=httpx.MockTransport(self.handle))
            self.addCleanup(options.httpx_client.close)
            return create_client(url, key, options=options)

        factory_mock = patch.object(upload, "create_client", side_effect=factory)
        factory_mock.start()
        self.addCleanup(factory_mock.stop)
        self.client = TestClient(upload.app)
        self.addCleanup(self.client.close)

    def handle(self, request):
        self.calls.append(request)
        self.assertEqual(request.headers["authorization"], "Bearer synthetic-token")
        if request.url.path == "/auth/v1/user":
            if self.failure == "auth":
                return httpx.Response(401, json={"message": "Invalid JWT"})
            return httpx.Response(200, json={
                "id": self.user, "aud": "authenticated", "role": "authenticated",
                "email": "test@example.invalid", "app_metadata": {}, "user_metadata": {},
                "created_at": "2026-01-01T00:00:00Z",
            })
        self.assertEqual(request.url.path, "/rest/v1/rpc/set_project_like")
        if self.failure in ("42501", "PGRST000"):
            return httpx.Response(403, json={"code": self.failure, "message": "Rejected", "details": None, "hint": None})
        if self.failure == "malformed":
            return httpx.Response(200, json={"liked": True})
        params = json.loads(request.content)
        self.assertEqual(params["p_project_id"], self.project)
        return httpx.Response(200, json={"project_id": self.project, "liked": params["p_liked"], "like_count": int(params["p_liked"])})

    def send(self, method="POST", headers=None):
        return self.client.request(method, f"/api/projects/{self.project}/like", headers=headers if headers is not None else {"Authorization": "Bearer synthetic-token"})

    def test_like_and_unlike_use_explicit_state_and_user_jwt(self):
        for method, expected in (("POST", True), ("DELETE", False)):
            response = self.send(method)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertIs(response.json()["liked"], expected)
            self.assertIs(json.loads(self.calls[-1].content)["p_liked"], expected)

    def test_missing_auth_cannot_write(self):
        self.assertEqual(self.send(headers={}).status_code, 401)
        self.assertEqual(self.calls, [])

    def test_expired_auth_cannot_write(self):
        self.failure = "auth"
        self.assertEqual(self.send().status_code, 401)
        self.assertEqual(len(self.calls), 1)

    def test_invisible_project_is_forbidden(self):
        self.failure = "42501"
        self.assertEqual(self.send().status_code, 403)

    def test_outage_does_not_report_success(self):
        self.failure = "PGRST000"
        with self.assertLogs(level="ERROR"):
            self.assertEqual(self.send().status_code, 502)

    def test_malformed_success_cannot_update_the_heart(self):
        self.failure = "malformed"
        self.assertEqual(self.send().status_code, 502)

    def test_invalid_project_id_cannot_contact_database(self):
        self.project = "not-a-uuid"
        self.assertEqual(self.send().status_code, 422)
        self.assertEqual(self.calls, [])

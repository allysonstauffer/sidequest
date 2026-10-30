import io
import importlib.util
import json
import os
import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
from PIL import Image
from supabase import create_client

import upload


class PostingTests(unittest.TestCase):
    def setUp(self):
        self.user_id = "11111111-1111-4111-8111-111111111111"
        self.other_user_id = "22222222-2222-4222-8222-222222222222"
        self.project_id = "33333333-3333-4333-8333-333333333333"
        self.token = "synthetic-user-token"
        self.key = "sb_publishable_synthetic-test-key"
        self.requests = []
        self.failure = None
        image = io.BytesIO()
        Image.new("RGB", (8, 8), "blue").save(image, format="PNG")
        self.image = image.getvalue()
        self.env = patch.dict(
            os.environ,
            {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_KEY": self.key},
            clear=True,
        )
        self.env.start()
        self.addCleanup(self.env.stop)

        def client_factory(url, key, options):
            transport = httpx.MockTransport(self.handle_request)
            options.httpx_client = httpx.Client(transport=transport)
            self.addCleanup(options.httpx_client.close)
            return create_client(url, key, options=options)

        factory = patch.object(upload, "create_client", side_effect=client_factory)
        self.factory = factory.start()
        self.addCleanup(factory.stop)
        self.client = TestClient(upload.app)
        self.addCleanup(self.client.close)

    def handle_request(self, request):
        self.requests.append(request)
        # Exercise the real SDK: every outgoing request must retain user auth,
        # including cleanup and deletion, while the API key stays publishable.
        self.assertEqual(request.headers["Authorization"], f"Bearer {self.token}")
        self.assertEqual(request.headers["apikey"], self.key)
        path = request.url.path
        if path == "/auth/v1/user":
            if self.failure == "auth":
                return httpx.Response(401, json={"message": "Invalid JWT"})
            return httpx.Response(200, json={
                "id": self.user_id,
                "aud": "authenticated",
                "role": "authenticated",
                "email": "hobbyist@example.invalid",
                "app_metadata": {},
                "user_metadata": {},
                "created_at": "2026-01-01T00:00:00Z",
            })
        if path.startswith("/storage/v1/object/"):
            if request.method == "POST":
                if self.failure == "storage":
                    return httpx.Response(403, json={
                        "statusCode": "403", "error": "Unauthorized", "message": "RLS denied",
                    })
                return httpx.Response(200, json={"Key": path})
            if request.method == "DELETE":
                return httpx.Response(200, json=[])
        if path == "/rest/v1/projects":
            if request.method == "POST":
                if self.failure == "insert":
                    return httpx.Response(403, json={
                        "code": "42501", "message": "RLS denied", "details": None, "hint": None,
                    })
                if self.failure == "database_unavailable":
                    return httpx.Response(503, json={
                        "code": "PGRST000", "message": "Database unavailable", "details": None, "hint": None,
                    })
                return httpx.Response(201, json=[{
                    "id": self.project_id, **json.loads(request.content),
                }])
            if request.method == "GET":
                owner = self.other_user_id if self.failure == "not_owner" else self.user_id
                return httpx.Response(200, json=[{
                    "id": self.project_id,
                    "author_id": owner,
                    "media_urls": [f"https://example.supabase.co/storage/v1/object/public/project-media/images/{owner}/test.jpg"],
                }])
            if request.method == "DELETE":
                self.assertEqual(request.url.params["author_id"], f"eq.{self.user_id}")
                return httpx.Response(200, json=[{"id": self.project_id}])
        self.fail(f"Unexpected request: {request.method} {path}")

    def publish(self, image=None, headers=None, collaboration=None):
        data = {"title": "  A synthetic side quest  ", "description": "Review only"}
        if collaboration is not None:
            data["looking_for_collaborators"] = collaboration
        return self.client.post(
            "/api/upload",
            headers=headers if headers is not None else {"Authorization": f"Bearer {self.token}"},
            data=data,
            files={"attachment": ("review.png", self.image if image is None else image, "image/png")},
        )

    def writes(self):
        return [request for request in self.requests if request.method != "GET"]

    def test_publish_preserves_user_auth_with_publishable_key(self):
        response = self.publish()
        self.assertEqual(response.status_code, 200)
        project = response.json()["project"]
        self.assertEqual(project["author_id"], self.user_id)
        self.assertEqual(project["title"], "A synthetic side quest")
        self.assertEqual(len(self.writes()), 2)
        self.assertIn(f"/images/{self.user_id}/", project["media_urls"][0])

    def test_existing_secret_key_variable_still_works(self):
        os.environ["SUPABASE_SECRET_KEY"] = os.environ.pop("SUPABASE_KEY")
        self.assertEqual(self.publish().status_code, 200)

    def test_missing_collaboration_checkbox_defaults_to_false(self):
        response = self.publish()
        self.assertEqual(response.status_code, 200)
        self.assertIs(response.json()["project"]["looking_for_collaborators"], False)

    def test_checked_collaboration_checkbox_is_saved_as_boolean_true(self):
        response = self.publish(collaboration="true")
        self.assertEqual(response.status_code, 200)
        self.assertIs(response.json()["project"]["looking_for_collaborators"], True)

    def test_explicit_false_collaboration_flag_is_saved_as_false(self):
        response = self.publish(collaboration="false")
        self.assertEqual(response.status_code, 200)
        self.assertIs(response.json()["project"]["looking_for_collaborators"], False)

    def test_invalid_collaboration_flag_cannot_upload(self):
        response = self.publish(collaboration="maybe")
        self.assertEqual(response.status_code, 422)
        self.factory.assert_not_called()
        self.assertEqual(self.requests, [])

    def test_privileged_key_does_not_replace_user_auth(self):
        self.key = "sb_secret_synthetic-test-key"
        os.environ["SUPABASE_KEY"] = self.key
        self.assertEqual(self.publish().status_code, 200)

    def test_users_do_not_share_authentication(self):
        self.assertEqual(self.publish().status_code, 200)
        self.user_id = self.other_user_id
        self.token = "another-synthetic-token"
        response = self.publish()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["project"]["author_id"], self.other_user_id)
        self.assertEqual(self.factory.call_count, 2)

    def test_missing_authentication_does_not_contact_supabase(self):
        self.assertEqual(self.publish(headers={}).status_code, 401)
        self.factory.assert_not_called()

    def test_invalid_token_cannot_write(self):
        self.failure = "auth"
        self.assertEqual(self.publish().status_code, 401)
        self.assertEqual(self.writes(), [])

    def test_missing_configuration_has_actionable_error(self):
        os.environ.pop("SUPABASE_KEY")
        response = self.publish()
        self.assertEqual(response.status_code, 503)
        self.assertIn("not configured", response.json()["detail"])
        self.factory.assert_not_called()

    def test_storage_failure_does_not_insert_project(self):
        self.failure = "storage"
        with self.assertLogs(level="ERROR"):
            response = self.publish()
        self.assertEqual(response.status_code, 502)
        self.assertIn("upload the image", response.json()["detail"])
        self.assertEqual(len(self.writes()), 1)

    def test_insert_failure_cleans_up_only_uploaded_image(self):
        self.failure = "insert"
        with self.assertLogs(level="ERROR"):
            response = self.publish()
        self.assertEqual(response.status_code, 403)
        self.assertIn("permission to save posts", response.json()["detail"])
        writes = self.writes()
        self.assertEqual([request.method for request in writes], ["POST", "POST", "DELETE"])
        uploaded_path = writes[0].url.path.split("/project-media/", 1)[1]
        self.assertEqual(json.loads(writes[2].content)["prefixes"], [uploaded_path])

    def test_database_outage_is_not_reported_as_a_permission_error(self):
        self.failure = "database_unavailable"
        with self.assertLogs(level="ERROR"):
            response = self.publish()
        self.assertEqual(response.status_code, 502)
        self.assertIn("Could not save your post", response.json()["detail"])
        self.assertEqual(self.writes()[-1].method, "DELETE")

    def test_invalid_image_cannot_write(self):
        self.assertEqual(self.publish(image=b"not an image").status_code, 400)
        self.assertEqual(self.writes(), [])

    def test_oversized_image_cannot_write(self):
        with patch.object(upload, "MAX_UPLOAD_BYTES", len(self.image) - 1):
            self.assertEqual(self.publish().status_code, 413)
        self.assertEqual(self.writes(), [])

    def test_owner_can_delete_post_and_image(self):
        response = self.client.delete(
            f"/api/upload?id={self.project_id}",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"deleted": True, "media_cleanup": True})
        self.assertEqual(len(self.writes()), 2)

    def test_other_users_post_cannot_be_deleted(self):
        self.failure = "not_owner"
        response = self.client.delete(
            f"/api/upload?id={self.project_id}",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.writes(), [])

    def test_separate_api_origin_accepts_only_configured_frontend(self):
        with patch.dict(os.environ, {
            "SIDEQUEST_FRONTEND_ORIGINS": "https://app.example.invalid",
        }):
            spec = importlib.util.spec_from_file_location("posting_cors", upload.__file__)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
        with TestClient(module.app) as client:
            headers = {
                "Origin": "https://app.example.invalid",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            }
            allowed = client.options("/api/upload", headers=headers)
            self.assertEqual(allowed.status_code, 200)
            self.assertEqual(
                allowed.headers["access-control-allow-origin"], headers["Origin"]
            )
            headers["Origin"] = "https://unconfigured.example.invalid"
            self.assertEqual(client.options("/api/upload", headers=headers).status_code, 400)
        self.assertEqual(self.requests, [])


if __name__ == "__main__":
    unittest.main()

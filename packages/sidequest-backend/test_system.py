"""System tests for writes that require a signed-in user."""

import unittest

from fastapi.testclient import TestClient

import post_handling


PROJECT_ID = "33333333-3333-4333-8333-333333333333"
REQUEST_ID = "44444444-4444-4444-8444-444444444444"


class signInCheckTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(post_handling.app)
        self.addCleanup(self.client.close)

    def assert_sign_in_required(self, response):
        self.assertEqual(response.status_code, 401, response.text)
        self.assertEqual(response.json()["detail"], "Sign in before posting.")

    def test_signed_out_user_cannot_like_project(self):
        response = self.client.post(f"/api/projects/{PROJECT_ID}/like")
        self.assert_sign_in_required(response)

    def test_signed_out_user_cannot_unlike_project(self):
        response = self.client.delete(f"/api/projects/{PROJECT_ID}/like")
        self.assert_sign_in_required(response)

    def test_signed_out_user_cannot_request_collaboration(self):
        response = self.client.post(
            f"/api/projects/{PROJECT_ID}/collaboration-requests",
            json={"message": "I can help with this project"},
        )
        self.assert_sign_in_required(response)

    def test_signed_out_user_cannot_accept_collaboration_request(self):
        response = self.client.post(
            f"/api/collaboration-requests/{REQUEST_ID}/response",
            json={"status": "accepted"},
        )
        self.assert_sign_in_required(response)


if __name__ == "__main__":
    unittest.main()

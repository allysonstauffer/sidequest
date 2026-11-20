# TDD:

The optional RSVP/calendar feature and its Red–Green–Refactor process are
covered in the [frontend testing document](../packages/sidequest-frontend/tests/TESTING.md#part-i-test-driven-development).

# Unit Tests:

The six Part II unit tests cover community validation and activity
recommendations. Test descriptions and commands are in the
[unit testing section](../packages/sidequest-frontend/tests/TESTING.md#part-ii-unit-testing).

# System Tests:
Used FastAPI's TestClient as well as Python's unittest libraries to do the backend system tests.
To run this, do the following commands:
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m unittest -v test_system.py

def assert_sign_in_required(self, response):
Checks to ensure that you have to be signed in to post

def test_signed_out_user_cannot_like_project(self):
Check to ensure that you can't like projects if you aren't signed in
def test_signed_out_user_cannot_unlike_project(self):
Check to ensure that you can't unlike projects if you arent signed in
def test_signed_out_user_cannot_request_collaboration(self):
Check to ensure that you can't request to be a collaborator if you aren't signed in
def test_signed_out_user_cannot_accept_collaboration_request(self):
Check to ensure that you cannot accept collaborators if you aren't signed in

No env. var. needed
In the future, we'd like to test if likes/dislikes function properly in the backend using a test account and the actual Supabase database.





# UI Tests:

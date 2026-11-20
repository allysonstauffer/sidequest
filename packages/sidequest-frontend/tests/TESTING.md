# TE7: Automated testing

Ticket: Make Google Calendar an optional RSVP action

Work completed November 19–20, 2026

Part I covers the optional Google Calendar action from ticket.
Part II unig tests community validation and activity
recommendations as two separate units outside that feature.

## Part I: Test-driven development

### What needed to change

Clicking RSVP used to start Google authorization automatically.
The change for this ticket was to save the RSVP on its own, then
let the user choose **Add to calendar** afterward. If Google
access is denied or a calendar request fails, the RSVP should
stay saved and the user should be able to try again.

The tests for this part are in
[SidequestEvents.test.tsx](SidequestEvents.test.tsx). They
render the component and click its buttons using Vitest, React
Testing Library, and jsdom. Supabase and Google are mocked so
these tests don't need a real account or create actual calendar
events.

### 1. Saving an RSVP without Google

**Red:** The first test was
`RSVP saves attendance without starting Google Calendar authorization`.
It clicked RSVP, checked that attendance was saved, and checked
that Google was never contacted. These were the main assertions:

```tsx
expect(mocks.insertRsvp).toHaveBeenCalledTimes(1);
expect(mocks.insertRsvp).toHaveBeenCalledWith({
  sidequest_id: event.id,
  attendee_id: "user-1"
});
expect(initTokenClient).not.toHaveBeenCalled();
expect(calendarFetch).not.toHaveBeenCalled();
```

Running the test against the original code gave this failure:

```text
AssertionError: expected "vi.fn()" to not be called at all,
but actually been called 1 times

Tests  1 failed (1)
```

The RSVP had saved, but `toggleRsvp()` had also initialized
Google OAuth. That was the behavior the test was meant to catch.

**Green:** Removed the Google token request and calendar
insertion from `toggleRsvp()`. The handler kept its existing
database insert/delete logic and updated the RSVP state after a
successful save. Running the same test again gave **1 passed**.

### 2. Showing the optional calendar button

**Red:** Added
`a user with a saved RSVP can choose Add to calendar`. This test
loaded an existing RSVP and looked for an enabled Add to
calendar button. It failed because the button wasn't there:

```text
Unable to find an accessible element with the role "button"
and name "Add to calendar"

Tests  1 failed | 1 passed (2)
```

**Green:** Added the button inside a `rsvpIds.has(event.id)`
check, so it only appears for saved RSVPs. At this point it
didn't have a click handler yet. Both tests passed: **2
passed**.

### 3. Making the calendar button work

**Red:** Added
`only an explicit calendar click authorizes Google and sends the event details`.
The test checked that nothing happened just from loading the
event. After clicking Add to calendar, it expected authorization
and one calendar POST with the token, title, description,
location, and dates. It also checked that the action didn't
insert or delete an RSVP.

The new test failed because the button had no handler:

```text
AssertionError: expected "vi.fn()" to be called 1 times,
but got 0 times

Tests  1 failed | 2 passed (3)
```

**Green:** Added `handleAddToCalendar()` and connected it to the
button. It requested the token, called `addToGoogleCalendar()`,
and displayed the result. The authorization request starts
directly from the button click so the popup can open. The result
was **3 passed**.

### 4. Handling failures and repeated clicks

**Red:** Added five cases for an HTTP error, a network error,
declined Google access, clicking while a request is pending, and
clicking again after a successful addition. The result was:

```text
Tests  5 failed | 3 passed (8)
```

The error messages didn't explain that attendance was still
saved or how to retry. One failure was:

```text
AssertionError: expected 'Failed to fetch' to match
/RSVP is still saved.*try.*again/i
```

The other checks also found that the pending and success button
states were missing.

**Green:** Added `calendarInProgress` to track a pending request
and `calendarAddedIds` to track successful additions in the
current view. The button now shows Adding… while waiting and
Added to calendar after success. Repeated submissions and RSVP
changes are disabled while the calendar action is pending.

On failure, the error message explains that the RSVP is still
saved and that Add to calendar can be tried again. The `finally`
block clears the pending state, which enables the button for
another attempt. The retry tests confirm that this doesn't
submit another RSVP.

All eight tests then passed: **8 passed**.

### Refactor

The event fixture, rendering/database setup, and Google stubs
were moved into shared helpers: `event`, `renderEvents()`, and
`stubGoogle()`. The first two tests still passed after this
setup was reorganized.

The Google OAuth types, permission checks, and HTTP request were
also moved out of the component into
[googleCalendar.ts](../src/lib/googleCalendar.ts). This left the
component with separate handlers for attendance and calendar
addition. The extracted helpers still use the same token
validation and event payload. A small CSS rule keeps the two
action buttons together and lets them wrap when space is
limited.

Seven more regression cases covered failed RSVP saves,
cancellation, missing Google configuration or script, a closed
popup, missing permission, and repeated clicks while
authorization is still pending. These already passed when added;
they weren't additional Red cycles. With those included, **all
15 component tests passed after the final refactor**.

## Part II: Unit testing

For this part, the units are separate from the calendar feature:
community input validation and activity recommendations. There
are **six tests across two units**, with three tests for each
function. That meets the requirement of at least four tests
across two units.

Both functions are tested directly in a Node environment. The
tests use small input objects and check the returned validation
message or activity order. They don't need React, a database,
browser APIs, or network mocks.

### `validateCommunityDraft()` — 3 tests

File:
[unit/communityValidation.test.ts](unit/communityValidation.test.ts)

Code:
[communityValidation.ts](../src/utils/communityValidation.ts)

1. **Name length:** accepts a trimmed name of exactly 100
   characters, even with surrounding spaces, and rejects a
   101-character name.
2. **Description length:** accepts exactly 1000 characters and
   rejects 1001 characters with the description error.
3. **Available categories:** accepts a custom hobby ID when it
   is in the supplied category list and rejects it when it isn't
   available.

These tests cover validation boundaries and make sure category
choices come from the available data rather than a fixed list.

### `recommendActivities()` — 3 tests

File:
[unit/recommendActivities.test.ts](unit/recommendActivities.test.ts)

Code:
[recommendActivities.ts](../src/preferences/recommendActivities.ts)

1. **Filtering:** excludes activities above the user's skill
   level and activities for hobbies the user hasn't selected.
2. **Ranking:** puts exact skill matches first, followed by
   activities that are progressively easier for the user.
3. **Ties:** preserves the original activity order when several
   activities have the same skill gap, including across
   different hobbies.

The recommendation tests use their own small activity lists so
the expected results don't depend on changes to the default
catalogue.

### Unit test result

Ran the two Part II test files with:

```bash
npm run test:unit:te7 --workspace=sidequest-frontend
```

The result was:

```text
Test Files  2 passed (2)
     Tests  6 passed (6)
```

These functions already existed, so no production changes were
needed for Part II. The calendar feature's test-first work and
failing runs are documented in Part I. The earlier six calendar
unit tests are kept as extra regression coverage and aren't
included in the six tests chosen for Part II.

## Running the checks

Run these from the `sidequest` repository root:

```bash
# The 15 RSVP/calendar component tests
npm run test:events --workspace=sidequest-frontend

# The 6 non-calendar unit tests for Part II
npm run test:unit:te7 --workspace=sidequest-frontend

# All frontend tests, including type checking
npm test --workspace=sidequest-frontend

# Build and lint
npm run build --workspace=sidequest-frontend
npm run lint --workspace=sidequest-frontend
```

## Results

| Tests                                             | Passing |
| ------------------------------------------------- | ------- |
| Existing and merged frontend tests                | 55      |
| Part II: validation and recommendation unit tests | 6       |
| Extra calendar unit tests                         | 6       |
| RSVP/calendar component tests                     | 15      |
| **Frontend total**                                | **82**  |
| Backend tests                                     | 72      |
| Database tests                                    | 12      |
| **Project total**                                 | **166** |

## Testing levels

- **Unit tests** verify isolated functions. The selected tools are
  Vitest in a Node environment. Community validation and activity
  recommendation have six tests across two units; Google Calendar
  helpers have additional unit coverage.
- **System tests** verify FastAPI endpoints with their request
  validation, authentication, service logic, and mocked Supabase
  data-access calls. The selected tools are Python `unittest`,
  `TestClient`, and `httpx.MockTransport`.
- **UI/component tests** verify complete interactions through the
  React interface. The selected tools are Vitest, jsdom, React
  Testing Library, and mocked Supabase/Google clients. The
  RSVP/calendar component has 15 tests.
- **Database tests** verify migrations and Row Level Security in
  isolated PGlite databases using Node's test runner.

## Part III: System testing

The backend API test suites exercise more than one application
layer for a feature. Representative system tests include:

- `test_like_and_unlike_use_explicit_state_and_user_jwt` in
  [packages/sidequest-backend/test_likes.py](../../sidequest-backend/test_likes.py)
  sends like/unlike HTTP requests, verifies authentication, and
  observes the RPC/database call produced for each action.
- `test_send_uses_user_jwt_and_server_derived_identity` in
  [packages/sidequest-backend/test_collaboration.py](../../sidequest-backend/test_collaboration.py)
  submits a collaboration request through `TestClient`, validates
  the API response, and verifies the RPC parameters used in the
  Supabase data-access layer.
- [packages/sidequest-backend/test_system.py](../../sidequest-backend/test_system.py)
  verifies that signed-out API requests are rejected consistently
  across project likes and collaboration actions.

These tests use synthetic UUIDs and in-memory/mock HTTP responses.
They do not require a live Supabase project.

## Part IV: UI testing

The complete RSVP-to-optional-calendar user story is covered in
[SidequestEvents.test.tsx](SidequestEvents.test.tsx):

1. A user RSVPs for an event. The test verifies visible state
   changes and that Google authorization does not start
   automatically.
2. The user then explicitly selects **Add to calendar**. The test
   verifies authorization, the Google Calendar request, the success
   alert, and the absence of RSVP inserts/deletes.
3. Failure tests verify that attendance remains saved and that a
   visible retry action can succeed after an HTTP/network error.

These tests assert accessible roles, button names, displayed alerts,
and user actions rather than component implementation details.

## Installation and running the full suite

From the repository root:

```bash
npm install
python -m pip install -r packages/sidequest-backend/requirements.txt
npm test
```

The root `npm test` command runs the frontend, backend, and
database suites. It can be run with individual suites:

```bash
npm run test:frontend
npm run test:backend
npm run test:database
npm test --workspace=sidequest-frontend
```

## External services and known limitations

No live external service or real credentials are required for the
automated suite. Supabase and Google are mocked in frontend/backend
tests, backend HTTP calls are handled by `httpx.MockTransport`, and
database tests run in PGlite. The backend suite requires Python
dependencies from `requirements.txt`.

Browser automation is not used; React component tests cover the
available UI behavior in jsdom. Future work could add Playwright
tests against a deployed environment and expand the placeholder
community/search/message screens.


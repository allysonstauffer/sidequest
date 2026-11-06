# TE6: Authentication and Access Tokens

SideQuest uses Supabase Auth to authenticate users and manage
sessions.

## How it works

1. A user signs in with their credentials.
2. Supabase returns an access token and a refresh token.
3. The session is stored in the browser so the user can remain
   signed in.
4. The access token expires after 3,600 seconds (one hour).
5. Supabase can use the refresh token to obtain a new access
   token.
6. If the session ends or the refresh token can no longer be
   used, the user must sign in again.

The access token does not last forever, but its expiration does
not automatically sign the user out. Currently, no overall
session time limit or inactivity timeout is configured.

## Sign-in Sequence Diagram

<img width="2488" height="1110" alt="signup" src="https://github.com/user-attachments/assets/f1fd51cb-a549-46a6-81ae-360178c4acb0" />

## Sign-up Sequence Diagram

<img width="2572" height="1310" alt="signin" src="https://github.com/user-attachments/assets/b6d0c3ba-c216-4614-8dca-8df0b8fde462" />

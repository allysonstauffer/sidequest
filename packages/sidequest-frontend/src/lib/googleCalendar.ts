type CalendarEvent = {
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  scope?: string;
};

type GoogleOAuth = {
  accounts: {
    oauth2: {
      initTokenClient: (options: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
        error_callback: (error: { type: string }) => void;
      }) => { requestAccessToken: () => void };
    };
  };
};

const CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

export function requestGoogleCalendarToken(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_OAUTH_ID;
  if (!clientId) {
    return Promise.reject(
      new Error("Google Calendar is not configured.")
    );
  }

  const google = (window as Window & { google?: GoogleOAuth })
    .google;
  if (!google?.accounts?.oauth2) {
    return Promise.reject(
      new Error(
        "Google Calendar sign-in did not load. Please try again."
      )
    );
  }

  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CALENDAR_SCOPE,
      callback: (response) => {
        if (
          response.error ||
          !response.access_token ||
          !response.scope?.split(" ").includes(CALENDAR_SCOPE)
        ) {
          reject(
            new Error("Google Calendar access was not granted.")
          );
          return;
        }
        resolve(response.access_token);
      },
      error_callback: () => {
        reject(
          new Error("Google Calendar sign-in was closed.")
        );
      }
    });
    client.requestAccessToken();
  });
}

export async function addToGoogleCalendar(
  event: CalendarEvent,
  accessToken: string
): Promise<void> {
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        summary: event.title,
        description: event.description,
        location: event.location,
        start: { dateTime: event.starts_at },
        end: { dateTime: event.ends_at }
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      "Could not add the event to Google Calendar."
    );
  }
}

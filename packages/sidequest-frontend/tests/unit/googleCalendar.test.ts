// @vitest-environment node

import { afterEach, describe, expect, test, vi } from "vitest";
import {
  addToGoogleCalendar,
  requestGoogleCalendarToken
} from "../../src/lib/googleCalendar";

const calendarScope =
  "https://www.googleapis.com/auth/calendar.events";

type TokenResponse = {
  access_token?: string;
  scope?: string;
  error?: string;
};

// Supply only the external OAuth interface; no component or DOM is loaded.
function stubOAuth(response: TokenResponse) {
  const requestAccessToken = vi.fn();
  const initTokenClient = vi.fn(
    (options: {
      client_id: string;
      scope: string;
      callback: (response: TokenResponse) => void;
    }) => ({
      requestAccessToken: () => {
        requestAccessToken();
        options.callback(response);
      }
    })
  );

  vi.stubEnv("VITE_GOOGLE_OAUTH_ID", "unit-test-client");
  vi.stubGlobal("window", {
    google: { accounts: { oauth2: { initTokenClient } } }
  });
  return { initTokenClient, requestAccessToken };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("unit: requestGoogleCalendarToken", () => {
  test("returns the token when Google grants calendar permission", async () => {
    const { initTokenClient, requestAccessToken } = stubOAuth({
      access_token: "granted-token",
      scope: `openid ${calendarScope} email`
    });

    await expect(requestGoogleCalendarToken()).resolves.toBe(
      "granted-token"
    );
    expect(initTokenClient).toHaveBeenCalledTimes(1);
    expect(initTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "unit-test-client",
        scope: calendarScope
      })
    );
    expect(requestAccessToken).toHaveBeenCalledTimes(1);
  });

  test("rejects when Google denies authorization", async () => {
    stubOAuth({ error: "access_denied" });

    await expect(requestGoogleCalendarToken()).rejects.toThrow(
      "Google Calendar access was not granted."
    );
  });

  test("rejects a token without the exact calendar permission", async () => {
    // A similar scope must not be accepted as calendar write access.
    stubOAuth({
      access_token: "insufficient-token",
      scope: `${calendarScope}.readonly`
    });

    await expect(requestGoogleCalendarToken()).rejects.toThrow(
      "Google Calendar access was not granted."
    );
  });
});

describe("unit: addToGoogleCalendar", () => {
  const event = {
    title: "Weekend hiking",
    description: "A group hike.",
    location: "City Park",
    starts_at: "2099-12-01T10:00:00Z",
    ends_at: "2099-12-01T12:00:00Z"
  };

  test("posts the event details with the supplied token", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetch);

    await expect(
      addToGoogleCalendar(event, "calendar-token")
    ).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer calendar-token",
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
  });

  test("rejects an unsuccessful calendar HTTP response", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 403 }));
    vi.stubGlobal("fetch", fetch);

    await expect(
      addToGoogleCalendar(event, "calendar-token")
    ).rejects.toThrow(
      "Could not add the event to Google Calendar."
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("propagates a network failure to the caller", async () => {
    const networkError = new TypeError("Failed to fetch");
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(networkError);
    vi.stubGlobal("fetch", fetch);

    await expect(
      addToGoogleCalendar(event, "calendar-token")
    ).rejects.toBe(networkError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

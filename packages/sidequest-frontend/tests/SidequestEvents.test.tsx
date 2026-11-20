// @vitest-environment jsdom

import { afterEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SidequestEvents from "../src/components/SidequestEvents";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  insertRsvp: vi.fn(),
  deleteRsvp: vi.fn()
}));

vi.mock("../src/lib/supabase", () => ({
  supabase: { from: mocks.from }
}));

vi.mock("../src/hobbies/useHobbyCategories", () => ({
  useHobbyCategories: () => ({
    categories: [],
    status: "ready"
  })
}));

const event = {
  id: "event-1",
  host_id: "host-1",
  title: "Weekend hiking",
  description: "A group hike.",
  starts_at: "2099-12-01T10:00:00Z",
  ends_at: "2099-12-01T12:00:00Z",
  location: "City Park",
  hobby: "hiking",
  skill_level: "Beginner"
};

function queryResult(data: unknown[]) {
  const result = Promise.resolve({ data, error: null });
  return {
    select() {
      return this;
    },
    gt() {
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return this;
    },
    eq() {
      return this;
    },
    in() {
      return this;
    },
    then: result.then.bind(result)
  };
}

function renderEvents(rsvped = false) {
  mocks.insertRsvp.mockResolvedValue({ error: null });
  mocks.deleteRsvp.mockReturnValue(queryResult([]));
  mocks.from.mockImplementation((table: string) => {
    if (table === "sidequests") return queryResult([event]);
    if (table === "sidequest_rsvps") {
      return {
        ...queryResult(
          rsvped ? [{ sidequest_id: event.id }] : []
        ),
        insert: mocks.insertRsvp,
        delete: mocks.deleteRsvp
      };
    }
    if (table === "creator_profiles") return queryResult([]);
    throw new Error(`Unexpected table: ${table}`);
  });
  render(
    <MemoryRouter>
      <SidequestEvents
        viewerId="user-1"
        title="Upcoming sidequests"
      />
    </MemoryRouter>
  );
}

type TokenResponse = {
  access_token?: string;
  scope?: string;
  error?: string;
};
type TokenOptions = {
  callback: (response: TokenResponse) => void;
  error_callback: (error: { type: string }) => void;
};

function stubGoogle(
  response: TokenResponse = {
    access_token: "fake-token",
    scope: "https://www.googleapis.com/auth/calendar.events"
  }
) {
  const requestAccessToken = vi.fn();
  const initTokenClient = vi.fn((options: TokenOptions) => ({
    requestAccessToken: () => {
      requestAccessToken();
      options.callback(response);
    }
  }));
  vi.stubEnv("VITE_GOOGLE_OAUTH_ID", "fake-client-id");
  vi.stubGlobal("google", {
    accounts: { oauth2: { initTokenClient } }
  });
  const calendarFetch = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", calendarFetch);
  return { initTokenClient, requestAccessToken, calendarFetch };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

test("RSVP saves attendance without starting Google Calendar authorization", async () => {
  const { initTokenClient, calendarFetch } = stubGoogle();
  renderEvents();
  const rsvp = await screen.findByRole("button", {
    name: "RSVP"
  });
  expect(
    screen.queryByRole("button", { name: "Add to calendar" })
  ).toBeNull();
  fireEvent.click(rsvp);
  await waitFor(() => {
    expect(
      screen
        .getByRole("button", { name: "Cancel RSVP" })
        .hasAttribute("disabled")
    ).toBe(false);
  });
  expect(mocks.insertRsvp).toHaveBeenCalledTimes(1);
  expect(mocks.insertRsvp).toHaveBeenCalledWith({
    sidequest_id: event.id,
    attendee_id: "user-1"
  });
  expect(initTokenClient).not.toHaveBeenCalled();
  expect(calendarFetch).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Add to calendar" })
  ).toBeTruthy();
});

test("a user with a saved RSVP can choose Add to calendar", async () => {
  renderEvents(true);
  await screen.findByRole("button", { name: "Cancel RSVP" });
  expect(
    screen
      .getByRole("button", { name: "Add to calendar" })
      .hasAttribute("disabled")
  ).toBe(false);
});

test("only an explicit calendar click authorizes Google and sends the event details", async () => {
  const { initTokenClient, requestAccessToken, calendarFetch } =
    stubGoogle();
  renderEvents(true);
  const button = await screen.findByRole("button", {
    name: "Add to calendar"
  });
  expect(initTokenClient).not.toHaveBeenCalled();
  expect(calendarFetch).not.toHaveBeenCalled();

  fireEvent.click(button);

  await waitFor(() =>
    expect(calendarFetch).toHaveBeenCalledTimes(1)
  );
  expect(initTokenClient).toHaveBeenCalledTimes(1);
  expect(requestAccessToken).toHaveBeenCalledTimes(1);
  expect(calendarFetch).toHaveBeenCalledWith(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer fake-token",
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
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Added to Google Calendar."
  );
  expect(mocks.insertRsvp).not.toHaveBeenCalled();
  expect(mocks.deleteRsvp).not.toHaveBeenCalled();
});

test.each(["HTTP error", "network error"])(
  "%s leaves attendance saved and allows a successful calendar retry",
  async (failure) => {
    const { calendarFetch, requestAccessToken } = stubGoogle();
    if (failure === "HTTP error") {
      calendarFetch.mockResolvedValueOnce({ ok: false });
    } else {
      calendarFetch.mockRejectedValueOnce(
        new TypeError("Failed to fetch")
      );
    }
    renderEvents(true);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Add to calendar"
      })
    );

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(
        /RSVP is still saved.*try.*again/i
      )
    );
    expect(
      screen.getByRole("button", { name: "Cancel RSVP" })
    ).toBeTruthy();
    const retry = screen.getByRole("button", {
      name: "Add to calendar"
    });
    expect(retry.hasAttribute("disabled")).toBe(false);
    fireEvent.click(retry);

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "Added to Google Calendar."
      )
    );
    expect(calendarFetch).toHaveBeenCalledTimes(2);
    expect(requestAccessToken).toHaveBeenCalledTimes(2);
    expect(mocks.insertRsvp).not.toHaveBeenCalled();
    expect(mocks.deleteRsvp).not.toHaveBeenCalled();
  }
);

test("declining Google access preserves the RSVP and allows another authorization attempt", async () => {
  const response: TokenResponse = { error: "access_denied" };
  const { calendarFetch, requestAccessToken } =
    stubGoogle(response);
  renderEvents(true);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Add to calendar"
    })
  );

  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toMatch(
      /RSVP is still saved.*access was not granted/i
    )
  );
  expect(calendarFetch).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Cancel RSVP" })
  ).toBeTruthy();

  delete response.error;
  response.access_token = "fake-token";
  response.scope =
    "https://www.googleapis.com/auth/calendar.events";
  fireEvent.click(
    screen.getByRole("button", { name: "Add to calendar" })
  );
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "Added to Google Calendar."
    )
  );
  expect(requestAccessToken).toHaveBeenCalledTimes(2);
  expect(calendarFetch).toHaveBeenCalledTimes(1);
  expect(mocks.insertRsvp).not.toHaveBeenCalled();
  expect(mocks.deleteRsvp).not.toHaveBeenCalled();
});

test("pending calendar creation blocks duplicate additions and RSVP cancellation", async () => {
  const { calendarFetch, requestAccessToken } = stubGoogle();
  let finish!: (response: { ok: boolean }) => void;
  calendarFetch.mockReturnValueOnce(
    new Promise<{ ok: boolean }>((resolve) => {
      finish = resolve;
    })
  );
  renderEvents(true);
  const button = await screen.findByRole("button", {
    name: "Add to calendar"
  });
  fireEvent.click(button);
  await waitFor(() =>
    expect(calendarFetch).toHaveBeenCalledTimes(1)
  );

  try {
    expect(
      screen
        .getByRole("button", { name: "Adding…" })
        .hasAttribute("disabled")
    ).toBe(true);
    const cancel = screen.getByRole("button", {
      name: "Cancel RSVP"
    });
    expect(cancel.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button);
    fireEvent.click(cancel);
    expect(calendarFetch).toHaveBeenCalledTimes(1);
    expect(requestAccessToken).toHaveBeenCalledTimes(1);
    expect(mocks.deleteRsvp).not.toHaveBeenCalled();
  } finally {
    await act(async () => finish({ ok: true }));
  }
});

test("a successful addition cannot be submitted again in the current view", async () => {
  const { calendarFetch, requestAccessToken } = stubGoogle();
  renderEvents(true);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Add to calendar"
    })
  );
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "Added to Google Calendar."
    )
  );

  const added = screen.getByRole("button", {
    name: "Added to calendar"
  });
  expect(added.hasAttribute("disabled")).toBe(true);
  fireEvent.click(added);
  expect(calendarFetch).toHaveBeenCalledTimes(1);
  expect(requestAccessToken).toHaveBeenCalledTimes(1);
});

test("a failed RSVP never offers calendar addition or requests Google access", async () => {
  const { initTokenClient, calendarFetch } = stubGoogle();
  renderEvents();
  mocks.insertRsvp.mockResolvedValueOnce({
    error: { message: "RSVP could not be saved." }
  });
  fireEvent.click(
    await screen.findByRole("button", { name: "RSVP" })
  );
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "RSVP could not be saved."
    )
  );

  expect(
    screen
      .getByRole("button", { name: "RSVP" })
      .hasAttribute("disabled")
  ).toBe(false);
  expect(
    screen.queryByRole("button", { name: "Add to calendar" })
  ).toBeNull();
  expect(initTokenClient).not.toHaveBeenCalled();
  expect(calendarFetch).not.toHaveBeenCalled();
});

test("cancelling an RSVP removes the calendar action without contacting Google", async () => {
  const { initTokenClient, calendarFetch } = stubGoogle();
  renderEvents(true);
  fireEvent.click(
    await screen.findByRole("button", { name: "Cancel RSVP" })
  );
  await screen.findByRole("button", { name: "RSVP" });

  expect(mocks.deleteRsvp).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByRole("button", { name: "Add to calendar" })
  ).toBeNull();
  expect(initTokenClient).not.toHaveBeenCalled();
  expect(calendarFetch).not.toHaveBeenCalled();
});

test.each([
  ["unconfigured client", "Google Calendar is not configured."],
  ["missing script", "Google Calendar sign-in did not load."],
  ["closed popup", "Google Calendar sign-in was closed."],
  ["missing scope", "Google Calendar access was not granted."]
])(
  "%s preserves attendance and leaves calendar addition available",
  async (failure, message) => {
    const { initTokenClient, calendarFetch } = stubGoogle(
      failure === "missing scope"
        ? { access_token: "fake-token", scope: "openid" }
        : undefined
    );
    if (failure === "unconfigured client")
      vi.stubEnv("VITE_GOOGLE_OAUTH_ID", "");
    if (failure === "missing script")
      vi.stubGlobal("google", undefined);
    if (failure === "closed popup") {
      initTokenClient.mockImplementation(
        (options: TokenOptions) => ({
          requestAccessToken: () =>
            options.error_callback({ type: "popup_closed" })
        })
      );
    }
    renderEvents(true);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Add to calendar"
      })
    );
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        message
      )
    );

    expect(screen.getByRole("alert").textContent).toMatch(
      /RSVP is still saved.*try.*again/i
    );
    expect(
      screen.getByRole("button", { name: "Cancel RSVP" })
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Add to calendar" })
        .hasAttribute("disabled")
    ).toBe(false);
    expect(calendarFetch).not.toHaveBeenCalled();
    expect(mocks.insertRsvp).not.toHaveBeenCalled();
    expect(mocks.deleteRsvp).not.toHaveBeenCalled();
  }
);

test("waiting for Google authorization blocks repeated clicks before any calendar request", async () => {
  const { initTokenClient, requestAccessToken, calendarFetch } =
    stubGoogle();
  let complete!: TokenOptions["callback"];
  initTokenClient.mockImplementation(
    (options: TokenOptions) => {
      complete = options.callback;
      return { requestAccessToken };
    }
  );
  renderEvents(true);
  const button = await screen.findByRole("button", {
    name: "Add to calendar"
  });
  fireEvent.click(button);
  try {
    expect(
      screen
        .getByRole("button", { name: "Adding…" })
        .hasAttribute("disabled")
    ).toBe(true);
    fireEvent.click(button);
    expect(initTokenClient).toHaveBeenCalledTimes(1);
    expect(requestAccessToken).toHaveBeenCalledTimes(1);
    expect(calendarFetch).not.toHaveBeenCalled();
  } finally {
    await act(async () =>
      complete({
        access_token: "fake-token",
        scope: "https://www.googleapis.com/auth/calendar.events"
      })
    );
  }
  expect(calendarFetch).toHaveBeenCalledTimes(1);
});

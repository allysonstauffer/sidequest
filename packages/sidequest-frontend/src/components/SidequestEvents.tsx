import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { SKILL_LEVELS } from "../preferences/model";
import {
  useHobbyCategories,
  type HobbyCategory
} from "../hobbies/useHobbyCategories";
import "./SidequestEvents.css";

type SidequestEvent = {
  id: string;
  host_id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  location: string;
  hobby: string;
  skill_level: string;
};

type SidequestEventsProps = {
  viewerId: string;
  hostId?: string;
  allowCreate?: boolean;
  title: string;
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

function requestGoogleCalendarToken(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_OAUTH_ID;
  if (!clientId) {
    return Promise.reject(
      new Error("Google Calendar is not configured.")
    );
  }

  const google = (window as Window & { google?: GoogleOAuth }).google;
  if (!google?.accounts?.oauth2) {
    return Promise.reject(
      new Error("Google Calendar sign-in did not load. Please try again.")
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
          reject(new Error("Google Calendar access was not granted."));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: () => {
        reject(new Error("Google Calendar sign-in was closed."));
      }
    });
    client.requestAccessToken();
  });
}

async function addToGoogleCalendar(
  event: SidequestEvent,
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
    throw new Error("Could not add the event to Google Calendar.");
  }
}

function parseSidequestEvent(
  value: unknown
): SidequestEvent | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;

  if (
    typeof row.id !== "string" ||
    typeof row.host_id !== "string" ||
    typeof row.title !== "string" ||
    typeof row.description !== "string" ||
    typeof row.starts_at !== "string" ||
    typeof row.ends_at !== "string" ||
    typeof row.location !== "string" ||
    typeof row.hobby !== "string" ||
    typeof row.skill_level !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    host_id: row.host_id,
    title: row.title,
    description: row.description,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    location: row.location,
    hobby: row.hobby,
    skill_level: row.skill_level
  };
}

function displayHobby(
  hobbyId: string,
  categories: HobbyCategory[]
): string {
  return (
    categories.find(({ id }) => id === hobbyId)?.name ?? hobbyId
  );
}

function toLocalDateTimeInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000
  )
    .toISOString()
    .slice(0, 16);
}

export default function SidequestEvents({
  viewerId,
  hostId,
  allowCreate = false,
  title
}: SidequestEventsProps) {
  const { categories, status: categoriesStatus } =
    useHobbyCategories();
  const [events, setEvents] = useState<SidequestEvent[]>([]);
  const [hostNames, setHostNames] = useState<Record<string, string>>({});
  const [rsvpIds, setRsvpIds] = useState<Set<string>>(
    new Set()
  );
  const [status, setStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [hobbyFilter, setHobbyFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(
    null
  );
  const [openMenuId, setOpenMenuId] = useState<string | null>(
    null
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [rsvpInProgress, setRsvpInProgress] = useState<
    string | null
  >(null);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search),
      250
    );
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let active = true;

    async function loadEvents() {
      if (categoriesStatus === "error") {
        setStatus("error");
        return;
      }
      if (categoriesStatus !== "ready") return;
      setStatus("loading");
      try {
        const createQuery = () => {
          let query = supabase
            .from("sidequests")
            .select(
              "id,host_id,title,description,starts_at,ends_at,location,hobby,skill_level"
            )
            .gt("starts_at", new Date().toISOString())
            .order("starts_at", { ascending: true })
            .limit(100);

          if (hostId) query = query.eq("host_id", hostId);
          if (hobbyFilter)
            query = query.eq("hobby", hobbyFilter);
          if (skillFilter) {
            query = query.eq("skill_level", skillFilter);
          }
          return query;
        };

        const searchTerm = debouncedSearch
          .trim()
          .replace(/[\\%_]/g, (character) => `\\${character}`);
        const results = searchTerm
          ? await Promise.all([
              createQuery().ilike("title", `%${searchTerm}%`),
              createQuery().ilike(
                "description",
                `%${searchTerm}%`
              )
            ])
          : [await createQuery()];

        for (const result of results) {
          if (result.error)
            throw new Error(result.error.message);
        }

        const resultsById = new Map<string, unknown>();
        for (const result of results) {
          for (const event of result.data ?? []) {
            resultsById.set(event.id, event);
          }
        }
        const parsedEvents = Array.from(
          resultsById.values()
        ).map(parseSidequestEvent);
        if (parsedEvents.some((event) => event === null)) {
          throw new Error(
            "A sidequest event record is malformed."
          );
        }
        const loadedEvents = parsedEvents
          .filter(
            (event): event is SidequestEvent => event !== null
          )
          .sort(
            (left, right) =>
              new Date(left.starts_at).getTime() -
              new Date(right.starts_at).getTime()
          );

        let loadedRsvpIds = new Set<string>();
        if (hostId !== viewerId && loadedEvents.length > 0) {
          const { data: rsvps, error: rsvpError } =
            await supabase
              .from("sidequest_rsvps")
              .select("sidequest_id")
              .eq("attendee_id", viewerId)
              .in(
                "sidequest_id",
                loadedEvents.map((event) => event.id)
              );
          if (rsvpError) throw new Error(rsvpError.message);
          loadedRsvpIds = new Set(
            (rsvps ?? []).map((rsvp) => rsvp.sidequest_id)
          );
        }

        const hostIds = [...new Set(loadedEvents.map((event) => event.host_id))];
        let loadedHostNames: Record<string, string> = {};
        if (hostIds.length > 0) {
          const profiles = await supabase
            .from("creator_profiles")
            .select("user_id,username")
            .in("user_id", hostIds);
          if (!profiles.error) {
            loadedHostNames = Object.fromEntries(
              (profiles.data ?? [])
                .filter((profile) => typeof profile.username === "string")
                .map((profile) => [profile.user_id, profile.username as string])
            );
          }
        }

        if (!active) return;
        setEvents(loadedEvents);
        setHostNames(loadedHostNames);
        setRsvpIds(loadedRsvpIds);
        setStatus("ready");
      } catch {
        if (active) setStatus("error");
      }
    }

    void loadEvents();
    return () => {
      active = false;
    };
  }, [
    categoriesStatus,
    debouncedSearch,
    hobbyFilter,
    hostId,
    reloadKey,
    skillFilter,
    viewerId
  ]);

  async function createSidequest(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const startsAtValue = formData.get("starts_at");
    const endsAtValue = formData.get("ends_at");
    if (
      typeof startsAtValue !== "string" ||
      typeof endsAtValue !== "string"
    ) {
      setNotice("Enter a start and end time.");
      return;
    }

    const startsAt = new Date(startsAtValue);
    const endsAt = new Date(endsAtValue);
    if (
      Number.isNaN(startsAt.getTime()) ||
      startsAt <= new Date()
    ) {
      setNotice("Choose a future start time.");
      return;
    }
    if (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      setNotice("The end time must be after the start time.");
      return;
    }

    const hobby = formData.get("hobby");
    const skillLevel = formData.get("skill_level");
    if (
      typeof hobby !== "string" ||
      !categories.some((option) => option.id === hobby) ||
      typeof skillLevel !== "string" ||
      !SKILL_LEVELS.some((option) => option === skillLevel)
    ) {
      setNotice("Choose a valid community and skill level.");
      return;
    }

    setIsSaving(true);
    setNotice("");
    try {
      const { error } = await supabase
        .from("sidequests")
        .insert({
          host_id: viewerId,
          title: String(formData.get("title") ?? "").trim(),
          description: String(
            formData.get("description") ?? ""
          ).trim(),
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          location: String(
            formData.get("location") ?? ""
          ).trim(),
          hobby,
          skill_level: skillLevel
        });
      if (error) throw new Error(error.message);

      form.reset();
      setShowCreateForm(false);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to create the sidequest. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleRsvp(sidequestId: string) {
    if (rsvpInProgress) return;
    const cancelling = rsvpIds.has(sidequestId);
    const sidequest = events.find((event) => event.id === sidequestId);
    // Start Google's popup directly from the click, before the database request.
    const calendarToken = cancelling
      ? null
      : requestGoogleCalendarToken().then(
          (token) => ({ token }),
          (error: unknown) => ({ error })
        );
    setRsvpInProgress(sidequestId);
    setNotice("");

    try {
      if (cancelling) {
        const { error } = await supabase
          .from("sidequest_rsvps")
          .delete()
          .eq("sidequest_id", sidequestId)
          .eq("attendee_id", viewerId);
        if (error) throw new Error(error.message);
        setRsvpIds((current) => {
          const next = new Set(current);
          next.delete(sidequestId);
          return next;
        });
      } else {
        const { error } = await supabase
          .from("sidequest_rsvps")
          .insert({
            sidequest_id: sidequestId,
            attendee_id: viewerId
          });
        if (error) throw new Error(error.message);
        setRsvpIds((current) =>
          new Set(current).add(sidequestId)
        );
        if (calendarToken && sidequest) {
          const result = await calendarToken;
          if ("error" in result) {
            setNotice(
              `RSVP saved, but ${result.error instanceof Error ? result.error.message : "Google Calendar was unavailable."}`
            );
          } else {
            try {
              await addToGoogleCalendar(sidequest, result.token);
              setNotice("RSVP saved and added to Google Calendar.");
            } catch (calendarError) {
              setNotice(
                `RSVP saved, but ${calendarError instanceof Error ? calendarError.message : "Google Calendar was unavailable."}`
              );
            }
          }
        }
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to update your RSVP. Please try again."
      );
    } finally {
      setRsvpInProgress(null);
    }
  }

  function startEditing(sidequestId: string) {
    setOpenMenuId(null);
    setEditingId(sidequestId);
    setNotice("");
  }

  function cancelEditing() {
    setEditingId(null);
    setNotice("");
  }

  async function updateSidequest(
    event: FormEvent<HTMLFormElement>,
    sidequestId: string
  ) {
    event.preventDefault();
    if (isUpdating) return;

    const formData = new FormData(event.currentTarget);
    const startsAtValue = formData.get("starts_at");
    const endsAtValue = formData.get("ends_at");
    const startsAt =
      typeof startsAtValue === "string"
        ? new Date(startsAtValue)
        : new Date(Number.NaN);
    const endsAt =
      typeof endsAtValue === "string"
        ? new Date(endsAtValue)
        : new Date(Number.NaN);
    if (
      Number.isNaN(startsAt.getTime()) ||
      startsAt <= new Date()
    ) {
      setNotice("Choose a future start time.");
      return;
    }
    if (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      setNotice("The end time must be after the start time.");
      return;
    }

    const hobby = formData.get("hobby");
    const skillLevel = formData.get("skill_level");
    const title = String(formData.get("title") ?? "").trim();
    const location = String(
      formData.get("location") ?? ""
    ).trim();
    if (
      !title ||
      typeof hobby !== "string" ||
      !categories.some((option) => option.id === hobby) ||
      typeof skillLevel !== "string" ||
      !SKILL_LEVELS.some((option) => option === skillLevel)
    ) {
      setNotice(
        "Enter a title and choose a valid hobby and skill level."
      );
      return;
    }
    if (!location) {
      setNotice("Enter a location or meeting link.");
      return;
    }

    setIsUpdating(true);
    setNotice("");
    try {
      const { data, error } = await supabase
        .from("sidequests")
        .update({
          title,
          description: String(
            formData.get("description") ?? ""
          ).trim(),
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          location,
          hobby,
          skill_level: skillLevel
        })
        .eq("id", sidequestId)
        .eq("host_id", viewerId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        throw new Error(
          "This sidequest could not be updated. It may no longer be available."
        );
      }

      setEditingId(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to update the sidequest. Please try again."
      );
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <section
      className="sidequest-events"
      aria-labelledby="sidequest-events-title">
      {allowCreate ? (
        <div className="sidequest-events-heading">
          <h2 id="sidequest-events-title">{title}</h2>
          <button
            className="sidequest-create-button"
            type="button"
            onClick={() => {
              setShowCreateForm((current) => !current);
              setNotice("");
            }}>
            {showCreateForm ? "Cancel" : "Create a sidequest"}
          </button>
        </div>
      ) : null}

      {showCreateForm && allowCreate ? (
        <form
          className="sidequest-create-form"
          onSubmit={(event) => void createSidequest(event)}>
          <label>
            <span>Title</span>
            <input name="title" maxLength={200} required />
          </label>
          <label>
            <span>Description</span>
            <textarea name="description" rows={3} />
          </label>
          <label>
            <span>Hobby community</span>
            <select name="hobby" defaultValue="" required>
              <option value="" disabled>
                Choose a hobby
              </option>
              {categories.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Recommended skill level</span>
            <select name="skill_level" defaultValue="" required>
              <option value="" disabled>
                Choose a skill level
              </option>
              {SKILL_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Start date and time</span>
            <input
              name="starts_at"
              type="datetime-local"
              required
            />
          </label>
          <label>
            <span>End date and time</span>
            <input
              name="ends_at"
              type="datetime-local"
              required
            />
          </label>
          <label>
            <span>Location or meeting link</span>
            <input name="location" maxLength={300} required />
          </label>
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Creating…" : "Create sidequest"}
          </button>
        </form>
      ) : null}

      {!allowCreate ? (
        <h2 id="sidequest-events-title">{title}</h2>
      ) : null}

      <div
        className="sidequest-event-filters"
        aria-label="Filter upcoming sidequests">
        <label>
          <span>Search sidequests</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title or description"
          />
        </label>
        <label>
          <span>Hobby community</span>
          <select
            value={hobbyFilter}
            onChange={(event) =>
              setHobbyFilter(event.target.value)
            }>
            <option value="">All communities</option>
            {categories.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Skill level</span>
          <select
            value={skillFilter}
            onChange={(event) =>
              setSkillFilter(event.target.value)
            }>
            <option value="">All skill levels</option>
            {SKILL_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        {search || hobbyFilter || skillFilter ? (
          <button
            className="sidequest-clear-filters"
            type="button"
            onClick={() => {
              setSearch("");
              setHobbyFilter("");
              setSkillFilter("");
            }}>
            Clear filters
          </button>
        ) : null}
      </div>
      {notice ? <p role="alert">{notice}</p> : null}
      {status === "loading" ? (
        <p role="status">Loading sidequests…</p>
      ) : status === "error" ? (
        <div role="alert">
          <p>
            Could not load sidequests. Check that the sidequest
            database migration has been applied.
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}>
            Try again
          </button>
        </div>
      ) : events.length === 0 ? (
        <p>
          {search || hobbyFilter || skillFilter
            ? "No upcoming sidequests match these filters."
            : hostId === viewerId
              ? "You have no upcoming sidequests yet."
              : hostId
                ? "This creator has no upcoming sidequests yet."
              : "No upcoming sidequests yet."}
        </p>
      ) : (
        <div className="sidequest-event-list">
          {events.map((event) => (
            <article
              className="sidequest-event-card"
              key={event.id}>
              {event.host_id === viewerId && (
                <div className="sidequest-event-actions">
                  <button
                    className="sidequest-event-menu-trigger"
                    type="button"
                    aria-label={`Actions for ${event.title}`}
                    aria-expanded={openMenuId === event.id}
                    aria-controls={`sidequest-menu-${event.id}`}
                    disabled={isUpdating}
                    onClick={() =>
                      setOpenMenuId((current) =>
                        current === event.id ? null : event.id
                      )
                    }>
                    <span aria-hidden="true">⋯</span>
                  </button>
                  {openMenuId === event.id && (
                    <div
                      className="sidequest-event-menu"
                      id={`sidequest-menu-${event.id}`}>
                      <button
                        type="button"
                        onClick={() => startEditing(event.id)}>
                        Edit sidequest
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div>
                <p className="sidequest-event-meta">
                  {displayHobby(event.hobby, categories)} ·{" "}
                  {event.skill_level}
                </p>
                <h3>{event.title}</h3>
                {hostId === viewerId ? (
                  <p>Hosted by you</p>
                ) : (
                  <Link
                    className="sidequest-event-host-link"
                    to={`/profile/${event.host_id}`}>
                    {hostNames[event.host_id]
                      ? `Hosted by @${hostNames[event.host_id]}`
                      : "View host profile"}
                  </Link>
                )}
                {event.description ? (
                  <p>{event.description}</p>
                ) : null}
                <p>
                  {new Date(event.starts_at).toLocaleString()} –{" "}
                  {new Date(event.ends_at).toLocaleString()}
                </p>
                <p>{event.location}</p>
              </div>
              {editingId === event.id && (
                <form
                  className="sidequest-create-form sidequest-edit-form"
                  onSubmit={(formEvent) =>
                    void updateSidequest(formEvent, event.id)
                  }>
                  <label>
                    <span>Title</span>
                    <input
                      name="title"
                      maxLength={200}
                      defaultValue={event.title}
                      required
                    />
                  </label>
                  <label>
                    <span>Description</span>
                    <textarea
                      name="description"
                      rows={3}
                      defaultValue={event.description}
                    />
                  </label>
                  <label>
                    <span>Hobby community</span>
                    <select
                      name="hobby"
                      defaultValue={event.hobby}
                      required>
                      {categories.map(({ id, name }) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Recommended skill level</span>
                    <select
                      name="skill_level"
                      defaultValue={event.skill_level}
                      required>
                      {SKILL_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Start date and time</span>
                    <input
                      name="starts_at"
                      type="datetime-local"
                      defaultValue={toLocalDateTimeInput(
                        event.starts_at
                      )}
                      required
                    />
                  </label>
                  <label>
                    <span>End date and time</span>
                    <input
                      name="ends_at"
                      type="datetime-local"
                      defaultValue={toLocalDateTimeInput(
                        event.ends_at
                      )}
                      required
                    />
                  </label>
                  <label>
                    <span>Location or meeting link</span>
                    <input
                      name="location"
                      maxLength={300}
                      defaultValue={event.location}
                      required
                    />
                  </label>
                  <div className="sidequest-edit-actions">
                    <button type="submit" disabled={isUpdating}>
                      {isUpdating ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={cancelEditing}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {hostId !== viewerId ? (
                <button
                  type="button"
                  disabled={rsvpInProgress !== null}
                  onClick={() => void toggleRsvp(event.id)}>
                  {rsvpInProgress === event.id
                    ? "Saving…"
                    : rsvpIds.has(event.id)
                      ? "Cancel RSVP"
                      : "RSVP"}
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

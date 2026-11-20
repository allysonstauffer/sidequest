import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  addToGoogleCalendar,
  requestGoogleCalendarToken
} from "../lib/googleCalendar";
import Comments from "./Comments";
import { useAuth } from "../auth/useAuth";
import ManageEditors from "./ManageEditors";
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
  creationOnly?: boolean;
  title: string;
};

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
  creationOnly = false,
  title
}: SidequestEventsProps) {
  const { categories, status: categoriesStatus } =
    useHobbyCategories();
  const [events, setEvents] = useState<SidequestEvent[]>([]);
  const [hostNames, setHostNames] = useState<Record<string, string>>({});
  const [cohostsByEvent, setCohostsByEvent] = useState<Record<string, string[]>>({});
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
  const [showCreateForm, setShowCreateForm] = useState(creationOnly);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(
    null
  );
  const [managingCohostsId, setManagingCohostsId] = useState<string | null>(null);
  const [cohostSearch, setCohostSearch] = useState("");
  const [cohostCandidates, setCohostCandidates] = useState<
    { user_id: string; username: string }[]
  >([]);
  const [cohostSearchStatus, setCohostSearchStatus] = useState<
    "idle" | "loading" | "ready"
  >("idle");
  const [cohostSaving, setCohostSaving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(
    null
  );
  const [editableIds, setEditableIds] = useState<string[]>([]);
  const [managingId, setManagingId] = useState<string | null>(null);
  const { session } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [rsvpInProgress, setRsvpInProgress] = useState<
    string | null
  >(null);

  const [calendarInProgress, setCalendarInProgress] = useState<
    string | null
  >(null);
  const [calendarAddedIds, setCalendarAddedIds] = useState<
    Set<string>
  >(new Set());

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
      if (creationOnly) {
        setEvents([]);
        setStatus("ready");
        return;
      }
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

        const cohostsByEvent: Record<string, string[]> = {};
        if (loadedEvents.length > 0) {
          const { data: cohosts, error: cohostError } = await supabase
            .from("sidequest_cohosts")
            .select("sidequest_id,user_id")
            .in("sidequest_id", loadedEvents.map((event) => event.id));
          if (cohostError) throw new Error(cohostError.message);
          for (const cohost of cohosts ?? []) {
            (cohostsByEvent[cohost.sidequest_id] ??= []).push(cohost.user_id);
          }
        }

        const hostIds = [...new Set([
          ...loadedEvents.map((event) => event.host_id),
          ...Object.values(cohostsByEvent).flat()
        ])];
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

        let editable: string[] = [];
        const foreignIds = loadedEvents
          .filter((event) => event.host_id !== viewerId)
          .map((event) => event.id);
        if (foreignIds.length > 0) {
          const grants = await supabase
            .from("edit_access_grants")
            .select("sidequest_id")
            .eq("collaborator_id", viewerId)
            .in("sidequest_id", foreignIds);
          if (!grants.error) {
            editable = (grants.data ?? [])
              .map((grant) => grant.sidequest_id)
              .filter((id): id is string => typeof id === "string");
          }
        }

        if (!active) return;
        setEditableIds(editable);
        setEvents(loadedEvents);
        setCohostsByEvent(cohostsByEvent);
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
    creationOnly,
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
      setNotice("Sidequest created.");
      if (!creationOnly) {
        setShowCreateForm(false);
        setReloadKey((value) => value + 1);
      }
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
    if (rsvpInProgress || calendarInProgress) return;

    const cancelling = rsvpIds.has(sidequestId);
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

        setNotice("RSVP cancelled.");
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

        setNotice("RSVP saved.");
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

  async function handleAddToCalendar(event: SidequestEvent) {
    if (
      calendarInProgress ||
      rsvpInProgress ||
      !rsvpIds.has(event.id) ||
      calendarAddedIds.has(event.id)
    )
      return;
    setCalendarInProgress(event.id);
    setNotice("");
    try {
      // Request the popup from this explicit click, before awaiting any network work.
      const token = await requestGoogleCalendarToken();
      await addToGoogleCalendar(event, token);
      setCalendarAddedIds((current) =>
        new Set(current).add(event.id)
      );
      setNotice("Added to Google Calendar.");
    } catch (error) {
      setNotice(
        `Your RSVP is still saved. ${error instanceof Error ? error.message : "Google Calendar was unavailable."} Please try Add to calendar again.`
      );
    } finally {
      setCalendarInProgress(null);
    }
  }

  function startEditing(sidequestId: string) {
    setOpenMenuId(null);
    setManagingCohostsId(null);
    setEditingId(sidequestId);
    setNotice("");
  }

  function startManagingCohosts(sidequestId: string) {
    setOpenMenuId(null);
    setEditingId(null);
    setManagingCohostsId(sidequestId);
    setCohostSearch("");
    setCohostCandidates([]);
    setCohostSearchStatus("idle");
    setNotice("");
  }

  async function searchCohosts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = cohostSearch.trim().replace(/[\\%_]/g, (character) => `\\${character}`);
    if (!term) return;
    setCohostSearchStatus("loading");
    setCohostCandidates([]);
    const { data, error } = await supabase
      .from("creator_profiles")
      .select("user_id,username")
      .ilike("username", `%${term}%`)
      .order("username", { ascending: true })
      .limit(20);
    if (error) {
      setNotice(error.message);
      setCohostSearchStatus("idle");
      return;
    }
    setCohostCandidates((data ?? []).filter(
      (profile): profile is { user_id: string; username: string } =>
        typeof profile.user_id === "string" && typeof profile.username === "string"
    ));
    setCohostSearchStatus("ready");
  }

  async function addCohost(sidequestId: string, userId: string) {
    if (cohostSaving) return;
    setCohostSaving(true);
    setNotice("");
    try {
      const { error } = await supabase.from("sidequest_cohosts").insert({
        sidequest_id: sidequestId,
        user_id: userId
      });
      if (error) throw new Error(error.message);
      setNotice("Co-host added.");
      setReloadKey((value) => value + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not add co-host.");
    } finally {
      setCohostSaving(false);
    }
  }

  async function removeCohost(sidequestId: string, userId: string) {
    if (cohostSaving) return;
    setCohostSaving(true);
    setNotice("");
    try {
      const { data, error } = await supabase
        .from("sidequest_cohosts")
        .delete()
        .eq("sidequest_id", sidequestId)
        .eq("user_id", userId)
        .select("user_id");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("Only the primary host can remove a co-host.");
      setNotice("Co-host removed.");
      setReloadKey((value) => value + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not remove co-host.");
    } finally {
      setCohostSaving(false);
    }
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
        .rpc("update_sidequest_details", {
          p_sidequest_id: sidequestId,
          p_changes: {
            title,
            description: String(
              formData.get("description") ?? ""
            ).trim(),
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            location,
            hobby,
            skill_level: skillLevel
          }
        });
      if (error) {
        throw new Error(
          error.code === "42501"
            ? "You don't have permission to edit this sidequest."
            : error.message
        );
      }
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
          {!creationOnly ? (
            <button
              className="sidequest-create-button"
              type="button"
              onClick={() => {
                setShowCreateForm((current) => !current);
                setNotice("");
              }}>
              {showCreateForm ? "Cancel" : "Create a sidequest"}
            </button>
          ) : null}
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

      {notice ? <p role="alert">{notice}</p> : null}

      {!creationOnly && !allowCreate ? (
        <h2 id="sidequest-events-title">{title}</h2>
      ) : null}

      {!creationOnly ? (
        <>
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
              {(event.host_id === viewerId ||
                editableIds.includes(event.id)) && (
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
                      <button
                        type="button"
                        onClick={() => startManagingCohosts(event.id)}>
                        Manage co-hosts
                      </button>
                      {event.host_id === viewerId && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            setManagingId(event.id);
                          }}>
                          Manage editors
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {managingId === event.id &&
                event.host_id === viewerId &&
                session?.access_token && (
                  <>
                    <ManageEditors
                      target="sidequest"
                      targetId={event.id}
                      accessToken={session.access_token}
                    />
                    <button type="button" onClick={() => setManagingId(null)}>
                      Close
                    </button>
                  </>
                )}
              <div>
                <p className="sidequest-event-meta">
                  {displayHobby(event.hobby, categories)} ·{" "}
                  {event.skill_level}
                </p>
                <h3>{event.title}</h3>
                <div className="sidequest-event-hosts">
                  <span>Hosted by </span>
                  {event.host_id === viewerId ? (
                    <span>you (primary host)</span>
                  ) : (
                    <Link to={`/profile/${event.host_id}`}>
                      {hostNames[event.host_id]
                        ? `@${hostNames[event.host_id]} (primary host)`
                        : "Primary host"}
                    </Link>
                  )}
                  {(cohostsByEvent[event.id] ?? []).map((cohostId) => (
                    <span key={cohostId}>
                      {", "}
                      {cohostId === viewerId ? (
                        "you"
                      ) : (
                        <Link to={`/profile/${cohostId}`}>
                          {hostNames[cohostId]
                            ? `@${hostNames[cohostId]}`
                            : "Co-host"}
                        </Link>
                      )}
                    </span>
                  ))}
                </div>
                {event.description ? (
                  <p>{event.description}</p>
                ) : null}
                <p>
                  {new Date(event.starts_at).toLocaleString()} –{" "}
                  {new Date(event.ends_at).toLocaleString()}
                </p>
                <p>{event.location}</p>
              </div>
              {managingCohostsId === event.id && (
                <section className="sidequest-cohost-manager" aria-label={`Co-hosts for ${event.title}`}>
                  <h4>Manage co-hosts</h4>
                  {(cohostsByEvent[event.id] ?? []).length === 0 ? (
                    <p>No co-hosts yet.</p>
                  ) : (
                    <ul>
                      {(cohostsByEvent[event.id] ?? []).map((cohostId) => (
                        <li key={cohostId}>
                          <Link to={`/profile/${cohostId}`}>
                            {hostNames[cohostId] ? `@${hostNames[cohostId]}` : "Co-host"}
                          </Link>
                          <button type="button" disabled={cohostSaving}
                            onClick={() => void removeCohost(event.id, cohostId)}>
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form onSubmit={(formEvent) => void searchCohosts(formEvent)}>
                    <label>
                      <span>Find a user by username</span>
                      <input type="search" value={cohostSearch}
                        onChange={(changeEvent) => setCohostSearch(changeEvent.target.value)}
                        maxLength={80} required />
                    </label>
                    <button type="submit" disabled={cohostSearchStatus === "loading"}>
                      {cohostSearchStatus === "loading" ? "Searching…" : "Search"}
                    </button>
                  </form>
                  {cohostSearchStatus === "ready" && (
                    cohostCandidates.filter((candidate) => candidate.user_id !== event.host_id &&
                      !(cohostsByEvent[event.id] ?? []).includes(candidate.user_id)).length === 0
                      ? <p>No available users found.</p> : (
                      <ul aria-label="User search results">
                        {cohostCandidates
                          .filter((candidate) => candidate.user_id !== event.host_id &&
                            !(cohostsByEvent[event.id] ?? []).includes(candidate.user_id))
                          .map((candidate) => (
                            <li key={candidate.user_id}>
                              <span>@{candidate.username}</span>
                              <button type="button" disabled={cohostSaving}
                                onClick={() => void addCohost(event.id, candidate.user_id)}>
                                Add
                              </button>
                            </li>
                          ))}
                      </ul>
                    )
                  )}
                  <button type="button" onClick={() => setManagingCohostsId(null)}>
                    Done
                  </button>
                </section>
              )}
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
                <div className="sidequest-rsvp-actions">
                  <button
                    type="button"
                    disabled={
                      rsvpInProgress !== null ||
                      calendarInProgress !== null
                    }
                    onClick={() =>
                      void toggleRsvp(event.id)
                    }>
                    {rsvpInProgress === event.id
                      ? "Saving…"
                      : rsvpIds.has(event.id)
                        ? "Cancel RSVP"
                        : "RSVP"}
                  </button>

                  {rsvpIds.has(event.id) ? (
                    <button
                      type="button"
                      disabled={
                        calendarInProgress !== null ||
                        rsvpInProgress !== null ||
                        calendarAddedIds.has(event.id)
                      }
                      onClick={() =>
                        void handleAddToCalendar(event)
                      }>
                      {calendarInProgress === event.id
                        ? "Adding…"
                        : calendarAddedIds.has(event.id)
                          ? "Added to calendar"
                          : "Add to calendar"}
                    </button>
                  ) : null}
                </div>
              ) : null}
              <Comments kind="sidequest" itemId={event.id} viewerId={viewerId} />
            </article>
          ))}
        </div>
      )}
        </>
      ) : null}
    </section>
  );
}

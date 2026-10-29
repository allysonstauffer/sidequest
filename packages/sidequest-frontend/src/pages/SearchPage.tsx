import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { supabase } from "../lib/supabase";
import "./SearchPage.css";

type UserResult = {
  user_id: string;
  username: string;
  bio: string;
  avatar_url: string | null;
};

function parseUser(value: unknown): UserResult | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.user_id !== "string" ||
    typeof row.username !== "string" ||
    typeof row.bio !== "string" ||
    (row.avatar_url !== null && typeof row.avatar_url !== "string")
  ) return null;
  return {
    user_id: row.user_id,
    username: row.username,
    bio: row.bio,
    avatar_url: row.avatar_url
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function SearchPage() {
  const [query, setQuery] = useState("");
  const [searchedFor, setSearchedFor] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const requestId = useRef(0);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    const currentRequest = ++requestId.current;
    setSearchedFor(term);
    if (!term) {
      setResults([]);
      setStatus("idle");
      return;
    }

    setStatus("loading");
    const { data, error } = await supabase
      .from("creator_profiles")
      .select("user_id,username,bio,avatar_url")
      .ilike("username", `%${escapeLike(term)}%`)
      .order("username", { ascending: true })
      .limit(30);
    if (currentRequest !== requestId.current) return;
    if (error) {
      setResults([]);
      setStatus("error");
      return;
    }
    setResults(
      (data ?? [])
        .map(parseUser)
        .filter((user): user is UserResult => user !== null)
    );
    setStatus("ready");
  }

  return (
    <DashboardLayout>
      <div className="page-shell user-search-page">
        <div className="page-header">
          <div>
            <p className="eyebrow">People</p>
            <h1>Find creators</h1>
          </div>
        </div>
        <form className="form-card" onSubmit={(event) => void handleSearch(event)} role="search">
          <label className="field-group">
            <span>Search by username</span>
            <input
              name="query"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Enter a username"
              maxLength={80}
              autoComplete="off"
            />
          </label>
          <div className="submit-row">
            <button type="submit" className="primary-button" disabled={status === "loading"}>
              {status === "loading" ? "Searching…" : "Search users"}
            </button>
          </div>
        </form>

        {status === "idle" && <p className="user-search-message">Enter a username to find a creator.</p>}
        {status === "loading" && <p className="user-search-message" role="status">Searching users…</p>}
        {status === "error" && <p className="user-search-message" role="alert">Could not search users. Please try again.</p>}
        {status === "ready" && (
          <section aria-label="User search results">
            <h2 className="user-search-heading">Results for “{searchedFor}”</h2>
            {results.length === 0 ? (
              <p className="user-search-message">No users found.</p>
            ) : (
              <ul className="user-search-results">
                {results.map((user) => (
                  <li key={user.user_id}>
                    <Link to={`/profile/${user.user_id}`} className="user-search-card">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" loading="lazy" />
                      ) : (
                        <span className="user-search-avatar" aria-hidden="true">
                          {user.username.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="user-search-copy">
                        <strong>@{user.username}</strong>
                        <span>{user.bio || "View creator profile"}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}

export default SearchPage;

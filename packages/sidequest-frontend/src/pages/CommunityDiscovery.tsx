import {
  type MouseEventHandler,
  useEffect,
  useState
} from "react";
import { Search, UsersRound, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { supabase } from "../lib/supabase";
import { useHobbyCategories } from "../hobbies/useHobbyCategories";
import type {
  DiscoveryContentItem,
  HobbyCommunity
} from "../types/discovery";
import { searchCommunitiesByTag } from "../utils/discovery";
import "../components/CommunityDiscovery.css";

type ContentStatus = "loading" | "ready" | "error";
type CommunityStatus = "loading" | "ready" | "error";

type CommunityRecord = {
  id: string;
  name: string;
  description: string;
  hobby: string | null;
};

function mapCommunity(value: unknown): CommunityRecord {
  if (!value || typeof value !== "object") {
    throw new Error("A community record is malformed.");
  }

  const community = value as Record<string, unknown>;
  if (
    typeof community.id !== "string" ||
    typeof community.name !== "string" ||
    (community.description !== null &&
      typeof community.description !== "string") ||
    (community.hobby !== null &&
      typeof community.hobby !== "string")
  ) {
    throw new Error("A community record is malformed.");
  }

  return {
    id: community.id,
    name: community.name,
    description: community.description ?? "",
    hobby: community.hobby
  };
}

function mapProjectContent(
  value: unknown
): DiscoveryContentItem {
  if (!value || typeof value !== "object") {
    throw new Error("A project record is malformed.");
  }

  const project = value as Record<string, unknown>;
  const mediaUrls = project.media_urls;
  if (
    typeof project.id !== "string" ||
    typeof project.title !== "string" ||
    (project.description !== null &&
      typeof project.description !== "string") ||
    (mediaUrls !== null &&
      (!Array.isArray(mediaUrls) ||
        !mediaUrls.every((url) => typeof url === "string")))
  ) {
    throw new Error("A project record is malformed.");
  }

  return {
    id: project.id,
    title: project.title,
    description: project.description ?? "",
    kind: "Project",
    imageUrl: Array.isArray(mediaUrls)
      ? mediaUrls[0]
      : undefined
  };
}

function CommunityCard({
  community,
  onSelectTag,
  signedIn,
  isMember,
  membershipPending,
  onToggleMembership
}: {
  community: HobbyCommunity;
  onSelectTag: MouseEventHandler<HTMLButtonElement>;
  signedIn: boolean;
  isMember: boolean;
  membershipPending: boolean;
  onToggleMembership: () => void;
}) {
  return (
    <article className="sample-community-card">
      {community.imageUrl ? (
        <img
          className="sample-community-image"
          src={community.imageUrl}
          alt={community.imageAlt ?? ""}
          loading="lazy"
        />
      ) : null}
      <div className="sample-community-body">
        <span className="sample-kind">Community</span>
        <h4>{community.name}</h4>
        <p>{community.description}</p>
        <ul
          className="interest-tags"
          aria-label="Community interests">
          {community.tags.map((tag) => (
            <li key={tag}>
              <button
                className="interest-tag"
                type="button"
                data-interest-tag={tag}
                onClick={onSelectTag}
                aria-label={`Search communities tagged ${tag}`}>
                {tag}
              </button>
            </li>
          ))}
        </ul>
        {signedIn ? (
          <button
            className="join-community-button"
            type="button"
            disabled={membershipPending}
            onClick={onToggleMembership}>
            {membershipPending
              ? "Updating…"
              : isMember
                ? "Leave community"
                : "Join community"}
          </button>
        ) : (
          <Link className="join-community-button" to="/login">
            Sign in to join
          </Link>
        )}
      </div>
    </article>
  );
}

function DiscoveryContentCard({
  item
}: {
  item: DiscoveryContentItem;
}) {
  return (
    <article className="sample-content-card">
      {item.imageUrl ? (
        <img
          className="sample-content-image"
          src={item.imageUrl}
          alt={item.imageAlt ?? ""}
          loading="lazy"
        />
      ) : null}
      <div className="sample-content-body">
        <div className="sample-content-meta">
          <span>{item.kind}</span>
          {item.hobby ? <span>{item.hobby}</span> : null}
        </div>
        <h4>{item.title}</h4>
        <p>{item.description}</p>
      </div>
    </article>
  );
}

export function CommunityDiscovery() {
  const { session } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [communities, setCommunities] = useState<
    CommunityRecord[]
  >([]);
  const [communityStatus, setCommunityStatus] =
    useState<CommunityStatus>("loading");
  const [reloadCommunities, setReloadCommunities] = useState(0);
  const [memberships, setMemberships] = useState<Set<string>>(
    new Set()
  );
  const [membershipStatus, setMembershipStatus] =
    useState<CommunityStatus>("loading");
  const [reloadMemberships, setReloadMemberships] = useState(0);
  const [membershipActionId, setMembershipActionId] = useState<
    string | null
  >(null);
  const [membershipNotice, setMembershipNotice] = useState("");
  const [content, setContent] = useState<
    DiscoveryContentItem[]
  >([]);
  const [contentStatus, setContentStatus] =
    useState<ContentStatus>("loading");
  const [reloadContent, setReloadContent] = useState(0);
  const {
    categories,
    status: categoryStatus,
    reload: reloadCategories
  } = useHobbyCategories();
  const categoryNames = new Map(
    categories.map(({ id, name }) => [id, name])
  );
  const searchableCommunities: HobbyCommunity[] =
    communities.map((community) => ({
      id: community.id,
      name: community.name,
      description: community.description,
      tags: community.hobby
        ? [
            categoryNames.get(community.hobby) ??
              community.hobby
          ]
        : []
    }));
  const matchingCommunities = searchCommunitiesByTag(
    searchableCommunities,
    searchTerm
  );
  const visibleContent = content;

  useEffect(() => {
    let active = true;
    const userId = session?.user.id;

    async function loadMemberships() {
      if (!userId) {
        setMemberships(new Set());
        setMembershipStatus("ready");
        return;
      }

      setMembershipStatus("loading");
      try {
        const { data, error } = await supabase
          .from("community_memberships")
          .select("community_id")
          .eq("user_id", userId);
        if (error) throw new Error(error.message);

        const communityIds = (data ?? []).map((row) => {
          if (typeof row.community_id !== "string") {
            throw new Error(
              "A community membership record is malformed."
            );
          }
          return row.community_id;
        });
        if (!active) return;
        setMemberships(new Set(communityIds));
        setMembershipStatus("ready");
      } catch {
        if (active) setMembershipStatus("error");
      }
    }

    void loadMemberships();
    return () => {
      active = false;
    };
  }, [session?.user.id, reloadMemberships]);

  useEffect(() => {
    let active = true;

    async function loadCommunities() {
      setCommunityStatus("loading");
      try {
        const { data, error } = await supabase
          .from("communities")
          .select("id,name,description,hobby")
          .order("created_at", { ascending: false });
        if (error) throw new Error(error.message);

        const records = (data ?? []).map(mapCommunity);
        if (!active) return;
        setCommunities(records);
        setCommunityStatus("ready");
      } catch {
        if (active) setCommunityStatus("error");
      }
    }

    void loadCommunities();
    return () => {
      active = false;
    };
  }, [reloadCommunities]);

  async function toggleMembership(communityId: string) {
    const userId = session?.user.id;
    if (
      !userId ||
      membershipActionId ||
      membershipStatus !== "ready"
    ) {
      return;
    }

    setMembershipActionId(communityId);
    setMembershipNotice("");
    try {
      const isMember = memberships.has(communityId);
      const result = isMember
        ? await supabase
            .from("community_memberships")
            .delete()
            .eq("user_id", userId)
            .eq("community_id", communityId)
        : await supabase.from("community_memberships").insert({
            user_id: userId,
            community_id: communityId
          });
      if (result.error) throw new Error(result.error.message);

      setMemberships((current) => {
        const next = new Set(current);
        if (isMember) next.delete(communityId);
        else next.add(communityId);
        return next;
      });
    } catch (error) {
      setMembershipNotice(
        error instanceof Error
          ? error.message
          : "Unable to update community membership."
      );
    } finally {
      setMembershipActionId(null);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadContent() {
      setContentStatus("loading");
      try {
        const query = supabase
          .from("projects")
          .select("id,title,description,media_urls,created_at");
        const { data, error } = await query
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) {
          throw new Error(error.message);
        }

        const projects = (data ?? []).map(mapProjectContent);
        if (active) {
          setContent(projects);
          setContentStatus("ready");
        }
      } catch {
        if (active) setContentStatus("error");
      }
    }

    void loadContent();
    return () => {
      active = false;
    };
  }, [reloadContent]);

  return (
    <div className="community-discovery">
      <p className="sample-data-notice">
        Communities and projects are loaded from SideQuest.
      </p>

      <section
        className="community-search-section"
        aria-labelledby="community-search-heading">
        <div className="discovery-section-heading">
          <div>
            <p className="discovery-kicker">Find your people</p>
            <h3 id="community-search-heading">
              Explore communities
            </h3>
          </div>
          <span
            className="discovery-result-count"
            aria-live="polite">
            {matchingCommunities.length}{" "}
            {matchingCommunities.length === 1
              ? "community"
              : "communities"}
          </span>
        </div>

        <label
          className="community-search-label"
          htmlFor="community-interest-search">
          Search by hobby or interest tag
        </label>
        <div className="community-search-control">
          <Search aria-hidden="true" />
          <input
            id="community-interest-search"
            type="search"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
            placeholder="Search a hobby category"
            autoComplete="off"
          />
          {searchTerm ? (
            <button
              className="clear-community-search"
              type="button"
              onClick={() => setSearchTerm("")}
              aria-label="Clear community search"
              title="Clear search">
              <X aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <p className="community-search-hint">
          Matching is case-insensitive and supports partial tag
          names.
        </p>

        {communityStatus === "loading" ||
        categoryStatus === "loading" ? (
          <p role="status">Loading communities…</p>
        ) : communityStatus === "error" ||
          categoryStatus === "error" ? (
          <div className="discovery-empty-state" role="alert">
            <h4>
              Communities or hobby categories could not be
              loaded.
            </h4>
            <p>Please check your connection and try again.</p>
            <button
              className="text-reset-button"
              type="button"
              onClick={() => {
                setReloadCommunities((current) => current + 1);
                reloadCategories();
              }}>
              Try again
            </button>
          </div>
        ) : matchingCommunities.length > 0 ? (
          <div
            className="sample-community-grid"
            aria-live="polite">
            {matchingCommunities.map((community) => (
              <CommunityCard
                key={community.id}
                community={community}
                signedIn={Boolean(session)}
                isMember={memberships.has(community.id)}
                membershipPending={
                  membershipStatus !== "ready" ||
                  membershipActionId !== null
                }
                onToggleMembership={() =>
                  void toggleMembership(community.id)
                }
                onSelectTag={(event) =>
                  setSearchTerm(
                    event.currentTarget.dataset.interestTag ??
                      ""
                  )
                }
              />
            ))}
          </div>
        ) : (
          <div className="discovery-empty-state" role="status">
            <UsersRound aria-hidden="true" />
            {searchableCommunities.length === 0 &&
            !searchTerm.trim() ? (
              <>
                <h4>No communities yet.</h4>
                <p>Created communities will appear here.</p>
              </>
            ) : (
              <>
                <h4>No communities found for this interest.</h4>
                <p>
                  Try another hobby category or clear your
                  search to see all communities.
                </p>
                <button
                  className="text-reset-button"
                  type="button"
                  onClick={() => setSearchTerm("")}>
                  Clear search
                </button>
              </>
            )}
          </div>
        )}
        {session && membershipStatus === "error" && (
          <div className="discovery-empty-state" role="alert">
            <p>
              Community membership could not be loaded. Try
              again before joining or leaving a community.
            </p>
            <button
              className="text-reset-button"
              type="button"
              onClick={() =>
                setReloadMemberships((current) => current + 1)
              }>
              Try again
            </button>
          </div>
        )}
        {membershipNotice && (
          <p role="alert">{membershipNotice}</p>
        )}
      </section>

      <section
        className="content-discovery-section"
        aria-labelledby="content-filter-heading">
        <div className="discovery-section-heading content-heading-row">
          <div>
            <p className="discovery-kicker">
              Explore at your pace
            </p>
            <h3 id="content-filter-heading">Latest projects</h3>
          </div>
        </div>

        <div className="content-filter-toolbar">
          <p>Completed projects shared by the community.</p>
        </div>

        {contentStatus === "loading" ? (
          <p role="status">Loading posts and projects…</p>
        ) : contentStatus === "error" ? (
          <div className="discovery-empty-state" role="alert">
            <h4>Posts and projects could not be loaded.</h4>
            <p>Please check your connection and try again.</p>
            <button
              className="text-reset-button"
              type="button"
              onClick={() =>
                setReloadContent((current) => current + 1)
              }>
              Try again
            </button>
          </div>
        ) : visibleContent.length > 0 ? (
          <div
            className="sample-content-grid"
            aria-live="polite">
            {visibleContent.map((item) => (
              <DiscoveryContentCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div
            className="discovery-empty-state content-empty-state"
            role="status">
            <h4>No projects yet.</h4>
            <p>
              Check back later to discover community projects.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

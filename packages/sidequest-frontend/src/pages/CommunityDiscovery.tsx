import {
  type MouseEventHandler,
  useEffect,
  useState
} from "react";
import { Search, UsersRound, X } from "lucide-react";
import { mockCommunities } from "../data/mockDiscoveryData";
import { supabase } from "../lib/supabase";
import type {
  DiscoveryContentItem,
  HobbyCommunity
} from "../types/discovery";
import { searchCommunitiesByTag } from "../utils/discovery";
import "../components/CommunityDiscovery.css";

type ContentStatus = "loading" | "ready" | "error";

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
  onSelectTag
}: {
  community: HobbyCommunity;
  onSelectTag: MouseEventHandler<HTMLButtonElement>;
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
        <span className="sample-kind">Sample community</span>
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
        <button
          className="join-community-button"
          type="button"
          disabled
          title="Community membership is not implemented yet">
          Join Community · Coming Soon
        </button>
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
  const [searchTerm, setSearchTerm] = useState("");
  const [content, setContent] = useState<
    DiscoveryContentItem[]
  >([]);
  const [contentStatus, setContentStatus] =
    useState<ContentStatus>("loading");
  const [reloadContent, setReloadContent] = useState(0);
  const matchingCommunities = searchCommunitiesByTag(
    mockCommunities,
    searchTerm
  );
  const visibleContent = content;

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
        Community examples are sample data. Projects below are
        loaded from SideQuest.
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
            {matchingCommunities.length} sample{" "}
            {matchingCommunities.length === 1
              ? "group"
              : "groups"}
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
            placeholder="Try photography, painting, or gardening"
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

        {matchingCommunities.length > 0 ? (
          <div
            className="sample-community-grid"
            aria-live="polite">
            {matchingCommunities.map((community) => (
              <CommunityCard
                key={community.id}
                community={community}
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
            <h4>No communities found for this interest.</h4>
            <p>
              Try another hobby tag or clear your search to see
              all sample groups.
            </p>
            <button
              className="text-reset-button"
              type="button"
              onClick={() => setSearchTerm("")}>
              Clear search
            </button>
          </div>
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

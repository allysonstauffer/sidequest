import { type MouseEventHandler, useState } from "react";
import { Search, UsersRound, X } from "lucide-react";
import {
  mockCommunities,
  mockDiscoveryContent
} from "./data/mockDiscoveryData";
import type {
  DiscoveryContentItem,
  HobbyCommunity
} from "./types/discovery";
import {
  filterBeginnerFriendlyContent,
  searchCommunitiesByTag
} from "./utils/discovery";
import "./CommunityDiscovery.css";

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
          <span>{item.hobby}</span>
        </div>
        <h4>{item.title}</h4>
        <p>{item.description}</p>
        {item.beginnerFriendly ? (
          <span className="beginner-tag">
            Beginner-Friendly
          </span>
        ) : null}
      </div>
    </article>
  );
}

export function CommunityDiscovery() {
  const [searchTerm, setSearchTerm] = useState("");
  const [beginnerFriendlyOnly, setBeginnerFriendlyOnly] =
    useState(false);
  const matchingCommunities = searchCommunitiesByTag(
    mockCommunities,
    searchTerm
  );
  const visibleContent = filterBeginnerFriendlyContent(
    mockDiscoveryContent,
    beginnerFriendlyOnly
  );

  return (
    <div className="community-discovery">
      <p className="sample-data-notice">
        Sample data preview · These communities and posts are
        examples, not live SideQuest content.
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
            <h3 id="content-filter-heading">
              Posts &amp; projects
            </h3>
          </div>
          <label className="beginner-filter-control">
            <input
              type="checkbox"
              checked={beginnerFriendlyOnly}
              onChange={(event) =>
                setBeginnerFriendlyOnly(event.target.checked)
              }
            />
            <span>Beginner-Friendly only</span>
          </label>
        </div>

        <div className="content-filter-toolbar">
          <p>
            {beginnerFriendlyOnly
              ? "Showing approachable sample content."
              : "Browse sample posts and projects across hobbies."}
          </p>
          {beginnerFriendlyOnly ? (
            <button
              className="text-reset-button"
              type="button"
              onClick={() => setBeginnerFriendlyOnly(false)}>
              Reset filter
            </button>
          ) : null}
        </div>

        {visibleContent.length > 0 ? (
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
            <h4>
              No beginner-friendly sample content is available.
            </h4>
            <p>
              Turn off the filter to see all sample posts and
              projects.
            </p>
            <button
              className="text-reset-button"
              type="button"
              onClick={() => setBeginnerFriendlyOnly(false)}>
              Show all content
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

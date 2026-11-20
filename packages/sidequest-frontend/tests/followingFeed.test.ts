import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadFollowingFeed } from "../src/lib/followingFeed.ts";
import { parseFeedProject } from "../src/lib/projectFeed.ts";

const viewer = "00000000-0000-4000-8000-000000000001";
const followed = "00000000-0000-4000-8000-000000000002";
const other = "00000000-0000-4000-8000-000000000003";
const joined = "00000000-0000-4000-8000-000000000004";
const notJoined = "00000000-0000-4000-8000-000000000005";

function post(
  id: string,
  author: string,
  community: string | null,
  created: string
) {
  return {
    id,
    author_id: author,
    community_id: community,
    community: community
      ? {
          id: community,
          name:
            community === joined
              ? "Paper makers"
              : "Garden club"
        }
      : null,
    title: `Project ${id}`,
    description: "A synthetic project",
    media_urls: [],
    created_at: created,
    looking_for_collaborators: true,
    beginner_friendly: true,
    skill_level: "Beginner"
  };
}

const posts = [
  post("creator", followed, null, "2026-11-15T10:10:00Z"),
  post("community", other, joined, "2026-11-15T03:30:00-07:00"),
  post("both", followed, joined, "2026-11-15T10:20:00Z"),
  post("unrelated", other, notJoined, "2026-11-15T10:50:00Z"),
  post(
    "unrelated-personal",
    other,
    null,
    "2026-11-15T10:55:00Z"
  ),
  post(
    "followed-in-other-community",
    followed,
    notJoined,
    "2026-11-15T10:40:00Z"
  )
];

function fixture({
  follows = [{ followed_id: followed }] as unknown[],
  memberships = [{ community_id: joined }] as unknown[],
  projectRows = posts,
  fail = ""
} = {}) {
  const requests: URL[] = [];
  const client = createClient(
    "https://example.supabase.co",
    "synthetic-publishable-key",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      global: {
        fetch: async (input, init) => {
          const url = new URL(String(input));
          requests.push(url);
          assert.equal(init?.method, "GET");
          const table = url.pathname.split("/").pop();
          const failure =
            table === fail ||
            (table === "projects" &&
              ((fail === "creator-posts" &&
                url.searchParams.has("author_id")) ||
                (fail === "community-posts" &&
                  url.searchParams.has("community_id"))));
          if (failure)
            return Response.json(
              { code: "42501", message: "Permission denied" },
              { status: 403 }
            );
          if (table === "user_follows") {
            assert.equal(
              url.searchParams.get("follower_id"),
              `eq.${viewer}`
            );
            return Response.json(follows);
          }
          if (table === "community_memberships") {
            assert.equal(
              url.searchParams.get("user_id"),
              `eq.${viewer}`
            );
            return Response.json(memberships);
          }
          assert.equal(table, "projects");
          assert.match(
            url.searchParams.get("select") ?? "",
            /community:communities!projects_community_id_fkey\(id,name\)/
          );
          assert.equal(
            url.searchParams.get("order"),
            "created_at.desc,id.desc"
          );
          const column = url.searchParams.has("author_id")
            ? "author_id"
            : "community_id";
          const filter = url.searchParams.get(column);
          assert.ok(
            filter,
            "Project queries must include a source filter"
          );
          assert.ok(
            filter.startsWith("in.("),
            "Project queries must be restricted to followed creators or joined communities"
          );
          const ids = filter
            .slice(4, -1)
            .split(",")
            .map((value) => value.replaceAll('"', ""));
          return Response.json(
            projectRows.filter(
              (row) =>
                ids.includes(row[column] ?? "") &&
                (!url.searchParams.has("beginner_friendly") ||
                  row.beginner_friendly) &&
                (!url.searchParams.has(
                  "looking_for_collaborators"
                ) ||
                  row.looking_for_collaborators) &&
                (!url.searchParams.has("skill_level") ||
                  `eq.${row.skill_level}` ===
                    url.searchParams.get("skill_level"))
            )
          );
        }
      }
    }
  );
  return { client, requests };
}

test("following feed combines both existing sources newest-first, identifies communities, and deduplicates overlap", async () => {
  const f = fixture();
  const items = await loadFollowingFeed(f.client, viewer);
  assert.deepEqual(
    items.map((item) => item.id),
    [
      "followed-in-other-community",
      "community",
      "both",
      "creator"
    ]
  );
  assert.equal(
    items.find((item) => item.id === "community")?.community
      ?.name,
    "Paper makers"
  );
  assert.equal(
    items.find((item) => item.id === "creator")?.community,
    null
  );
  assert.equal(
    items.filter((item) => item.id === "both").length,
    1
  );
});

test("joined communities populate the feed even when the user follows no creators", async () => {
  const f = fixture({ follows: [] });
  assert.deepEqual(
    (await loadFollowingFeed(f.client, viewer)).map(
      (item) => item.id
    ),
    ["community", "both"]
  );
  const queries = f.requests.filter((url) =>
    url.pathname.endsWith("/projects")
  );
  assert.equal(queries.length, 1);
  assert.ok(queries[0].searchParams.has("community_id"));
});

test("creator-only, no-source, and no-post feeds remain valid empty or populated states", async () => {
  const creator = fixture({ memberships: [] });
  assert.deepEqual(
    (await loadFollowingFeed(creator.client, viewer)).map(
      (item) => item.id
    ),
    ["followed-in-other-community", "both", "creator"]
  );
  const empty = fixture({ memberships: [], follows: [] });
  assert.deepEqual(
    await loadFollowingFeed(empty.client, viewer),
    []
  );
  assert.equal(
    empty.requests.some((url) =>
      url.pathname.endsWith("/projects")
    ),
    false
  );
  const noPosts = fixture({ projectRows: [] });
  assert.deepEqual(
    await loadFollowingFeed(noPosts.client, viewer),
    []
  );
});

test("existing beginner, collaboration, and experience filters apply to both sources", async () => {
  const f = fixture({
    projectRows: [
      ...posts,
      {
        ...posts[0],
        id: "experienced",
        skill_level: "Advanced"
      },
      {
        ...posts[1],
        id: "not-beginner",
        beginner_friendly: false
      },
      {
        ...posts[2],
        id: "not-collaborating",
        looking_for_collaborators: false
      }
    ]
  });
  const items = await loadFollowingFeed(f.client, viewer, {
    beginnerOnly: true,
    collaboratorsOnly: true,
    skillLevel: "Beginner"
  });
  assert.equal(items.length, 4);
  for (const url of f.requests.filter((url) =>
    url.pathname.endsWith("/projects")
  )) {
    assert.equal(
      url.searchParams.get("beginner_friendly"),
      "eq.true"
    );
    assert.equal(
      url.searchParams.get("looking_for_collaborators"),
      "eq.true"
    );
    assert.equal(
      url.searchParams.get("skill_level"),
      "eq.Beginner"
    );
  }
});

test("source and post query failures reject instead of displaying an empty or misleading partial feed", async () => {
  for (const fail of [
    "user_follows",
    "community_memberships",
    "creator-posts",
    "community-posts"
  ]) {
    const f = fixture({ fail });
    await assert.rejects(
      loadFollowingFeed(f.client, viewer),
      /Permission denied/
    );
  }
});

test("malformed membership, follow, or post data cannot broaden the following feed", async () => {
  for (const options of [
    { memberships: [{ community_id: 42 }] },
    { memberships: [null] },
    { follows: [{ followed_id: null }] },
    { projectRows: [{ ...posts[0], created_at: "invalid" }] },
    {
      projectRows: [
        {
          ...posts[1],
          community: { id: notJoined, name: "Wrong community" }
        }
      ]
    }
  ]) {
    const f = fixture(options);
    await assert.rejects(
      loadFollowingFeed(f.client, viewer),
      /malformed/
    );
  }
  const signedOut = fixture();
  await assert.rejects(
    loadFollowingFeed(signedOut.client, ""),
    /Sign in/
  );
  assert.equal(signedOut.requests.length, 0);
});

test("missing community metadata preserves readable followed posts and stable ordering for tied timestamps", async () => {
  const f = fixture({
    projectRows: [
      {
        ...posts[0],
        id: "a",
        community_id: joined,
        community: null
      },
      { ...posts[0], id: "z" }
    ]
  });
  const items = await loadFollowingFeed(f.client, viewer);
  assert.deepEqual(
    items.map((item) => item.id),
    ["z", "a"]
  );
  assert.equal(items[1].community_id, joined);
  assert.equal(items[1].community, null);
  const { community_id, community, ...legacy } = posts[0];
  void community_id;
  void community;
  assert.equal(parseFeedProject(legacy)?.id, "creator");
});

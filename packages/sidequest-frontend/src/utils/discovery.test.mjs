import assert from "node:assert/strict";
import test from "node:test";
import { searchCommunitiesByTag } from "./discovery.ts";

const communities = [
  {
    id: "photo",
    name: "Photo Walks",
    description: "Explore photography together.",
    tags: ["Photography"]
  },
  {
    id: "garden",
    name: "City Gardeners",
    description: "Grow plants in small spaces.",
    tags: ["Gardening"]
  },
  {
    id: "uncategorized",
    name: "Open Hobby Club",
    description: "A place for all hobbies.",
    tags: []
  }
];

test("searches communities by case-insensitive partial hobby tag", () => {
  assert.deepEqual(
    searchCommunitiesByTag(communities, "photo").map(
      ({ id }) => id
    ),
    ["photo"]
  );
});

test("returns all communities for an empty search", () => {
  assert.deepEqual(
    searchCommunitiesByTag(communities, "  "),
    communities
  );
});

test("does not match communities without hobby tags", () => {
  assert.deepEqual(
    searchCommunitiesByTag(communities, "hobby"),
    []
  );
});

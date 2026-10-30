import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  HOBBIES,
  searchHobbies
} from "../src/preferences/hobbyCatalogue.ts";
import {
  isPreference,
  toPreferences,
  toSelection,
  validatePreferences
} from "../src/preferences/model.ts";
import {
  recommendActivities,
  DEFAULT_ACTIVITIES
} from "../src/preferences/recommendActivities.ts";
import type { Preference } from "../src/preferences/model.ts";

test("the full catalogue has unique IDs and matches the database seed", async () => {
  assert.equal(HOBBIES.length, 450);
  assert.equal(
    new Set(HOBBIES.map(({ id }) => id)).size,
    HOBBIES.length
  );
  const migration = await readFile(
    new URL(
      "../../../supabase/migrations/202610290001_searchable_hobby_catalogue.sql",
      import.meta.url
    ),
    "utf8"
  );
  const seed = migration.split("$hobby_catalogue$")[1];
  assert.deepEqual(JSON.parse(seed), HOBBIES);
  for (const hobby of HOBBIES) {
    assert.ok(
      hobby.id && hobby.label && Array.isArray(hobby.keywords)
    );
    assert.ok(
      hobby.keywords.every(
        (keyword) => typeof keyword === "string"
      )
    );
    assert.equal(
      isPreference({
        hobby: hobby.id,
        experience_level: "Beginner"
      }),
      true
    );
  }
});

test("search finds keywords and normalizes case, spacing and punctuation", () => {
  assert.ok(
    searchHobbies("camera").some(
      ({ id }) => id === "photography"
    )
  );
  assert.deepEqual(
    searchHobbies("  CAMERA  "),
    searchHobbies("camera")
  );
  assert.ok(
    searchHobbies("bread").some(
      ({ id }) => id === "breadmaking"
    )
  );
  assert.ok(
    searchHobbies("3D-printing").some(
      ({ id }) => id === "3d-printing"
    )
  );
  assert.ok(
    searchHobbies("photography camera").some(
      ({ id }) => id === "photography"
    )
  );
  assert.equal(searchHobbies("cooking")[0].id, "cooking");
  assert.equal(searchHobbies("   ").length, HOBBIES.length);
  assert.deepEqual(searchHobbies("no-such-hobby-xyz987"), []);
});

test("new hobbies and their levels survive preference conversion", () => {
  const preferences: Preference[] = [
    { hobby: "3d-printing", experience_level: "Expert" },
    { hobby: "breadmaking", experience_level: "Intermediate" }
  ];
  assert.equal(validatePreferences(preferences), null);
  assert.deepEqual(
    toPreferences(toSelection(preferences)),
    preferences
  );
});

test("existing interests remain supported at every skill level", () => {
  for (const experience_level of [
    "Beginner",
    "Intermediate",
    "Advanced",
    "Expert"
  ] as const) {
    const preferences: Preference[] = [
      "photography",
      "gardening",
      "cooking"
    ].map((hobby) => ({ hobby, experience_level }));
    assert.equal(validatePreferences(preferences), null);
    assert.deepEqual(
      toPreferences(toSelection(preferences)),
      preferences
    );
  }
});

test("invalid, duplicate and excessive selections are rejected", () => {
  assert.match(validatePreferences([])!, /at least one/);
  assert.equal(
    isPreference({
      hobby: "invented-hobby",
      experience_level: "Beginner"
    }),
    true
  );
  assert.equal(
    isPreference({ hobby: "", experience_level: "Beginner" }),
    false
  );
  assert.equal(
    isPreference({
      hobby: "cooking",
      experience_level: "Master"
    }),
    false
  );
  assert.equal(isPreference(null), false);
  assert.match(
    validatePreferences([
      { hobby: "cooking", experience_level: "Beginner" },
      { hobby: "cooking", experience_level: "Expert" }
    ])!,
    /only once/
  );
  assert.match(
    validatePreferences(
      [
        "cooking",
        "gardening",
        "photography",
        "breadmaking"
      ].map((hobby) => ({
        hobby,
        experience_level: "Beginner"
      }))
    )!,
    /up to 3/
  );
  // Dynamic category IDs must survive conversion; the database validates membership.
  const dynamic = toPreferences({
    "invented-hobby": "Beginner"
  });
  assert.equal(validatePreferences(dynamic), null);
});

test("recommendations handle new hobbies without assigning unrelated activities", () => {
  assert.deepEqual(
    recommendActivities(DEFAULT_ACTIVITIES, [
      { hobby: "3d-printing", experience_level: "Beginner" }
    ]),
    []
  );
  const recommendations = recommendActivities(
    DEFAULT_ACTIVITIES,
    [
      { hobby: "3d-printing", experience_level: "Expert" },
      { hobby: "cooking", experience_level: "Beginner" }
    ]
  );
  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].id, "cooking-salad");
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  createHobbyCategoryId,
  validateCommunityDraft
} from "./communityValidation.ts";

const validDraft = {
  name: "Photo Walks",
  description: "A place for sharing local photography outings.",
  hobby: "photography"
};
const categoryIds = ["photography", "gardening", "cooking"];

test("creates a normalized hobby category id", () => {
  assert.equal(
    createHobbyCategoryId(" Film Photography! "),
    "film-photography"
  );
});

test("accepts a valid community draft", () => {
  assert.equal(
    validateCommunityDraft(validDraft, categoryIds),
    null
  );
});

test("allows a community without a hobby category", () => {
  assert.equal(
    validateCommunityDraft(
      { ...validDraft, hobby: "" },
      categoryIds
    ),
    null
  );
});

test("rejects a blank or overlong community name", () => {
  assert.match(
    validateCommunityDraft(
      { ...validDraft, name: "  " },
      categoryIds
    ) ?? "",
    /name must be/
  );
  assert.match(
    validateCommunityDraft(
      {
        ...validDraft,
        name: "x".repeat(101)
      },
      categoryIds
    ) ?? "",
    /name must be/
  );
});

test("rejects an unsupported hobby category", () => {
  assert.match(
    validateCommunityDraft(
      {
        ...validDraft,
        hobby: "painting"
      },
      categoryIds
    ) ?? "",
    /available hobby category/
  );
});

test("rejects descriptions over the database limit", () => {
  assert.match(
    validateCommunityDraft(
      {
        ...validDraft,
        description: "x".repeat(1001)
      },
      categoryIds
    ) ?? "",
    /1000 characters/
  );
});

// @vitest-environment node

import { describe, expect, test } from "vitest";
import { validateCommunityDraft } from "../../src/utils/communityValidation";

const draft = {
  name: "Weekend Sketchers",
  description: "A group for drawing together.",
  hobby: "drawing"
};
const categoryIds = ["drawing", "gardening"];

describe("unit: validateCommunityDraft", () => {
  test("accepts a 100-character trimmed name but rejects 101 characters", () => {
    expect(
      validateCommunityDraft(
        { ...draft, name: `  ${"a".repeat(100)}  ` },
        categoryIds
      )
    ).toBeNull();

    expect(
      validateCommunityDraft(
        { ...draft, name: "a".repeat(101) },
        categoryIds
      )
    ).toBe("Community name must be 1 to 100 characters.");
  });

  test("accepts a 1000-character description but rejects 1001 characters", () => {
    expect(
      validateCommunityDraft(
        { ...draft, description: "a".repeat(1000) },
        categoryIds
      )
    ).toBeNull();

    expect(
      validateCommunityDraft(
        { ...draft, description: "a".repeat(1001) },
        categoryIds
      )
    ).toBe("Description must be 1000 characters or fewer.");
  });

  test("uses the available category IDs rather than a fixed hobby list", () => {
    const customDraft = { ...draft, hobby: "urban-sketching" };

    expect(
      validateCommunityDraft(customDraft, ["urban-sketching"])
    ).toBeNull();

    expect(
      validateCommunityDraft(customDraft, categoryIds)
    ).toBe("Choose an available hobby category.");
  });
});

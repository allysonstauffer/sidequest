// @vitest-environment node

import { describe, expect, test } from "vitest";
import {
  recommendActivities,
  type Activity
} from "../../src/preferences/recommendActivities";

function activity(
  id: string,
  hobby: string,
  difficulty: Activity["difficulty"]
): Activity {
  return {
    id,
    title: id,
    description: "A suggested hobby activity.",
    hobby,
    difficulty
  };
}

describe("unit: recommendActivities", () => {
  test("excludes activities above the user's skill level and outside their hobbies", () => {
    const activities = [
      activity("photo-intro", "photography", "Beginner"),
      activity("photo-portrait", "photography", "Advanced"),
      activity("cooking-intro", "cooking", "Beginner")
    ];

    const result = recommendActivities(activities, [
      { hobby: "photography", experience_level: "Beginner" }
    ]);

    expect(result.map(({ id }) => id)).toEqual(["photo-intro"]);
  });

  test("ranks exact skill matches ahead of progressively easier activities", () => {
    const activities = [
      activity("intro", "photography", "Beginner"),
      activity("expert", "photography", "Expert"),
      activity("intermediate", "photography", "Intermediate"),
      activity("advanced", "photography", "Advanced")
    ];

    const result = recommendActivities(activities, [
      { hobby: "photography", experience_level: "Expert" }
    ]);

    expect(result.map(({ id }) => id)).toEqual([
      "expert",
      "advanced",
      "intermediate",
      "intro"
    ]);
  });

  test("keeps the original order when activities have the same skill gap", () => {
    const activities = [
      activity("photo-intro", "photography", "Beginner"),
      activity(
        "cooking-intermediate",
        "cooking",
        "Intermediate"
      ),
      activity(
        "photo-intermediate",
        "photography",
        "Intermediate"
      ),
      activity("cooking-intro", "cooking", "Beginner")
    ];

    const result = recommendActivities(activities, [
      {
        hobby: "photography",
        experience_level: "Intermediate"
      },
      { hobby: "cooking", experience_level: "Intermediate" }
    ]);

    expect(result.map(({ id }) => id)).toEqual([
      "cooking-intermediate",
      "photo-intermediate",
      "photo-intro",
      "cooking-intro"
    ]);
  });
});

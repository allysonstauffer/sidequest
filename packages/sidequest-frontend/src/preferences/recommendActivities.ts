import { SKILL_LEVELS, toSelection } from "./model.ts";
import type {
  HobbyId,
  Preference,
  SkillLevel
} from "./model.ts";

export interface Activity {
  id: string;
  title: string;
  description: string;
  hobby: HobbyId;
  difficulty: SkillLevel;
}

export const DEFAULT_ACTIVITIES: readonly Activity[] = [
  {
    id: "photography-composition",
    title: "Explore photo composition",
    description:
      "Photograph the same subject three ways: centered, off-center, and framed by its surroundings. Compare your favorites.",
    hobby: "photography",
    difficulty: "Beginner"
  },
  {
    id: "photography-motion",
    title: "Capture motion in two ways",
    description:
      "Use a fast shutter speed to freeze movement, then a slow shutter speed to show motion. Compare the results.",
    hobby: "photography",
    difficulty: "Intermediate"
  },
  {
    id: "photography-lighting",
    title: "Shape a portrait with light",
    description:
      "Create three portraits using the same light source at different angles. Study how the shadows change the mood.",
    hobby: "photography",
    difficulty: "Advanced"
  },
  {
    id: "photography-editorial",
    title: "Create a cohesive photo essay",
    description:
      "Plan, shoot, and edit a five-image story with consistent lighting and color. Give each image a distinct role in the sequence.",
    hobby: "photography",
    difficulty: "Expert"
  },
  {
    id: "gardening-herbs",
    title: "Start a small herb garden",
    description:
      "Choose an herb suited to your space, plant it in a draining container, and record its light and watering needs.",
    hobby: "gardening",
    difficulty: "Beginner"
  },
  {
    id: "gardening-seasonal-plan",
    title: "Plan a seasonal garden",
    description:
      "Map your available space and sunlight, then choose compatible plants and sketch a planting calendar for your local season.",
    hobby: "gardening",
    difficulty: "Intermediate"
  },
  {
    id: "gardening-propagation",
    title: "Compare propagation methods",
    description:
      "Try two appropriate propagation methods for a plant you know. Track rooting time and growth under the same conditions.",
    hobby: "gardening",
    difficulty: "Advanced"
  },
  {
    id: "gardening-trial",
    title: "Design a small growing trial",
    description:
      "Compare two growing conditions with repeated plantings. Keep other variables consistent and use your observations to plan the next season.",
    hobby: "gardening",
    difficulty: "Expert"
  },
  {
    id: "cooking-salad",
    title: "Build a balanced salad",
    description:
      "Combine something crisp, something creamy, and a simple dressing. Taste and adjust the salt and acidity before serving.",
    hobby: "cooking",
    difficulty: "Beginner"
  },
  {
    id: "cooking-pan-sauce",
    title: "Practice a pan sauce",
    description:
      "Use the browned bits from sautéed mushrooms to make a sauce. Adjust its consistency, seasoning, and acidity.",
    hobby: "cooking",
    difficulty: "Intermediate"
  },
  {
    id: "cooking-fresh-pasta",
    title: "Make filled pasta from scratch",
    description:
      "Prepare dough and a filling, shape a small batch, and test one piece before cooking the rest. Note what improves the texture.",
    hobby: "cooking",
    difficulty: "Advanced"
  },
  {
    id: "cooking-tasting-menu",
    title: "Develop a seasonal tasting menu",
    description:
      "Design three courses with complementary textures and flavors. Create a preparation schedule and refine the plating through a trial run.",
    hobby: "cooking",
    difficulty: "Expert"
  }
];

export function recommendActivities(
  activities: readonly Activity[],
  preferences: readonly Preference[]
): Activity[] {
  const selection = toSelection([...preferences]);

  return activities
    .flatMap((activity, index) => {
      const userLevel = selection[activity.hobby];

      if (!userLevel) return [];

      const userRank = SKILL_LEVELS.indexOf(userLevel);
      const difficultyRank = SKILL_LEVELS.indexOf(
        activity.difficulty
      );

      if (
        userRank < 0 ||
        difficultyRank < 0 ||
        difficultyRank > userRank
      ) {
        return [];
      }

      return [
        {
          activity,
          gap: userRank - difficultyRank,
          index
        }
      ];
    })
    .sort((a, b) => a.gap - b.gap || a.index - b.index)
    .map(({ activity }) => activity);
}

import type {
  DiscoveryContentItem,
  HobbyCommunity
} from "../types/discovery";

export const mockCommunities: HobbyCommunity[] = [
  {
    id: "community-photography",
    name: "Photo Walks",
    description:
      "A sample community for sharing photography projects and exploring with a camera.",
    tags: ["Photography", "Photo walks", "Film photography"],
    imageUrl:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Camera ready for a photography outing"
  },
  {
    id: "community-painting",
    name: "Painting Studio",
    description:
      "A sample group for trying techniques, sharing works in progress, and learning together.",
    tags: ["Painting", "Watercolor", "Acrylic"],
    imageUrl:
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Colorful painting in progress"
  },
  {
    id: "community-gardening",
    name: "City Gardeners",
    description:
      "A sample community for growing plants in gardens, balconies, and small spaces.",
    tags: ["Gardening", "Houseplants", "Urban gardening"],
    imageUrl:
      "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Green plants growing in a garden"
  },
  {
    id: "community-woodworking",
    name: "Woodworking Bench",
    description:
      "A sample group for sharing woodworking ideas, builds, and workshop inspiration.",
    tags: ["Woodworking", "Carpentry", "Furniture"],
    imageUrl:
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Woodworking tools on a workbench"
  },
  {
    id: "community-coding",
    name: "Creative Coding Lab",
    description:
      "A sample space for side projects, experiments, and learning through code.",
    tags: ["Coding", "Web development", "Creative coding"],
    imageUrl:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=85",
    imageAlt:
      "Colorful electronic components on a circuit board"
  }
];

export const mockDiscoveryContent: DiscoveryContentItem[] = [
  {
    id: "content-first-film-roll",
    title: "My first roll of film",
    description:
      "A small photo walk and a few notes on learning to use a film camera.",
    hobby: "Photography",
    kind: "Project",
    beginnerFriendly: true,
    imageUrl:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Camera ready for a photography outing"
  },
  {
    id: "content-low-light-study",
    title: "Low-light portrait study",
    description:
      "Testing manual exposure and off-camera lighting in a home studio.",
    hobby: "Photography",
    kind: "Post",
    beginnerFriendly: false,
    imageUrl:
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=85",
    imageAlt: "A colorful creative project in progress"
  },
  {
    id: "content-color-mixing",
    title: "Three-color mixing exercise",
    description:
      "Practicing a simple palette with primary colors and a sketchbook.",
    hobby: "Painting",
    kind: "Project",
    beginnerFriendly: true,
    imageUrl:
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Colorful painting in progress"
  },
  {
    id: "content-garden-bed",
    title: "Planning a raised garden bed",
    description:
      "A weekend build with a cut list and notes from the first assembly.",
    hobby: "Woodworking",
    kind: "Project",
    beginnerFriendly: false,
    imageUrl:
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Woodworking tools on a workbench"
  },
  {
    id: "content-windowsill-herbs",
    title: "Windowsill herbs from seed",
    description:
      "A first try at growing basil indoors, with a simple weekly check-in.",
    hobby: "Gardening",
    kind: "Post",
    beginnerFriendly: true,
    imageUrl:
      "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Green plants growing in a garden"
  },
  {
    id: "content-small-web-tool",
    title: "A tiny tool for tracking books",
    description:
      "A weekend web app experiment with keyboard shortcuts and local state.",
    hobby: "Coding",
    kind: "Project",
    beginnerFriendly: false,
    imageUrl:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=85",
    imageAlt:
      "Colorful electronic components on a circuit board"
  }
];

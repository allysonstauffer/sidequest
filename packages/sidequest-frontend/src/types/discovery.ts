export interface HobbyCommunity {
  id: string;
  name: string;
  description: string;
  tags: string[];
  imageUrl?: string;
  imageAlt?: string;
}

export interface DiscoveryContentItem {
  id: string;
  title: string;
  description: string;
  hobby?: string;
  kind: "Post" | "Project";
  beginnerFriendly: boolean;
  imageUrl?: string;
  imageAlt?: string;
}

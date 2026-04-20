export interface StoryLocation {
  placeName: string;
  lat: number;
  lng: number;
  resultType: "city" | "county" | "state" | "country";
  confidence: number;
}

export interface Story {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  relatedIds: string[];
  location: StoryLocation;
}

export interface StoryManifest {
  generatedAt: string;
  count: number;
  stories: Story[];
}

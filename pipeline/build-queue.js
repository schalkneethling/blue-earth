import { fetchStories } from "./fetch-stories.js";
import { extractLocations } from "./extract-locations.js";
import { geocodeStories } from "./geocode.js";
import { buildRelatedIds, OUTPUT_PATH, slugify, writeJsonFile } from "./shared.js";

async function buildQueue() {
  const fetched = await fetchStories();
  const extracted = await extractLocations(fetched);
  const geocoded = await geocodeStories(extracted);
  const withIds = geocoded.map((story, index) => ({
    ...story,
    id: `story-${String(index + 1).padStart(3, "0")}-${slugify(story.title)}`,
  }));
  const relatedMap = buildRelatedIds(withIds);

  const stories = withIds
    .map((story) => ({
      id: story.id,
      title: story.title,
      summary: story.summary,
      url: story.url,
      source: story.source,
      publishedAt: new Date(story.publishedAt).toISOString(),
      relatedIds: [...(relatedMap.get(story.id) ?? [])],
      location: story.location,
    }))
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));

  const payload = {
    generatedAt: new Date().toISOString(),
    count: stories.length,
    stories,
  };

  await writeJsonFile(OUTPUT_PATH, payload);
  return payload;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const payload = await buildQueue();
    console.log(`Wrote ${payload.count} stories to ${OUTPUT_PATH}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

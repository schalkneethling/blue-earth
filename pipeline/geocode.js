import { resolve } from "node:path";

import {
  CACHE_DIR,
  readJsonFile,
  resolveEnv,
  runWithConcurrency,
  writeJsonFile,
} from "./shared.js";

const INPUT_PATH = resolve(CACHE_DIR, "extracted-stories.json");
const OUTPUT_PATH = resolve(CACHE_DIR, "geocoded-stories.json");
const ACCEPTED_RESULT_TYPES = new Set(["city", "county", "state", "country"]);

export async function geocodeStories(stories) {
  const apiKey = resolveEnv("GEOAPIFY_API_KEY");
  const geocoded = await runWithConcurrency(stories, 4, async (story) => {
    const result = await geocodeStory(apiKey, story);
    return result === null ? null : { ...story, location: result };
  });

  const filtered = geocoded.filter(Boolean);
  await writeJsonFile(OUTPUT_PATH, filtered);
  return filtered;
}

async function geocodeStory(apiKey, story) {
  const params = new URLSearchParams({
    text: [story.extraction.place, story.extraction.country].filter(Boolean).join(", "),
    format: "json",
    limit: "1",
    apiKey,
  });
  const response = await fetch(`https://api.geoapify.com/v1/geocode/search?${params}`);

  if (response.ok === false) {
    throw new Error(`Geoapify request failed (${response.status})`);
  }

  const payload = await response.json();
  const result = payload.results?.[0];

  if (
    result === undefined ||
    ACCEPTED_RESULT_TYPES.has(result.result_type) === false ||
    Number(result.rank?.confidence ?? 0) < 0.6
  ) {
    return null;
  }

  return {
    placeName: result.formatted,
    lat: result.lat,
    lng: result.lon,
    resultType: result.result_type,
    confidence: Number(result.rank.confidence ?? 0),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const stories = await readJsonFile(INPUT_PATH);
    const geocoded = await geocodeStories(stories);
    console.log(`Geocoded ${geocoded.length} stories above confidence threshold.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

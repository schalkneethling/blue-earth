import { resolve } from "node:path";

import {
  CACHE_DIR,
  cleanStoryText,
  decodeEntities,
  keywordMatches,
  normaliseWhitespace,
  resolveEnv,
  writeJsonFile,
} from "./shared.js";

const RSS_FEEDS = [
  { source: "Positive News", url: "https://www.positive.news/feed/" },
  { source: "Carbon Brief", url: "https://www.carbonbrief.org/feed/" },
  { source: "Yale Environment 360", url: "https://e360.yale.edu/feed.xml" },
  { source: "Inside Climate News", url: "https://insideclimatenews.org/feed/" },
  { source: "Grist", url: "https://grist.org/feed/" },
  { source: "Yale Climate Connections", url: "https://yaleclimateconnections.org/feed/" },
  { source: "Climate Home News", url: "https://www.climatechangenews.com/feed/" },
];

const CACHE_PATH = resolve(CACHE_DIR, "fetched-stories.json");

export async function fetchStories() {
  const guardianApiKey = resolveEnv("GUARDIAN_API_KEY");
  const [guardianStories, rssStories] = await Promise.all([
    fetchGuardianStories(guardianApiKey),
    fetchRssStories(),
  ]);

  const deduped = dedupeByUrl([...guardianStories, ...rssStories]);
  await writeJsonFile(CACHE_PATH, deduped);

  return deduped;
}

async function fetchGuardianStories(apiKey) {
  const params = new URLSearchParams({
    "api-key": apiKey,
    section: "environment",
    "show-fields": "headline,trailText,bodyText",
    "show-tags": "keyword",
    "page-size": "50",
    q: "climate OR environment",
  });
  const response = await fetch(`https://content.guardianapis.com/search?${params}`);

  if (response.ok === false) {
    throw new Error(`Guardian API request failed (${response.status})`);
  }

  const payload = await response.json();
  const results = payload.response?.results ?? [];

  return results
    .map((item) => {
      const title = cleanStoryText(item.webTitle ?? item.fields?.headline ?? "", 140);
      const summary = cleanStoryText(item.fields?.trailText ?? item.fields?.bodyText ?? "", 280);
      const combinedText = `${title} ${summary}`;

      if (keywordMatches(combinedText) === false) {
        return null;
      }

      const tags = (item.tags ?? []).map((tag) => tag.id).filter(Boolean);
      const secondaryTags = tags.filter((tag) => tag !== "environment/climate-change");

      return {
        title,
        summary,
        url: item.webUrl,
        source: "The Guardian",
        publishedAt: item.webPublicationDate,
        tags,
        secondaryTags,
      };
    })
    .filter(Boolean);
}

async function fetchRssStories() {
  const feeds = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const response = await fetch(feed.url);

      if (response.ok === false) {
        throw new Error(`RSS fetch failed for ${feed.source} (${response.status})`);
      }

      const xml = await response.text();
      return parseRss(xml, feed.source);
    }),
  );

  return feeds
    .flatMap((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      }

      console.warn(`[pipeline][fetch] Skipping RSS feed: ${result.reason}`);
      return [];
    })
    .filter((story) => keywordMatches(`${story.title} ${story.summary}`));
}

function parseRss(xml, source) {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/g) ?? [];

  return items.slice(0, 40).map((item) => {
    const title = decodeEntities(extractTag(item, "title"));
    const link = extractTag(item, "link");
    const publishedAt = extractTag(item, "pubDate");
    const summary = cleanStoryText(extractTag(item, "description"), 280);
    const categoryMatches = [...item.matchAll(/<category>(.*?)<\/category>/g)].map((match) =>
      cleanStoryText(match[1], 80),
    );

    return {
      title: cleanStoryText(title, 140),
      summary,
      url: normaliseWhitespace(link),
      source,
      publishedAt,
      tags: categoryMatches,
      secondaryTags: categoryMatches.slice(0, 3),
    };
  });
}

function extractTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match?.[1] ? normaliseWhitespace(match[1]) : "";
}

function dedupeByUrl(items) {
  const unique = new Map();

  items.forEach((item) => {
    if (item.url) {
      unique.set(item.url, item);
    }
  });

  return [...unique.values()];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const stories = await fetchStories();
    console.log(`Fetched ${stories.length} candidate stories.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

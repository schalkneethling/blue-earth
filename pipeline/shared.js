import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = resolve(__dirname, "..");
export const CACHE_DIR = resolve(ROOT_DIR, "pipeline/.cache");
export const OUTPUT_PATH = resolve(ROOT_DIR, "public/data/stories.json");
dotenv.config({ path: resolve(ROOT_DIR, ".env") });

const KEYWORDS = [
  "restore",
  "community",
  "plant",
  "renewable",
  "rewild",
  "solar",
  "clean",
  "initiative",
  "wetland",
  "mangrove",
  "co-op",
  "cooperative",
  "conservation",
  "recycle",
  "electric bus",
  "habitat",
  "regenerative",
  "restoration",
  "wind farm",
  "community energy",
  "heat pump",
  "clean energy",
  "solar farm",
  "reef",
  "coral",
  "forest",
  "rewilding",
  "biodiversity",
];

const NEGATIVE_KEYWORDS = [
  "debriefed",
  "newsletter",
  "podcast",
  "opinion",
  "analysis",
  "deadlock",
  "war",
  "invasion",
  "tariff",
  "political climate divide",
  "earnings call",
];

export async function ensureDir(directoryPath) {
  await mkdir(directoryPath, { recursive: true });
}

export async function writeJsonFile(filePath, data) {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function readJsonFile(filePath) {
  const contents = await readFile(filePath, "utf8");
  return JSON.parse(contents);
}

export function normaliseWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

export function stripHtml(value) {
  return normaliseWhitespace(value.replace(/<[^>]*>/g, " "));
}

export function decodeEntities(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&#160;", " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&#8217;", "'")
    .replaceAll("&#8216;", "'")
    .replaceAll("&#8220;", '"')
    .replaceAll("&#8221;", '"')
    .replaceAll("&#8211;", "–")
    .replaceAll("&#8212;", "—")
    .replaceAll("&#124;", "|")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

export function keywordMatches(text) {
  const lower = text.toLowerCase();

  if (NEGATIVE_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return false;
  }

  return KEYWORDS.some((keyword) => lower.includes(keyword));
}

export function cleanStoryText(value, maxLength = 280) {
  const cleaned = normaliseWhitespace(decodeEntities(stripHtml(value)))
    .replace(/\s+\|\s+/g, " | ")
    .replace(/\s+[–—-]\s+/g, " — ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const slice = cleaned.slice(0, maxLength - 1);
  const lastBreak = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("—"));
  return `${slice.slice(0, lastBreak > 80 ? lastBreak : slice.length).trim()}…`;
}

export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function runWithConcurrency(items, concurrency, worker) {
  const results = [];
  let cursor = 0;

  async function next() {
    const index = cursor;
    cursor += 1;

    if (index >= items.length) {
      return;
    }

    results[index] = await worker(items[index], index);
    await next();
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));

  return results;
}

export function buildRelatedIds(stories) {
  const groups = new Map();

  stories.forEach((story) => {
    story.secondaryTags.forEach((tag) => {
      if (groups.has(tag) === false) {
        groups.set(tag, []);
      }

      groups.get(tag).push(story.id);
    });
  });

  const relatedMap = new Map(stories.map((story) => [story.id, new Set()]));

  groups.forEach((storyIds) => {
    storyIds.forEach((storyId) => {
      const siblings = relatedMap.get(storyId);

      storyIds.forEach((otherId) => {
        if (otherId !== storyId) {
          siblings.add(otherId);
        }
      });
    });
  });

  return relatedMap;
}

export function resolveEnv(name) {
  const value = process.env[name];

  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

import { resolve } from "node:path";

import {
  CACHE_DIR,
  readJsonFile,
  resolveEnv,
  runWithConcurrency,
  writeJsonFile,
} from "./shared.js";

const INPUT_PATH = resolve(CACHE_DIR, "fetched-stories.json");
const OUTPUT_PATH = resolve(CACHE_DIR, "extracted-stories.json");

export async function extractLocations(stories) {
  const apiKey = resolveEnv("ANTHROPIC_API_KEY");
  const model = resolveEnv("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001";

  const extracted = await runWithConcurrency(stories, 4, async (story) => {
    const location = await extractLocation(apiKey, model, story);

    if (location.place === null || location.confidence === "low") {
      return null;
    }

    return {
      ...story,
      extraction: location,
    };
  });

  const filtered = extracted.filter(Boolean);
  await writeJsonFile(OUTPUT_PATH, filtered);
  return filtered;
}

async function extractLocation(apiKey, model, story) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Given this news article title and summary, extract the primary geographic location where the described climate action is taking place.

Return ONLY valid JSON in this exact shape:
{
  "place": "city or region name",
  "country": "country name",
  "confidence": "high | medium | low",
  "reason": "brief explanation of where in the text this came from"
}

Return ONLY raw JSON.
Do not wrap the response in Markdown.
Do not use code fences.
Do not add any explanatory text before or after the JSON.

If no clear location can be determined, return: { "place": null }

Title: ${story.title}
Summary: ${story.summary}`,
        },
      ],
    }),
  });

  if (response.ok === false) {
    const errorBody = await response.text();
    throw new Error(
      `Anthropic API request failed (${response.status}) using model "${model}": ${errorBody}`,
    );
  }

  const payload = await response.json();
  const textBlock = payload.content?.find((entry) => entry.type === "text");
  const parsed = JSON.parse(
    extractJsonObject(textBlock?.text ?? '{"place":null}'),
  );

  return {
    place: parsed.place ?? null,
    country: parsed.country ?? "",
    confidence: parsed.confidence ?? "low",
    reason: parsed.reason ?? "",
  };
}

function extractJsonObject(text) {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/iu);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  return trimmed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const stories = await readJsonFile(INPUT_PATH);
    const extracted = await extractLocations(stories);
    console.log(`Extracted usable locations for ${extracted.length} stories.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

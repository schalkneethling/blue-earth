import "./style.css";

import { exposeEventDebugControls, isEventDebugEnabled, logEvent } from "./debug/events";
import { CardPool } from "./feed/card-pool";
import { StoryFeedController } from "./feed/controller";
import { BlueEarthScene } from "./globe/scene";
import type { StoryManifest } from "./types/story";

const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error("Expected #app root to exist");
}

app.innerHTML = `
  <div class="app-shell">
    <div class="loading-overlay" data-state="loading" role="status" aria-live="polite">
      <p class="loading-overlay__eyebrow">Blue Earth</p>
      <p class="loading-overlay__message">Loading climate stories…</p>
    </div>

    <section class="page-layout">
      <header class="page-header">
        <p class="page-header__kicker">WICG HTML-in-Canvas demo</p>
        <h1>Every place<br />has a <em>story.</em></h1>
        <p class="page-header__lede">
          Discover how communities around the world are taking action on climate
          change through a living globe of hopeful reporting.
        </p>

        <dl class="signal-list">
          <div>
            <dt>Stories</dt>
            <dd class="signal-list__stories">0</dd>
          </div>
          <div>
            <dt>Countries</dt>
            <dd class="signal-list__countries">0</dd>
          </div>
          <div>
            <dt>Connections</dt>
            <dd class="signal-list__connections">0</dd>
          </div>
        </dl>

        <aside class="feed-stats" aria-live="polite" aria-atomic="false">
          <p>
            <strong class="feed-stats__count">0</strong>
            <span> climate action stories revealed</span>
          </p>
          <p class="feed-stats__source">Stories from The Guardian and climate reporting partners.</p>
          <p class="feed-stats__freshness"></p>
        </aside>
      </header>

      <main class="globe-stage">
        <div class="globe-stage__surface">
          <canvas
            id="globe"
            class="globe-canvas"
            layoutsubtree
            aria-label="A rotating globe showing climate action stories around the world"
          ></canvas>
          <div class="globe-stage__meta">
            <p class="globe-stage__caption">
              Pure experiment: Chrome Canary with
              <code>chrome://flags/#canvas-draw-element</code> enabled.
            </p>
          </div>
        </div>
      </main>
    </section>
  </div>
`;

const canvas = getRequiredElement<HTMLCanvasElement>("#globe");
const loadingOverlay = getRequiredElement<HTMLDivElement>(".loading-overlay");
const loadingMessage = getRequiredElement<HTMLParagraphElement>(".loading-overlay__message");
const revealedCount = getRequiredElement<HTMLElement>(".feed-stats__count");
const freshness = getRequiredElement<HTMLElement>(".feed-stats__freshness");
const totalStories = getRequiredElement<HTMLElement>(".signal-list__stories");
const totalCountries = getRequiredElement<HTMLElement>(".signal-list__countries");
const totalConnections = getRequiredElement<HTMLElement>(".signal-list__connections");

const supportsHtmlInCanvas =
  "requestPaint" in HTMLCanvasElement.prototype &&
  "texElementImage2D" in WebGLRenderingContext.prototype;

exposeEventDebugControls();
installGlobalEventLogging(canvas);

if (isEventDebugEnabled()) {
  console.info(
    "[blue-earth][debug] Event logging is active. Use disableBlueEarthEventDebug() to turn it off.",
  );
}

if (supportsHtmlInCanvas === false) {
  document.body.classList.add("is-unsupported");
  loadingOverlay.dataset.state = "error";
  loadingMessage.textContent =
    "This demo requires Chrome Canary with chrome://flags/#canvas-draw-element enabled.";
} else {
  void bootstrap();
}

async function bootstrap() {
  try {
    const response = await fetch("/data/stories.json");

    if (response.ok === false) {
      throw new Error(`Unable to load stories.json (${response.status})`);
    }

    const manifest = (await response.json()) as StoryManifest;
    const countries = new Set(
      manifest.stories.map(
        (story) => story.location.placeName.split(",").at(-1)?.trim() ?? "Unknown",
      ),
    );
    const connectionCount =
      manifest.stories.reduce((sum, story) => sum + story.relatedIds.length, 0) / 2;

    totalStories.textContent = String(manifest.count);
    totalCountries.textContent = String(countries.size);
    totalConnections.textContent = String(connectionCount);
    freshness.textContent = describeFreshness(manifest.generatedAt);

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cardPool = new CardPool(canvas, 5);
    const scene = new BlueEarthScene({
      canvas,
      stories: manifest.stories,
      cardPool,
      prefersReducedMotion,
    });

    scene.start();

    const controller = new StoryFeedController({
      stories: manifest.stories,
      prefersReducedMotion,
      onReveal: (story) => {
        scene.revealStory(story);
      },
    });

    let revealTotal = 0;

    controller.addEventListener("storyadded", () => {
      revealTotal += 1;
      revealedCount.textContent = String(revealTotal);
    });

    controller.start();

    loadingOverlay.dataset.state = "ready";
    window.setTimeout(() => loadingOverlay.remove(), 900);
  } catch (error) {
    document.body.classList.add("is-unsupported");
    loadingOverlay.dataset.state = "error";
    loadingMessage.textContent =
      error instanceof Error ? error.message : "The globe could not be initialised.";
  }
}

function getRequiredElement<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector);

  if (element === null) {
    throw new Error(`Expected element for selector "${selector}"`);
  }

  return element;
}

function installGlobalEventLogging(canvasElement: HTMLCanvasElement) {
  const eventTypes = ["pointerdown", "pointerup", "click", "focusin", "focusout"] as const;

  eventTypes.forEach((type) => {
    document.addEventListener(
      type,
      (event) => {
        logEvent(`document capture ${type}`, event);
      },
      true,
    );
    document.addEventListener(type, (event) => {
      logEvent(`document bubble ${type}`, event);
    });
    canvasElement.addEventListener(
      type,
      (event) => {
        logEvent(`canvas capture ${type}`, event);
      },
      true,
    );
    canvasElement.addEventListener(type, (event) => {
      logEvent(`canvas bubble ${type}`, event);
    });
  });
}

function describeFreshness(generatedAt: string) {
  const generated = new Date(generatedAt);
  const now = new Date();
  const diffMs = now.getTime() - generated.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / 86_400_000));
  const label = generated.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (Number.isNaN(generated.getTime())) {
    return "Story build date unavailable.";
  }

  if (diffDays === 0) {
    return `Story set generated today (${label}).`;
  }

  if (diffDays === 1) {
    return `Story set generated yesterday (${label}).`;
  }

  return `Story set generated ${diffDays} days ago (${label}).`;
}

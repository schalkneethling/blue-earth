import { logDebug, logEvent } from "../debug/events";
import type { Story } from "../types/story";

interface CardEntry {
  element: HTMLElement;
  storyId: string | null;
  active: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export class CardPool {
  private readonly canvas: HTMLCanvasElement;
  private readonly entries: CardEntry[];

  constructor(canvas: HTMLCanvasElement, size: number) {
    this.canvas = canvas;
    this.entries = Array.from({ length: size }, (_, index) => ({
      element: this.createCard(index),
      storyId: null,
      active: false,
    }));
  }

  acquire(story: Story) {
    const existing = this.entries.find((entry) => entry.storyId === story.id);

    if (existing !== undefined) {
      existing.active = true;
      return existing;
    }

    const idle = this.entries.find((entry) => entry.active === false) ?? this.entries[0];
    this.populateCard(idle.element, story);
    idle.storyId = story.id;
    idle.active = true;
    idle.element.style.pointerEvents = "auto";
    this.canvas.requestPaint?.();

    return idle;
  }

  releaseByStoryId(storyId: string) {
    const entry = this.entries.find((item) => item.storyId === storyId);

    if (entry !== undefined) {
      this.release(entry);
    }
  }

  releaseAll() {
    this.entries.forEach((entry) => {
      if (entry.active) {
        this.release(entry);
      }
    });
  }

  private release(entry: CardEntry) {
    entry.active = false;
    entry.storyId = null;
    entry.element.style.pointerEvents = "none";
    entry.element.style.transform = "translate3d(-9999px, -9999px, 0) scale(1)";
    this.populateCard(entry.element, null);
    this.canvas.requestPaint?.();
  }

  private createCard(index: number) {
    const article = document.createElement("article");
    article.className = "story-card";
    article.id = `story-card-${index}`;
    article.style.transform = "translate3d(-9999px, -9999px, 0) scale(1)";
    article.style.pointerEvents = "none";
    article.innerHTML = `
      <header class="story-card__header">
        <span class="story-card__meta story-card__source">Source</span>
        <time class="story-card__meta story-card__date" datetime=""></time>
      </header>
      <h2 class="story-card__title"></h2>
      <p class="story-card__summary"></p>
      <p class="story-card__meta story-card__place"></p>
      <a class="story-card__link" href="" target="_blank" rel="noopener noreferrer">
        Read the full story →
      </a>
    `;
    const link = article.querySelector<HTMLAnchorElement>(".story-card__link");

    if (link === null) {
      throw new Error("Expected story card link to exist");
    }

    const openStory = (event?: Event) => {
      logEvent(`card ${article.id} openStory`, event, {
        url: article.dataset.url ?? "",
      });
      event?.preventDefault();
      event?.stopPropagation();

      const url = article.dataset.url;

      if (url && url !== "#") {
        const openedWindow = window.open(url, "_blank", "noopener,noreferrer");
        logDebug(`window.open attempted from ${article.id}`, {
          url,
          openedWindow: openedWindow === null ? "null" : "opened",
        });
      }
    };

    article.addEventListener("pointerdown", (event) => {
      logEvent(`card ${article.id} pointerdown`, event, {
        url: article.dataset.url ?? "",
      });
    });
    article.addEventListener("pointerup", (event) => {
      logEvent(`card ${article.id} pointerup`, event, {
        url: article.dataset.url ?? "",
      });
    });
    link.addEventListener("pointerdown", (event) => {
      logEvent(`link ${article.id} pointerdown`, event, {
        href: link.href,
      });
    });
    link.addEventListener("pointerup", (event) => {
      logEvent(`link ${article.id} pointerup`, event, {
        href: link.href,
      });
    });
    link.addEventListener("click", openStory);
    link.addEventListener("keydown", (event) => {
      logEvent(`link ${article.id} keydown`, event, {
        key: event.key,
      });
    });

    this.canvas.append(article);
    return article;
  }

  private populateCard(element: HTMLElement, story: Story | null) {
    const source = element.querySelector<HTMLElement>(".story-card__source");
    const date = element.querySelector<HTMLTimeElement>(".story-card__date");
    const title = element.querySelector<HTMLElement>(".story-card__title");
    const summary = element.querySelector<HTMLElement>(".story-card__summary");
    const place = element.querySelector<HTMLElement>(".story-card__place");
    const link = element.querySelector<HTMLAnchorElement>(".story-card__link");

    if (
      source === null ||
      date === null ||
      title === null ||
      summary === null ||
      place === null ||
      link === null
    ) {
      throw new Error("Expected story card sub-elements to exist");
    }

    if (story === null) {
      element.dataset.url = "";
      source.textContent = "";
      date.textContent = "";
      date.dateTime = "";
      title.textContent = "";
      summary.textContent = "";
      place.textContent = "";
      link.href = "#";
      link.tabIndex = -1;
      return;
    }

    logDebug(`populate card ${element.id}`, {
      title: story.title,
      url: story.url,
    });
    source.textContent = story.source;
    element.dataset.url = story.url;
    date.textContent = dateFormatter.format(new Date(story.publishedAt));
    date.dateTime = story.publishedAt;
    title.textContent = story.title;
    summary.textContent = story.summary;
    place.textContent = story.location.placeName;
    link.href = story.url;
    link.tabIndex = 0;
  }
}

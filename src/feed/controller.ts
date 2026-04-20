import type { Story } from "../types/story";

const FEED_INTERVAL_MS = 8_000;

export class StoryFeedController extends EventTarget {
  private readonly stories: Story[];
  private readonly prefersReducedMotion: boolean;
  private readonly onReveal: (story: Story) => void;
  private index = 0;
  private intervalId: number | null = null;

  constructor(options: {
    stories: Story[];
    prefersReducedMotion: boolean;
    onReveal: (story: Story) => void;
  }) {
    super();
    this.stories = [...options.stories].sort(
      (left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt),
    );
    this.prefersReducedMotion = options.prefersReducedMotion;
    this.onReveal = options.onReveal;
  }

  start() {
    if (this.stories.length === 0) {
      return;
    }

    if (this.prefersReducedMotion) {
      this.stories.forEach((story) => this.emitStory(story));
      return;
    }

    this.emitStory(this.nextStory());
    this.intervalId = window.setInterval(() => {
      this.emitStory(this.nextStory());
    }, FEED_INTERVAL_MS);
  }

  stop() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private nextStory() {
    const story = this.stories[this.index];
    this.index = (this.index + 1) % this.stories.length;
    return story;
  }

  private emitStory(story: Story) {
    this.onReveal(story);
    this.dispatchEvent(new CustomEvent<Story>("storyadded", { detail: story }));
  }
}

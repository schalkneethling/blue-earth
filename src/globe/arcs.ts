import {
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  QuadraticBezierCurve3,
} from "three";

import type { Story } from "../types/story";
import { GLOBE_RADIUS, latLngToVector3 } from "./helpers";

interface ArcRecord {
  line: Line<BufferGeometry, LineBasicMaterial>;
  createdAt: number;
}

export class ArcNetwork {
  readonly group = new Group();

  private readonly stories = new Map<string, Story>();
  private readonly revealedStories = new Set<string>();
  private readonly activeArcs = new Map<string, ArcRecord>();

  constructor(stories: Story[]) {
    stories.forEach((story) => {
      this.stories.set(story.id, story);
    });
  }

  revealStory(storyId: string, timestamp: number) {
    const story = this.stories.get(storyId);

    if (story === undefined) {
      return;
    }

    this.revealedStories.add(storyId);

    story.relatedIds.forEach((relatedId) => {
      if (this.revealedStories.has(relatedId) === false) {
        return;
      }

      const key = makeArcKey(storyId, relatedId);

      if (this.activeArcs.has(key)) {
        return;
      }

      const related = this.stories.get(relatedId);

      if (related === undefined) {
        return;
      }

      const line = createArc(story, related);
      this.group.add(line);
      this.activeArcs.set(key, { line, createdAt: timestamp });
    });
  }

  update(timestamp: number) {
    this.activeArcs.forEach((arc) => {
      const progress = Math.min((timestamp - arc.createdAt) / 900, 1);
      arc.line.material.opacity = progress * 0.26;
    });
  }
}

function createArc(storyA: Story, storyB: Story) {
  const pointA = latLngToVector3(storyA.location.lat, storyA.location.lng, GLOBE_RADIUS * 1.015);
  const pointB = latLngToVector3(storyB.location.lat, storyB.location.lng, GLOBE_RADIUS * 1.015);
  const midpoint = pointA.clone().add(pointB).multiplyScalar(0.5);
  const distance = pointA.distanceTo(pointB);
  const controlPoint = midpoint.normalize().multiplyScalar(GLOBE_RADIUS + distance * 0.42);
  const curve = new QuadraticBezierCurve3(pointA, controlPoint, pointB);
  const points = curve.getPoints(56);
  const geometry = new BufferGeometry().setFromPoints(points);

  return new Line(
    geometry,
    new LineBasicMaterial({
      color: new Color("#00e5cc"),
      transparent: true,
      opacity: 0,
    }),
  );
}

function makeArcKey(left: string, right: string) {
  return [left, right].sort().join(":");
}

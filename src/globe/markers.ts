import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  SphereGeometry,
  Vector2,
  type Camera,
  type Intersection,
} from "three";

import { GLOBE_RADIUS, MARKER_RADIUS, latLngToVector3 } from "./helpers";
import type { Story } from "../types/story";

interface MarkerRecord {
  mesh: Mesh;
  story: Story;
  revealedAt: number | null;
}

export class MarkerField {
  readonly group = new Group();

  private readonly raycaster = new Raycaster();
  private readonly markerMap = new Map<string, MarkerRecord>();

  constructor(stories: Story[]) {
    const geometry = new SphereGeometry(MARKER_RADIUS, 16, 16);
    const material = new MeshBasicMaterial({
      color: new Color("#00e5cc"),
      transparent: true,
      opacity: 0.95,
    });

    stories.forEach((story) => {
      const mesh = new Mesh(geometry, material.clone());
      mesh.position.copy(
        latLngToVector3(story.location.lat, story.location.lng, GLOBE_RADIUS * 1.008),
      );
      mesh.visible = false;
      mesh.userData.storyId = story.id;

      this.group.add(mesh);
      this.markerMap.set(story.id, {
        mesh,
        story,
        revealedAt: null,
      });
    });
  }

  reveal(storyId: string, timestamp: number) {
    const marker = this.markerMap.get(storyId);

    if (marker === undefined) {
      return;
    }

    marker.mesh.visible = true;
    marker.revealedAt = timestamp;
  }

  isRevealed(storyId: string) {
    return this.markerMap.get(storyId)?.mesh.visible ?? false;
  }

  getAnchor(storyId: string) {
    return this.markerMap.get(storyId)?.mesh.position.clone() ?? null;
  }

  pick(pointer: Vector2, camera: Camera) {
    this.raycaster.setFromCamera(pointer, camera);

    const intersections = this.raycaster.intersectObjects(this.group.children, false) as Array<
      Intersection<Mesh>
    >;
    const match = intersections.find((entry) => entry.object.visible);
    const storyId = match?.object.userData.storyId as string | undefined;

    return storyId === undefined ? null : (this.markerMap.get(storyId)?.story ?? null);
  }

  update(timestamp: number) {
    this.markerMap.forEach((marker) => {
      if (marker.mesh.visible === false || marker.revealedAt === null) {
        return;
      }

      const elapsed = timestamp - marker.revealedAt;
      const pulseWindow = 10_000;
      const material = marker.mesh.material as MeshBasicMaterial;

      if (elapsed < pulseWindow) {
        const wave = (Math.sin(elapsed / 220) + 1) * 0.5;
        const boost = 1 + wave * 0.8;
        marker.mesh.scale.setScalar(boost);
        material.opacity = 0.85 + wave * 0.15;
      } else {
        marker.mesh.scale.setScalar(1);
        material.opacity = 0.92;
      }
    });
  }
}

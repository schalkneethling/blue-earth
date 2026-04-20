import {
  DoubleSide,
  Group,
  HTMLTexture,
  LinearFilter,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";

import type { CardPool } from "../feed/card-pool";
import type { Story } from "../types/story";
import {
  CARD_HEIGHT_PX,
  CARD_WIDTH_PX,
  CARD_WORLD_HEIGHT,
  CARD_WORLD_WIDTH,
  GLOBE_RADIUS,
} from "./helpers";

interface ActiveCard {
  mesh: Mesh;
  material: MeshBasicMaterial;
  element: HTMLElement;
  storyId: string;
  texture: HTMLTexture;
  openedAt: number;
}

export class StoryCardProjector {
  readonly group = new Group();

  private readonly planeGeometry = new PlaneGeometry(CARD_WORLD_WIDTH, CARD_WORLD_HEIGHT);
  private readonly camera: PerspectiveCamera;
  private readonly canvas: HTMLCanvasElement;
  private readonly cardPool: CardPool;
  private activeCard: ActiveCard | null = null;

  constructor(options: {
    camera: PerspectiveCamera;
    canvas: HTMLCanvasElement;
    cardPool: CardPool;
  }) {
    this.camera = options.camera;
    this.canvas = options.canvas;
    this.cardPool = options.cardPool;
  }

  toggle(story: Story, anchor: Vector3) {
    if (this.activeCard?.storyId === story.id) {
      this.close();
      return;
    }

    this.open(story, anchor);
  }

  get isOpen() {
    return this.activeCard !== null;
  }

  contains(element: Element | null) {
    return this.activeCard?.element.contains(element) ?? false;
  }

  close() {
    if (this.activeCard === null) {
      return;
    }

    this.group.remove(this.activeCard.mesh);
    this.activeCard.material.dispose();
    this.activeCard.texture.dispose();
    this.cardPool.releaseByStoryId(this.activeCard.storyId);
    this.activeCard = null;
  }

  update(timestamp: number) {
    if (this.activeCard === null) {
      return;
    }

    const worldPosition = new Vector3();
    this.activeCard.mesh.getWorldPosition(worldPosition);
    this.activeCard.mesh.lookAt(this.camera.position);

    const projected = worldPosition.clone().project(this.camera);
    const distance = worldPosition.distanceTo(this.camera.position);
    const visible = projected.z > -1 && projected.z < 1;
    const viewportHeight = 2 * Math.tan(MathUtils.degToRad(this.camera.fov / 2)) * distance;
    const pixelsPerUnit = this.canvas.clientHeight / viewportHeight;
    const widthPx = CARD_WORLD_WIDTH * pixelsPerUnit;
    const x = (projected.x * 0.5 + 0.5) * this.canvas.clientWidth - widthPx / 2;
    const y =
      (-projected.y * 0.5 + 0.5) * this.canvas.clientHeight -
      (CARD_WORLD_HEIGHT * pixelsPerUnit) / 2;
    const scale = widthPx / CARD_WIDTH_PX;

    this.activeCard.element.style.transform = visible
      ? `translate3d(${x}px, ${y}px, 0) scale(${scale})`
      : "translate3d(-9999px, -9999px, 0) scale(1)";
    this.activeCard.element.style.pointerEvents = visible ? "auto" : "none";

    const progress = Math.min((timestamp - this.activeCard.openedAt) / 220, 1);
    this.activeCard.material.opacity = progress;
    this.activeCard.mesh.scale.setScalar(0.94 + progress * 0.06);
  }

  private open(story: Story, anchor: Vector3) {
    this.close();

    const entry = this.cardPool.acquire(story);
    const texture = new HTMLTexture(entry.element);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;

    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: DoubleSide,
      opacity: 0,
      toneMapped: false,
    });

    const mesh = new Mesh(this.planeGeometry, material);
    mesh.position.copy(
      anchor
        .clone()
        .normalize()
        .multiplyScalar(GLOBE_RADIUS + 0.34),
    );
    mesh.scale.setScalar(0.94);
    this.group.add(mesh);

    entry.element.style.width = `${CARD_WIDTH_PX}px`;
    entry.element.style.minHeight = `${CARD_HEIGHT_PX}px`;

    this.activeCard = {
      mesh,
      material,
      element: entry.element,
      storyId: story.id,
      texture,
      openedAt: performance.now(),
    };

    this.canvas.requestPaint?.();
  }
}

import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from "three";

import type { CardPool } from "../feed/card-pool";
import type { Story } from "../types/story";
import { logDebug, logEvent } from "../debug/events";
import { ArcNetwork } from "./arcs";
import { StoryCardProjector } from "./card-texture";
import { createEarth } from "./earth";
import { GLOBE_RADIUS, latLngToVector3 } from "./helpers";
import { GlobeInteraction } from "./interaction";
import { MarkerField } from "./markers";

export class BlueEarthScene {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(34, 1, 0.1, 30);
  private readonly pivot = new Group();
  private readonly markers: MarkerField;
  private readonly arcs: ArcNetwork;
  private readonly cards: StoryCardProjector;
  private readonly interaction: GlobeInteraction;
  private lastTimestamp = performance.now();

  constructor(options: {
    canvas: HTMLCanvasElement;
    stories: Story[];
    cardPool: CardPool;
    prefersReducedMotion: boolean;
  }) {
    this.canvas = options.canvas;
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.setClearColor(0x020d14, 0);

    this.camera.position.set(0, 0.18, 2.55);

    this.scene.add(this.pivot);
    this.scene.add(createStars());
    this.pivot.add(createEarth(GLOBE_RADIUS));

    this.scene.add(new AmbientLight(new Color("#eef6ff"), 0.35));

    const keyLight = new DirectionalLight(new Color("#eaf6ff"), 1.25);
    keyLight.position.set(3.5, 1.8, 2.2);
    this.scene.add(keyLight);

    const rimLight = new DirectionalLight(new Color("#17e8d0"), 0.65);
    rimLight.position.set(-3.2, -0.8, -2.1);
    this.scene.add(rimLight);

    this.markers = new MarkerField(options.stories);
    this.arcs = new ArcNetwork(options.stories);
    this.cards = new StoryCardProjector({
      camera: this.camera,
      canvas: this.canvas,
      cardPool: options.cardPool,
    });
    this.interaction = new GlobeInteraction({
      canvas: this.canvas,
      pivot: this.pivot,
      prefersReducedMotion: options.prefersReducedMotion,
    });

    this.pivot.add(this.arcs.group);
    this.pivot.add(this.markers.group);
    this.pivot.add(this.cards.group);

    this.resize();
    window.addEventListener("resize", this.resize);
    this.canvas.addEventListener("click", this.handleClick);
    document.addEventListener("focusin", this.handleFocusChange, true);
    document.addEventListener("focusout", this.handleFocusChange, true);
    document.addEventListener("keydown", this.handleKeyDown, true);
  }

  start() {
    this.animate(this.lastTimestamp);
  }

  revealStory(story: Story) {
    const now = performance.now();
    this.markers.reveal(story.id, now);
    this.arcs.revealStory(story.id, now);

    if (this.interaction.isInteracting === false) {
      this.interaction.focusOn(latLngToVector3(story.location.lat, story.location.lng, 1));
    }
  }

  private readonly handleClick = (event: MouseEvent) => {
    logEvent("scene handleClick entry", event, {
      activeElement:
        document.activeElement instanceof Element
          ? document.activeElement.tagName.toLowerCase()
          : "none",
      cardOpen: this.cards.isOpen,
    });

    if (this.cards.contains(event.target as Element | null)) {
      logDebug("scene click ignored because target is inside active card");
      return;
    }

    if (this.interaction.consumeClickSuppression()) {
      logDebug("scene click suppressed due to drag threshold");
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const pointer = new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const story = this.markers.pick(pointer, this.camera);

    if (story === null) {
      logDebug("scene click hit no marker; closing active card");
      this.cards.close();
      this.syncPauseState();
      return;
    }

    const anchor = this.markers.getAnchor(story.id);

    if (anchor === null) {
      return;
    }

    this.cards.toggle(story, anchor);
    logDebug("scene toggled story card", {
      storyId: story.id,
      title: story.title,
    });
    this.interaction.focusOn(anchor.clone().normalize());
    this.syncPauseState();
  };

  private readonly resize = () => {
    const { clientWidth, clientHeight } = this.canvas;

    if (clientWidth === 0 || clientHeight === 0) {
      return;
    }

    this.renderer.setSize(clientWidth, clientHeight, false);
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
  };

  private readonly handleFocusChange = () => {
    window.setTimeout(() => {
      this.syncPauseState();
    }, 0);
  };

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || this.cards.isOpen === false) {
      return;
    }

    logEvent("scene handleKeyDown escape", event, {
      cardOpen: this.cards.isOpen,
    });
    this.cards.close();
    this.syncPauseState();
  };

  private syncPauseState() {
    const activeElement = document.activeElement;
    const isFocusInsideCard = this.cards.contains(activeElement);
    this.interaction.setPausedForFocus(this.cards.isOpen || isFocusInsideCard);
  }

  private readonly animate = (timestamp: number) => {
    const delta = Math.min((timestamp - this.lastTimestamp) / 1000, 1 / 20);
    this.lastTimestamp = timestamp;

    this.interaction.update(delta);
    this.markers.update(timestamp);
    this.arcs.update(timestamp);
    this.cards.update(timestamp);
    this.renderer.render(this.scene, this.camera);

    window.requestAnimationFrame(this.animate);
  };
}

function createStars() {
  const geometry = new BufferGeometry();
  const positions: number[] = [];

  for (let index = 0; index < 900; index += 1) {
    const radius = 6 + Math.random() * 10;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    );
  }

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));

  return new Points(
    geometry,
    new PointsMaterial({
      color: new Color("#d7f6ff"),
      size: 0.03,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    }),
  );
}

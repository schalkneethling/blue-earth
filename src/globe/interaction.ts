import type { Group, Vector3 } from "three";

import { clampTilt, dampAngle, surfaceNormalToRotation, wrapAngle } from "./helpers";

const ROTATION_SPEED = 0.0012;
const DRAG_SENSITIVITY = 0.0036;
const INERTIA_DECAY = 8.4;
const FOCUS_EASING = 5.6;

export class GlobeInteraction {
  private readonly canvas: HTMLCanvasElement;
  private readonly pivot: Group;
  private readonly prefersReducedMotion: boolean;
  private pointerId: number | null = null;
  private isDraggingPointer = false;
  private dragDistance = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private velocityX = 0;
  private velocityY = 0;
  private suppressClick = false;
  private focusTarget: { x: number; y: number } | null = null;
  private isPausedForFocus = false;

  constructor(options: { canvas: HTMLCanvasElement; pivot: Group; prefersReducedMotion: boolean }) {
    this.canvas = options.canvas;
    this.pivot = options.pivot;
    this.prefersReducedMotion = options.prefersReducedMotion;

    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointercancel", this.handlePointerUp);
  }

  get isInteracting() {
    return this.isDraggingPointer;
  }

  consumeClickSuppression() {
    const current = this.suppressClick;
    this.suppressClick = false;
    return current;
  }

  focusOn(normal: Vector3) {
    if (this.isDraggingPointer || this.isPausedForFocus) {
      return;
    }

    this.focusTarget = surfaceNormalToRotation(normal);
  }

  setPausedForFocus(isPaused: boolean) {
    this.isPausedForFocus = isPaused;

    if (isPaused) {
      this.focusTarget = null;
      this.velocityX = 0;
      this.velocityY = 0;
    }
  }

  update(delta: number) {
    if (this.isDraggingPointer) {
      return;
    }

    if (this.focusTarget !== null) {
      this.pivot.rotation.x +=
        (this.focusTarget.x - this.pivot.rotation.x) * (1 - Math.exp(-FOCUS_EASING * delta));
      this.pivot.rotation.y = dampAngle(
        this.pivot.rotation.y,
        this.focusTarget.y,
        FOCUS_EASING,
        delta,
      );

      if (
        Math.abs(this.pivot.rotation.x - this.focusTarget.x) < 0.002 &&
        Math.abs(wrapAngle(this.pivot.rotation.y - this.focusTarget.y)) < 0.002
      ) {
        this.focusTarget = null;
      }
    }

    this.pivot.rotation.x = clampTilt(this.pivot.rotation.x + this.velocityY * delta);
    this.pivot.rotation.y = wrapAngle(this.pivot.rotation.y + this.velocityX * delta);
    this.velocityX *= Math.exp(-INERTIA_DECAY * delta);
    this.velocityY *= Math.exp(-INERTIA_DECAY * delta);

    if (
      this.prefersReducedMotion === false &&
      this.focusTarget === null &&
      this.isPausedForFocus === false
    ) {
      this.pivot.rotation.y = wrapAngle(this.pivot.rotation.y + ROTATION_SPEED);
    }
  }

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (event.target !== this.canvas) {
      return;
    }

    this.pointerId = event.pointerId;
    this.isDraggingPointer = true;
    this.dragDistance = 0;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.velocityX = 0;
    this.velocityY = 0;
    this.focusTarget = null;
    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (this.isDraggingPointer === false || event.pointerId !== this.pointerId) {
      return;
    }

    const deltaX = event.clientX - this.lastPointerX;
    const deltaY = event.clientY - this.lastPointerY;

    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.dragDistance += Math.abs(deltaX) + Math.abs(deltaY);

    this.pivot.rotation.y = wrapAngle(this.pivot.rotation.y + deltaX * DRAG_SENSITIVITY * -1);
    this.pivot.rotation.x = clampTilt(this.pivot.rotation.x + deltaY * DRAG_SENSITIVITY * -1);
    this.velocityX = deltaX * DRAG_SENSITIVITY * -18;
    this.velocityY = deltaY * DRAG_SENSITIVITY * -18;
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId) {
      return;
    }

    this.isDraggingPointer = false;
    this.pointerId = null;
    this.suppressClick = this.dragDistance > 8;

    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
  };
}

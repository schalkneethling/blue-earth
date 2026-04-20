import { Euler, MathUtils, Quaternion, Vector3 } from "three";

export const GLOBE_RADIUS = 1;
export const MARKER_RADIUS = 0.014;
export const CARD_WIDTH_PX = 280;
export const CARD_HEIGHT_PX = 192;
export const CARD_WORLD_WIDTH = 0.58;
export const CARD_WORLD_HEIGHT = (CARD_HEIGHT_PX / CARD_WIDTH_PX) * CARD_WORLD_WIDTH;
export const MAX_TILT = MathUtils.degToRad(70);

const FRONT_VECTOR = new Vector3(0, 0, 1);

export function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  return new Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

export function clampTilt(value: number) {
  return MathUtils.clamp(value, -MAX_TILT, MAX_TILT);
}

export function wrapAngle(angle: number) {
  const turn = Math.PI * 2;
  return ((((angle + Math.PI) % turn) + turn) % turn) - Math.PI;
}

export function dampAngle(current: number, target: number, easing: number, delta: number) {
  const shortest = wrapAngle(target - current);
  return current + shortest * (1 - Math.exp(-easing * delta));
}

export function surfaceNormalToRotation(normal: Vector3) {
  const quaternion = new Quaternion().setFromUnitVectors(normal.clone().normalize(), FRONT_VECTOR);
  const rotation = new Euler().setFromQuaternion(quaternion, "YXZ");

  return {
    x: clampTilt(rotation.x),
    y: wrapAngle(rotation.y),
  };
}

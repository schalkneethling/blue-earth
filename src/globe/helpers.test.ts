import { describe, expect, test } from "vite-plus/test";

import { latLngToVector3, wrapAngle } from "./helpers";

describe("globe helpers", () => {
  test("latLngToVector3 keeps points on the sphere radius", () => {
    const point = latLngToVector3(-33.9249, 18.4241, 1.25);

    expect(point.length()).toBeCloseTo(1.25, 5);
  });

  test("wrapAngle keeps radians in the principal range", () => {
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(-Math.PI, 8);
    expect(wrapAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI, 8);
  });
});

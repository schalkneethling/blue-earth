import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshPhongMaterial,
  SRGBColorSpace,
  SphereGeometry,
  TextureLoader,
  Vector3,
} from "three";

import earthNightLightsUrl from "../assets/earth-night-lights.jpg";

export function createEarth(radius: number) {
  const group = new Group();
  const geometry = new SphereGeometry(radius, 96, 96);
  const texture = loadEarthTexture();

  const earth = new Mesh(
    geometry,
    new MeshPhongMaterial({
      map: texture,
      color: new Color("#8da8b3"),
      emissive: new Color("#1bd4c0"),
      emissiveMap: texture,
      emissiveIntensity: 0.2,
      shininess: 14,
      specular: new Color("#0d5050"),
    }),
  );

  const atmosphere = new Mesh(
    new SphereGeometry(radius * 1.025, 96, 96),
    new MeshPhongMaterial({
      color: new Color("#41f2e8"),
      transparent: true,
      opacity: 0.11,
      side: BackSide,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );

  group.add(earth, atmosphere, createGraticule(radius * 1.002));

  return group;
}

function loadEarthTexture() {
  const loader = new TextureLoader();
  const texture = loader.load(earthNightLightsUrl);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;

  return texture;
}

function createGraticule(radius: number) {
  const vertices: number[] = [];

  for (let lat = -60; lat <= 60; lat += 15) {
    for (let step = 0; step < 360; step += 4) {
      const point = fromLatLng(lat, step - 180, radius);
      const next = fromLatLng(lat, step - 176, radius);
      vertices.push(point.x, point.y, point.z, next.x, next.y, next.z);
    }
  }

  for (let lng = -165; lng <= 180; lng += 15) {
    for (let step = -88; step <= 88; step += 4) {
      const point = fromLatLng(step, lng, radius);
      const next = fromLatLng(step + 4, lng, radius);
      vertices.push(point.x, point.y, point.z, next.x, next.y, next.z);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));

  return new LineSegments(
    geometry,
    new LineBasicMaterial({
      color: new Color("#5cbab3"),
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    }),
  );
}

function fromLatLng(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  return new Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

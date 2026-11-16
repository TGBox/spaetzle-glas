import { describe, expect, it } from "vitest";
import {
  TILE_SIZE,
  computeVisibleTiles,
  fitMapView,
  placeToViewportPixel,
  projectToWorldPixels,
} from "../src/ui/mapCard";
import type { MapPlace } from "../src/types/advent";

function place(name: string, latitude: number, longitude: number): MapPlace {
  return { name, latitude, longitude, photos: ["./photos/x.jpg"] };
}

describe("projectToWorldPixels", () => {
  it("maps the equator / prime meridian to the middle of the world", () => {
    const point = projectToWorldPixels(0, 0, 3);
    expect(point.x).toBeCloseTo((TILE_SIZE * 8) / 2, 6);
    expect(point.y).toBeCloseTo((TILE_SIZE * 8) / 2, 6);
  });

  it("puts northern and eastern places up and to the right", () => {
    const stuttgart = projectToWorldPixels(48.7758, 9.1829, 6);
    const hamburg = projectToWorldPixels(53.5511, 9.9937, 6);
    expect(hamburg.y).toBeLessThan(stuttgart.y);
    expect(hamburg.x).toBeGreaterThan(stuttgart.x);
  });
});

describe("fitMapView", () => {
  const places = [
    place("Stuttgart", 48.7758, 9.1829),
    place("Bodensee", 47.6603, 9.1758),
    place("Hamburg", 53.5511, 9.9937),
  ];

  it("keeps every pin inside the padded viewport", () => {
    const width = 340;
    const height = 300;
    const view = fitMapView(places, width, height, 44);

    for (const entry of places) {
      const pixel = placeToViewportPixel(entry, view, width, height);
      expect(pixel.left).toBeGreaterThanOrEqual(44 - 0.001);
      expect(pixel.left).toBeLessThanOrEqual(width - 44 + 0.001);
      expect(pixel.top).toBeGreaterThanOrEqual(44 - 0.001);
      expect(pixel.top).toBeLessThanOrEqual(height - 44 + 0.001);
    }
  });

  it("zooms in further for nearby places than for distant ones", () => {
    const near = fitMapView(places.slice(0, 2), 340, 300);
    const far = fitMapView(
      [...places, place("Lissabon", 38.7223, -9.1393)],
      340,
      300
    );
    expect(near.zoom).toBeGreaterThan(far.zoom);
  });

  it("centers a single place", () => {
    const view = fitMapView([places[0]], 340, 300);
    const pixel = placeToViewportPixel(places[0], view, 340, 300);
    expect(pixel.left).toBeCloseTo(170, 6);
    expect(pixel.top).toBeCloseTo(150, 6);
  });
});

describe("computeVisibleTiles", () => {
  it("covers the whole viewport with valid tile coordinates", () => {
    const view = fitMapView([place("Stuttgart", 48.7758, 9.1829)], 340, 300);
    const tiles = computeVisibleTiles(view, 340, 300);
    const tilesPerAxis = 2 ** view.zoom;

    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.x).toBeLessThan(tilesPerAxis);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeLessThan(tilesPerAxis);
    }

    const minLeft = Math.min(...tiles.map((tile) => tile.left));
    const maxRight = Math.max(...tiles.map((tile) => tile.left + TILE_SIZE));
    const minTop = Math.min(...tiles.map((tile) => tile.top));
    const maxBottom = Math.max(...tiles.map((tile) => tile.top + TILE_SIZE));
    expect(minLeft).toBeLessThanOrEqual(0);
    expect(maxRight).toBeGreaterThanOrEqual(340);
    expect(minTop).toBeLessThanOrEqual(0);
    expect(maxBottom).toBeGreaterThanOrEqual(300);
  });
});

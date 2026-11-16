import type { MapPlace } from "../types/advent";

/** Standard slippy-map tile edge length in CSS pixels. */
export const TILE_SIZE = 256;
const MAX_ZOOM = 12;
const MIN_ZOOM = 1;
const MAX_MERCATOR_LATITUDE = 85.05112878;

export interface MapView {
  readonly zoom: number;
  /** Center in world pixels at `zoom` (Web Mercator, origin top-left). */
  readonly centerX: number;
  readonly centerY: number;
}

export interface TilePlacement {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  /** Position of the tile's top-left corner inside the viewport, in CSS pixels. */
  readonly left: number;
  readonly top: number;
}

/**
 * Projects a WGS84 coordinate to Web Mercator world pixels at the given zoom.
 */
export function projectToWorldPixels(
  latitude: number,
  longitude: number,
  zoom: number
): { x: number; y: number } {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const clampedLat = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, latitude)
  );
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * worldSize,
    y:
      (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldSize,
  };
}

/**
 * Picks the closest zoom at which all places fit into the viewport with padding,
 * centered on their bounding box.
 */
export function fitMapView(
  places: readonly MapPlace[],
  width: number,
  height: number,
  padding = 44
): MapView {
  if (places.length === 0) {
    return { zoom: MIN_ZOOM, centerX: TILE_SIZE, centerY: TILE_SIZE };
  }

  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);

  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom--) {
    const points = places.map((place) =>
      projectToWorldPixels(place.latitude, place.longitude, zoom)
    );
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    if (
      zoom === MIN_ZOOM ||
      (maxX - minX <= usableWidth && maxY - minY <= usableHeight)
    ) {
      return {
        zoom,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
      };
    }
  }

  return { zoom: MIN_ZOOM, centerX: TILE_SIZE, centerY: TILE_SIZE };
}

/**
 * Converts a place to its pixel position inside the viewport.
 */
export function placeToViewportPixel(
  place: MapPlace,
  view: MapView,
  width: number,
  height: number
): { left: number; top: number } {
  const point = projectToWorldPixels(place.latitude, place.longitude, view.zoom);
  return {
    left: point.x - view.centerX + width / 2,
    top: point.y - view.centerY + height / 2,
  };
}

/**
 * Lists the tiles needed to cover the viewport, wrapping around the date line
 * and skipping rows beyond the poles.
 */
export function computeVisibleTiles(
  view: MapView,
  width: number,
  height: number
): TilePlacement[] {
  const tilesPerAxis = 2 ** view.zoom;
  const originX = view.centerX - width / 2;
  const originY = view.centerY - height / 2;

  const firstColumn = Math.floor(originX / TILE_SIZE);
  const lastColumn = Math.floor((originX + width - 1) / TILE_SIZE);
  const firstRow = Math.floor(originY / TILE_SIZE);
  const lastRow = Math.floor((originY + height - 1) / TILE_SIZE);

  const tiles: TilePlacement[] = [];
  for (let row = firstRow; row <= lastRow; row++) {
    if (row < 0 || row >= tilesPerAxis) {
      continue;
    }
    for (let column = firstColumn; column <= lastColumn; column++) {
      const wrappedColumn =
        ((column % tilesPerAxis) + tilesPerAxis) % tilesPerAxis;
      tiles.push({
        x: wrappedColumn,
        y: row,
        zoom: view.zoom,
        left: column * TILE_SIZE - originX,
        top: row * TILE_SIZE - originY,
      });
    }
  }
  return tiles;
}

/**
 * URL of an OpenStreetMap standard tile. Requires the visible "© OpenStreetMap" credit.
 */
export function tileUrl(tile: TilePlacement): string {
  return `https://tile.openstreetmap.org/${tile.zoom}/${tile.x}/${tile.y}.png`;
}

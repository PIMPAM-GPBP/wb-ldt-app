/**
 * Small, static SVG outlines of a country's units, for the home page's small multiples.
 * The countries are small enough for a flat projection (longitude scaled by the cosine of the
 * middle latitude), which also ignores ring winding, unlike d3's spherical paths. Rings are
 * rounded to whole units, simplified with Ramer-Douglas-Peucker, and written as relative path
 * commands, which keeps three countries' outlines to tens of kilobytes.
 */

type Position = [number, number];
type Ring = Position[];
type Geometry = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
export type BoundaryCollection = { features: Array<{ properties: { compositeKey?: string } | null; geometry: Geometry | null }> };

export type OutlineMap = { width: number; height: number; units: Array<{ compositeKey: string; d: string }> };

function polygonsOf(geometry: Geometry): Ring[][] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

/** Iterative Ramer-Douglas-Peucker: keeps the points that bend the line by more than epsilon. */
export function simplifyRing(points: readonly Position[], epsilon: number): Position[] {
  if (points.length <= 3) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    const [ax, ay] = points[start];
    const [bx, by] = points[end];
    const length = Math.hypot(bx - ax, by - ay);
    let farthest = -1;
    let distance = epsilon;
    for (let index = start + 1; index < end; index += 1) {
      const [px, py] = points[index];
      const d = length === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
      if (d > distance) {
        distance = d;
        farthest = index;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = 1;
      stack.push([start, farthest], [farthest, end]);
    }
  }
  return points.filter((_, index) => keep[index] === 1);
}

/** One closed ring as "M x,y l dx,dy dx,dy … z", skipping steps that round to nothing. */
function ringPath(points: readonly Position[]): string {
  let path = `M${points[0][0]},${points[0][1]}l`;
  let [x, y] = points[0];
  for (let index = 1; index < points.length; index += 1) {
    const [px, py] = points[index];
    if (px === x && py === y) continue;
    path += `${px - x},${py - y} `;
    x = px;
    y = py;
  }
  return `${path.trimEnd()}z`;
}

/** Fits the collection into a width by height box and returns one path per unit. */
export function buildOutlineMap(collection: BoundaryCollection, width: number, height: number, epsilon = 0.8): OutlineMap {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const feature of collection.features) {
    if (!feature.geometry) continue;
    for (const polygon of polygonsOf(feature.geometry)) {
      for (const [x, y] of polygon[0] ?? []) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const cos = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const scale = Math.min(width / ((maxX - minX) * cos), height / (maxY - minY));
  const project = ([x, y]: Position): Position => [Math.round((x - minX) * cos * scale), Math.round((maxY - y) * scale)];

  const units = collection.features.flatMap((feature) => {
    const compositeKey = feature.properties?.compositeKey;
    if (!compositeKey || !feature.geometry) return [];
    const d = polygonsOf(feature.geometry)
      .flatMap((polygon) => polygon.map((ring) => simplifyRing(ring.map(project), epsilon)))
      .filter((ring) => ring.length >= 3)
      .map(ringPath)
      .join("");
    return d ? [{ compositeKey, d }] : [];
  });
  return { width: Math.round((maxX - minX) * cos * scale), height: Math.round((maxY - minY) * scale), units };
}

/**
 * Flood extent geometry.
 *
 * The hazard overlay used to be three concentric rectangles - a bounding box
 * scaled three times. Water doesn't do that: it spreads along the lowest
 * ground it can find, so a real inundation footprint is a lobed, elongated
 * blob whose edge advances unevenly as the storm builds.
 *
 * These extents are generated from a sum of sinusoids rather than a random
 * number generator. That matters for two reasons: the ring closes seamlessly
 * (every frequency is an integer multiple of the sweep), and the shape is
 * deterministic for a given ward, so panning or re-running an analysis does
 * not reshuffle the hazard map under the user. Advancing `phase` walks the
 * same shape forward continuously, which is what animates the flood front.
 */

const TWO_PI = Math.PI * 2;
const RING_POINTS = 72;

/**
 * Smooth periodic deformation in [-1, 1]-ish. Integer frequencies keep the
 * ring closed; the seed decorrelates one ward's shape from another's.
 */
function lobe(theta, seed, phase) {
  return (
    0.52 * Math.sin(theta * 2 + seed * 1.7 + phase) +
    0.28 * Math.sin(theta * 3 + seed * 3.1 - phase * 0.62) +
    0.17 * Math.sin(theta * 5 + seed * 5.3 + phase * 0.38) +
    0.09 * Math.sin(theta * 7 + seed * 2.2 - phase * 0.81)
  );
}

/** Stable small integer seed from the ward name, so each city floods differently. */
export function seedFromName(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h * 31 + name.charCodeAt(i)) % 9973;
  }
  return (h % 100) / 10; // 0.0 – 9.9
}

/**
 * One closed GeoJSON ring: an irregular lobed blob around (centerLon, centerLat).
 *
 * `anisotropy` stretches the footprint along one axis - inundation pools along
 * a drainage line rather than spreading as a disc.
 */
export function makeExtentRing({
  centerLon,
  centerLat,
  radiusLon,
  radiusLat,
  seed = 0,
  phase = 0,
  roughness = 0.2,
  anisotropy = 1.25,
  tilt = 0.6,
}) {
  const ring = [];
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);

  for (let i = 0; i <= RING_POINTS; i += 1) {
    const theta = (i % RING_POINTS) * (TWO_PI / RING_POINTS);
    const deform = 1 + roughness * lobe(theta, seed, phase);

    // Elongate in the local frame, then rotate the whole footprint by `tilt`.
    const ux = Math.cos(theta) * anisotropy;
    const uy = Math.sin(theta) / anisotropy;

    const rx = ux * cosT - uy * sinT;
    const ry = ux * sinT + uy * cosT;

    ring.push([
      centerLon + rx * radiusLon * deform,
      centerLat + ry * radiusLat * deform,
    ]);
  }

  return [ring];
}

/**
 * The depth bands, outermost first.
 *
 * Read as a density surface rather than five shapes: many overlapping
 * translucent fills, blurred at the pane level, so the ramp is continuous.
 *
 * `growth` is the exponent applied to the storm scale. Shallow sheet flow
 * spreads readily as rainfall rises (exponent < 1), while deep water is
 * limited by how much low ground there is to pool in, so the core grows late
 * and slowly (exponent > 1). Without this every band expanded by the same
 * factor and the red core swallowed the map at high rainfall.
 *
 * `drift` is the band's own share of the animation clock, so the bands
 * advance at different rates instead of pulsing in lockstep.
 */
export const HAZARD_BANDS = [
  {
    key: "trace",
    scale: 1.0,
    growth: 0.8,
    drift: 1.0,
    fill: "#4ADE80",
    stroke: "#22C55E",
    opacity: 0.26,
    roughness: 0.11,
    depth: 0.16,
    label: "Trace surface water",
  },
  {
    key: "sheet",
    scale: 0.87,
    growth: 0.86,
    drift: 0.83,
    fill: "#A3E635",
    stroke: "#84CC16",
    opacity: 0.28,
    roughness: 0.12,
    depth: 0.26,
    label: "Shallow sheet flow",
  },
  {
    key: "shallow",
    scale: 0.75,
    growth: 0.94,
    drift: 1.21,
    fill: "#FACC15",
    stroke: "#EAB308",
    opacity: 0.3,
    roughness: 0.13,
    depth: 0.38,
    label: "Minor waterlogging",
  },
  {
    key: "minor",
    scale: 0.64,
    growth: 1.04,
    drift: 0.68,
    fill: "#FBBF24",
    stroke: "#F59E0B",
    opacity: 0.32,
    roughness: 0.13,
    depth: 0.5,
    label: "Ponding on carriageway",
  },
  {
    key: "moderate",
    scale: 0.54,
    growth: 1.16,
    drift: 1.37,
    fill: "#FB923C",
    stroke: "#F97316",
    opacity: 0.34,
    roughness: 0.14,
    depth: 0.66,
    label: "Moderate inundation",
  },
  {
    key: "deep",
    scale: 0.45,
    growth: 1.3,
    drift: 0.91,
    fill: "#F97316",
    stroke: "#EA580C",
    opacity: 0.36,
    roughness: 0.14,
    depth: 0.8,
    label: "Deep inundation",
  },
  {
    key: "severe",
    scale: 0.35,
    growth: 1.46,
    drift: 1.13,
    fill: "#EF4444",
    stroke: "#DC2626",
    opacity: 0.4,
    roughness: 0.13,
    depth: 0.92,
    label: "Severe inundation",
  },
  {
    key: "critical",
    scale: 0.25,
    growth: 1.64,
    drift: 0.76,
    fill: "#DC2626",
    stroke: "#B91C1C",
    opacity: 0.46,
    roughness: 0.12,
    depth: 1.0,
    label: "Critical hazard",
  },
];

/** Mitigated bands - the same footprint, drained and re-read as green infrastructure. */
export const MITIGATED_BANDS = [
  {
    key: "catchment",
    scale: 1.0,
    growth: 0.84,
    drift: 1.0,
    fill: "#6EE7B7",
    stroke: "#34D399",
    opacity: 0.26,
    roughness: 0.11,
    depth: 0.3,
    label: "Managed catchment",
  },
  {
    key: "buffer",
    scale: 0.78,
    growth: 0.96,
    drift: 1.24,
    fill: "#34D399",
    stroke: "#10B981",
    opacity: 0.3,
    roughness: 0.12,
    depth: 0.24,
    label: "Green infrastructure buffer",
  },
  {
    key: "swale",
    scale: 0.56,
    growth: 1.14,
    drift: 0.72,
    fill: "#10B981",
    stroke: "#059669",
    opacity: 0.35,
    roughness: 0.13,
    depth: 0.18,
    label: "Infiltration swale network",
  },
  {
    key: "core",
    scale: 0.35,
    growth: 1.36,
    drift: 1.09,
    fill: "#059669",
    stroke: "#047857",
    opacity: 0.42,
    roughness: 0.13,
    depth: 0.12,
    label: "Retention and storage core",
  },
];

/**
 * Secondary pooling basins.
 *
 * A catchment does not have one hot centre. Water collects in every local
 * depression, so deep water shows up as several detached pockets - an
 * underpass, a tank bed, a blocked culvert - not as a single bullseye. These
 * are the off-centre pockets, placed deterministically from the ward seed so
 * a given ward always floods in the same places.
 *
 * They surface progressively: at low rainfall only the main core is wet, and
 * each additional pocket appears as the storm passes its own threshold.
 */
export function makeSecondaryBasins({ seed = 0, count = 4 }) {
  const basins = [];
  for (let i = 0; i < count; i += 1) {
    // Golden-angle placement keeps the pockets from clumping on one side.
    const angle = (i * 2.39996 + seed * 0.7) % TWO_PI;
    const distance = 0.34 + (((seed * 7 + i * 13) % 10) / 10) * 0.42; // 0.34 – 0.76 of the extent
    basins.push({
      key: `basin-${i}`,
      angle,
      distance,
      // Each pocket is a fraction of the main footprint.
      size: 0.16 + (((seed * 3 + i * 7) % 10) / 10) * 0.16, // 0.16 – 0.32
      // The storm level at which this depression starts to hold water.
      threshold: 0.3 + i * 0.13,
      seed: seed + 11.3 + i * 2.7,
      drift: 0.7 + ((seed + i * 5) % 8) / 10, // 0.7 – 1.4
    });
  }
  return basins;
}

/** The depth bands drawn inside a secondary pocket, hottest first. */
export const BASIN_BANDS = [
  {
    key: "pool",
    scale: 1.0,
    fill: "#FB923C",
    stroke: "#F97316",
    opacity: 0.3,
    roughness: 0.2,
    depth: 0.62,
  },
  {
    key: "deep",
    scale: 0.68,
    fill: "#EF4444",
    stroke: "#DC2626",
    opacity: 0.36,
    roughness: 0.18,
    depth: 0.86,
  },
  {
    key: "centre",
    scale: 0.38,
    fill: "#DC2626",
    stroke: "#B91C1C",
    opacity: 0.44,
    roughness: 0.16,
    depth: 1.0,
  },
];

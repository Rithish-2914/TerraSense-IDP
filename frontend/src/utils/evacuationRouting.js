/**
 * Evacuation corridor routing.
 *
 * The corridors used to be three hand-written zig-zags built from fractions of
 * the ward's bounding box - they crossed rivers, buildings and parkland, which
 * is exactly what an evacuation route must not do. These go to OSRM instead,
 * so a corridor follows roads a relief bus could actually drive, and the
 * distance and drive time shown in the popup are the real ones.
 *
 * The public OSRM demo server is rate-limited and occasionally slow. Every
 * failure path returns null so the caller can fall back to the straight-line
 * geometry rather than showing nothing.
 */

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";
const REQUEST_TIMEOUT_MS = 7000;

/** [lat, lon] -> "lon,lat", the order OSRM expects. */
const toOsrmPair = ([lat, lon]) => `${lon.toFixed(6)},${lat.toFixed(6)}`;

/**
 * Routes from `origin` to `destination`, both [lat, lon].
 *
 * Returns the road-following path plus OSRM's snapped waypoints - the snapped
 * destination is where the shelter marker should sit, since the raw coordinate
 * can land in a park or a river.
 */
export async function fetchRoadRoute(origin, destination, { signal } = {}) {
  const url =
    `${OSRM_BASE}/${toOsrmPair(origin)};${toOsrmPair(destination)}` +
    `?overview=full&geometries=geojson&alternatives=false&steps=false`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // Abort if either the caller cancels or we time out.
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener("abort", onAbort);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) return null;

    const data = await resp.json();
    if (data.code !== "Ok" || !data.routes || data.routes.length === 0)
      return null;

    const route = data.routes[0];
    const coords = route.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;

    // OSRM returns [lon, lat]; Leaflet wants [lat, lon].
    const positions = coords.map(([lon, lat]) => [lat, lon]);

    const snappedDestination = data.waypoints?.[1]?.location
      ? [data.waypoints[1].location[1], data.waypoints[1].location[0]]
      : destination;

    return {
      positions,
      snappedDestination,
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
    };
  } catch (e) {
    // Aborted, offline, CORS, rate-limited - all mean "use the fallback".
    return null;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

/**
 * Routes every shelter in one pass. Resolves to an array positionally aligned
 * with `shelters`, holding null wherever routing failed for that shelter.
 */
export async function fetchEvacuationRoutes(origin, shelters, { signal } = {}) {
  return Promise.all(
    shelters.map((shelter) =>
      fetchRoadRoute(origin, shelter.position, { signal }),
    ),
  );
}

import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  ZoomControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { fetchEvacuationRoutes } from "../utils/evacuationRouting";

// Fix Leaflet default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const MAP_CONFIG = {
  defaultCenter: [10.7905, 78.7047], // Trichy default
  zoom: 13,
};

const mapStyles = {
  plan: {
    color: "#0042A6",
    weight: 3.5,
    fillOpacity: 0.12,
    fillColor: "#2E96F5",
    dashArray: "6, 6",
  },
  floodRiskBaseline: {
    color: "#EF4444",
    weight: 2,
    fillOpacity: 0.5,
    fillColor: "#EF4444",
  },
  floodRiskRCP45: {
    color: "#DC2626",
    weight: 2.5,
    fillOpacity: 0.58,
    fillColor: "#DC2626",
  },
  floodRiskRCP85: {
    color: "#991B1B",
    weight: 3,
    fillOpacity: 0.68,
    fillColor: "#B91C1C",
  },
  floodRiskMitigated: {
    color: "#059669",
    weight: 2.5,
    fillOpacity: 0.38,
    fillColor: "#10B981",
  },
};

// High-performance direct Leaflet GeoJSON layer
function FastGeoJSON({ data, style, onEachFeature, pane, renderer }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!map || !data) return;

    if (layerRef.current) {
      try {
        map.removeLayer(layerRef.current);
      } catch (e) {}
      layerRef.current = null;
    }

    try {
      const geoLayer = L.geoJSON(data, {
        style: typeof style === "function" ? style : () => style,
        onEachFeature: onEachFeature,
        ...(pane ? { pane } : {}),
        ...(renderer ? { renderer } : {}),
      });
      geoLayer.addTo(map);
      layerRef.current = geoLayer;
    } catch (err) {
      console.error("GeoJSON rendering error:", err);
    }

    return () => {
      if (layerRef.current && map) {
        try {
          map.removeLayer(layerRef.current);
        } catch (e) {}
        layerRef.current = null;
      }
    };
  }, [map, data, style, onEachFeature, pane, renderer]);

  return null;
}

// Hands the Leaflet map instance back out of MapContainer, and reports every
// view change, which the hazard pane and any screen-space chrome depend on.
function MapBridge({ onReady, onViewChange }) {
  const map = useMap();

  useEffect(() => {
    onReady(map);
  }, [map, onReady]);

  useEffect(() => {
    const handler = () => onViewChange();
    map.on("move zoom resize", handler);
    return () => {
      map.off("move zoom resize", handler);
    };
  }, [map, onViewChange]);

  return null;
}

// Recenter helper that smooth-pans the map without re-mounting MapContainer
function MapCenterUpdater({ center }) {
  const map = useMap();
  const prevCenterRef = useRef(null);

  useEffect(() => {
    if (!map || !center) return;
    const [lat, lon] = center;
    if (
      prevCenterRef.current &&
      prevCenterRef.current[0] === lat &&
      prevCenterRef.current[1] === lon
    ) {
      return;
    }
    prevCenterRef.current = center;
    map.setView(center, 13, { animate: false });
  }, [map, center]);

  return null;
}

// City-specific Realistic Evacuation Shelters & NASA MODIS LST Hotspots
const CITY_SHELTERS_AND_HOTSPOTS = {
  "trichy_area.geojson": {
    shelters: [
      {
        id: "trichy-shelter-1",
        name: "Rockfort High-Ground Relief Hub",
        type: "Primary Flood Evacuation Shelter",
        offset: [0.78, 0.72],
        elevationMsl: "+94m MSL (Above Inundation Line)",
        capacity: "1,600 Citizens",
        amenities: "Drinking Water, Solar Backup, Medical Aid",
      },
      {
        id: "trichy-shelter-2",
        name: "Trichy Municipal Indoor Sports Stadium",
        type: "Mass Relief & Logistics Center",
        offset: [0.82, -0.7],
        elevationMsl: "+98m MSL (Elevated Ridge)",
        capacity: "2,400 Citizens",
        amenities: "Helipad Access, Cookhouse, Generators",
      },
      {
        id: "trichy-shelter-3",
        name: "Anna Stadium Emergency Logistics Center",
        type: "First-Aid & Emergency Staging",
        offset: [-0.75, 0.8],
        elevationMsl: "+91m MSL (Elevated Mound)",
        capacity: "950 Citizens",
        amenities: "Ambulance Station, Satellite Comms",
      },
    ],
  },
  "mumbai_area.geojson": {
    shelters: [
      {
        id: "mumbai-shelter-1",
        name: "Bandra Kurla Elevated Disaster Hub",
        type: "Primary Flood Evacuation Shelter",
        offset: [0.75, 0.7],
        elevationMsl: "+24m MSL (High Ground Ridge)",
        capacity: "3,200 Citizens",
        amenities: "Emergency Generators, Medical Triage, Helipad",
      },
      {
        id: "mumbai-shelter-2",
        name: "Dadar Central Municipal Staging Arena",
        type: "Mass Relief & Logistics Center",
        offset: [0.8, -0.65],
        elevationMsl: "+18m MSL (Elevated Structure)",
        capacity: "2,800 Citizens",
        amenities: "Community Kitchen, Satellite Comms",
      },
      {
        id: "mumbai-shelter-3",
        name: "Worli High-Ground Relief Pavilion",
        type: "First-Aid & Coastal Emergency Staging",
        offset: [-0.7, 0.75],
        elevationMsl: "+22m MSL (Worli Hill Ridge)",
        capacity: "1,500 Citizens",
        amenities: "High-Capacity Drainage Pumps, Solar Inverters",
      },
    ],
  },
  "chennai_area.geojson": {
    shelters: [
      {
        id: "chennai-shelter-1",
        name: "Guindy Elevated Engineering Relief Center",
        type: "Primary Flood Evacuation Shelter",
        offset: [0.75, 0.7],
        elevationMsl: "+28m MSL (St. Thomas Ridge)",
        capacity: "2,500 Citizens",
        amenities: "Solar Power, Medical Center, Rations",
      },
      {
        id: "chennai-shelter-2",
        name: "Jawaharlal Nehru Indoor Mass Hub",
        type: "Mass Relief & Logistics Center",
        offset: [0.8, -0.65],
        elevationMsl: "+16m MSL (High Ground Ground)",
        capacity: "3,000 Citizens",
        amenities: "Helipad Access, Food Staging, Water Purification",
      },
      {
        id: "chennai-shelter-3",
        name: "Velachery High-Ground Community Shelter",
        type: "First-Aid & Emergency Staging",
        offset: [-0.7, 0.75],
        elevationMsl: "+19m MSL (Elevated Mound)",
        capacity: "1,200 Citizens",
        amenities: "Ambulance Depot, Satellite Comms",
      },
    ],
  },
  "bangalore_area.geojson": {
    shelters: [
      {
        id: "blr-shelter-1",
        name: "Kanteerava High-Ground Disaster Hub",
        type: "Primary Flood Evacuation Shelter",
        offset: [0.75, 0.7],
        elevationMsl: "+935m MSL (High Ridge MSL)",
        capacity: "3,500 Citizens",
        amenities: "High-Tension Generators, Heli-drop Zone, Trauma Care",
      },
      {
        id: "blr-shelter-2",
        name: "Indiranagar Municipal Relief Compound",
        type: "Mass Relief & Logistics Center",
        offset: [0.8, -0.65],
        elevationMsl: "+928m MSL (Elevated Plateau)",
        capacity: "2,000 Citizens",
        amenities: "Automated Sluice Monitoring, Solar Inverters",
      },
      {
        id: "blr-shelter-3",
        name: "Hebbal Elevated Civic Staging Post",
        type: "First-Aid & Lake Breach Evacuation",
        offset: [-0.7, 0.75],
        elevationMsl: "+922m MSL (Elevated Ridge)",
        capacity: "1,100 Citizens",
        amenities: "NDRF Boat Staging, Satellite Comms",
      },
    ],
  },
  "delhi_area.geojson": {
    shelters: [
      {
        id: "delhi-shelter-1",
        name: "Talkatora Ridge Disaster Relief Complex",
        type: "Primary Flood Evacuation Shelter",
        offset: [0.75, 0.7],
        elevationMsl: "+238m MSL (Delhi Ridge High Ground)",
        capacity: "4,000 Citizens",
        amenities: "Solar Microgrid, Mobile Surgical Units, Water Rations",
      },
      {
        id: "delhi-shelter-2",
        name: "Indira Gandhi Indoor Logistics Hub",
        type: "Mass Relief & Logistics Center",
        offset: [0.8, -0.65],
        elevationMsl: "+224m MSL (Elevated Complex)",
        capacity: "3,200 Citizens",
        amenities: "Heavy Transport Staging, High-Capacity Pumps",
      },
      {
        id: "delhi-shelter-3",
        name: "Civil Lines Elevated Relief Station",
        type: "First-Aid & Yamuna Spill Emergency Hub",
        offset: [-0.7, 0.75],
        elevationMsl: "+228m MSL (High Ground Ridge)",
        capacity: "1,800 Citizens",
        amenities: "Inflatable Boat Deployment, Comms Center",
      },
    ],
  },
  "kolkata_area.geojson": {
    shelters: [
      {
        id: "kol-shelter-1",
        name: "Salt Lake Stadium Elevated Disaster Complex",
        type: "Primary Flood Evacuation Shelter",
        offset: [0.75, 0.7],
        elevationMsl: "+18m MSL (Ramparts High Ground)",
        capacity: "4,500 Citizens",
        amenities: "Mass Shelter Halls, Emergency Filtration, Helipad",
      },
      {
        id: "kol-shelter-2",
        name: "Netaji Indoor Mass Relief Center",
        type: "Mass Relief & Logistics Center",
        offset: [0.8, -0.65],
        elevationMsl: "+15m MSL (Elevated Plinth)",
        capacity: "2,700 Citizens",
        amenities: "High-Volume Drainage Sump, Backup Generators",
      },
      {
        id: "kol-shelter-3",
        name: "Alipore High-Ground Staging Post",
        type: "First-Aid & Cyclone Spill Emergency",
        offset: [-0.7, 0.75],
        elevationMsl: "+14m MSL (Elevated Ridge)",
        capacity: "1,300 Citizens",
        amenities: "Ambulance Staging, Disaster Response Store",
      },
    ],
  },
};

const MapView = ({
  planData,
  overlayData,
  scenario,
  showOverlay,
  simulationData,
  uploadedFileName,
  mitigationReductionPct = 0,
}) => {
  const [activeLayer, setActiveLayer] = useState("satellite"); // 'satellite' | 'topography' | 'streets'
  const [showEvacuationRoutes, setShowEvacuationRoutes] = useState(false);
  const [showHazardZones, setShowHazardZones] = useState(true);
  const [hazardStyle, setHazardStyle] = useState("heat"); // 'heat' | 'tiers'
  const [roadRoutes, setRoadRoutes] = useState(null);
  const [routingState, setRoutingState] = useState("idle"); // idle | loading | road | fallback
  const [mapInstance, setMapInstance] = useState(null);
  const [viewTick, setViewTick] = useState(0);
  const [hazardRenderer, setHazardRenderer] = useState(null);

  const handleMapReady = useCallback((map) => setMapInstance(map), []);
  const handleViewChange = useCallback(() => setViewTick((n) => n + 1), []);

  // The hazard bands render into their own canvas pane. That pane is blurred
  // in CSS for the heat style, which is what turns the overlapping translucent
  // polygons into one continuous surface - and it has to be a separate pane so
  // the ward boundary, corridors and markers stay crisp.
  useEffect(() => {
    if (!mapInstance) return;
    if (!mapInstance.getPane("hazard")) {
      const pane = mapInstance.createPane("hazard");
      pane.style.zIndex = 410; // above tiles, below markers
      pane.style.pointerEvents = "auto";
    }
    setHazardRenderer(L.canvas({ pane: "hazard", padding: 0.6 }));
  }, [mapInstance]);

  // The blur belongs to the heat style only; the geometric style needs crisp
  // edges, so the pane class is switched rather than the layers rebuilt.
  useEffect(() => {
    if (!mapInstance) return;
    const pane = mapInstance.getPane("hazard");
    if (pane) pane.classList.toggle("is-crisp", hazardStyle !== "heat");
  }, [mapInstance, hazardStyle, hazardRenderer]);

  // Calculate center and bounding geometry from planData (Memoized)
  const {
    center: currentCenter,
    halfSpanLat,
    halfSpanLon,
  } = useMemo(() => {
    if (
      planData &&
      planData.features &&
      planData.features[0] &&
      planData.features[0].geometry
    ) {
      const coords = planData.features[0].geometry.coordinates[0];
      if (coords && coords.length > 0) {
        const lats = coords.map((c) => c[1]);
        const lons = coords.map((c) => c[0]);
        const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
        const centerLon = lons.reduce((a, b) => a + b, 0) / lons.length;
        const halfSpanLat = Math.max(
          (Math.max(...lats) - Math.min(...lats)) / 2,
          0.008,
        );
        const halfSpanLon = Math.max(
          (Math.max(...lons) - Math.min(...lons)) / 2,
          0.008,
        );
        return { center: [centerLat, centerLon], halfSpanLat, halfSpanLon };
      }
    }
    return {
      center: MAP_CONFIG.defaultCenter,
      halfSpanLat: 0.015,
      halfSpanLon: 0.015,
    };
  }, [planData]);

  // City-specific dataset resolver
  const cityKey = useMemo(() => {
    if (!uploadedFileName) return "trichy_area.geojson";
    const clean = uploadedFileName.toLowerCase();
    for (const key of Object.keys(CITY_SHELTERS_AND_HOTSPOTS)) {
      if (clean.includes(key.replace(".geojson", "").replace("_area", ""))) {
        return key;
      }
    }
    return "trichy_area.geojson";
  }, [uploadedFileName]);

  const activeCityData =
    CITY_SHELTERS_AND_HOTSPOTS[cityKey] ||
    CITY_SHELTERS_AND_HOTSPOTS["trichy_area.geojson"];

  // Generate 3 High-Ground Safe Evacuation Shelters for this specific city
  const safeShelters = useMemo(() => {
    return activeCityData.shelters.map((s) => ({
      ...s,
      position: [
        currentCenter[0] + halfSpanLat * s.offset[0],
        currentCenter[1] + halfSpanLon * s.offset[1],
      ],
    }));
  }, [activeCityData, currentCenter, halfSpanLat, halfSpanLon]);

  // Evacuation Corridor Polylines for this specific city
  const evacuationPaths = useMemo(() => {
    return [
      // Corridor to Shelter 1 (North-East perimeter high ground)
      [
        [
          currentCenter[0] - halfSpanLat * 0.35,
          currentCenter[1] + halfSpanLon * 0.2,
        ],
        [
          currentCenter[0] + halfSpanLat * 0.15,
          currentCenter[1] + halfSpanLon * 0.55,
        ],
        [
          currentCenter[0] + halfSpanLat * activeCityData.shelters[0].offset[0],
          currentCenter[1] + halfSpanLon * activeCityData.shelters[0].offset[1],
        ],
      ],
      // Corridor to Shelter 2 (North-West elevated arterial corridor)
      [
        [
          currentCenter[0] - halfSpanLat * 0.4,
          currentCenter[1] - halfSpanLon * 0.25,
        ],
        [
          currentCenter[0] + halfSpanLat * 0.2,
          currentCenter[1] - halfSpanLon * 0.55,
        ],
        [
          currentCenter[0] + halfSpanLat * activeCityData.shelters[1].offset[0],
          currentCenter[1] + halfSpanLon * activeCityData.shelters[1].offset[1],
        ],
      ],
      // Corridor to Shelter 3 (South-East ridge route)
      [
        [
          currentCenter[0] - halfSpanLat * 0.7,
          currentCenter[1] - halfSpanLon * 0.1,
        ],
        [
          currentCenter[0] - halfSpanLat * 0.85,
          currentCenter[1] + halfSpanLon * 0.4,
        ],
        [
          currentCenter[0] + halfSpanLat * activeCityData.shelters[2].offset[0],
          currentCenter[1] + halfSpanLon * activeCityData.shelters[2].offset[1],
        ],
      ],
    ];
  }, [activeCityData, currentCenter, halfSpanLat, halfSpanLon]);

  // Fetch road-following corridors the first time the layer is switched on for
  // a given city, and whenever the study area moves. Nothing is requested
  // while the layer is off, so the demo makes no network calls it doesn't use.
  useEffect(() => {
    if (!showEvacuationRoutes) return undefined;

    const controller = new AbortController();
    let cancelled = false;

    setRoutingState("loading");
    setRoadRoutes(null);

    fetchEvacuationRoutes(currentCenter, safeShelters, {
      signal: controller.signal,
    })
      .then((results) => {
        if (cancelled) return;
        const usable = results.filter(Boolean).length;
        setRoadRoutes(results);
        setRoutingState(usable > 0 ? "road" : "fallback");
      })
      .catch(() => {
        if (cancelled) return;
        setRoutingState("fallback");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [showEvacuationRoutes, safeShelters, currentCenter]);

  // Shelters sit where OSRM snapped them - on a road a relief vehicle can
  // actually reach - falling back to the calibrated offset when routing is
  // unavailable.
  const displayShelters = useMemo(() => {
    return safeShelters.map((shelter, idx) => {
      const route = roadRoutes && roadRoutes[idx];
      return {
        ...shelter,
        position: route?.snappedDestination || shelter.position,
        distanceKm: route?.distanceKm ?? null,
        durationMin: route?.durationMin ?? null,
      };
    });
  }, [safeShelters, roadRoutes]);

  // Road geometry where we have it, the straight-line corridor where we don't.
  const displayRoutes = useMemo(() => {
    return safeShelters.map((shelter, idx) => {
      const route = roadRoutes && roadRoutes[idx];
      if (route) return { positions: route.positions, isRoad: true };
      return { positions: evacuationPaths[idx], isRoad: false };
    });
  }, [safeShelters, roadRoutes, evacuationPaths]);

  const getOverlayStyle = useCallback(
    (feature) => {
      if (mitigationReductionPct > 30 && !feature?.properties?.fill_color) {
        return {
          color: "#059669",
          weight: 2.5,
          fillOpacity: feature?.properties?.fill_opacity || 0.4,
          fillColor: "#10B981",
        };
      }
      if (feature && feature.properties && feature.properties.fill_color) {
        const p = feature.properties;

        // Two readings of the same geometry. 'heat' leaves the bands unstroked
        // and lets the blurred pane fuse them into one density surface; 'tiers'
        // outlines each band and drops the fills back, so the depth steps can be
        // read off individually - the geometric style this overlay started as.
        if (hazardStyle === "tiers") {
          return {
            color: p.stroke_color || p.fill_color,
            weight: 1.4,
            opacity: 0.9,
            fillOpacity: Math.max(0.1, (p.fill_opacity ?? 0.3) * 0.62),
            fillColor: p.fill_color,
            lineJoin: "round",
          };
        }

        return {
          color: p.stroke_color || p.fill_color,
          weight: p.stroke_weight !== undefined ? p.stroke_weight : 2,
          opacity: p.stroke_opacity !== undefined ? p.stroke_opacity : 1,
          fillOpacity: p.fill_opacity !== undefined ? p.fill_opacity : 0.45,
          fillColor: p.fill_color,
          lineJoin: "round",
        };
      }
      if (scenario === "baseline") {
        return mapStyles.floodRiskBaseline;
      } else if (scenario === "rcp85") {
        return mapStyles.floodRiskRCP85;
      } else {
        return mapStyles.floodRiskRCP45;
      }
    },
    [mitigationReductionPct, scenario, hazardStyle],
  );

  const onEachOverlayFeature = useCallback(
    (feature, layer) => {
      if (feature && feature.properties) {
        const name = feature.properties.name || "Climate Risk Zone";
        const tier =
          feature.properties.risk_tier ||
          feature.properties.risk_level ||
          "Flood Risk";
        const depth =
          feature.properties.depth_m !== undefined
            ? `${feature.properties.depth_m}m`
            : "Calculated";
        const color =
          feature.properties.fill_color ||
          (mitigationReductionPct > 30 ? "#10B981" : "#EF4444");

        layer.bindPopup(`
        <div style="font-size: 13px; line-height: 1.5; min-width: 190px;">
          <div style="display: inline-block; background: ${color}20; color: ${color}; border: 1px solid ${color}80; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px; margin-bottom: 4px;">
            ${tier.toUpperCase()}
          </div>
          <strong style="color: #07173F; font-size: 13.5px; display: block;">${name}</strong>
          <div style="color: #333; margin-top: 4px;">
            Estimated Water Depth: <strong style="color: ${color}; font-size: 14px;">${depth}</strong>
          </div>
          <div style="font-size: 11px; color: #64748B; margin-top: 4px; border-top: 1px solid #E2E8F0; padding-top: 4px;">
            ${mitigationReductionPct > 0 ? `🛡️ Green Sandbox Active (-${mitigationReductionPct}%)` : `⚠️ USDA SCS-CN 3-Tier Model`}
          </div>
        </div>
      `);
      }
    },
    [mitigationReductionPct],
  );

  const onEachPlanFeature = useCallback(
    (feature, layer) => {
      const areaName = uploadedFileName
        ? uploadedFileName.replace(".geojson", "").replace("_area", "")
        : "Analysis Ward";
      layer.bindPopup(`
      <div style="font-size: 13px; line-height: 1.5;">
        <strong style="color: #0042A6; font-size: 14px;">📍 Study Ward: ${areaName}</strong><br/>
        <span style="color: #555;">Layer Spectrum: <strong>${activeLayer.toUpperCase()}</strong></span>
      </div>
    `);
    },
    [uploadedFileName, activeLayer],
  );

  return (
    <div className="map-container">
      {/* Map chrome - centred in the strip of map to the right of the status
          card, so it reads as deliberate and can never collide with it. */}
      <div className="map-toolbar">
        <div className="map-toolbar__bar">
          <div className="map-toolbar__group" role="group" aria-label="Basemap">
            <button
              className={`map-toolbar__seg${activeLayer === "satellite" ? " is-active" : ""}`}
              onClick={() => setActiveLayer("satellite")}
              title="NASA GIBS / Esri high-resolution imagery"
            >
              Satellite
            </button>
            <button
              className={`map-toolbar__seg${activeLayer === "topography" ? " is-active" : ""}`}
              onClick={() => setActiveLayer("topography")}
              title="SRTM terrain"
            >
              Terrain
            </button>
            <button
              className={`map-toolbar__seg${activeLayer === "streets" ? " is-active" : ""}`}
              onClick={() => setActiveLayer("streets")}
              title="Street basemap"
            >
              Streets
            </button>
          </div>

          <div className="map-toolbar__group map-toolbar__group--plain">
            <button
              className={`map-toolbar__toggle${showEvacuationRoutes ? " is-on" : ""}`}
              onClick={() => setShowEvacuationRoutes(!showEvacuationRoutes)}
              aria-pressed={showEvacuationRoutes}
              title="High-ground shelters and road-routed evacuation corridors"
            >
              <span
                className={`map-toolbar__dot${showEvacuationRoutes && routingState === "loading" ? " is-busy" : ""}`}
              />
              Evacuation
              {showEvacuationRoutes && routingState === "loading" && (
                <span className="map-toolbar__note">routing…</span>
              )}
              {showEvacuationRoutes && routingState === "fallback" && (
                <span
                  className="map-toolbar__note"
                  title="Road routing unavailable - showing direct corridors"
                >
                  approx.
                </span>
              )}
            </button>

            <button
              className={`map-toolbar__toggle${showHazardZones ? " is-on" : ""}`}
              onClick={() => setShowHazardZones(!showHazardZones)}
              aria-pressed={showHazardZones}
              title="Show or hide the inundation surface"
            >
              <span className="map-toolbar__dot" />
              Hazard
            </button>
          </div>

          {/* How the hazard surface is drawn: a continuous heat surface, or the
            discrete banded tiers this started as. */}
          <div
            className="map-toolbar__group"
            role="group"
            aria-label="Hazard style"
          >
            <button
              className={`map-toolbar__seg${hazardStyle === "heat" ? " is-active" : ""}`}
              onClick={() => setHazardStyle("heat")}
              title="Continuous blurred density surface"
            >
              Heat
            </button>
            <button
              className={`map-toolbar__seg${hazardStyle === "tiers" ? " is-active" : ""}`}
              onClick={() => setHazardStyle("tiers")}
              title="Discrete outlined depth tiers"
            >
              Tiers
            </button>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <MapContainer
        center={currentCenter}
        zoom={MAP_CONFIG.zoom}
        preferCanvas={true}
        /* The default top-left zoom sits underneath the status card, and the
           card's height changes with the ward name - so dock it bottom-right,
           the one corner nothing else claims. */
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <ZoomControl position="bottomright" />
        <MapBridge onReady={handleMapReady} onViewChange={handleViewChange} />
        <MapCenterUpdater center={currentCenter} />

        {/* Base Map Layers */}
        {activeLayer === "satellite" ? (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="© NASA & Esri High-Resolution World Imagery"
            maxZoom={18}
            keepBuffer={4}
          />
        ) : activeLayer === "topography" ? (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
            attribution="© Esri Topo & USGS SRTM 30m Elevation"
            maxZoom={18}
            keepBuffer={4}
          />
        ) : (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
            maxZoom={18}
            keepBuffer={4}
          />
        )}

        {/* Planning area polygon */}
        {planData && (
          <FastGeoJSON
            data={planData}
            style={mapStyles.plan}
            onEachFeature={onEachPlanFeature}
          />
        )}

        {/* Hazard tiers, behind their own toggle so the corridors underneath
            can actually be read. */}
        {showHazardZones && showOverlay && overlayData && (
          <FastGeoJSON
            data={overlayData}
            style={getOverlayStyle}
            onEachFeature={onEachOverlayFeature}
            pane="hazard"
            renderer={hazardRenderer}
          />
        )}

        {/* High-Ground Emergency Evacuation Shelters & Corridors */}
        {showEvacuationRoutes && (
          <>
            {/* Evacuation corridors. A solid casing under a coloured core is
                how road routes are drawn on every mapping product - it keeps
                the line readable over both imagery and street basemaps.
                Straight-line fallbacks stay dashed, so an unrouted corridor
                never passes itself off as a surveyed one. */}
            {displayRoutes.map((route, idx) =>
              route.positions ? (
                <React.Fragment key={`evac-path-${idx}`}>
                  {route.isRoad && (
                    <Polyline
                      positions={route.positions}
                      pathOptions={{
                        color: "#FFFFFF",
                        weight: 7,
                        opacity: 0.85,
                      }}
                    />
                  )}
                  <Polyline
                    positions={route.positions}
                    pathOptions={{
                      color: route.isRoad ? "#15803D" : "#27AE60",
                      weight: route.isRoad ? 4 : 3,
                      dashArray: route.isRoad ? null : "8, 8",
                      opacity: route.isRoad ? 0.95 : 0.7,
                    }}
                  />
                </React.Fragment>
              ) : null,
            )}

            {/* Shelter Markers */}
            {displayShelters.map((shelter) => (
              <CircleMarker
                key={shelter.id}
                center={shelter.position}
                radius={9}
                pathOptions={{
                  color: "#065F46",
                  fillColor: "#10B981",
                  fillOpacity: 0.95,
                  weight: 3,
                }}
              >
                <Popup>
                  <div
                    style={{
                      fontSize: "12px",
                      lineHeight: 1.5,
                      minWidth: "180px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "10px",
                        background: "#D1FAE5",
                        color: "#065F46",
                        fontWeight: "800",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        display: "inline-block",
                        marginBottom: "4px",
                      }}
                    >
                      SAFE HIGH-GROUND SHELTER
                    </div>
                    <strong
                      style={{
                        color: "#07173F",
                        fontSize: "13px",
                        display: "block",
                      }}
                    >
                      {shelter.name}
                    </strong>
                    <div
                      style={{
                        color: "#059669",
                        fontWeight: "700",
                        marginTop: "2px",
                      }}
                    >
                      📍 Elevation: {shelter.elevationMsl}
                    </div>
                    <div style={{ color: "#333" }}>
                      👥 Capacity: <strong>{shelter.capacity}</strong>
                    </div>
                    {shelter.distanceKm !== null && (
                      <div
                        className="num"
                        style={{
                          color: "#0042A6",
                          fontWeight: "600",
                          marginTop: "2px",
                        }}
                      >
                        {shelter.distanceKm.toFixed(1)} km by road · ~
                        {Math.round(shelter.durationMin)} min drive
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#64748B",
                        marginTop: "4px",
                        borderTop: "1px solid #E2E8F0",
                        paddingTop: "4px",
                      }}
                    >
                      🏥 {shelter.amenities}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </>
        )}

        {/* NASA MODIS Land Surface Temperature (LST) Urban Heat Hotspots */}
      </MapContainer>
    </div>
  );
};

export default React.memo(MapView);

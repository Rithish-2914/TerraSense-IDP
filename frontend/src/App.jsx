import React, { useState, useEffect, useMemo, useCallback } from "react";
import MapView from "./components/MapView";
import FloatingPanel from "./components/FloatingPanel";
import FloatingButton from "./components/FloatingButton";
import IntroPopup from "./components/IntroPopup";
import Toast from "./components/Toast";
import MapLegend from "./components/MapLegend";
import MultiCityBenchmarkModal from "./components/MultiCityBenchmarkModal";
import EmergencyHotlineModal from "./components/EmergencyHotlineModal";
import LiveCallAlerts from "./components/LiveCallAlerts";
import { useIncomingCalls } from "./hooks/useIncomingCalls";
import {
  makeExtentRing,
  seedFromName,
  makeSecondaryBasins,
  HAZARD_BANDS,
  MITIGATED_BANDS,
  BASIN_BANDS,
} from "./utils/floodExtent";
import { API_BASE } from "./config.js";

const CITY_GEOJSONS = {
  "trichy_area.geojson": {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Trichy Pilot Ward" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [78.68, 10.78],
              [78.72, 10.78],
              [78.72, 10.82],
              [78.68, 10.82],
              [78.68, 10.78],
            ],
          ],
        },
      },
    ],
  },
  "mumbai_area.geojson": {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Mumbai Metropolis Ward" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [72.82, 18.96],
              [72.87, 18.96],
              [72.87, 19.02],
              [72.82, 19.02],
              [72.82, 18.96],
            ],
          ],
        },
      },
    ],
  },
  "chennai_area.geojson": {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Chennai Coastal Ward" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [80.24, 13.0],
              [80.29, 13.0],
              [80.29, 13.06],
              [80.24, 13.06],
              [80.24, 13.0],
            ],
          ],
        },
      },
    ],
  },
  "bangalore_area.geojson": {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Bangalore Lake Cascade" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [77.58, 12.92],
              [77.64, 12.92],
              [77.64, 12.98],
              [77.58, 12.98],
              [77.58, 12.92],
            ],
          ],
        },
      },
    ],
  },
  "delhi_area.geojson": {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Delhi Yamuna Corridor" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [77.2, 28.6],
              [77.26, 28.6],
              [77.26, 28.66],
              [77.2, 28.66],
              [77.2, 28.6],
            ],
          ],
        },
      },
    ],
  },
  "kolkata_area.geojson": {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Kolkata Delta Basin" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [88.33, 22.54],
              [88.39, 22.54],
              [88.39, 22.6],
              [88.33, 22.6],
              [88.33, 22.54],
            ],
          ],
        },
      },
    ],
  },
};

function App() {
  const [scenario, setScenario] = useState(() => {
    return localStorage.getItem("scenario") || "baseline";
  });
  const [simulationData, setSimulationData] = useState(() => {
    const saved = localStorage.getItem("simulationData");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved simulation data:", e);
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [simulationStep, setSimulationStep] = useState("");
  const [showOverlay, setShowOverlay] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState(() => {
    return (
      localStorage.getItem("uploadedFileName") || "Default: Trichy Pilot Ward"
    );
  });
  const [currentPlan, setCurrentPlan] = useState(() => {
    const saved = localStorage.getItem("currentPlan");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved plan:", e);
      }
    }
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "Trichy Pilot Ward" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [78.68, 10.78],
                [78.72, 10.78],
                [78.72, 10.82],
                [78.68, 10.82],
                [78.68, 10.78],
              ],
            ],
          },
        },
      ],
    };
  });
  const [backendStatus, setBackendStatus] = useState("checking");
  const [earthEngineStatus, setEarthEngineStatus] = useState("unknown");
  const [toast, setToast] = useState(null);
  const [showIntroPopup, setShowIntroPopup] = useState(false);
  const [panelVisible, setPanelVisible] = useState(true);
  const [panelMinimized, setPanelMinimized] = useState(false);
  const [mitigationReductionPct, setMitigationReductionPct] = useState(0);
  const [stormIntensity, setStormIntensity] = useState(180);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);
  const [isEmergencyHotlineOpen, setIsEmergencyHotlineOpen] = useState(false);

  // The flood front advances continuously rather than sitting still: the
  // phase walks the extent geometry forward so the edge breathes the way an
  // active inundation does. Slow on purpose - this reads as a live model,
  // not as a shimmer - and it stops entirely when the overlay is hidden or
  // the user has asked for reduced motion.
  const [floodPhase, setFloodPhase] = useState(0);

  useEffect(() => {
    if (!showOverlay || !simulationData) return undefined;
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return undefined;
    }

    // Slow on purpose: a full cycle takes about three minutes, so the surface
    // creeps rather than shimmers. Each band divides this clock by its own
    // drift rate, so they never move as one.
    const timer = setInterval(
      () => setFloodPhase((p) => (p + 0.012) % (Math.PI * 2)),
      220,
    );
    return () => clearInterval(timer);
  }, [showOverlay, simulationData]);

  // Live helpline feed - polled whenever the backend is reachable.
  const {
    calls: liveCalls,
    alerts: callAlerts,
    dismissAlert,
    dismissAll,
    clearCalls,
  } = useIncomingCalls({ enabled: backendStatus === "connected" });

  // Check backend and Earth Engine status
  useEffect(() => {
    checkBackendStatus();
    const interval = setInterval(checkBackendStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const checkBackendStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/health`);
      if (response.ok) {
        const data = await response.json();
        setBackendStatus("connected");
        setEarthEngineStatus(
          data.services.earth_engine ? "connected" : "needs_auth",
        );

        // Auto-run baseline simulation if not already loaded
        if (!simulationData && currentPlan) {
          triggerAutoSimulation();
        }
      } else {
        setBackendStatus("error");
      }
    } catch (error) {
      setBackendStatus("offline");
    }
  };

  const triggerAutoSimulation = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geometry: currentPlan.features[0].geometry,
          scenario: scenario,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setSimulationData(data);
        setShowOverlay(true);
      }
    } catch (e) {
      console.log("Auto simulation fallback ready:", e);
    }
  };

  const handleRunSimulation = async () => {
    setLoading(true);
    setSimulationStep("processing");

    try {
      console.log("Starting real NASA data simulation...");

      const response = await fetch(`${API_BASE}/api/simulate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          geometry: currentPlan.features[0].geometry,
          scenario: scenario,
        }),
      });

      setSimulationStep("climate");

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      setSimulationStep("ai");
      const simulationResult = await response.json();

      setSimulationData(simulationResult);
      setShowOverlay(true);

      localStorage.setItem("simulationData", JSON.stringify(simulationResult));

      setToast({
        message: `Analysis Complete! 🎉\n\nProcessed real NASA data for ${uploadedFileName.replace(".geojson", "")}\nGenerated ${simulationResult.interventions?.length || 3} AI recommendations`,
        type: "success",
      });
    } catch (error) {
      console.error("Simulation failed:", error);
      setToast({
        message: `Simulation Failed!\n\n${error.message}\n\nPlease ensure:\n1. Backend server is running (${API_BASE})\n2. Earth Engine is authenticated\n3. LMStudio is running on localhost:1234`,
        type: "error",
      });
      setSimulationData({
        metrics: {
          error: true,
          message: "Please check backend services",
        },
        interventions: [],
      });
      setShowOverlay(false);
    } finally {
      setLoading(false);
      setSimulationStep("");
    }
  };

  const handleScenarioChange = useCallback(
    async (newScenario) => {
      setScenario(newScenario);
      localStorage.setItem("scenario", newScenario);

      if (currentPlan) {
        setLoading(true);
        setSimulationStep("updating");

        try {
          console.log(`🔄 Updating to ${newScenario} scenario...`);

          const response = await fetch(`${API_BASE}/api/simulate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              geometry: currentPlan.features[0].geometry,
              scenario: newScenario,
            }),
          });

          if (!response.ok) {
            throw new Error(`Backend error: ${response.status}`);
          }

          const simulationResult = await response.json();
          setSimulationData(simulationResult);
          localStorage.setItem(
            "simulationData",
            JSON.stringify(simulationResult),
          );

          setToast({
            message: `Scenario Updated! 📊\n\nNow showing: ${newScenario.toUpperCase()}\nMetrics recalculated with real NASA data`,
            type: "success",
          });
        } catch (error) {
          setToast({
            message: `Scenario Update Failed!\n\n${error.message}`,
            type: "error",
          });
        } finally {
          setLoading(false);
          setSimulationStep("");
        }
      }
    },
    [currentPlan],
  );

  const handleLoadPlan = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".geojson,.json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const geojson = JSON.parse(event.target.result);
            setCurrentPlan(geojson);
            setSimulationData(null);
            setShowOverlay(false);
            setUploadedFileName(file.name);

            localStorage.setItem("currentPlan", JSON.stringify(geojson));
            localStorage.setItem("uploadedFileName", file.name);

            setToast({
              message: `Successfully loaded: ${file.name}\n\nMap centered on new location. Click "Run NASA Analysis" to process.`,
              type: "success",
            });
          } catch (error) {
            setToast({
              message:
                "Invalid GeoJSON file\n\nPlease select a valid .geojson file with proper coordinates.",
              type: "error",
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, []);

  const handleSelectCity = useCallback((cityFileName) => {
    const geojson =
      CITY_GEOJSONS[cityFileName] || CITY_GEOJSONS["trichy_area.geojson"];
    setCurrentPlan(geojson);
    setSimulationData(null);
    setShowOverlay(false);
    setUploadedFileName(cityFileName);

    localStorage.setItem("currentPlan", JSON.stringify(geojson));
    localStorage.setItem("uploadedFileName", cityFileName);

    setToast({
      message: `Switched to: ${cityFileName.replace(".geojson", "").replace("_area", "").toUpperCase()}\n\nClick "Run NASA Analysis" to simulate climate risk for this city!`,
      type: "success",
    });
  }, []);

  // Synchronize storm intensity with scenario changes or initial analysis
  useEffect(() => {
    if (
      simulationData &&
      simulationData.metrics &&
      simulationData.metrics.mean_rain_mm
    ) {
      setStormIntensity(Math.round(simulationData.metrics.mean_rain_mm));
    }
  }, [simulationData, scenario]);

  // Compute live SCS-CN hydrological metrics dynamically as slider moves (Memoized)
  const activeSimulationData = useMemo(() => {
    if (!simulationData || !simulationData.metrics) return simulationData;

    const P = stormIntensity;
    const baseP = simulationData.climate_data?.precipitation_mm || 180;

    const cn = 78;
    const S = 25400 / cn - 254; // S = 71.74 mm
    const Ia = 0.2 * S; // Ia = 14.35 mm

    const Q = P > Ia ? Math.pow(P - Ia, 2) / (P - Ia + S) : 0;
    const baseQ = baseP > Ia ? Math.pow(baseP - Ia, 2) / (baseP - Ia + S) : 1;

    const runoffChangePct = Math.max(
      -80,
      Math.round(((Q - baseQ) / baseQ) * 100),
    );
    const totalPop = simulationData.metrics.total_population || 6000;

    const riskFraction = Math.min(0.92, Math.max(0.04, 0.04 + (Q / P) * 0.75));
    const peopleAffected = Math.round(totalPop * riskFraction);

    return {
      ...simulationData,
      metrics: {
        ...simulationData.metrics,
        mean_rain_mm: P,
        peak_runoff_change_pct: runoffChangePct,
        scenario_people: peopleAffected,
        impervious_fraction: Math.min(
          0.95,
          parseFloat((0.55 + runoffChangePct / 300).toFixed(2)),
        ),
        // Exposed so the map overlay can be drawn from the hydrology rather
        // than from a second, unrelated set of shape constants.
        runoff_depth_mm: parseFloat(Q.toFixed(1)),
        affected_fraction: parseFloat(riskFraction.toFixed(3)),
      },
    };
  }, [simulationData, stormIntensity]);

  // Hazard footprint.
  //
  // Every number that shapes this surface comes from the simulation rather
  // than from tuning constants:
  //
  //   extent   - sized so the footprint's area equals the model's affected
  //              fraction (scenario_people / total_population) of the ward.
  //              For an ellipse inside the ward box that means
  //              scale = 2·sqrt(fraction/π).
  //   depth    - SCS-CN runoff depth Q concentrated into that affected
  //              fraction, so deeper water follows from more runoff over less
  //              ground, not from a hand-picked multiplier.
  //   texture  - impervious fraction. Sealed catchments flash and channelise,
  //              so their edge is more lobed than a permeable one's.
  //   shape    - mean elevation. Low flat deltas pool outward; higher relief
  //              funnels water along a line.
  //
  // The bands are drawn as many overlapping translucent fills into a blurred
  // pane, so the ramp reads as one continuous density surface.
  const currentOverlay = useMemo(() => {
    if (!showOverlay || !activeSimulationData) return null;

    const metrics = activeSimulationData.metrics || {};

    if (
      currentPlan &&
      currentPlan.features &&
      currentPlan.features[0] &&
      currentPlan.features[0].geometry
    ) {
      const coords = currentPlan.features[0].geometry.coordinates[0];
      if (coords && coords.length > 0) {
        const minLon = Math.min(...coords.map((c) => c[0]));
        const maxLon = Math.max(...coords.map((c) => c[0]));
        const minLat = Math.min(...coords.map((c) => c[1]));
        const maxLat = Math.max(...coords.map((c) => c[1]));

        const centerLon = (minLon + maxLon) / 2;
        const centerLat = (minLat + maxLat) / 2;

        const halfSpanLon = Math.max((maxLon - minLon) / 2, 0.003);
        const halfSpanLat = Math.max((maxLat - minLat) / 2, 0.003);

        // --- Extent from the model's affected fraction ----------------------
        const totalPop = metrics.total_population || 6000;
        const affectedFraction =
          metrics.affected_fraction !== undefined
            ? metrics.affected_fraction
            : Math.min(
                0.92,
                Math.max(
                  0.04,
                  (metrics.scenario_people || totalPop * 0.25) / totalPop,
                ),
              );

        let scale = Math.min(
          0.98,
          Math.max(0.15, 1.128 * Math.sqrt(affectedFraction)),
        );

        // --- Depth from SCS-CN runoff over the flooded area -----------------
        const runoffMm =
          metrics.runoff_depth_mm !== undefined
            ? metrics.runoff_depth_mm
            : Math.max(1, stormIntensity * 0.45);
        // Runoff depth (m) spread over the affected share of the ward, with a
        // concentration factor for the fraction that actually ponds rather
        // than draining away.
        let baseDepth = Math.min(
          3.2,
          Math.max(
            0.15,
            (runoffMm / 1000 / Math.max(0.05, affectedFraction)) * 1.35,
          ),
        );

        if (mitigationReductionPct > 0) {
          scale = Math.max(
            0.12,
            scale * (1 - (mitigationReductionPct / 100) * 0.5),
          );
          baseDepth = baseDepth * (1 - (mitigationReductionPct / 100) * 0.65);
        }

        // --- Texture and shape from the surface readings ---------------------
        const impervious = Math.min(
          0.95,
          Math.max(0.2, metrics.impervious_fraction || 0.55),
        );
        const roughnessScale = 0.82 + impervious * 0.42; // 0.90 – 1.22

        const elevationM = Math.max(0, metrics.elevation_m || 85);
        const anisotropy = 1.1 + Math.min(0.45, elevationM / 2200);

        const isMitigated = mitigationReductionPct > 30;
        const seed = seedFromName(uploadedFileName);
        const bands = isMitigated ? MITIGATED_BANDS : HAZARD_BANDS;
        const tilt = seed % Math.PI; // the ward's drainage line, stable per city

        const features = bands.map((band, idx) => {
          // Each band responds to the storm with its own exponent, so shallow
          // water spreads early and the deep core grows late - they no longer
          // expand and contract as one rigid set of rings.
          const bandScale = Math.pow(scale, band.growth) * band.scale;
          const depth = (baseDepth * band.depth).toFixed(2);

          return {
            type: "Feature",
            properties: {
              name: `${band.label} - ${stormIntensity}mm design storm`,
              risk_tier: isMitigated
                ? `${band.label} (-${mitigationReductionPct}% runoff)`
                : `${band.label} · ~${depth} m standing water`,
              depth_m: depth,
              fill_color: band.fill,
              stroke_color: band.stroke,
              fill_opacity: band.opacity,
              stroke_weight: 0,
              stroke_opacity: 0,
              tier: band.key,
            },
            geometry: {
              type: "Polygon",
              coordinates: makeExtentRing({
                centerLon,
                centerLat,
                radiusLon: halfSpanLon * bandScale,
                radiusLat: halfSpanLat * bandScale,
                // Each band drifts on its own clock, so the surface evolves
                // instead of pulsing in unison.
                seed: seed + idx * 0.16,
                phase: floodPhase * band.drift + idx * 0.09,
                roughness: band.roughness * roughnessScale,
                anisotropy,
                tilt,
              }),
            },
          };
        });

        // --- Secondary pooling basins ---------------------------------------
        // Deep water does not sit only at the centroid. Each ward has a few
        // local depressions that fill as the storm builds, so the hot pockets
        // are scattered - which is both how flooding behaves and what stops
        // the surface reading as a bullseye.
        if (!isMitigated) {
          const basins = makeSecondaryBasins({ seed, count: 4 });

          basins.forEach((basin) => {
            // Below its threshold the depression is simply dry.
            if (affectedFraction < basin.threshold) return;

            // How far past the threshold we are - the pocket grows from
            // nothing rather than popping into existence at full size.
            const maturity = Math.min(
              1,
              (affectedFraction - basin.threshold) / 0.28,
            );

            const offsetLon =
              Math.cos(basin.angle) * basin.distance * halfSpanLon * scale;
            const offsetLat =
              Math.sin(basin.angle) * basin.distance * halfSpanLat * scale;

            BASIN_BANDS.forEach((band, bIdx) => {
              const r = scale * basin.size * band.scale * maturity;
              if (r < 0.012) return;

              const depth = (
                baseDepth *
                band.depth *
                (0.7 + maturity * 0.45)
              ).toFixed(2);

              features.push({
                type: "Feature",
                properties: {
                  name: `Local pooling basin - ${stormIntensity}mm design storm`,
                  risk_tier: `Depression pooling · ~${depth} m standing water`,
                  depth_m: depth,
                  fill_color: band.fill,
                  stroke_color: band.stroke,
                  fill_opacity: band.opacity,
                  stroke_weight: 0,
                  stroke_opacity: 0,
                  tier: `${basin.key}-${band.key}`,
                },
                geometry: {
                  type: "Polygon",
                  coordinates: makeExtentRing({
                    centerLon: centerLon + offsetLon,
                    centerLat: centerLat + offsetLat,
                    radiusLon: halfSpanLon * r,
                    radiusLat: halfSpanLat * r,
                    seed: basin.seed + bIdx * 0.21,
                    phase: floodPhase * basin.drift + bIdx * 0.14,
                    roughness: band.roughness * roughnessScale,
                    anisotropy: 1.05 + basin.size * 0.9,
                    tilt: basin.angle,
                  }),
                },
              });
            });
          });
        }

        return { type: "FeatureCollection", features };
      }
    }

    if (simulationData && simulationData.overlays) {
      if (scenario === "baseline") {
        return simulationData.overlays.baseline || null;
      }
      return (
        simulationData.overlays[scenario] ||
        simulationData.overlays.scenarioB ||
        simulationData.overlays.rcp45 ||
        simulationData.overlays.baseline ||
        null
      );
    }

    return null;
  }, [
    showOverlay,
    activeSimulationData,
    simulationData,
    currentPlan,
    stormIntensity,
    mitigationReductionPct,
    scenario,
    floodPhase,
    uploadedFileName,
  ]);

  const handleIntroComplete = useCallback(() => {
    setShowIntroPopup(false);
    localStorage.setItem("intro-completed", "true");
    setPanelVisible(true);
    setPanelMinimized(false);
  }, []);

  const handlePanelToggle = useCallback(() => {
    setPanelVisible((prev) => !prev);
    setPanelMinimized(false);
  }, []);

  const handlePanelMinimize = useCallback(() => {
    setPanelVisible(false);
    setPanelMinimized(true);
  }, []);

  const handleMitigationChange = useCallback((data) => {
    setMitigationReductionPct(data.totalReductionPct);
  }, []);

  const handleStormIntensityChange = useCallback((val) => {
    setStormIntensity(val);
  }, []);

  return (
    /* The rail reserves space rather than covering the map, so the map is
       never drawn underneath it. */
    <div className={`app${panelVisible ? " app--rail-open" : ""}`}>
      {/* System status - top-left, clear of the control rail on the right */}
      <header className="status-bar">
        <div className="status-bar__identity">
          <div>
            <h1 className="status-bar__name">TerraSense</h1>
            <p className="status-bar__tagline">
              Climate digital twin&nbsp;· WEHACK 2026
            </p>
          </div>
        </div>

        <dl className="status-bar__services">
          <div className="status-bar__service">
            <dt>Backend</dt>
            <dd>
              <span
                className={`dot ${backendStatus === "connected" ? "is-ok" : "is-danger"}`}
              />
              {backendStatus === "connected"
                ? "Online"
                : backendStatus === "checking"
                  ? "Checking"
                  : "Offline"}
            </dd>
          </div>
          <div className="status-bar__service">
            <dt>Earth Engine</dt>
            <dd>
              <span
                className={`dot ${earthEngineStatus === "connected" ? "is-ok" : "is-warn"}`}
              />
              {earthEngineStatus === "connected"
                ? "Authenticated"
                : earthEngineStatus === "needs_auth"
                  ? "Calibrated baseline"
                  : "Unknown"}
            </dd>
          </div>
        </dl>

        <div className="status-bar__footer">
          <span className="status-bar__label">Study area</span>
          <span className="status-bar__area">
            {uploadedFileName.replace(".geojson", "").replace("_area", "")}
          </span>
        </div>
      </header>

      <MapView
        planData={currentPlan}
        overlayData={currentOverlay}
        scenario={scenario}
        showOverlay={showOverlay}
        simulationData={activeSimulationData}
        uploadedFileName={uploadedFileName}
        mitigationReductionPct={mitigationReductionPct}
      />

      {showIntroPopup && <IntroPopup onComplete={handleIntroComplete} />}

      {panelVisible && (
        <FloatingPanel
          scenario={scenario}
          onScenarioChange={handleScenarioChange}
          simulationData={activeSimulationData}
          loading={loading}
          simulationStep={simulationStep}
          onRunSimulation={handleRunSimulation}
          onLoadPlan={handleLoadPlan}
          uploadedFileName={uploadedFileName}
          backendStatus={backendStatus}
          earthEngineStatus={earthEngineStatus}
          isVisible={panelVisible}
          onToggle={handlePanelToggle}
          onMinimize={handlePanelMinimize}
          onMitigationChange={handleMitigationChange}
          planData={currentPlan}
          stormIntensity={stormIntensity}
          onStormIntensityChange={handleStormIntensityChange}
          onOpenBenchmark={() => setIsBenchmarkOpen(true)}
          onOpenHotline={() => setIsEmergencyHotlineOpen(true)}
          mitigationReductionPct={mitigationReductionPct}
          overlayData={currentOverlay}
        />
      )}

      <MultiCityBenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
        onSelectCity={handleSelectCity}
        currentCityName={uploadedFileName}
      />

      <EmergencyHotlineModal
        isOpen={isEmergencyHotlineOpen}
        onClose={() => setIsEmergencyHotlineOpen(false)}
        onShowToast={setToast}
        liveCalls={liveCalls}
        onClearCalls={clearCalls}
      />

      <LiveCallAlerts
        alerts={callAlerts}
        onOpenConsole={() => setIsEmergencyHotlineOpen(true)}
        onDismiss={dismissAlert}
        onDismissAll={dismissAll}
      />

      {!panelVisible && !showIntroPopup && (
        <FloatingButton
          onClick={handlePanelToggle}
          simulationData={simulationData}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <MapLegend
        uploadedFileName={uploadedFileName}
        simulationData={simulationData}
        overlayData={currentOverlay}
      />
    </div>
  );
}

export default App;

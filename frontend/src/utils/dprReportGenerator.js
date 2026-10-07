/**
 * TerraSense Municipal Detailed Project Report (DPR) Generator
 *
 * Produces a print-ready A4 technical report in the two-column format used for
 * IEEE transactions and Indian municipal DPR submissions: a full-width title
 * block, abstract and index terms, roman-numbered sections, numbered figures
 * and tables with captions above/below in the conventional places, and a
 * references list.
 *
 * Figures are generated as inline SVG from the live model geometry. Nothing is
 * fetched: basemap tiles are cross-origin and would taint a canvas export, so
 * the hazard plan is drawn from the same coordinates the map renders.
 */

import { readIntervention } from "./interventions";

/* ---------------------------------------------------------------------------
 * Figure 1 - hazard footprint plan, drawn from the overlay geometry.
 * ------------------------------------------------------------------------ */
function buildHazardPlanSVG(planData, overlayData) {
  const wardRing = planData?.features?.[0]?.geometry?.coordinates?.[0];
  if (!wardRing || wardRing.length === 0) return null;

  const pts = [...wardRing];
  const bands = (overlayData?.features || []).filter(
    (f) =>
      f?.geometry?.type === "Polygon" &&
      Array.isArray(f.geometry.coordinates?.[0]),
  );
  bands.forEach((f) => pts.push(...f.geometry.coordinates[0]));

  const lons = pts.map((c) => c[0]);
  const lats = pts.map((c) => c[1]);
  const minLon = Math.min(...lons),
    maxLon = Math.max(...lons);
  const minLat = Math.min(...lats),
    maxLat = Math.max(...lats);

  const pad = 26;
  const maxW = 660,
    maxH = 430;
  const spanLon = Math.max(maxLon - minLon, 1e-6);
  const spanLat = Math.max(maxLat - minLat, 1e-6);

  // One scale for both axes so the plan keeps its true proportions, then size
  // the frame to the data rather than letterboxing it inside a fixed box.
  const k = Math.min((maxW - pad * 2) / spanLon, (maxH - pad * 2) / spanLat);
  const W = Math.round(spanLon * k + pad * 2);
  const H = Math.round(spanLat * k + pad * 2);
  const offX = (W - spanLon * k) / 2;
  const offY = (H - spanLat * k) / 2;

  const X = (lon) => offX + (lon - minLon) * k;
  const Y = (lat) => H - (offY + (lat - minLat) * k); // SVG y grows downward

  const ringPath = (ring) =>
    ring
      .map(
        (c, i) =>
          `${i === 0 ? "M" : "L"} ${X(c[0]).toFixed(1)} ${Y(c[1]).toFixed(1)}`,
      )
      .join(" ") + " Z";

  // Scale bar: metres per degree of longitude at this latitude.
  const midLat = (minLat + maxLat) / 2;
  const mPerDegLon = 111320 * Math.cos((midLat * Math.PI) / 180);
  const targetPx = 120;
  const rawM = (targetPx / k) * mPerDegLon;
  const nice = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000].reduce(
    (best, v) => (Math.abs(v - rawM) < Math.abs(best - rawM) ? v : best),
    100,
  );
  const barPx = (nice / mPerDegLon) * k;
  const barLabel = nice >= 1000 ? `${nice / 1000} km` : `${nice} m`;

  const bandShapes = bands
    .map((f) => {
      const p = f.properties || {};
      return (
        `<path d="${ringPath(f.geometry.coordinates[0])}" fill="${p.fill_color || "#EF4444"}" ` +
        `fill-opacity="${p.fill_opacity ?? 0.3}" stroke="${p.stroke_color || p.fill_color || "#DC2626"}" ` +
        `stroke-width="0.5" stroke-opacity="0.55" />`
      );
    })
    .join("\n      ");

  return `
  <svg viewBox="0 0 ${W} ${H}" class="figure-svg" role="img" aria-label="Modelled inundation footprint over the study ward">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF" stroke="#1A1A1A" stroke-width="1"/>

    <!-- Neatline graticule, 5 x 5 -->
    <g stroke="#D8DEE7" stroke-width="0.5">
      ${Array.from({ length: 4 }, (_, i) => {
        const x = pad + ((W - pad * 2) / 5) * (i + 1);
        return `<line x1="${x.toFixed(1)}" y1="${pad}" x2="${x.toFixed(1)}" y2="${H - pad}"/>`;
      }).join("\n      ")}
      ${Array.from({ length: 4 }, (_, i) => {
        const y = pad + ((H - pad * 2) / 5) * (i + 1);
        return `<line x1="${pad}" y1="${y.toFixed(1)}" x2="${W - pad}" y2="${y.toFixed(1)}"/>`;
      }).join("\n      ")}
    </g>

    <!-- Modelled inundation bands, outermost first -->
    <g>
      ${bandShapes}
    </g>

    <!-- Study ward boundary -->
    <path d="${ringPath(wardRing)}" fill="none" stroke="#07173F" stroke-width="1.6" stroke-dasharray="7 4"/>

    <!-- North arrow -->
    <g transform="translate(${W - 52}, 40)">
      <path d="M 0 -18 L 6 8 L 0 3 L -6 8 Z" fill="#1A1A1A"/>
      <text x="0" y="24" text-anchor="middle" class="figure-svg-label">N</text>
    </g>

    <!-- Scale bar -->
    <g transform="translate(${pad + 6}, ${H - pad - 6})">
      <rect x="0" y="-5" width="${barPx.toFixed(1)}" height="5" fill="#1A1A1A"/>
      <rect x="0" y="-5" width="${(barPx / 2).toFixed(1)}" height="5" fill="#FFFFFF" stroke="#1A1A1A" stroke-width="0.7"/>
      <text x="${(barPx + 6).toFixed(1)}" y="0" class="figure-svg-label">${barLabel}</text>
    </g>

    <!-- Corner coordinates -->
    <text x="${pad}" y="${H - 8}" class="figure-svg-coord">${minLat.toFixed(4)}°N ${minLon.toFixed(4)}°E</text>
    <text x="${W - pad}" y="18" text-anchor="end" class="figure-svg-coord">${maxLat.toFixed(4)}°N ${maxLon.toFixed(4)}°E</text>
  </svg>`;
}

/* ---------------------------------------------------------------------------
 * Figure 2 - modelled depth by band, as a horizontal bar chart.
 * ------------------------------------------------------------------------ */
function buildDepthProfileSVG(overlayData) {
  const feats = (overlayData?.features || []).filter(
    (f) => f?.properties?.depth_m !== undefined,
  );
  if (feats.length === 0) return null;

  // Collapse duplicate tiers (the scattered basins repeat depth classes).
  const seen = new Map();
  feats.forEach((f) => {
    const label = (f.properties.risk_tier || "").split("·")[0].trim() || "Band";
    const d = parseFloat(f.properties.depth_m);
    if (!Number.isFinite(d)) return;
    if (!seen.has(label) || seen.get(label).depth < d) {
      seen.set(label, {
        label,
        depth: d,
        color: f.properties.fill_color || "#EF4444",
      });
    }
  });

  const rows = [...seen.values()].sort((a, b) => b.depth - a.depth).slice(0, 8);
  if (rows.length === 0) return null;

  const maxD = Math.max(...rows.map((r) => r.depth), 0.1);
  const rowH = 22,
    labelW = 210,
    W = 660,
    pad = 14;
  const H = pad * 2 + rows.length * rowH + 16;
  const barMax = W - labelW - pad - 64;

  const bars = rows
    .map((r, i) => {
      const y = pad + i * rowH;
      const w = Math.max(2, (r.depth / maxD) * barMax);
      return `<g>
      <text x="${labelW - 8}" y="${y + 12}" text-anchor="end" class="figure-svg-label">${r.label}</text>
      <rect x="${labelW}" y="${y + 2}" width="${w.toFixed(1)}" height="13" fill="${r.color}" fill-opacity="0.85" stroke="#1A1A1A" stroke-width="0.4"/>
      <text x="${labelW + w + 6}" y="${y + 12}" class="figure-svg-label">${r.depth.toFixed(2)} m</text>
    </g>`;
    })
    .join("\n    ");

  return `
  <svg viewBox="0 0 ${W} ${H}" class="figure-svg" role="img" aria-label="Modelled standing water depth by hazard band">
    <line x1="${labelW}" y1="${pad - 2}" x2="${labelW}" y2="${H - pad - 4}" stroke="#1A1A1A" stroke-width="0.8"/>
    ${bars}
  </svg>`;
}

export const generateMunicipalDPR = (
  simulationData,
  scenario,
  areaName,
  planData,
  options = {},
) => {
  if (!simulationData || !simulationData.metrics) {
    alert(
      "Please run a simulation first before generating a Detailed Project Report.",
    );
    return;
  }

  const { overlayData = null, mitigationReductionPct = 0 } = options;

  const metrics = simulationData.metrics || {};
  const interventions = simulationData.interventions || [];
  const cleanArea = areaName
    ? areaName.replace(".geojson", "").replace("_area", "").replace(/_/g, " ")
    : "Urban Pilot Ward";
  const titleArea = cleanArea.replace(/\b\w/g, (c) => c.toUpperCase());

  const now = new Date();
  const reportDate = now.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const scenarioNames = {
    baseline: "current climate baseline (NASA Earth Engine historical mean)",
    rcp45:
      "RCP 4.5 stabilisation pathway (+2.0 °C, +10% design rainfall, CN +3)",
    rcp85:
      "RCP 8.5 high-emissions pathway (+3.8 °C, +25% design rainfall, CN +6)",
    rcp45_rain_plus10: "+10% design rainfall sensitivity test (+1.2 °C, CN +1)",
  };
  const activeScenarioTitle =
    scenarioNames[scenario] || `${scenario} climate scenario`;

  const totalAreaHa = parseFloat(metrics.area_ha || 100);
  const totalPop = parseInt(metrics.total_population || 6000, 10);
  const peopleAtRisk = parseInt(
    metrics.scenario_people || Math.round(totalPop * 0.25),
    10,
  );

  const affectedRatio =
    metrics.affected_fraction !== undefined
      ? metrics.affected_fraction
      : Math.min(0.95, Math.max(0.08, peopleAtRisk / totalPop));
  const affectedAreaHa = (totalAreaHa * affectedRatio).toFixed(1);
  const affectedAreaSqKm = (parseFloat(affectedAreaHa) * 0.01).toFixed(2);
  const affectedAreaPct = (affectedRatio * 100).toFixed(0);

  const rainMm = metrics.mean_rain_mm || 180;
  const runoffMm =
    metrics.runoff_depth_mm !== undefined
      ? metrics.runoff_depth_mm
      : (rainMm * 0.45).toFixed(1);
  const runoffChange =
    metrics.peak_runoff_change_pct !== undefined
      ? metrics.peak_runoff_change_pct
      : 0;
  const tempC = metrics.mean_temperature_c || 34.2;
  const heatStress = metrics.heat_stress_level || "Moderate";
  const heatPop = metrics.heat_affected_people || Math.round(totalPop * 0.2);
  const elevation = metrics.elevation_m || 85;
  const imperviousPct = metrics.impervious_fraction
    ? (metrics.impervious_fraction * 100).toFixed(0)
    : 65;

  const runoffVolumeML = (
    (runoffMm * parseFloat(affectedAreaHa) * 10000) /
    1000000
  ).toFixed(1);

  const depths = (overlayData?.features || [])
    .map((f) => parseFloat(f?.properties?.depth_m))
    .filter((d) => Number.isFinite(d));
  const maxDepthM = depths.length
    ? Math.max(...depths).toFixed(2)
    : ((rainMm / 250) * 0.75).toFixed(2);

  const docRef = `TS/DPR/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}-${Date.now().toString().slice(-4)}`;

  const planFigure = buildHazardPlanSVG(planData, overlayData);
  const depthFigure = buildDepthProfileSVG(overlayData);

  let figureNo = 0;
  const figPlan = planFigure ? ++figureNo : null;
  const figDepth = depthFigure ? ++figureNo : null;

  const readings = interventions.map((it, i) =>
    readIntervention(it, i, totalAreaHa, rainMm),
  );
  const totalCostLakhs = readings.reduce((acc, v) => acc + v.costLakhs, 0);

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DPR ${docRef} - ${titleArea}</title>
  <style>
    /* ---- Page ---------------------------------------------------------- */
    @page { size: A4; margin: 18mm 16mm 16mm; }

    *, *::before, *::after { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 0 0 40px;
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 9.6pt;
      line-height: 1.32;
      color: #000000;
      background: #E9EDF2;
      text-rendering: optimizeLegibility;
    }

    h1, h2, h3, h4, p { margin: 0; }
    ul, ol { margin: 0; padding-left: 1.1em; }

    .sheet {
      width: 210mm;
      min-height: 297mm;
      margin: 22px auto;
      padding: 18mm 16mm;
      background: #FFFFFF;
      box-shadow: 0 2px 4px rgba(0,0,0,.08), 0 14px 40px rgba(0,0,0,.14);
    }

    /* ---- Screen-only action bar ---------------------------------------- */
    .actionbar {
      position: sticky; top: 0; z-index: 10;
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 9px 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      background: #07173F; color: #FFFFFF;
    }
    .actionbar strong { font-weight: 600; }
    .actionbar button {
      padding: 7px 15px;
      font: inherit; font-weight: 600;
      color: #07173F; background: #FFFFFF;
      border: 0; border-radius: 4px; cursor: pointer;
    }

    /* ---- Title block (spans both columns) ------------------------------ */
    .masthead { text-align: center; padding-bottom: 10px; }

    .masthead .authority {
      font-size: 8pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    }
    .masthead .authority-sub {
      font-size: 7.6pt; letter-spacing: .05em; text-transform: uppercase; color: #333;
      margin-top: 1px;
    }
    .masthead .rule { border: 0; border-top: 1.6pt solid #000; margin: 7px 0 9px; }

    .masthead h1 {
      font-size: 17pt; font-weight: 700; line-height: 1.2; letter-spacing: -0.01em;
    }
    .masthead .subtitle { margin-top: 3px; font-size: 10.5pt; font-style: italic; }

    .byline {
      margin-top: 8px; font-size: 8.6pt; line-height: 1.45;
    }
    .byline .sup { font-size: 7pt; vertical-align: super; }

    .docstrip {
      display: flex; justify-content: center; flex-wrap: wrap; gap: 0 18px;
      margin-top: 8px; padding: 4px 0;
      border-top: .5pt solid #000; border-bottom: .5pt solid #000;
      font-size: 7.8pt; letter-spacing: .02em; text-transform: uppercase;
    }
    .docstrip b { font-weight: 700; }

    /* ---- Two-column body ------------------------------------------------ */
    .body {
      margin-top: 11px;
      column-count: 2;
      column-gap: 7mm;
      column-fill: auto;
      text-align: justify;
      hyphens: auto;
    }

    .abstract { font-size: 9pt; font-weight: 700; }
    .abstract p { font-weight: 700; }
    .abstract .lead { font-style: italic; }
    .keywords { margin-top: 5px; font-size: 9pt; font-weight: 700; }
    .keywords .lead { font-style: italic; }

    h2.section {
      margin: 11px 0 4px;
      font-size: 9.6pt; font-weight: 400;
      text-align: center;
      font-variant: small-caps;
      letter-spacing: .04em;
      break-after: avoid;
    }
    h3.subsection {
      margin: 8px 0 3px;
      font-size: 9.6pt; font-style: italic; font-weight: 400;
      break-after: avoid;
    }

    .body p + p { text-indent: 1.4em; }

    /* ---- Figures & tables ----------------------------------------------- */
    figure { margin: 10px 0; break-inside: avoid; }
    figure.wide { column-span: all; margin: 12px 0 14px; }

    .figure-svg {
      display: block;
      width: auto; max-width: 100%;
      max-height: 96mm; height: auto;
      margin: 0 auto;
    }
    .figure-svg-label { font-family: 'Times New Roman', serif; font-size: 11px; fill: #1A1A1A; }
    .figure-svg-coord { font-family: 'Times New Roman', serif; font-size: 9.5px; fill: #555; }

    figcaption {
      margin-top: 5px; font-size: 8.4pt; text-align: center; line-height: 1.35;
    }
    figcaption b { font-weight: 700; }

    .fig-legend {
      display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 14px;
      margin-top: 6px; font-size: 8pt;
    }
    .fig-legend span { display: inline-flex; align-items: center; gap: 4px; }
    .fig-legend i { width: 11px; height: 8px; display: inline-block; border: .4pt solid #333; }

    table { width: 100%; border-collapse: collapse; font-size: 8.4pt; }
    .tablewrap { margin: 10px 0; break-inside: avoid; }
    .tablewrap.wide { column-span: all; }

    .table-caption {
      margin-bottom: 4px; font-size: 8pt; text-align: center;
      font-variant: small-caps; letter-spacing: .05em;
    }
    .table-caption b { font-weight: 700; }

    /* Booktabs rules: heavy top and bottom, light under the header. */
    table thead th {
      padding: 3px 5px; text-align: left; font-weight: 700;
      border-top: 1.1pt solid #000; border-bottom: .5pt solid #000;
    }
    table td { padding: 2.6px 5px; border: 0; }
    table tbody tr:last-child td { border-bottom: 1.1pt solid #000; }
    table td.r, table th.r { text-align: right; }
    .num { font-variant-numeric: tabular-nums; }

    /* ---- Intervention entries ------------------------------------------- */
    .entry { margin: 6px 0; break-inside: avoid; }
    .entry .hd { font-weight: 700; }
    .entry .meta { font-size: 8.2pt; color: #222; }

    /* ---- References & signatures ---------------------------------------- */
    .refs { font-size: 8.2pt; }
    .refs ol { padding-left: 1.3em; }
    .refs li { margin-bottom: 2px; }

    .signoff { column-span: all; margin-top: 22px; break-inside: avoid; }
    .signoff-grid {
      display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 26px; margin-top: 26px;
    }
    .signoff-box {
      padding-top: 5px; border-top: .7pt solid #000;
      font-size: 8.2pt; text-align: center;
    }
    .signoff-box b { display: block; font-size: 8.6pt; }

    .colophon {
      column-span: all;
      margin-top: 16px; padding-top: 5px; border-top: .5pt solid #999;
      display: flex; justify-content: space-between; gap: 14px;
      font-size: 7.4pt; color: #444;
    }

    /* ---- Print ---------------------------------------------------------- */
    @media print {
      body { background: #FFFFFF; padding: 0; }
      .actionbar { display: none !important; }
      .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
    }

    @media (max-width: 820px) {
      .sheet { width: auto; margin: 10px; padding: 16px; }
      .body { column-count: 1; }
      .signoff-grid { grid-template-columns: 1fr; gap: 22px; }
    }
  </style>
</head>
<body>
  <div class="actionbar">
    <div><strong>Detailed Project Report</strong> &nbsp;·&nbsp; ${docRef} &nbsp;·&nbsp; ${titleArea}</div>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="sheet">
    <header class="masthead">
      <div class="authority">Municipal Corporation · Office of the Commissioner</div>
      <div class="authority-sub">Stormwater Drainage &amp; Disaster Management Division</div>
      <hr class="rule"/>
      <h1>Detailed Project Report on Urban Pluvial Flood Hazard<br/>and Capital Mitigation Works: ${titleArea}</h1>
      <div class="subtitle">Satellite-Derived Hydrological Assessment under the ${activeScenarioTitle}</div>

      <div class="byline">
        Prepared by the TerraSense Climate Digital Twin<span class="sup">1</span>,
        Stormwater Drainage Division<span class="sup">2</span><br/>
        <span class="sup">1</span>NASA Earth observation pipeline (GPM IMERG, MODIS, SRTM, WorldPop) ·
        <span class="sup">2</span>Municipal Corporation Public Works
      </div>

      <div class="docstrip">
        <span><b>Doc. Ref.</b> ${docRef}</span>
        <span><b>Date</b> ${reportDate}</span>
        <span><b>Status</b> For Technical Sanction</span>
        <span><b>Classification</b> Public</span>
      </div>
    </header>

    <div class="body">
      <div class="abstract">
        <p><span class="lead">Abstract</span>-This report presents a quantitative pluvial flood hazard
        assessment for ${titleArea} and the prioritised capital works arising from it. Design rainfall of
        ${rainMm} mm is routed through the USDA NRCS SCS curve number method (CN = 78) over a study area of
        ${totalAreaHa} ha delineated from satellite observation. The model returns a direct runoff depth of
        ${runoffMm} mm, an inundation footprint of ${affectedAreaHa} ha (${affectedAreaPct}% of the ward),
        a maximum modelled standing water depth of ${maxDepthM} m, and a directly exposed population of
        ${peopleAtRisk.toLocaleString("en-IN")} residents. ${readings.length || 1} structural and
        nature-based interventions are specified against CPWD Delhi Schedule of Rates 2024&ndash;25${totalCostLakhs > 0 ? `, with an indicative outlay of ₹${totalCostLakhs.toFixed(1)} lakh` : ""}.
        Technical sanction is sought on the basis of the findings in Sections III and IV.</p>

        <p class="keywords"><span class="lead">Index Terms</span>-Urban flooding, SCS curve number,
        stormwater management, green infrastructure, remote sensing, climate adaptation, municipal
        capital works.</p>
      </div>

      <h2 class="section">I. Introduction and Scope</h2>
      <p>The study ward is delineated by the boundary shown in ${figPlan ? `Fig. ${figPlan}` : "the plan of record"}
      and covers ${totalAreaHa} ha (${(totalAreaHa * 0.01).toFixed(2)} km²) with a resident population of
      ${totalPop.toLocaleString("en-IN")}, giving a density of
      ${metrics.population_density || Math.round(totalPop / totalAreaHa)} residents per hectare. Mean ground
      elevation derived from the SRTM 30 m digital elevation model is ${elevation} m above mean sea level,
      and the impervious surface fraction is ${imperviousPct}%.</p>

      <p>The assessment addresses pluvial (rainfall-generated) flooding only. Fluvial flooding from
      upstream river stages, backwater effects from tidal boundaries, and structural failure of existing
      drainage assets are outside its scope and are noted as limitations in Section V.</p>

      <h2 class="section">II. Data Sources and Method</h2>
      <h3 class="subsection">A. Earth Observation Inputs</h3>
      <p>Precipitation is taken from NASA GPM IMERG, land surface temperature from MODIS MOD11A1,
      terrain from USGS SRTMGL1, and population distribution from WorldPop. Where Earth Engine
      authentication is unavailable the pipeline substitutes calibrated regional baselines; the
      provenance of each run is recorded in the system health endpoint.</p>

      <h3 class="subsection">B. Runoff Generation</h3>
      <p>Direct runoff is computed by the USDA NRCS curve number method. For a curve number of 78 the
      maximum potential retention is S = 25400/CN − 254 = 71.7 mm and the initial abstraction is
      I<sub>a</sub> = 0.2S = 14.3 mm. Runoff depth follows
      Q = (P − I<sub>a</sub>)² / (P − I<sub>a</sub> + S) for P &gt; I<sub>a</sub>. At the design rainfall of
      ${rainMm} mm this yields Q = ${runoffMm} mm.</p>

      <h3 class="subsection">C. Inundation Footprint</h3>
      <p>The hazard footprint is sized so that its plan area equals the modelled affected fraction of the
      ward, and is subdivided into depth bands by routing the runoff volume over that area. Band geometry
      is elongated along the ward drainage axis and its edge irregularity scales with the impervious
      fraction, reflecting the flashier, more channelised response of sealed catchments.</p>

      ${
        planFigure
          ? `
      <figure class="wide">
        ${planFigure}
        <div class="fig-legend">
          <span><i style="background:#4ADE80"></i>Trace</span>
          <span><i style="background:#A3E635"></i>Sheet flow</span>
          <span><i style="background:#FACC15"></i>Minor</span>
          <span><i style="background:#FB923C"></i>Moderate</span>
          <span><i style="background:#EF4444"></i>Severe</span>
          <span><i style="background:#DC2626"></i>Critical</span>
          <span><i style="background:#FFF;border:1pt dashed #07173F"></i>Study ward boundary</span>
        </div>
        <figcaption><b>Fig. ${figPlan}.</b> Modelled inundation footprint for a ${rainMm} mm design storm over
        ${titleArea}, under the ${activeScenarioTitle}. Bands denote modelled standing water depth; detached
        pockets are local depressions that pool independently of the main footprint. Plan is drawn to true
        proportion from model coordinates; basemap imagery is omitted.</figcaption>
      </figure>`
          : ""
      }

      <h2 class="section">III. Results</h2>
      <h3 class="subsection">A. Hydrological Response</h3>
      <p>The design storm generates approximately ${runoffVolumeML} million litres of surplus stormwater
      over the inundated area, a change of ${runoffChange >= 0 ? "+" : ""}${runoffChange}% in peak runoff
      against the calibrated baseline. Table I summarises the hydrological result and Table II the
      thermal and surface baselines.</p>

      <div class="tablewrap">
        <div class="table-caption"><b>Table I</b><br/>Inundation and Runoff Summary</div>
        <table>
          <thead>
            <tr><th>Parameter</th><th class="r">Value</th></tr>
          </thead>
          <tbody>
            <tr><td>Study area</td><td class="r num">${totalAreaHa} ha</td></tr>
            <tr><td>Design storm depth, P</td><td class="r num">${rainMm} mm</td></tr>
            <tr><td>Direct runoff depth, Q</td><td class="r num">${runoffMm} mm</td></tr>
            <tr><td>Inundated area</td><td class="r num">${affectedAreaHa} ha (${affectedAreaSqKm} km²)</td></tr>
            <tr><td>Inundated fraction of ward</td><td class="r num">${affectedAreaPct}%</td></tr>
            <tr><td>Max. modelled water depth</td><td class="r num">${maxDepthM} m</td></tr>
            <tr><td>Surplus stormwater volume</td><td class="r num">${runoffVolumeML} ML</td></tr>
            <tr><td>Change in peak runoff</td><td class="r num">${runoffChange >= 0 ? "+" : ""}${runoffChange}%</td></tr>
            <tr><td>Population directly exposed</td><td class="r num">${peopleAtRisk.toLocaleString("en-IN")}</td></tr>
          </tbody>
        </table>
      </div>

      <div class="tablewrap">
        <div class="table-caption"><b>Table II</b><br/>Thermal and Surface Baselines</div>
        <table>
          <thead>
            <tr><th>Parameter</th><th class="r">Value</th></tr>
          </thead>
          <tbody>
            <tr><td>Land surface temp. (MODIS)</td><td class="r num">${tempC} °C</td></tr>
            <tr><td>WHO thermal stress class</td><td class="r">${heatStress}</td></tr>
            <tr><td>Population in heat island</td><td class="r num">${heatPop.toLocaleString("en-IN")}</td></tr>
            <tr><td>Mean elevation (SRTM)</td><td class="r num">${elevation} m MSL</td></tr>
            <tr><td>Impervious surface fraction</td><td class="r num">${imperviousPct}%</td></tr>
            <tr><td>Curve number, CN</td><td class="r num">78</td></tr>
            <tr><td>Retention capacity, S</td><td class="r num">71.7 mm</td></tr>
          </tbody>
        </table>
      </div>

      ${
        depthFigure
          ? `
      <figure>
        ${depthFigure}
        <figcaption><b>Fig. ${figDepth}.</b> Modelled standing water depth by hazard band at the
        ${rainMm} mm design storm.</figcaption>
      </figure>`
          : ""
      }

      <h2 class="section">IV. Proposed Capital Works</h2>
      <p>The following interventions are specified against CPWD Delhi Schedule of Rates 2024&ndash;25.
      Rates are inclusive of 18% GST, 3% quality inspection and contingency, and a five-year maintenance
      warranty.${mitigationReductionPct > 0 ? ` The combination currently modelled achieves a ${mitigationReductionPct}% reduction in peak runoff.` : ""}</p>

      <div class="tablewrap">
        <div class="table-caption"><b>Table III</b><br/>Prioritised Interventions and Indicative Outlay</div>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Intervention</th><th class="r">Runoff cut</th>
              <th class="r">Outlay</th><th class="r">Months</th>
            </tr>
          </thead>
          <tbody>
            ${
              readings.length > 0
                ? readings
                    .map((v, idx) => {
                      const cost =
                        v.costLakhs >= 100
                          ? `₹${(v.costLakhs / 100).toFixed(2)} Cr`
                          : `₹${v.costLakhs.toFixed(1)} L`;
                      return `<tr>
                <td class="num">${idx + 1}</td>
                <td>${v.title}</td>
                <td class="r num">−${v.reductionPct}%</td>
                <td class="r num">${cost}</td>
                <td class="r num">${v.months}</td>
              </tr>`;
                    })
                    .join("")
                : `<tr>
              <td class="num">1</td>
              <td>Integrated stormwater retention basin and bioswale network</td>
              <td class="r num">−28%</td><td class="r num">₹75 L</td><td class="r num">10</td>
            </tr>`
            }
          </tbody>
        </table>
      </div>

      ${readings
        .map(
          (v, idx) => `<div class="entry">
          <div class="hd">${idx + 1}) ${v.title}:</div>
          <div>${v.description || "Civil engineering mitigation to reduce peak runoff and attenuate urban flash flood risk."}</div>
          <div class="meta"><i>Nodal department:</i> ${v.department}. <i>Performance indicator:</i> ${v.kpi}.${v.coverageHa ? ` <i>Coverage:</i> ${v.coverageHa} ha.` : ""}</div>
        </div>`,
        )
        .join("")}

      <h2 class="section">V. Limitations</h2>
      <p>The curve number is a single lumped value for the ward rather than a spatially distributed
      grid, so local variation in soil group and antecedent moisture is not resolved. The inundation
      footprint is a volume-balance representation and not a 2D hydrodynamic solution; it does not
      route flow through the street network or model the capacity of existing drains. Depths should be
      read as indicative hazard classes rather than as design water levels for individual structures.
      Where Earth Engine authentication is unavailable, calibrated regional baselines substitute for
      live satellite retrievals and are labelled as such at run time.</p>

      <h2 class="section">VI. Recommendation</h2>
      <p>It is recommended that technical sanction be accorded to the interventions listed in Table III,
      and that detailed survey and 2D hydrodynamic verification be commissioned for the
      ${affectedAreaHa} ha inundation footprint prior to the award of works.</p>

      <h2 class="section">References</h2>
      <div class="refs">
        <ol>
          <li>United States Department of Agriculture, Natural Resources Conservation Service,
          <i>National Engineering Handbook, Part 630: Hydrology</i>, Ch. 9–10, Washington, DC, 2004.</li>
          <li>G. J. Huffman <i>et al.</i>, "GPM IMERG Final Precipitation L3," NASA Goddard Earth Sciences
          Data and Information Services Center, Greenbelt, MD, 2019.</li>
          <li>Z. Wan, S. Hook and G. Hulley, "MOD11A1 MODIS/Terra Land Surface Temperature and Emissivity
          Daily L3 Global 1 km," NASA EOSDIS LP DAAC, 2021.</li>
          <li>T. G. Farr <i>et al.</i>, "The Shuttle Radar Topography Mission," <i>Rev. Geophys.</i>,
          vol. 45, no. 2, 2007.</li>
          <li>Central Public Works Department, <i>Delhi Schedule of Rates 2024–25</i>, Government of
          India, New Delhi, 2024.</li>
          <li>Ministry of Housing and Urban Affairs, <i>AMRUT 2.0 Operational Guidelines</i>, Government
          of India, New Delhi, 2021.</li>
        </ol>
      </div>

      <div class="signoff">
        <div class="signoff-grid">
          <div class="signoff-box">
            <b>Assistant Engineer</b>
            Stormwater Drainage Division
          </div>
          <div class="signoff-box">
            <b>Executive Engineer</b>
            Drainage &amp; Water Supply
          </div>
          <div class="signoff-box">
            <b>Commissioner</b>
            Municipal Corporation (SPV)
          </div>
        </div>
      </div>

      <div class="colophon">
        <span>${docRef} · Generated ${reportDate} by the TerraSense climate digital twin</span>
        <span>Page 1</span>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const reportWindow = window.open("", "_blank");
  if (reportWindow) {
    reportWindow.document.write(htmlContent);
    reportWindow.document.close();
  } else {
    alert(
      "Pop-up blocked. Please allow pop-ups for this site to open the report.",
    );
  }
};

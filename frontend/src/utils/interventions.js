/**
 * One reading of an intervention, used by both the cards and the ROI totals.
 *
 * The backend and the dashboard had drifted onto different field names -
 * `estimated_cost_inr_lakhs` vs `cost_estimate_inr_lakhs`,
 * `target_runoff_reduction_pct` vs `runoff_reduction_pct`,
 * `implementation_time_months` vs `implementation_months` - so the card and the
 * summary each fell back to different defaults. A card could read ₹87 Cr while
 * the panel added its hard-coded ₹0.50 Cr fallback for the same item. Every
 * consumer now goes through here, so a mismatch is impossible by construction.
 */
export const readIntervention = (
  item = {},
  index = 0,
  areaHa = 100,
  stormIntensity = 180,
) => {
  const firstNumber = (v) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const m = String(v ?? "").match(/\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  };

  // --- Cost, in lakhs ------------------------------------------------------
  let costLakhs = firstNumber(item.estimated_cost_inr_lakhs);
  if (costLakhs === null) costLakhs = firstNumber(item.cost_estimate_inr_lakhs);
  if (costLakhs === null && item.cost_bracket) {
    const v = firstNumber(item.cost_bracket);
    costLakhs =
      v === null
        ? null
        : String(item.cost_bracket).includes("Cr")
          ? v * 100
          : v;
  }
  if (costLakhs === null) {
    // Last resort: scale a per-hectare rate by ward size and storm severity.
    const factor = (areaHa / 100) * (0.85 + (stormIntensity / 180) * 0.15);
    costLakhs = Math.round(75 * factor * 10) / 10;
  }

  // --- Runoff reduction ----------------------------------------------------
  let reductionPct = firstNumber(item.target_runoff_reduction_pct);
  if (reductionPct === null)
    reductionPct = firstNumber(item.runoff_reduction_pct);
  if (reductionPct === null) reductionPct = [18, 14, 26, 11][index % 4];
  reductionPct = Math.max(0, reductionPct);

  // --- Programme -----------------------------------------------------------
  const months =
    firstNumber(item.implementation_time_months) ??
    firstNumber(item.implementation_months) ??
    firstNumber(item.timeline_months) ??
    6;

  const coverageHa = firstNumber(item.coverage_area_ha);
  const storageM3 =
    firstNumber(item.storage_capacity_m3) ??
    Math.round((coverageHa ?? areaHa * 0.08) * 185);

  return {
    title: item.title || item.name || `Intervention ${index + 1}`,
    description: item.description || "",
    type: item.type || null,
    priority: item.priority || null,
    costLakhs,
    reductionPct,
    months,
    coverageHa,
    storageM3,
    coolingC: firstNumber(item.cooling_effect_c),
    kpi: item.kpi || "Stormwater peak velocity attenuation",
    department:
      item.responsible_department ||
      item.contact ||
      "Municipal Corporation Public Works",
    tenderCode:
      item.tender_code || `AMRUT-2.0/PKG-${String(index + 1).padStart(2, "0")}`,
  };
};

export const formatCrore = (lakhs) =>
  lakhs >= 100 ? `₹${(lakhs / 100).toFixed(2)} Cr` : `₹${lakhs.toFixed(1)} L`;

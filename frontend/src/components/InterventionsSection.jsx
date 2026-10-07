import React, { useState, useEffect } from "react";
import BillOfQuantitiesModal from "./BillOfQuantitiesModal";
import { readIntervention, formatCrore } from "../utils/interventions";

const InterventionCard = ({
  intervention,
  index,
  isSelected,
  onToggle,
  areaHa,
  stormIntensity,
  onOpenBoQ,
}) => {
  const v = readIntervention(intervention, index, areaHa, stormIntensity);
  const costFormatted = formatCrore(v.costLakhs);

  return (
    <div
      className={`intervention-card ${isSelected ? "selected-sandbox-card" : "unselected-sandbox-card"}`}
      onClick={() => onToggle(index)}
      style={{
        border: isSelected
          ? "1px solid var(--accent-border)"
          : "1px solid var(--border)",
        background: isSelected ? "var(--surface)" : "var(--surface-sunken)",
        boxShadow: "none",
        cursor: "pointer",
        transition: "all 0.25s ease",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <div
          className="intervention-title"
          style={{
            color: isSelected ? "var(--accent)" : "var(--text-secondary)",
            margin: 0,
          }}
        >
          #{index + 1}. {v.title}
        </div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: "700",
            padding: "4px 10px",
            borderRadius: "var(--r-sm)",
            background: isSelected ? "var(--accent-quiet)" : "var(--border)",
            color: isSelected ? "var(--accent)" : "var(--text-secondary)",
            border: isSelected
              ? "1px solid var(--accent-border)"
              : "1px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>{isSelected ? "In Policy Sandbox" : "+ Click to Enable"}</span>
        </div>
      </div>

      <div
        className="intervention-desc"
        style={{ color: isSelected ? "var(--text)" : "var(--text-muted)" }}
      >
        {v.description}
      </div>

      <div className="intervention-details">
        <div className="detail-item">
          <span className="detail-label">Runoff Reduction:</span>
          <span
            className="detail-value"
            style={{
              color: isSelected ? "var(--ok)" : "var(--text-muted)",
              fontWeight: "700",
            }}
          >
            −{v.reductionPct}%
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Estimated Cost:</span>
          <span className="detail-value">{costFormatted}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Timeline:</span>
          <span className="detail-value">{v.months} months</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">KPI:</span>
          <span className="detail-value">{v.kpi}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Retention:</span>
          <span className="detail-value">
            {v.storageM3.toLocaleString("en-IN")} m³
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Department:</span>
          <span className="detail-value">{v.department}</span>
        </div>
      </div>

      {/* The tender paperwork behind the card - opened without toggling it. */}
      <div className="intervention-tender">
        <span className="intervention-tender__code">{v.tenderCode}</span>
        <button
          className="btn-inline"
          onClick={(e) => {
            e.stopPropagation();
            onOpenBoQ(intervention, index, v.costLakhs);
          }}
          title="Itemised CPWD Schedule of Rates bill of quantities"
        >
          View CPWD BoQ
        </button>
      </div>
    </div>
  );
};

const InterventionsSection = ({
  interventions,
  loading,
  simulationData,
  onMitigationChange,
}) => {
  // Nothing is sanctioned until the user sanctions it. The board opens at the
  // unmitigated worst case so the effect of each intervention is visible as it
  // is switched on, rather than the demo starting halfway through the answer.
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [activeBoQ, setActiveBoQ] = useState(null);

  const areaHa = simulationData?.metrics?.area_ha || 100.0;
  const stormIntensity = simulationData?.metrics?.mean_rain_mm || 180.0;

  // Reset or initialize when interventions change
  useEffect(() => {
    if (interventions && interventions.length > 0) {
      setSelectedIndices([]);
    }
  }, [interventions]);

  const handleToggle = (index) => {
    let updated;
    if (selectedIndices.includes(index)) {
      updated = selectedIndices.filter((i) => i !== index);
    } else {
      updated = [...selectedIndices, index];
    }
    setSelectedIndices(updated);
  };

  // --- Live sandbox economics ------------------------------------------------
  // Read through the same normaliser the cards use, so the summary can never
  // disagree with the item it is summing.
  const activeReadings = (interventions || [])
    .map((item, idx) => ({
      idx,
      v: readIntervention(item, idx, areaHa, stormIntensity),
    }))
    .filter(({ idx }) => selectedIndices.includes(idx));

  const totalReductionPct = Math.round(
    Math.min(
      65,
      activeReadings.reduce((acc, { v }) => acc + v.reductionPct, 0),
    ),
  );

  const totalCostLakhs = activeReadings.reduce(
    (acc, { v }) => acc + v.costLakhs,
    0,
  );
  const totalCostCr = (totalCostLakhs / 100).toFixed(2);

  const basePeopleAtRisk = simulationData?.metrics?.scenario_people || 1500;
  const peopleProtected = Math.round(
    basePeopleAtRisk * (totalReductionPct / 100),
  );

  // Avoided damage was previously fixed at 5.4x the capital cost, which made
  // the net ROI read +440% no matter which interventions were selected. It is
  // now derived from the residents the works actually protect.
  //
  // ASSUMPTION, stated in the panel and open to revision: DAMAGE_PER_RESIDENT
  // is direct loss per person per design event, and EVENTS_PER_LIFECYCLE is how
  // many such events a 25-year asset is expected to see.
  const DAMAGE_PER_RESIDENT_INR = 12000;
  const EVENTS_PER_LIFECYCLE = 8;

  const damagePreventedCr = (
    (peopleProtected * DAMAGE_PER_RESIDENT_INR * EVENTS_PER_LIFECYCLE) /
    1e7
  ).toFixed(2);

  const netRoiPct =
    totalCostLakhs > 0
      ? Math.round(
          ((parseFloat(damagePreventedCr) - parseFloat(totalCostCr)) /
            parseFloat(totalCostCr)) *
            100,
        )
      : 0;

  // Notify parent of mitigation level only when value changes
  const prevReductionRef = React.useRef(-1);
  useEffect(() => {
    if (prevReductionRef.current !== totalReductionPct) {
      prevReductionRef.current = totalReductionPct;
      if (onMitigationChange) {
        onMitigationChange({
          totalReductionPct,
          activeCount: selectedIndices.length,
        });
      }
    }
  }, [totalReductionPct, selectedIndices.length, onMitigationChange]);

  if (!interventions || interventions.length === 0) return null;

  return (
    <div className="section">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <h3 style={{ margin: 0 }}>Green Infrastructure Sandbox</h3>
        <span
          style={{
            fontSize: "11px",
            color: "var(--accent)",
            fontWeight: "700",
          }}
        >
          {selectedIndices.length} of {interventions.length} Interventions
          Active
        </span>
      </div>

      {/* Live Municipal ROI Summary Card */}
      {!loading && (
        /* A single navy panel - the one dark surface in the rail, so the
           headline ROI numbers read as the summary of everything below. */
        <div
          style={{
            background: "var(--text)",
            border: "1px solid var(--text)",
            borderRadius: "var(--r-md)",
            padding: "var(--s-4)",
            color: "#FFFFFF",
            marginBottom: "var(--s-5)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(255,255,255,0.15)",
              paddingBottom: "10px",
              marginBottom: "14px",
            }}
          >
            <span
              style={{
                fontSize: "var(--t-label)",
                fontWeight: "600",
                color: "rgba(255,255,255,0.65)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Live municipal ROI &amp; risk offset
            </span>
            <span
              style={{
                fontSize: "var(--t-label)",
                background: "rgba(255,255,255,0.12)",
                padding: "2px 8px",
                borderRadius: "var(--r-sm)",
                color: "rgba(255,255,255,0.9)",
                fontWeight: "600",
              }}
            >
              Interactive
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "12px",
              textAlign: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "var(--t-label)",
                  color: "rgba(255,255,255,0.6)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "4px",
                }}
              >
                Runoff cut
              </div>
              <div
                className="num"
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#FFFFFF",
                }}
              >
                −{totalReductionPct}%
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: "var(--t-label)",
                  color: "rgba(255,255,255,0.6)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "4px",
                }}
              >
                Investment
              </div>
              <div
                className="num"
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#FFFFFF",
                }}
              >
                ₹{totalCostCr} Cr
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: "var(--t-label)",
                  color: "rgba(255,255,255,0.6)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "4px",
                }}
              >
                Damage averted
              </div>
              <div
                className="num"
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#6EE7A8",
                }}
              >
                ₹{damagePreventedCr} Cr
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: "var(--t-label)",
                  color: "rgba(255,255,255,0.6)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "4px",
                }}
              >
                Net ROI
              </div>
              <div
                className="num"
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#FFFFFF",
                }}
              >
                +{netRoiPct}%
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "12px",
              paddingTop: "10px",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              fontSize: "11px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.85)" }}>
              <strong>{peopleProtected.toLocaleString("en-IN")}</strong>{" "}
              residents protected from flood risk
            </span>
            <span style={{ color: "rgba(255,255,255,0.55)" }}>
              ₹{(DAMAGE_PER_RESIDENT_INR / 1000).toFixed(0)}k/resident ×{" "}
              {EVENTS_PER_LIFECYCLE} events
            </span>
          </div>
        </div>
      )}

      {/* Interventions Cards */}
      <div
        style={{
          opacity: loading ? 0.6 : 1,
          transition: "opacity 0.3s ease",
        }}
      >
        {loading ? (
          <div
            className="intervention-card"
            style={{
              textAlign: "center",
              padding: "20px",
              background: "rgba(255, 255, 255, 0.6)",
              border: "1px solid rgba(7, 23, 63, 0.1)",
              borderRadius: "12px",
              color: "var(--accent)",
              fontFamily: "Overpass, sans-serif",
              fontWeight: "600",
            }}
          >
            Generating AI-powered municipal recommendations...
          </div>
        ) : (
          <div className="interventions-list">
            {interventions.map((intervention, index) => (
              <InterventionCard
                key={index}
                intervention={intervention}
                index={index}
                isSelected={selectedIndices.includes(index)}
                onToggle={handleToggle}
                areaHa={areaHa}
                stormIntensity={stormIntensity}
                onOpenBoQ={(item, idx, costLakhs) =>
                  setActiveBoQ({ item, idx, costLakhs })
                }
              />
            ))}
          </div>
        )}
      </div>

      {!loading && interventions.length > 0 && (
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-secondary)",
            textAlign: "center",
            marginTop: "16px",
            fontFamily: "Overpass, sans-serif",
          }}
        >
          <em>
            Click cards above to toggle solutions and test policy combinations
            on the map.
          </em>
        </div>
      )}

      {activeBoQ && (
        <BillOfQuantitiesModal
          intervention={activeBoQ.item}
          index={activeBoQ.idx}
          areaHa={areaHa}
          costLakhs={activeBoQ.costLakhs}
          onClose={() => setActiveBoQ(null)}
        />
      )}
    </div>
  );
};

// Add CSS styles for the detail structure
const styles = `
.interventions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.intervention-tender {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.intervention-tender__code {
  font-family: var(--font-mono);
  font-size: var(--t-label);
  color: var(--text-muted);
}

.selected-sandbox-card:hover {
  transform: translateY(-2px);
}

.unselected-sandbox-card:hover {
  background: rgba(255, 255, 255, 0.9) !important;
}
`;

// Inject styles if not already present
if (
  typeof document !== "undefined" &&
  !document.getElementById("interventions-styles")
) {
  const styleSheet = document.createElement("style");
  styleSheet.id = "interventions-styles";
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default InterventionsSection;

import React, { useState, useEffect } from "react";
import "./EmergencyHotlineModal.css";
import { API_BASE } from "../config.js";

// The queue starts empty and fills from the live helpline feed. It used to be
// seeded with four invented emergencies, which meant the console showed
// citizens in danger who did not exist.
const INITIAL_CALL_RECORDS = [];

const EmergencyHotlineModal = ({
  isOpen,
  onClose,
  onShowToast,
  liveCalls = [],
  onClearCalls,
}) => {
  const [calls, setCalls] = useState(INITIAL_CALL_RECORDS);
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoggingCall, setIsLoggingCall] = useState(false);
  const [playingCallId, setPlayingCallId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Real calls from the helpline feed join the queue at the top. They carry
  // only what Twilio gives us on the answer webhook - no depth or need until
  // the dispatcher takes details - so those read as "awaiting triage" rather
  // than being invented.
  useEffect(() => {
    if (!liveCalls || liveCalls.length === 0) return;

    setCalls((prev) => {
      const known = new Set(prev.map((c) => c.id));
      const fresh = liveCalls
        .filter((c) => !known.has(c.id))
        .map((c) => ({
          id: c.id,
          callerName: "Live helpline caller",
          phone: c.phone,
          ward: c.origin,
          timestamp: `${c.received_display} (live)`,
          severity: "critical",
          waterDepth: "Awaiting triage",
          reliefNeed: "Awaiting triage - call in progress",
          transcript:
            "Live call received on the 1077 helpline. Transcription is not yet enabled on this line.",
          status: "pending",
          assignedUnit: null,
          audioDuration: "-",
          isLive: true,
        }));

      return fresh.length > 0 ? [...fresh, ...prev] : prev;
    });
  }, [liveCalls]);

  if (!isOpen) return null;

  const handleSimulateCall = async () => {
    setIsLoggingCall(true);

    try {
      const resp = await fetch(`${API_BASE}/api/voice/calls/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!resp.ok) throw new Error(`Backend returned ${resp.status}`);
      const data = await resp.json();

      // Deliberately not added to local state here: it lands on the helpline
      // feed and arrives through the same poll as a real call, so this path
      // exercises the live pipeline rather than faking its result.
      if (onShowToast) {
        onShowToast({
          message: `Test call placed on the helpline feed\nRef ${data.call?.id} · ${data.call?.phone}`,
          type: "success",
        });
      }
    } catch (e) {
      if (onShowToast) {
        onShowToast({
          message: `Could not reach the helpline feed\n${e.message}`,
          type: "error",
        });
      }
    } finally {
      setIsLoggingCall(false);
    }
  };

  // Assigning a unit also SMSes the caller. The backend falls back to a
  // simulator when Twilio isn't configured, so the demo never dead-ends.
  const handleAssignUnit = async (call, unitName) => {
    setCalls((prev) =>
      prev.map((c) =>
        c.id === call.id
          ? { ...c, status: "dispatched", assignedUnit: unitName }
          : c,
      ),
    );

    try {
      const resp = await fetch(`${API_BASE}/api/emergency/send-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_phone: call.phone,
          incident_id: call.id,
          caller_name: call.callerName,
          ward: call.ward,
          water_depth: call.waterDepth,
          relief_need: call.reliefNeed,
          assigned_unit: unitName,
        }),
      });
      const result = await resp.json();

      if (onShowToast) {
        onShowToast({
          message: `Dispatched ${unitName} to ${call.id}\n${result.mode === "live_carrier_sent" ? "Live SMS sent to" : "Simulated SMS queued for"} ${call.phone}`,
          type: "success",
        });
      }
    } catch (e) {
      if (onShowToast) {
        onShowToast({
          message: `Dispatched ${unitName} to ${call.id}\nSMS relay unavailable - backend offline`,
          type: "success",
        });
      }
    }
  };

  const handleTriggerVoiceCall = async (call) => {
    try {
      const resp = await fetch(`${API_BASE}/api/emergency/make-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_phone: call.phone,
          ward: call.ward,
          water_depth: call.waterDepth,
          assigned_unit: call.assignedUnit || "NDRF Quick Response Team",
        }),
      });
      const res = await resp.json();

      if (onShowToast) {
        onShowToast({
          message: `Automated voice alert to ${call.phone}\n${res.mode === "live_voice_call_initiated" ? "Live carrier call in progress" : "Simulator audio alert synthesised"}`,
          type: "success",
        });
      }
    } catch (err) {
      if (onShowToast) {
        onShowToast({
          message: `Voice broadcast unavailable for ${call.phone} - backend offline`,
          type: "error",
        });
      }
    }
  };

  const handleClearLog = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    setCalls([]);
    if (onClearCalls) await onClearCalls();
    if (onShowToast) {
      onShowToast({ message: "Call log cleared", type: "success" });
    }
  };

  const handleResolveCall = (callId) => {
    setCalls((prev) =>
      prev.map((c) => {
        if (c.id === callId) {
          return {
            ...c,
            status: "resolved",
            severity: "resolved",
            assignedUnit: c.assignedUnit || "District Evacuation Unit",
          };
        }
        return c;
      }),
    );

    if (onShowToast) {
      onShowToast({
        message: `Call ${callId} marked safely evacuated and resolved`,
        type: "success",
      });
    }
  };

  const handleToggleAudio = (callId) => {
    if (playingCallId === callId) {
      setPlayingCallId(null);
    } else {
      setPlayingCallId(callId);
      setTimeout(() => setPlayingCallId(null), 3500);
    }
  };

  const filteredCalls = calls.filter((c) => {
    if (filterSeverity !== "all" && c.severity !== filterSeverity) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.callerName.toLowerCase().includes(q) ||
        c.ward.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.reliefNeed.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const criticalCount = calls.filter(
    (c) => c.severity === "critical" && c.status !== "resolved",
  ).length;
  const highCount = calls.filter(
    (c) => c.severity === "high" && c.status !== "resolved",
  ).length;
  const resolvedCount = calls.filter((c) => c.status === "resolved").length;

  return (
    <div className="hotline-backdrop" onClick={onClose}>
      <div className="hotline-modal" onClick={(e) => e.stopPropagation()}>
        {/* Government Header */}
        <div className="hotline-header">
          <div className="hotline-header-left">
            <div className="emblem-badge" aria-hidden="true" />
            <div>
              <h2>Municipal Disaster Control Room & Citizen Helpline</h2>
              <p className="hotline-sub">
                District Emergency Operation Center (DEOC) • Helpline:{" "}
                <strong>1077 / 1070 / 0431-2401000</strong>
              </p>
            </div>
          </div>
          <div className="hotline-header-right">
            {calls.length > 0 && (
              <button
                className={`hotline-clear-btn${confirmClear ? " is-confirming" : ""}`}
                onClick={handleClearLog}
                onBlur={() => setConfirmClear(false)}
                title="Remove every call currently on the board"
              >
                {confirmClear ? "Confirm clear" : "Clear log"}
              </button>
            )}

            <button
              className="simulate-incoming-btn"
              onClick={handleSimulateCall}
              disabled={isLoggingCall}
            >
              {isLoggingCall ? "Placing…" : "Place Test Call"}
            </button>
            <button
              className="hotline-close-btn"
              onClick={onClose}
              title="Close"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Status Counters */}
        <div className="hotline-counters">
          <div className="counter-card red">
            <span className="counter-title">CRITICAL RESCUES PENDING</span>
            <span className="counter-num">{criticalCount}</span>
            <span className="counter-desc">Water level &gt; 1.0 meter</span>
          </div>
          <div className="counter-card orange">
            <span className="counter-title">HIGH PRIORITY RELIEF</span>
            <span className="counter-num">{highCount}</span>
            <span className="counter-desc">Medical / Food / Infants</span>
          </div>
          <div className="counter-card green">
            <span className="counter-title">SAFELY EVACUATED</span>
            <span className="counter-num">{resolvedCount}</span>
            <span className="counter-desc">
              Relocated to High-Ground Shelters
            </span>
          </div>
          <div className="counter-card blue">
            <span className="counter-title">TOTAL CALLS LOGGED</span>
            <span className="counter-num">{calls.length}</span>
            <span className="counter-desc">Active Ward Operations</span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="hotline-toolbar">
          <div className="tab-filters">
            <button
              className={`tab-btn ${filterSeverity === "all" ? "active" : ""}`}
              onClick={() => setFilterSeverity("all")}
            >
              All Calls ({calls.length})
            </button>
            <button
              className={`tab-btn red ${filterSeverity === "critical" ? "active" : ""}`}
              onClick={() => setFilterSeverity("critical")}
            >
              Critical ({criticalCount})
            </button>
            <button
              className={`tab-btn orange ${filterSeverity === "high" ? "active" : ""}`}
              onClick={() => setFilterSeverity("high")}
            >
              High Priority ({highCount})
            </button>
            <button
              className={`tab-btn green ${filterSeverity === "resolved" ? "active" : ""}`}
              onClick={() => setFilterSeverity("resolved")}
            >
              Evacuated ({resolvedCount})
            </button>
          </div>

          <div className="search-wrap">
            <input
              type="text"
              placeholder="Search by caller, ward, phone, or request..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Dispatch Log Table / Cards */}
        <div className="hotline-records-scroll">
          {filteredCalls.length === 0 ? (
            <div className="no-records">
              {calls.length === 0 ? (
                <>
                  <strong>The line is open and quiet.</strong>
                  <span>
                    Calls to the 1077 helpline appear here the moment they
                    connect.
                  </span>
                </>
              ) : (
                <span>No calls match the current filter.</span>
              )}
            </div>
          ) : (
            filteredCalls.map((item) => (
              <div
                key={item.id}
                className={`hotline-card severity-${item.severity}`}
              >
                <div className="hotline-card-header">
                  <div className="caller-col">
                    <span className="call-ref">{item.id}</span>
                    <strong className="caller-title">{item.callerName}</strong>
                    <span className="phone-tag">{item.phone}</span>
                    <span className="time-tag">{item.timestamp}</span>
                  </div>

                  <div className="status-badges">
                    <span className={`pill-badge ${item.severity}`}>
                      {item.severity === "critical"
                        ? "Critical"
                        : item.severity === "high"
                          ? "High"
                          : item.severity === "resolved"
                            ? "Evacuated"
                            : "Medium"}
                    </span>
                    <span className={`dispatch-pill ${item.status}`}>
                      {item.status === "resolved"
                        ? "Evacuated & Resolved"
                        : item.status === "dispatched"
                          ? "Unit Dispatched"
                          : "Pending Dispatch"}
                    </span>
                  </div>
                </div>

                <div className="hotline-card-grid">
                  <div className="grid-left">
                    <div className="row-item">
                      <span className="row-label">Ward / Locality:</span>
                      <strong className="row-val">{item.ward}</strong>
                    </div>
                    <div className="row-item">
                      <span className="row-label">Water Level:</span>
                      <span className="row-val depth">{item.waterDepth}</span>
                    </div>
                    <div className="row-item">
                      <span className="row-label">Required Assistance:</span>
                      <span className="row-val need">{item.reliefNeed}</span>
                    </div>
                  </div>

                  <div className="grid-right">
                    <div className="recording-box">
                      <div className="recording-top">
                        <span className="rec-title">
                          Voice Call Audio Log ({item.audioDuration})
                        </span>
                        <button
                          className={`play-rec-btn ${playingCallId === item.id ? "playing" : ""}`}
                          onClick={() => handleToggleAudio(item.id)}
                        >
                          {playingCallId === item.id
                            ? "Playing…"
                            : "Play recording"}
                        </button>
                      </div>
                      <p className="rec-text">"{item.transcript}"</p>
                    </div>
                  </div>
                </div>

                {item.assignedUnit && (
                  <div className="dispatched-unit-tag">
                    <span>
                      Assigned Field Unit: <strong>{item.assignedUnit}</strong>
                    </span>
                  </div>
                )}

                <div className="hotline-card-footer">
                  <div className="action-buttons-group">
                    {item.status !== "resolved" && (
                      <>
                        <button
                          className="dispatch-action-btn boat"
                          onClick={() =>
                            handleAssignUnit(
                              item,
                              "NDRF Rescue Boat Team #B-08",
                            )
                          }
                        >
                          Dispatch NDRF Boat
                        </button>
                        <button
                          className="dispatch-action-btn bus"
                          onClick={() =>
                            handleAssignUnit(
                              item,
                              "Relief Evacuation Bus #TR-04",
                            )
                          }
                        >
                          Route to High-Ground Shelter
                        </button>
                        <button
                          className="dispatch-action-btn supply"
                          onClick={() =>
                            handleAssignUnit(
                              item,
                              "Municipal Food & Drinking Water Team",
                            )
                          }
                        >
                          Send Drinking Water & Ration
                        </button>
                        <button
                          className="dispatch-action-btn call"
                          onClick={() => handleTriggerVoiceCall(item)}
                          title="Place an automated Twilio voice alert to this caller"
                        >
                          Place Automated Voice Alert
                        </button>
                      </>
                    )}
                  </div>

                  <div className="resolve-group">
                    {item.status !== "resolved" ? (
                      <button
                        className="resolve-action-btn"
                        onClick={() => handleResolveCall(item.id)}
                      >
                        Mark Safely Evacuated
                      </button>
                    ) : (
                      <span className="evacuated-label">
                        Resident safely evacuated to relief shelter
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default EmergencyHotlineModal;

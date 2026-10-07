import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE } from "../config.js";

const POLL_MS = 4000;

/**
 * Polls the helpline's live call feed.
 *
 * The backend hands back a monotonic sequence number, so each poll asks only
 * for what this client hasn't seen yet - no client-side de-duplication, and
 * a restarted backend simply starts the board again from zero.
 *
 * The first poll is treated as a baseline: whatever is already in the backend
 * log is listed in the queue, but it raises no alert. Only a call that lands
 * while this page is open makes the console ring - reloading the tab must not
 * replay old calls as though they were new.
 *
 * Returns the full session log (newest first) plus the calls that haven't
 * been acknowledged, which are what the alert stack renders.
 */
export function useIncomingCalls({ enabled = true } = {}) {
  const [calls, setCalls] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const sinceRef = useRef(0);
  const primedRef = useRef(false);

  const dismissAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const dismissAll = useCallback(() => setAlerts([]), []);

  /** Wipes the log on the backend and locally, and rewinds the cursor. */
  const clearCalls = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/voice/calls/clear`, { method: "POST" });
    } catch (e) {
      // Clear the local view regardless - the backend may simply be down.
    }
    sinceRef.current = 0;
    setCalls([]);
    setAlerts([]);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;

    const poll = async () => {
      try {
        const resp = await fetch(
          `${API_BASE}/api/voice/calls?since=${sinceRef.current}`,
        );
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled) return;

        // A backend restart rewinds the sequence; follow it back down rather
        // than going permanently silent.
        if (
          typeof data.latest_seq === "number" &&
          data.latest_seq < sinceRef.current
        ) {
          sinceRef.current = 0;
          setCalls([]);
          return;
        }

        if (Array.isArray(data.calls) && data.calls.length > 0) {
          sinceRef.current = data.calls[data.calls.length - 1].seq;
          const incoming = [...data.calls].reverse();

          // Anything already logged when the page opened is history, not news.
          setCalls((prev) => [...incoming, ...prev].slice(0, 50));
          if (primedRef.current) {
            setAlerts((prev) => [...incoming, ...prev].slice(0, 4));
          }
        }

        primedRef.current = true;
      } catch (e) {
        // Backend offline - the status card already reports that.
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);

  return { calls, alerts, dismissAlert, dismissAll, clearCalls };
}

import React from 'react';
import './LiveCallAlerts.css';

/**
 * Live incoming-call notifications.
 *
 * These stay until they're acted on rather than auto-dismissing like a toast:
 * a citizen on the helpline is not a transient confirmation, and losing one
 * off the top of the screen during a demo is exactly the wrong behaviour.
 */
const LiveCallAlerts = ({ alerts, onOpenConsole, onDismiss, onDismissAll }) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="call-alerts" role="region" aria-label="Incoming helpline calls">
      <div className="call-alerts__head">
        <span className="call-alerts__count">
          {alerts.length} live {alerts.length === 1 ? 'call' : 'calls'}
        </span>
        {alerts.length > 1 && (
          <button className="call-alerts__clear" onClick={onDismissAll}>
            Dismiss all
          </button>
        )}
      </div>

      {alerts.map((call) => (
        <article key={call.id} className="call-alert">
          <header className="call-alert__head">
            <span className="call-alert__live">
              <span className="call-alert__pulse" aria-hidden="true" />
              Incoming call
            </span>
            <button
              className="call-alert__dismiss"
              onClick={() => onDismiss(call.id)}
              title="Dismiss"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </header>

          <div className="call-alert__phone num">{call.phone}</div>

          <dl className="call-alert__meta">
            <div>
              <dt>Origin</dt>
              <dd>{call.origin}</dd>
            </div>
            <div>
              <dt>Received</dt>
              <dd className="num">{call.received_display}</dd>
            </div>
            <div>
              <dt>Ref</dt>
              <dd className="num">{call.id}</dd>
            </div>
          </dl>

          <button
            className="call-alert__action"
            onClick={() => {
              onOpenConsole();
              onDismiss(call.id);
            }}
          >
            Open control room
          </button>
        </article>
      ))}
    </div>
  );
};

export default React.memo(LiveCallAlerts);

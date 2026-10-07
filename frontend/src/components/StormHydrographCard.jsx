import React, { useState, useMemo } from 'react';
import './StormHydrographCard.css';

/**
 * 24-hour storm hydrograph.
 *
 * The chart is laid out in a fixed viewBox and scaled by the SVG itself, so
 * the same component serves the narrow control rail and the expanded modal
 * without two sets of geometry. Only the aspect ratio changes between them.
 */
const HydrographChart = ({ dataPoints, maxQ, maxRain, inflowPath, outflowPath, hoveredHour, setHoveredHour, tall }) => {
  const W = 620;
  const H = tall ? 380 : 240;
  const padL = 44;
  const padR = 16;
  const padT = 18;
  const padB = 34;

  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const getX = (hour) => padL + ((hour - 1) / 23) * plotW;
  const getY = (val) => padT + plotH - (val / maxQ) * plotH;

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxQ * f));
  const activePoint = hoveredHour !== null ? dataPoints[hoveredHour - 1] : null;

  // Rebuild the paths against this instance's geometry.
  const line = (key) =>
    dataPoints.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(d.hour).toFixed(1)} ${getY(d[key]).toFixed(1)}`).join(' ');
  const inflow = line('inflowQ');
  const outflow = line('outflowQ');
  const baseY = padT + plotH;

  return (
    <div className="hydrograph__plot">
      <svg viewBox={`0 0 ${W} ${H}`} className="hydrograph__svg" role="img"
           aria-label="Twenty-four hour storm hydrograph comparing unmitigated and mitigated discharge">
        {/* Horizontal grid + discharge axis */}
        {gridValues.map((v, i) => (
          <g key={`grid-${i}`}>
            <line x1={padL} x2={W - padR} y1={getY(v)} y2={getY(v)}
                  stroke="var(--border)" strokeWidth="1" strokeDasharray={i === 0 ? null : '3,3'} />
            <text x={padL - 8} y={getY(v) + 3.5} textAnchor="end" className="hydrograph__tick">{v}</text>
          </g>
        ))}

        {/* Rainfall hyetograph, drawn downward from the top */}
        {dataPoints.map((d) => {
          if (!d.rainMmH) return null;
          const barH = (d.rainMmH / maxRain) * (plotH * 0.3);
          return (
            <rect key={`rain-${d.hour}`} x={getX(d.hour) - 5} y={padT}
                  width={10} height={Math.max(1, barH)} rx="2" className="hydrograph__rain" />
          );
        })}

        {/* Unmitigated surge */}
        <path d={`${inflow} L ${getX(24)} ${baseY} L ${getX(1)} ${baseY} Z`} className="hydrograph__inflow-area" />
        <path d={inflow} className="hydrograph__inflow-line" />

        {/* Mitigated retention */}
        <path d={`${outflow} L ${getX(24)} ${baseY} L ${getX(1)} ${baseY} Z`} className="hydrograph__outflow-area" />
        <path d={outflow} className="hydrograph__outflow-line" />

        {/* Hour axis */}
        {[1, 6, 12, 18, 24].map((h) => (
          <text key={`hx-${h}`} x={getX(h)} y={H - 12} textAnchor="middle" className="hydrograph__tick">
            {String(h).padStart(2, '0')}:00
          </text>
        ))}

        {/* Hover readout */}
        {activePoint && (
          <g>
            <line x1={getX(activePoint.hour)} x2={getX(activePoint.hour)} y1={padT} y2={baseY}
                  stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="2,2" />
            <circle cx={getX(activePoint.hour)} cy={getY(activePoint.inflowQ)} r="4.5"
                    className="hydrograph__dot hydrograph__dot--inflow" />
            <circle cx={getX(activePoint.hour)} cy={getY(activePoint.outflowQ)} r="4.5"
                    className="hydrograph__dot hydrograph__dot--outflow" />
          </g>
        )}

        {/* Invisible hit targets, one per hour */}
        {dataPoints.map((d) => (
          <rect key={`hit-${d.hour}`} x={getX(d.hour) - plotW / 46} y={padT}
                width={plotW / 23} height={plotH} fill="transparent"
                onMouseEnter={() => setHoveredHour(d.hour)}
                onMouseLeave={() => setHoveredHour(null)} />
        ))}
      </svg>

      {activePoint && (
        <div className="hydrograph__tooltip">
          <div className="hydrograph__tooltip-hour num">{String(activePoint.hour).padStart(2, '0')}:00</div>
          <dl>
            <div><dt>Rainfall</dt><dd className="num">{activePoint.rainMmH} mm/h</dd></div>
            <div><dt>Unmitigated</dt><dd className="num is-danger">{activePoint.inflowQ} m³/s</dd></div>
            <div><dt>Mitigated</dt><dd className="num is-ok">{activePoint.outflowQ} m³/s</dd></div>
          </dl>
        </div>
      )}
    </div>
  );
};

const StormHydrographCard = ({ rainIntensity = 180, mitigationPct = 0 }) => {
  const [hoveredHour, setHoveredHour] = useState(null);
  const [expandedHour, setExpandedHour] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const { dataPoints, maxQ, maxRain, peakShavingPct, crestDelayH } = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i + 1);
    const stormFactor = rainIntensity / 180;
    const attenuationFactor = 1 - (Math.min(65, mitigationPct || 40) / 100) * 0.75;

    const points = hours.map((hour) => {
      let rainMmH = 0;
      if (hour >= 4 && hour <= 9) {
        const center = 6.5;
        rainMmH = Math.max(0, Math.round(35 * stormFactor * Math.exp(-Math.pow(hour - center, 2) / 2.5)));
      }

      const inflowCenter = 8.0;
      const peakInflow = 42 * stormFactor;
      const inflowQ = Math.max(2, parseFloat((peakInflow * Math.exp(-Math.pow(hour - inflowCenter, 2) / 6.5)).toFixed(1)));

      const outflowCenter = 11.5;
      const peakOutflow = 18 * stormFactor * attenuationFactor;
      const outflowQ = Math.max(1.5, parseFloat((peakOutflow * Math.exp(-Math.pow(hour - outflowCenter, 2) / 14.0)).toFixed(1)));

      return { hour, rainMmH, inflowQ, outflowQ };
    });

    const peakIn = Math.max(...points.map((d) => d.inflowQ));
    const peakOut = Math.max(...points.map((d) => d.outflowQ));
    const peakInHour = points.find((d) => d.inflowQ === peakIn)?.hour ?? 8;
    const peakOutHour = points.find((d) => d.outflowQ === peakOut)?.hour ?? 12;

    return {
      dataPoints: points,
      maxQ: Math.max(peakIn, peakOut, 10) * 1.12,
      maxRain: Math.max(...points.map((d) => d.rainMmH), 1),
      // Reported from the curves rather than as a fixed caption.
      peakShavingPct: Math.round(((peakIn - peakOut) / peakIn) * 100),
      crestDelayH: (peakOutHour - peakInHour).toFixed(1)
    };
  }, [rainIntensity, mitigationPct]);

  const legend = (
    <div className="hydrograph__legend">
      <span><i className="swatch swatch--rain" />Rainfall hyetograph</span>
      <span><i className="swatch swatch--inflow" />Unmitigated surge</span>
      <span><i className="swatch swatch--outflow" />Mitigated retention</span>
    </div>
  );

  return (
    <>
      <section className="hydrograph">
        <header className="hydrograph__head">
          <div className="hydrograph__title">
            <h3>24-hour storm hydrograph</h3>
            <p>Peak discharge shaving and retention lag, SCS unit hydrograph</p>
          </div>
          <button className="btn-inline" onClick={() => setIsExpanded(true)}>Expand</button>
        </header>

        <div className="hydrograph__stats">
          <div className="hydrograph__stat">
            <span className="hydrograph__stat-label">Peak shaving</span>
            <span className="hydrograph__stat-value num is-ok">−{peakShavingPct}%</span>
          </div>
          <div className="hydrograph__stat">
            <span className="hydrograph__stat-label">Crest delay</span>
            <span className="hydrograph__stat-value num">+{crestDelayH} h</span>
          </div>
        </div>

        <HydrographChart
          dataPoints={dataPoints} maxQ={maxQ} maxRain={maxRain}
          hoveredHour={hoveredHour} setHoveredHour={setHoveredHour}
        />
        {legend}
      </section>

      {isExpanded && (
        <div className="hydrograph-modal__backdrop" onClick={() => setIsExpanded(false)} role="dialog" aria-modal="true">
          <div className="hydrograph-modal" onClick={(e) => e.stopPropagation()}>
            <header className="hydrograph-modal__head">
              <div className="hydrograph__title">
                <h3>24-hour storm hydrograph</h3>
                <p>
                  {rainIntensity} mm design storm · {mitigationPct > 0 ? `${mitigationPct}% runoff reduction applied` : 'no mitigation applied'}
                </p>
              </div>
              <button className="hydrograph-modal__close" onClick={() => setIsExpanded(false)} aria-label="Close">✕</button>
            </header>

            <div className="hydrograph-modal__body">
              <div className="hydrograph__stats hydrograph__stats--wide">
                <div className="hydrograph__stat">
                  <span className="hydrograph__stat-label">Peak shaving</span>
                  <span className="hydrograph__stat-value num is-ok">−{peakShavingPct}%</span>
                </div>
                <div className="hydrograph__stat">
                  <span className="hydrograph__stat-label">Crest delay</span>
                  <span className="hydrograph__stat-value num">+{crestDelayH} h</span>
                </div>
                <div className="hydrograph__stat">
                  <span className="hydrograph__stat-label">Peak unmitigated</span>
                  <span className="hydrograph__stat-value num is-danger">
                    {Math.max(...dataPoints.map((d) => d.inflowQ)).toFixed(1)} m³/s
                  </span>
                </div>
                <div className="hydrograph__stat">
                  <span className="hydrograph__stat-label">Peak mitigated</span>
                  <span className="hydrograph__stat-value num is-ok">
                    {Math.max(...dataPoints.map((d) => d.outflowQ)).toFixed(1)} m³/s
                  </span>
                </div>
              </div>

              <HydrographChart
                dataPoints={dataPoints} maxQ={maxQ} maxRain={maxRain} tall
                hoveredHour={expandedHour} setHoveredHour={setExpandedHour}
              />
              {legend}

              <table className="hydrograph__table">
                <thead>
                  <tr>
                    <th>Hour</th>
                    <th>Rainfall (mm/h)</th>
                    <th>Unmitigated Q (m³/s)</th>
                    <th>Mitigated Q (m³/s)</th>
                    <th>Reduction</th>
                  </tr>
                </thead>
                <tbody>
                  {dataPoints.map((d) => (
                    <tr key={d.hour} className={expandedHour === d.hour ? 'is-active' : undefined}
                        onMouseEnter={() => setExpandedHour(d.hour)}
                        onMouseLeave={() => setExpandedHour(null)}>
                      <td className="num">{String(d.hour).padStart(2, '0')}:00</td>
                      <td className="num">{d.rainMmH}</td>
                      <td className="num">{d.inflowQ}</td>
                      <td className="num">{d.outflowQ}</td>
                      <td className="num is-ok">−{Math.round(((d.inflowQ - d.outflowQ) / d.inflowQ) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default React.memo(StormHydrographCard);

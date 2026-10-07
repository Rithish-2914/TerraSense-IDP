import React from 'react';

const PlanImpactCard = ({ simulationData, scenario, loading }) => {
  if (!simulationData) return null;

  const metrics = simulationData.metrics || {};
  const baselineMetrics = simulationData.baseline_runoff || {};
  const scenarioMetrics = simulationData.scenario_runoff || {};

  // Use only real backend data - no mock calculations
  const runoffChange = metrics.peak_runoff_change_pct || 0;
  const baselineRunoff = baselineMetrics.runoff_depth_mm || 0;
  const scenarioRunoff = scenarioMetrics.runoff_depth_mm || 0;
  
  const planImpacts = [
    {
      parameter: 'Surface Runoff Depth',
      baseline: baselineRunoff,
      scenario: scenarioRunoff,
      change: runoffChange,
      unit: 'mm',
      impact: runoffChange > 20 ? 'High Impact' : runoffChange > 10 ? 'Medium Impact' : 'Low Impact',
      hasComparison: true
    },
    {
      parameter: 'Population at Flood Risk',
      baseline: metrics.baseline_people || 0,
      scenario: metrics.scenario_people || 0,
      change: metrics.baseline_people ? ((metrics.scenario_people || 0) - metrics.baseline_people) / metrics.baseline_people * 100 : 0,
      unit: 'people',
      impact: 'Flood Exposure',
      hasComparison: true
    },
    {
      parameter: 'Surface Temperature',
      baseline: metrics.baseline_temperature_c || 0,
      scenario: metrics.mean_temperature_c || 0,
      change: (metrics.mean_temperature_c || 0) - (metrics.baseline_temperature_c || 0),
      unit: '°C',
      impact: metrics.heat_stress_level || 'Unknown',
      hasComparison: true
    },
    {
      parameter: 'Heat Affected Population',
      baseline: 0,
      scenario: metrics.heat_affected_people || 0,
      change: 0,
      unit: 'people',
      impact: `${metrics.heat_stress_level || 'Unknown'} Heat Stress`,
      hasComparison: false
    }
  ];

  return (
    <div className="section">
      <h3>Plan Impact Analysis</h3>
      <div className="metrics-card" style={{
        opacity: loading ? 0.6 : 1,
        transition: 'opacity 0.3s ease'
      }}>
        {planImpacts.map((impact, index) => (
          <div key={index} className="metric-item" style={{
            borderBottom: index < planImpacts.length - 1 ? '1px solid #eee' : 'none',
            paddingBottom: '10px',
            marginBottom: '10px'
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
              {impact.parameter}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {impact.hasComparison ? (
                <>
                  <span style={{ fontSize: '11px', color: '#888' }}>
                    {loading ? '' : `Baseline: ${impact.baseline.toLocaleString()}${impact.unit}`}
                  </span>
                  <span style={{ fontSize: '11px', color: '#888' }}>
                    {loading ? '' : `Scenario: ${impact.scenario.toLocaleString()}${impact.unit}`}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: '11px', color: '#888' }}>
                  {loading ? '' : `Current: ${impact.scenario.toLocaleString()} ${impact.unit} affected`}
                </span>
              )}
            </div>
            <div style={{ 
              marginTop: '6px',
              fontSize: '13px',
              fontWeight: 'bold',
              color: !impact.hasComparison ? '#666' :
                     Math.abs(impact.change) > 15 ? 'var(--danger)' : 
                     Math.abs(impact.change) > 5 ? 'var(--warn)' : 'var(--accent)'
            }}>
              {loading ? 'Calculating...' : 
                !impact.hasComparison ? 
                  `${impact.impact}` :
                impact.change > 0 ? 
                  `+${impact.parameter === 'Surface Temperature' ? impact.change.toFixed(1) : impact.change.toFixed(1)}${impact.parameter === 'Surface Temperature' ? '°C' : '% '} increase • ${impact.impact}` :
                impact.change < 0 ? 
                  `${impact.parameter === 'Surface Temperature' ? impact.change.toFixed(1) : impact.change.toFixed(1)}${impact.parameter === 'Surface Temperature' ? '°C' : '% '} decrease • ${impact.impact}` :
                `No change • ${impact.impact}`
              }
            </div>
          </div>
        ))}
        
        <div style={{
          marginTop: '12px',
          padding: '10px',
          background: 'var(--surface-sunken)',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#666'
        }}>
          <strong>Scenario:</strong> {scenario === 'baseline' ? 'Current Conditions' : scenario === 'rcp45' ? '+10% Rainfall (RCP 4.5)' : 'Climate Scenario'}
          <br />
          <strong>Analysis:</strong> Real NASA satellite data processing with SCS hydrological modeling
        </div>
      </div>
      
      {loading && (
        <div style={{
          fontSize: '11px',
          color: '#666',
          textAlign: 'center',
          marginTop: '8px'
        }}>
          ⏳ Computing plan impact analysis...
        </div>
      )}
    </div>
  );
};

export default PlanImpactCard;
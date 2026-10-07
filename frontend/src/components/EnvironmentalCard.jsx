import React from 'react';

const EnvironmentalCard = ({ metrics, loading }) => {
  if (!metrics) return null;

  // Use only real backend data with proper fallbacks
  const imperviousFraction = metrics.impervious_fraction || 0;
  const temperature = metrics.mean_temperature_c || 0;
  const hasValidData = imperviousFraction > 0 || temperature > 0;
  
  // Categorize impervious surface level based on real calculated data
  let imperviousLevel, imperviousColor;
  if (imperviousFraction < 0.3) {
    imperviousLevel = 'Low Urbanization';
    imperviousColor = 'var(--accent)'; // NASA Blue
  } else if (imperviousFraction < 0.6) {
    imperviousLevel = 'Medium Urbanization';
    imperviousColor = 'var(--warn)'; // NASA Yellow
  } else {
    imperviousLevel = 'High Urbanization';
    imperviousColor = 'var(--danger)'; // NASA Red
  }

  return (
    <div className="section">
      <h3>Environmental Parameters</h3>
      <div className="metrics-card" style={{
        opacity: loading ? 0.6 : 1,
        transition: 'opacity 0.3s ease'
      }}>
        <div className="metric-item">
          <span className="metric-label">Surface Temperature:</span>
          <span className="metric-value">
            {loading ? 'Loading...' : `${temperature.toFixed(1)}°C`}
          </span>
        </div>
        
        <div className="metric-item">
          <span className="metric-label">Impervious Surface:</span>
          <span className="metric-value" style={{
            color: loading ? '#999' : imperviousColor
          }}>
            {loading ? 'Calculating...' : `${(imperviousFraction * 100).toFixed(0)}% (${imperviousLevel})`}
          </span>
        </div>
        
        <div className="metric-item">
          <span className="metric-label">Area Coverage:</span>
          <span className="metric-value">
            {loading ? 'Loading...' : `${(metrics.area_ha || 0).toFixed(1)} hectares`}
          </span>
        </div>
        
        <div className="metric-item">
          <span className="metric-label">Population Density:</span>
          <span className="metric-value">
            {loading ? 'Loading...' : `${(metrics.population_density || 0).toFixed(1)} people/ha`}
          </span>
        </div>
        
        <div className="metric-item">
          <span className="metric-label">Mean Elevation:</span>
          <span className="metric-value">
            {loading ? 'Loading...' : `${(metrics.elevation_m || 0).toFixed(1)}m ASL`}
          </span>
        </div>
      </div>
      
      {loading && (
        <div style={{
          fontSize: '11px',
          color: 'var(--accent)',
          textAlign: 'center',
          marginTop: '8px',
          fontFamily: 'Overpass, sans-serif',
          fontWeight: '600'
        }}>
          Processing environmental data...
        </div>
      )}
    </div>
  );
};

export default EnvironmentalCard;
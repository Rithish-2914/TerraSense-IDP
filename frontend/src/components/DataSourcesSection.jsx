import React from 'react';

const DataSourcesSection = () => {
  const dataSources = [
    { name: 'NASA GPM IMERG', description: 'Precipitation Data' },
    { name: 'NASA SMAP', description: 'Soil Moisture' },
    { name: 'SRTM', description: 'Digital Elevation Model' },
    { name: 'WorldPop', description: 'Population Density' },
    { name: 'VIIRS DNB', description: 'Nighttime Lights' },
    { name: 'MODIS LST', description: 'Land Surface Temperature' },
    { name: 'Google Earth Engine', description: 'Data Processing Platform' }
  ];

  return (
    <div className="section">
      <h3>Data Sources</h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '10px'
      }}>
        {dataSources.map((source, index) => (
          <div 
            key={index}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.6)',
              border: '1px solid rgba(7, 23, 63, 0.08)',
              borderRadius: '8px',
              fontSize: '12px'
            }}
          >
            <span style={{
              fontFamily: 'Fira Sans, sans-serif',
              fontWeight: '600',
              color: 'var(--text)'
            }}>
              {source.name}
            </span>
            <span style={{
              fontFamily: 'Overpass, sans-serif',
              fontSize: '11px',
              color: 'var(--accent)',
              fontWeight: '500'
            }}>
              {source.description}
            </span>
          </div>
        ))}
      </div>
      
      <div style={{
        marginTop: '12px',
        padding: '8px',
        background: 'rgba(46, 150, 245, 0.04)',
        border: '1px solid rgba(46, 150, 245, 0.15)',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <span style={{
          fontSize: '11px',
          color: 'var(--accent)',
          fontFamily: 'Overpass, sans-serif',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          All data processed through NASA Earth Engine
        </span>
      </div>
    </div>
  );
};

export default DataSourcesSection;
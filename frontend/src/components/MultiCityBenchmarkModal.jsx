import React, { useEffect } from 'react';
import './MultiCityBenchmarkModal.css';

const CITIES_DATA = [
  {
    id: 'trichy',
    name: 'Trichy Pilot Ward',
    state: 'Tamil Nadu',
    basin: 'Cauvery River Catchment',
    fileName: 'trichy_area.geojson',
    elevationMsl: '+85 m MSL',
    areaHa: 100,
    imperviousPct: 65,
    cloudburstRisk: 'Severe (+74%)',
    peopleAtRisk: 1480,
    lstTemp: '34.2°C',
    recommendedBudgetCr: '₹1.65 Cr',
    primaryIntervention: 'Smart Retention Basins & Bioswales',
    riskLevel: 'High'
  },
  {
    id: 'mumbai',
    name: 'Mumbai Metropolis',
    state: 'Maharashtra',
    basin: 'Mithi River & Arabian Sea Coast',
    fileName: 'mumbai_area.geojson',
    elevationMsl: '+8 m MSL',
    areaHa: 280,
    imperviousPct: 84,
    cloudburstRisk: 'Critical (+115%)',
    peopleAtRisk: 5200,
    lstTemp: '36.8°C',
    recommendedBudgetCr: '₹4.80 Cr',
    primaryIntervention: 'Underground Holding Vaults & Mangrove Sinks',
    riskLevel: 'Critical'
  },
  {
    id: 'chennai',
    name: 'Chennai Coastal Ward',
    state: 'Tamil Nadu',
    basin: 'Adyar / Cooum Delta',
    fileName: 'chennai_area.geojson',
    elevationMsl: '+7 m MSL',
    areaHa: 210,
    imperviousPct: 78,
    cloudburstRisk: 'Severe (+92%)',
    peopleAtRisk: 4100,
    lstTemp: '37.5°C',
    recommendedBudgetCr: '₹3.40 Cr',
    primaryIntervention: 'Inter-Connected Micro-Ponds & Sluice Gates',
    riskLevel: 'Critical'
  },
  {
    id: 'bangalore',
    name: 'Bangalore Lake Cascade',
    state: 'Karnataka',
    basin: 'Vrishabhavathi / Bellandur Basin',
    fileName: 'bangalore_area.geojson',
    elevationMsl: '+920 m MSL',
    areaHa: 190,
    imperviousPct: 72,
    cloudburstRisk: 'High (+65%)',
    peopleAtRisk: 2900,
    lstTemp: '31.4°C',
    recommendedBudgetCr: '₹2.90 Cr',
    primaryIntervention: 'Lake Inflow Silt Traps & Permeable Pavements',
    riskLevel: 'High'
  },
  {
    id: 'delhi',
    name: 'Delhi Yamuna Floodplain',
    state: 'NCR',
    basin: 'Yamuna River Corridor',
    fileName: 'delhi_area.geojson',
    elevationMsl: '+216 m MSL',
    areaHa: 240,
    imperviousPct: 81,
    cloudburstRisk: 'Severe (+88%)',
    peopleAtRisk: 4800,
    lstTemp: '39.8°C',
    recommendedBudgetCr: '₹4.10 Cr',
    primaryIntervention: 'Floodplain Sponge Wetlands & Cool Pavements',
    riskLevel: 'Critical'
  },
  {
    id: 'kolkata',
    name: 'Kolkata Delta Ward',
    state: 'West Bengal',
    basin: 'Hooghly Estuary & East Wetlands',
    fileName: 'kolkata_area.geojson',
    elevationMsl: '+9 m MSL',
    areaHa: 175,
    imperviousPct: 76,
    cloudburstRisk: 'High (+70%)',
    peopleAtRisk: 3400,
    lstTemp: '35.0°C',
    recommendedBudgetCr: '₹2.75 Cr',
    primaryIntervention: 'Tidal Sluice Automation & Wetland Retention',
    riskLevel: 'High'
  }
];

const MultiCityBenchmarkModal = ({ isOpen, onClose, onSelectCity, currentCityName }) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="benchmark-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="benchmark-modal" onClick={(e) => e.stopPropagation()}>
        <header className="benchmark-header">
          <div>
            <div className="benchmark-eyebrow">Smart Cities Mission · national vulnerability index</div>
            <h2>Multi-city climate vulnerability matrix</h2>
          </div>
          <button className="benchmark-close" onClick={onClose} title="Close" aria-label="Close">✕</button>
        </header>

        <div className="benchmark-body">
          <p className="benchmark-intro">
            Calibrated spatial hydrology baselines across six Indian municipal catchments.
            Choose <strong>Simulate</strong> to move the digital twin onto that study area.
          </p>

          <div className="benchmark-table-wrap">
            <table className="benchmark-table">
              <thead>
                <tr>
                  <th>City / study ward</th>
                  <th>Catchment basin</th>
                  <th>Elevation</th>
                  <th>Impervious</th>
                  <th>Cloudburst surge</th>
                  <th>Exposed pop.</th>
                  <th>Budget</th>
                  <th aria-label="Action" />
                </tr>
              </thead>
              <tbody>
                {CITIES_DATA.map((city) => {
                  const isActive = currentCityName && currentCityName.toLowerCase().includes(city.id);
                  return (
                    <tr key={city.id} className={isActive ? 'is-active' : undefined}>
                      <td>
                        <div className="benchmark-city">{city.name}</div>
                        <div className="benchmark-city__meta">{city.state} · {city.areaHa} ha</div>
                      </td>
                      <td className="benchmark-muted">{city.basin}</td>
                      <td className="num benchmark-muted">{city.elevationMsl}</td>
                      <td className={`num${city.imperviousPct > 80 ? ' is-danger' : ''}`}>
                        {city.imperviousPct}%
                      </td>
                      <td>
                        <span className={`benchmark-pill${city.riskLevel === 'Critical' ? ' is-critical' : ''}`}>
                          {city.cloudburstRisk}
                        </span>
                      </td>
                      <td className="num is-danger">{city.peopleAtRisk.toLocaleString('en-IN')}</td>
                      <td className="num">{city.recommendedBudgetCr}</td>
                      <td className="benchmark-action">
                        {isActive ? (
                          <span className="benchmark-current">Active</span>
                        ) : (
                          <button
                            className="btn-inline"
                            onClick={() => { onSelectCity(city.fileName); onClose(); }}
                          >
                            Simulate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiCityBenchmarkModal;

import React, { useState } from 'react';
import './FloatingPanel.css';
import MetricsCard from './MetricsCard';
import EnvironmentalCard from './EnvironmentalCard';
import PlanImpactCard from './PlanImpactCard';
import InterventionsSection from './InterventionsSection';
import ProcessingOverlay from './ProcessingOverlay';
import StormHydrographCard from './StormHydrographCard';
import { playVoiceBriefing, stopVoiceBriefing } from '../utils/voiceBriefing';
import { generateMunicipalDPR } from '../utils/dprReportGenerator';
import { fetchLiveWeatherData } from '../utils/liveWeatherService';

const FloatingPanel = ({ 
  scenario, 
  onScenarioChange, 
  simulationData, 
  loading, 
  simulationStep,
  onRunSimulation,
  onLoadPlan,
  uploadedFileName,
  backendStatus,
  earthEngineStatus,
  isVisible,
  onToggle,
  onMinimize,
  onMitigationChange,
  planData,
  stormIntensity = 180,
  onStormIntensityChange,
  onOpenBenchmark,
  onOpenHotline,
  mitigationReductionPct = 0,
  overlayData = null
}) => {
  const [activeTab, setActiveTab] = useState('simulation');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [liveWeather, setLiveWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  if (!isVisible) return null;

  const handleVoiceToggle = () => {
    if (isPlayingAudio) {
      stopVoiceBriefing();
      setIsPlayingAudio(false);
    } else {
      setIsPlayingAudio(true);
      const started = playVoiceBriefing(simulationData, scenario, uploadedFileName, () => {
        setIsPlayingAudio(false);
      });
      if (!started) {
        setIsPlayingAudio(false);
      }
    }
  };

  const handleExportDPR = () => {
    generateMunicipalDPR(simulationData, scenario, uploadedFileName, planData, {
      overlayData,
      mitigationReductionPct
    });
  };

  const handleSyncWeather = async () => {
    setLoadingWeather(true);
    let lat = 10.7905;
    let lon = 78.7047;
    if (planData && planData.features && planData.features[0] && planData.features[0].geometry) {
      const coords = planData.features[0].geometry.coordinates[0];
      if (coords && coords.length > 0) {
        lat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
        lon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
      }
    }
    const weather = await fetchLiveWeatherData(lat, lon);
    setLiveWeather(weather);
    setLoadingWeather(false);
  };

  const getStormTag = (val) => {
    if (val < 100) return { label: 'Standard monsoon shower', color: 'var(--ok)' };
    if (val < 190) return { label: 'Heavy storm surge', color: 'var(--warn)' };
    if (val < 280) return { label: 'Severe cloudburst', color: 'var(--danger)' };
    return { label: '100-year flash flood', color: 'var(--danger)' };
  };

  const stormTag = getStormTag(stormIntensity);

  return (
    <div className="floating-panel-overlay">
      <div className="floating-panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <div className="panel-title">
              <h1>TerraSense</h1>
              <span>Climate-Adaptive Digital Twin</span>
            </div>
          </div>
          
          <div className="panel-header-controls">
            {/* Citizen Emergency Helpline Registry */}
            <button 
              className="panel-action-btn is-danger"
              onClick={onOpenHotline}
              title="Open Municipal Disaster Control Room & Helpline Log"
              >
              <span>Emergency Helpline</span>
            </button>

            {/* National Benchmark Modal Button */}
            <button 
              className="panel-action-btn"
              onClick={onOpenBenchmark}
              title="National Smart City Comparative Benchmark"
              >
              <span>Benchmark</span>
            </button>

            {simulationData && (
              <>
                {/* Voice Briefing Button */}
                <button 
                  className={`panel-action-btn ${isPlayingAudio ? 'active-audio' : ''}`}
                  onClick={handleVoiceToggle}
                  title={isPlayingAudio ? 'Stop Audio Briefing' : 'Play AI Voice Briefing'}
                  >
                  <span>{isPlayingAudio ? '⏹️ Stop' : 'Voice Copilot'}</span>
                  {isPlayingAudio && <span className="audio-wave">●</span>}
                </button>

                {/* Export DPR PDF Button */}
                <button 
                  className="panel-action-btn"
                  onClick={handleExportDPR}
                  title="Generate Print-Ready Detailed Project Report (PDF)"
                  >
                  <span>DPR (PDF)</span>
                </button>
              </>
            )}

            <button className="panel-control minimize" onClick={onMinimize} title="Minimize">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <button className="panel-control close" onClick={onToggle} title="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div className="panel-tabs">
          <button 
            className={`panel-tab ${activeTab === 'simulation' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulation')}
            title="Simulation & stress test"
          >
            <span className="tab-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27,6.96 12,12.01 20.73,6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </span>
            Simulation
          </button>
          <button 
            className={`panel-tab ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => setActiveTab('analysis')}
            title="Hydrology & thermal analysis"
            disabled={!simulationData}
          >
            <span className="tab-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18"></path>
                <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
              </svg>
            </span>
            Analysis
          </button>
          <button 
            className={`panel-tab ${activeTab === 'solutions' ? 'active' : ''}`}
            onClick={() => setActiveTab('solutions')}
            title="Policy sandbox & ROI"
            disabled={!simulationData}
          >
            <span className="tab-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
            </span>
            Policy
          </button>
        </div>

        <div className="panel-content">
          {activeTab === 'simulation' && (
            <div className="tab-content">
              <div className="section">
                <h3>System Status</h3>
                <div className="status-grid">
                  <div className={`status-item ${backendStatus === 'connected' ? 'connected' : 'error'}`}>
                    <span className="status-label">Backend API</span>
                    <span className="status-value">
                      {backendStatus === 'connected' ? 'Connected' : 
                       backendStatus === 'checking' ? 'Checking...' : 'Offline'}
                    </span>
                  </div>
                  <div className={`status-item ${earthEngineStatus === 'connected' ? 'connected' : 'warning'}`}>
                    <span className="status-label">Earth Engine</span>
                    <span className="status-value">
                      {earthEngineStatus === 'connected' ? 'Authenticated' : 
                       earthEngineStatus === 'needs_auth' ? 'Calibrated Model Active' : 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="section">
                <h3>Area Selection</h3>
                <div className="plan-upload">
                  <div className="current-plan">
                    <span className="plan-label">Current Area:</span>
                    <span className="plan-name">{uploadedFileName.replace('.geojson', '').replace('_area', '')}</span>
                  </div>
                  <button className="btn-secondary" onClick={onLoadPlan}>
                    Upload New Area
                  </button>
                </div>
              </div>
              
              <div className="section">
                <h3>NASA Satellite Processing</h3>
                {loading ? (
                  <div className="processing-steps">
                    <div className={`processing-step ${simulationStep === 'processing' ? 'active' : simulationStep && simulationStep !== 'processing' ? 'completed' : 'pending'}`}>
                      <div className="step-indicator">
                        {simulationStep === 'processing' ? (
                          <div className="spinner-small"></div>
                        ) : simulationStep && simulationStep !== 'processing' ? '' : '1'}
                      </div>
                      <div className="step-content">
                        <span className="step-title">Area Geometry</span>
                        <span className="step-desc">Shoelace geodesic bounds & area</span>
                      </div>
                    </div>
                    
                    <div className={`processing-step ${simulationStep === 'climate' ? 'active' : (simulationStep === 'ai' || (simulationStep && simulationStep !== 'processing' && simulationStep !== 'climate')) ? 'completed' : 'pending'}`}>
                      <div className="step-indicator">
                        {simulationStep === 'climate' ? (
                          <div className="spinner-small"></div>
                        ) : (simulationStep === 'ai' || (simulationStep && simulationStep !== 'processing' && simulationStep !== 'climate')) ? '' : '2'}
                      </div>
                      <div className="step-content">
                        <span className="step-title">NASA Satellite Data</span>
                        <span className="step-desc">GPM, MODIS LST, SRTM, WorldPop</span>
                      </div>
                    </div>
                    
                    <div className={`processing-step ${simulationStep === 'ai' ? 'active' : 'pending'}`}>
                      <div className="step-indicator">
                        {simulationStep === 'ai' ? (
                          <div className="spinner-small"></div>
                        ) : '3'}
                      </div>
                      <div className="step-content">
                        <span className="step-title">AI Municipal Engine</span>
                        <span className="step-desc">Generating ROI & action plans</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button 
                    className="btn-analysis"
                    onClick={onRunSimulation}
                    disabled={backendStatus !== 'connected'}
                  >
                    Run NASA Analysis
                  </button>
                )}
              </div>

              {/* Live Real-Time Weather Radar Sync */}
              <div className="callout">
                <div className="callout__head">
                  <h3>Live weather sync</h3>
                  <button
                    className="btn-inline"
                    onClick={handleSyncWeather}
                    disabled={loadingWeather}
                  >
                    {loadingWeather ? 'Syncing…' : 'Sync now'}
                  </button>
                </div>

                {liveWeather ? (
                  <div style={{ fontSize: 'var(--t-caption)' }}>
                    <div className="reading-row">
                      <div className="reading">
                        <div className="reading__label">Current temp</div>
                        <div className="reading__value num">{liveWeather.temperatureC}°C</div>
                      </div>
                      <div className="reading">
                        <div className="reading__label">Humidity</div>
                        <div className="reading__value num">{liveWeather.humidityPct}%</div>
                      </div>
                      <div className="reading">
                        <div className="reading__label">24h forecast</div>
                        <div className="reading__value num is-alert">{liveWeather.forecastRain24hMm} mm</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--s-3)', marginTop: 'var(--s-2)' }}>
                      <span style={{ fontSize: 'var(--t-label)', color: 'var(--text-muted)' }}>Synced {liveWeather.fetchedAt} · Open-Meteo</span>
                      <button
                        className="btn-inline"
                        onClick={() => onStormIntensityChange(Math.max(50, Math.round(liveWeather.forecastRain24hMm * 3.5)))}
                      >
                        Simulate today's rain
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Fetches current temperature, wind and the next 24 hours of rainfall radar for this ward.
                  </p>
                )}
              </div>

              {/* Interactive Storm Severity / Cloudburst Slider */}
              {simulationData && (
                <div className="callout callout--neutral">
                  <div className="callout__head">
                    <h3>Storm stress test</h3>
                    <span className="tag" style={{ color: stormTag.color }}>
                      {stormTag.label}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-secondary)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    <span>Rainfall Volume:</span>
                    <strong style={{ color: 'var(--text)' }}>{stormIntensity} mm / event</strong>
                  </div>

                  <input 
                    type="range"
                    min="50"
                    max="350"
                    step="10"
                    value={stormIntensity}
                    onChange={(e) => onStormIntensityChange && onStormIntensityChange(parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      accentColor: stormTag.color,
                      cursor: 'pointer',
                      height: '6px',
                      marginBottom: '8px'
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-label)', color: 'var(--text-muted)' }}>
                    <span>50mm (Light Rain)</span>
                    <span>180mm (Design Storm)</span>
                    <span>350mm (Cloudburst)</span>
                  </div>
                </div>
              )}

                <div className="section">
                  <h3>Climate Scenarios</h3>
                  <div className="scenario-controls" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                    <button 
                      className={`scenario-btn ${scenario === 'baseline' ? 'active' : ''}`}
                      onClick={() => onScenarioChange('baseline')}
                      disabled={loading}
                    >
                      Current climate
                    </button>
                    <button 
                      className={`scenario-btn ${scenario === 'rcp45' ? 'active' : ''}`}
                      onClick={() => onScenarioChange('rcp45')}
                      disabled={loading}
                    >
                      +2 °C (RCP 4.5)
                    </button>
                    <button 
                      className={`scenario-btn ${scenario === 'rcp45_rain_plus10' ? 'active' : ''}`}
                      onClick={() => onScenarioChange('rcp45_rain_plus10')}
                      disabled={loading}
                    >
                      +10% rainfall
                    </button>
                    <button 
                      className={`scenario-btn ${scenario === 'rcp85' ? 'active' : ''}`}
                      onClick={() => onScenarioChange('rcp85')}
                      disabled={loading}
                    >
                      RCP 8.5 (+25% rain)
                    </button>
                  </div>
                </div>
            </div>
          )}

          {activeTab === 'analysis' && simulationData && (
            <div className="tab-content analysis-grid">
              <div className="analysis-row">
                <MetricsCard 
                  metrics={simulationData.metrics}
                  scenario={scenario}
                  loading={loading}
                />
                <EnvironmentalCard 
                  metrics={simulationData.metrics}
                  loading={loading}
                />
              </div>

              <PlanImpactCard 
                simulationData={simulationData}
                scenario={scenario}
                loading={loading}
              />

              {/* 24-Hour Storm Hydrograph Card */}
              <StormHydrographCard 
                rainIntensity={stormIntensity} 
                mitigationPct={mitigationReductionPct} 
              />
            </div>
          )}

          {activeTab === 'solutions' && simulationData && (
            <div className="tab-content">
              <div className="solutions-full-width">
                <InterventionsSection 
                  interventions={simulationData.interventions}
                  loading={loading}
                  simulationData={simulationData}
                  onMitigationChange={onMitigationChange}
                />
              </div>
              <div className="impact-section">
                <PlanImpactCard 
                  simulationData={simulationData} 
                  scenario={scenario} 
                  loading={loading} 
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FloatingPanel;
import React from 'react';
import './FloatingButton.css';

const FloatingButton = ({ onClick, simulationData }) => {
  return (
    <button 
      className="floating-button" 
      onClick={onClick} 
      title="Expand TerraSense Workstation"
      aria-label="Open TerraSense GIS Control Station"
    >
      <div className="floating-button-content">
        <div className="floating-button-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect>
            <line x1="15" y1="3" x2="15" y2="21"></line>
            <polyline points="9 8 5 12 9 16"></polyline>
          </svg>
        </div>
        <div className="floating-button-text">
          <span className="floating-button-title">TerraSense Workstation</span>
          <span className="floating-button-status">
            {simulationData ? "Simulation Live • Click to Expand" : "GIS Controls • Click to Expand"}
          </span>
        </div>
      </div>
      <div className="floating-button-indicator"></div>
    </button>
  );
};

export default FloatingButton;
import React, { useState } from 'react';
import './IntroPopup.css';

const IntroPopup = ({ onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const slides = [
    {
      title: "TerraSense",
      subtitle: "Climate-Adaptive Urban Digital Twin",
      content: "Real NASA Earth Engine satellite data meets local AI for evidence-based urban planning.",
      icon: ""
    },
    {
      title: "Live Satellite Analysis",
      subtitle: "Six NASA Earth Datasets Integrated",
      content: "Temperature • Precipitation • Elevation • Soil Moisture • Population Density • Nighttime Lights",
      icon: ""
    },
    {
      title: "AI-Powered Interventions",
      subtitle: "Local LLM Municipal Recommendations",
      content: "Context-aware civil engineering interventions with realistic INR (₹) budgets and implementation timelines.",
      icon: ""
    },
    {
      title: "Ready to Explore?",
      subtitle: "Start your climate simulation",
      content: "Upload your area boundary or test our pre-configured Indian cities (Trichy, Mumbai, Bangalore, Delhi).",
      icon: ""
    }
  ];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const skipIntro = () => {
    onComplete();
  };

  return (
    <div className="intro-overlay">
      <div className="intro-popup">
        <div className="intro-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: '700', color: 'var(--accent)', letterSpacing: '0.5px' }}>TERRASENSE</span>
          </div>
          <button className="intro-skip" onClick={skipIntro} title="Skip to main app">×</button>
        </div>
        
        <div className="intro-content">
          <div className="intro-slide">
            <div className="intro-visual" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
              height: '100px',
              background: 'radial-gradient(circle, rgba(0,66,166,0.12) 0%, rgba(255,255,255,0) 70%)',
              borderRadius: '50%',
              margin: '0 auto 16px auto',
              width: '100px'
            }}>
              <span>{slides[currentSlide].icon}</span>
            </div>
            <h1 className="intro-title">{slides[currentSlide].title}</h1>
            <p className="intro-subtitle">{slides[currentSlide].subtitle}</p>
            <p className="intro-description">{slides[currentSlide].content}</p>
          </div>
        </div>
        
        <div className="intro-navigation">
          <div className="intro-progress">
            <div 
              className="intro-progress-bar" 
              style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
            />
          </div>
          
          <div className="intro-controls">
            {currentSlide > 0 && (
              <button className="intro-back" onClick={() => setCurrentSlide(currentSlide - 1)}>
                ← Back
              </button>
            )}
            <button className="intro-next" onClick={nextSlide}>
              {currentSlide < slides.length - 1 ? 'Next →' : 'Launch TerraSense'}
            </button>
          </div>
        </div>
        
        <div className="intro-footer">
          <span className="intro-badge">WEHACK 2026</span>
        </div>
      </div>
    </div>
  );
};

export default IntroPopup;
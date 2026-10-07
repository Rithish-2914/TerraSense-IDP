import React from 'react';

const ProcessingOverlay = ({ loading, simulationStep }) => {
  if (!loading) return null;

  const steps = [
    {
      id: 'processing',
      title: 'Area Processing',
      description: 'Analyzing uploaded geometry and calculating area bounds',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27,6.96 12,12.01 20.73,6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      )
    },
    {
      id: 'climate',
      title: 'NASA Data Analysis',
      description: 'Processing satellite data from GPM IMERG, SMAP, MODIS LST, SRTM, WorldPop, and VIIRS',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1m15.5-6.5l-4.2 4.2m-6.6 0L.5 6.5m15 11l-4.2-4.2m-6.6 0l-4.2 4.2"></path>
        </svg>
      )
    },
    {
      id: 'ai',
      title: 'AI Insights Generation',
      description: 'Local LLM generating context-aware urban planning recommendations',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 12l2 2 4-4"></path>
          <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.12 0 4.06.74 5.59 1.97"></path>
          <path d="M16 4l2-2 2 2"></path>
          <path d="M18 2v4"></path>
        </svg>
      )
    }
  ];

  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.id === simulationStep);
  };

  const getStepStatus = (stepIndex) => {
    const currentIndex = getCurrentStepIndex();
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, rgba(7, 23, 63, 0.95) 0%, rgba(0, 66, 166, 0.9) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2001,
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(30px)',
        borderRadius: '24px',
        padding: '48px',
        maxWidth: '800px',
        width: '90vw',
        boxShadow: '0 40px 80px rgba(7, 23, 63, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '40px'
        }}>
          <h2 style={{
            fontFamily: 'Fira Sans, sans-serif',
            fontWeight: '700',
            fontSize: '32px',
            color: 'var(--text)',
            margin: '0 0 12px 0',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Processing Analysis
          </h2>
          <p style={{
            fontFamily: 'Overpass, sans-serif',
            fontSize: '16px',
            color: 'var(--accent)',
            margin: 0,
            fontWeight: '600'
          }}>
            NASA Earth Engine + Local AI Integration
          </p>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {steps.map((step, index) => {
            const status = getStepStatus(index);
            return (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  padding: '20px',
                  background: status === 'active' ? 'rgba(234, 254, 7, 0.1)' : 
                             status === 'completed' ? 'rgba(46, 150, 245, 0.08)' : 
                             'rgba(255, 255, 255, 0.6)',
                  border: `2px solid ${
                    status === 'active' ? 'var(--warn)' : 
                    status === 'completed' ? 'var(--accent)' : 
                    'rgba(7, 23, 63, 0.1)'
                  }`,
                  borderRadius: '16px',
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: status === 'active' ? 'var(--warn)' : 
                             status === 'completed' ? 'var(--accent)' : 
                             'rgba(7, 23, 63, 0.1)',
                  color: status === 'active' ? 'var(--text)' : 
                         status === 'completed' ? '#FFFFFF' : 
                         'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  animation: status === 'active' ? 'pulse 2s infinite' : 'none'
                }}>
                  {status === 'completed' ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                  ) : status === 'active' ? (
                    <div style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid currentColor',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                  ) : (
                    step.icon
                  )}
                </div>
                
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontFamily: 'Fira Sans, sans-serif',
                    fontWeight: '700',
                    fontSize: '18px',
                    color: 'var(--text)',
                    margin: '0 0 4px 0'
                  }}>
                    {step.title}
                  </h3>
                  <p style={{
                    fontFamily: 'Overpass, sans-serif',
                    fontSize: '14px',
                    color: 'var(--accent)',
                    margin: 0,
                    opacity: 0.9
                  }}>
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{
          marginTop: '32px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '12px',
            color: 'var(--accent)',
            fontFamily: 'Overpass, sans-serif',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            This may take 30-60 seconds depending on area size
          </div>
        </div>
      </div>
    </div>
  );
};

// Add required CSS animations
if (typeof document !== 'undefined' && !document.getElementById('processing-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'processing-styles';
  styleSheet.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default ProcessingOverlay;
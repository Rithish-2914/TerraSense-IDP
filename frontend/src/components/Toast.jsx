import React, { useState, useEffect } from 'react';

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const getIcon = () => {
    switch(type) {
      case 'success': return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2E96F5" strokeWidth="2">
          <polyline points="20,6 9,17 4,12"></polyline>
        </svg>
      );
      case 'error': return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E43700" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      );
      case 'info': return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0042A6" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      );
      default: return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0042A6" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      );
    }
  };

  const getStyles = () => {
    const baseStyles = {
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      borderRadius: '12px',
      boxShadow: '0 16px 32px rgba(7, 23, 63, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.2) inset'
    };

    switch(type) {
      case 'success': 
        return {
          ...baseStyles,
          borderLeft: `4px solid #2E96F5`
        };
      case 'error': 
        return {
          ...baseStyles,
          borderLeft: `4px solid #E43700`
        };
      case 'info': 
        return {
          ...baseStyles,
          borderLeft: `4px solid #0042A6`
        };
      default: 
        return {
          ...baseStyles,
          borderLeft: `4px solid #0042A6`
        };
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '24px',
      right: '24px',
      zIndex: 10000,
      ...getStyles(),
      padding: '16px 20px',
      maxWidth: '420px',
      animation: 'toastSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        <div style={{ 
          marginTop: '2px',
          flexShrink: 0
        }}>
          {getIcon()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '14px',
            fontFamily: 'Overpass, sans-serif',
            fontWeight: '600',
            color: 'var(--text)',
            lineHeight: '1.4',
            whiteSpace: 'pre-line'
          }}>
            {message}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(7, 23, 63, 0.06)',
            border: 'none',
            borderRadius: '6px',
            width: '24px',
            height: '24px',
            cursor: 'pointer',
            color: 'var(--text)',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(228, 55, 0, 0.1)';
            e.target.style.color = 'var(--danger)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(7, 23, 63, 0.06)';
            e.target.style.color = 'var(--text)';
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

// Add keyframes for animation
if (typeof document !== 'undefined' && !document.getElementById('toast-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'toast-styles';
  styleSheet.textContent = `
    @keyframes toastSlideIn {
      from { 
        opacity: 0;
        transform: translateX(100px) scale(0.8);
      }
      to { 
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default Toast;
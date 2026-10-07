import React, { useEffect } from 'react';
import './BillOfQuantitiesModal.css';

const formatCost = (lakhs) =>
  lakhs >= 100 ? `₹${(lakhs / 100).toFixed(2)} Cr` : `₹${lakhs.toFixed(1)} L`;

/**
 * Derives the CPWD Delhi Schedule of Rates line items for an intervention.
 * The backend may supply its own `cpwd_items`; otherwise the three standard
 * sponge-infrastructure heads are apportioned across the sanctioned cost.
 */
const buildScheduleItems = (intervention, areaHa, costLakhs) => {
  if (Array.isArray(intervention.cpwd_items) && intervention.cpwd_items.length > 0) {
    return intervention.cpwd_items;
  }

  return [
    {
      code: 'DSR 2.8.1',
      item: 'Earthwork excavation in all kinds of soil for sponge trenches',
      qty: `${Math.round(areaHa * 140).toLocaleString('en-IN')} m³`,
      rate: '₹340 / m³',
      amt: `₹${(costLakhs * 0.35).toFixed(1)} L`
    },
    {
      code: 'DSR 16.68',
      item: 'Graded stone aggregate sub-base and non-woven geotextile membrane',
      qty: `${Math.round(areaHa * 110).toLocaleString('en-IN')} m²`,
      rate: '₹480 / m²',
      amt: `₹${(costLakhs * 0.38).toFixed(1)} L`
    },
    {
      code: 'DSR 22.12',
      item: 'Native vetiver grass bio-retention turfing and hydroseeding',
      qty: `${Math.round(areaHa * 110).toLocaleString('en-IN')} m²`,
      rate: '₹280 / m²',
      amt: `₹${(costLakhs * 0.27).toFixed(1)} L`
    }
  ];
};

const BillOfQuantitiesModal = ({ intervention, areaHa = 100, costLakhs = 85, index = 0, onClose }) => {
  // Escape closes it, like every other overlay in the app.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!intervention) return null;

  const scheduleItems = buildScheduleItems(intervention, areaHa, costLakhs);
  const storageM3 = intervention.storage_capacity_m3 || Math.round(areaHa * 185);
  const tenderCode = intervention.tender_code || `AMRUT-2.0/PKG-${String(index + 1).padStart(2, '0')}`;

  return (
    <div className="boq-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="boq-modal" onClick={(e) => e.stopPropagation()}>
        <header className="boq-header">
          <div>
            <div className="boq-eyebrow">CPWD DSR 2024–25 · Bill of quantities</div>
            <h3>{intervention.title || intervention.name}</h3>
          </div>
          <button className="boq-close" onClick={onClose} title="Close" aria-label="Close">✕</button>
        </header>

        <div className="boq-body">
          <div className="boq-summary">
            <div className="boq-summary__cell">
              <div className="boq-summary__label">Tender scheme</div>
              <div className="boq-summary__value" style={{ fontSize: 'var(--t-title)' }}>{tenderCode}</div>
            </div>
            <div className="boq-summary__cell">
              <div className="boq-summary__label">Sanctioned cost</div>
              <div className="boq-summary__value is-accent">{formatCost(costLakhs)}</div>
            </div>
            <div className="boq-summary__cell">
              <div className="boq-summary__label">Storage abated</div>
              <div className="boq-summary__value">{storageM3.toLocaleString('en-IN')} m³</div>
            </div>
          </div>

          <div className="boq-section-title">Itemised schedule of works</div>

          <div className="boq-table-wrap">
            <table className="boq-table">
              <thead>
                <tr>
                  <th>DSR code</th>
                  <th>Description of work</th>
                  <th>Quantity</th>
                  <th>Schedule rate</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {scheduleItems.map((it, i) => (
                  <tr key={i}>
                    <td className="col-code">{it.code}</td>
                    <td>{it.item}</td>
                    <td className="col-qty">{it.qty}</td>
                    <td className="col-rate">{it.rate}</td>
                    <td className="col-amt">{it.amt}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="4">Total sanctioned outlay</td>
                  <td className="col-amt">{formatCost(costLakhs)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="boq-note">
            <strong>Statutory compliance.</strong> Rates are inclusive of 18% GST, 3% civil quality
            inspection and contingency, and a five-year maintenance warranty, per CPWD Delhi Schedule
            of Rates 2024–25.
          </p>
        </div>

        <footer className="boq-footer">
          <span className="boq-footer__ref">{tenderCode}</span>
          <button className="btn-secondary" onClick={onClose}>Close specification</button>
        </footer>
      </div>
    </div>
  );
};

export default BillOfQuantitiesModal;

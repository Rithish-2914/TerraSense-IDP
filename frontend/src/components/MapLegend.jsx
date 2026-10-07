import React from 'react';
import './MapLegend.css';

const MapLegend = ({ uploadedFileName, simulationData, overlayData }) => {
  // The bands carry their modelled depth, so the legend can state the actual
  // range on screen instead of a fixed caption that drifts out of date.
  const depthRange = React.useMemo(() => {
    const feats = overlayData?.features;
    if (!feats || feats.length === 0) return null;
    const depths = feats
      .map((f) => parseFloat(f?.properties?.depth_m))
      .filter((d) => Number.isFinite(d));
    if (depths.length === 0) return null;
    return {
      min: Math.min(...depths).toFixed(2),
      max: Math.max(...depths).toFixed(2)
    };
  }, [overlayData]);

  const getAreaName = () => {
    if (uploadedFileName) {
      return uploadedFileName.replace('.geojson', '').replace('_area', '').replace('_', ' ');
    }
    return 'Analysis ward';
  };

  return (
    <div className="map-legend">
      <div className="legend-title">{getAreaName()}</div>

      <div className="legend-item">
        <div className="color-square blue"></div>
        <span>Study ward boundary</span>
      </div>

      {simulationData && (
        <>
          <div className="legend-section-title">Inundation depth</div>

          {/* A continuous ramp, because the map paints overlapping translucent
              bands into a blurred pane rather than eight discrete shapes. */}
          <div className="legend-ramp" aria-hidden="true" />
          <div className="legend-ramp__scale">
            <span>Trace</span>
            <span>Critical</span>
          </div>

          {depthRange && (
            <div className="legend-depth num">
              {depthRange.min} – {depthRange.max} m standing water
            </div>
          )}
        </>
      )}

      <div className="legend-separator"></div>

      <div className="legend-sources">
        <div>NASA GPM &amp; MODIS</div>
        <div>USDA SCS-CN (NEH-4)</div>
      </div>
    </div>
  );
};

export default React.memo(MapLegend);

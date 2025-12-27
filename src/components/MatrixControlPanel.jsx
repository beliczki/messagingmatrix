import React from 'react';
import { Eye, Table, List } from 'lucide-react';

// Custom SVG icons (newer lucide icons not available in installed version)
const NetworkIcon = ({ size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="16" y="16" width="6" height="6" rx="1"/>
    <rect x="2" y="16" width="6" height="6" rx="1"/>
    <rect x="9" y="2" width="6" height="6" rx="1"/>
    <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/>
    <path d="M12 12V8"/>
  </svg>
);

const LayoutPanelTopIcon = ({ size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="7" x="3" y="3" rx="1"/>
    <rect width="7" height="7" x="3" y="14" rx="1"/>
    <rect width="7" height="7" x="14" y="14" rx="1"/>
  </svg>
);

const ChevronsLeftRightEllipsisIcon = ({ size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m18 8 4 4-4 4"/>
    <path d="m6 8-4 4 4 4"/>
    <circle cx="8" cy="12" r="0.5" fill="currentColor"/>
    <circle cx="12" cy="12" r="0.5" fill="currentColor"/>
    <circle cx="16" cy="12" r="0.5" fill="currentColor"/>
  </svg>
);

const ChevronsRightLeftIcon = ({ size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m20 17-5-5 5-5"/>
    <path d="m4 17 5-5-5-5"/>
  </svg>
);

const MatrixControlPanel = ({
  viewMode,
  displayMode,
  matrixZoom,
  treeZoom,
  treeConnectorType,
  treeFlattenMode,
  lookAndFeel,
  onViewModeChange,
  onDisplayModeChange,
  onMatrixZoomChange,
  onMatrixFit,
  onTreeZoomChange,
  onTreeConnectorTypeChange,
  onTreeFlattenModeChange,
  tree2Ref,
  sankeyRef,
  tree2Zoom = 0.5,
  sankeyZoom = 0.5
}) => {
  const headerColor = lookAndFeel?.headerColor || '#2870ed';

  return (
    <>
      {/* Matrix Zoom Controls - Only show in matrix view */}
      {viewMode === 'matrix' && (
        <div className="flex items-center gap-1 rounded p-0.5"
             style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
          <button
            onClick={() => onMatrixZoomChange(Math.max(matrixZoom * 0.8, 0.1))}
            className="px-3 py-1.5 text-white rounded hover:bg-white hover:bg-opacity-20 transition-all font-bold text-sm"
            title="Zoom Out"
          >
            −
          </button>
          <span className="text-white text-xs font-mono min-w-[45px] text-center">
            {Math.round(matrixZoom * 100)}%
          </span>
          <button
            onClick={() => onMatrixZoomChange(Math.min(matrixZoom * 1.2, 3))}
            className="px-3 py-1.5 text-white rounded hover:bg-white hover:bg-opacity-20 transition-all font-bold text-sm"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={onMatrixFit}
            className="px-3 py-1.5 text-white rounded hover:bg-white hover:bg-opacity-20 transition-all text-xs"
            title="Fit to View"
          >
            Fit
          </button>
        </div>
      )}

      {/* Display Mode Toggle moved to corner cell in MatrixGridView */}

      {/* Tree2 View Zoom Controls */}
      {viewMode === 'tree2' && (
        <div className="flex items-center gap-1 rounded p-0.5"
             style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
          <button
            onClick={() => tree2Ref?.current?.zoomOut?.()}
            className="px-3 py-1.5 text-white rounded hover:bg-white hover:bg-opacity-20 transition-all font-bold text-sm"
            title="Zoom Out"
          >
            −
          </button>
          <span className="text-white text-xs font-mono min-w-[45px] text-center">
            {Math.round(tree2Zoom * 100)}%
          </span>
          <button
            onClick={() => tree2Ref?.current?.zoomIn?.()}
            className="px-3 py-1.5 text-white rounded hover:bg-white hover:bg-opacity-20 transition-all font-bold text-sm"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={() => tree2Ref?.current?.fitToView?.()}
            className="px-3 py-1.5 text-white rounded hover:bg-white hover:bg-opacity-20 transition-all text-xs"
            title="Fit to View"
          >
            Fit
          </button>
        </div>
      )}

      {/* Sankey View Zoom Controls */}
      {viewMode === 'tree3' && (
        <div className="flex items-center gap-1 rounded p-0.5"
             style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
          <button
            onClick={() => sankeyRef?.current?.zoomOut?.()}
            className="px-3 py-1.5 text-white rounded hover:bg-white hover:bg-opacity-20 transition-all font-bold text-sm"
            title="Zoom Out"
          >
            −
          </button>
          <span className="text-white text-xs font-mono min-w-[45px] text-center">
            {Math.round(sankeyZoom * 100)}%
          </span>
          <button
            onClick={() => sankeyRef?.current?.zoomIn?.()}
            className="px-3 py-1.5 text-white rounded hover:bg-white hover:bg-opacity-20 transition-all font-bold text-sm"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={() => sankeyRef?.current?.fitToView?.()}
            className="px-3 py-1.5 text-white rounded hover:bg-white hover:bg-opacity-20 transition-all text-xs"
            title="Fit to View"
          >
            Fit
          </button>
        </div>
      )}

      {/* Tree View Controls - Only show in tree view */}
      {viewMode === 'tree' && (
        <>
          {/* Hint text */}
          <span className="text-white text-xs opacity-80">
            Press space bar to zoom and pan
          </span>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 rounded p-0.5"
               style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
            <button
              onClick={() => onTreeZoomChange(Math.max(treeZoom * 0.8, 0.1))}
              className="px-3 py-1.5 text-white rounded hover:bg-white hover:bg-opacity-20 transition-all font-bold text-sm"
              title="Zoom Out"
            >
              −
            </button>
            <span className="text-white text-xs font-mono min-w-[45px] text-center">
              {Math.round(treeZoom * 100)}%
            </span>
            <button
              onClick={() => onTreeZoomChange(Math.min(treeZoom * 1.2, 3))}
              className="px-3 py-1.5 text-white rounded hover:bg-white hover:bg-opacity-20 transition-all font-bold text-sm"
              title="Zoom In"
            >
              +
            </button>
          </div>

          {/* Connector type toggle */}
          <div className="flex items-center rounded p-0.5 gap-0.5"
               style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
            <button
              onClick={() => onTreeConnectorTypeChange('elbow')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded transition-all ${
                treeConnectorType === 'elbow'
                  ? 'bg-white shadow-sm'
                  : 'text-white hover:bg-white hover:bg-opacity-20'
              }`}
              style={treeConnectorType === 'elbow' ? {
                backgroundColor: 'white',
                color: headerColor
              } : {}}
              title="Elbow Connectors"
            >
              <span className="text-sm font-medium">⌐⌐</span>
            </button>
            <button
              onClick={() => onTreeConnectorTypeChange('curved')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded transition-all ${
                treeConnectorType === 'curved'
                  ? 'bg-white shadow-sm'
                  : 'text-white hover:bg-white hover:bg-opacity-20'
              }`}
              style={treeConnectorType === 'curved' ? {
                backgroundColor: 'white',
                color: headerColor
              } : {}}
              title="Curved Connectors"
            >
              <span className="text-sm font-medium">~</span>
            </button>
          </div>

          {/* Branched/Flat mode toggle */}
          <div className="flex items-center rounded p-0.5 gap-0.5"
               style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
            <button
              onClick={() => onTreeFlattenModeChange(false)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded transition-all ${
                !treeFlattenMode
                  ? 'bg-white shadow-sm'
                  : 'text-white hover:bg-white hover:bg-opacity-20'
              }`}
              style={!treeFlattenMode ? {
                backgroundColor: 'white',
                color: headerColor
              } : {}}
              title="Branched Tree View"
            >
              <ChevronsLeftRightEllipsisIcon size={16} />
            </button>
            <button
              onClick={() => onTreeFlattenModeChange(true)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded transition-all ${
                treeFlattenMode
                  ? 'bg-white shadow-sm'
                  : 'text-white hover:bg-white hover:bg-opacity-20'
              }`}
              style={treeFlattenMode ? {
                backgroundColor: 'white',
                color: headerColor
              } : {}}
              title="Flat View"
            >
              <ChevronsRightLeftIcon size={16} />
            </button>
          </div>
        </>
      )}

      {/* View Mode Toggle */}
      <div className="flex items-center rounded p-0.5 gap-0.5"
           style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
        <button
          onClick={() => onViewModeChange('matrix')}
          className={`px-3 py-1.5 rounded transition-all ${
            viewMode === 'matrix'
              ? 'bg-white shadow-sm'
              : 'text-white hover:bg-white hover:bg-opacity-20'
          }`}
          style={viewMode === 'matrix' ? {
            backgroundColor: 'white',
            color: headerColor
          } : {}}
          title="Matrix View"
        >
          <Table size={16} />
        </button>
        {/* Old Tree View - commented out
        <button
          onClick={() => onViewModeChange('tree')}
          className={`px-3 py-1.5 rounded transition-all ${
            viewMode === 'tree'
              ? 'bg-white shadow-sm'
              : 'text-white hover:bg-white hover:bg-opacity-20'
          }`}
          style={viewMode === 'tree' ? {
            backgroundColor: 'white',
            color: headerColor
          } : {}}
          title="Tree View"
        >
          <NetworkIcon size={16} />
        </button>
        */}
        <button
          onClick={() => onViewModeChange('tree2')}
          className={`px-3 py-1.5 rounded transition-all ${
            viewMode === 'tree2'
              ? 'bg-white shadow-sm'
              : 'text-white hover:bg-white hover:bg-opacity-20'
          }`}
          style={viewMode === 'tree2' ? {
            backgroundColor: 'white',
            color: headerColor
          } : {}}
          title="Tree View"
        >
          <NetworkIcon size={16} />
        </button>
        <button
          onClick={() => onViewModeChange('tree3')}
          className={`px-3 py-1.5 rounded transition-all ${
            viewMode === 'tree3'
              ? 'bg-white shadow-sm'
              : 'text-white hover:bg-white hover:bg-opacity-20'
          }`}
          style={viewMode === 'tree3' ? {
            backgroundColor: 'white',
            color: headerColor
          } : {}}
          title="Sankey Diagram View"
        >
          <LayoutPanelTopIcon size={16} />
        </button>
        <button
          onClick={() => onViewModeChange('feed')}
          className={`px-3 py-1.5 rounded transition-all ${
            viewMode === 'feed'
              ? 'bg-white shadow-sm'
              : 'text-white hover:bg-white hover:bg-opacity-20'
          }`}
          style={viewMode === 'feed' ? {
            backgroundColor: 'white',
            color: headerColor
          } : {}}
          title="Feed View"
        >
          <List size={16} />
        </button>
      </div>
    </>
  );
};

export default MatrixControlPanel;

import React from 'react';
import { Eye, Table, GitBranch, List } from 'lucide-react';

const MatrixControlPanel = ({
  viewMode,
  displayMode,
  matrixZoom,
  treeZoom,
  treeConnectorType,
  lookAndFeel,
  onViewModeChange,
  onDisplayModeChange,
  onMatrixZoomChange,
  onTreeZoomChange,
  onTreeConnectorTypeChange
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
        </div>
      )}

      {/* Display Mode Toggle - Only show in matrix view */}
      {viewMode === 'matrix' && (
        <div className="flex items-center rounded p-0.5 gap-0.5"
             style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
          <button
            onClick={() => onDisplayModeChange('informative')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded transition-all ${
              displayMode === 'informative'
                ? 'bg-white shadow-sm'
                : 'text-white hover:bg-white hover:bg-opacity-20'
            }`}
            style={displayMode === 'informative' ? {
              backgroundColor: 'white',
              color: headerColor
            } : {}}
          >
            <Eye size={20} />
            <span className="text-sm font-medium">Informative</span>
          </button>
          <button
            onClick={() => onDisplayModeChange('minimal')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded transition-all ${
              displayMode === 'minimal'
                ? 'bg-white shadow-sm'
                : 'text-white hover:bg-white hover:bg-opacity-20'
            }`}
            style={displayMode === 'minimal' ? {
              backgroundColor: 'white',
              color: headerColor
            } : {}}
          >
            <Eye size={14} />
            <span className="text-sm font-medium">Minimal</span>
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
          <GitBranch size={16} />
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

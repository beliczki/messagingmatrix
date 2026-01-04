import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Loader, Image as ImageIcon, Film } from 'lucide-react';

const AssetAutocomplete = ({
  value = '',
  onChange,
  assets = [],
  placeholder = 'Image URL or path',
  filterType = 'image' // 'image' or 'video'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [loadingThumbnails, setLoadingThumbnails] = useState({});
  const [failedThumbnails, setFailedThumbnails] = useState({});
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Sync inputValue with external value prop
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter assets based on input (min 2 chars)
  const filteredAssets = useMemo(() => {
    if (!inputValue || inputValue.length < 2) return [];

    const searchLower = inputValue.toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'];
    const videoExtensions = ['mp4', 'webm', 'mov', 'avi'];

    // Debug: log first asset structure
    if (assets.length > 0) {
      console.log('[AssetAutocomplete] Sample asset structure:', Object.keys(assets[0]), assets[0]);
    }

    return assets.filter(asset => {
      // Get file name (handle both spreadsheet and Drive formats)
      const fileName = asset.File_name || asset.filename || '';
      if (!fileName.toLowerCase().includes(searchLower)) return false;

      // Filter by type
      const ext = (asset.File_format || asset.extension || '').toLowerCase();
      if (filterType === 'image') {
        return imageExtensions.includes(ext);
      } else if (filterType === 'video') {
        return videoExtensions.includes(ext);
      }
      return true;
    }).slice(0, 10); // Limit to 10 results
  }, [inputValue, assets, filterType]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);
    setIsOpen(val.length >= 2);
  };

  const handleSelect = (asset) => {
    // Use the file name as the value (not the full URL)
    const fileName = asset.File_name || asset.filename || '';
    setInputValue(fileName);
    onChange(fileName);
    setIsOpen(false);
  };

  const handleThumbnailLoad = (assetId) => {
    setLoadingThumbnails(prev => ({ ...prev, [assetId]: false }));
  };

  const handleThumbnailError = (assetId) => {
    setLoadingThumbnails(prev => ({ ...prev, [assetId]: false }));
    setFailedThumbnails(prev => ({ ...prev, [assetId]: true }));
  };

  const getThumbnailUrl = (asset) => {
    // Priority: proxy URL (if driveID exists) > direct link > thumbnail
    // This matches the pattern used in Assets.jsx
    if (asset.File_driveID) return `/api/drive/proxy/${asset.File_driveID}`;
    return asset.File_DirectLink || asset.File_thumbnail || asset.url || '';
  };

  const getAssetId = (asset) => asset.ID || asset.id || asset.File_driveID;
  const getAssetName = (asset) => asset.File_name || asset.filename || 'Unnamed';
  const getAssetExtension = (asset) => (asset.File_format || asset.extension || '').toUpperCase();

  // Track which thumbnails are loading using functional update to avoid stale closure
  useEffect(() => {
    if (isOpen && filteredAssets.length > 0) {
      setLoadingThumbnails(prev => {
        const newLoading = { ...prev };
        let hasChanges = false;
        filteredAssets.forEach(asset => {
          const id = getAssetId(asset);
          if (newLoading[id] === undefined) {
            newLoading[id] = true;
            hasChanges = true;
          }
        });
        return hasChanges ? newLoading : prev;
      });
    }
  }, [isOpen, filteredAssets]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => inputValue.length >= 2 && setIsOpen(true)}
        className="form-input"
        placeholder={placeholder}
        autoComplete="off"
      />

      {isOpen && filteredAssets.length > 0 && (
        <div
          ref={dropdownRef}
          className="dropdown-menu custom-scrollbar"
          style={{
            position: 'absolute',
            top: 'calc(100% + var(--space-1, 4px))',
            left: 0,
            right: 0,
            opacity: 1,
            transform: 'translateY(0)',
            pointerEvents: 'auto',
            maxHeight: '280px',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255, 255, 255, 0.3) transparent'
          }}
        >
          {filteredAssets.map(asset => {
            const assetId = getAssetId(asset);
            const isLoading = loadingThumbnails[assetId] !== false;
            const hasFailed = failedThumbnails[assetId] === true;
            const thumbnailUrl = getThumbnailUrl(asset);
            const ext = (asset.File_format || asset.extension || '').toLowerCase();
            const isVideo = ['mp4', 'webm', 'mov', 'avi'].includes(ext);

            return (
              <div
                key={assetId}
                className="dropdown-item"
                onClick={() => handleSelect(asset)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3, 12px)',
                  padding: 'var(--space-2, 8px) var(--space-3, 12px)'
                }}
              >
                {/* Thumbnail container */}
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-md, 6px)',
                    overflow: 'hidden',
                    background: 'rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    position: 'relative'
                  }}
                >
                  {/* Loading spinner */}
                  {isLoading && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255, 255, 255, 0.05)'
                    }}>
                      <Loader size={14} className="animate-spin" style={{ color: 'var(--white-50)' }} />
                    </div>
                  )}

                  {/* Thumbnail image */}
                  {isVideo ? (
                    <Film size={18} style={{ color: 'var(--white-50)' }} />
                  ) : hasFailed || !thumbnailUrl ? (
                    <ImageIcon size={18} style={{ color: 'var(--white-50)' }} />
                  ) : (
                    <img
                      src={thumbnailUrl}
                      alt={getAssetName(asset)}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: isLoading ? 0 : 1,
                        transition: 'opacity 0.15s'
                      }}
                      onLoad={() => handleThumbnailLoad(assetId)}
                      onError={() => handleThumbnailError(assetId)}
                    />
                  )}
                </div>

                {/* Asset info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 'var(--font-size-sm, 13px)',
                    fontWeight: 500,
                    color: 'var(--color-white, #fff)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {getAssetName(asset)}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--white-50)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1, 4px)',
                    marginTop: '2px'
                  }}>
                    <span style={{
                      padding: '1px 5px',
                      background: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: 'var(--radius-sm, 4px)',
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px'
                    }}>
                      {getAssetExtension(asset)}
                    </span>
                    {asset.File_dimensions && (
                      <span style={{ opacity: 0.7 }}>{asset.File_dimensions}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isOpen && inputValue.length >= 2 && filteredAssets.length === 0 && (
        <div
          ref={dropdownRef}
          className="dropdown-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + var(--space-1, 4px))',
            left: 0,
            right: 0,
            opacity: 1,
            transform: 'translateY(0)',
            pointerEvents: 'auto',
            padding: 'var(--space-3, 12px)',
            textAlign: 'center',
            color: 'var(--white-50)',
            fontSize: 'var(--font-size-sm, 13px)'
          }}
        >
          No matching assets found
        </div>
      )}
    </div>
  );
};

export default AssetAutocomplete;

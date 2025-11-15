import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ImageIcon, Filter, CheckSquare, Square, Share2, Upload, Info, RefreshCw, Loader, CheckCircle, AlertCircle, X, ChevronDown, Check } from 'lucide-react';
import PageHeader, { getButtonStyle } from './PageHeader';
import AIAssistant from './AIAssistant';
import MatrixStatePanel from './MatrixStatePanel';
import CreativeShare from './CreativeShare';
import CreativePreview from './CreativePreview';
import CreativeLibraryMasonryView from './CreativeLibraryMasonryView';
import CreativeLibraryListView from './CreativeLibraryListView';
import CreativeLibraryUploadDialogs from './CreativeLibraryUploadDialogs';
import MediaLibraryBase from './MediaLibraryBase';
import { processAssets } from '../utils/assetUtils';
import { loadDriveAssets, isDriveEnabled, parseDriveAssetData } from '../utils/driveAssets';
import templateHtmlRaw from '../templates/html/index.html?raw';
import templateConfigUrl from '../templates/html/template.json?url';
import mainCss from '../templates/html/main.css?raw';
import css300x250 from '../templates/html/300x250.css?raw';
import css300x600 from '../templates/html/300x600.css?raw';
import css640x360 from '../templates/html/640x360.css?raw';
import css970x250 from '../templates/html/970x250.css?raw';
import css1080x1080 from '../templates/html/1080x1080.css?raw';

const CreativeLibrary = ({ onMenuToggle, currentModuleName, lookAndFeel, matrixData }) => {
  const [creatives, setCreatives] = useState([]);
  const [filteredCreatives, setFilteredCreatives] = useState([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [pendingUploads, setPendingUploads] = useState([]);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [selectorMode, setSelectorMode] = useState(false);
  const [selectedCreativeIds, setSelectedCreativeIds] = useState(new Set());
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareTitle, setShareTitle] = useState('');
  const [generatedShareUrl, setGeneratedShareUrl] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [selectedBaseColor, setSelectedBaseColor] = useState(lookAndFeel?.headerColor || '#2870ed');
  const [templateHtml, setTemplateHtml] = useState('');
  const [templateConfig, setTemplateConfig] = useState(null);
  const [templateCss, setTemplateCss] = useState(null);
  const [driveEnabled, setDriveEnabled] = useState(false);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null); // { type: 'loading' | 'success' | 'error', message: string }
  const [hasAutoSynced, setHasAutoSynced] = useState(false);
  const [saveProgress, setSaveProgress] = useState(null); // { step: number, message: string }

  // Filter states
  const [productFilter, setProductFilter] = useState([]);
  const [typeFilter, setTypeFilter] = useState(['Dynamic HTML', 'Adobe generated']); // Both selected by default
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  // Refs for dropdown click-outside detection
  const productDropdownRef = useRef(null);
  const typeDropdownRef = useRef(null);

  // MC Template supported banner sizes (from src/templates/html/*.css)
  const bannerSizes = [
    { width: 300, height: 250, name: 'Medium Rectangle' },
    { width: 300, height: 600, name: 'Half Page' },
    { width: 970, height: 250, name: 'Billboard' },
    { width: 1080, height: 1080, name: 'Social Square' },
    { width: 640, height: 360, name: 'Social Video' }
  ];

  // Load template HTML and config
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        // HTML is already loaded as raw string via import
        setTemplateHtml(templateHtmlRaw);

        // Set up CSS map
        const cssMap = {
          main: mainCss,
          '300x250': css300x250,
          '300x600': css300x600,
          '640x360': css640x360,
          '970x250': css970x250,
          '1080x1080': css1080x1080
        };
        setTemplateCss(cssMap);

        // Only need to fetch the JSON config
        const configResponse = await fetch(templateConfigUrl);
        const config = await configResponse.json();
        setTemplateConfig(config);
      } catch (error) {
        console.error('Failed to load template:', error);
      }
    };

    loadTemplate();
  }, []);

  // Check Drive on mount
  useEffect(() => {
    isDriveEnabled().then(enabled => {
      setDriveEnabled(enabled);
    });
  }, []);

  // Auto-sync with Drive on mount if enabled (only once)
  useEffect(() => {
    if (driveEnabled && matrixData && !hasAutoSynced) {
      setHasAutoSynced(true);
      syncWithDrive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveEnabled, matrixData, hasAutoSynced]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target)) {
        setShowProductDropdown(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target)) {
        setShowTypeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Sync with Google Drive
  const syncWithDrive = async () => {
    try {
      // Check if Drive is enabled
      setSyncProgress({ type: 'loading', message: 'Checking Google Drive connection...' });
      const driveIsEnabled = await isDriveEnabled();
      setDriveEnabled(driveIsEnabled);

      if (!driveIsEnabled) {
        console.warn('Google Drive is not enabled. Please configure Drive in config.json');
        setSyncProgress({
          type: 'error',
          message: 'Google Drive is not enabled. Please configure Drive in config.json'
        });
        return;
      }

      setLoadingDrive(true);
      setSyncProgress({ type: 'loading', message: 'Loading creatives from Drive...' });

      // Load all files from Drive
      const driveData = await loadDriveAssets('creatives', { pageSize: 1000 });
      const driveFiles = driveData.files;

      // Get current spreadsheet File_driveIDs from matrixData.creatives
      const spreadsheetCreatives = matrixData?.creatives || [];
      const spreadsheetDriveIds = new Set(
        spreadsheetCreatives.map(creative => creative.File_driveID).filter(id => id)
      );

      // Find new creatives (in Drive but not in spreadsheet)
      const newCreatives = driveFiles.filter(file => !spreadsheetDriveIds.has(file.id));

      // Find deleted creatives (in spreadsheet but not in Drive)
      const driveDriveIds = new Set(driveFiles.map(file => file.id));
      const deletedCreatives = spreadsheetCreatives.filter(
        creative => creative.File_driveID && !driveDriveIds.has(creative.File_driveID)
      );

      // If no changes, just inform user
      if (newCreatives.length === 0 && deletedCreatives.length === 0) {
        setSyncProgress({
          type: 'success',
          message: 'Spreadsheet is up to date with Google Drive. No changes found.'
        });
        setLoadingDrive(false);
        setTimeout(() => setSyncProgress(null), 3000);
        return;
      }

      setSyncProgress({ type: 'loading', message: 'Updating spreadsheet...' });

      // Update spreadsheet with changes
      let updatedCreatives = [...spreadsheetCreatives];

      // Remove deleted creatives
      if (deletedCreatives.length > 0) {
        const deletedIds = new Set(deletedCreatives.map(c => c.File_driveID));
        updatedCreatives = updatedCreatives.filter(creative => !deletedIds.has(creative.File_driveID));
      }

      // Add new creatives with incremental IDs
      if (newCreatives.length > 0) {
        const maxId = Math.max(0, ...updatedCreatives.map(c => parseInt(c.ID) || 0));
        const parsedNewCreatives = newCreatives.map((file, index) => {
          const parsedData = parseDriveAssetData(file);

          // Check if this is an HTML creative
          const isHtml = parsedData.extension === 'html';
          let bannerSize = null;
          if (isHtml) {
            const sizeMatch = file.name.match(/(\d+)x(\d+)/);
            if (sizeMatch) {
              bannerSize = {
                width: parseInt(sizeMatch[1]),
                height: parseInt(sizeMatch[2])
              };
            }
          }

          return {
            ID: maxId + index + 1,
            Brand: parsedData.Brand || '',
            Product: parsedData.Product || '',
            Copy_keyword: '',
            Visual_keyword: parsedData.Visual_keyword || '',
            Template: '',
            Version: parsedData.Version || '',
            File_format: parsedData.extension || '',
            File_driveID: file.id || '',
            File_name: parsedData.filename || '',
            File_size: parsedData.size || '',
            File_date: parsedData.File_date || '',
            File_dimensions: parsedData.File_dimensions || (bannerSize ? `${bannerSize.width}x${bannerSize.height}` : ''),
            File_DirectLink: parsedData.File_DirectLink || '',
            File_thumbnail: parsedData.thumbnail || '',
            Comment: ''
          };
        });

        updatedCreatives = [...updatedCreatives, ...parsedNewCreatives];
      }

      // Update spreadsheet
      matrixData.setCreatives(updatedCreatives);

      // Save to spreadsheet
      await matrixData.save(null, null, null, updatedCreatives);

      setSyncProgress({
        type: 'success',
        message: `Successfully synced with Google Drive.\n\nAdded: ${newCreatives.length} creatives\nRemoved: ${deletedCreatives.length} creatives`
      });

      // Auto-dismiss after 3 seconds
      setTimeout(() => setSyncProgress(null), 3000);

    } catch (err) {
      console.error('Drive sync error:', err);
      setSyncProgress({
        type: 'error',
        message: `Failed to sync with Google Drive:\n${err.message}`
      });
    } finally {
      setLoadingDrive(false);
    }
  };

  // Load creatives
  const loadCreatives = useCallback(async () => {
    const assetModules = import.meta.glob('/src/creatives/*.*', { eager: true, as: 'url' });
    const creativeList = await processAssets(assetModules);

    // Transform spreadsheet creatives from matrixData.creatives to display format
    const spreadsheetCreatives = (matrixData?.creatives || []).map(creative => {
      // Check if this is an HTML creative
      const isHtml = creative.File_format === 'html';
      let bannerSize = null;
      if (isHtml && creative.File_dimensions) {
        const match = creative.File_dimensions.match(/(\d+)x(\d+)/);
        if (match) {
          bannerSize = {
            width: parseInt(match[1]),
            height: parseInt(match[2])
          };
        }
      }

      // Progressive loading: start with thumbnail, upgrade to full res
      const fullResUrl = creative.File_driveID ? `/api/drive/proxy/${creative.File_driveID}` : creative.File_DirectLink;
      const thumbnailUrl = creative.File_thumbnail || fullResUrl;

      return {
        id: creative.File_driveID || creative.ID,
        filename: creative.File_name,
        extension: creative.File_format,
        url: thumbnailUrl, // Start with thumbnail
        fullResUrl: fullResUrl, // Store full resolution URL for later upgrade
        product: creative.Product || creative.File_name,
        size: creative.File_dimensions || '',
        date: creative.File_date || '',
        platforms: [],
        tags: [],
        isDynamic: false,
        bannerSize: bannerSize,
        driveId: creative.File_driveID,
        source: 'drive'
      };
    });

    // Generate dynamic message creatives for ALL messages if matrixData is available
    if (matrixData?.messages && matrixData.messages.length > 0) {
      const activeMessages = matrixData.messages.filter(m => m.status !== 'deleted');

      if (activeMessages.length > 0) {
        // Deduplicate messages by number+variant combination
        const uniqueMessages = [];
        const seen = new Set();

        activeMessages.forEach(message => {
          const key = `${message.number}-${message.variant}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueMessages.push(message);
          }
        });

        const allMessageCreatives = [];

        // Create creatives for each unique message
        uniqueMessages.forEach(message => {
          // Look up product from audiences based on message.audience
          const audience = (matrixData?.audiences || []).find(a => a.key === message.audience);
          const product = audience?.product || message.name || `Message ${message.number}`;

          const messageCreatives = bannerSizes.map((size) => ({
            id: `mc${message.number}-${message.variant}-${size.width}x${size.height}`,
            filename: `MC${message.number}_${message.variant}_${size.width}x${size.height}.html`,
            extension: 'html',
            url: null,
            product: product,
            size: `${size.width}x${size.height}`,
            variant: message.variant,
            date: new Date().toISOString().split('T')[0],
            platforms: [],
            tags: [size.name, 'dynamic', 'message', `mc${message.number}`, `v${message.variant}`],
            isDynamic: true,
            messageData: message,
            bannerSize: size
          }));

          allMessageCreatives.push(...messageCreatives);
        });

        setCreatives([...allMessageCreatives, ...spreadsheetCreatives, ...creativeList]);
        return;
      }
    }

    setCreatives([...spreadsheetCreatives, ...creativeList]);
  }, [matrixData]);

  useEffect(() => {
    loadCreatives();
  }, [loadCreatives]);

  const toggleSelectorMode = () => {
    setSelectorMode(!selectorMode);
    if (selectorMode) {
      setSelectedCreativeIds(new Set());
    }
  };

  const toggleCreativeSelection = (creativeId, enableSelectorMode = false, skipToggle = false) => {
    if (enableSelectorMode && !selectorMode) {
      setSelectorMode(true);
    }

    if (skipToggle) {
      return;
    }

    const newSelection = new Set(selectedCreativeIds);
    if (newSelection.has(creativeId)) {
      newSelection.delete(creativeId);
    } else {
      newSelection.add(creativeId);
    }
    setSelectedCreativeIds(newSelection);
  };

  const closeShareDialog = () => {
    setShowShareDialog(false);
    setShareTitle('');
    setGeneratedShareUrl(null);
    setCopiedUrl(false);
    setSelectedCreativeIds(new Set());
    setSelectorMode(false);
    setSelectedBaseColor(lookAndFeel?.headerColor || '#2870ed');
  };

  const handleFileUpload = async (files) => {
    const fileArray = Array.from(files);
    const previews = [];

    for (const file of fileArray) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/assets/preview-metadata', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('Preview failed');
        }

        const result = await response.json();
        previews.push({
          originalName: result.originalName,
          tempFilename: result.tempFilename,
          metadata: result.metadata
        });
      } catch (error) {
        console.error('Error previewing file:', error);
        alert(`Failed to preview ${file.name}: ${error.message}`);
      }
    }

    if (previews.length > 0) {
      setPendingUploads(previews);
      setShowUploadDialog(false);
      setShowMetadataDialog(true);
    }
  };

  const handleConfirmUploads = async () => {
    setShowMetadataDialog(false);
    setUploadingFiles(pendingUploads);
    setUploadProgress({});

    for (const upload of pendingUploads) {
      try {
        const response = await fetch('/api/assets/confirm-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tempFilename: upload.tempFilename,
            metadata: upload.metadata
          })
        });

        if (!response.ok) {
          throw new Error('Upload confirmation failed');
        }

        setUploadProgress(prev => ({
          ...prev,
          [upload.originalName]: 'completed'
        }));
      } catch (error) {
        console.error('Error confirming upload:', error);
        setUploadProgress(prev => ({
          ...prev,
          [upload.originalName]: 'error'
        }));
      }
    }

    await loadCreatives();

    setTimeout(() => {
      setUploadingFiles([]);
      setUploadProgress({});
      setPendingUploads([]);
    }, 1500);
  };

  const handleCancelUploads = async () => {
    for (const upload of pendingUploads) {
      try {
        await fetch('/api/assets/cancel-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tempFilename: upload.tempFilename })
        });
      } catch (error) {
        console.error('Error canceling upload:', error);
      }
    }

    setPendingUploads([]);
    setShowMetadataDialog(false);
  };

  const updatePendingMetadata = (index, field, value) => {
    setPendingUploads(prev => {
      const updated = [...prev];
      updated[index].metadata[field] = value;
      return updated;
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Save with progress tracking
  const handleSaveWithProgress = async () => {
    const steps = [
      'Preparing data for save...',
      'Saving creatives to spreadsheet...',
      'Finalizing save operation...',
      'Save complete!'
    ];

    try {
      for (let i = 0; i < steps.length; i++) {
        setSaveProgress({ step: i + 1, total: steps.length, message: steps[i] });

        // Small delay to show each step
        await new Promise(resolve => setTimeout(resolve, 300));

        // Actually save on step 1 (after "Preparing data")
        if (i === 0) {
          await matrixData.save(null, null, null, matrixData.creatives);
        }
      }

      // Keep success message visible for a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveProgress(null);
    } catch (error) {
      setSaveProgress({
        step: 0,
        total: steps.length,
        message: `Error: ${error.message}`,
        error: true
      });

      // Show error for 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000));
      setSaveProgress(null);
    }
  };

  // Get unique products from matrixData audiences
  const availableProducts = React.useMemo(() => {
    if (!matrixData?.audiences) return [];
    const products = new Set();
    matrixData.audiences.forEach(aud => {
      if (aud.product) products.add(aud.product);
    });
    return Array.from(products).sort();
  }, [matrixData?.audiences]);

  // Set all products selected by default when availableProducts changes
  useEffect(() => {
    if (availableProducts.length > 0 && productFilter.length === 0) {
      setProductFilter(availableProducts);
    }
  }, [availableProducts, productFilter.length]);

  // Type filter options (Adobe generated = Drive synced/static creatives)
  const typeOptions = ['Dynamic HTML', 'Adobe generated'];

  // Filter creatives based on product and type
  const filteredByFilters = React.useMemo(() => {
    return creatives.filter(creative => {
      // Product filter
      const matchesProduct = productFilter.length === 0 ||
        (creative.product && productFilter.includes(creative.product));

      // Type filter
      let matchesType = true;
      if (typeFilter.length > 0) {
        const isDynamicHTML = creative.isDynamic || creative.extension === 'html';

        if (typeFilter.includes('Dynamic HTML') && typeFilter.includes('Adobe generated')) {
          matchesType = true; // Both selected = show all
        } else if (typeFilter.includes('Dynamic HTML')) {
          matchesType = isDynamicHTML;
        } else if (typeFilter.includes('Adobe generated')) {
          matchesType = !isDynamicHTML; // Adobe generated = static (non-dynamic) creatives from Drive
        }
      }

      return matchesProduct && matchesType;
    });
  }, [creatives, productFilter, typeFilter]);

  return (
    <>
      <MediaLibraryBase
        items={filteredByFilters}
        lookAndFeel={lookAndFeel}
        currentModuleName={currentModuleName || 'Creative Library'}
        onMenuToggle={onMenuToggle}
        onFilteredItemsChange={setFilteredCreatives}
        getItemId={(creative) => creative.id}
        getItemExtension={(creative) => creative.extension}
        getItemUrl={(creative) => creative.url}
        getItemFilename={(creative) => creative.filename}

        // Custom header with selector mode, share, and upload
        renderHeader={({ filterText, setFilterText, viewMode, setViewMode, viewModes, totalItems, filteredCount }) => {
          const allFilteredCreatives = creatives; // Will be filtered by MediaLibraryBase

          return (
            <PageHeader
              onMenuToggle={onMenuToggle}
              title={currentModuleName || 'Creative Library'}
              lookAndFeel={lookAndFeel}
              viewMode={viewMode}
              setViewMode={setViewMode}
              viewModes={viewModes}
              titleFilters={
                <>
                  {/* Product Filter Dropdown */}
                  <div className="relative" ref={productDropdownRef}>
                    <button
                      onClick={() => setShowProductDropdown(!showProductDropdown)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors text-sm"
                    >
                      <span>
                        {productFilter.length === 0
                          ? `Products(${availableProducts.length})`
                          : `Products(${productFilter.length})`}
                      </span>
                      <ChevronDown size={16} />
                    </button>
                    {showProductDropdown && (
                      <div className="absolute top-full mt-1 left-0 bg-white rounded shadow-lg border border-gray-200 min-w-[150px] z-50">
                        {availableProducts.map((product) => (
                          <button
                            key={product}
                            onClick={() => {
                              if (productFilter.includes(product)) {
                                setProductFilter(productFilter.filter(p => p !== product));
                              } else {
                                setProductFilter([...productFilter, product]);
                              }
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 transition-colors text-left text-sm"
                          >
                            <Check size={16} className={productFilter.includes(product) ? 'text-blue-600' : 'text-transparent'} />
                            <span className="text-gray-900">{product}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Type Filter Dropdown */}
                  <div className="relative" ref={typeDropdownRef}>
                    <button
                      onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors text-sm"
                    >
                      <span>
                        {typeFilter.length === typeOptions.length
                          ? `Type(${typeFilter.length})`
                          : `Type(${typeFilter.length})`}
                      </span>
                      <ChevronDown size={16} />
                    </button>
                    {showTypeDropdown && (
                      <div className="absolute top-full mt-1 left-0 bg-white rounded shadow-lg border border-gray-200 min-w-[180px] z-50">
                        {typeOptions.map((type) => (
                          <button
                            key={type}
                            onClick={() => {
                              if (typeFilter.includes(type)) {
                                setTypeFilter(typeFilter.filter(t => t !== type));
                              } else {
                                setTypeFilter([...typeFilter, type]);
                              }
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 transition-colors text-left text-sm"
                          >
                            <Check size={16} className={typeFilter.includes(type) ? 'text-blue-600' : 'text-transparent'} />
                            <span className="text-gray-900">{type}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Filter Input */}
                  <div className="flex items-center gap-2">
                    <Filter size={18} className="text-white" />
                    <input
                      type="text"
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      placeholder="Filter creatives..."
                      className="w-64 px-3 py-2 border border-white/20 rounded bg-white/10 text-white placeholder-white/60 focus:ring-2 focus:ring-white/30 focus:border-white/30 focus:bg-white/20"
                    />
                  </div>

                  {/* Select Button */}
                  <button
                    onClick={toggleSelectorMode}
                    className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                      selectorMode
                        ? 'bg-white text-gray-900 hover:bg-white/90'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {selectorMode ? <CheckSquare size={16} /> : <Square size={16} />}
                    {selectorMode ? 'Selecting' : 'Select'}
                  </button>

                  {/* Select All / Deselect All */}
                  {selectorMode && (
                    <>
                      <button
                        onClick={() => {
                          // MediaLibraryBase will provide filteredCount, but we need the actual items
                          // We'll select all current creatives for now
                          const allIds = new Set(creatives.map(c => c.id));
                          setSelectedCreativeIds(allIds);
                        }}
                        className="px-4 py-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors"
                      >
                        All ({filteredCount})
                      </button>
                      <button
                        onClick={() => setSelectedCreativeIds(new Set())}
                        className="px-4 py-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors"
                      >
                        None
                      </button>
                    </>
                  )}
                </>
              }
            >
              {/* Share Button */}
              {selectorMode && selectedCreativeIds.size > 0 && (
                <button
                  onClick={() => {
                    const colors = [
                      lookAndFeel?.headerColor || '#2870ed',
                      lookAndFeel?.secondaryColor1 || '#eb4c79',
                      lookAndFeel?.secondaryColor2 || '#02a3a4',
                      lookAndFeel?.secondaryColor3 || '#711c7a'
                    ];
                    const randomColor = colors[Math.floor(Math.random() * colors.length)];
                    setSelectedBaseColor(randomColor);
                    setShowShareDialog(true);
                  }}
                  className="relative p-2 text-white rounded hover:opacity-90 transition-opacity"
                  style={getButtonStyle(lookAndFeel)}
                  title={`Share ${selectedCreativeIds.size} creative${selectedCreativeIds.size > 1 ? 's' : ''}`}
                >
                  <Share2 size={20} />
                  {selectedCreativeIds.size > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {selectedCreativeIds.size}
                    </span>
                  )}
                </button>
              )}

              {/* Sync with Drive Button */}
              <button
                onClick={syncWithDrive}
                className="p-2 text-white rounded hover:opacity-90 transition-opacity"
                style={getButtonStyle(lookAndFeel)}
                title="Sync with Google Drive"
                disabled={loadingDrive}
              >
                <RefreshCw size={20} className={loadingDrive ? 'animate-spin' : ''} />
              </button>
            </PageHeader>
          );
        }}

        // Custom masonry view using CreativeLibraryMasonryView
        renderMasonryView={({
          gridRef,
          columnItems,
          columnCount,
          containerHeight,
          loadedStart,
          loadedEnd,
          itemPositions,
          onSelectItem,
          currentLoadingItem,
          loadingImageRef,
          handleImageLoaded,
          setNextItemIndex
        }) => (
          <CreativeLibraryMasonryView
            gridRef={gridRef}
            columnItems={columnItems}
            columnCount={columnCount}
            containerHeight={containerHeight}
            loadedStart={loadedStart}
            loadedEnd={loadedEnd}
            itemPositions={itemPositions}
            selectorMode={selectorMode}
            selectedCreativeIds={selectedCreativeIds}
            onToggleSelection={toggleCreativeSelection}
            onSelectCreative={onSelectItem}
            currentLoadingItem={currentLoadingItem}
            loadingImageRef={loadingImageRef}
            handleImageLoaded={handleImageLoaded}
            setNextItemIndex={setNextItemIndex}
            templateHtml={templateHtml}
            templateConfig={templateConfig}
            templateCss={templateCss}
            textFormatting={matrixData?.textFormatting || []}
            audiences={matrixData?.audiences || []}
          />
        )}

        // Custom list view
        renderListItem={(creative) => {
          const isDynamic = creative.isDynamic && creative.extension === 'html';
          const isVideo = creative.extension === 'mp4';

          // Get product from audiences based on messageData.audience
          const getProduct = () => {
            if (isDynamic && creative.messageData?.audience && matrixData?.audiences?.length > 0) {
              const audience = matrixData.audiences.find(a => a.key === creative.messageData.audience);
              return audience?.product || creative.product;
            }
            return creative.product;
          };
          const product = getProduct();

          // Get thumbnail for dynamic HTML - use first non-empty background image with template config path
          const getThumbnailUrl = () => {
            if (!isDynamic || !creative.messageData || !templateConfig) return creative.url;

            const msg = creative.messageData;

            // Check background images in order: image1, image2, image3, image4
            const backgroundImages = [
              { placeholderName: 'background_image_1', value: msg.image1 },
              { placeholderName: 'background_image_2', value: msg.image2 },
              { placeholderName: 'background_image_3', value: msg.image3 },
              { placeholderName: 'background_image_4', value: msg.image4 }
            ];

            for (const img of backgroundImages) {
              // Skip empty values and empty.png
              if (img.value && img.value.toLowerCase() !== 'empty.png') {
                // Get path from template config
                const placeholder = templateConfig.placeholders?.[img.placeholderName];
                const pathPrefix = placeholder?.['path-messagingmatrix'] || '';

                // Build full URL
                if (img.value.startsWith('http://') || img.value.startsWith('https://')) {
                  return img.value;
                }
                return pathPrefix + img.value;
              }
            }

            return null; // No background image found
          };
          const thumbnailUrl = getThumbnailUrl();

          // Get display name
          const displayName = isDynamic && creative.messageData && creative.bannerSize
            ? `MC${creative.messageData.number} ${creative.variant.toUpperCase()} ${creative.bannerSize.width}x${creative.bannerSize.height} v${creative.messageData.version || 1}`
            : creative.filename;

          return (
            <>
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                    {isVideo ? (
                      <video
                        src={creative.url}
                        className="w-full h-full object-contain"
                        preload="metadata"
                      />
                    ) : isDynamic && thumbnailUrl ? (
                      <>
                        {/* Fallback HTML placeholder */}
                        <div className="absolute inset-0 flex items-center justify-center bg-purple-100 text-purple-600 text-xs font-semibold">
                          HTML
                        </div>
                        {/* Thumbnail image - will hide fallback if loaded successfully */}
                        <img
                          src={thumbnailUrl}
                          alt={creative.filename}
                          className="absolute inset-0 w-full h-full object-cover bg-white"
                          onError={(e) => {
                            // Hide image on error to reveal fallback
                            e.target.style.display = 'none';
                          }}
                        />
                      </>
                    ) : isDynamic ? (
                      <div className="w-full h-full flex items-center justify-center bg-purple-100 text-purple-600 text-xs font-semibold">
                        HTML
                      </div>
                    ) : (
                      <img
                        src={creative.url}
                        alt={creative.filename}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{displayName}</div>
                    {creative.product && !isDynamic && (
                      <div className="text-sm text-gray-500">{creative.product}</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="py-3 px-4 text-sm text-gray-700">{creative.size}</td>
              <td className="py-3 px-4 text-sm text-gray-500">
                {isDynamic && creative.messageData?.template ? creative.messageData.template : ''}
              </td>
              <td className="py-3 px-4 text-sm text-gray-500">{creative.date}</td>
              <td className="py-3 px-4">
                {product && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                    {product}
                  </span>
                )}
              </td>
            </>
          );
        }}

        // Custom preview using CreativePreview
        renderPreview={(selectedCreative, onClose, allFilteredCreatives, onNavigate) => (
          <CreativePreview
            creative={selectedCreative}
            onClose={onClose}
            templateHtml={templateHtml}
            templateConfig={templateConfig}
            templateCss={templateCss}
            allCreatives={allFilteredCreatives}
            onNavigate={onNavigate}
            textFormatting={matrixData?.textFormatting || []}
            audiences={matrixData?.audiences || []}
          />
        )}

        // Custom floating actions
        renderFloatingActions={({ showDebugInfo, setShowDebugInfo, debugInfo }) => (
          <div className="fixed bottom-8 right-8 z-40">
            <button
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              className={`p-3 rounded-full shadow-lg transition-all ${
                showDebugInfo
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-blue-600 hover:bg-blue-50'
              }`}
              title="View loading info"
            >
              <Info size={20} />
            </button>

            {showDebugInfo && (
              <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-xl p-4 text-xs text-gray-700 whitespace-nowrap border border-gray-200">
                <div className="font-semibold mb-2 text-blue-600">Virtual Scrolling Info</div>
                <div>{debugInfo}</div>
              </div>
            )}
          </div>
        )}
      />

      {/* Upload Dialogs */}
      <CreativeLibraryUploadDialogs
        showUploadDialog={showUploadDialog}
        setShowUploadDialog={setShowUploadDialog}
        showMetadataDialog={showMetadataDialog}
        pendingUploads={pendingUploads}
        uploadingFiles={uploadingFiles}
        uploadProgress={uploadProgress}
        handleDrop={handleDrop}
        handleDragOver={handleDragOver}
        handleFileUpload={handleFileUpload}
        updatePendingMetadata={updatePendingMetadata}
        handleConfirmUploads={handleConfirmUploads}
        handleCancelUploads={handleCancelUploads}
      />

      {/* Share Dialog */}
      <CreativeShare
        isOpen={showShareDialog}
        onClose={closeShareDialog}
        selectedCreativeIds={selectedCreativeIds}
        selectedCreatives={creatives.filter(c => selectedCreativeIds.has(c.id))}
        shareTitle={shareTitle}
        setShareTitle={setShareTitle}
        selectedBaseColor={selectedBaseColor}
        setSelectedBaseColor={setSelectedBaseColor}
        generatedShareUrl={generatedShareUrl}
        setGeneratedShareUrl={setGeneratedShareUrl}
        copiedUrl={copiedUrl}
        setCopiedUrl={setCopiedUrl}
        lookAndFeel={lookAndFeel}
        templateHtml={templateHtml}
        templateConfig={templateConfig}
        templateCss={templateCss}
        templateName="html"
        textFormatting={matrixData?.textFormatting || []}
      />

      {/* Sync Progress Overlay */}
      {syncProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="flex-shrink-0">
                {syncProgress.type === 'loading' && (
                  <Loader size={24} className="text-blue-600 animate-spin" />
                )}
                {syncProgress.type === 'success' && (
                  <CheckCircle size={24} className="text-green-600" />
                )}
                {syncProgress.type === 'error' && (
                  <AlertCircle size={24} className="text-red-600" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 mb-2">
                  {syncProgress.type === 'loading' && 'Syncing with Google Drive...'}
                  {syncProgress.type === 'success' && 'Sync Successful'}
                  {syncProgress.type === 'error' && 'Sync Failed'}
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {syncProgress.message}
                </p>
              </div>

              {/* Close button for error */}
              {syncProgress.type === 'error' && (
                <button
                  onClick={() => setSyncProgress(null)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant */}
      <AIAssistant
        moduleContext={{ module: 'creative-library' }}
        matrixData={matrixData}
        filteredItems={filteredCreatives}
        getItemUrl={(creative) => {
          // Use proxy URL if driveId is available to avoid CORS issues
          if (creative.driveId) {
            return `/api/drive/proxy/${creative.driveId}`;
          }
          return creative.url;
        }}
      />

      {/* Matrix State Panel */}
      <MatrixStatePanel
        audiences={matrixData?.audiences || []}
        topics={matrixData?.topics || []}
        messages={matrixData?.messages || []}
        keywords={matrixData?.keywords || {}}
        assets={matrixData?.assets || []}
        creatives={matrixData?.creatives || []}
        textFormatting={matrixData?.textFormatting || []}
        feedData={[]}
        lastSync={matrixData?.lastSync}
        isSaving={matrixData?.isSaving}
        saveProgress={saveProgress}
        onSave={handleSaveWithProgress}
        onClearReload={() => {
          // Preserve authentication data
          const currentUser = localStorage.getItem('current_user');
          const appUsers = localStorage.getItem('app_users');

          // Clear all localStorage
          localStorage.clear();

          // Restore authentication data
          if (currentUser) localStorage.setItem('current_user', currentUser);
          if (appUsers) localStorage.setItem('app_users', appUsers);

          // Reload the page to fetch fresh data from spreadsheet
          window.location.reload();
        }}
        onRegenerateTopicKeys={matrixData?.regenerateTopicKeys}
        downloadFeedCSV={() => {}}
      />
    </>
  );
};

export default CreativeLibrary;

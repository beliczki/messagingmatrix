import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiPost, authenticatedFetch } from '../utils/api';
import { ImageIcon, CheckSquare, Square, Share2, Upload, Info, Loader, CheckCircle, AlertCircle, X } from 'lucide-react';
import PageHeader, { getButtonStyle } from './PageHeader';
import AIAssistant from './AIAssistant';
import MatrixStatePanel from './MatrixStatePanel';
import CreativeShare from './CreativeShare';
import CreativePreview from './CreativePreview';
import CreativeLibraryMasonryView from './CreativeLibraryMasonryView';
import CreativeLibraryListView from './CreativeLibraryListView';
import CreativeLibraryUploadDialogs from './CreativeLibraryUploadDialogs';
import MediaLibraryBase from './MediaLibraryBase';
import MediaToolbar from './MediaToolbar';
import ExportImagesDialog from './ExportImagesDialog';
import { processAssets } from '../utils/assetUtils';
import { clearAndReloadApp } from '../utils/clearAndReload';
import { loadDriveAssets, isDriveEnabled, parseDriveAssetData, invalidateDriveCache } from '../utils/driveAssets';
import settings from '../services/settings';
import { apiGet } from '../utils/api';
import BottomBar from './BottomBar';

const CreativeLibrary = ({ onMenuToggle, currentModuleName, lookAndFeel, matrixData }) => {
  // Read filter from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const initialFilterFromUrl = urlParams.get('filter_creatives') || '';

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
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [shareTitle, setShareTitle] = useState('');
  const [generatedShareUrl, setGeneratedShareUrl] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [bgColor, setBgColor] = useState(() => {
    const saved = localStorage.getItem('creativeLibrary_bgColor');
    return saved || lookAndFeel?.headerColor || '#2870ed';
  });
  const [selectedBaseColor, setSelectedBaseColor] = useState(() => {
    const saved = localStorage.getItem('creativeLibrary_bgColor');
    return saved || lookAndFeel?.headerColor || '#2870ed';
  });
  // Templates cache: Map<templateName, { html, config, css }>
  const [templatesCache, setTemplatesCache] = useState({});
  const [driveEnabled, setDriveEnabled] = useState(false);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [creativesFolderId, setCreativesFolderId] = useState(null);
  const [assetsFolderId, setAssetsFolderId] = useState(null);
  const [syncProgress, setSyncProgress] = useState(null); // { type: 'loading' | 'success' | 'error', message: string }
  const [hasAutoSynced, setHasAutoSynced] = useState(false);
  const [saveProgress, setSaveProgress] = useState(null); // { step: number, message: string }
  const [pendingDriveChanges, setPendingDriveChanges] = useState(null); // { added: number, removed: number }
  const [reloadingTemplates, setReloadingTemplates] = useState(false);

  // Filter states (load from localStorage if available)
  const [productFilter, setProductFilter] = useState(() => {
    const saved = localStorage.getItem('creativeLibrary_productFilter');
    return saved ? JSON.parse(saved) : [];
  });
  const [typeFilter, setTypeFilter] = useState(['Dynamic HTML', 'Adobe generated']); // Both selected by default
  const [sizeFilter, setSizeFilter] = useState(() => {
    const saved = localStorage.getItem('creativeLibrary_sizeFilter');
    return saved ? JSON.parse(saved) : [];
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    const saved = localStorage.getItem('creativeLibrary_statusFilter');
    return saved ? JSON.parse(saved) : [];
  });

  // Sorting state (persisted to localStorage)
  const [sortColumn, setSortColumn] = useState(() => {
    const saved = localStorage.getItem('creativeLibrary_sortColumn');
    return saved || 'date'; // Default sort by date
  });
  const [sortDirection, setSortDirection] = useState(() => {
    const saved = localStorage.getItem('creativeLibrary_sortDirection');
    return saved || 'desc'; // Default newest first
  });

  // Default banner sizes (fallback if template doesn't specify sizes)
  const defaultBannerSizes = [
    { width: 300, height: 250, name: 'Medium Rectangle' },
    { width: 300, height: 600, name: 'Half Page' }
  ];

  // Get sizes for a specific template from cache
  const getTemplateSizes = useCallback((templateName) => {
    const templateData = templatesCache[templateName];
    if (templateData?.config?.sizes && templateData.config.sizes.length > 0) {
      return templateData.config.sizes;
    }
    return defaultBannerSizes;
  }, [templatesCache]);

  // Fetch a single template's data from the server (pure data fetch, no state updates)
  const fetchTemplate = useCallback(async (templateName) => {
    try {
      // Get template metadata from /api/templates (has CSS-derived sizes via dimensions)
      let templateMeta = null;
      try {
        const templatesResponse = await apiGet('/api/templates');
        if (templatesResponse.ok) {
          const allTemplates = await templatesResponse.json();
          templateMeta = allTemplates.find(t => t.name === templateName);
        }
      } catch (e) {
        console.warn(`Failed to get template metadata for ${templateName}:`, e);
      }

      // Load template HTML
      const htmlResponse = await apiGet(`/api/templates/${templateName}/index.html`);
      let html = '';
      if (htmlResponse.ok) {
        const htmlData = await htmlResponse.json();
        html = htmlData.content || htmlData;
      }

      // Load template config
      let config = null;
      try {
        const configResponse = await apiGet(`/api/templates/${templateName}/template.json`);
        if (configResponse.ok) {
          const configData = await configResponse.json();
          // API returns {content: "..."} wrapper, need to parse the content
          if (configData.content) {
            config = JSON.parse(configData.content);
          } else {
            config = configData;
          }
        }
      } catch (e) {
        console.warn(`No template.json for ${templateName}:`, e);
      }

      // Merge CSS-derived sizes from /api/templates into config
      if (templateMeta?.sizes && templateMeta.sizes.length > 0) {
        config = { ...config, sizes: templateMeta.sizes };
      } else if (templateMeta?.dimensions && templateMeta.dimensions.length > 0) {
        const sizes = templateMeta.dimensions.map(dim => {
          const [width, height] = dim.split('x').map(Number);
          return { width, height, name: dim };
        });
        config = { ...config, sizes };
      }

      // Load CSS files
      const cssMap = { main: '' };
      const mainCssResponse = await apiGet(`/api/templates/${templateName}/main.css`);
      if (mainCssResponse.ok) {
        const mainCssData = await mainCssResponse.json();
        cssMap.main = mainCssData.content || '';
      }

      // Get sizes from config (now includes CSS-derived sizes) or use defaults
      const sizesToLoad = config?.sizes || defaultBannerSizes;

      // Load size-specific CSS files (silently skip missing ones)
      for (const size of sizesToLoad) {
        const sizeKey = `${size.width}x${size.height}`;
        try {
          const sizeCssResponse = await apiGet(`/api/templates/${templateName}/${sizeKey}.css`);
          if (sizeCssResponse.ok) {
            const sizeCssData = await sizeCssResponse.json();
            const cssText = sizeCssData.content || '';
            if (cssText && !cssText.includes('<!DOCTYPE') && !cssText.includes('<html')) {
              cssMap[sizeKey] = cssText;
            }
          }
        } catch (e) {
          // Size CSS is optional - silently ignore
        }
      }

      return { html, config, css: cssMap };
    } catch (error) {
      console.error(`Failed to load template ${templateName}:`, error);
      return null;
    }
  }, []);

  // Load a single template and update the cache (convenience wrapper for single-template callers)
  const loadTemplate = useCallback(async (templateName, forceReload = false) => {
    if (!forceReload && templatesCache[templateName]) {
      return templatesCache[templateName];
    }
    const data = await fetchTemplate(templateName);
    if (data) {
      setTemplatesCache(prev => ({ ...prev, [templateName]: data }));
    }
    return data;
  }, [templatesCache, fetchTemplate]);

  // Reload all cached templates (re-fetches from server in parallel, single state update)
  const reloadTemplates = useCallback(async () => {
    const cachedTemplateNames = Object.keys(templatesCache);
    if (cachedTemplateNames.length === 0) {
      console.log('No templates in cache to reload');
      return;
    }

    setReloadingTemplates(true);
    console.log(`Reloading ${cachedTemplateNames.length} templates...`);

    try {
      const results = await Promise.all(
        cachedTemplateNames.map(async (name) => {
          const data = await fetchTemplate(name);
          return [name, data];
        })
      );

      const newCache = {};
      results.forEach(([name, data]) => {
        if (data) newCache[name] = data;
      });
      setTemplatesCache(newCache);

      console.log('Templates reloaded successfully');
    } finally {
      setReloadingTemplates(false);
    }
  }, [templatesCache, fetchTemplate]);

  // Load templates for all unique message templates (batched to avoid multiple re-renders)
  // This is only used by reloadTemplates and other explicit callers — initial loading
  // is handled by loadCreatives to avoid double-render cascades.
  // (kept as a standalone effect-free function)

  // Helper to get template data for a creative
  const getTemplateForCreative = useCallback((creative) => {
    if (!creative?.isDynamic) return { html: '', config: null, css: null };
    const templateName = creative.messageData?.template;
    if (!templateName) return { html: '', config: null, css: null };
    return templatesCache[templateName] || { html: '', config: null, css: null };
  }, [templatesCache]);

  // Check Drive on mount and load folder IDs
  useEffect(() => {
    const loadDriveConfig = async () => {
      const enabled = await isDriveEnabled();
      setDriveEnabled(enabled);

      // Load folder IDs from settings
      await settings.ensureInitialized();
      const driveConfig = settings.get('googleDrive') || {};
      setCreativesFolderId(driveConfig.creativesFolderId || null);
      setAssetsFolderId(driveConfig.assetsFolderId || null);
    };
    loadDriveConfig();
  }, []);

  // Keyboard shortcut: Ctrl+Shift+T to reload templates
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        console.log('Reloading templates (Ctrl+Shift+T)...');
        await reloadTemplates();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reloadTemplates]);

  // Auto-sync with Drive on mount if enabled (only once)
  // Only sync when matrix data is actually loaded (has audiences, topics, or messages)
  const hasMatrixData = matrixData && (
    (matrixData.audiences?.length > 0) ||
    (matrixData.topics?.length > 0) ||
    (matrixData.messages?.length > 0)
  );

  useEffect(() => {
    if (driveEnabled && hasMatrixData && !hasAutoSynced) {
      setHasAutoSynced(true);
      syncWithDrive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveEnabled, hasMatrixData, hasAutoSynced]);

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

      // Load ALL files from Drive (paginate through all pages)
      let driveFiles = [];
      let pageToken = undefined;
      do {
        const driveData = await loadDriveAssets('creatives', { pageSize: 1000, pageToken });
        driveFiles.push(...driveData.files);
        pageToken = driveData.nextPageToken;
        if (pageToken) {
          setSyncProgress({ type: 'loading', message: `Loading creatives from Drive... (${driveFiles.length} so far)` });
        }
      } while (pageToken);

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

      // Find modified creatives (in both, but modifiedTime has changed)
      const driveFileMap = new Map(driveFiles.map(file => [file.id, file]));
      const modifiedCreatives = spreadsheetCreatives.filter(creative => {
        if (!creative.File_driveID || !spreadsheetDriveIds.has(creative.File_driveID)) return false;
        const driveFile = driveFileMap.get(creative.File_driveID);
        if (!driveFile) return false;
        // Compare modification times - Drive file has been updated if times differ
        const driveModTime = driveFile.modifiedTime;
        const spreadsheetModTime = creative.File_date;
        if (!driveModTime || !spreadsheetModTime) return false;
        // Normalize to ISO strings for comparison
        const driveDate = new Date(driveModTime).toISOString();
        const spreadsheetDate = new Date(spreadsheetModTime).toISOString();
        return driveDate !== spreadsheetDate;
      });

      console.log(`🔄 Sync results: ${newCreatives.length} new, ${modifiedCreatives.length} modified, ${deletedCreatives.length} deleted`);

      // If no changes, just inform user
      if (newCreatives.length === 0 && deletedCreatives.length === 0 && modifiedCreatives.length === 0) {
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

      // Update modified creatives with new metadata from Drive
      if (modifiedCreatives.length > 0) {
        // Invalidate browser cache for modified files
        await Promise.all(modifiedCreatives.map(c => invalidateDriveCache(c.File_driveID)));

        // Ensure settings are loaded for parsing
        await settings.ensureInitialized();
        const parsingRules = settings.getCreativeParsingRules();
        const keywords = matrixData.keywords || {};

        const modifiedIds = new Set(modifiedCreatives.map(c => c.File_driveID));
        updatedCreatives = updatedCreatives.map(creative => {
          if (!modifiedIds.has(creative.File_driveID)) return creative;
          const driveFile = driveFileMap.get(creative.File_driveID);
          if (!driveFile) return creative;
          const parsedData = parseDriveAssetData(driveFile, parsingRules, keywords);
          // Update file metadata while preserving user-edited fields
          return {
            ...creative,
            File_name: driveFile.name,
            File_size: parsedData.File_size || '',
            File_date: parsedData.File_date || '',
            File_dimensions: parsedData.File_dimensions || '',
            File_DirectLink: parsedData.File_DirectLink || '',
            File_thumbnail: parsedData.File_thumbnail || ''
          };
        });
      }

      // Add new creatives with incremental IDs
      if (newCreatives.length > 0) {
        const maxId = Math.max(0, ...updatedCreatives.map(c => parseInt(c.ID) || 0));

        // Ensure settings are loaded before getting parsing rules
        await settings.ensureInitialized();

        // Get parsing rules from settings
        const parsingRules = settings.getCreativeParsingRules();
        const keywords = matrixData.keywords || {};

        console.log('🔧 Parsing new creatives with rules:', parsingRules);
        console.log('🔧 Keywords available:', Object.keys(keywords));

        const parsedNewCreatives = newCreatives.map((file, index) => {
          // Pass parsing rules and keywords to get configurable parsing
          const parsedData = parseDriveAssetData(file, parsingRules, keywords);

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

          // Build creative object with EXACT field order matching spreadsheet structure
          const creative = {
            ID: maxId + index + 1,
            Brand: parsedData.Brand || '',
            Product: parsedData.Product || '',
            Type: parsedData.Type || '',
            Visual_keyword: parsedData.Visual_keyword || '',
            Visual_description: parsedData.Visual_description || '',
            MC_Number: parsedData.MC_Number || '',
            MC_Variant: parsedData.MC_Variant || '',
            Version: parsedData.Version || '',
            File_format: parsedData.File_format || '',
            File_driveID: file.id || parsedData.File_driveID || '',
            File_name: parsedData.File_name || file.name || '',
            File_size: parsedData.File_size || '',
            File_date: parsedData.File_date || '',
            File_dimensions: parsedData.File_dimensions || (bannerSize ? `${bannerSize.width}x${bannerSize.height}` : ''),
            File_DirectLink: parsedData.File_DirectLink || '',
            File_thumbnail: parsedData.File_thumbnail || '',
            Is_Dynamic: parsedData.Is_Dynamic || 'FALSE'
          };

          return creative;
        });

        updatedCreatives = [...updatedCreatives, ...parsedNewCreatives];
      }

      // Update local state only (don't auto-save to prevent data loss race condition)
      matrixData.setCreatives(updatedCreatives);

      // Track pending changes with IDs for "Changes Only" view - user must explicitly save
      // Get the IDs directly from the newly added creatives (last N items in updatedCreatives)
      const addedIds = newCreatives.length > 0
        ? updatedCreatives.slice(-newCreatives.length).map(c => String(c.ID))
        : [];
      // Get the IDs of removed creatives
      const removedIds = deletedCreatives.map(c => String(c.ID));
      // Get the IDs of modified creatives
      const modifiedIds = modifiedCreatives.map(c => String(c.ID));

      setPendingDriveChanges({
        added: newCreatives.length,
        modified: modifiedCreatives.length,
        removed: deletedCreatives.length,
        addedIds,
        modifiedIds,
        removedIds
      });

      setSyncProgress({
        type: 'success',
        message: `Synced with Google Drive.\n\nAdded: ${newCreatives.length} creatives\nUpdated: ${modifiedCreatives.length} creatives\nRemoved: ${deletedCreatives.length} creatives\n\n⚠️ Changes are pending - click Save to persist to spreadsheet.`
      });

      // Auto-dismiss after 5 seconds (longer to give user time to read)
      setTimeout(() => setSyncProgress(null), 5000);

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

  // Re-parse all creatives with current parsing rules
  const reparseAllCreatives = async () => {
    try {
      setLoadingDrive(true);
      setSyncProgress({ type: 'loading', message: 'Re-parsing all creatives with current rules...' });

      // Ensure settings are loaded
      await settings.ensureInitialized();

      const parsingRules = settings.getCreativeParsingRules();
      const keywords = matrixData.keywords || {};

      console.log('🔧 Re-parsing all creatives with rules:', parsingRules);

      const spreadsheetCreatives = matrixData?.creatives || [];
      if (spreadsheetCreatives.length === 0) {
        setSyncProgress({ type: 'error', message: 'No creatives found to re-parse.' });
        setTimeout(() => setSyncProgress(null), 3000);
        return;
      }

      // Re-parse each creative's filename
      const reparsedCreatives = spreadsheetCreatives.map(creative => {
        const filename = creative.File_name;
        if (!filename) return creative;

        // Parse filename with current rules
        const parts = filename.split('.');
        const extension = parts.pop();
        const nameWithoutExt = parts.join('.');
        const segments = nameWithoutExt.split('_');

        // Track used segment indices for 'remaining' rule
        const usedIndices = new Set();

        // Helper to mark segment as used
        const markUsed = (rule, value) => {
          if (!rule || !value) return;
          switch (rule.rule) {
            case 'segment':
              usedIndices.add(rule.index);
              break;
            case 'after_segment': {
              const idx = segments.findIndex(s => s.toUpperCase() === (rule.afterValue || '').toUpperCase());
              if (idx >= 0) { usedIndices.add(idx); usedIndices.add(idx + 1); }
              break;
            }
            case 'after_pattern': {
              const regex = new RegExp(rule.pattern);
              for (let i = 0; i < segments.length - 1; i++) {
                if (regex.test(segments[i])) { usedIndices.add(i); usedIndices.add(i + 1); break; }
              }
              break;
            }
            case 'last_segment':
              usedIndices.add(segments.length - 1);
              break;
            case 'pattern': {
              const regex = new RegExp(rule.pattern);
              for (let i = 0; i < segments.length; i++) {
                if (regex.test(segments[i])) { usedIndices.add(i); break; }
              }
              break;
            }
          }
        };

        // Apply parsing rules (non-remaining first)
        const parsedFields = {};
        if (parsingRules) {
          Object.entries(parsingRules).forEach(([fieldName, rule]) => {
            if (!rule || rule.rule === 'remaining') return;

            let value = '';
            switch (rule.rule) {
              case 'fixed':
                value = rule.value || '';
                break;

              case 'segment':
                value = segments[rule.index] || '';
                break;

              case 'after_segment': {
                const idx = segments.findIndex(s => s.toUpperCase() === (rule.afterValue || '').toUpperCase());
                if (idx >= 0 && idx < segments.length - 1) {
                  value = segments[idx + 1];
                }
                break;
              }

              case 'after_pattern': {
                const regex = new RegExp(rule.pattern);
                for (let i = 0; i < segments.length - 1; i++) {
                  if (regex.test(segments[i])) {
                    value = segments[i + 1];
                    break;
                  }
                }
                break;
              }

              case 'last_segment': {
                const lastSegment = segments[segments.length - 1] || '';
                if (rule.pattern) {
                  const regex = new RegExp(rule.pattern);
                  const match = lastSegment.match(regex);
                  if (match) {
                    value = rule.extractGroup !== undefined ? (match[rule.extractGroup] || match[0]) : match[0];
                  }
                } else {
                  value = lastSegment;
                }
                break;
              }

              case 'pattern': {
                const regex = new RegExp(rule.pattern);
                for (const segment of segments) {
                  const match = segment.match(regex);
                  if (match) {
                    value = rule.extractGroup !== undefined ? (match[rule.extractGroup] || '') : match[0];
                    break;
                  }
                }
                break;
              }

              case 'extension_type': {
                // Return "video" for video extensions, "image" otherwise
                const videoExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
                value = videoExtensions.includes(extension?.toLowerCase()) ? 'video' : 'image';
                break;
              }

              case 'empty':
                // Explicitly return empty string
                value = '';
                break;
            }
            parsedFields[fieldName] = value;
            markUsed(rule, value);
          });

          // Now process 'remaining' rules
          Object.entries(parsingRules).forEach(([fieldName, rule]) => {
            if (rule?.rule !== 'remaining') return;
            const remaining = [];
            for (let i = 0; i < segments.length; i++) {
              if (!usedIndices.has(i)) remaining.push(segments[i]);
            }
            parsedFields[fieldName] = remaining.join('_');
          });
        }

        console.log(`📝 Re-parsed ${filename}:`, parsedFields);

        return {
          ...creative,
          ...parsedFields,
          File_format: extension
        };
      });

      // Update spreadsheet
      matrixData.setCreatives(reparsedCreatives);

      // Save to spreadsheet
      await matrixData.save(null, null, null, reparsedCreatives);

      setSyncProgress({
        type: 'success',
        message: `Successfully re-parsed ${reparsedCreatives.length} creatives with current parsing rules.`
      });

      setTimeout(() => setSyncProgress(null), 3000);

    } catch (err) {
      console.error('Re-parse error:', err);
      setSyncProgress({
        type: 'error',
        message: `Failed to re-parse creatives:\n${err.message}`
      });
    } finally {
      setLoadingDrive(false);
    }
  };

  // Load creatives — also ensures needed templates are loaded first (single effect, one render)
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
      const fullResUrl = creative.File_driveID
        ? `/api/drive/proxy/${creative.File_driveID}`
        : (creative.File_DirectLink && (creative.File_DirectLink.startsWith('http') || creative.File_DirectLink.startsWith('/'))
          ? creative.File_DirectLink
          : null);

      const thumbnailUrl = creative.File_thumbnail || fullResUrl;

      // Skip creatives with no valid URL
      if (!fullResUrl && !thumbnailUrl) {
        console.warn(`⚠️ Skipping creative with no valid URL:`, {
          filename: creative.File_name,
          driveId: creative.File_driveID,
          directLink: creative.File_DirectLink,
          thumbnail: creative.File_thumbnail
        });
        return null;
      }

      return {
        id: creative.File_driveID || creative.ID,
        filename: creative.File_name,
        extension: creative.File_format,
        url: thumbnailUrl, // Start with thumbnail
        fullResUrl: fullResUrl, // Store full resolution URL for later upgrade
        product: creative.Product || '',
        size: creative.File_dimensions || '',
        date: creative.File_date || '',
        platforms: [],
        tags: [],
        isDynamic: false,
        bannerSize: bannerSize,
        driveId: creative.File_driveID,
        source: 'drive'
      };
    }).filter(Boolean); // Remove null entries (creatives with invalid URLs)

    // Generate dynamic message creatives for messages with HTML templates only
    if (matrixData?.messages && matrixData.messages.length > 0) {
      const activeMessages = matrixData.messages.filter(m => m.status !== 'deleted');

      // Get non-HTML template names from keywords (e.g., Adobe PSD, Adobe AEP)
      const nonHtmlTemplates = matrixData?.keywords?.messages?.template || [];

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

        // Ensure all needed templates are loaded before generating creatives
        const neededTemplates = new Set();
        uniqueMessages.forEach(msg => {
          if (msg.template && !nonHtmlTemplates.includes(msg.template) && !templatesCache[msg.template]) {
            neededTemplates.add(msg.template);
          }
        });

        if (neededTemplates.size > 0) {
          // Load missing templates in parallel, batch into single cache update
          const results = await Promise.all(
            [...neededTemplates].map(async (name) => {
              const data = await fetchTemplate(name);
              return [name, data];
            })
          );
          const newEntries = {};
          results.forEach(([name, data]) => {
            if (data) newEntries[name] = data;
          });
          if (Object.keys(newEntries).length > 0) {
            setTemplatesCache(prev => ({ ...prev, ...newEntries }));
            // Return early — the cache update will trigger getTemplateSizes to change,
            // which re-creates loadCreatives, which re-fires this effect with templates ready.
            // This avoids generating creatives with wrong sizes then immediately regenerating.
            return;
          }
        }

        const allMessageCreatives = [];

        // Create creatives for each unique message that uses an HTML template
        uniqueMessages.forEach(message => {
          // Skip messages with non-HTML templates (Adobe PSD, Adobe AEP, etc.)
          if (message.template && nonHtmlTemplates.includes(message.template)) {
            return; // Skip - this message uses a non-HTML template
          }

          // Skip messages without a template set - don't default to HTML
          if (!message.template) {
            return; // Skip - no template configured
          }

          // Look up product from audiences or topics based on message
          const audience = (matrixData?.audiences || []).find(a => a.key === message.audience);
          const topic = (matrixData?.topics || []).find(t => t.key === message.topic);
          const product = audience?.product || topic?.product || '';

          // Get template-specific sizes for this message (deduplicated)
          const templateName = message.template;
          const templateSizesRaw = getTemplateSizes(templateName);
          const seenSizes = new Set();
          const templateSizes = templateSizesRaw.filter(size => {
            const key = `${size.width}x${size.height}`;
            if (seenSizes.has(key)) return false;
            seenSizes.add(key);
            return true;
          });

          const messageCreatives = templateSizes.map((size) => ({
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
  }, [matrixData, getTemplateSizes, fetchTemplate, templatesCache]);

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
    setSelectedBaseColor(bgColor);
  };

  // Sync selectedBaseColor with bgColor when share dialog opens
  useEffect(() => {
    if (showShareDialog) {
      setSelectedBaseColor(bgColor);
    }
  }, [showShareDialog, bgColor]);

  const handleFileUpload = async (files) => {
    const fileArray = Array.from(files);
    const previews = [];

    for (const file of fileArray) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await authenticatedFetch('/api/assets/preview-metadata', {
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
        const response = await apiPost('/api/assets/confirm-upload', {
          tempFilename: upload.tempFilename,
          metadata: upload.metadata
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
        await apiPost('/api/assets/cancel-upload', {
          tempFilename: upload.tempFilename
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
    // Safety check: don't save if matrix data isn't fully loaded
    if (!matrixData?.isFullyLoaded) {
      setSaveProgress({
        step: 0,
        total: 1,
        message: 'Cannot save: Matrix data is still loading. Please wait for data to fully load.',
        error: true
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
      setSaveProgress(null);
      return;
    }

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

      // Clear pending drive changes after successful save
      setPendingDriveChanges(null);

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

  // Get unique products from matrixData audiences, topics, and creatives
  const availableProducts = React.useMemo(() => {
    const products = new Set();

    // Add products from audiences
    if (matrixData?.audiences) {
      matrixData.audiences.forEach(aud => {
        if (aud.product) products.add(aud.product);
      });
    }

    // Add products from topics
    if (matrixData?.topics) {
      matrixData.topics.forEach(topic => {
        if (topic.product) products.add(topic.product);
      });
    }

    // Add products from creatives (including static/Drive creatives)
    let hasUndefinedProduct = false;
    creatives.forEach(creative => {
      if (creative.product && creative.product.trim()) {
        products.add(creative.product);
      } else {
        hasUndefinedProduct = true;
      }
    });

    // Add "N/A" option if there are creatives without products
    if (hasUndefinedProduct) {
      products.add('N/A');
    }

    return Array.from(products).sort((a, b) => {
      // Keep N/A at the end
      if (a === 'N/A') return 1;
      if (b === 'N/A') return -1;
      return a.localeCompare(b);
    });
  }, [matrixData?.audiences, matrixData?.topics, creatives]);

  // Set all products selected by default when availableProducts changes
  // Also clean up stale products from localStorage that no longer exist
  useEffect(() => {
    if (availableProducts.length > 0) {
      if (productFilter.length === 0) {
        // No filter set - select all products
        setProductFilter(availableProducts);
      } else {
        // Validate existing filter - remove products that no longer exist
        const validProducts = productFilter.filter(p => availableProducts.includes(p));
        if (validProducts.length !== productFilter.length) {
          // Some products were invalid - update filter
          // If all were invalid, select all available
          setProductFilter(validProducts.length > 0 ? validProducts : availableProducts);
        }
      }
    }
  }, [availableProducts, productFilter.length]);

  // Save product filter to localStorage
  useEffect(() => {
    localStorage.setItem('creativeLibrary_productFilter', JSON.stringify(productFilter));
  }, [productFilter]);

  // Get unique sizes from creatives
  const availableSizes = React.useMemo(() => {
    const sizes = new Set();
    creatives.forEach(creative => {
      if (creative.size && creative.size.trim()) {
        sizes.add(creative.size);
      }
    });
    return Array.from(sizes).sort((a, b) => {
      // Sort by width (first number in WxH format)
      const aWidth = parseInt(a.split('x')[0]) || 0;
      const bWidth = parseInt(b.split('x')[0]) || 0;
      return aWidth - bWidth;
    });
  }, [creatives]);

  // Save size filter to localStorage
  useEffect(() => {
    localStorage.setItem('creativeLibrary_sizeFilter', JSON.stringify(sizeFilter));
  }, [sizeFilter]);

  // Get unique statuses from creatives
  const availableStatuses = React.useMemo(() => {
    const statuses = new Set();
    creatives.forEach(creative => {
      const status = creative.messageData?.status;
      if (status && status.trim()) {
        statuses.add(status.toUpperCase());
      }
    });
    return Array.from(statuses).sort();
  }, [creatives]);

  // Save status filter to localStorage
  useEffect(() => {
    localStorage.setItem('creativeLibrary_statusFilter', JSON.stringify(statusFilter));
  }, [statusFilter]);

  // Save sort preferences to localStorage
  useEffect(() => {
    localStorage.setItem('creativeLibrary_sortColumn', sortColumn);
  }, [sortColumn]);

  useEffect(() => {
    localStorage.setItem('creativeLibrary_sortDirection', sortDirection);
  }, [sortDirection]);

  // Handle sort column click - toggle direction if same column, else set new column with default direction
  const handleSort = useCallback((column) => {
    if (sortColumn === column) {
      // Toggle direction
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // New column - set sensible default direction
      setSortColumn(column);
      // Date defaults to desc (newest first), others to asc
      setSortDirection(column === 'date' ? 'desc' : 'asc');
    }
  }, [sortColumn]);

  // Save bgColor to localStorage
  useEffect(() => {
    localStorage.setItem('creativeLibrary_bgColor', bgColor);
  }, [bgColor]);

  // Reset bgColor when lookAndFeel changes (instance switch)
  useEffect(() => {
    if (lookAndFeel?.headerColor) {
      setBgColor(lookAndFeel.headerColor);
      setSelectedBaseColor(lookAndFeel.headerColor);
    }
  }, [lookAndFeel?.headerColor]);

  // Type filter options (Adobe generated = Drive synced/static creatives)
  const typeOptions = ['Dynamic HTML', 'Adobe generated'];

  // Filter and sort creatives based on product and type
  const filteredByFilters = React.useMemo(() => {
    const filtered = creatives.filter(creative => {
      // Product filter
      let matchesProduct = productFilter.length === 0;
      if (!matchesProduct) {
        if (creative.product && creative.product.trim()) {
          // Creative has a product - check if it's in the filter
          matchesProduct = productFilter.includes(creative.product);
        } else {
          // Creative has no product - check if "N/A" is in the filter
          matchesProduct = productFilter.includes('N/A');
        }
      }

      // Type filter
      let matchesType = true;
      if (typeFilter.length > 0) {
        // Only check isDynamic flag - extension doesn't determine if it's a dynamic template
        const isDynamicHTML = creative.isDynamic === true;

        if (typeFilter.includes('Dynamic HTML') && typeFilter.includes('Adobe generated')) {
          matchesType = true; // Both selected = show all
        } else if (typeFilter.includes('Dynamic HTML')) {
          matchesType = isDynamicHTML;
        } else if (typeFilter.includes('Adobe generated')) {
          matchesType = !isDynamicHTML; // Adobe generated = static (non-dynamic) creatives from Drive
        }
      }

      // Size filter
      let matchesSize = sizeFilter.length === 0; // No filter = show all
      if (!matchesSize && creative.size) {
        matchesSize = sizeFilter.includes(creative.size);
      }

      // Status filter
      let matchesStatus = statusFilter.length === 0; // No filter = show all
      if (!matchesStatus) {
        const creativeStatus = (creative.messageData?.status || '').toUpperCase();
        matchesStatus = statusFilter.includes(creativeStatus);
      }

      return matchesProduct && matchesType && matchesSize && matchesStatus;
    });

    // Sort based on sortColumn and sortDirection
    return filtered.sort((a, b) => {
      let comparison = 0;

      // Helper to get product (resolves from audience for dynamic creatives)
      const getProduct = (creative) => {
        if (creative.isDynamic && creative.messageData?.audience && matrixData?.audiences?.length > 0) {
          const audience = matrixData.audiences.find(aud => aud.key === creative.messageData.audience);
          return audience?.product || creative.product || '';
        }
        return creative.product || '';
      };

      // Helper to get display name
      const getName = (creative) => {
        if (creative.isDynamic && creative.messageData && creative.bannerSize) {
          return `MC${creative.messageData.number} ${creative.variant?.toUpperCase() || ''} ${creative.bannerSize.width}x${creative.bannerSize.height}`;
        }
        return creative.filename || '';
      };

      switch (sortColumn) {
        case 'name': {
          // Sort by MC number numerically
          const getMcNumber = (creative) => {
            // For dynamic creatives, use messageData.number
            if (creative.isDynamic && creative.messageData?.number) {
              return parseInt(creative.messageData.number, 10) || 0;
            }
            // For static files, try to extract MC number from filename (e.g., "MC123_...")
            const match = (creative.filename || '').match(/MC(\d+)/i);
            if (match) return parseInt(match[1], 10) || 0;
            return 0;
          };
          const mcNumA = getMcNumber(a);
          const mcNumB = getMcNumber(b);
          // If both have MC numbers, compare numerically
          if (mcNumA > 0 || mcNumB > 0) {
            comparison = mcNumA - mcNumB;
          } else {
            // Fall back to alphabetical for non-MC items
            const nameA = getName(a).toLowerCase();
            const nameB = getName(b).toLowerCase();
            comparison = nameA.localeCompare(nameB);
          }
          break;
        }
        case 'size': {
          // Parse size as dimensions for numeric sorting (e.g., "300x250" -> 300*250 = 75000)
          const parseSize = (size) => {
            if (!size) return 0;
            const match = size.match(/(\d+)x(\d+)/);
            if (match) return parseInt(match[1]) * parseInt(match[2]);
            return 0;
          };
          comparison = parseSize(a.size) - parseSize(b.size);
          break;
        }
        case 'template': {
          const templateA = (a.messageData?.template || '').toLowerCase();
          const templateB = (b.messageData?.template || '').toLowerCase();
          comparison = templateA.localeCompare(templateB);
          break;
        }
        case 'date': {
          const dateA = a.date || a.File_date || '';
          const dateB = b.date || b.File_date || '';
          const timeA = dateA ? new Date(dateA).getTime() : 0;
          const timeB = dateB ? new Date(dateB).getTime() : 0;
          comparison = timeA - timeB;
          break;
        }
        case 'product': {
          const productA = getProduct(a).toLowerCase();
          const productB = getProduct(b).toLowerCase();
          comparison = productA.localeCompare(productB);
          break;
        }
        default:
          comparison = 0;
      }

      // Apply direction
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [creatives, productFilter, typeFilter, sizeFilter, statusFilter, sortColumn, sortDirection, matrixData?.audiences]);

  return (
    <div className="matrix-fullscreen" style={{ backgroundColor: 'var(--color-primary)' }}>
      <div className="matrix-view-container" style={{ backgroundColor: bgColor }}>
        <MediaLibraryBase
        items={filteredByFilters}
        lookAndFeel={lookAndFeel}
        currentModuleName={currentModuleName || 'Creative Library'}
        onMenuToggle={onMenuToggle}
        onFilteredItemsChange={setFilteredCreatives}
        initialFilterText={initialFilterFromUrl}
        getItemId={(creative) => creative.id}
        getItemExtension={(creative) => creative.extension}
        getItemUrl={(creative) => creative.url}
        getItemFilename={(creative) => creative.filename}

        // Sorting props
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        listColumns={[
          { key: 'name', label: 'Item' },
          { key: 'size', label: 'Size' },
          { key: 'template', label: 'Template' },
          { key: 'date', label: 'Date' },
          { key: 'product', label: 'Product' }
        ]}

        // No header - just toolbar
        renderHeader={({ filterText, setFilterText, viewMode, setViewMode, viewModes, totalItems, filteredCount, debugInfo }) => (
          <MediaToolbar
            filterText={filterText}
            setFilterText={setFilterText}
            productFilter={productFilter}
            setProductFilter={setProductFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            sizeFilter={sizeFilter}
            setSizeFilter={setSizeFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            availableProducts={availableProducts}
            typeOptions={typeOptions}
            availableSizes={availableSizes}
            availableStatuses={availableStatuses}
            statusColors={settings.getStatusColors?.() || {}}
            filteredCount={filteredCount}
            totalCount={totalItems}
            viewMode={viewMode}
            setViewMode={setViewMode}
            debugInfo={debugInfo}
            // Selection props
            selectorMode={selectorMode}
            selectedCount={selectedCreativeIds.size}
            onEnterSelectMode={() => setSelectorMode(true)}
            onSelectAll={() => {
              // Select all filtered creatives
              const allIds = new Set(filteredCreatives.map(c => c.id));
              setSelectedCreativeIds(allIds);
            }}
            onDeselectAll={() => setSelectedCreativeIds(new Set())}
            onExitSelection={() => {
              setSelectorMode(false);
              setSelectedCreativeIds(new Set());
            }}
            onShare={() => setShowShareDialog(true)}
            onExportImages={() => setShowExportDialog(true)}
            // Color picker props
            bgColor={bgColor}
            setBgColor={setBgColor}
            colorPresets={[
              lookAndFeel?.headerColor || '#2870ed',
              lookAndFeel?.secondaryColor1 || '#eb4c79',
              lookAndFeel?.secondaryColor2 || '#02a3a4',
              lookAndFeel?.secondaryColor3 || '#711c7a'
            ]}
          />
        )}

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
            templatesCache={templatesCache}
            getTemplateForCreative={getTemplateForCreative}
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
            const templateData = getTemplateForCreative(creative);
            if (!isDynamic || !creative.messageData || !templateData.config) return creative.url;

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
                const placeholder = templateData.config.placeholders?.[img.placeholderName];
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
        renderPreview={(selectedCreative, onClose, allFilteredCreatives, onNavigate) => {
          const templateData = getTemplateForCreative(selectedCreative);
          return (
            <CreativePreview
              creative={selectedCreative}
              onClose={onClose}
              templateHtml={templateData.html}
              templateConfig={templateData.config}
              templateCss={templateData.css}
              allCreatives={allFilteredCreatives}
              onNavigate={onNavigate}
              textFormatting={matrixData?.textFormatting || []}
              audiences={matrixData?.audiences || []}
            />
          );
        }}

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
        templatesCache={templatesCache}
        loadTemplate={loadTemplate}
        getTemplateForCreative={getTemplateForCreative}
        textFormatting={matrixData?.textFormatting || []}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        />

      {/* Export Images Dialog */}
      <ExportImagesDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        selectedCreatives={creatives.filter(c => selectedCreativeIds.has(c.id))}
        templatesCache={templatesCache}
        textFormatting={matrixData?.textFormatting || []}
        selectedBaseColor={selectedBaseColor}
      />
      </div>

      {/* Bottom Bar */}
      <BottomBar>
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
          onClearReload={clearAndReloadApp}
          onRegenerateTopicKeys={matrixData?.regenerateTopicKeys}
          downloadFeedCSV={() => {}}
          changeTracking={matrixData?.changeTracking}
          originalState={matrixData?.originalState}
          // Drive sync props
          creativesFolderId={creativesFolderId}
          assetsFolderId={assetsFolderId}
          onSyncCreatives={syncWithDrive}
          syncingCreatives={loadingDrive}
          // Template reload props
          onReloadTemplates={reloadTemplates}
          reloadingTemplates={reloadingTemplates}
          // Module-specific props
          activeTabs={['creatives']}
          pendingChanges={pendingDriveChanges}
          isFullyLoaded={matrixData?.isFullyLoaded}
        />
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
      </BottomBar>
    </div>
  );
};

export default CreativeLibrary;

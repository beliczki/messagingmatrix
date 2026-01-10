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
import { processAssets } from '../utils/assetUtils';
import { clearAndReloadApp } from '../utils/clearAndReload';
import { loadDriveAssets, isDriveEnabled, parseDriveAssetData } from '../utils/driveAssets';
import settings from '../services/settings';
import { apiGet } from '../utils/api';

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

  // Load a single template by name
  const loadTemplate = useCallback(async (templateName) => {
    if (templatesCache[templateName]) return templatesCache[templateName];

    try {
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

      // Load CSS files
      const cssMap = { main: '' };
      const mainCssResponse = await apiGet(`/api/templates/${templateName}/main.css`);
      if (mainCssResponse.ok) {
        const mainCssData = await mainCssResponse.json();
        cssMap.main = mainCssData.content || '';
      }

      // Get sizes from config or use defaults
      const sizesToLoad = config?.sizes || defaultBannerSizes;

      // Load size-specific CSS files (silently skip missing ones)
      for (const size of sizesToLoad) {
        const sizeKey = `${size.width}x${size.height}`;
        try {
          const sizeCssResponse = await apiGet(`/api/templates/${templateName}/${sizeKey}.css`);
          if (sizeCssResponse.ok) {
            const sizeCssData = await sizeCssResponse.json();
            const cssText = sizeCssData.content || '';
            // Only add if it's actual CSS content
            if (cssText && !cssText.includes('<!DOCTYPE') && !cssText.includes('<html')) {
              cssMap[sizeKey] = cssText;
            }
          }
        } catch (e) {
          // Size CSS is optional - silently ignore
        }
      }

      const templateData = { html, config, css: cssMap };
      setTemplatesCache(prev => ({ ...prev, [templateName]: templateData }));
      return templateData;
    } catch (error) {
      console.error(`Failed to load template ${templateName}:`, error);
      return null;
    }
  }, [templatesCache]);

  // Load templates for all unique message templates
  useEffect(() => {
    const loadTemplatesForMessages = async () => {
      if (!matrixData?.messages) return;

      // Get unique templates from messages (only load explicitly set templates)
      const templates = new Set();
      const nonHtmlTemplates = matrixData?.keywords?.messages?.template || [];

      matrixData.messages.forEach(msg => {
        // Skip messages without a template - don't default to 'html'
        if (!msg.template) return;

        // Only load HTML-based templates (skip Adobe PSD, Adobe AEP, etc.)
        if (!nonHtmlTemplates.includes(msg.template)) {
          templates.add(msg.template);
        }
      });

      // Load each unique template
      for (const templateName of templates) {
        if (!templatesCache[templateName]) {
          await loadTemplate(templateName);
        }
      }
    };

    loadTemplatesForMessages();
  }, [matrixData?.messages, matrixData?.keywords, loadTemplate, templatesCache]);

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

      setPendingDriveChanges({
        added: newCreatives.length,
        removed: deletedCreatives.length,
        addedIds,
        removedIds
      });

      setSyncProgress({
        type: 'success',
        message: `Synced with Google Drive.\n\nAdded: ${newCreatives.length} creatives\nRemoved: ${deletedCreatives.length} creatives\n\n⚠️ Changes are pending - click Save to persist to spreadsheet.`
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

        const allMessageCreatives = [];

        // Create creatives for each unique message that uses an HTML template
        uniqueMessages.forEach(message => {
          // Skip messages with non-HTML templates (Adobe PSD, Adobe AEP, etc.)
          if (message.template && nonHtmlTemplates.includes(message.template)) {
            return; // Skip - this message uses a non-HTML template
          }

          // Skip messages without a template set - don't default to HTML
          // (Only generate HTML creatives if template is explicitly set to an HTML template name)
          if (!message.template) {
            return; // Skip - no template configured
          }

          // Look up product from audiences based on message.audience
          // Only use actual product values - don't fallback to message name/number
          const audience = (matrixData?.audiences || []).find(a => a.key === message.audience);
          const product = audience?.product || '';

          // Get template-specific sizes for this message
          const templateName = message.template; // template is guaranteed to be set (checked above)
          const templateSizes = getTemplateSizes(templateName);

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
  }, [matrixData, getTemplateSizes]);

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

  // Get unique products from both matrixData audiences and creatives
  const availableProducts = React.useMemo(() => {
    const products = new Set();

    // Add products from audiences
    if (matrixData?.audiences) {
      matrixData.audiences.forEach(aud => {
        if (aud.product) products.add(aud.product);
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
  }, [matrixData?.audiences, creatives]);

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

  // Save bgColor to localStorage
  useEffect(() => {
    localStorage.setItem('creativeLibrary_bgColor', bgColor);
  }, [bgColor]);

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

      return matchesProduct && matchesType && matchesSize;
    });

    // Sort: newest on top, then by MC number (larger first)
    return filtered.sort((a, b) => {
      // Get dates (from date field or File_date)
      const dateA = a.date || a.File_date || '';
      const dateB = b.date || b.File_date || '';

      // Compare dates (newest first)
      if (dateA && dateB) {
        const timeA = new Date(dateA).getTime();
        const timeB = new Date(dateB).getTime();
        if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
          return timeB - timeA; // Descending (newest first)
        }
      } else if (dateA && !dateB) {
        return -1; // A has date, B doesn't - A first
      } else if (!dateA && dateB) {
        return 1; // B has date, A doesn't - B first
      }

      // If dates are same or unavailable, sort by MC number (larger first)
      const mcNumA = parseInt(a.messageData?.number || a.MC_Number || '0', 10) || 0;
      const mcNumB = parseInt(b.messageData?.number || b.MC_Number || '0', 10) || 0;
      return mcNumB - mcNumA; // Descending (larger first)
    });
  }, [creatives, productFilter, typeFilter, sizeFilter]);

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

        // No header - just toolbar
        renderHeader={({ filterText, setFilterText, viewMode, setViewMode, viewModes, totalItems, filteredCount }) => (
          <MediaToolbar
            filterText={filterText}
            setFilterText={setFilterText}
            productFilter={productFilter}
            setProductFilter={setProductFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            sizeFilter={sizeFilter}
            setSizeFilter={setSizeFilter}
            availableProducts={availableProducts}
            typeOptions={typeOptions}
            availableSizes={availableSizes}
            filteredCount={filteredCount}
            totalCount={totalItems}
            viewMode={viewMode}
            setViewMode={setViewMode}
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

        // Custom floating actions
        renderFloatingActions={({ showDebugInfo, setShowDebugInfo, debugInfo }) => (
          <div className="fixed bottom-[68px] right-8 z-40">
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
              <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-xl p-4 text-xs text-gray-700 border border-gray-200 min-w-64">
                {/* Drive Sync Status */}
                {syncProgress && (
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <div className="font-semibold mb-2 flex items-center gap-2">
                      {syncProgress.type === 'loading' && (
                        <Loader size={16} className="text-blue-600 animate-spin" />
                      )}
                      {syncProgress.type === 'success' && (
                        <CheckCircle size={16} className="text-green-600" />
                      )}
                      {syncProgress.type === 'error' && (
                        <AlertCircle size={16} className="text-red-600" />
                      )}
                      <span className={
                        syncProgress.type === 'loading' ? 'text-blue-600' :
                        syncProgress.type === 'success' ? 'text-green-600' :
                        'text-red-600'
                      }>
                        {syncProgress.type === 'loading' && 'Syncing with Drive...'}
                        {syncProgress.type === 'success' && 'Sync Successful'}
                        {syncProgress.type === 'error' && 'Sync Failed'}
                      </span>
                    </div>
                    <div className="text-gray-600 whitespace-pre-line">{syncProgress.message}</div>
                    {syncProgress.type === 'error' && (
                      <button
                        onClick={() => setSyncProgress(null)}
                        className="mt-2 text-xs text-red-600 hover:text-red-700 underline"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                )}

                {/* Virtual Scrolling Info */}
                <div className="font-semibold mb-2 text-blue-600">Virtual Scrolling Info</div>
                <div className="whitespace-nowrap">{debugInfo}</div>
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
        templatesCache={templatesCache}
        getTemplateForCreative={getTemplateForCreative}
        textFormatting={matrixData?.textFormatting || []}
        />
      </div>

      {/* Bottom Bar */}
      <div className="bottom-bar">
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
      </div>
    </div>
  );
};

export default CreativeLibrary;

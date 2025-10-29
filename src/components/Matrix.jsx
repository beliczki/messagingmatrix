import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Save, RefreshCw, ExternalLink, AlertCircle, Edit2, X, Trash2, Eye, Settings, ChevronLeft, ChevronRight, Sparkles, Loader, Table, GitBranch, List, Users as UsersIcon, Check, ChevronDown } from 'lucide-react';
import settings from '../services/settings';
import { generatePMMID, generateTopicKey, generateTraffickingFields, evaluatePattern } from '../utils/patternEvaluator';
import { applyTextFormattingSpans } from '../utils/textFormatter';
import AIAssistant from './AIAssistant';
import TreeView from './TreeView';
import KeywordEditor from './KeywordEditor';
import MessageEditorDialog from './MessageEditorDialog';
import AudienceEditorDialog from './AudienceEditorDialog';
import TopicEditorDialog from './TopicEditorDialog';
import OrphanedMessagesDialog from './OrphanedMessagesDialog';
import MatrixControlPanel from './MatrixControlPanel';
import FeedTableView from './FeedTableView';
import PageHeader, { getButtonStyle } from './PageHeader';

// Module-level persistent refs to survive component re-renders/remounts
const EMPTY_ARRAY = [];
const persistentMatrixRefs = {
  audiences: EMPTY_ARRAY,
  topics: EMPTY_ARRAY,
  messages: EMPTY_ARRAY,
  statusFilters: EMPTY_ARRAY,
  productFilters: EMPTY_ARRAY,
  // Dep tracking
  prevAudiences: null,
  prevAudienceFilter: null,
  prevProductFilters: null,
  prevFilteredAudiences: null,
  prevFilteredTopics: null,
  // Cached filtered arrays
  cachedFilteredAudiences: EMPTY_ARRAY,
  cachedFilteredAudiencesDeps: { audiences: null, audienceFilter: null, productFilters: null },
  cachedFilteredTopics: EMPTY_ARRAY,
  cachedFilteredTopicsDeps: { topics: null, topicFilter: null, productFilters: null }
};

const Matrix = ({
  onMenuToggle,
  currentModuleName,
  lookAndFeel,
  matrixViewState,
  setMatrixViewState,
  matrixData,
  onStateDataReady
}) => {
  const claudeChatRef = useRef(null);

  // Detect mount/unmount
  useEffect(() => {
    console.log('🟢🟢🟢 Matrix MOUNTED');
    return () => console.log('🔴🔴🔴 Matrix UNMOUNTED');
  }, []);

  // Update module-level refs when data changes
  if (matrixData?.audiences && persistentMatrixRefs.audiences !== matrixData.audiences) {
    console.log('🟡 Matrix: Updating module-level audiences ref');
    persistentMatrixRefs.audiences = matrixData.audiences;
  }
  if (matrixData?.topics && persistentMatrixRefs.topics !== matrixData.topics) {
    console.log('🟡 Matrix: Updating module-level topics ref');
    persistentMatrixRefs.topics = matrixData.topics;
  }
  if (matrixData?.messages && persistentMatrixRefs.messages !== matrixData.messages) {
    console.log('🟡 Matrix: Updating module-level messages ref');
    persistentMatrixRefs.messages = matrixData.messages;
  }

  // Use module-level refs (these are ALWAYS the same reference)
  const audiences = persistentMatrixRefs.audiences;
  const topics = persistentMatrixRefs.topics;
  const messages = persistentMatrixRefs.messages;

  console.log('🔵 Matrix component render', {
    audiencesLen: audiences?.length,
    topicsLen: topics?.length,
    messagesLen: messages?.length
  });

  // Destructure other values
  const {
    keywords = {},
    assets = [],
    textFormatting = [],
    isLoading = false,
    isSaving = false,
    error = null,
    lastSync = null,
    load = () => {},
    save = () => {},
    saveKeywords = () => {},
    addAudience = () => {},
    addTopic = () => {},
    addMessage = () => {},
    updateMessage = () => {},
    deleteMessage = () => {},
    moveMessage = () => {},
    copyMessage = () => {},
    updateAudience = () => {},
    updateTopic = () => {},
    deleteAudience = () => {},
    deleteTopic = () => {},
    getMessages = () => [],
    getUrl = () => '',
    getSpreadsheetId = () => ''
  } = matrixData || {};

  const [editingCell, setEditingCell] = useState(null);
  const [editingHeader, setEditingHeader] = useState(null);
  const [draggedMsg, setDraggedMsg] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editingAudience, setEditingAudience] = useState(null);
  const [editingTopic, setEditingTopic] = useState(null);
  const [showKeywordEditor, setShowKeywordEditor] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('naming'); // 'naming' or 'content'
  const [previewSize, setPreviewSize] = useState('300x250');
  const [saveProgress, setSaveProgress] = useState(null); // { step: number, message: string }
  const [generatedContent, setGeneratedContent] = useState(null);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [orphanedMessages, setOrphanedMessages] = useState([]);
  const [showOrphanedDialog, setShowOrphanedDialog] = useState(false);
  const [correctingMessage, setCorrectingMessage] = useState(null);

  // Use matrixViewState for persisted values - memoize arrays with stable references
  const viewMode = matrixViewState?.viewMode || 'matrix';
  const displayMode = matrixViewState?.displayMode || 'informative';
  const topicFilter = matrixViewState?.topicFilter || '';
  const audienceFilter = matrixViewState?.audienceFilter || '';

  // Update module-level filter refs when they change
  const currentStatuses = matrixViewState?.selectedStatuses || EMPTY_ARRAY;
  if (JSON.stringify(persistentMatrixRefs.statusFilters) !== JSON.stringify(currentStatuses)) {
    console.log('🟠 statusFilters updating');
    persistentMatrixRefs.statusFilters = currentStatuses;
  }
  const statusFilters = persistentMatrixRefs.statusFilters;

  const currentProducts = matrixViewState?.selectedProducts || EMPTY_ARRAY;
  if (JSON.stringify(persistentMatrixRefs.productFilters) !== JSON.stringify(currentProducts)) {
    console.log('🟠 productFilters updating');
    persistentMatrixRefs.productFilters = currentProducts;
  }
  const productFilters = persistentMatrixRefs.productFilters;
  const matrixZoom = matrixViewState?.matrixZoom || 1;
  const matrixPan = useMemo(() => matrixViewState?.matrixPan || { x: 0, y: 0 }, [matrixViewState?.matrixPan]);
  const treeZoom = matrixViewState?.treeZoom || 1;

  // Setter functions that update matrixViewState
  const setViewMode = (value) => setMatrixViewState({ ...matrixViewState, viewMode: value });
  const setDisplayMode = (value) => setMatrixViewState({ ...matrixViewState, displayMode: value });
  const setTopicFilter = (value) => setMatrixViewState({ ...matrixViewState, topicFilter: value });
  const setAudienceFilter = (value) => setMatrixViewState({ ...matrixViewState, audienceFilter: value });
  const setStatusFilters = (value) => setMatrixViewState({ ...matrixViewState, selectedStatuses: value });
  const setProductFilters = (value) => setMatrixViewState({ ...matrixViewState, selectedProducts: value });
  const setMatrixZoom = (value) => {
    console.log('🔷 setMatrixZoom called with:', value);
    setMatrixViewState({ ...matrixViewState, matrixZoom: value });
  };
  const setMatrixPan = (value) => setMatrixViewState({ ...matrixViewState, matrixPan: value });
  const setTreeZoom = (value) => {
    console.log('🔷 setTreeZoom called with:', value);
    setMatrixViewState({ ...matrixViewState, treeZoom: value });
  };

  // Tree view controls state
  const [treeConnectorType, setTreeConnectorType] = useState('curved');
  const [treeStructure, setTreeStructure] = useState(() => {
    // Initialize from settings synchronously to prevent oscillation
    try {
      const config = settings.getAll();
      return config.treeStructure || 'Audiences.Product → Audiences.Strategy → Audiences.Targeting_type → Audiences.Name → Topics.Name → Messages.Number → Messages.Variant';
    } catch (e) {
      console.warn('Could not load tree structure from settings on init:', e);
      return 'Audiences.Product → Audiences.Strategy → Audiences.Targeting_type → Audiences.Name → Topics.Name → Messages.Number → Messages.Variant';
    }
  });

  // Feed view controls state
  const [feedStructure, setFeedStructure] = useState(() => {
    // Initialize from settings synchronously to prevent oscillation
    try {
      const config = settings.getAll();
      return config.feedStructure || 'PMMID, Name, Headline, Copy1, Audience, Topic, Status';
    } catch (e) {
      console.warn('Could not load feed structure from settings on init:', e);
      return 'PMMID, Name, Headline, Copy1, Audience, Topic, Status';
    }
  });
  const [feedPatterns, setFeedPatterns] = useState(() => {
    // Initialize from settings synchronously
    try {
      const config = settings.getAll();
      return config.patterns?.feed || {};
    } catch (e) {
      return {};
    }
  });

  // Matrix view controls state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const matrixContainerRef = useRef(null);
  const productDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);

  // Handle keyboard events for spacebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Allow space in input fields, textareas, and contenteditable elements
      const target = e.target;
      const isInputField = target.tagName === 'INPUT' ||
                          target.tagName === 'TEXTAREA' ||
                          target.isContentEditable;

      if (e.code === 'Space' && !spacePressed && viewMode === 'matrix' && !isInputField) {
        e.preventDefault();
        setSpacePressed(true);
      }
    };

    const handleKeyUp = (e) => {
      // Allow space in input fields, textareas, and contenteditable elements
      const target = e.target;
      const isInputField = target.tagName === 'INPUT' ||
                          target.tagName === 'TEXTAREA' ||
                          target.isContentEditable;

      if (e.code === 'Space' && !isInputField) {
        e.preventDefault();
        setSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [spacePressed, viewMode]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target)) {
        setShowProductDropdown(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setShowStatusDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Detect orphaned messages (messages with invalid topic or audience keys)
  useEffect(() => {
    if (!messages || !audiences || !topics) return;

    const audienceKeys = new Set(audiences.map(a => a.key));
    const topicKeys = new Set(topics.map(t => t.key));

    const orphaned = messages
      .filter(m => m.status !== 'deleted')
      .filter(m => {
        const hasInvalidAudience = m.audience && !audienceKeys.has(m.audience);
        const hasInvalidTopic = m.topic && !topicKeys.has(m.topic);
        return hasInvalidAudience || hasInvalidTopic;
      })
      .map(m => ({
        ...m,
        missingAudience: m.audience && !audienceKeys.has(m.audience),
        missingTopic: m.topic && !topicKeys.has(m.topic)
      }));

    if (orphaned.length > 0 && orphaned.length !== orphanedMessages.length) {
      console.error('⚠️ Found orphaned messages:', orphaned);
      setOrphanedMessages(orphaned);
      setShowOrphanedDialog(true);
    } else if (orphaned.length === 0 && orphanedMessages.length > 0) {
      setOrphanedMessages([]);
      setShowOrphanedDialog(false);
    }
  }, [messages, audiences, topics]);

  // Load tree and feed structures from settings on mount
  useEffect(() => {
    const loadStructures = async () => {
      try {
        await settings.ensureInitialized();
        const config = settings.getAll();
        console.log('📋 Loading structures from settings:', {
          hasFeedStructure: !!config.feedStructure,
          hasPatterns: !!config.patterns,
          hasFeedPatterns: !!config.patterns?.feed,
          feedPatternsCount: config.patterns?.feed ? Object.keys(config.patterns.feed).length : 0
        });
        if (config.treeStructure) {
          setTreeStructure(config.treeStructure);
        }
        if (config.feedStructure) {
          setFeedStructure(config.feedStructure);
        }
        // Load feed patterns from patterns.feed
        if (config.patterns?.feed) {
          const patternKeys = Object.keys(config.patterns.feed);
          console.log('📋 Setting feed patterns count:', patternKeys.length);
          console.log('📋 All pattern names:', patternKeys);
          setFeedPatterns(config.patterns.feed);
        } else {
          console.warn('⚠️ No feed patterns found in settings.patterns.feed');
        }
      } catch (error) {
        console.error('Error loading structures:', error);
      }
    };
    loadStructures();
  }, []);

  // Log treeStructure changes to debug oscillation
  useEffect(() => {
    console.log('🔶 treeStructure changed:', treeStructure);
  }, [treeStructure]);

  // Initialize filters with all options on first load
  useEffect(() => {
    console.log('🟡 Filter init useEffect fired', {
      audiencesLength: audiences.length,
      topicsLength: topics.length,
      statusFiltersLength: statusFilters.length,
      productFiltersLength: productFilters.length
    });

    // Only initialize if data has loaded
    if (audiences.length === 0 && topics.length === 0) {
      console.log('🟡 Skipping: no data loaded yet');
      return;
    }

    // Only initialize if filters are currently empty (first time, no saved state)
    if (statusFilters.length > 0 || productFilters.length > 0) {
      console.log('🟡 Skipping: filters already initialized');
      return;
    }

    // Get all available products
    const allProducts = new Set();
    audiences.forEach(aud => {
      if (aud.product) allProducts.add(aud.product);
    });
    topics.forEach(topic => {
      if (topic.product) allProducts.add(topic.product);
    });
    const productsArray = Array.from(allProducts).sort();

    // Get all available statuses
    const allStatuses = keywords.messages?.status || ['ACTIVE', 'INACTIVE', 'INPROGRESS', 'PLANNED', 'ERROR'];

    // Only initialize if we have options to select
    if (productsArray.length > 0 || allStatuses.length > 0) {
      console.log('🟡 CALLING setMatrixViewState to initialize filters');
      // Update matrixViewState with all options selected
      setMatrixViewState({
        ...matrixViewState,
        selectedProducts: productsArray,
        selectedStatuses: allStatuses
      });
    }
  }, [audiences, topics, keywords, statusFilters.length, productFilters.length]);

  // Sync feedPatterns with feedStructure - ensure all columns have patterns
  useEffect(() => {
    // Only sync if feedStructure exists - feedPatterns being empty is OK now due to smart fallback
    if (!feedStructure) {
      return;
    }

    const columns = feedStructure.split(',').map(col => col.trim());
    const updatedPatterns = { ...feedPatterns };
    let needsUpdate = false;

    // Only add patterns if feedPatterns has been initialized (has at least one entry)
    // This prevents overwriting user-configured patterns
    if (Object.keys(feedPatterns).length > 0) {
      // Remove patterns for columns that no longer exist
      Object.keys(updatedPatterns).forEach(key => {
        if (!columns.includes(key)) {
          delete updatedPatterns[key];
          needsUpdate = true;
        }
      });
    }

    if (needsUpdate) {
      setFeedPatterns(updatedPatterns);
      // Save updated patterns asynchronously (don't await to avoid blocking)
      saveFeedPatterns(updatedPatterns).catch(err => {
        console.error('Failed to auto-save feed patterns:', err);
      });
    }
  }, [feedStructure]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save tree structure to settings
  const saveTreeStructure = async (newStructure) => {
    try {
      await settings.ensureInitialized();
      const config = settings.getAll();
      await settings.save({
        ...config,
        treeStructure: newStructure
      });
      setTreeStructure(newStructure);
    } catch (error) {
      console.error('Error saving tree structure:', error);
      alert('Failed to save tree structure');
    }
  };

  // Save feed structure to settings
  const saveFeedStructure = async (newStructure) => {
    try {
      await settings.ensureInitialized();
      const config = settings.getAll();
      await settings.save({
        ...config,
        feedStructure: newStructure
      });
      setFeedStructure(newStructure);
    } catch (error) {
      console.error('Error saving feed structure:', error);
      alert('Failed to save feed structure');
    }
  };

  // Save feed patterns to settings
  const saveFeedPatterns = async (newPatterns) => {
    try {
      await settings.ensureInitialized();
      const config = settings.getAll();
      await settings.save({
        ...config,
        patterns: {
          ...config.patterns,
          feed: newPatterns
        }
      });
      setFeedPatterns(newPatterns);
    } catch (error) {
      console.error('Error saving feed patterns:', error);
      alert('Failed to save feed patterns');
    }
  };

  // Generate feed data for state dialog and CSV export
  const feedData = useMemo(() => {
    if (!feedStructure) {
      return [];
    }

    const columns = feedStructure.split(',').map(col => col.trim());

    // Smart fallback pattern mapping for common feed column formats
    const getDefaultPattern = (name) => {
      // Remove prefix like "Text:", "Asset:", "LP:" etc.
      const cleanName = name.replace(/^[^:]+:/, '');
      const cleanNameLower = cleanName.toLowerCase();

      // Common mappings for feed columns to message fields (case-insensitive)
      const commonMappings = {
        // Text fields
        'headline_text_1': '{{headline}}',
        'headline_text': '{{headline}}',
        'headline': '{{headline}}',
        'copy_text_1': '{{copy1}}',
        'copy1': '{{copy1}}',
        'copy_text_2': '{{copy2}}',
        'copy2': '{{copy2}}',
        'click_text': '{{cta}}',
        'cta_text_1': '{{cta}}',
        'cta': '{{cta}}',
        'flash_text': '{{flash}}',
        'sticker_text_1': '{{flash}}',
        'flash': '{{flash}}',
        'disclaimer_text': '{{disclaimer}}',
        'disclaimer': '{{disclaimer}}',
        // Style fields
        'headline_style_1': '{{headline_style}}',
        'headline_style': '{{headline_style}}',
        'copy_style_1': '{{copy1_style}}',
        'copy1_style': '{{copy1_style}}',
        'copy_style_2': '{{copy2_style}}',
        'copy2_style': '{{copy2_style}}',
        'flash_style': '{{flash_style}}',
        'sticker_style_1': '{{flash_style}}',
        'cta_style': '{{cta_style}}',
        'cta_style_1': '{{cta_style}}',
        'disclaimer_style': '{{disclaimer_style}}',
        'css_styles': '{{css}}',
        'css': '{{css}}',
        // Other fields
        'template_variant_class': '{{template_variant_classes}}',
        'template_variant_classes': '{{template_variant_classes}}',
        'messaging_card_id': '{{number}}',
        'messaging_card_variant': '{{variant}}',
        'advert_name': '{{name}}',
        'name': '{{name}}',
        'number': '{{number}}',
        'variant': '{{variant}}',
        'landingurl': '{{landingUrl}}',
        'clicktag': '{{landingUrl}}',
        // Image fields
        'background_image_1': '{{image1}}',
        'image1': '{{image1}}',
        'background_image_2': '{{image2}}',
        'image2': '{{image2}}',
        'background_image_3': '{{image3}}',
        'image3': '{{image3}}',
        'background_image_4': '{{image4}}',
        'image4': '{{image4}}',
        'sticker_image_1': '{{image6}}',
        'image6': '{{image6}}',
        'background_image_logo': '{{image5}}',
        'image5': '{{image5}}'
      };

      return commonMappings[cleanNameLower] || `{{${cleanNameLower}}}`;
    };

    return messages.map((msg) => {
      const status = (msg.status || 'PLANNED').toUpperCase();
      const context = {
        ...msg,
        audiences,
        topics,
        Audience_Key: msg.audience,
        Topic_Key: msg.topic,
        Number: msg.number || '',
        Variant: msg.variant || '',
        Version: msg.version || '',
        status: status
      };

      // Build feed row object
      const feedRow = {};
      columns.forEach(colName => {
        const pattern = feedPatterns[colName] || getDefaultPattern(colName);
        let cellValue = evaluatePattern(pattern, context);

        // Apply text formatting with spans for text fields (case-insensitive check)
        const patternLower = pattern.toLowerCase();
        const textFields = ['headline', 'copy1', 'copy2', 'flash', 'cta', 'disclaimer'];
        const isTextField = textFields.some(field =>
          patternLower.includes(`{{${field}}}`)
        );

        if (isTextField && cellValue) {
          // Pass message object with multiple identifiers for MC scope matching
          const msgIdentifiers = {
            id: String(msg.id),
            poms_id: msg.poms_id,
            name: msg.name,
            number: String(msg.number || ''),
            variant: msg.variant || '',
            numberVariant: `${msg.number || ''}${msg.variant || ''}`
          };
          cellValue = applyTextFormattingSpans(cellValue, textFormatting, msgIdentifiers);
        }

        feedRow[colName] = cellValue;
      });

      return feedRow;
    });
  }, [messages, audiences, topics, feedStructure, feedPatterns, textFormatting]);

  // Generate feedFields structure for saving
  const feedFields = useMemo(() => {
    if (!feedStructure) return [];

    const columns = feedStructure.split(',').map(col => col.trim());
    return columns.map(header => ({ header }));
  }, [feedStructure]);

  // Download feed as CSV
  const downloadFeedCSV = () => {
    if (!feedData || feedData.length === 0) return;

    const columns = feedStructure.split(',').map(col => col.trim());

    // Create CSV header
    const csvHeader = columns.join(',');

    // Create CSV rows
    const csvRows = feedData.map(row => {
      return columns.map(col => {
        const value = row[col] || '';
        // Escape quotes and wrap in quotes if contains comma or quote
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });

    // Combine header and rows
    const csv = [csvHeader, ...csvRows].join('\n');

    // Create download link
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `feed_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle generated content from Claude
  useEffect(() => {
    if (generatedContent && editingMessage) {
      // Apply generated content to editing message
      setEditingMessage({
        ...editingMessage,
        headline: generatedContent.headline || editingMessage.headline,
        copy1: generatedContent.copy1 || editingMessage.copy1,
        copy2: generatedContent.copy2 || editingMessage.copy2,
        flash: generatedContent.flash || editingMessage.flash,
        cta: generatedContent.cta || editingMessage.cta
      });
      // Clear generated content and stop generating state
      setGeneratedContent(null);
      setIsGeneratingContent(false);
    }
  }, [generatedContent]);

  // Format last sync time
  const formatSync = (time) => {
    if (!time) return 'Never';
    const mins = Math.floor((Date.now() - time) / 60000);
    if (mins < 1) return 'Just now';
    if (mins === 1) return '1 min ago';
    if (mins < 60) return `${mins} mins ago`;
    return time.toLocaleTimeString();
  };

  // Filter logic: supports AND/OR keywords
  const matchesFilter = (text, filter) => {
    if (!filter.trim()) return true;

    const lowerText = text.toLowerCase();
    const lowerFilter = filter.toLowerCase();

    // Split by OR first (case insensitive)
    const orParts = lowerFilter.split(/\s+or\s+/i);

    return orParts.some(orPart => {
      // Split by AND (case insensitive)
      const andParts = orPart.split(/\s+and\s+/i);

      // All AND parts must match
      return andParts.every(part => lowerText.includes(part.trim()));
    });
  };

  // Get status-based colors for headers
  const getStatusColors = (status) => {
    if (!status) return { bg: '', text: '', border: '', keyBg: '', keyText: '' };

    const s = status.toUpperCase();
    switch (s) {
      case 'ACTIVE':
        return {
          bg: 'bg-green-50',
          text: 'text-green-700',
          border: 'border-green-300',
          keyBg: 'bg-green-100',
          keyText: 'text-green-600'
        };
      case 'INACTIVE':
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-700',
          border: 'border-gray-400',
          keyBg: 'bg-gray-200',
          keyText: 'text-gray-600'
        };
      case 'INPROGRESS':
        return {
          bg: 'bg-orange-50',
          text: 'text-orange-700',
          border: 'border-orange-300',
          keyBg: 'bg-orange-100',
          keyText: 'text-orange-600'
        };
      case 'PLANNED':
        return {
          bg: 'bg-yellow-50',
          text: 'text-yellow-700',
          border: 'border-yellow-300',
          keyBg: 'bg-yellow-100',
          keyText: 'text-yellow-600'
        };
      default:
        return { bg: '', text: '', border: '', keyBg: '', keyText: '' };
    }
  };

  // Get unique products from audiences and topics
  const availableProducts = useMemo(() => {
    const products = new Set();
    audiences.forEach(aud => {
      if (aud.product) products.add(aud.product);
    });
    topics.forEach(topic => {
      if (topic.product) products.add(topic.product);
    });
    return Array.from(products).sort();
  }, [audiences, topics]);

  // Track deps for filteredAudiences using module-level refs
  if (persistentMatrixRefs.prevAudiences !== audiences) {
    console.log('🟣 audiences dep changed', {
      prev: persistentMatrixRefs.prevAudiences,
      current: audiences,
      same: persistentMatrixRefs.prevAudiences === audiences,
      prevIsArray: Array.isArray(persistentMatrixRefs.prevAudiences),
      currentIsArray: Array.isArray(audiences)
    });
  }
  if (persistentMatrixRefs.prevAudienceFilter !== audienceFilter) console.log('🟣 audienceFilter dep changed');
  if (persistentMatrixRefs.prevProductFilters !== productFilters) console.log('🟣 productFilters dep changed');

  persistentMatrixRefs.prevAudiences = audiences;
  persistentMatrixRefs.prevAudienceFilter = audienceFilter;
  persistentMatrixRefs.prevProductFilters = productFilters;

  // Filter audiences and topics using module-level caching (bypasses React hooks)
  // Check if we need to recompute filteredAudiences
  const deps = persistentMatrixRefs.cachedFilteredAudiencesDeps;
  if (deps.audiences !== audiences || deps.audienceFilter !== audienceFilter || deps.productFilters !== productFilters) {
    console.log('🟣 filteredAudiences RECOMPUTING (module-level cache miss)');
    persistentMatrixRefs.cachedFilteredAudiences = audiences.filter(aud => {
      const matchesText = matchesFilter(aud.name + ' ' + aud.key + ' ' + (aud.strategy || ''), audienceFilter);
      const matchesProduct = productFilters.length === 0 || (aud.product && productFilters.includes(aud.product));
      return matchesText && matchesProduct;
    });
    persistentMatrixRefs.cachedFilteredAudiencesDeps = { audiences, audienceFilter, productFilters };
  }
  const filteredAudiences = persistentMatrixRefs.cachedFilteredAudiences;

  // Check if we need to recompute filteredTopics
  const topicDeps = persistentMatrixRefs.cachedFilteredTopicsDeps;
  if (topicDeps.topics !== topics || topicDeps.topicFilter !== topicFilter || topicDeps.productFilters !== productFilters) {
    console.log('🟣 filteredTopics RECOMPUTING (module-level cache miss)');
    persistentMatrixRefs.cachedFilteredTopics = topics.filter(topic => {
      const matchesText = matchesFilter(topic.name + ' ' + topic.key, topicFilter);
      const matchesProduct = productFilters.length === 0 || (topic.product && productFilters.includes(topic.product));
      return matchesText && matchesProduct;
    });
    persistentMatrixRefs.cachedFilteredTopicsDeps = { topics, topicFilter, productFilters };
  }
  const filteredTopics = persistentMatrixRefs.cachedFilteredTopics;

  // Track filtered array changes using module-level refs
  const filteredAudiencesChanged = persistentMatrixRefs.prevFilteredAudiences !== filteredAudiences;
  const filteredTopicsChanged = persistentMatrixRefs.prevFilteredTopics !== filteredTopics;
  if (filteredAudiencesChanged || filteredTopicsChanged) {
    console.log('🟣 Filtered arrays changed', { filteredAudiencesChanged, filteredTopicsChanged });
  }
  persistentMatrixRefs.prevFilteredAudiences = filteredAudiences;
  persistentMatrixRefs.prevFilteredTopics = filteredTopics;

  // Send state data to App when it changes
  useEffect(() => {
    if (onStateDataReady) {
      onStateDataReady({
        feedData,
        downloadFeedCSV,
        handleSaveWithProgress,
        saveProgress
      });
    }
  }, [feedData, saveProgress]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save with progress tracking
  const handleSaveWithProgress = async () => {
    const steps = [
      'Preparing data for save...',
      'Saving audiences to spreadsheet...',
      'Saving topics to spreadsheet...',
      'Saving messages to spreadsheet...',
      'Saving assets to spreadsheet...',
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
          await save(feedData, feedFields, assets);
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

  // Handle add audience
  const handleAddAudience = () => {
    const maxId = Math.max(0, ...audiences.map(a => parseInt(a.id) || 0));
    const newId = maxId + 1;
    const maxOrder = Math.max(0, ...audiences.map(a => a.order));
    const newOrder = maxOrder + 1;

    setEditingAudience({
      id: newId,
      name: '',
      key: `aud${newOrder}`,
      order: newOrder,
      status: '',
      product: '',
      strategy: '',
      buying_platform: '',
      data_source: '',
      targeting_type: '',
      device: '',
      tag: '',
      comment: '',
      campaign_name: '',
      campaign_id: '',
      lineitem_name: '',
      lineitem_id: ''
    });
  };

  // Handle correcting orphaned message
  const handleCorrectOrphanedMessage = (message, newTopicKey, newAudienceKey) => {
    const updates = {};
    if (newTopicKey && newTopicKey !== message.topic) {
      updates.topic = newTopicKey;
    }
    if (newAudienceKey && newAudienceKey !== message.audience) {
      updates.audience = newAudienceKey;
    }

    if (Object.keys(updates).length > 0) {
      updateMessage(message.id, updates);
      console.log('✅ Corrected orphaned message:', message.id, updates);
    }
  };

  // Handle add topic
  const handleAddTopic = () => {
    const maxId = Math.max(0, ...topics.map(t => parseInt(t.id) || 0));
    const newId = maxId + 1;
    const maxOrder = Math.max(0, ...topics.map(t => t.order));
    const newOrder = maxOrder + 1;

    setEditingTopic({
      id: newId,
      name: '',
      key: `top${newOrder}`,
      order: newOrder,
      status: '',
      product: '',
      tag1: '',
      tag2: '',
      tag3: '',
      tag4: '',
      created: '',
      comment: ''
    });
  };

  // Handle add message with automatic PLANNED filter
  const handleAddMessage = (topicKey, audKey) => {
    // Ensure PLANNED status is in the filter so the new message is visible
    if (!statusFilters.includes('PLANNED')) {
      setStatusFilters([...statusFilters, 'PLANNED']);
    }
    // Add the message
    addMessage(topicKey, audKey);
  };

  // Handle generate content with Claude
  const handleGenerateContent = () => {
    if (!editingMessage || !claudeChatRef.current) return;

    // Find audience and topic data
    const audience = audiences.find(a => a.key === editingMessage.audience);
    const topic = topics.find(t => t.key === editingMessage.topic);

    if (!audience || !topic) {
      alert('Audience or topic data not found');
      return;
    }

    // Set generating state
    setIsGeneratingContent(true);

    // Build context data
    const contextData = {
      audience: {
        name: audience.name,
        comment: audience.comment,
        strategy: audience.strategy,
        buying_platform: audience.buying_platform,
        data_source: audience.data_source,
        targeting_type: audience.targeting_type,
        device: audience.device,
        tag: audience.tag
      },
      topic: {
        name: topic.name,
        comment: topic.comment,
        tag1: topic.tag1,
        tag2: topic.tag2,
        tag3: topic.tag3,
        tag4: topic.tag4
      },
      currentMessage: {
        name: editingMessage.name,
        headline: editingMessage.headline,
        copy1: editingMessage.copy1,
        copy2: editingMessage.copy2,
        flash: editingMessage.flash,
        cta: editingMessage.cta
      }
    };

    // Call Claude chat to generate content
    claudeChatRef.current.generateMessageContent(contextData, (content) => {
      setGeneratedContent(content);
    });
  };

  // Handle zoom with mouse wheel (only with Space)
  const handleMatrixWheel = (e) => {
    if (spacePressed) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(0.1, matrixZoom * delta), 3);
      setMatrixZoom(newZoom);
    }
  };

  // Handle pan start
  const handleMatrixPanStart = (e) => {
    if (spacePressed) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({
        x: e.clientX - matrixPan.x,
        y: e.clientY - matrixPan.y
      });
    }
  };

  // Handle pan move
  const handleMatrixPanMove = (e) => {
    if (isPanning && spacePressed) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      setMatrixPan({
        x: deltaX,
        y: deltaY
      });
    }
  };

  // Handle pan end
  const handleMatrixPanEnd = () => {
    setIsPanning(false);
  };

  // Handle drag
  const onDragStart = (e, msg) => {
    setDraggedMsg(msg);
    e.dataTransfer.effectAllowed = e.ctrlKey ? 'copy' : 'move';
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
  };

  const onDrop = (e, topic, audience) => {
    e.preventDefault();
    if (!draggedMsg) return;

    if (e.ctrlKey) {
      // CTRL+drag = copy
      // Constraint: Can only copy within the same row (same topic)
      if (draggedMsg.topic !== topic) {
        alert('Cannot copy message to a different row (topic). Messages can only be copied across columns within the same topic.');
        setDraggedMsg(null);
        return;
      }

      // Use copyMessage hook function (updates PMMID automatically)
      copyMessage(draggedMsg.id, audience);
    } else {
      // Regular drag = move (updates PMMID automatically)
      moveMessage(draggedMsg.id, audience);
    }

    setDraggedMsg(null);
  };

  // Header edit
  const HeaderEdit = ({ type, item, onSave }) => {
    const [key, setKey] = useState(item.key);
    const [name, setName] = useState(item.name);

    const handleSave = () => {
      if (name.trim()) {
        onSave(item.key, name);
      }
      setEditingHeader(null);
    };

    return (
      <div className="space-y-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setEditingHeader(null);
          }}
          placeholder="Name"
          className="w-full px-2 py-1 text-center border-2 border-blue-500 rounded font-semibold text-lg"
        />
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Key"
          className="w-full px-2 py-1 text-xs text-center border-2 border-blue-500 rounded bg-blue-50"
        />
      </div>
    );
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow p-6 max-w-md">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="text-red-500" size={24} />
            <h2 className="text-xl font-semibold">Error</h2>
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={load}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <PageHeader
        onMenuToggle={onMenuToggle}
        title={currentModuleName || 'Messaging Matrix'}
        lookAndFeel={lookAndFeel}
        titleFilters={
          (
            <div className="flex items-center gap-2">
              {/* Product Filter Dropdown */}
              <div className="relative" ref={productDropdownRef}>
                <button
                  onClick={() => setShowProductDropdown(!showProductDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors text-sm"
                >
                  <span>
                    {productFilters.length === 0
                      ? `Products(${availableProducts.length})`
                      : `Products(${productFilters.length})`}
                  </span>
                  <ChevronDown size={16} />
                </button>
                {showProductDropdown && (
                  <div className="absolute top-full mt-1 left-0 bg-white rounded shadow-lg border border-gray-200 min-w-[150px] z-50">
                    {availableProducts.map((product) => (
                      <button
                        key={product}
                        onClick={() => {
                          if (productFilters.includes(product)) {
                            setProductFilters(productFilters.filter(p => p !== product));
                          } else {
                            setProductFilters([...productFilters, product]);
                          }
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 transition-colors text-left text-sm"
                      >
                        <Check size={16} className={productFilters.includes(product) ? 'text-blue-600' : 'text-transparent'} />
                        <span className="text-gray-900">{product}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Filter Dropdown */}
              <div className="relative" ref={statusDropdownRef}>
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors text-sm"
                >
                  <span>
                    {(() => {
                      const availableStatuses = keywords.messages?.status || ['ACTIVE', 'INACTIVE', 'INPROGRESS', 'PLANNED'];
                      return statusFilters.length === 0
                        ? `Status(${availableStatuses.length})`
                        : `Status(${statusFilters.length})`;
                    })()}
                  </span>
                  <ChevronDown size={16} />
                </button>
                {showStatusDropdown && (() => {
                  const availableStatuses = keywords.messages?.status || ['ACTIVE', 'INACTIVE', 'INPROGRESS', 'PLANNED'];
                  return (
                    <div className="absolute top-full mt-1 left-0 bg-white rounded shadow-lg border border-gray-200 min-w-[150px] z-50">
                      {availableStatuses.map((status) => (
                        <button
                          key={status}
                          onClick={() => {
                            if (statusFilters.includes(status)) {
                              setStatusFilters(statusFilters.filter(s => s !== status));
                            } else {
                              setStatusFilters([...statusFilters, status]);
                            }
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 transition-colors text-left text-sm"
                        >
                          <Check size={16} className={statusFilters.includes(status) ? 'text-blue-600' : 'text-transparent'} />
                          <span className="text-gray-900">{status}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )
        }
      >
        {/* Matrix/Tree/Feed Controls */}
        <MatrixControlPanel
          viewMode={viewMode}
          displayMode={displayMode}
          matrixZoom={matrixZoom}
          treeZoom={treeZoom}
          treeConnectorType={treeConnectorType}
          lookAndFeel={lookAndFeel}
          onViewModeChange={setViewMode}
          onDisplayModeChange={setDisplayMode}
          onMatrixZoomChange={setMatrixZoom}
          onTreeZoomChange={setTreeZoom}
          onTreeConnectorTypeChange={setTreeConnectorType}
        />

        <button
          onClick={() => {
            // Clear localStorage except authentication
            const currentUser = localStorage.getItem('current_user');
            const appUsers = localStorage.getItem('app_users');
            localStorage.clear();
            // Restore authentication data
            if (currentUser) localStorage.setItem('current_user', currentUser);
            if (appUsers) localStorage.setItem('app_users', appUsers);
            // Reload the page to fetch fresh data from spreadsheet
            window.location.reload();
          }}
          className="p-2 text-white rounded hover:opacity-90 transition-opacity"
          style={getButtonStyle(lookAndFeel)}
          title="Clear cache and reload data"
        >
          <RefreshCw size={20} />
        </button>
      </PageHeader>

      {/* Matrix / Feed / Tree View */}
      <div className="p-4">
        {isLoading && audiences.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="animate-spin text-gray-400" size={32} />
          </div>
        ) : viewMode === 'tree' ? (
          <TreeView
            audiences={filteredAudiences}
            topics={filteredTopics}
            messages={messages}
            getMessages={getMessages}
            statusFilters={statusFilters}
            zoom={treeZoom}
            setZoom={setTreeZoom}
            connectorType={treeConnectorType}
            setConnectorType={setTreeConnectorType}
            treeStructure={treeStructure}
            onTreeStructureChange={saveTreeStructure}
            lookAndFeel={lookAndFeel}
          />
        ) : viewMode === 'feed' ? (
          <FeedTableView
            messages={messages}
            audiences={audiences}
            topics={topics}
            feedStructure={feedStructure}
            feedPatterns={feedPatterns}
            statusFilters={statusFilters}
            productFilters={productFilters}
            textFormatting={textFormatting}
            getStatusColors={getStatusColors}
            onMessageClick={(msg) => {
              setEditingMessage(msg);
              setActiveTab('naming');
            }}
          />
        ) : (
          <div
            ref={matrixContainerRef}
            className="bg-white rounded-lg shadow overflow-hidden"
            style={{
              height: 'calc(100vh - 97px - 57px)', // Same as TreeView: viewport - menu - pane header
              position: 'relative',
              cursor: spacePressed ? 'grab' : 'default'
            }}
            onWheel={handleMatrixWheel}
            onMouseDown={handleMatrixPanStart}
            onMouseMove={handleMatrixPanMove}
            onMouseUp={handleMatrixPanEnd}
            onMouseLeave={handleMatrixPanEnd}
          >
            <div style={{
              transform: `translate(${matrixPan.x}px, ${matrixPan.y}px) scale(${matrixZoom})`,
              transformOrigin: 'top left',
              display: 'inline-block',
              minWidth: '100%'
            }}>
              <table className="w-full border-collapse">
                <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 p-2 bg-gray-100 min-w-[200px]">
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={audienceFilter}
                        onChange={(e) => setAudienceFilter(e.target.value)}
                        placeholder="Filter Audiences"
                        className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={topicFilter}
                        onChange={(e) => setTopicFilter(e.target.value)}
                        placeholder="Filter Topics"
                        className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </th>
                  {filteredAudiences.map((aud) => {
                    const colors = getStatusColors(aud.status);
                    const strategyPrefix = aud.strategy ? aud.strategy.substring(0, 3).toUpperCase() : '';
                    return (
                      <th key={aud.key} className={`border p-4 min-w-[250px] ${colors.bg} ${colors.border || 'border-gray-300'}`}>
                        <div className="group relative">
                          <div className={`font-semibold text-lg mb-2 ${colors.text || 'text-blue-700'}`}>{aud.name}</div>
                          {displayMode === 'informative' && (
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {aud.product && (
                                <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${colors.keyBg || 'bg-blue-100'} ${colors.keyText || 'text-blue-600'}`}>
                                  {aud.product}
                                </span>
                              )}
                              {strategyPrefix && (
                                <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${colors.keyBg || 'bg-blue-100'} ${colors.keyText || 'text-blue-600'}`}>
                                  {strategyPrefix}
                                </span>
                              )}
                              <div className={`text-xs px-2 py-1 rounded inline-block ${colors.keyBg || 'bg-blue-100'} ${colors.keyText || 'text-blue-600'}`}>
                                {aud.key}
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() => setEditingAudience(aud)}
                            className={`absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded ${colors.keyBg ? `hover:${colors.keyBg}` : 'hover:bg-blue-100'}`}
                            title="Edit audience"
                          >
                            <Edit2 size={14} className={colors.text || 'text-blue-600'} />
                          </button>
                        </div>
                      </th>
                    );
                  })}
                  <th className="border border-gray-300 p-2">
                    {!spacePressed && (
                      <button
                        onClick={handleAddAudience}
                        className="w-full h-full p-2 text-blue-500 hover:bg-blue-50 rounded"
                        title="Add Audience"
                      >
                        <Plus size={20} />
                      </button>
                    )}
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredTopics.map((topic) => {
                  const colors = getStatusColors(topic.status);
                  return (
                    <tr key={topic.key}>
                      <td className={`border ${displayMode === 'minimal' ? 'p-2' : 'p-4'} ${colors.bg || 'bg-green-50'} ${colors.border || 'border-gray-300'}`}>
                        <div className="group relative">
                          <div className={`font-semibold ${displayMode === 'minimal' ? 'text-base' : 'text-lg'} mb-1 ${colors.text || 'text-green-700'}`}>{topic.name}</div>
                          {displayMode === 'informative' && (
                            <div className="flex items-center gap-1 flex-wrap">
                              {topic.product && (
                                <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${colors.keyBg || 'bg-green-100'} ${colors.keyText || 'text-green-600'}`}>
                                  {topic.product}
                                </span>
                              )}
                              <div className={`text-xs px-2 py-1 rounded inline-block ${colors.keyBg || 'bg-green-100'} ${colors.keyText || 'text-green-600'}`}>
                                {topic.key}
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() => setEditingTopic(topic)}
                            className={`absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded ${colors.keyBg ? `hover:${colors.keyBg}` : 'hover:bg-green-100'}`}
                            title="Edit topic"
                          >
                            <Edit2 size={14} className={colors.text || 'text-green-600'} />
                          </button>
                        </div>
                      </td>

                    {filteredAudiences.map((aud) => {
                      const allCellMsgs = getMessages(topic.key, aud.key);

                      // Filter messages by status if any status filters are selected
                      const cellMsgs = statusFilters.length === 0
                        ? allCellMsgs
                        : allCellMsgs.filter(msg => {
                            const msgStatus = (msg.status || 'PLANNED').toUpperCase();
                            return statusFilters.includes(msgStatus);
                          });

                      const cellKey = `${topic.key}-${aud.key}`;

                      return (
                        <td
                          key={aud.key}
                          className={`border border-gray-300 ${displayMode === 'minimal' ? 'p-1' : 'p-2'} align-top`}
                          onDragOver={onDragOver}
                          onDrop={(e) => onDrop(e, topic.key, aud.key)}
                        >
                          <div className={`${displayMode === 'minimal' ? 'min-h-[40px]' : 'min-h-[100px]'} ${displayMode === 'minimal' ? 'flex flex-wrap gap-1' : 'space-y-2'}`}>
                            {cellMsgs.map((msg) => {
                              // Determine status and color from settings
                              const status = (msg.status || 'PLANNED').toUpperCase();
                              const statusColorHex = lookAndFeel?.statusColors?.[status] || '#ffff00'; // Default to yellow if not found

                              // Convert hex to lighter background color with opacity
                              const bgColor = `${statusColorHex}33`; // Add 33 for ~20% opacity
                              const borderColor = statusColorHex;

                              return (
                                <div
                                  key={msg.id}
                                  draggable
                                  onDragStart={(e) => onDragStart(e, msg)}
                                  onDragEnd={() => setDraggedMsg(null)}
                                  onDoubleClick={() => {
                                    setEditingMessage(msg);
                                    setActiveTab('naming');
                                  }}
                                  className={`border rounded ${displayMode === 'minimal' ? 'p-1' : 'p-2'} cursor-move hover:shadow group`}
                                  style={{
                                    backgroundColor: bgColor,
                                    borderColor: borderColor
                                  }}
                                >
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between gap-1 mb-1">
                                        <div className="flex items-center gap-1">
                                          <span className="font-bold text-blue-600">{msg.number || ''}</span>
                                          <span className="text-xs font-semibold text-gray-500">{msg.variant || ''}</span>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingMessage(msg);
                                              setActiveTab('naming');
                                            }}
                                            className="p-0.5 hover:bg-white/50 rounded transition-colors"
                                            title="Edit naming"
                                          >
                                            <Edit2 size={12} className="text-gray-600" />
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingMessage(msg);
                                              setActiveTab('content');
                                            }}
                                            className="p-0.5 hover:bg-white/50 rounded transition-colors"
                                            title="Preview content"
                                          >
                                            <Eye size={12} className="text-gray-600" />
                                          </button>
                                        </div>
                                      </div>
                                      {displayMode === 'informative' && (
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                                          {msg.name || 'No name'}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {!spacePressed && (
                              <button
                                onClick={() => handleAddMessage(topic.key, aud.key)}
                                className={`${displayMode === 'minimal' ? 'w-auto px-2' : 'w-full'} border-2 border-dashed border-gray-300 rounded p-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50`}
                              >
                                {displayMode === 'minimal' ? '+' : '+ Add Message'}
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}

                      <td className="border border-gray-300"></td>
                    </tr>
                  );
                })}

                <tr>
                  <td className="border border-gray-300 p-2">
                    {!spacePressed && (
                      <button
                        onClick={handleAddTopic}
                        className="w-full h-full p-2 text-green-500 hover:bg-green-50 rounded"
                        title="Add Topic"
                      >
                        <Plus size={20} />
                      </button>
                    )}
                  </td>
                  {filteredAudiences.map((aud) => (
                    <td key={aud.key} className="border border-gray-300"></td>
                  ))}
                  <td className="border border-gray-300"></td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* Message Edit Dialog with Tabs */}
      <MessageEditorDialog
        editingMessage={editingMessage}
        setEditingMessage={setEditingMessage}
        audiences={audiences}
        topics={topics}
        messages={messages}
        updateMessage={updateMessage}
        deleteMessage={deleteMessage}
        keywords={keywords}
        textFormatting={textFormatting}
        previewSize={previewSize}
        setPreviewSize={setPreviewSize}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isGeneratingContent={isGeneratingContent}
        handleGenerateContent={handleGenerateContent}
        selectedProducts={currentProducts}
        selectedStatuses={currentStatuses}
      />

      {/* Audience Edit Dialog */}
      <AudienceEditorDialog
        editingAudience={editingAudience}
        setEditingAudience={setEditingAudience}
        audiences={audiences}
        updateAudience={updateAudience}
        deleteAudience={deleteAudience}
        addAudience={addAudience}
        keywords={keywords}
        messages={messages}
      />

      {/* Topic Edit Dialog */}
      <TopicEditorDialog
        editingTopic={editingTopic}
        setEditingTopic={setEditingTopic}
        topics={topics}
        updateTopic={updateTopic}
        deleteTopic={deleteTopic}
        addTopic={addTopic}
        keywords={keywords}
        messages={messages}
      />


      {/* Save Progress Dialog */}
      {saveProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mb-4">
                {saveProgress.error ? (
                  <AlertCircle size={48} className="mx-auto text-red-500" />
                ) : saveProgress.step === saveProgress.total ? (
                  <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Save size={24} className="text-green-600" />
                  </div>
                ) : (
                  <RefreshCw size={48} className="mx-auto text-blue-500 animate-spin" />
                )}
              </div>

              <h3 className={`text-xl font-semibold mb-2 ${
                saveProgress.error ? 'text-red-700' :
                saveProgress.step === saveProgress.total ? 'text-green-700' :
                'text-gray-800'
              }`}>
                {saveProgress.error ? 'Save Failed' :
                 saveProgress.step === saveProgress.total ? 'Success!' :
                 'Saving to Spreadsheet'}
              </h3>

              <p className="text-gray-600 mb-4">{saveProgress.message}</p>

              {!saveProgress.error && (
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(saveProgress.step / saveProgress.total) * 100}%` }}
                  />
                </div>
              )}

              <p className="text-sm text-gray-500">
                {saveProgress.error ? '' : `Step ${saveProgress.step} of ${saveProgress.total}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Keyword Editor Dialog */}
      {showKeywordEditor && (
        <KeywordEditor
          keywords={keywords}
          onSave={async (updatedKeywords) => {
            try {
              await saveKeywords(updatedKeywords);
              setShowKeywordEditor(false);
              alert('Keywords saved successfully!');
            } catch (error) {
              alert('Failed to save keywords: ' + error.message);
            }
          }}
          onClose={() => setShowKeywordEditor(false)}
        />
      )}

      {/* Orphaned Messages Correction Dialog */}
      <OrphanedMessagesDialog
        show={showOrphanedDialog}
        orphanedMessages={orphanedMessages}
        topics={topics}
        audiences={audiences}
        correctingMessage={correctingMessage}
        setCorrectingMessage={setCorrectingMessage}
        onCorrect={handleCorrectOrphanedMessage}
        onClose={() => setShowOrphanedDialog(false)}
      />

      {/* AI Assistant */}
      <AIAssistant
        ref={claudeChatRef}
        matrixState={matrixData}
        onAddAudience={addAudience}
        onAddTopic={addTopic}
        onAddMessage={addMessage}
        onDeleteAudience={deleteAudience}
        onDeleteTopic={deleteTopic}
      />
    </div>
  );
};

export default Matrix;

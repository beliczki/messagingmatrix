import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Save, RefreshCw, ExternalLink, AlertCircle, Edit2, X, Trash2, Eye, Settings, ChevronLeft, ChevronRight, Sparkles, Loader, Table, GitBranch, List, Users as UsersIcon } from 'lucide-react';
import settings from '../services/settings';
import { generatePMMID, generateTopicKey, generateTraffickingFields, evaluatePattern } from '../utils/patternEvaluator';
import { applyTextFormattingSpans } from '../utils/textFormatter';
import { clearAndReloadApp } from '../utils/clearAndReload';
import AIAssistant from './AIAssistant';
import MatrixStatePanel from './MatrixStatePanel';
import TreeView from './TreeView';
import Tree2View from './Tree2View';
import SankeyView from './SankeyView';
import KeywordEditor from './KeywordEditor';
import MessageEditorDialog from './MessageEditorDialog';
import AudienceEditorDialog from './AudienceEditorDialog';
import TopicEditorDialog from './TopicEditorDialog';
import OrphanedMessagesDialog from './OrphanedMessagesDialog';
import MatrixControlPanel from './MatrixControlPanel';
import FeedTableView from './FeedTableView';
import MatrixGridView from './MatrixGridView';

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
  matrixData
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const claudeChatRef = useRef(null);

  // Check URL for edit mode: /matrix/edit/{number}{variant} e.g., /matrix/edit/1a
  const pathParts = location.pathname.split('/');
  const isEditMode = pathParts[2] === 'edit';
  const urlMessageId = isEditMode ? decodeURIComponent(pathParts[3] || '') : null;

  // Update module-level refs when data changes
  if (matrixData?.audiences && persistentMatrixRefs.audiences !== matrixData.audiences) {
    persistentMatrixRefs.audiences = matrixData.audiences;
  }
  if (matrixData?.topics && persistentMatrixRefs.topics !== matrixData.topics) {
    persistentMatrixRefs.topics = matrixData.topics;
  }
  if (matrixData?.messages && persistentMatrixRefs.messages !== matrixData.messages) {
    persistentMatrixRefs.messages = matrixData.messages;
  }

  // Use module-level refs (these are ALWAYS the same reference)
  const audiences = persistentMatrixRefs.audiences;
  const topics = persistentMatrixRefs.topics;
  const messages = persistentMatrixRefs.messages;

  // Destructure other values
  const {
    keywords = {},
    assets = [],
    textFormatting = [],
    setTextFormatting,
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
    regenerateTopicKeys = () => {},
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
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('messageEditor_activeTab');
    return saved || 'naming';
  });
  const [previewSize, setPreviewSize] = useState(() => {
    const saved = localStorage.getItem('messageEditor_previewSize');
    return saved || '300x250';
  });
  const [saveProgress, setSaveProgress] = useState(null); // { step: number, message: string }
  const [generatedContent, setGeneratedContent] = useState(null);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [orphanedMessages, setOrphanedMessages] = useState([]);
  const [showOrphanedDialog, setShowOrphanedDialog] = useState(false);
  const [correctingMessage, setCorrectingMessage] = useState(null);

  // Multi-select mode state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [selectModeCell, setSelectModeCell] = useState(null); // { topic, audience } - cell where selection started
  const [shakingMessageId, setShakingMessageId] = useState(null); // Message currently showing shake animation
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [dragHoverCell, setDragHoverCell] = useState(null); // { topic, audience }
  const [isDraggingSelected, setIsDraggingSelected] = useState(false); // Track if we're dragging selected messages (for UI updates)
  const [isCopyModeUI, setIsCopyModeUI] = useState(false); // For UI feedback only (updated in onDragOver)
  const [dragOriginCellUI, setDragOriginCellUI] = useState(null); // For UI feedback only (updated after drag starts)

  // Action history for undo (Ctrl+Z) - infinite history
  // Using ref to avoid stale closure issues in event handlers
  const actionHistoryRef = useRef([]);

  // Log an action for undo
  const logAction = (action) => {
    const newAction = { ...action, timestamp: Date.now() };
    actionHistoryRef.current = [...actionHistoryRef.current, newAction];
    console.log(`📝 Action logged: ${action.type}`, action);
  };

  // Undo the last action
  const undoLastAction = () => {
    if (actionHistoryRef.current.length === 0) {
      console.log('⚠️ Nothing to undo');
      return;
    }

    const lastAction = actionHistoryRef.current[actionHistoryRef.current.length - 1];
    console.log(`↩️ Undoing: ${lastAction.type}`, lastAction);

    switch (lastAction.type) {
      case 'add':
        // Undo add: delete the message
        if (lastAction.messageId) {
          deleteMessage(lastAction.messageId);
          console.log(`🗑️ Undo add: deleted message ${lastAction.messageId}`);
        }
        break;

      case 'copy':
        // Undo copy: delete the copied messages
        if (lastAction.newMessageIds && lastAction.newMessageIds.length > 0) {
          lastAction.newMessageIds.forEach(id => deleteMessage(id));
          console.log(`🗑️ Undo copy: deleted ${lastAction.newMessageIds.length} copied messages`);
        }
        break;

      case 'move':
        // Undo move: move messages back to original audience
        if (lastAction.movedMessages && lastAction.movedMessages.length > 0) {
          lastAction.movedMessages.forEach(({ id, originalAudience }) => {
            moveMessage(id, originalAudience);
          });
          console.log(`↩️ Undo move: moved ${lastAction.movedMessages.length} messages back`);
        }
        break;

      default:
        console.log(`⚠️ Unknown action type: ${lastAction.type}`);
        return;
    }

    // Remove the action from history
    actionHistoryRef.current = actionHistoryRef.current.slice(0, -1);
  };
  const justEnteredSelectMode = useRef(false); // Track if we just entered select mode
  const isDraggingSelectedRef = useRef(false); // Track if we're dragging selected messages (needs to be ref for immediate access in onDrop)
  const dragPreviewRef = useRef(null); // Store drag preview element for cleanup
  const dragOriginCellRef = useRef(null); // Use ref to avoid re-render during drag start
  const isCopyModeRef = useRef(false); // Use ref to avoid re-render during drag start
  const draggedMsgRef = useRef(null); // Use ref to avoid re-render during drag start

  // Persist activeTab to localStorage
  useEffect(() => {
    localStorage.setItem('messageEditor_activeTab', activeTab);
  }, [activeTab]);

  // Persist previewSize to localStorage
  useEffect(() => {
    localStorage.setItem('messageEditor_previewSize', previewSize);
  }, [previewSize]);

  // Track if editor was ever opened (to distinguish initial mount from intentional close)
  const editorWasOpenedRef = useRef(false);

  // Auto-open message editor when URL contains message ID (e.g., /matrix/edit/1a)
  // Use matrixData?.messages in dependency since 'messages' is from module-level ref
  useEffect(() => {
    if (urlMessageId && matrixData?.messages?.length > 0 && !editingMessage) {
      // Parse the message ID: e.g., "1a" -> number=1, variant="a"
      const match = urlMessageId.match(/^(\d+)([a-z]?)$/i);
      if (match) {
        const number = parseInt(match[1], 10);
        const variant = match[2]?.toLowerCase() || 'a';
        const message = matrixData.messages.find(m =>
          m.number === number &&
          (m.variant || 'a').toLowerCase() === variant &&
          m.status !== 'deleted'
        );
        if (message) {
          editorWasOpenedRef.current = true;
          setEditingMessage(message);
        }
      }
    }
  }, [urlMessageId, matrixData?.messages]);

  // Sync URL when editingMessage changes (for closing)
  // Only navigate away if editor was previously open (not on initial mount)
  useEffect(() => {
    if (!editingMessage && isEditMode && editorWasOpenedRef.current) {
      navigate('/matrix', { replace: true });
    }
  }, [editingMessage]);

  // Handle action=add_message URL parameter (from Tasks Create MC button)
  const addMessageActionProcessedRef = useRef(false);
  const pendingOpenMessageIdRef = useRef(null);
  const pendingLinkTaskIdRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');

    if (action === 'add_message' && !addMessageActionProcessedRef.current && matrixData?.messages) {
      const audienceKey = params.get('audience');
      const topicKey = params.get('topic');
      const product = params.get('product');
      const linkTaskId = params.get('linkTask');

      if (audienceKey && topicKey) {
        addMessageActionProcessedRef.current = true;

        // Set product filter if provided
        if (product) {
          setProductFilters([product]);
        }

        // Ensure INCOMING status is in the filter so new message is visible
        if (!statusFilters.includes('INCOMING')) {
          setStatusFilters([...statusFilters, 'INCOMING']);
        }

        // Calculate expected new message ID before adding
        const maxId = Math.max(0, ...messages.map(m => parseInt(m.id) || 0));
        pendingOpenMessageIdRef.current = maxId + 1;

        // Store task ID to link after message is created
        if (linkTaskId) {
          pendingLinkTaskIdRef.current = linkTaskId;
        }

        // Add the message
        addMessage(topicKey, audienceKey);

        // Navigate to clean URL, removing action params
        navigate('/matrix', { replace: true });
      }
    }
  }, [location.search, matrixData?.messages, addMessage, navigate]);

  // Open editor when pending message is detected in updated messages array
  useEffect(() => {
    if (pendingOpenMessageIdRef.current && matrixData?.messages) {
      const newMessage = matrixData.messages.find(m => parseInt(m.id) === pendingOpenMessageIdRef.current);
      if (newMessage) {
        const messageIdToOpen = pendingOpenMessageIdRef.current;
        const taskIdToLink = pendingLinkTaskIdRef.current;
        pendingOpenMessageIdRef.current = null;
        pendingLinkTaskIdRef.current = null;

        // Auto-link task to this MC if we have a task ID
        if (taskIdToLink) {
          (async () => {
            try {
              const response = await fetch('/api/tasks');
              if (response.ok) {
                const data = await response.json();
                const tasks = data.tasks || [];
                const taskToLink = tasks.find(t => String(t.id) === String(taskIdToLink));

                if (taskToLink) {
                  const mcLabel = `MC${newMessage.number || newMessage.id}${newMessage.variant || ''}`;
                  const newOutputItem = {
                    id: Date.now(),
                    reference: mcLabel,
                    type: 'message',
                    messageId: newMessage.id
                  };

                  const updatedTask = {
                    ...taskToLink,
                    outputContent: [...(taskToLink.outputContent || []), newOutputItem]
                  };

                  const updatedTasks = tasks.map(t => t.id === taskToLink.id ? updatedTask : t);

                  await fetch('/api/tasks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tasks: updatedTasks })
                  });

                  console.log(`✅ Auto-linked task ${taskIdToLink} to MC${newMessage.number}${newMessage.variant || ''}`);
                }
              }
            } catch (error) {
              console.error('Error auto-linking task:', error);
            }
          })();
        }

        const messageId = `${newMessage.number}${newMessage.variant || 'a'}`;
        navigate(`/matrix/edit/${messageId}`);
        editorWasOpenedRef.current = true;
        setEditingMessage(newMessage);
      }
    }
  }, [matrixData?.messages]);

  // Helper to open message editor with URL update
  const openMessageEditor = (msg) => {
    const messageId = `${msg.number}${msg.variant || 'a'}`;
    navigate(`/matrix/edit/${messageId}`);
    editorWasOpenedRef.current = true;
    setEditingMessage(msg);
  };

  // Wrapper for setEditingMessage that handles URL updates
  // - null: close editor and navigate to /matrix
  // - same message with updates: just update (no URL change)
  // - different message (prev/next): update URL and set message
  const handleSetEditingMessage = (msgOrNull) => {
    if (msgOrNull === null) {
      // Closing the editor
      setEditingMessage(null);
      // URL update handled by effect
    } else if (editingMessage && msgOrNull.id === editingMessage.id) {
      // Same message, just updating fields - no URL change
      setEditingMessage(msgOrNull);
    } else {
      // Different message (e.g., prev/next navigation)
      const messageId = `${msgOrNull.number}${msgOrNull.variant || 'a'}`;
      navigate(`/matrix/edit/${messageId}`, { replace: true });
      setEditingMessage(msgOrNull);
    }
  };

  // Use matrixViewState for persisted values - memoize arrays with stable references
  const viewMode = matrixViewState?.viewMode || 'matrix';
  const displayMode = matrixViewState?.displayMode || 'informative';
  const treeOrientation = matrixViewState?.treeOrientation || 'vertical';
  const sankeyVariant = matrixViewState?.sankeyVariant || 'sankey';
  const topicFilter = matrixViewState?.topicFilter || '';
  const audienceFilter = matrixViewState?.audienceFilter || '';
  const mcFilter = matrixViewState?.mcFilter || '';

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

  // Refs for tree views to access zoom controls
  const tree2Ref = useRef(null);
  const sankeyRef = useRef(null);

  // State to track zoom from tree views (for header display)
  const [tree2Zoom, setTree2Zoom] = useState(0.5);
  const [sankeyZoom, setSankeyZoom] = useState(0.5);

  // Setter functions that update matrixViewState
  const setViewMode = (value) => setMatrixViewState({ ...matrixViewState, viewMode: value });
  const setDisplayMode = (value) => setMatrixViewState({ ...matrixViewState, displayMode: value });
  const setTreeOrientation = (value) => setMatrixViewState({ ...matrixViewState, treeOrientation: value });
  const setSankeyVariant = (value) => setMatrixViewState({ ...matrixViewState, sankeyVariant: value });
  const setTopicFilter = (value) => setMatrixViewState({ ...matrixViewState, topicFilter: value });
  const setAudienceFilter = (value) => setMatrixViewState({ ...matrixViewState, audienceFilter: value });
  const setMcFilter = (value) => setMatrixViewState({ ...matrixViewState, mcFilter: value });
  const setStatusFilters = (value) => setMatrixViewState({ ...matrixViewState, selectedStatuses: value });
  const setProductFilters = (value) => {
    // Reset pan to top-left when product filter changes
    setMatrixViewState({
      ...matrixViewState,
      selectedProducts: value,
      matrixPan: { x: 0, y: 0 }
    });
  };
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
  const [treeFlattenMode, setTreeFlattenMode] = useState(false);
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

  const [sankeyStructure, setSankeyStructure] = useState(() => {
    try {
      const config = settings.getAll();
      return config.sankeyStructure || 'Audiences.Product → Audiences.Strategy → Audiences.Name → Topics.Name → Messages.Number';
    } catch (e) {
      console.warn('Could not load sankey structure from settings on init:', e);
      return 'Audiences.Product → Audiences.Strategy → Audiences.Name → Topics.Name → Messages.Number';
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

  // Handle keyboard events for spacebar, ESC, and CTRL
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

      // ESC to exit select mode
      if (e.code === 'Escape' && isSelectMode) {
        e.preventDefault();
        setIsSelectMode(false);
        setSelectedMessages(new Set());
        setSelectModeCell(null);
        console.log('🚪 Exited select mode (ESC key)');
      }

      // Track CTRL key for copy mode in selection mode
      if ((e.key === 'Control' || e.key === 'Meta') && isSelectMode) {
        setIsCopyModeUI(true);
      }

      // Ctrl+Z or Cmd+Z to undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !isInputField) {
        e.preventDefault();
        undoLastAction();
      }

      // Ctrl+A or Cmd+A to select all in cell (when in selection mode)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && isSelectMode && selectModeCell && !isInputField) {
        e.preventDefault();
        handleSelectAllInCell(selectModeCell.topic, selectModeCell.audience);
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

      // Track CTRL key release for copy mode
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsCopyModeUI(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [spacePressed, viewMode, isSelectMode]);

  // Exit selection mode when no messages are selected
  useEffect(() => {
    if (isSelectMode && selectedMessages.size === 0) {
      setIsSelectMode(false);
      setSelectModeCell(null);
      console.log('🚪 Exited select mode (no messages selected)');
    }
  }, [isSelectMode, selectedMessages]);


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
        if (config.sankeyStructure) {
          setSankeyStructure(config.sankeyStructure);
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
    const allStatuses = keywords.messages?.status || ['INCOMING', 'NAMING', 'CONTENT', 'PREVIEW', 'APPROVED', 'ACTIVE', 'INACTIVE', 'ERROR'];

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

  // Clean up stale product filters (products that no longer exist in data)
  useEffect(() => {
    if (audiences.length === 0 && topics.length === 0) return;
    if (productFilters.length === 0) return;

    // Get all available products from current data
    const allProducts = new Set();
    audiences.forEach(aud => {
      if (aud.product) allProducts.add(aud.product);
    });
    topics.forEach(topic => {
      if (topic.product) allProducts.add(topic.product);
    });

    // Filter out any selected products that no longer exist
    const validFilters = productFilters.filter(p => allProducts.has(p));
    if (validFilters.length !== productFilters.length) {
      console.log('🧹 Cleaning up stale product filters:', productFilters.filter(p => !allProducts.has(p)));
      setProductFilters(validFilters);
    }
  }, [audiences, topics]);

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
  // Only include messages with HTML templates (exclude Adobe PSD, Adobe AEP, and messages without templates)
  const feedData = useMemo(() => {
    if (!feedStructure) {
      return [];
    }

    // Get non-HTML template names from keywords (e.g., Adobe PSD, Adobe AEP)
    const nonHtmlTemplates = matrixData?.keywords?.messages?.template || [];

    // Filter messages to only include those with HTML templates
    const htmlTemplateMessages = messages.filter(msg => {
      // Exclude messages without a template
      if (!msg.template || !msg.template.trim()) {
        return false;
      }
      // Exclude messages with non-HTML templates (Adobe PSD, Adobe AEP, etc.)
      if (nonHtmlTemplates.includes(msg.template)) {
        return false;
      }
      // Include all other messages (they have HTML templates)
      return true;
    });

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

    return htmlTemplateMessages.map((msg) => {
      const status = (msg.status || 'INCOMING').toUpperCase();
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
  }, [messages, audiences, topics, feedStructure, feedPatterns, textFormatting, matrixData?.keywords]);

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
      // New workflow statuses
      case 'INCOMING':
        return {
          bg: 'bg-purple-50',
          text: 'text-purple-700',
          border: 'border-purple-300',
          keyBg: 'bg-purple-100',
          keyText: 'text-purple-600'
        };
      case 'NAMING':
      case 'PLANNED': // Legacy mapping
        return {
          bg: 'bg-yellow-50',
          text: 'text-yellow-700',
          border: 'border-yellow-300',
          keyBg: 'bg-yellow-100',
          keyText: 'text-yellow-600'
        };
      case 'CONTENT':
      case 'INPROGRESS': // Legacy mapping
        return {
          bg: 'bg-orange-50',
          text: 'text-orange-700',
          border: 'border-orange-300',
          keyBg: 'bg-orange-100',
          keyText: 'text-orange-600'
        };
      case 'PREVIEW':
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          border: 'border-blue-300',
          keyBg: 'bg-blue-100',
          keyText: 'text-blue-600'
        };
      case 'APPROVED':
        return {
          bg: 'bg-green-50',
          text: 'text-green-700',
          border: 'border-green-300',
          keyBg: 'bg-green-100',
          keyText: 'text-green-600'
        };
      case 'ACTIVE':
        return {
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-300',
          keyBg: 'bg-emerald-100',
          keyText: 'text-emerald-600'
        };
      case 'INACTIVE':
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-700',
          border: 'border-gray-400',
          keyBg: 'bg-gray-200',
          keyText: 'text-gray-600'
        };
      case 'ERROR':
        return {
          bg: 'bg-red-50',
          text: 'text-red-700',
          border: 'border-red-300',
          keyBg: 'bg-red-100',
          keyText: 'text-red-600'
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
      const matchesText = matchesFilter(aud.name + ' ' + aud.key + ' ' + (aud.strategy || '') + ' ' + (aud.lineitem_id || ''), audienceFilter);
      const matchesProduct = productFilters.length === 0 || !aud.product || productFilters.includes(aud.product);
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
      const matchesProduct = productFilters.length === 0 || !topic.product || productFilters.includes(topic.product);
      return matchesText && matchesProduct;
    });
    persistentMatrixRefs.cachedFilteredTopicsDeps = { topics, topicFilter, productFilters };
  }
  const filteredTopics = persistentMatrixRefs.cachedFilteredTopics;

  // Filter messages based on mcFilter AND product filter (cascading filters)
  // Messages are filtered by checking if their audience/topic is in the filtered lists
  const filteredMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    // Create sets for fast lookup of filtered audience/topic keys
    const filteredAudienceKeys = new Set(filteredAudiences.map(a => a.key));
    const filteredTopicKeys = new Set(filteredTopics.map(t => t.key));

    return messages.filter(m => {
      if (m.status === 'deleted') return false;

      // Check if message's audience and topic are in the filtered lists (product filter)
      const audienceInFilter = !m.audience || filteredAudienceKeys.has(m.audience);
      const topicInFilter = !m.topic || filteredTopicKeys.has(m.topic);
      if (!audienceInFilter || !topicInFilter) return false;

      // Check status filter
      if (statusFilters.length > 0) {
        const msgStatus = (m.status || 'INCOMING').toUpperCase();
        if (!statusFilters.includes(msgStatus)) return false;
      }

      // Check MC text filter
      if (mcFilter.trim()) {
        const lowerFilter = mcFilter.toLowerCase();
        const searchableFields = [
          String(m.number || ''),
          m.variant || '',
          m.name || '',
          m.headline || '',
          m.copy1 || '',
          m.copy2 || '',
          m.image1 || '',
          m.image2 || '',
          m.image3 || ''
        ].join(' ').toLowerCase();
        if (!searchableFields.includes(lowerFilter)) return false;
      }

      return true;
    });
  }, [messages, mcFilter, filteredAudiences, filteredTopics, statusFilters]);

  // Track filtered array changes using module-level refs
  const filteredAudiencesChanged = persistentMatrixRefs.prevFilteredAudiences !== filteredAudiences;
  const filteredTopicsChanged = persistentMatrixRefs.prevFilteredTopics !== filteredTopics;
  if (filteredAudiencesChanged || filteredTopicsChanged) {
    console.log('🟣 Filtered arrays changed', { filteredAudiencesChanged, filteredTopicsChanged });
  }
  persistentMatrixRefs.prevFilteredAudiences = filteredAudiences;
  persistentMatrixRefs.prevFilteredTopics = filteredTopics;

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
      key: '',  // Will be auto-generated from pattern when tags are set
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

  // Handle add message with automatic INCOMING filter
  const handleAddMessage = (topicKey, audKey) => {
    // Ensure INCOMING status is in the filter so the new message is visible
    if (!statusFilters.includes('INCOMING')) {
      setStatusFilters([...statusFilters, 'INCOMING']);
    }

    // Calculate the expected new ID (same logic as useMatrix)
    const maxId = Math.max(0, ...messages.map(m => parseInt(m.id) || 0));
    const newId = maxId + 1;

    // Add the message
    addMessage(topicKey, audKey);

    // Log for undo
    logAction({
      type: 'add',
      messageId: newId,
      topic: topicKey,
      audience: audKey
    });
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

  // Handle fit to view - calculate optimal zoom to fit content in viewport
  const handleMatrixFit = () => {
    const container = matrixContainerRef.current;
    if (!container) return;

    // Get the table element inside the zoomed div
    const table = container.querySelector('table');
    if (!table) return;

    // Get viewport dimensions (container size)
    const viewportWidth = container.clientWidth;
    const viewportHeight = container.clientHeight;

    // Get content dimensions at 100% zoom
    // We need to temporarily reset zoom to measure actual content size
    const zoomedDiv = container.querySelector('div[style*="zoom"]');
    if (!zoomedDiv) return;

    const currentZoom = matrixZoom;
    zoomedDiv.style.zoom = '1';

    const contentWidth = table.offsetWidth;
    const contentHeight = table.offsetHeight;

    // Restore zoom
    zoomedDiv.style.zoom = currentZoom;

    // Calculate zoom to fit (with some padding)
    const padding = 20;
    const zoomX = (viewportWidth - padding) / contentWidth;
    const zoomY = (viewportHeight - padding) / contentHeight;

    // Use the smaller zoom to ensure both dimensions fit
    const newZoom = Math.min(zoomX, zoomY, 1); // Cap at 100%
    const clampedZoom = Math.max(0.1, Math.min(newZoom, 3)); // Clamp between 10% and 300%

    setMatrixZoom(clampedZoom);
  };

  // Handle long press for select mode
  const handleMessageMouseDown = (e, msg) => {
    // Don't start long press if:
    // 1. Already in select mode (just handle selection toggle instead)
    // 2. Clicking on action buttons
    if (isSelectMode || e.target.closest('button')) return;

    const timer = setTimeout(() => {
      // Enter select mode and select this message
      setIsSelectMode(true);
      setSelectedMessages(new Set([msg.id]));
      setSelectModeCell({ topic: msg.topic, audience: msg.audience }); // Track which cell selection started
      justEnteredSelectMode.current = true; // Mark that we just entered select mode
      console.log('📌 Entered select mode with message:', msg.id, 'in cell:', msg.topic, msg.audience);
      setLongPressTimer(null);
    }, 500); // 500ms long press

    setLongPressTimer(timer);
  };

  const handleMessageMouseUp = (e, msg) => {
    // Clear long press timer if it's still pending (means it was a short click)
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
      // If NOT in select mode and we're clearing a timer, it was just a short click
      if (!isSelectMode) {
        return;
      }
    }

    // If we just entered select mode via long press, skip this mouseUp event
    if (justEnteredSelectMode.current) {
      justEnteredSelectMode.current = false;
      console.log('⏭️ Skipping mouseUp after entering select mode');
      return;
    }

    // If in select mode, handle selection
    if (isSelectMode && !e.target.closest('button')) {
      e.preventDefault();
      e.stopPropagation();

      // Check if clicked message is in the same cell as selection started
      const isSameCell = selectModeCell &&
        msg.topic === selectModeCell.topic &&
        msg.audience === selectModeCell.audience;

      if (!isSameCell) {
        // Different cell - show shake animation (invalid selection)
        console.log('🔴 Invalid selection - different cell, triggering shake');
        setShakingMessageId(msg.id);
        // Remove shake after animation completes (400ms matches CSS)
        setTimeout(() => setShakingMessageId(null), 400);
        return;
      }

      // Same cell - toggle selection
      const newSelected = new Set(selectedMessages);
      if (newSelected.has(msg.id)) {
        newSelected.delete(msg.id);
        console.log('❌ Deselected message:', msg.id);
      } else {
        newSelected.add(msg.id);
        console.log('✅ Selected message:', msg.id);
      }
      setSelectedMessages(newSelected);

      // Exit select mode if no messages selected
      if (newSelected.size === 0) {
        setIsSelectMode(false);
        setSelectModeCell(null);
        console.log('🚪 Exited select mode (no messages selected)');
      }
    }
  };

  // Move or copy selected messages to a cell (click action)
  const handleMoveOrCopyToCell = (topicKey, audienceKey, isCopy) => {
    if (!isSelectMode || selectedMessages.size === 0) return;

    const msgsToMove = messages.filter(m => selectedMessages.has(m.id));
    if (msgsToMove.length === 0) return;

    // Check if all messages have the same topic (row constraint)
    const topics = new Set(msgsToMove.map(m => m.topic));
    if (topics.size > 1) {
      alert('Cannot move messages from different rows. All selected messages must be in the same row (topic).');
      return;
    }

    const sourceTopic = msgsToMove[0].topic;

    // Check if moving to different topic
    if (sourceTopic !== topicKey) {
      alert('Cannot move messages to a different row (topic). Messages can only be moved across columns within the same topic.');
      return;
    }

    if (isCopy) {
      // Track max ID before copying to identify new messages later
      const maxIdBefore = Math.max(0, ...messages.map(m => parseInt(m.id) || 0));
      const copyCount = msgsToMove.length;

      // Batch copy
      msgsToMove.forEach(msg => {
        copyMessage(msg.id, audienceKey);
      });

      // Calculate new IDs for logging
      const newMessageIds = [];
      for (let i = 1; i <= copyCount; i++) {
        newMessageIds.push(maxIdBefore + i);
      }

      // Log for undo
      logAction({
        type: 'copy',
        newMessageIds,
        sourceMessages: msgsToMove.map(m => m.id),
        targetAudience: audienceKey
      });

      // After copy, select the new copies so user can continue copying forward
      setTimeout(() => {
        setSelectedMessages(new Set(newMessageIds));
        setSelectModeCell({ topic: topicKey, audience: audienceKey });
      }, 50);
    } else {
      // Log for undo before moving (need original audiences)
      logAction({
        type: 'move',
        movedMessages: msgsToMove.map(m => ({
          id: m.id,
          originalAudience: m.audience
        })),
        targetAudience: audienceKey
      });

      // Batch move
      msgsToMove.forEach(msg => {
        moveMessage(msg.id, audienceKey);
      });

      // Clear selection and exit select mode after move
      setSelectedMessages(new Set());
      setIsSelectMode(false);
      setSelectModeCell(null);
    }
  };

  // Select all messages in a cell
  const handleSelectAllInCell = (topicKey, audienceKey) => {
    const cellMessages = messages.filter(m =>
      m.topic === topicKey &&
      m.audience === audienceKey &&
      m.status !== 'deleted'
    );

    if (cellMessages.length === 0) return;

    // Check if all are already selected
    const allSelected = cellMessages.every(m => selectedMessages.has(m.id));

    const newSelected = new Set(selectedMessages);
    if (allSelected) {
      // Deselect all in cell
      cellMessages.forEach(m => newSelected.delete(m.id));
    } else {
      // Select all in cell
      cellMessages.forEach(m => newSelected.add(m.id));
    }

    setSelectedMessages(newSelected);

    // Exit select mode if no messages selected
    if (newSelected.size === 0) {
      setIsSelectMode(false);
      setSelectModeCell(null);
    }
  };

  // Handle drag
  const onDragStart = (e, msg) => {
    // Cancel long press timer when drag starts to prevent entering select mode
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    console.log('🔍 onDragStart called:', {
      isSelectMode,
      selectedMessagesSize: selectedMessages.size,
      msgId: msg.id,
      hasMsg: selectedMessages.has(msg.id),
      ctrlPressed: e.ctrlKey
    });

    // Use REFS instead of setState to avoid re-renders that cancel the drag
    isCopyModeRef.current = e.ctrlKey;
    dragOriginCellRef.current = { topic: msg.topic, audience: msg.audience };
    draggedMsgRef.current = msg;

    console.log(`📍 Origin cell: ${msg.topic} x ${msg.audience}`);

    // Check if dragging a selected message
    const isBatchDrag = isSelectMode && selectedMessages.has(msg.id) && selectedMessages.size > 0;

    if (isBatchDrag) {
      // Batch drag mode - use ref for immediate access
      isDraggingSelectedRef.current = true;

      // Required: Set drag data for browser to recognize the drag
      e.dataTransfer.setData('text/plain', `batch:${Array.from(selectedMessages).join(',')}`);
      e.dataTransfer.effectAllowed = 'copyMove';

      // Set custom drag image showing only count
      const dragPreview = document.createElement('div');
      dragPreview.style.cssText = 'position: fixed; top: -1000px; left: -1000px; padding: 8px 12px; background: rgba(59, 130, 246, 0.9); color: white; border-radius: 6px; font-weight: bold; font-size: 14px; pointer-events: none; z-index: 99999;';
      dragPreview.textContent = `${selectedMessages.size} message${selectedMessages.size > 1 ? 's' : ''}`;
      document.body.appendChild(dragPreview);
      dragPreviewRef.current = dragPreview;
      e.dataTransfer.setDragImage(dragPreview, 0, 0);

      console.log(`🎯 BATCH DRAG: ${selectedMessages.size} selected messages`);
    } else {
      // Single message drag - use default browser drag image
      isDraggingSelectedRef.current = false;

      // Required: Set drag data for browser to recognize the drag
      e.dataTransfer.setData('text/plain', `single:${msg.id}`);
      e.dataTransfer.effectAllowed = 'copyMove';

      console.log(`📍 Single message drag: ${msg.id}`);
    }

    // Defer state updates to after drag has started (for UI updates only)
    requestAnimationFrame(() => {
      setIsDraggingSelected(isBatchDrag);
      setDragOriginCellUI({ topic: msg.topic, audience: msg.audience });
      setIsCopyModeUI(e.ctrlKey);
      setDraggedMsg(msg); // For UI feedback (isValidDropZone check)
    });
  };

  const onDragOver = (e, topic, audience) => {
    e.preventDefault();

    // Check if hovering over origin cell (use ref)
    const originCell = dragOriginCellRef.current;
    const isOriginCell = originCell && originCell.topic === topic && originCell.audience === audience;

    if (isOriginCell) {
      // Disallow dropping on origin cell
      e.dataTransfer.dropEffect = 'none';
    } else {
      // Update copy mode ref and UI state based on current CTRL key state during drag
      if (e.ctrlKey !== isCopyModeRef.current) {
        isCopyModeRef.current = e.ctrlKey;
        setIsCopyModeUI(e.ctrlKey); // Update UI state for visual feedback
        console.log(`🔄 Mode changed during drag: ${e.ctrlKey ? 'COPY' : 'MOVE'}`);
      }

      e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
    }

    // Update hover cell for visual feedback (this state update is ok, happens during drag)
    if (!dragHoverCell || dragHoverCell.topic !== topic || dragHoverCell.audience !== audience) {
      setDragHoverCell({ topic, audience });
    }
  };

  // Handle drag end (for cleanup if drag is cancelled)
  const onDragEnd = () => {
    console.log('🔚 Drag ended');
    setDragHoverCell(null);
    setDragOriginCellUI(null);
    setIsCopyModeUI(false);
    setDraggedMsg(null);
    dragOriginCellRef.current = null;
    draggedMsgRef.current = null;
    isCopyModeRef.current = false;
    isDraggingSelectedRef.current = false;
    setIsDraggingSelected(false);

    // Clean up drag preview element
    if (dragPreviewRef.current && dragPreviewRef.current.parentNode) {
      dragPreviewRef.current.parentNode.removeChild(dragPreviewRef.current);
      dragPreviewRef.current = null;
    }
  };

  const onDrop = (e, topic, audience) => {
    e.preventDefault();

    const currentDraggedMsg = draggedMsgRef.current;
    const currentIsCopyMode = isCopyModeRef.current;
    const originCell = dragOriginCellRef.current;

    console.log('🔍 onDrop called:', {
      isDraggingSelectedRef: isDraggingSelectedRef.current,
      selectedMessagesSize: selectedMessages.size,
      draggedMsgId: currentDraggedMsg?.id,
      hasDraggedMsg: currentDraggedMsg ? selectedMessages.has(currentDraggedMsg.id) : false,
      isCopyMode: currentIsCopyMode
    });

    if (!currentDraggedMsg) return;

    // Prevent dropping on origin cell
    const isOriginCell = originCell && originCell.topic === topic && originCell.audience === audience;
    if (isOriginCell) {
      console.log('❌ Cannot drop on origin cell');
      draggedMsgRef.current = null;
      dragOriginCellRef.current = null;
      return;
    }

    // Handle batch drag if multiple messages selected
    // Check isDraggingSelectedRef flag that we set in onDragStart
    if (isDraggingSelectedRef.current && selectedMessages.size > 0 && selectedMessages.has(currentDraggedMsg.id)) {
      console.log(`🎯 Dropping batch: ${selectedMessages.size} messages`);
      // Get all selected messages
      const msgsToMove = messages.filter(m => selectedMessages.has(m.id));
      console.log(`📦 Messages to move:`, msgsToMove.map(m => m.id));

      // Check if all messages have the same topic (row constraint)
      const topics = new Set(msgsToMove.map(m => m.topic));
      if (topics.size > 1) {
        alert('Cannot move messages from different rows. All selected messages must be in the same row (topic).');
        draggedMsgRef.current = null;
        return;
      }

      const sourceTopic = msgsToMove[0].topic;

      // Check if moving to different topic
      if (sourceTopic !== topic) {
        alert('Cannot move messages to a different row (topic). Messages can only be moved across columns within the same topic.');
        draggedMsgRef.current = null;
        return;
      }

      // Perform batch operation using isCopyMode ref
      if (currentIsCopyMode) {
        // Track max ID before copying to identify new messages later
        const maxIdBefore = Math.max(0, ...messages.map(m => parseInt(m.id) || 0));
        const copyCount = msgsToMove.length;

        // Batch copy
        msgsToMove.forEach(msg => {
          copyMessage(msg.id, audience);
        });
        console.log(`📋 Copied ${copyCount} messages to ${audience}`);

        // Calculate new IDs for logging
        const newMessageIds = [];
        for (let i = 1; i <= copyCount; i++) {
          newMessageIds.push(maxIdBefore + i);
        }

        // Log for undo
        logAction({
          type: 'copy',
          newMessageIds,
          sourceMessages: msgsToMove.map(m => m.id),
          targetAudience: audience
        });

        // After copy, select the new copies so user can continue copying forward
        setTimeout(() => {
          setSelectedMessages(new Set(newMessageIds));
          // Update origin cell to the new location
          dragOriginCellRef.current = { topic, audience };
          setDragOriginCellUI({ topic, audience });
          console.log(`✅ Auto-selected ${copyCount} copied messages with IDs:`, newMessageIds);
        }, 50);

        // Keep select mode active, just clear drag state
        setDragHoverCell(null);
        isDraggingSelectedRef.current = false;
        setIsDraggingSelected(false);
        isCopyModeRef.current = false;
      } else {
        // Log for undo before moving (need original audiences)
        logAction({
          type: 'move',
          movedMessages: msgsToMove.map(m => ({
            id: m.id,
            originalAudience: m.audience
          })),
          targetAudience: audience
        });

        // Batch move
        msgsToMove.forEach(msg => {
          moveMessage(msg.id, audience);
        });
        console.log(`📦 Moved ${msgsToMove.length} messages to ${audience}`);

        // Clear selection and exit select mode after move
        setSelectedMessages(new Set());
        setIsSelectMode(false);
        setDragHoverCell(null);
        dragOriginCellRef.current = null;
        isDraggingSelectedRef.current = false;
        setIsDraggingSelected(false);
        isCopyModeRef.current = false;
        console.log('🚪 Exited select mode after batch move');
      }
    } else {
      // Clear hover state for single drag
      setDragHoverCell(null);
      dragOriginCellRef.current = null;
      isDraggingSelectedRef.current = false;
      setIsDraggingSelected(false);

      // Single message drag using isCopyMode ref
      if (currentIsCopyMode) {
        // CTRL+drag = copy
        // Constraint: Can only copy within the same row (same topic)
        if (currentDraggedMsg.topic !== topic) {
          alert('Cannot copy message to a different row (topic). Messages can only be copied across columns within the same topic.');
          draggedMsgRef.current = null;
          isCopyModeRef.current = false;
          return;
        }

        // Calculate new ID for logging
        const maxIdBefore = Math.max(0, ...messages.map(m => parseInt(m.id) || 0));
        const newMessageId = maxIdBefore + 1;

        // Use copyMessage hook function (updates PMMID automatically)
        copyMessage(currentDraggedMsg.id, audience);
        console.log(`📋 Copied message ${currentDraggedMsg.id} to ${audience}`);

        // Log for undo
        logAction({
          type: 'copy',
          newMessageIds: [newMessageId],
          sourceMessages: [currentDraggedMsg.id],
          targetAudience: audience
        });
      } else {
        // Log for undo before moving
        logAction({
          type: 'move',
          movedMessages: [{
            id: currentDraggedMsg.id,
            originalAudience: currentDraggedMsg.audience
          }],
          targetAudience: audience
        });

        // Regular drag = move (updates PMMID automatically)
        moveMessage(currentDraggedMsg.id, audience);
        console.log(`📦 Moved message ${currentDraggedMsg.id} to ${audience}`);
      }

      isCopyModeRef.current = false;
    }

    draggedMsgRef.current = null;
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
    <div className="matrix-fullscreen" style={{ backgroundColor: 'var(--color-primary)' }}>
      {/* Floating Toolbar - Fixed position, right side */}
      <MatrixControlPanel
        viewMode={viewMode}
        displayMode={displayMode}
        matrixZoom={matrixZoom}
        treeZoom={treeZoom}
        treeConnectorType={treeConnectorType}
        treeFlattenMode={treeFlattenMode}
        lookAndFeel={lookAndFeel}
        onViewModeChange={setViewMode}
        onDisplayModeChange={setDisplayMode}
        onMatrixZoomChange={setMatrixZoom}
        onMatrixFit={handleMatrixFit}
        onTreeZoomChange={setTreeZoom}
        onTreeConnectorTypeChange={setTreeConnectorType}
        onTreeFlattenModeChange={setTreeFlattenMode}
        tree2Ref={tree2Ref}
        sankeyRef={sankeyRef}
        tree2Zoom={tree2Zoom}
        sankeyZoom={sankeyZoom}
        // Text filter props
        audienceFilter={audienceFilter}
        topicFilter={topicFilter}
        mcFilter={mcFilter}
        onAudienceFilterChange={setAudienceFilter}
        onTopicFilterChange={setTopicFilter}
        onMcFilterChange={setMcFilter}
        // Product & Status filter props
        productFilters={productFilters}
        statusFilters={statusFilters}
        allProducts={availableProducts}
        allStatuses={keywords.messages?.status || ['INCOMING', 'NAMING', 'CONTENT', 'PREVIEW', 'APPROVED', 'ACTIVE', 'INACTIVE', 'ERROR']}
        onProductFiltersChange={setProductFilters}
        onStatusFiltersChange={setStatusFilters}
        statusColors={settings.getStatusColors?.() || {}}
        filteredCounts={{
          products: productFilters.length,
          audiences: filteredAudiences.length,
          topics: filteredTopics.length,
          messages: filteredMessages.length
        }}
        // View variant props
        treeOrientation={treeOrientation}
        onTreeOrientationChange={setTreeOrientation}
        sankeyVariant={sankeyVariant}
        onSankeyVariantChange={setSankeyVariant}
      />

      {/* Matrix / Feed / Tree View - Fullscreen */}
      <div className="matrix-view-container">
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
            flattenMode={treeFlattenMode}
            onFlattenModeChange={setTreeFlattenMode}
            treeStructure={treeStructure}
            onTreeStructureChange={saveTreeStructure}
            lookAndFeel={lookAndFeel}
            onEditAudience={setEditingAudience}
            onEditTopic={setEditingTopic}
            onEditMessage={openMessageEditor}
          />
        ) : viewMode === 'tree2' ? (
          <Tree2View
            ref={tree2Ref}
            audiences={filteredAudiences}
            topics={filteredTopics}
            getMessages={getMessages}
            statusFilters={statusFilters}
            treeStructure={treeStructure}
            lookAndFeel={lookAndFeel}
            orientation={treeOrientation}
            onEditAudience={setEditingAudience}
            onEditTopic={setEditingTopic}
            onEditMessage={openMessageEditor}
            onZoomChange={setTree2Zoom}
          />
        ) : viewMode === 'tree3' ? (
          <SankeyView
            ref={sankeyRef}
            audiences={filteredAudiences}
            topics={filteredTopics}
            getMessages={getMessages}
            statusFilters={statusFilters}
            sankeyStructure={sankeyStructure}
            lookAndFeel={lookAndFeel}
            variant={sankeyVariant}
            onEditAudience={setEditingAudience}
            onEditTopic={setEditingTopic}
            onEditMessage={openMessageEditor}
            onZoomChange={setSankeyZoom}
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
            onMessageClick={(msg) => openMessageEditor(msg)}
          />
        ) : (
          <MatrixGridView
            matrixContainerRef={matrixContainerRef}
            matrixZoom={matrixZoom}
            matrixPan={matrixPan}
            spacePressed={spacePressed}
            displayMode={displayMode}
            onDisplayModeChange={setDisplayMode}
            mcFilter={mcFilter}
            filteredAudiences={filteredAudiences}
            filteredTopics={filteredTopics}
            lookAndFeel={lookAndFeel}
            getStatusColors={getStatusColors}
            getMessages={getMessages}
            statusFilters={statusFilters}
            draggedMsg={draggedMsg}
            onWheel={handleMatrixWheel}
            onPanStart={handleMatrixPanStart}
            onPanMove={handleMatrixPanMove}
            onPanEnd={handleMatrixPanEnd}
            onEditAudience={setEditingAudience}
            onAddAudience={handleAddAudience}
            onEditTopic={setEditingTopic}
            onAddTopic={handleAddTopic}
            onAddMessage={handleAddMessage}
            onEditMessage={openMessageEditor}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            setDraggedMsg={setDraggedMsg}
            setActiveTab={setActiveTab}
            isSelectMode={isSelectMode}
            selectedMessages={selectedMessages}
            selectModeCell={selectModeCell}
            onSelectAllInCell={handleSelectAllInCell}
            onMoveOrCopyToCell={handleMoveOrCopyToCell}
            shakingMessageId={shakingMessageId}
            isDraggingSelected={isDraggingSelected}
            isCopyMode={isCopyModeUI}
            dragHoverCell={dragHoverCell}
            dragOriginCell={dragOriginCellUI}
            onMessageMouseDown={handleMessageMouseDown}
            onMessageMouseUp={handleMessageMouseUp}
          />
        )}
      </div>

      {/* Message Edit Dialog with Tabs */}
      <MessageEditorDialog
        editingMessage={editingMessage}
        setEditingMessage={handleSetEditingMessage}
        audiences={audiences}
        topics={topics}
        messages={messages}
        updateMessage={updateMessage}
        deleteMessage={deleteMessage}
        keywords={keywords}
        textFormatting={textFormatting}
        updateTextFormatting={setTextFormatting}
        previewSize={previewSize}
        setPreviewSize={setPreviewSize}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isGeneratingContent={isGeneratingContent}
        handleGenerateContent={handleGenerateContent}
        selectedProducts={currentProducts}
        selectedStatuses={currentStatuses}
        creatives={matrixData?.creatives || []}
        lookAndFeel={lookAndFeel}
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

      {/* Bottom Bar - Rendered via portal to ensure it's above dialogs */}
      {createPortal(
        <div className="bottom-bar">
          <MatrixStatePanel
            audiences={audiences || []}
            topics={topics || []}
            messages={messages || []}
            keywords={keywords || {}}
            assets={assets || []}
            creatives={matrixData?.creatives || []}
            textFormatting={textFormatting || []}
            feedData={feedData || []}
            lastSync={lastSync}
            isSaving={isSaving}
            saveProgress={saveProgress}
            onSave={handleSaveWithProgress}
            onClearReload={clearAndReloadApp}
            onRegenerateTopicKeys={regenerateTopicKeys}
            downloadFeedCSV={downloadFeedCSV}
            changeTracking={matrixData?.changeTracking}
            originalState={matrixData?.originalState}
          />
          <AIAssistant
            ref={claudeChatRef}
            matrixState={matrixData}
            onAddAudience={addAudience}
            onAddTopic={addTopic}
            onAddMessage={addMessage}
            onDeleteAudience={deleteAudience}
            onDeleteTopic={deleteTopic}
          />
        </div>,
        document.body
      )}
    </div>
  );
};

export default Matrix;

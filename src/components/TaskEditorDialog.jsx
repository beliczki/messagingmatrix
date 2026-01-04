import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Trash2, Mail, Clock, Plus, Search, Tag, ArrowRight, Check, Link2, Unlink, FileText, FileText as SummaryIcon, MessageSquare, Paperclip, ChevronDown, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { apiGet } from '../utils/api';

const TaskEditorDialog = ({
  editingTask,
  setEditingTask,
  onSave,
  onDelete,
  buckets,
  matrixData,
  lookAndFeel,
  tasks = []
}) => {
  const [activeTab, setActiveTab] = useState('summary');

  // Keyboard shortcuts: ESC to close, Ctrl/Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && editingTask) {
        setEditingTask(null);
      }
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && editingTask) {
        e.preventDefault();
        onSave(editingTask);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingTask, setEditingTask, onSave]);
  // Source section state
  const [creativeSearch, setCreativeSearch] = useState('');
  const [mcDropdownOpen, setMcDropdownOpen] = useState(false);
  const [selectedMcIds, setSelectedMcIds] = useState(new Set());
  const mcDropdownRef = useRef(null);

  // Output section state
  const [outputSearch, setOutputSearch] = useState('');
  const [outputDropdownOpen, setOutputDropdownOpen] = useState(false);
  const [selectedOutputMcIds, setSelectedOutputMcIds] = useState(new Set());
  const outputDropdownRef = useRef(null);

  const [availableLabels, setAvailableLabels] = useState({ products: [], topics: [], all: [] });
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);

  // Custom dropdown states
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [audienceDropdownOpen, setAudienceDropdownOpen] = useState(false);
  const [topicDropdownOpen, setTopicDropdownOpen] = useState(false);

  // Refs for custom dropdowns
  const priorityDropdownRef = useRef(null);
  const productDropdownRef = useRef(null);
  const taskTypeDropdownRef = useRef(null);
  const audienceDropdownRef = useRef(null);
  const topicDropdownRef = useRef(null);

  // Task type dropdown state
  const [taskTypeDropdownOpen, setTaskTypeDropdownOpen] = useState(false);

  // Close MC dropdown on click outside (Source)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (mcDropdownRef.current && !mcDropdownRef.current.contains(e.target)) {
        setMcDropdownOpen(false);
      }
    };
    if (mcDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mcDropdownOpen]);

  // Close MC dropdown on click outside (Output)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (outputDropdownRef.current && !outputDropdownRef.current.contains(e.target)) {
        setOutputDropdownOpen(false);
      }
    };
    if (outputDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [outputDropdownOpen]);

  // Close custom dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(e.target)) {
        setPriorityDropdownOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) {
        setProductDropdownOpen(false);
      }
      if (taskTypeDropdownRef.current && !taskTypeDropdownRef.current.contains(e.target)) {
        setTaskTypeDropdownOpen(false);
      }
      if (audienceDropdownRef.current && !audienceDropdownRef.current.contains(e.target)) {
        setAudienceDropdownOpen(false);
      }
      if (topicDropdownRef.current && !topicDropdownRef.current.contains(e.target)) {
        setTopicDropdownOpen(false);
      }
    };
    if (priorityDropdownOpen || productDropdownOpen || taskTypeDropdownOpen || audienceDropdownOpen || topicDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [priorityDropdownOpen, productDropdownOpen, taskTypeDropdownOpen, audienceDropdownOpen, topicDropdownOpen]);

  // Create MC modal state
  const [showCreateMcModal, setShowCreateMcModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedAudience, setSelectedAudience] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [createMcStatus, setCreateMcStatus] = useState(null); // null | 'creating' | 'success' | 'error'
  const [createdMcInfo, setCreatedMcInfo] = useState(null);

  // Extract matrix data
  const audiences = matrixData?.audiences || [];
  const topics = matrixData?.topics || [];
  const messages = matrixData?.messages || [];
  const keywords = matrixData?.keywords || {};
  const addMessage = matrixData?.addMessage;

  // Task types from keywords spreadsheet, fallback to defaults
  const taskTypes = keywords.tasks?.type || ['Update', 'Create'];

  // Helper to resolve MC label (e.g., "MC282a") to message data
  // v2 schema: relatedContent/outputContent are arrays of MC labels like ["MC282a", "MC283b"]
  const resolveMcLabel = (mcLabel) => {
    if (!mcLabel || typeof mcLabel !== 'string') return null;

    // Parse MC label: "MC282a" -> number=282, variant="a"
    const match = mcLabel.match(/^MC(\d+)([a-z]?)$/i);
    if (!match) return null;

    const number = parseInt(match[1], 10);
    const variant = match[2] || '';

    // Find matching message
    const msg = messages.find(m =>
      String(m.number) === String(number) && (m.variant || '') === variant
    );

    if (!msg) {
      // Return placeholder if message not found
      return {
        mcLabel,
        number: String(number),
        variant,
        name: null,
        topic: null,
        topicName: null,
        audience: null,
        audienceName: null,
        status: null,
        found: false
      };
    }

    const topic = topics.find(t => t.key === msg.topic);
    const audience = audiences.find(a => a.key === msg.audience);

    return {
      mcLabel,
      id: msg.id,
      number: String(msg.number),
      variant: msg.variant || '',
      name: msg.name || msg.Name || '',
      topic: msg.topic,
      topicName: topic?.name || msg.topic,
      audience: msg.audience,
      audienceName: audience?.name || msg.audience,
      status: msg.status,
      found: true
    };
  };

  // Resolve all MC labels in an array to message data
  const resolvedRelatedContent = useMemo(() => {
    return (editingTask?.relatedContent || []).map(mcLabel => resolveMcLabel(mcLabel)).filter(Boolean);
  }, [editingTask?.relatedContent, messages, topics, audiences]);

  const resolvedOutputContent = useMemo(() => {
    return (editingTask?.outputContent || []).map(mcLabel => resolveMcLabel(mcLabel)).filter(Boolean);
  }, [editingTask?.outputContent, messages, topics, audiences]);

  // Get unique products from audiences and topics
  const availableProducts = useMemo(() => {
    const products = new Set();
    audiences.forEach(a => { if (a.product) products.add(a.product); });
    topics.forEach(t => { if (t.product) products.add(t.product); });
    return Array.from(products).sort();
  }, [audiences, topics]);

  // Pre-select default Audience (INCOMING) and Topic (WIP) for creation tasks
  useEffect(() => {
    if (editingTask?.taskType === 'Create' && editingTask.product) {
      const productAudiences = audiences.filter(a => a.product === editingTask.product);
      const productTopics = topics.filter(t => t.product === editingTask.product);

      // Find audience containing "INCOMING" (case-insensitive)
      const incomingAudience = productAudiences.find(a =>
        a.name?.toUpperCase().includes('INCOMING') || a.key?.toUpperCase().includes('INCOMING')
      );

      // Find topic containing "WIP" (case-insensitive)
      const wipTopic = productTopics.find(t =>
        t.name?.toUpperCase().includes('WIP') || t.key?.toUpperCase().includes('WIP')
      );

      // Only update if we found defaults and current values are empty
      if ((incomingAudience && !editingTask.audience) || (wipTopic && !editingTask.topic)) {
        setEditingTask(prev => ({
          ...prev,
          audience: prev.audience || (incomingAudience?.key || ''),
          topic: prev.topic || (wipTopic?.key || '')
        }));
      }
    }
  }, [editingTask?.taskType, editingTask?.product, audiences, topics]);

  // Filter audiences by selected product
  const filteredAudiences = useMemo(() => {
    if (!selectedProduct) return audiences;
    return audiences.filter(a => a.product === selectedProduct);
  }, [audiences, selectedProduct]);

  // Filter topics by selected product
  const filteredTopics = useMemo(() => {
    if (!selectedProduct) return topics;
    return topics.filter(t => t.product === selectedProduct);
  }, [topics, selectedProduct]);

  // Search messages for Related Content panel
  // v2 schema: relatedContent is array of MC labels like ["MC282a", "MC283b"]
  const searchResults = useMemo(() => {
    if (!creativeSearch.trim() || creativeSearch.length < 2) return [];

    const searchLower = creativeSearch.toLowerCase();
    // Already linked MC labels (strings)
    const alreadyLinked = new Set(editingTask?.relatedContent || []);
    const justNumber = searchLower.replace(/^mc/i, '');

    // Filter out deleted messages and search
    return messages
      .filter(msg => {
        // Skip deleted messages
        if (msg.status === 'deleted') return false;

        // Build MC label for this message
        const msgNumber = msg.number !== undefined && msg.number !== null ? String(msg.number) : '';
        const mcLabel = `MC${msgNumber}${msg.variant || ''}`;

        // Don't show already linked messages
        if (alreadyLinked.has(mcLabel)) return false;

        // Build searchable pmmid
        const pmmid = (msg.pmmid || mcLabel).toLowerCase();
        const name = (msg.name || msg.Name || '').toLowerCase();
        const copy1 = (msg.copy1 || msg.Copy1 || '').toLowerCase();

        return pmmid.includes(searchLower) ||
               msgNumber.includes(justNumber) ||
               name.includes(searchLower) ||
               copy1.includes(searchLower);
      })
      .slice(0, 12) // Increased limit
      .map(msg => {
        const audience = audiences.find(a => a.key === msg.audience);
        const topic = topics.find(t => t.key === msg.topic);
        const msgNumber = msg.number !== undefined && msg.number !== null ? String(msg.number) : '';
        return {
          id: msg.id,
          number: msgNumber,
          variant: msg.variant || '',
          mcLabel: `MC${msgNumber}${msg.variant || ''}`,
          pmmid: msg.pmmid || `MC${msgNumber}${msg.variant || ''}`,
          name: msg.name || msg.Name || 'Untitled',
          audience: audience?.name || msg.audience,
          topic: topic?.name || msg.topic,
          status: msg.status
        };
      });
  }, [creativeSearch, messages, audiences, topics, editingTask?.relatedContent]);

  // Search messages for Output panel
  // v2 schema: outputContent is array of MC labels like ["MC282a", "MC283b"]
  const outputSearchResults = useMemo(() => {
    if (!outputSearch.trim() || outputSearch.length < 2) return [];

    const searchLower = outputSearch.toLowerCase();
    // Already linked MC labels (strings)
    const alreadyLinked = new Set(editingTask?.outputContent || []);
    const justNumber = searchLower.replace(/^mc/i, '');

    return messages
      .filter(msg => {
        if (msg.status === 'deleted') return false;

        const msgNumber = msg.number !== undefined && msg.number !== null ? String(msg.number) : '';
        const mcLabel = `MC${msgNumber}${msg.variant || ''}`;

        if (alreadyLinked.has(mcLabel)) return false;

        const pmmid = (msg.pmmid || mcLabel).toLowerCase();
        const name = (msg.name || msg.Name || '').toLowerCase();
        const copy1 = (msg.copy1 || msg.Copy1 || '').toLowerCase();

        return pmmid.includes(searchLower) ||
               msgNumber.includes(justNumber) ||
               name.includes(searchLower) ||
               copy1.includes(searchLower);
      })
      .slice(0, 12)
      .map(msg => {
        const audience = audiences.find(a => a.key === msg.audience);
        const topic = topics.find(t => t.key === msg.topic);
        const msgNumber = msg.number !== undefined && msg.number !== null ? String(msg.number) : '';
        return {
          id: msg.id,
          number: msgNumber,
          variant: msg.variant || '',
          mcLabel: `MC${msgNumber}${msg.variant || ''}`,
          pmmid: msg.pmmid || `MC${msgNumber}${msg.variant || ''}`,
          name: msg.name || msg.Name || 'Untitled',
          audience: audience?.name || msg.audience,
          topic: topic?.name || msg.topic,
          status: msg.status
        };
      });
  }, [outputSearch, messages, audiences, topics, editingTask?.outputContent]);

  // Reset selections when modal opens
  useEffect(() => {
    if (showCreateMcModal) {
      setSelectedProduct(availableProducts[0] || '');
      setSelectedAudience('');
      setSelectedTopic('');
      setCreateMcStatus(null);
      setCreatedMcInfo(null);
    }
  }, [showCreateMcModal, availableProducts]);

  // Auto-select first audience/topic when product changes
  useEffect(() => {
    if (filteredAudiences.length > 0 && !selectedAudience) {
      setSelectedAudience(filteredAudiences[0].key);
    }
  }, [filteredAudiences, selectedAudience]);

  useEffect(() => {
    if (filteredTopics.length > 0 && !selectedTopic) {
      setSelectedTopic(filteredTopics[0].key);
    }
  }, [filteredTopics, selectedTopic]);

  // Fetch available labels on mount
  useEffect(() => {
    apiGet('/api/task-labels')
      .then(res => res.json())
      .then(data => setAvailableLabels(data))
      .catch(err => console.error('Error fetching labels:', err));
  }, []);

  // Navigation: undone tasks only
  const undoneTasks = useMemo(() => {
    return tasks.filter(t => t.status !== 'completed');
  }, [tasks]);

  const currentTaskIndex = useMemo(() => {
    if (!editingTask) return -1;
    return undoneTasks.findIndex(t => t.id === editingTask.id);
  }, [undoneTasks, editingTask]);

  const hasPreviousTask = currentTaskIndex > 0;
  const hasNextTask = currentTaskIndex < undoneTasks.length - 1 && currentTaskIndex >= 0;

  const goToPreviousTask = () => {
    if (hasPreviousTask) {
      setEditingTask(undoneTasks[currentTaskIndex - 1]);
    } else if (undoneTasks.length > 0) {
      setEditingTask(undoneTasks[undoneTasks.length - 1]); // Loop to end
    }
  };

  const goToNextTask = () => {
    if (hasNextTask) {
      setEditingTask(undoneTasks[currentTaskIndex + 1]);
    } else if (undoneTasks.length > 0) {
      setEditingTask(undoneTasks[0]); // Loop to start
    }
  };

  if (!editingTask) return null;

  // Helper: Get text color based on background luminance
  const getTextColor = (hexColor) => {
    if (!hexColor) return '#ffffff';
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  // Helper: Get bucket color from lookAndFeel statusColors
  const getBucketColor = (bucketId) => {
    const statusColors = lookAndFeel?.statusColors || {};
    const colorMap = {
      incoming: statusColors.INCOMING || '#8B5CF6',    // Purple
      naming: statusColors.NAMING || '#EAB308',        // Yellow
      content: statusColors.CONTENT || '#F97316',      // Orange
      preview: statusColors.PREVIEW || '#3B82F6',      // Blue
      approved: statusColors.APPROVED || '#22C55E',    // Green
      delivered: statusColors.ACTIVE || '#15803D',     // Dark Green
      dead: statusColors.INACTIVE || '#9CA3AF'         // Gray
    };
    return colorMap[bucketId] || '#8B5CF6';
  };

  // Current bucket color
  const currentBucketColor = getBucketColor(editingTask.bucket || 'incoming');

  // Helper: Get MC status color from lookAndFeel statusColors
  const getMcStatusColor = (status) => {
    const statusColors = lookAndFeel?.statusColors || {};
    const statusUpper = (status || '').toUpperCase();
    return statusColors[statusUpper] || statusColors.INACTIVE || '#9CA3AF';
  };

  const handleSave = () => {
    onSave(editingTask);
    setEditingTask(null);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      onDelete(editingTask.id);
      setEditingTask(null);
    }
  };

  // Handle Create MC from Task
  const handleCreateMc = () => {
    if (!addMessage || !selectedAudience || !selectedTopic) {
      setCreateMcStatus('error');
      return;
    }

    setCreateMcStatus('creating');

    try {
      // Calculate next MC number (same logic as useMatrix.js addMessage)
      // Check if cell already has messages
      const cellMessages = messages.filter(m =>
        m.topic === selectedTopic &&
        m.audience === selectedAudience &&
        m.status !== 'deleted'
      );

      let mcNumber;
      let variant;

      if (cellMessages.length > 0) {
        // Cell has messages - use same number, calculate next variant
        mcNumber = cellMessages[0].number;
        const variants = cellMessages.map(m => m.variant || 'a');
        const maxVariant = variants.sort().pop();
        variant = String.fromCharCode(maxVariant.charCodeAt(0) + 1);
      } else {
        // Cell is empty - use global next highest number
        const allActiveMessages = messages.filter(m => m.status !== 'deleted');
        const maxNumber = allActiveMessages.length > 0
          ? Math.max(...allActiveMessages.map(m => m.number || 0))
          : 0;
        mcNumber = maxNumber + 1;
        variant = 'a';
      }

      // Calculate next message ID for linking
      const maxId = Math.max(0, ...messages.map(m => parseInt(m.id) || 0));
      const newId = maxId + 1;

      // Create message with task data
      addMessage(selectedTopic, selectedAudience);

      // Format MC reference (e.g., MC15a, MC16a)
      const mcReference = `MC${mcNumber}${variant}`;

      // Update relatedContent to link to this new message
      const newRelatedContent = [
        ...(editingTask.relatedContent || []),
        {
          id: Date.now(),
          reference: mcReference,
          type: 'message',
          messageId: String(newId)
        }
      ];

      // Update the task with the link
      const updatedTask = {
        ...editingTask,
        relatedContent: newRelatedContent
      };
      setEditingTask(updatedTask);

      // Set success state
      setCreatedMcInfo({ id: newId, pmmid: mcReference, number: mcNumber, variant });
      setCreateMcStatus('success');

      // Auto-close modal after 2 seconds
      setTimeout(() => {
        setShowCreateMcModal(false);
      }, 2000);

    } catch (err) {
      console.error('Error creating MC:', err);
      setCreateMcStatus('error');
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-50 border-red-200';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200';
      case 'low':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  // Clean email body - remove footers, legal text, etc.
  const cleanEmailBody = (body) => {
    if (!body) return '';

    let cleaned = body;

    // Remove email thread/reply markers and everything after them
    cleaned = cleaned.replace(/On.*?wrote:[\s\S]*$/gim, '');
    cleaned = cleaned.replace(/From:.*?Sent:.*?To:.*?Subject:.*?$/gims, '');
    cleaned = cleaned.replace(/_{5,}.*$/gms, ''); // Long underscores often mark replies
    cleaned = cleaned.replace(/[-]{3,}.*Original.*Message.*[-]{3,}[\s\S]*$/gims, '');

    // Remove quoted reply blocks (lines starting with > or |)
    cleaned = cleaned.split('\n').filter(line => !line.trim().match(/^[>|]/)).join('\n');

    // Remove "Sent from my..." footers
    cleaned = cleaned.replace(/Sent from my.*$/gim, '');
    cleaned = cleaned.replace(/Get Outlook for.*$/gim, '');

    // Remove signature blocks (multiple dashes or underscores)
    cleaned = cleaned.replace(/\n[-_]{3,}\n[\s\S]*$/gm, '');

    // Remove legal disclaimers
    cleaned = cleaned.replace(/This email.*?$/gims, '');
    cleaned = cleaned.replace(/Confidential.*?$/gims, '');
    cleaned = cleaned.replace(/DISCLAIMER.*?$/gims, '');
    cleaned = cleaned.replace(/NOTICE:.*?$/gims, '');

    // Remove common forwarding markers
    cleaned = cleaned.replace(/Begin forwarded message:[\s\S]*$/gim, '');
    cleaned = cleaned.replace(/---------- Forwarded message ---------[\s\S]*$/gim, '');

    // Remove excessive blank lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned.trim();
  };

  // Add related content (creative)
  // v2 schema: relatedContent is array of MC labels like ["MC282a", "MC283b"]
  const handleAddRelatedContent = (creative) => {
    const relatedContent = editingTask.relatedContent || [];
    const mcLabel = creative.mcLabel || `MC${creative.number}${creative.variant || ''}`;

    if (!relatedContent.includes(mcLabel)) {
      setEditingTask({
        ...editingTask,
        relatedContent: [...relatedContent, mcLabel]
      });
    }
    setCreativeSearch('');
  };

  // Remove related content
  // v2 schema: remove MC label string from array
  const handleRemoveRelatedContent = (mcLabel) => {
    setEditingTask({
      ...editingTask,
      relatedContent: (editingTask.relatedContent || []).filter(label => label !== mcLabel)
    });
  };

  // Add output content (creative)
  // v2 schema: outputContent is array of MC labels like ["MC282a", "MC283b"]
  const handleAddOutputContent = (creative) => {
    const outputContent = editingTask.outputContent || [];
    const mcLabel = creative.mcLabel || `MC${creative.number}${creative.variant || ''}`;

    if (!outputContent.includes(mcLabel)) {
      setEditingTask({
        ...editingTask,
        outputContent: [...outputContent, mcLabel]
      });
    }
    setOutputSearch('');
  };

  // Remove output content
  // v2 schema: remove MC label string from array
  const handleRemoveOutputContent = (mcLabel) => {
    setEditingTask({
      ...editingTask,
      outputContent: (editingTask.outputContent || []).filter(label => label !== mcLabel)
    });
  };

  // Generate Gmail search URL from email subject
  const getGmailSearchUrl = (subject) => {
    if (!subject) return null;
    const encodedSubject = encodeURIComponent(subject).replace(/%20/g, '+');
    return `https://mail.google.com/mail/u/0/#search/${encodedSubject}`;
  };

  // Add label to task
  const handleAddLabel = (label) => {
    const currentLabels = editingTask.labels || [];
    if (!currentLabels.includes(label)) {
      setEditingTask({
        ...editingTask,
        labels: [...currentLabels, label]
      });
    }
    setShowLabelDropdown(false);
  };

  // Remove label from task
  const handleRemoveLabel = (label) => {
    setEditingTask({
      ...editingTask,
      labels: (editingTask.labels || []).filter(l => l !== label)
    });
  };

  // Get color for label badge
  const getLabelColor = (label) => {
    // Product labels get blue
    if (availableLabels.products && availableLabels.products.includes(label)) {
      return 'bg-blue-100 text-blue-700 border-blue-300';
    }
    // Topic labels get different colors
    const topicColors = {
      'Creative': 'bg-purple-100 text-purple-700 border-purple-300',
      'Strategy': 'bg-green-100 text-green-700 border-green-300',
      'Technical': 'bg-orange-100 text-orange-700 border-orange-300',
      'Reporting': 'bg-cyan-100 text-cyan-700 border-cyan-300',
      'Client Communication': 'bg-pink-100 text-pink-700 border-pink-300',
      'Campaign Setup': 'bg-indigo-100 text-indigo-700 border-indigo-300',
      'Optimization': 'bg-teal-100 text-teal-700 border-teal-300',
      'QA': 'bg-yellow-100 text-yellow-700 border-yellow-300',
      'Urgent': 'bg-red-100 text-red-700 border-red-300',
      'Research': 'bg-gray-100 text-gray-700 border-gray-300'
    };
    return topicColors[label] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  // Tab definitions (only 2 tabs now - Related Content moved to right panel)
  const tabs = [
    { id: 'summary', label: 'Summary', icon: SummaryIcon },
    { id: 'history', label: 'History', icon: MessageSquare }
  ];

  // Get bucket name for display
  const currentBucket = buckets?.find(b => b.id === editingTask.bucket);

  return (
    <div className="dialog-overlay" onClick={() => setEditingTask(null)}>
      <div className="dialog-panel" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-layout">
          {/* LEFT SIDEBAR */}
          <div className="dialog-sidebar">
            <h2 className="dialog-title">Edit Task</h2>

            {/* Task Navigation Stepper */}
            <div className="dialog-nav">
              <button
                onClick={goToPreviousTask}
                className="dialog-nav-btn"
                title="Previous undone task"
                disabled={undoneTasks.length <= 1}
              >
                <ChevronLeft size={16} />
              </button>
              <div
                className="dialog-nav-indicator"
                style={{
                  backgroundColor: currentBucketColor,
                  color: getTextColor(currentBucketColor),
                  borderRadius: '6px',
                  fontWeight: 600,
                  paddingTop: '3px'
                }}
              >
                {editingTask.id && !String(editingTask.id).startsWith('temp') ? `TC${editingTask.id}` : (currentBucket?.name || 'New Task')}
              </div>
              <button
                onClick={goToNextTask}
                className="dialog-nav-btn"
                title="Next undone task"
                disabled={undoneTasks.length <= 1}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Priority and Due Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <div className={`dropdown ${priorityDropdownOpen ? 'open' : ''}`} ref={priorityDropdownRef}>
                <button
                  className="dropdown-trigger"
                  onClick={() => setPriorityDropdownOpen(!priorityDropdownOpen)}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <span>{editingTask.priority || 'Medium'} Priority</span>
                  <ChevronDown size={16} />
                </button>
                <div className="dropdown-menu">
                  {['Low', 'Medium', 'High'].map(priority => (
                    <div
                      key={priority}
                      className={`dropdown-item ${editingTask.priority === priority ? 'selected' : ''}`}
                      onClick={() => {
                        setEditingTask({ ...editingTask, priority });
                        setPriorityDropdownOpen(false);
                      }}
                    >
                      {priority} Priority
                      {editingTask.priority === priority && <Check size={14} />}
                    </div>
                  ))}
                </div>
              </div>
              <input
                type="date"
                value={editingTask.dueDate || ''}
                onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                className="form-input"
                style={{
                  fontSize: '12px',
                  padding: '6px 10px',
                  textAlign: 'center'
                }}
              />
            </div>

            {/* Vertical Tabs */}
            <div className="dialog-tabs">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`dialog-tab ${activeTab === tab.id ? 'active' : ''}`}
                >
                  <h2 className="text-xl" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {tab.label}
                    {tab.badge > 0 && (
                      <span style={{
                        background: 'var(--white-25)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}>
                        {tab.badge}
                      </span>
                    )}
                  </h2>
                  <tab.icon size={18} />
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="dialog-actions">
              {/* Create MC button - only show here if task type is creation and there's already output content */}
              {addMessage && editingTask.taskType === 'Create' && editingTask.outputContent?.length > 0 && (
                <button
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set('action', 'add_message');
                    if (editingTask.audience) params.set('audience', editingTask.audience);
                    if (editingTask.topic) params.set('topic', editingTask.topic);
                    if (editingTask.product) params.set('product', editingTask.product);
                    if (editingTask.id) params.set('linkTask', editingTask.id);
                    window.open(`/matrix?${params.toString()}`, '_blank');
                  }}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                >
                  <ExternalLink size={16} />
                  Create MC
                </button>
              )}
              <button
                onClick={handleDelete}
                className="link-button"
              >
                <Trash2 size={16} />
                Delete
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setEditingTask(null)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="dialog-content-area">
            <div className="dialog-main custom-scrollbar" style={{ padding: '2rem' }}>
              {/* Summary Tab */}
              {activeTab === 'summary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Labels Section */}
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Tag size={14} />
                      Labels
                    </label>

                    {/* Current Labels and Add Label Button - Inline */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      {(editingTask.labels || []).map((label) => (
                        <span
                          key={label}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 12px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 500,
                            background: 'var(--white-15)',
                            color: 'var(--color-white)'
                          }}
                        >
                          {label}
                          <button
                            onClick={() => handleRemoveLabel(label)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              color: 'inherit'
                            }}
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}

                      {/* Add Label Dropdown - Inline */}
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setShowLabelDropdown(!showLabelDropdown)}
                          style={{
                            padding: '4px 12px',
                            background: 'var(--white-10)',
                            border: '1px solid var(--white-20)',
                            borderRadius: '6px',
                            color: 'var(--color-white)',
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Plus size={14} />
                          Add Label
                        </button>

                        {showLabelDropdown && (
                          <div style={{
                            position: 'absolute',
                            left: 0,
                            zIndex: 50,
                            marginTop: '4px',
                            width: '240px',
                            background: 'var(--main-ui-color)',
                            border: '1px solid var(--white-20)',
                            borderRadius: '8px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                            maxHeight: '280px',
                            overflowY: 'auto'
                          }}>
                            {availableLabels.products && availableLabels.products.length > 0 ? (
                              <div style={{ padding: '8px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--white-60)', textTransform: 'uppercase', padding: '8px', marginBottom: '4px' }}>Products</div>
                                {availableLabels.products.map(label => (
                                  <button
                                    key={label}
                                    type="button"
                                    onClick={() => handleAddLabel(label)}
                                    disabled={(editingTask.labels || []).includes(label)}
                                    style={{
                                      width: '100%',
                                      textAlign: 'left',
                                      padding: '8px 12px',
                                      fontSize: '13px',
                                      borderRadius: '6px',
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'var(--color-white)',
                                      cursor: (editingTask.labels || []).includes(label) ? 'not-allowed' : 'pointer',
                                      opacity: (editingTask.labels || []).includes(label) ? 0.5 : 1,
                                      marginBottom: '2px'
                                    }}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div style={{ padding: '16px', fontSize: '13px', color: 'var(--white-60)', textAlign: 'center' }}>
                                No product labels available
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Product and Task Type Dropdowns */}
                  <div style={{ display: 'flex', gap: '16px' }}>
                    {/* Product Dropdown */}
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Product</label>
                      <div className={`dropdown ${productDropdownOpen ? 'open' : ''}`} ref={productDropdownRef}>
                        <button
                          className="dropdown-trigger"
                          onClick={() => setProductDropdownOpen(!productDropdownOpen)}
                          style={{ width: '100%' }}
                        >
                          <span>{editingTask.product || 'Select product...'}</span>
                          <ChevronDown size={16} />
                        </button>
                        <div className="dropdown-menu">
                          <div
                            className={`dropdown-item ${!editingTask.product ? 'selected' : ''}`}
                            onClick={() => {
                              setEditingTask({ ...editingTask, product: '' });
                              setProductDropdownOpen(false);
                            }}
                          >
                            Select product...
                            {!editingTask.product && <Check size={14} />}
                          </div>
                          {availableProducts.map(product => (
                            <div
                              key={product}
                              className={`dropdown-item ${editingTask.product === product ? 'selected' : ''}`}
                              onClick={() => {
                                setEditingTask({ ...editingTask, product });
                                setProductDropdownOpen(false);
                              }}
                            >
                              {product}
                              {editingTask.product === product && <Check size={14} />}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Task Type Dropdown */}
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Task Type</label>
                      <div className={`dropdown ${taskTypeDropdownOpen ? 'open' : ''}`} ref={taskTypeDropdownRef}>
                        <button
                          className="dropdown-trigger"
                          onClick={() => setTaskTypeDropdownOpen(!taskTypeDropdownOpen)}
                          style={{ width: '100%' }}
                        >
                          <span>{editingTask.taskType || 'Select type...'}</span>
                          <ChevronDown size={16} />
                        </button>
                        <div className="dropdown-menu">
                          <div
                            className={`dropdown-item ${!editingTask.taskType ? 'selected' : ''}`}
                            onClick={() => {
                              setEditingTask({ ...editingTask, taskType: '' });
                              setTaskTypeDropdownOpen(false);
                            }}
                          >
                            Select type...
                            {!editingTask.taskType && <Check size={14} />}
                          </div>
                          {taskTypes.map(type => (
                            <div
                              key={type}
                              className={`dropdown-item ${editingTask.taskType === type ? 'selected' : ''}`}
                              onClick={() => {
                                setEditingTask({ ...editingTask, taskType: type });
                                setTaskTypeDropdownOpen(false);
                              }}
                            >
                              {type}
                              {editingTask.taskType === type && <Check size={14} />}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="form-group">
                    <label className="form-label">Title</label>
                    <input
                      type="text"
                      value={editingTask.title || ''}
                      onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                      className="form-input"
                      placeholder="Enter task title"
                    />
                  </div>

                  {/* Description */}
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      value={editingTask.description || ''}
                      onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                      rows={6}
                      className="form-textarea"
                      placeholder="Enter task description"
                    />
                  </div>

                  {/* Suggested Related MC (from AI for modification tasks) */}
                  {editingTask.suggestedRelatedMC && (
                    <div style={{
                      background: 'rgba(249, 115, 22, 0.15)',
                      border: '1px solid rgba(249, 115, 22, 0.3)',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '11px', color: 'var(--white-60)', marginBottom: '4px' }}>
                          AI Suggested MC to Modify
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 600, color: '#fdba74' }}>
                          {editingTask.suggestedRelatedMC}
                        </div>
                      </div>
                      <button
                        onClick={() => setCreativeSearch(editingTask.suggestedRelatedMC)}
                        className="btn btn-secondary"
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                      >
                        Search
                      </button>
                    </div>
                  )}

                  {/* Suggested MCs for modification tasks */}
                  {editingTask.suggestedMCs && editingTask.suggestedMCs.length > 0 && (
                    <div style={{
                      background: 'var(--white-10)',
                      border: '1px solid var(--white-20)',
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-white)' }}>
                          AI Suggested MCs ({editingTask.suggestedMCs.length})
                        </span>
                        {editingTask.taskType === 'Update' && (
                          <span style={{
                            padding: '2px 8px',
                            background: 'var(--white-15)',
                            color: 'var(--color-white)',
                            fontSize: '11px',
                            borderRadius: '4px'
                          }}>
                            Modification Request
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {editingTask.suggestedMCs.map((mc, idx) => (
                          <div
                            key={mc.id || idx}
                            style={{
                              background: 'var(--white-10)',
                              border: '1px solid var(--white-20)',
                              borderRadius: '8px',
                              padding: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: 'var(--color-white)' }}>{mc.pmmid}</span>
                                <span style={{
                                  fontSize: '11px',
                                  padding: '2px 6px',
                                  background: '#22c55e',
                                  color: 'white',
                                  borderRadius: '4px'
                                }}>
                                  {Math.round(mc.matchScore * 100)}% match
                                </span>
                              </div>
                              <div style={{ fontSize: '13px', color: 'var(--white-80)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mc.name || 'Untitled'}</div>
                              <div style={{ fontSize: '11px', color: 'var(--white-60)', marginTop: '4px' }}>
                                {mc.audience} / {mc.topic}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const newRelatedContent = [
                                  ...(editingTask.relatedContent || []),
                                  { id: Date.now(), reference: mc.pmmid, type: 'message', messageId: mc.id }
                                ];
                                const newSuggested = editingTask.suggestedMCs.filter(s => s.id !== mc.id);
                                setEditingTask({ ...editingTask, relatedContent: newRelatedContent, suggestedMCs: newSuggested });
                              }}
                              className="btn btn-primary"
                              style={{ fontSize: '12px', padding: '6px 12px' }}
                            >
                              <Plus size={14} />
                              Link
                            </button>
                          </div>
                        ))}
                      </div>
                      {editingTask.keywords && editingTask.keywords.length > 0 && (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--white-15)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--white-60)' }}>Keywords: </span>
                          <span style={{ fontSize: '11px', color: 'var(--white-80)' }}>{editingTask.keywords.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bucket and Created */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">Bucket</label>
                      <select
                        value={editingTask.bucket || 'incoming'}
                        onChange={(e) => setEditingTask({ ...editingTask, bucket: e.target.value })}
                        className="form-input"
                        style={{
                          cursor: 'pointer',
                          backgroundColor: currentBucketColor,
                          borderColor: currentBucketColor,
                          color: getTextColor(currentBucketColor),
                          fontWeight: 600
                        }}
                      >
                        {buckets.map(bucket => {
                          // buckets is array of strings like ['INCOMING', 'NAMING', ...]
                          const bucketId = typeof bucket === 'string' ? bucket : bucket.id;
                          const bucketName = typeof bucket === 'string' ? bucket : bucket.name;
                          const bucketColor = getBucketColor(bucketId);
                          return (
                            <option
                              key={bucketId}
                              value={bucketId}
                              style={{
                                backgroundColor: bucketColor,
                                color: getTextColor(bucketColor)
                              }}
                            >
                              {bucketName}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {editingTask.createdAt && (
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} />
                          Created
                        </label>
                        <input
                          type="text"
                          value={new Date(editingTask.createdAt).toLocaleString()}
                          disabled
                          className="form-input"
                          style={{ opacity: 0.6, cursor: 'not-allowed' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Gmail Search Link (if task is from email) */}
                  {editingTask.emailSubject && (
                    <div style={{
                      background: 'var(--white-10)',
                      border: '1px solid var(--white-20)',
                      borderRadius: '12px',
                      padding: '16px',
                      marginTop: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <Mail size={14} />
                            Original Email
                          </label>
                          <p style={{ fontSize: '13px', color: 'var(--white-80)' }}>
                            {editingTask.emailSubject}
                          </p>
                        </div>
                        <a
                          href={getGmailSearchUrl(editingTask.emailSubject)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                        >
                          <Search size={16} />
                          Open in Gmail
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* AI-Extracted Conversation Context (Read-only Markdown) */}
                  {editingTask.context && (
                    <div className="form-group">
                      <label className="form-label">Extracted Conversation Context</label>
                      <p style={{ fontSize: '12px', color: 'var(--white-60)', marginBottom: '12px' }}>
                        AI-extracted conversation structure from the email thread
                      </p>
                      <div style={{
                        background: 'var(--white-10)',
                        border: '1px solid var(--white-20)',
                        borderRadius: '8px',
                        padding: '16px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        color: 'var(--color-white)'
                      }} className="custom-scrollbar prose-invert">
                        <ReactMarkdown>{editingTask.context}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* User's Additional Notes (Editable) */}
                  <div className="form-group">
                    <label className="form-label">Additional Context & Notes</label>
                    <p style={{ fontSize: '12px', color: 'var(--white-60)', marginBottom: '12px' }}>
                      Add your own notes and context that the AI assistant can use
                    </p>
                    <textarea
                      value={editingTask.userNotes || ''}
                      onChange={(e) => setEditingTask({ ...editingTask, userNotes: e.target.value })}
                      rows={8}
                      className="form-textarea"
                      style={{ fontFamily: 'monospace', fontSize: '13px' }}
                      placeholder="Add context, notes, requirements, or any information that helps understand this task better..."
                    />
                  </div>
                </div>
              )}

            </div>

            {/* RELATED CONTENT PANEL (Third Section) */}
            <div className="dialog-preview custom-scrollbar" style={{ overflowY: 'auto' }}>
              {/* SOURCE SECTION */}
              <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--white-15)' }}>
                <div className="preview-header" style={{ justifyContent: 'flex-start' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-white)' }}>Related Content Source</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="custom-scrollbar">
                {/* MC Search Combo Box */}
                <div ref={mcDropdownRef} className={`dropdown ${mcDropdownOpen ? 'open' : ''}`} style={{ position: 'relative' }}>
                  {/* Combo Box Trigger */}
                  <div
                    className="dropdown-trigger"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      background: 'var(--white-10)',
                      border: '1px solid var(--white-20)',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                    onClick={() => setMcDropdownOpen(!mcDropdownOpen)}
                  >
                    <Search size={14} style={{ color: 'var(--white-50)', flexShrink: 0 }} />
                    <input
                      type="text"
                      value={creativeSearch}
                      onChange={(e) => {
                        setCreativeSearch(e.target.value);
                        if (!mcDropdownOpen && e.target.value.length >= 2) {
                          setMcDropdownOpen(true);
                        }
                      }}
                      onFocus={() => creativeSearch.length >= 2 && setMcDropdownOpen(true)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Search MCs..."
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: '12px',
                        color: 'var(--color-white)'
                      }}
                    />
                    <ChevronDown size={14} style={{ color: 'var(--white-50)', flexShrink: 0, transform: mcDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>

                  {/* Dropdown Menu */}
                  {mcDropdownOpen && (
                    <div
                      className="dropdown-menu"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        background: 'var(--main-ui-color)',
                        border: '1px solid var(--white-20)',
                        borderRadius: '8px',
                        boxShadow: 'var(--ui-shadow)',
                        zIndex: 100,
                        maxHeight: '250px',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      {searchResults.length > 0 ? (
                        <>
                          {/* Header with Select All / Deselect All */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderBottom: '1px solid var(--white-15)',
                            fontSize: '10px',
                            color: 'var(--white-60)'
                          }}>
                            <span>Found {searchResults.length} • Selected {selectedMcIds.size}</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMcIds(new Set(searchResults.map(mc => mc.id)));
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  padding: '2px 6px',
                                  fontSize: '10px',
                                  color: 'var(--white-70)',
                                  cursor: 'pointer',
                                  borderRadius: '4px'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--white-15)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                All
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMcIds(new Set());
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  padding: '2px 6px',
                                  fontSize: '10px',
                                  color: 'var(--white-70)',
                                  cursor: 'pointer',
                                  borderRadius: '4px'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--white-15)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                None
                              </button>
                            </div>
                          </div>

                          {/* Results List */}
                          <div style={{ overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
                            {searchResults.map((mc) => {
                              const statusColor = getMcStatusColor(mc.status);
                              const isSelected = selectedMcIds.has(mc.id);
                              return (
                                <div
                                  key={mc.id}
                                  className={`dropdown-item ${isSelected ? 'selected' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedMcIds(prev => {
                                      const next = new Set(prev);
                                      if (next.has(mc.id)) {
                                        next.delete(mc.id);
                                      } else {
                                        next.add(mc.id);
                                      }
                                      return next;
                                    });
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '6px 10px',
                                    cursor: 'pointer',
                                    background: isSelected ? 'var(--white-10)' : 'transparent'
                                  }}
                                >
                                  {/* Checkbox */}
                                  <div style={{
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '4px',
                                    border: isSelected ? 'none' : '1px solid var(--white-30)',
                                    background: isSelected ? '#3b82f6' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}>
                                    {isSelected && <Check size={12} style={{ color: 'white' }} />}
                                  </div>
                                  {/* MC Label */}
                                  <span style={{
                                    fontFamily: 'monospace',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: getTextColor(statusColor),
                                    backgroundColor: statusColor,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    flexShrink: 0
                                  }}>
                                    {mc.mcLabel}
                                  </span>
                                  {/* Name */}
                                  <span style={{
                                    fontSize: '11px',
                                    color: 'var(--white-80)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    flex: 1
                                  }}>
                                    {mc.name}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Add Selected Button */}
                          {selectedMcIds.size > 0 && (
                            <div style={{ padding: '8px 10px', borderTop: '1px solid var(--white-15)' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Add all selected MCs in one batch
                                  const newItems = searchResults
                                    .filter(mc => selectedMcIds.has(mc.id))
                                    .map((mc, idx) => ({
                                      id: Date.now() + idx,
                                      reference: mc.mcLabel,
                                      type: 'message',
                                      messageId: mc.id
                                    }));
                                  const existingContent = editingTask.relatedContent || [];
                                  const existingIds = new Set(existingContent.map(c => c.messageId));
                                  const filteredNew = newItems.filter(item => !existingIds.has(item.messageId));
                                  setEditingTask({
                                    ...editingTask,
                                    relatedContent: [...existingContent, ...filteredNew]
                                  });
                                  setSelectedMcIds(new Set());
                                  setMcDropdownOpen(false);
                                  setCreativeSearch('');
                                }}
                                className="btn btn-primary"
                                style={{ width: '100%', fontSize: '11px', padding: '6px 12px' }}
                              >
                                Add {selectedMcIds.size} Selected
                              </button>
                            </div>
                          )}
                        </>
                      ) : creativeSearch.length >= 2 ? (
                        <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: 'var(--white-60)' }}>
                          No MCs found
                        </div>
                      ) : (
                        <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: 'var(--white-60)' }}>
                          Type 2+ characters to search
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Related Content List */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-white)' }}>
                      Linked ({editingTask.relatedContent?.length || 0})
                    </div>
                    {editingTask.relatedContent && editingTask.relatedContent.length > 0 && (
                      <button
                        onClick={() => {
                          // Get all linked MC codes and open Creative Library filtered to them
                          // v2 schema: relatedContent is array of MC labels like ["MC282a", "MC283b"]
                          const mcCodes = (editingTask.relatedContent || [])
                            .map(mcLabel => {
                              // Insert underscore between number and variant (MC282a → MC282_a)
                              return mcLabel.replace(/^(MC\d+)([a-zA-Z].*)$/, '$1_$2');
                            })
                            .join(' OR ');
                          if (mcCodes) {
                            window.open(`/creative-library?filter_creatives=${encodeURIComponent(mcCodes)}`, '_blank');
                          }
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '10px', gap: '4px' }}
                        title="Open in Creative Library"
                      >
                        <ExternalLink size={12} />
                        Show in Creative Library
                      </button>
                    )}
                  </div>
                  {resolvedRelatedContent && resolvedRelatedContent.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
                      {resolvedRelatedContent.map((item) => {
                        // v2 schema: item is resolved MC data with mcLabel, name, topicName, status
                        const statusColor = item.found ? getMcStatusColor(item.status) : '#6b7280';

                        return (
                          <div
                            key={item.mcLabel}
                            style={{
                              padding: '2px 0px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            {/* MC Label with status color */}
                            <span style={{
                              fontFamily: 'monospace',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: getTextColor(statusColor),
                              backgroundColor: statusColor,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              flexShrink: 0
                            }}>
                              {item.mcLabel}
                            </span>
                            {/* MC Name and Topic */}
                            <span style={{
                              fontSize: '11px',
                              color: item.found ? 'var(--white-80)' : 'var(--white-50)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                              fontStyle: item.found ? 'normal' : 'italic'
                            }}>
                              {item.found ? (
                                <>{item.name}{item.topicName ? ` | ${item.topicName}` : ''}</>
                              ) : (
                                'Not found in matrix'
                              )}
                            </span>
                            {/* Unlink button */}
                            <button
                              onClick={() => handleRemoveRelatedContent(item.mcLabel)}
                              className="btn btn-secondary"
                              style={{ padding: '4px', flexShrink: 0 }}
                              title="Unlink"
                            >
                              <Unlink size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{
                      textAlign: 'center',
                      padding: '24px 12px',
                      color: 'var(--white-50)',
                      border: '1px dashed var(--white-20)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}>
                      No linked content
                    </div>
                  )}
                </div>
                </div>
              </div>

              {/* OUTPUT SECTION */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '1rem' }}>
                <div className="preview-header" style={{ justifyContent: 'flex-start' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-white)' }}>Related Content Output</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="custom-scrollbar">
                  {/* Update Task Type - Increment Version UI */}
                  {editingTask.taskType === 'Update' ? (
                    <div style={{
                      padding: '16px',
                      border: '1px dashed var(--white-20)',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <p style={{
                        fontSize: '12px',
                        color: 'var(--white-70)',
                        lineHeight: '1.5',
                        margin: 0
                      }}>
                        For update tasks, the output MCs and variants remain the same as the source.
                        Versions are not saved automatically. When you increment the version,
                        you can update or upload the updated content.
                      </p>
                      <button
                        onClick={() => {
                          // TODO: Implement version increment logic
                          alert('Version increment functionality coming soon');
                        }}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                      >
                        <Plus size={16} />
                        Increment Version
                      </button>
                    </div>
                  ) : (
                  <>
                  {/* MC Search Combo Box for Output */}
                  <div ref={outputDropdownRef} className={`dropdown ${outputDropdownOpen ? 'open' : ''}`} style={{ position: 'relative' }}>
                    {/* Combo Box Trigger */}
                    <div
                      className="dropdown-trigger"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: 'var(--white-10)',
                        border: '1px solid var(--white-20)',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                      onClick={() => setOutputDropdownOpen(!outputDropdownOpen)}
                    >
                      <Search size={14} style={{ color: 'var(--white-50)', flexShrink: 0 }} />
                      <input
                        type="text"
                        value={outputSearch}
                        onChange={(e) => {
                          setOutputSearch(e.target.value);
                          if (!outputDropdownOpen && e.target.value.length >= 2) {
                            setOutputDropdownOpen(true);
                          }
                        }}
                        onFocus={() => outputSearch.length >= 2 && setOutputDropdownOpen(true)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Search MCs..."
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          fontSize: '12px',
                          color: 'var(--color-white)'
                        }}
                      />
                      <ChevronDown size={14} style={{ color: 'var(--white-50)', flexShrink: 0, transform: outputDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </div>

                    {/* Dropdown Menu */}
                    {outputDropdownOpen && (
                      <div
                        className="dropdown-menu"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: '4px',
                          background: 'var(--main-ui-color)',
                          border: '1px solid var(--white-20)',
                          borderRadius: '8px',
                          boxShadow: 'var(--ui-shadow)',
                          zIndex: 100,
                          maxHeight: '250px',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        {outputSearchResults.length > 0 ? (
                          <>
                            {/* Header with Select All / Deselect All */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderBottom: '1px solid var(--white-15)',
                              fontSize: '10px',
                              color: 'var(--white-60)'
                            }}>
                              <span>Found {outputSearchResults.length} • Selected {selectedOutputMcIds.size}</span>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOutputMcIds(new Set(outputSearchResults.map(mc => mc.id)));
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '2px 6px',
                                    fontSize: '10px',
                                    color: 'var(--white-70)',
                                    cursor: 'pointer',
                                    borderRadius: '4px'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--white-15)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  All
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOutputMcIds(new Set());
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '2px 6px',
                                    fontSize: '10px',
                                    color: 'var(--white-70)',
                                    cursor: 'pointer',
                                    borderRadius: '4px'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--white-15)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  None
                                </button>
                              </div>
                            </div>

                            {/* Results List */}
                            <div style={{ overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
                              {outputSearchResults.map((mc) => {
                                const statusColor = getMcStatusColor(mc.status);
                                const isSelected = selectedOutputMcIds.has(mc.id);
                                return (
                                  <div
                                    key={mc.id}
                                    className={`dropdown-item ${isSelected ? 'selected' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedOutputMcIds(prev => {
                                        const next = new Set(prev);
                                        if (next.has(mc.id)) {
                                          next.delete(mc.id);
                                        } else {
                                          next.add(mc.id);
                                        }
                                        return next;
                                      });
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '6px 10px',
                                      cursor: 'pointer',
                                      background: isSelected ? 'var(--white-10)' : 'transparent'
                                    }}
                                  >
                                    {/* Checkbox */}
                                    <div style={{
                                      width: '16px',
                                      height: '16px',
                                      borderRadius: '4px',
                                      border: isSelected ? 'none' : '1px solid var(--white-30)',
                                      background: isSelected ? '#3b82f6' : 'transparent',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0
                                    }}>
                                      {isSelected && <Check size={12} style={{ color: 'white' }} />}
                                    </div>
                                    {/* MC Label */}
                                    <span style={{
                                      fontFamily: 'monospace',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      color: getTextColor(statusColor),
                                      backgroundColor: statusColor,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      flexShrink: 0
                                    }}>
                                      {mc.mcLabel}
                                    </span>
                                    {/* Name */}
                                    <span style={{
                                      fontSize: '11px',
                                      color: 'var(--white-80)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      flex: 1
                                    }}>
                                      {mc.name}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Add Selected Button */}
                            {selectedOutputMcIds.size > 0 && (
                              <div style={{ padding: '8px 10px', borderTop: '1px solid var(--white-15)' }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newItems = outputSearchResults
                                      .filter(mc => selectedOutputMcIds.has(mc.id))
                                      .map((mc, idx) => ({
                                        id: Date.now() + idx,
                                        reference: mc.mcLabel,
                                        type: 'message',
                                        messageId: mc.id
                                      }));
                                    const existingContent = editingTask.outputContent || [];
                                    const existingIds = new Set(existingContent.map(c => c.messageId));
                                    const filteredNew = newItems.filter(item => !existingIds.has(item.messageId));
                                    setEditingTask({
                                      ...editingTask,
                                      outputContent: [...existingContent, ...filteredNew]
                                    });
                                    setSelectedOutputMcIds(new Set());
                                    setOutputDropdownOpen(false);
                                    setOutputSearch('');
                                  }}
                                  className="btn btn-primary"
                                  style={{ width: '100%', fontSize: '11px', padding: '6px 12px' }}
                                >
                                  Add {selectedOutputMcIds.size} Selected
                                </button>
                              </div>
                            )}
                          </>
                        ) : outputSearch.length >= 2 ? (
                          <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: 'var(--white-60)' }}>
                            No MCs found
                          </div>
                        ) : (
                          <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: 'var(--white-60)' }}>
                            Type 2+ characters to search
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Output Content List */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-white)' }}>
                        Linked ({editingTask.outputContent?.length || 0})
                      </div>
                      {editingTask.outputContent && editingTask.outputContent.length > 0 && (
                        <button
                          onClick={() => {
                            // v2 schema: outputContent is array of MC labels like ["MC282a", "MC283b"]
                            const mcCodes = (editingTask.outputContent || [])
                              .map(mcLabel => {
                                // Insert underscore between number and variant (MC282a → MC282_a)
                                return mcLabel.replace(/^(MC\d+)([a-zA-Z].*)$/, '$1_$2');
                              })
                              .join(' OR ');
                            if (mcCodes) {
                              window.open(`/creative-library?filter_creatives=${encodeURIComponent(mcCodes)}`, '_blank');
                            }
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '10px', gap: '4px' }}
                          title="Open in Creative Library"
                        >
                          <ExternalLink size={12} />
                          Show in Creative Library
                        </button>
                      )}
                    </div>
                    {resolvedOutputContent && resolvedOutputContent.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
                        {resolvedOutputContent.map((item) => {
                          // v2 schema: item is resolved MC data with mcLabel, name, topicName, status
                          const statusColor = item.found ? getMcStatusColor(item.status) : '#6b7280';

                          return (
                            <div
                              key={item.mcLabel}
                              style={{
                                padding: '2px 0px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              {/* MC Label with status color */}
                              <span style={{
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: getTextColor(statusColor),
                                backgroundColor: statusColor,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                flexShrink: 0
                              }}>
                                {item.mcLabel}
                              </span>
                              {/* MC Name and Topic */}
                              <span style={{
                                fontSize: '11px',
                                color: item.found ? 'var(--white-80)' : 'var(--white-50)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1
                              }}>
                                {item.found ? `${item.name || ''}${item.topicName ? ` | ${item.topicName}` : ''}` : '(not found)'}
                              </span>
                              <button
                                onClick={() => handleRemoveOutputContent(item.mcLabel)}
                                className="btn btn-secondary"
                                style={{ padding: '4px', flexShrink: 0 }}
                                title="Unlink"
                              >
                                <Unlink size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{
                        padding: '16px 12px',
                        color: 'var(--white-50)',
                        border: '1px dashed var(--white-20)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        textAlign: 'center'
                      }}>
                        No linked output
                      </div>
                    )}
                  </div>

                  {/* Create New Messages Box */}
                  {addMessage && (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-white)', marginBottom: '8px' }}>
                        Create New Messages
                      </div>
                      <div style={{
                        padding: '12px',
                        border: '1px dashed var(--white-20)',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        {/* Audience and Topic Dropdowns */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {/* Audience Dropdown */}
                          <label style={{ fontSize: '12px', color: 'var(--white-60)', marginBottom: '-4px' }}>Audience</label>
                          <div className={`dropdown ${audienceDropdownOpen ? 'open' : ''}`} ref={audienceDropdownRef}>
                            <button
                              className="dropdown-trigger"
                              onClick={() => setAudienceDropdownOpen(!audienceDropdownOpen)}
                              style={{ width: '100%' }}
                            >
                              <span>{audiences.find(a => a.key === editingTask.audience)?.name || 'Audience...'}</span>
                              <ChevronDown size={14} />
                            </button>
                            <div className="dropdown-menu">
                              <div
                                className={`dropdown-item ${!editingTask.audience ? 'selected' : ''}`}
                                onClick={() => {
                                  setEditingTask({ ...editingTask, audience: '' });
                                  setAudienceDropdownOpen(false);
                                }}
                              >
                                Audience...
                                {!editingTask.audience && <Check size={14} />}
                              </div>
                              {audiences
                                .filter(a => !editingTask.product || a.product === editingTask.product)
                                .map(audience => (
                                  <div
                                    key={audience.key}
                                    className={`dropdown-item ${editingTask.audience === audience.key ? 'selected' : ''}`}
                                    onClick={() => {
                                      setEditingTask({ ...editingTask, audience: audience.key });
                                      setAudienceDropdownOpen(false);
                                    }}
                                  >
                                    {audience.name}
                                    {editingTask.audience === audience.key && <Check size={14} />}
                                  </div>
                                ))}
                            </div>
                          </div>

                          {/* Topic Dropdown */}
                          <label style={{ fontSize: '12px', color: 'var(--white-60)', marginBottom: '-4px' }}>Topic</label>
                          <div className={`dropdown ${topicDropdownOpen ? 'open' : ''}`} ref={topicDropdownRef}>
                            <button
                              className="dropdown-trigger"
                              onClick={() => setTopicDropdownOpen(!topicDropdownOpen)}
                              style={{ width: '100%' }}
                            >
                              <span>{topics.find(t => t.key === editingTask.topic)?.name || 'Topic...'}</span>
                              <ChevronDown size={14} />
                            </button>
                            <div className="dropdown-menu">
                              <div
                                className={`dropdown-item ${!editingTask.topic ? 'selected' : ''}`}
                                onClick={() => {
                                  setEditingTask({ ...editingTask, topic: '' });
                                  setTopicDropdownOpen(false);
                                }}
                              >
                                Topic...
                                {!editingTask.topic && <Check size={14} />}
                              </div>
                              {topics
                                .filter(t => !editingTask.product || t.product === editingTask.product)
                                .map(topic => (
                                  <div
                                    key={topic.key}
                                    className={`dropdown-item ${editingTask.topic === topic.key ? 'selected' : ''}`}
                                    onClick={() => {
                                      setEditingTask({ ...editingTask, topic: topic.key });
                                      setTopicDropdownOpen(false);
                                    }}
                                  >
                                    {topic.name}
                                    {editingTask.topic === topic.key && <Check size={14} />}
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            const params = new URLSearchParams();
                            params.set('action', 'add_message');
                            if (editingTask.audience) params.set('audience', editingTask.audience);
                            if (editingTask.topic) params.set('topic', editingTask.topic);
                            if (editingTask.product) params.set('product', editingTask.product);
                            if (editingTask.id) params.set('linkTask', editingTask.id);
                            window.open(`/matrix?${params.toString()}`, '_blank');
                          }}
                          className="btn btn-primary"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                        >
                          <ExternalLink size={16} />
                          Create MC
                        </button>
                      </div>
                    </div>
                  )}
                  </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create MC Modal */}
      {showCreateMcModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60
          }}
          onClick={() => setShowCreateMcModal(false)}
        >
          <div
            style={{
              background: 'var(--main-ui-color)',
              borderRadius: '16px',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
              width: '100%',
              maxWidth: '420px',
              margin: '0 16px',
              border: '1px solid var(--white-20)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              borderBottom: '1px solid var(--white-15)',
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-white)' }}>Create MC from Task</h3>
              <button
                onClick={() => setShowCreateMcModal(false)}
                style={{
                  padding: '6px',
                  background: 'var(--white-10)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: 'var(--color-white)'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {createMcStatus === 'success' ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    background: 'rgba(34, 197, 94, 0.2)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px'
                  }}>
                    <Check size={32} style={{ color: '#22c55e' }} />
                  </div>
                  <h4 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-white)', marginBottom: '8px' }}>MC Created!</h4>
                  <p style={{ color: 'var(--white-80)' }}>
                    Created: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{createdMcInfo?.pmmid}</span>
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--white-60)', marginTop: '8px' }}>
                    The MC has been added to the Matrix and linked to this task.
                  </p>
                </div>
              ) : (
                <>
                  {/* Task Info Preview */}
                  <div style={{
                    background: 'var(--white-10)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <p style={{ fontSize: '13px', color: 'var(--white-60)', marginBottom: '4px' }}>Creating MC from:</p>
                    <p style={{ fontWeight: 500, color: 'var(--color-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editingTask.title}</p>
                    {editingTask.suggestedMCName && (
                      <p style={{ fontSize: '13px', color: 'var(--white-80)', marginTop: '8px' }}>
                        Suggested name: <span style={{ fontWeight: 500, color: '#22c55e' }}>{editingTask.suggestedMCName}</span>
                      </p>
                    )}
                    {editingTask.product && (
                      <p style={{ fontSize: '12px', color: 'var(--white-60)', marginTop: '4px' }}>
                        Product: {editingTask.product}
                      </p>
                    )}
                  </div>

                  {/* Product Selection */}
                  {availableProducts.length > 1 && (
                    <div className="form-group">
                      <label className="form-label">Product</label>
                      <select
                        value={selectedProduct}
                        onChange={(e) => {
                          setSelectedProduct(e.target.value);
                          setSelectedAudience('');
                          setSelectedTopic('');
                        }}
                        className="form-input"
                        style={{ cursor: 'pointer' }}
                      >
                        {availableProducts.map(product => (
                          <option key={product} value={product}>{product}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Audience Selection */}
                  <div className="form-group">
                    <label className="form-label">Audience</label>
                    <select
                      value={selectedAudience}
                      onChange={(e) => setSelectedAudience(e.target.value)}
                      className="form-input"
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="">Select audience...</option>
                      {filteredAudiences.map(aud => (
                        <option key={aud.key} value={aud.key}>{aud.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Topic Selection */}
                  <div className="form-group">
                    <label className="form-label">Topic</label>
                    <select
                      value={selectedTopic}
                      onChange={(e) => setSelectedTopic(e.target.value)}
                      className="form-input"
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="">Select topic...</option>
                      {filteredTopics.map(topic => (
                        <option key={topic.key} value={topic.key}>{topic.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Info */}
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '13px',
                    color: '#93c5fd'
                  }}>
                    <p>The MC will be created with:</p>
                    <ul style={{ listStyle: 'disc', listStylePosition: 'inside', marginTop: '4px', color: '#7dd3fc' }}>
                      <li>Status: INCOMING</li>
                      <li>Name from task title</li>
                    </ul>
                  </div>

                  {createMcStatus === 'error' && (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '13px',
                      color: '#fca5a5'
                    }}>
                      Failed to create MC. Please try again.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            {createMcStatus !== 'success' && (
              <div style={{
                borderTop: '1px solid var(--white-15)',
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px'
              }}>
                <button
                  onClick={() => setShowCreateMcModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateMc}
                  disabled={!selectedAudience || !selectedTopic || createMcStatus === 'creating'}
                  className="btn btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: (!selectedAudience || !selectedTopic || createMcStatus === 'creating') ? 0.5 : 1,
                    cursor: (!selectedAudience || !selectedTopic || createMcStatus === 'creating') ? 'not-allowed' : 'pointer'
                  }}
                >
                  {createMcStatus === 'creating' ? (
                    <>Creating...</>
                  ) : (
                    <>
                      <ArrowRight size={16} />
                      Create MC
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskEditorDialog;

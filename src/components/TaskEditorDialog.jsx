import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2, Mail, Clock, Plus, Search, Tag, Palette, ArrowRight, Check, Link2, FileText, FileText as SummaryIcon, MessageSquare, Paperclip, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { apiGet } from '../utils/api';

const TaskEditorDialog = ({
  editingTask,
  setEditingTask,
  onSave,
  onDelete,
  buckets,
  matrixData
}) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [creativeSearch, setCreativeSearch] = useState('');
  const [availableLabels, setAvailableLabels] = useState({ products: [], topics: [], all: [] });
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);

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
  const addMessage = matrixData?.addMessage;

  // Get unique products from audiences and topics
  const availableProducts = useMemo(() => {
    const products = new Set();
    audiences.forEach(a => { if (a.product) products.add(a.product); });
    topics.forEach(t => { if (t.product) products.add(t.product); });
    return Array.from(products).sort();
  }, [audiences, topics]);

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

  // Search messages for Related Content tab
  const searchResults = useMemo(() => {
    if (!creativeSearch.trim() || creativeSearch.length < 2) return [];

    const searchLower = creativeSearch.toLowerCase();
    const alreadyLinked = new Set((editingTask?.relatedContent || []).map(r => r.messageId).filter(Boolean));

    return messages
      .filter(msg => {
        // Don't show already linked messages
        if (alreadyLinked.has(msg.id) || alreadyLinked.has(String(msg.id))) return false;

        // Search in various fields
        const pmmid = (msg.pmmid || `MC${msg.number || msg.id}${msg.variant || ''}`).toLowerCase();
        const name = (msg.name || msg.Name || '').toLowerCase();
        const copy1 = (msg.copy1 || msg.Copy1 || '').toLowerCase();

        return pmmid.includes(searchLower) ||
               name.includes(searchLower) ||
               copy1.includes(searchLower);
      })
      .slice(0, 8) // Limit results
      .map(msg => {
        const audience = audiences.find(a => a.key === msg.audience);
        const topic = topics.find(t => t.key === msg.topic);
        return {
          id: msg.id,
          pmmid: msg.pmmid || `MC${msg.number || msg.id}${msg.variant || ''}`,
          name: msg.name || msg.Name || 'Untitled',
          audience: audience?.name || msg.audience,
          topic: topic?.name || msg.topic,
          status: msg.status
        };
      });
  }, [creativeSearch, messages, audiences, topics, editingTask?.relatedContent]);

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

  if (!editingTask) return null;

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
      // Calculate next message ID
      const maxId = Math.max(0, ...messages.map(m => parseInt(m.id) || 0));
      const newId = maxId + 1;

      // Create message with task data
      // addMessage(topicKey, audienceKey) creates a new message
      // We need to call it and then update the message with our data
      addMessage(selectedTopic, selectedAudience);

      // The message is created with default values
      // We'll update relatedContent to link to this new message
      const newRelatedContent = [
        ...(editingTask.relatedContent || []),
        {
          id: Date.now(),
          reference: `MC${newId}`,
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
      setCreatedMcInfo({ id: newId, pmmid: `MC${newId}` });
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
  const handleAddRelatedContent = (creative) => {
    const relatedContent = editingTask.relatedContent || [];
    if (!relatedContent.find(c => c.id === creative.id)) {
      setEditingTask({
        ...editingTask,
        relatedContent: [...relatedContent, creative]
      });
    }
    setCreativeSearch('');
  };

  // Remove related content
  const handleRemoveRelatedContent = (creativeId) => {
    setEditingTask({
      ...editingTask,
      relatedContent: (editingTask.relatedContent || []).filter(c => c.id !== creativeId)
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

  // Tab definitions
  const tabs = [
    { id: 'summary', label: 'Summary', icon: SummaryIcon },
    { id: 'context', label: 'Context', icon: MessageSquare },
    { id: 'related', label: 'Related', icon: Paperclip, badge: editingTask.relatedContent?.length || 0 }
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

            {/* Status indicator */}
            <div className="dialog-nav">
              <div
                className="dialog-nav-indicator"
                style={{
                  backgroundColor: editingTask.status === 'completed' ? '#22c55e' : 'var(--white-15)',
                  borderRadius: '6px',
                  fontWeight: 600
                }}
              >
                {editingTask.status === 'completed' ? 'Completed' : currentBucket?.name || 'Backlog'}
              </div>
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
              {/* Create MC button - only for creative workflow tasks */}
              {editingTask.workflowType === 'creative' && addMessage && (
                <button
                  onClick={() => setShowCreateMcModal(true)}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                >
                  <ArrowRight size={16} />
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
                        {editingTask.taskType === 'modification' && (
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

                  {/* Task Type Badge (for creative tasks) */}
                  {editingTask.taskType && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--white-60)' }}>Task Type:</span>
                      <span style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        borderRadius: '6px',
                        fontWeight: 500,
                        background: editingTask.taskType === 'creation' ? '#22c55e' : editingTask.taskType === 'modification' ? '#f97316' : 'var(--white-15)',
                        color: 'white'
                      }}>
                        {editingTask.taskType === 'creation' ? 'New Creative' :
                         editingTask.taskType === 'modification' ? 'Modification' : editingTask.taskType}
                      </span>
                    </div>
                  )}

                  {/* Priority, Bucket, Workflow Type */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">Priority</label>
                      <select
                        value={editingTask.priority || 'Medium'}
                        onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}
                        className="form-input"
                        style={{ cursor: 'pointer' }}
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Bucket</label>
                      <select
                        value={editingTask.bucket || 'backlog'}
                        onChange={(e) => setEditingTask({ ...editingTask, bucket: e.target.value })}
                        className="form-input"
                        style={{ cursor: 'pointer' }}
                      >
                        {buckets.map(bucket => (
                          <option key={bucket.id} value={bucket.id}>
                            {bucket.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Palette size={14} />
                        Workflow Type
                      </label>
                      <select
                        value={editingTask.workflowType || 'general'}
                        onChange={(e) => setEditingTask({ ...editingTask, workflowType: e.target.value })}
                        className="form-input"
                        style={{ cursor: 'pointer' }}
                      >
                        <option value="general">General</option>
                        <option value="creative">Creative Workflow</option>
                      </select>
                    </div>
                  </div>

                  {/* Due Date and Created */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">Due Date</label>
                      <input
                        type="date"
                        value={editingTask.dueDate || ''}
                        onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                        className="form-input"
                      />
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

              {/* Context Tab */}
              {activeTab === 'context' && (
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

              {/* Related Content Tab */}
              {activeTab === 'related' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <label className="form-label">Related MCs & Creatives</label>
                    <p style={{ fontSize: '12px', color: 'var(--white-60)', marginTop: '4px' }}>
                      Search Matrix messages or add text references
                    </p>
                  </div>

                  {/* Search Section */}
                  <div style={{
                    background: 'var(--white-10)',
                    border: '1px solid var(--white-20)',
                    borderRadius: '12px',
                    padding: '16px'
                  }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--white-50)' }} />
                        <input
                          type="text"
                          value={creativeSearch}
                          onChange={(e) => setCreativeSearch(e.target.value)}
                          placeholder="Search MCs by name, number, or content..."
                          className="form-input"
                          style={{ paddingLeft: '40px' }}
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (creativeSearch.trim()) {
                            handleAddRelatedContent({
                              id: Date.now(),
                              reference: creativeSearch.trim(),
                              type: 'text'
                            });
                          }
                        }}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Add as text reference (not linked to Matrix)"
                      >
                        <FileText size={16} />
                        Add Text
                      </button>
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div style={{ marginTop: '12px', borderTop: '1px solid var(--white-15)', paddingTop: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--white-60)', marginBottom: '8px' }}>
                          Matrix Messages ({searchResults.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }} className="custom-scrollbar">
                          {searchResults.map((mc) => (
                            <div
                              key={mc.id}
                              style={{
                                background: 'var(--white-10)',
                                border: '1px solid var(--white-20)',
                                borderRadius: '8px',
                                padding: '10px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: 'var(--color-white)' }}>{mc.pmmid}</span>
                                  {mc.status && (
                                    <span style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--white-15)', color: 'var(--white-80)', borderRadius: '4px' }}>
                                      {mc.status}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--white-80)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mc.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--white-60)' }}>{mc.audience} / {mc.topic}</div>
                              </div>
                              <button
                                onClick={() => {
                                  handleAddRelatedContent({
                                    id: Date.now(),
                                    reference: mc.pmmid,
                                    type: 'message',
                                    messageId: mc.id
                                  });
                                }}
                                className="btn btn-primary"
                                style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Link2 size={14} />
                                Link
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No results message */}
                    {creativeSearch.length >= 2 && searchResults.length === 0 && (
                      <div style={{ marginTop: '12px', textAlign: 'center', padding: '12px', fontSize: '13px', color: 'var(--white-60)' }}>
                        No Matrix messages found. Use "Add Text" to add a text reference.
                      </div>
                    )}
                  </div>

                  {/* Related Content List */}
                  {editingTask.relatedContent && editingTask.relatedContent.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--white-80)' }}>
                        Linked Items ({editingTask.relatedContent.length})
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {editingTask.relatedContent.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              borderRadius: '8px',
                              padding: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: item.messageId ? 'rgba(59, 130, 246, 0.15)' : 'var(--white-10)',
                              border: `1px solid ${item.messageId ? 'rgba(59, 130, 246, 0.3)' : 'var(--white-20)'}`
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                              {item.messageId ? (
                                <Link2 size={16} style={{ color: '#60a5fa', flexShrink: 0 }} />
                              ) : (
                                <FileText size={16} style={{ color: 'var(--white-50)', flexShrink: 0 }} />
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontWeight: 500,
                                  fontSize: '13px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  color: item.messageId ? '#93c5fd' : 'var(--white-80)'
                                }}>
                                  {item.reference}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--white-50)' }}>
                                  {item.messageId ? 'Linked to Matrix' : 'Text reference'}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveRelatedContent(item.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: '4px',
                                cursor: 'pointer',
                                color: 'var(--white-50)',
                                borderRadius: '4px',
                                flexShrink: 0
                              }}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      textAlign: 'center',
                      padding: '32px',
                      color: 'var(--white-50)',
                      border: '1px dashed var(--white-20)',
                      borderRadius: '12px'
                    }}>
                      <p style={{ fontSize: '13px' }}>No related content linked yet</p>
                      <p style={{ fontSize: '11px', marginTop: '4px' }}>Use the search above to add creatives</p>
                    </div>
                  )}
                </div>
              )}
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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileCode, Menu, Edit, AlertCircle, X, Code, Eye, Save, ChevronDown, AlertTriangle, ChevronLeft, ChevronRight, Moon, Grid, Sun, Type, Image, Video, Link, Tag, Palette, Filter, Check, GripVertical } from 'lucide-react';
import { apiGet, apiPost } from '../utils/api';
import TemplatePreview from './TemplatePreview';
import CodeEditor from './CodeEditor';
import TemplateClaudeChat from './TemplateClaudeChat';
import MatrixStatePanel from './MatrixStatePanel';
import { clearAndReloadApp } from '../utils/clearAndReload';
import BottomBar from './BottomBar';

const Templates = ({ onMenuToggle, currentModuleName, matrixData, lookAndFeel }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [saveProgress, setSaveProgress] = useState(null);

  // Check URL for edit mode: /templates/edit/{templateName}
  const pathParts = location.pathname.split('/');
  const isEditMode = pathParts[2] === 'edit';
  const urlTemplateName = isEditMode ? decodeURIComponent(pathParts[3] || '') : null;

  // Save with progress tracking
  const handleSaveWithProgress = async () => {
    const steps = [
      'Preparing data for save...',
      'Saving to spreadsheet...',
      'Finalizing save operation...',
      'Save complete!'
    ];

    try {
      for (let i = 0; i < steps.length; i++) {
        setSaveProgress({ step: i + 1, total: steps.length, message: steps[i] });
        if (i === 1 && matrixData?.handleSave) {
          await matrixData.handleSave();
        } else {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      setSaveProgress({ step: -1, message: 'Save failed: ' + error.message });
    } finally {
      setTimeout(() => setSaveProgress(null), 2000);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // Track if editor was ever opened (to distinguish initial mount from intentional close)
  const editorWasOpenedRef = useRef(false);

  // Auto-open editor when URL contains template name
  useEffect(() => {
    if (urlTemplateName && templates.length > 0 && !editingTemplate) {
      const template = templates.find(t => t.name === urlTemplateName);
      if (template) {
        editorWasOpenedRef.current = true;
        setEditingTemplate(template);
      }
    }
  }, [urlTemplateName, templates]);

  // Sync URL when editingTemplate changes (for closing)
  // Only navigate away if editor was previously open (not on initial mount)
  useEffect(() => {
    if (!editingTemplate && isEditMode && editorWasOpenedRef.current) {
      navigate('/templates', { replace: true });
    }
  }, [editingTemplate]);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await apiGet('/api/templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      setTemplates(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (template) => {
    // Update URL to reflect editing state
    navigate(`/templates/edit/${encodeURIComponent(template.name)}`);
    editorWasOpenedRef.current = true;
    setEditingTemplate(template);
  };

  const handleCloseEditor = () => {
    setEditingTemplate(null);
    // URL will be updated by the effect above
  };

  return (
    <div className="matrix-fullscreen" style={{ backgroundColor: 'var(--color-primary)' }}>
      {/* Content */}
      <div className="matrix-view-container">
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="flex items-center gap-3 mb-6">
              <FileCode size={32} className="text-purple-600" />
              <h2 className="text-xl font-bold text-gray-800">Template Management</h2>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Templates Table */}
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">
                Loading templates...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Available Dimensions</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Last Modified</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((template) => (
                      <tr key={template.name} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onDoubleClick={() => handleEdit(template)}>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleEdit(template)}
                            className="flex items-center gap-2 w-full text-left hover:opacity-70 transition-opacity"
                          >
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                              <FileCode size={16} className="text-purple-600" />
                            </div>
                            <span className="text-gray-900 font-medium">{template.name}</span>
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {template.dimensions.map((dim) => (
                              <span
                                key={dim}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {dim}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-sm">
                          {new Date(template.lastModified).toLocaleDateString()} {new Date(template.lastModified).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleEdit(template)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors text-sm"
                          >
                            <Edit size={16} />
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {templates.length === 0 && !isLoading && (
                  <div className="text-center py-8 text-gray-500">
                    No templates found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Template Editor Dialog */}
      {editingTemplate && (
        <TemplateEditor
          template={editingTemplate}
          onClose={handleCloseEditor}
          onSave={loadTemplates}
          messages={matrixData?.messages || []}
          textFormatting={matrixData?.textFormatting || []}
          lookAndFeel={lookAndFeel}
          matrixData={matrixData}
          saveProgress={saveProgress}
          onMatrixSave={handleSaveWithProgress}
          onClearReload={clearAndReloadApp}
        />
      )}

      {/* Bottom Bar — only when editor is NOT open (editor renders its own) */}
      {!editingTemplate && (
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
            activeTabs={[]}
            isFullyLoaded={matrixData?.isFullyLoaded}
          />
        </BottomBar>
      )}
    </div>
  );
};

// Template Editor Dialog Component
const TemplateEditor = ({ template, onClose, onSave, messages: messagesFromProps, textFormatting = [], lookAndFeel, matrixData, saveProgress, onMatrixSave, onClearReload }) => {
  // Ref for Claude Chat
  const claudeChatRef = useRef(null);

  // Status color helpers (same as MC editor)
  const defaultStatusColors = {
    INCOMING: '#8B5CF6', NAMING: '#F59E0B', CONTENT: '#EC4899',
    PREVIEW: '#3B82F6', APPROVED: '#10B981', ACTIVE: '#06B6D4',
    INACTIVE: '#9CA3AF', ERROR: '#EF4444', DEAD: '#64748B', MEMORY: '#06B6D4'
  };
  const statusColors = { ...defaultStatusColors, ...(lookAndFeel?.statusColors || {}) };
  const getStatusColor = (status) => {
    const s = (status || 'INCOMING').toUpperCase();
    return statusColors[s] || statusColors['INCOMING'] || '#8B5CF6';
  };
  const getTextColor = (hexColor) => {
    const hex = (hexColor || '#8B5CF6').replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#000000' : '#ffffff';
  };

  // Color presets for background picker
  const colorPresets = [
    lookAndFeel?.headerColor || '#2870ed',
    lookAndFeel?.secondaryColor1 || '#eb4c79',
    lookAndFeel?.secondaryColor2 || '#02a3a4',
    lookAndFeel?.secondaryColor3 || '#711c7a'
  ];

  // Find the last modified file to load initially
  const getInitialFile = () => {
    console.log('Template data:', template);
    console.log('Last modified file:', template.lastModifiedFile);
    console.log('Files with meta:', template.filesWithMeta);

    // If we have lastModifiedFile info, use it
    if (template.lastModifiedFile) {
      console.log('Using last modified file:', template.lastModifiedFile);
      return template.lastModifiedFile;
    }
    // Otherwise default to HTML file or first file
    const htmlFile = template.files?.find(f => f.endsWith?.('.html'));
    const result = htmlFile || (template.files && template.files[0]) || '';
    console.log('Falling back to:', result);
    return result;
  };

  const [selectedFile, setSelectedFile] = useState(getInitialFile());
  const [fileContent, setFileContent] = useState('');
  const [templateHtmlContent, setTemplateHtmlContent] = useState('');
  const [templateMainCss, setTemplateMainCss] = useState('');
  const [templateSizeCss, setTemplateSizeCss] = useState('');
  const [previewSize, setPreviewSize] = useState(() => {
    // Load from localStorage, fallback to first available dimension
    const saved = localStorage.getItem('templateEditor_previewSize');
    if (saved && template.dimensions?.includes(saved)) {
      return saved;
    }
    return template.dimensions && template.dimensions.length > 0
      ? template.dimensions[0]
      : '300x250';
  });
  const [defaultSizeLoaded, setDefaultSizeLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [placeholderMenuOpen, setPlaceholderMenuOpen] = useState(false);
  const [templateConfig, setTemplateConfig] = useState(null);
  const [jsonValid, setJsonValid] = useState(true);
  const [jsonError, setJsonError] = useState('');
  const [htmlValid, setHtmlValid] = useState(true);
  const [htmlWarnings, setHtmlWarnings] = useState([]);
  const [previewBackground, setPreviewBackground] = useState(() => {
    return localStorage.getItem('templateEditor_previewBg') || 'light';
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalContent, setOriginalContent] = useState('');

  // Skip animation state (persisted to localStorage)
  const [skipAnimation, setSkipAnimation] = useState(() => {
    const saved = localStorage.getItem('templateEditor_skipAnimation');
    return saved === 'true';
  });

  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);
  const [mcDropdownOpen, setMcDropdownOpen] = useState(false);

  // Persist skipAnimation to localStorage
  useEffect(() => {
    localStorage.setItem('templateEditor_skipAnimation', skipAnimation);
  }, [skipAnimation]);

  // Persist previewBackground
  useEffect(() => {
    localStorage.setItem('templateEditor_previewBg', previewBackground);
  }, [previewBackground]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!sizeDropdownOpen && !mcDropdownOpen) return;
      if (e.target.closest('.dropdown')) return;
      setSizeDropdownOpen(false);
      setMcDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sizeDropdownOpen, mcDropdownOpen]);

  // Draggable divider state
  const [splitRatio, setSplitRatio] = useState(() => {
    const saved = localStorage.getItem('templateEditor_splitRatio');
    return saved ? parseFloat(saved) : 0.5;
  });
  const isDraggingRef = useRef(false);
  const containerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('templateEditor_splitRatio', splitRatio);
  }, [splitRatio]);

  // Draggable placeholder panel width
  const [placeholderWidth, setPlaceholderWidth] = useState(() => {
    const saved = localStorage.getItem('templateEditor_placeholderWidth');
    return saved ? parseInt(saved, 10) : 384; // 384 = w-96
  });
  const placeholderDragRef = useRef(false);
  const previewPanelRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('templateEditor_placeholderWidth', placeholderWidth);
  }, [placeholderWidth]);

  const handlePlaceholderDragStart = useCallback((e) => {
    e.preventDefault();
    placeholderDragRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.querySelectorAll('iframe').forEach(f => { f.style.pointerEvents = 'none'; });

    const handleMouseMove = (e) => {
      if (!placeholderDragRef.current || !previewPanelRef.current) return;
      const rect = previewPanelRef.current.getBoundingClientRect();
      const w = rect.right - e.clientX;
      setPlaceholderWidth(Math.max(280, Math.min(rect.width * 0.85, w)));
    };

    const handleMouseUp = () => {
      placeholderDragRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.querySelectorAll('iframe').forEach(f => { f.style.pointerEvents = ''; });
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleDividerMouseDown = useCallback((e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const isWide = isWideFormatRef.current;
    document.body.style.cursor = isWide ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
    // Disable pointer events on iframes to prevent them from swallowing mouse events
    document.querySelectorAll('iframe').forEach(f => { f.style.pointerEvents = 'none'; });

    const handleMouseMove = (e) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let ratio;
      if (isWide) {
        // Vertical: preview on top (order 1), code on bottom (order 2)
        // splitRatio controls code size, so preview = 1 - splitRatio
        const y = e.clientY - rect.top;
        ratio = 1 - Math.max(0.2, Math.min(0.8, y / rect.height));
      } else {
        const x = e.clientX - rect.left;
        ratio = Math.max(0.2, Math.min(0.8, x / rect.width));
      }
      setSplitRatio(ratio);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.querySelectorAll('iframe').forEach(f => { f.style.pointerEvents = ''; });
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const [typeFilters, setTypeFilters] = useState({
    text: true,
    image: true,
    video: true,
    url: true,
    tag: true,
    style: true
  });

  // Filter to messages using this template, exclude deleted
  const messages = messagesFromProps.filter(m => m.status !== 'deleted' && m.template === template.name);

  // Sort messages for navigation
  const sortedMessages = messages.sort((a, b) => {
    if (a.number !== b.number) return a.number - b.number;
    return (a.variant || 'a').localeCompare(b.variant || 'a');
  });

  // Get unique card number + variant combinations
  const uniqueCards = [];
  const cardKeys = new Set();
  sortedMessages.forEach(msg => {
    const cardKey = `${msg.number}${msg.variant || ''}`;
    if (!cardKeys.has(cardKey)) {
      cardKeys.add(cardKey);
      uniqueCards.push(msg);
    }
  });

  // Load last selected message from localStorage, or use first message
  useEffect(() => {
    if (messages.length > 0 && !selectedMessage) {
      const savedMcId = localStorage.getItem('templateEditor_selectedMC');
      if (savedMcId) {
        // Parse saved MC ID (e.g., "1a" -> number=1, variant="a")
        const match = savedMcId.match(/^(\d+)([a-z]?)$/i);
        if (match) {
          const number = parseInt(match[1], 10);
          const variant = match[2]?.toLowerCase() || 'a';
          const message = messages.find(m =>
            m.number === number &&
            (m.variant || 'a').toLowerCase() === variant &&
            m.status !== 'deleted'
          );
          if (message) {
            setSelectedMessage(message);
            return;
          }
        }
      }
      // Fallback to first message if no saved or not found
      setSelectedMessage(messages[0]);
    }
  }, [messages]);

  // Save selectedMessage to localStorage when it changes
  useEffect(() => {
    if (selectedMessage) {
      const mcId = `${selectedMessage.number}${selectedMessage.variant || 'a'}`;
      localStorage.setItem('templateEditor_selectedMC', mcId);
    }
  }, [selectedMessage]);

  // Save previewSize to localStorage when it changes
  useEffect(() => {
    if (previewSize) {
      localStorage.setItem('templateEditor_previewSize', previewSize);
    }
  }, [previewSize]);

  // Navigation helpers
  const currentIndex = uniqueCards.findIndex(m => m.id === selectedMessage?.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < uniqueCards.length - 1;

  const handlePrevious = () => {
    if (hasPrevious) {
      setSelectedMessage(uniqueCards[currentIndex - 1]);
    } else {
      // Wrap around to last message
      setSelectedMessage(uniqueCards[uniqueCards.length - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      setSelectedMessage(uniqueCards[currentIndex + 1]);
    } else {
      // Wrap around to first message
      setSelectedMessage(uniqueCards[0]);
    }
  };

  // Load template config on mount
  useEffect(() => {
    loadTemplateConfig();
  }, []);

  // Load all template files for preview on mount
  useEffect(() => {
    loadTemplateForPreview();
  }, []);

  const loadTemplateConfig = async () => {
    try {
      const response = await apiGet(`/api/templates/${template.name}/template.json`);
      if (response.ok) {
        const data = await response.json();
        const config = JSON.parse(data.content);
        console.log('Loaded template config:', config);
        setTemplateConfig(config);

        // Set default size if specified in template.json and not already loaded
        if (config.default_size && !defaultSizeLoaded) {
          // Verify the default size exists in available dimensions
          if (template.dimensions && template.dimensions.includes(config.default_size)) {
            setPreviewSize(config.default_size);
            setDefaultSizeLoaded(true);
          }
        }
      } else {
        console.warn('No template.json found for template:', template.name);
      }
    } catch (err) {
      console.error('Error loading template config:', err);
      // If no template.json, will use default mappings
    }
  };

  // Load file content when selectedFile changes
  useEffect(() => {
    if (selectedFile) {
      loadFileContent();
    }
  }, [selectedFile]);

  // Validate JSON when content changes for JSON files
  useEffect(() => {
    if (selectedFile && selectedFile.endsWith('.json')) {
      try {
        JSON.parse(fileContent);
        setJsonValid(true);
        setJsonError('');
      } catch (err) {
        setJsonValid(false);
        setJsonError(err.message);
      }
    } else {
      setJsonValid(true);
      setJsonError('');
    }
  }, [fileContent, selectedFile]);

  // Validate HTML when content changes for HTML files
  useEffect(() => {
    if (selectedFile && selectedFile.endsWith('.html')) {
      const warnings = [];

      // Basic HTML validation checks
      const parser = new DOMParser();
      const doc = parser.parseFromString(fileContent, 'text/html');
      const parseErrors = doc.querySelector('parsererror');

      if (parseErrors) {
        warnings.push('HTML parsing error detected');
        setHtmlValid(false);
      } else {
        // Check for basic HTML structure
        if (!fileContent.includes('<!DOCTYPE') && !fileContent.includes('<!doctype')) {
          warnings.push('Missing DOCTYPE declaration');
        }
        if (!fileContent.match(/<html[^>]*>/i)) {
          warnings.push('Missing <html> tag');
        }
        if (!fileContent.match(/<head[^>]*>/i)) {
          warnings.push('Missing <head> tag');
        }
        if (!fileContent.match(/<body[^>]*>/i)) {
          warnings.push('Missing <body> tag');
        }

        // Check for unclosed tags (common ones)
        const openDivs = (fileContent.match(/<div[^>]*>/gi) || []).length;
        const closeDivs = (fileContent.match(/<\/div>/gi) || []).length;
        if (openDivs !== closeDivs) {
          warnings.push(`Mismatched <div> tags: ${openDivs} opening, ${closeDivs} closing`);
        }

        const openSpans = (fileContent.match(/<span[^>]*>/gi) || []).length;
        const closeSpans = (fileContent.match(/<\/span>/gi) || []).length;
        if (openSpans !== closeSpans) {
          warnings.push(`Mismatched <span> tags: ${openSpans} opening, ${closeSpans} closing`);
        }

        setHtmlValid(warnings.length === 0);
      }

      setHtmlWarnings(warnings);
    } else {
      setHtmlValid(true);
      setHtmlWarnings([]);
    }
  }, [fileContent, selectedFile]);

  // Detect changes in file content
  useEffect(() => {
    setHasUnsavedChanges(fileContent !== originalContent);
  }, [fileContent, originalContent]);

  // Load complete template HTML with CSS for preview (like message editor)
  const loadTemplateForPreview = async () => {
    try {
      // Find the HTML file and dimension-specific CSS
      const htmlFile = template.files.find(f => f.endsWith('.html'));
      const mainCssFile = 'main.css';
      const dimensionCssFile = `${previewSize}.css`;

      if (!htmlFile) return;

      // Load all necessary files
      const [htmlResponse, mainCssResponse, dimCssResponse] = await Promise.all([
        apiGet(`/api/templates/${template.name}/${htmlFile}`),
        apiGet(`/api/templates/${template.name}/${mainCssFile}`).catch(() => null),
        apiGet(`/api/templates/${template.name}/${dimensionCssFile}`).catch(() => null)
      ]);

      if (!htmlResponse.ok) throw new Error('Failed to load template HTML');

      const htmlData = await htmlResponse.json();
      setTemplateHtmlContent(htmlData.content);

      // Store CSS separately - TemplatePreview will handle injection
      if (mainCssResponse && mainCssResponse.ok) {
        const mainCssData = await mainCssResponse.json();
        setTemplateMainCss(mainCssData.content);
      } else {
        setTemplateMainCss('');
      }

      if (dimCssResponse && dimCssResponse.ok) {
        const dimCssData = await dimCssResponse.json();
        setTemplateSizeCss(dimCssData.content);
      } else {
        setTemplateSizeCss('');
      }
    } catch (err) {
      console.error('Error loading template for preview:', err);
    }
  };

  const loadFileContent = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await apiGet(`/api/templates/${template.name}/${selectedFile}?editor=1`);
      if (!response.ok) throw new Error('Failed to load file');
      const data = await response.json();
      setFileContent(data.content);
      setOriginalContent(data.content);
      setHasUnsavedChanges(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSuccess('');
      const response = await apiPost(`/api/templates/${template.name}/${selectedFile}`, {
        content: fileContent
      });
      if (!response.ok) throw new Error('Failed to save file');
      setSuccess('File updated successfully!');
      setOriginalContent(fileContent);
      setHasUnsavedChanges(false);

      // If template.json was updated, reload the config
      if (selectedFile === 'template.json') {
        await loadTemplateConfig();
      }

      // Refresh the template preview
      await loadTemplateForPreview();

      setTimeout(() => {
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut for save (Ctrl+S or Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Only save if there are changes and content is valid
        if (hasUnsavedChanges && (selectedFile && !selectedFile.endsWith('.json') || jsonValid)) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, jsonValid, selectedFile, handleSave]);

  // Reload template when preview size changes
  useEffect(() => {
    loadTemplateForPreview();
  }, [previewSize]);

  // Toggle type filter
  const toggleTypeFilter = (type) => {
    setTypeFilters(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  // Toggle all filters (select all / deselect all)
  const toggleAllFilters = () => {
    const activeCount = Object.values(typeFilters).filter(Boolean).length;
    const totalCount = Object.keys(typeFilters).length;

    // If more than half are selected, deselect all. Otherwise, select all
    const shouldSelectAll = activeCount <= totalCount / 2;

    setTypeFilters({
      text: shouldSelectAll,
      image: shouldSelectAll,
      video: shouldSelectAll,
      url: shouldSelectAll,
      tag: shouldSelectAll,
      style: shouldSelectAll
    });
  };

  // Helper function to get icon based on placeholder type
  const typeColorMap = {
    text: '#9ca3af', image: '#a855f7', video: '#ef4444',
    url: '#3b82f6', tag: '#22c55e', style: '#ec4899'
  };

  const getTypeIcon = (type, size = 14, colorOverride = null) => {
    const color = colorOverride || typeColorMap[type] || '#9ca3af';
    const iconStyle = { color };
    switch (type) {
      case 'text': return <Type size={size} style={iconStyle} />;
      case 'image': return <Image size={size} style={iconStyle} />;
      case 'video': return <Video size={size} style={iconStyle} />;
      case 'url': return <Link size={size} style={iconStyle} />;
      case 'tag': return <Tag size={size} style={iconStyle} />;
      case 'style': return <Palette size={size} style={iconStyle} />;
      default: return <Type size={size} style={iconStyle} />;
    }
  };

  // Extract placeholders from template and map to message fields
  const getPlaceholderMappings = () => {
    if (!templateHtmlContent || !selectedMessage) return [];

    // Extract all {{placeholder}} patterns
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const matches = [...templateHtmlContent.matchAll(placeholderRegex)];
    const uniquePlaceholders = [...new Set(matches.map(m => m[1]))];

    return uniquePlaceholders.map(placeholder => {
      if (templateConfig && templateConfig.placeholders && templateConfig.placeholders[placeholder]) {
        const config = templateConfig.placeholders[placeholder];
        const binding = config['binding-messagingmatrix'] || '';
        let value = '';
        let fieldFound = false;

        if (binding) {
          // Support both "message.Headline" and just "Headline" formats
          const fieldName = binding.replace(/^message\./i, '').toLowerCase();
          value = selectedMessage[fieldName];
          console.log(`Placeholder ${placeholder}: binding="${binding}" -> fieldName="${fieldName}" -> value="${value}"`);
          fieldFound = value !== undefined && value !== null && value !== '';
          if (!fieldFound) {
            value = config.default || '';
          }
        } else {
          // No binding specified
          value = config.default || '';
        }

        return {
          placeholder,
          binding: binding || 'Unknown',
          value: value,
          found: fieldFound,
          type: config.type
        };
      } else {
        // Placeholder not in template.json - fallback
        return {
          placeholder,
          binding: 'Unknown',
          value: '',
          found: false,
          type: 'text'
        };
      }
    });
  };

  // Calculate aspect ratio to determine layout orientation
  const [width, height] = previewSize.split('x').map(Number);
  const aspectRatio = width / height;
  const isWideFormat = aspectRatio >= 2.5; // Consider it wide if width is 2.5x or more than height
  const isWideFormatRef = useRef(isWideFormat);
  isWideFormatRef.current = isWideFormat;

  const getFilePreview = () => {
    // Determine background style based on selection
    let backgroundStyle = {};

    if (previewBackground === 'dark') {
      backgroundStyle = { backgroundColor: '#1f2937' };
    } else if (previewBackground === 'light') {
      backgroundStyle = { backgroundColor: '#ffffff' };
    } else if (previewBackground === 'checkboard') {
      backgroundStyle = {
        backgroundColor: '#f9fafb',
        backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
      };
    } else {
      // Custom color from color presets
      backgroundStyle = { backgroundColor: previewBackground };
    }

    // Always show complete template preview regardless of selected file
    return (
      <div
        className="w-full h-full flex items-center justify-center overflow-auto p-4 relative"
        style={backgroundStyle}
      >
        {templateHtmlContent ? (
          <TemplatePreview
            templateHtml={templateHtmlContent}
            message={selectedMessage ? {
              ...selectedMessage,
              template_variant_classes: skipAnimation
                ? (selectedMessage.template_variant_classes || '').replace(/\banimated\b/g, '').trim()
                : selectedMessage.template_variant_classes
            } : null}
            previewSize={previewSize}
            templateConfig={templateConfig}
            textFormatting={textFormatting}
            customMainCss={templateMainCss}
            customSizeCss={templateSizeCss}
            templateName={template.name}
            className="inline-block"
          />
        ) : (
          <div className="text-gray-500">Loading template preview...</div>
        )}
      </div>
    );
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-panel blue-dialog template-editor-dialog" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Dialog Header */}
        <div className="template-editor-header">
          <div className="template-editor-header-left">
            <h3 className="template-editor-title">Template Editor: {template.name}</h3>
            {/* Status messages */}
            {error && <span className="template-editor-status error">{error}</span>}
            {success && <span className="template-editor-status success">{success}</span>}
          </div>
          <div className="template-editor-header-right">
            {/* Size Selector — dropdown with shadow layers */}
            <div className={`dropdown ${sizeDropdownOpen ? 'open' : ''}`}>
              <button
                className="dropdown-trigger"
                onClick={() => { setSizeDropdownOpen(!sizeDropdownOpen); setMcDropdownOpen(false); }}
              >
                <span>{previewSize}</span>
                <ChevronDown size={16} />
              </button>
              <div className="dropdown-menu">
                {(template.dimensions && template.dimensions.length > 0
                  ? template.dimensions
                  : ['300x250', '300x600', '640x360', '970x250']
                ).map(dim => (
                  <div
                    key={dim}
                    className={`dropdown-item ${previewSize === dim ? 'selected' : ''}`}
                    onClick={() => { setPreviewSize(dim); setSizeDropdownOpen(false); }}
                  >
                    {dim}
                  </div>
                ))}
              </div>
            </div>
            {/* MC Navigation: < [indicator] > with dropdown */}
            <div className="dialog-nav" style={{ marginBottom: 0 }}>
              <button
                onClick={handlePrevious}
                disabled={messages.length === 0}
                className="dialog-nav-btn"
                title="Previous message"
              >
                <ChevronLeft size={16} />
              </button>
              <div className={`dropdown ${mcDropdownOpen ? 'open' : ''}`} style={{ flex: 1 }}>
                <button
                  className="dropdown-trigger"
                  onClick={() => { setMcDropdownOpen(!mcDropdownOpen); setSizeDropdownOpen(false); }}
                  disabled={messages.length === 0}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    backgroundColor: selectedMessage ? getStatusColor(selectedMessage.status) : undefined,
                    color: selectedMessage ? getTextColor(getStatusColor(selectedMessage.status)) : undefined
                  }}
                >
                  <span>{selectedMessage ? `MC${selectedMessage.number}${selectedMessage.variant || ''}` : 'No MC'}</span>
                  <ChevronDown size={14} />
                </button>
                <div className="dropdown-menu mc-dropdown-menu">
                  {uniqueCards.map((msg) => {
                    const sc = getStatusColor(msg.status);
                    const key = `${msg.number}${msg.variant || ''}`;
                    const isSelected = selectedMessage && `${selectedMessage.number}${selectedMessage.variant || ''}` === key;
                    return (
                      <div
                        key={msg.id}
                        className={`dropdown-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => { setSelectedMessage(msg); setMcDropdownOpen(false); }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: sc,
                            flexShrink: 0
                          }}
                        />
                        MC{msg.number}{msg.variant || ''}
                      </div>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={handleNext}
                disabled={messages.length === 0}
                className="dialog-nav-btn"
                title="Next message"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <button onClick={onClose} className="dialog-nav-btn" title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Main Content - Side by Side or Top to Bottom */}
        <div ref={containerRef} className={`flex-1 p-4 flex ${isWideFormat ? 'flex-col' : ''} overflow-hidden relative`}>
          {/* Slide-in File Menu */}
          <div
            className={`absolute top-0 left-0 bottom-0 w-96 z-10 transform transition-all duration-300 ease-in-out ${
              fileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            style={{ backgroundColor: 'var(--color-primary)', boxShadow: fileMenuOpen ? '8px 0 30px rgba(0,0,0,0.4), 4px 0 10px rgba(0,0,0,0.2)' : 'none' }}
          >
            <div className="flex items-center gap-2 p-4" style={{ borderBottom: '1px solid var(--white-10)' }}>
              <button
                onClick={() => setFileMenuOpen(false)}
                className="dialog-nav-btn"
                style={{ width: 28, height: 28 }}
                title="Close files panel"
              >
                <Menu size={14} />
              </button>
              <h4 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-white)' }}>
                Files
              </h4>
            </div>
            <div className="p-4 space-y-1 overflow-auto" style={{ maxHeight: 'calc(100% - 64px)' }}>
              {(template.filesWithMeta || template.files.map(f => ({ name: f }))).map((fileInfo) => {
                const fileName = typeof fileInfo === 'string' ? fileInfo : fileInfo.name;
                const fileDate = fileInfo.lastModified ? new Date(fileInfo.lastModified).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : null;

                return (
                  <button
                    key={fileName}
                    onClick={() => {
                      setSelectedFile(fileName);
                      setFileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded transition-colors text-sm"
                    style={{
                      color: 'var(--color-white)',
                      background: selectedFile === fileName ? 'var(--white-25)' : 'transparent',
                      fontWeight: selectedFile === fileName ? 600 : 400
                    }}
                    onMouseEnter={(e) => { if (selectedFile !== fileName) e.currentTarget.style.background = 'var(--white-10)'; }}
                    onMouseLeave={(e) => { if (selectedFile !== fileName) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{fileName}</span>
                      {fileDate && (
                        <span className="text-xs whitespace-nowrap" style={{ opacity: 0.6 }}>
                          {fileDate}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Overlay (click to close, no darkening) */}
          {fileMenuOpen && (
            <div
              className="absolute inset-0 z-5"
              onClick={() => setFileMenuOpen(false)}
            />
          )}

          {/* Code Editor */}
          <div className="overflow-hidden flex flex-col" style={{ order: isWideFormat ? 2 : 1, flex: `0 0 ${isWideFormat ? `${(1 - splitRatio) * 100}%` : `${splitRatio * 100}%`}` }}>
            <div className="template-editor-code-toolbar">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFileMenuOpen(true)}
                  className="dialog-nav-btn"
                  title="Select file"
                >
                  <Menu size={14} />
                </button>
                <span className="template-editor-filename">{selectedFile}</span>
                {hasUnsavedChanges && (
                  <span className="template-editor-status error">Unsaved</span>
                )}
                {selectedFile && selectedFile.endsWith('.json') && (
                  jsonValid ? (
                    <span className="template-editor-status success">Valid JSON</span>
                  ) : (
                    <span className="template-editor-status error" title={jsonError}>Invalid JSON</span>
                  )
                )}
                {selectedFile && selectedFile.endsWith('.html') && (
                  htmlValid ? (
                    <span className="template-editor-status success">Valid HTML</span>
                  ) : (
                    <span className="template-editor-status error" title={htmlWarnings.join(', ')}>HTML Warnings ({htmlWarnings.length})</span>
                  )
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving || (selectedFile && selectedFile.endsWith('.json') && !jsonValid)}
                className="dialog-nav-btn"
                style={{ width: 'auto', padding: '0 12px', gap: 6, display: 'flex', alignItems: 'center' }}
                title="Save file"
              >
                <Save size={14} />
                <span style={{ fontSize: '13px' }}>{isSaving ? 'Updating...' : 'Update'}</span>
              </button>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center h-full" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Loading...
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-hidden" style={{ borderRadius: '0 0 0 14px', backgroundColor: '#282c34' }}>
                  <CodeEditor
                    value={fileContent}
                    onChange={setFileContent}
                    language={
                      selectedFile.endsWith('.css') ? 'css' :
                      selectedFile.endsWith('.js') ? 'javascript' :
                      selectedFile.endsWith('.json') ? 'json' :
                      'html'
                    }
                    theme="dark"
                    className="border-0"
                  />
                </div>
                {/* HTML Warnings Panel */}
                {selectedFile && selectedFile.endsWith('.html') && htmlWarnings.length > 0 && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-800 mb-1">HTML Validation Warnings:</p>
                        <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                          {htmlWarnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                        <p className="text-xs text-amber-600 mt-1 italic">Note: You can still save despite these warnings</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Draggable Divider */}
          <div
            className={`template-editor-divider ${isWideFormat ? 'horizontal' : ''}`}
            onMouseDown={handleDividerMouseDown}
            style={{ order: 2 }}
          >
            <GripVertical size={12} style={isWideFormat ? { transform: 'rotate(90deg)' } : undefined} />
          </div>

          {/* Preview */}
          <div ref={previewPanelRef} className="flex-1 overflow-hidden flex flex-col relative" style={{ order: isWideFormat ? 1 : 3 }}>
            {/* Slide-in Placeholder Menu */}
            <div
              className={`absolute top-0 right-0 bottom-0 z-10 flex transform transition-all duration-300 ease-in-out ${
                placeholderMenuOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
              style={{ width: placeholderWidth, boxShadow: placeholderMenuOpen ? '-8px 0 30px rgba(0,0,0,0.4), -4px 0 10px rgba(0,0,0,0.2)' : 'none' }}
            >
              {/* Drag handle for resizing */}
              <div
                className="template-editor-divider"
                onMouseDown={handlePlaceholderDragStart}
                style={{ flexShrink: 0, backgroundColor: 'var(--color-primary)' }}
              >
                <GripVertical size={12} />
              </div>
              <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: 'var(--color-primary)' }}>
                <div className="p-4" style={{ borderBottom: '1px solid var(--white-10)', flexShrink: 0 }}>
                  <div className="flex items-center mb-3" style={{ justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                    <h4 className="font-semibold" style={{ color: 'var(--color-white)', marginRight: 'auto' }}>Placeholder Mappings</h4>
                    <button
                      onClick={() => setPlaceholderMenuOpen(false)}
                      className="dialog-nav-btn"
                      title="Close placeholder panel"
                    >
                      <Menu size={14} />
                    </button>
                  </div>
                  {/* Type Filter Switches */}
                  <div className="flex flex-wrap gap-1 items-center">
                    <Filter size={14} style={{ color: 'var(--white-50)' }} className="mr-1" />
                    {['text', 'image', 'video', 'url', 'tag', 'style'].map((type) => (
                      <button
                        key={type}
                        onClick={() => toggleTypeFilter(type)}
                        className="p-1.5 transition-colors rounded"
                        style={{
                          background: typeFilters[type] ? 'rgba(255,255,255,0.9)' : 'transparent',
                          border: 'none'
                        }}
                        title={`Toggle ${type} placeholders`}
                      >
                        {getTypeIcon(type, 14, typeFilters[type] ? typeColorMap[type] : '#ffffff')}
                      </button>
                    ))}
                    <span style={{ color: 'var(--white-20)' }} className="mx-1">|</span>
                    <button
                      onClick={toggleAllFilters}
                      className="px-2 py-1 text-xs font-medium rounded transition-colors"
                      style={{ color: 'var(--white-70)', background: 'transparent', border: 'none' }}
                      title={Object.values(typeFilters).filter(Boolean).length > Object.keys(typeFilters).length / 2 ? "Deselect all" : "Select all"}
                    >
                      {Object.values(typeFilters).filter(Boolean).length > Object.keys(typeFilters).length / 2 ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-2 flex-1 template-editor-scroll" style={{ overflowY: 'auto' }}>
                {getPlaceholderMappings()
                  .filter(({ type }) => typeFilters[type])
                  .map(({ placeholder, binding, value, found, type }) => (
                  <div key={placeholder} className="rounded p-2" style={{ background: 'var(--white-10)', borderLeft: `3px solid ${typeColorMap[type] || '#9ca3af'}` }}>
                    <div className="flex items-center gap-2 mb-1">
                      {getTypeIcon(type, 14, '#ffffff')}
                      <span className="text-xs font-mono" style={{ color: 'var(--white-50)' }}>{`{{${placeholder}}}`}</span>
                      <span style={{ color: 'var(--white-30)' }}>←</span>
                      {binding === 'Unknown' || !binding ? (
                        <>
                          <AlertTriangle size={12} style={{ color: '#fca5a5' }} />
                          <span className="text-xs font-semibold" style={{ color: '#fca5a5' }}>Unknown</span>
                        </>
                      ) : (
                        <span className="text-xs font-semibold" style={{ color: '#93c5fd' }}>{binding}</span>
                      )}
                    </div>
                    {binding !== 'Unknown' && binding && (
                      <div className="text-xs pl-1">
                        {found ? (
                          <div className="truncate" style={{ color: 'var(--white-80)' }} title={value}>
                            {value}
                          </div>
                        ) : (
                          <div className="italic" style={{ color: '#fbbf24' }}>
                            {value ? `Default: ${value}` : 'Not found'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {getPlaceholderMappings().filter(({ type }) => typeFilters[type]).length === 0 && (
                  <div className="text-center text-sm py-8" style={{ color: 'var(--white-50)' }}>
                    {getPlaceholderMappings().length === 0
                      ? 'No placeholders found in template'
                      : 'No placeholders match the selected filters'}
                  </div>
                )}
              </div>
              </div>
            </div>

            {/* Overlay (click to close, no darkening) */}
            {placeholderMenuOpen && (
              <div
                className="absolute inset-0 z-5"
                onClick={() => setPlaceholderMenuOpen(false)}
              />
            )}

            <div className="template-editor-code-toolbar">
              <div className="flex items-center gap-2">
                {/* Background Switcher */}
                <div className="template-editor-bg-switcher">
                  <button
                    onClick={() => setPreviewBackground('dark')}
                    className={`template-editor-bg-btn ${previewBackground === 'dark' ? 'active' : ''}`}
                    title="Dark background"
                  >
                    <Moon size={14} />
                  </button>
                  <button
                    onClick={() => setPreviewBackground('checkboard')}
                    className={`template-editor-bg-btn ${previewBackground === 'checkboard' ? 'active' : ''}`}
                    title="Checkboard background"
                  >
                    <Grid size={14} />
                  </button>
                  <button
                    onClick={() => setPreviewBackground('light')}
                    className={`template-editor-bg-btn ${previewBackground === 'light' ? 'active' : ''}`}
                    title="Light background"
                  >
                    <Sun size={14} />
                  </button>
                </div>
                {/* Color Presets */}
                <div className="flex items-center gap-1">
                  {colorPresets.map((color, index) => (
                    <button
                      key={index}
                      onClick={() => setPreviewBackground(color)}
                      className={`template-editor-color-preset ${previewBackground === color ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      title={index === 0 ? 'Primary Color' : `Secondary ${index}`}
                    />
                  ))}
                </div>
                {/* Skip Animation Toggle */}
                <button
                  className={`skip-animation-btn ${skipAnimation ? 'checked' : ''}`}
                  onClick={() => setSkipAnimation(!skipAnimation)}
                  title="Skip animation in preview"
                >
                  <span className="checkbox-box">
                    <Check size={12} />
                  </span>
                  Skip animation
                </button>
              </div>

              {/* Placeholder Menu Button */}
              <button
                onClick={() => setPlaceholderMenuOpen(true)}
                className="dialog-nav-btn"
                title="View placeholder mappings"
              >
                <Menu size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden" style={{ borderRadius: '0 0 14px 0' }}>
              {getFilePreview()}
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Bar — rendered via portal, same structure as Matrix module */}
      {createPortal(
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
            onSave={onMatrixSave}
            onClearReload={onClearReload}
            onRegenerateTopicKeys={matrixData?.regenerateTopicKeys}
            downloadFeedCSV={() => {}}
            changeTracking={matrixData?.changeTracking}
            originalState={matrixData?.originalState}
            activeTabs={[]}
            isFullyLoaded={matrixData?.isFullyLoaded}
          />
          <TemplateClaudeChat
            ref={claudeChatRef}
            templateName={template.name}
            templateFiles={template.files}
            currentFileContent={fileContent}
            currentFileName={selectedFile}
            onApplyCode={(code) => setFileContent(code)}
          />
        </BottomBar>,
        document.body
      )}
    </div>
  );
};

export default Templates;

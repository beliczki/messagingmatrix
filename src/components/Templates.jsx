import React, { useState, useEffect, useRef } from 'react';
import { FileCode, Menu, Edit, AlertCircle, X, Code, Eye, Save, ChevronDown, AlertTriangle, ChevronLeft, ChevronRight, Moon, Grid, Sun, Type, Image, Video, Link, Tag, Palette, Filter } from 'lucide-react';
import TemplatePreview from './TemplatePreview';
import CodeEditor from './CodeEditor';
import TemplateClaudeChat from './TemplateClaudeChat';
import PageHeader from './PageHeader';

const Templates = ({ onMenuToggle, currentModuleName, matrixData, lookAndFeel }) => {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTemplate, setEditingTemplate] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/templates');
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
    setEditingTemplate(template);
  };

  const handleCloseEditor = () => {
    setEditingTemplate(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <PageHeader onMenuToggle={onMenuToggle} title={currentModuleName || 'Templates'} lookAndFeel={lookAndFeel} />

      {/* Content */}
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

      {/* Template Editor Dialog */}
      {editingTemplate && (
        <TemplateEditor
          template={editingTemplate}
          onClose={handleCloseEditor}
          onSave={loadTemplates}
          messages={matrixData?.messages || []}
        />
      )}
    </div>
  );
};

// Template Editor Dialog Component
const TemplateEditor = ({ template, onClose, onSave, messages: messagesFromProps }) => {
  // Ref for Claude Chat
  const claudeChatRef = useRef(null);

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
  const [previewSize, setPreviewSize] = useState(() => {
    // Set initial preview size to first available dimension
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
  const [previewBackground, setPreviewBackground] = useState('light'); // 'dark', 'checkboard', 'light'
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalContent, setOriginalContent] = useState('');
  const [typeFilters, setTypeFilters] = useState({
    text: true,
    image: true,
    video: true,
    url: true,
    tag: true,
    style: true
  });

  // Filter out deleted messages
  const messages = messagesFromProps.filter(m => m.status !== 'deleted');

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

  // Select a random message initially
  useEffect(() => {
    if (messages.length > 0 && !selectedMessage) {
      const randomIndex = Math.floor(Math.random() * messages.length);
      setSelectedMessage(messages[randomIndex]);
    }
  }, [messages]);

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
      const response = await fetch(`/api/templates/${template.name}/template.json`);
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
        fetch(`/api/templates/${template.name}/${htmlFile}`),
        fetch(`/api/templates/${template.name}/${mainCssFile}`).catch(() => null),
        fetch(`/api/templates/${template.name}/${dimensionCssFile}`).catch(() => null)
      ]);

      if (!htmlResponse.ok) throw new Error('Failed to load template HTML');

      const htmlData = await htmlResponse.json();
      let htmlContent = htmlData.content;

      // Inject CSS into HTML
      let cssContent = '';
      if (mainCssResponse && mainCssResponse.ok) {
        const mainCssData = await mainCssResponse.json();
        cssContent += `<style>${mainCssData.content}</style>`;
      }
      if (dimCssResponse && dimCssResponse.ok) {
        const dimCssData = await dimCssResponse.json();
        cssContent += `<style>${dimCssData.content}</style>`;
      }

      // Insert CSS into head if present
      if (cssContent) {
        htmlContent = htmlContent.replace('</head>', `${cssContent}</head>`);
      }

      setTemplateHtmlContent(htmlContent);
    } catch (err) {
      console.error('Error loading template for preview:', err);
    }
  };

  const loadFileContent = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await fetch(`/api/templates/${template.name}/${selectedFile}`);
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
      const response = await fetch(`/api/templates/${template.name}/${selectedFile}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fileContent })
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
  const getTypeIcon = (type, size = 14, forceWhite = false) => {
    const colorClass = forceWhite ? 'text-white' :
      type === 'text' ? 'text-gray-500' :
      type === 'image' ? 'text-purple-600' :
      type === 'video' ? 'text-red-600' :
      type === 'url' ? 'text-blue-600' :
      type === 'tag' ? 'text-green-600' :
      type === 'style' ? 'text-pink-600' :
      'text-gray-500';

    switch (type) {
      case 'text':
        return <Type size={size} className={colorClass} />;
      case 'image':
        return <Image size={size} className={colorClass} />;
      case 'video':
        return <Video size={size} className={colorClass} />;
      case 'url':
        return <Link size={size} className={colorClass} />;
      case 'tag':
        return <Tag size={size} className={colorClass} />;
      case 'style':
        return <Palette size={size} className={colorClass} />;
      default:
        return <Type size={size} className={colorClass} />;
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

  const getFilePreview = () => {
    // Determine background style based on selection
    let backgroundClass = '';
    let backgroundStyle = {};

    if (previewBackground === 'dark') {
      backgroundClass = 'bg-gray-800';
    } else if (previewBackground === 'light') {
      backgroundClass = 'bg-white';
    } else { // checkboard
      backgroundClass = 'bg-gray-50';
      backgroundStyle = {
        backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
      };
    }

    // Always show complete template preview regardless of selected file
    return (
      <div
        className={`w-full h-full flex items-center justify-center overflow-auto p-4 rounded-lg border border-gray-300 ${backgroundClass}`}
        style={backgroundStyle}
      >
        {templateHtmlContent ? (
          <TemplatePreview
            templateHtml={templateHtmlContent}
            message={selectedMessage}
            previewSize={previewSize}
            templateConfig={templateConfig}
            className="inline-block"
          />
        ) : (
          <div className="text-gray-500">Loading template preview...</div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white shadow-xl w-full h-full max-w-7xl max-h-[90vh] flex flex-col relative overflow-hidden">
        {/* Dialog Header */}
        <div className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">Edit Template: {template.name}</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Messages */}
        {(error || success) && (
          <div className="px-6 pt-4 flex-shrink-0">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}
            {success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <Save size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-green-800 text-sm">{success}</p>
              </div>
            )}
          </div>
        )}

        {/* Main Content - Side by Side or Top to Bottom */}
        <div className={`flex-1 p-6 flex ${isWideFormat ? 'flex-col' : ''} gap-4 overflow-hidden relative`}>
          {/* Slide-in File Menu */}
          <div
            className={`absolute top-0 left-0 bottom-0 w-96 bg-white shadow-xl border-r z-10 transform transition-transform duration-300 ease-in-out ${
              fileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                <FileCode size={18} />
                Files
              </h4>
              <button
                onClick={() => setFileMenuOpen(false)}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-1 overflow-auto" style={{ maxHeight: 'calc(100% - 64px)' }}>
              {(template.filesWithMeta || template.files.map(f => ({ name: f }))).map((fileInfo) => {
                const fileName = typeof fileInfo === 'string' ? fileInfo : fileInfo.name;
                console.log('File info:', fileInfo);
                const fileDate = fileInfo.lastModified ? new Date(fileInfo.lastModified).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : null;
                console.log('File date:', fileDate);

                return (
                  <button
                    key={fileName}
                    onClick={() => {
                      setSelectedFile(fileName);
                      setFileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded transition-colors text-sm ${
                      selectedFile === fileName
                        ? 'bg-blue-600 text-white'
                        : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{fileName}</span>
                      {fileDate && (
                        <span className={`text-xs whitespace-nowrap ${selectedFile === fileName ? 'text-blue-100' : 'text-gray-500'}`}>
                          {fileDate}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Overlay */}
          {fileMenuOpen && (
            <div
              className="absolute inset-0 bg-black bg-opacity-30 z-5"
              onClick={() => setFileMenuOpen(false)}
            />
          )}

          {/* Code Editor */}
          <div className="flex-1 overflow-hidden flex flex-col" style={{ order: isWideFormat ? 2 : 1 }}>
            <div className="flex items-center justify-between gap-2 mb-2 py-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFileMenuOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  title="Select file"
                >
                  <Menu size={18} className="text-gray-600" />
                </button>
                <span className="text-sm font-medium text-blue-600">{selectedFile}</span>
                {hasUnsavedChanges && (
                  <span className="text-xs text-red-600 font-semibold">● Unsaved</span>
                )}
                <span className="text-gray-400">|</span>
                <h4 className="text-sm font-semibold text-gray-700">Code Editor</h4>
                {selectedFile && selectedFile.endsWith('.json') && (
                  <>
                    <span className="text-gray-400">|</span>
                    {jsonValid ? (
                      <span className="text-xs text-green-600 font-semibold">✓ Valid JSON</span>
                    ) : (
                      <span className="text-xs text-red-600 font-semibold" title={jsonError}>✗ Invalid JSON</span>
                    )}
                  </>
                )}
                {selectedFile && selectedFile.endsWith('.html') && (
                  <>
                    <span className="text-gray-400">|</span>
                    {htmlValid ? (
                      <span className="text-xs text-green-600 font-semibold">✓ Valid HTML</span>
                    ) : (
                      <span className="text-xs text-amber-600 font-semibold" title={htmlWarnings.join(', ')}>⚠ HTML Warnings ({htmlWarnings.length})</span>
                    )}
                  </>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving || (selectedFile && selectedFile.endsWith('.json') && !jsonValid)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <Save size={14} />
                {isSaving ? 'Updating...' : 'Update'}
              </button>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                Loading...
              </div>
            ) : (
              <>
                <div className={`flex-1 border rounded transition-colors overflow-hidden ${
                  hasUnsavedChanges ? 'border-blue-500' : 'border-gray-300'
                }`}>
                  <CodeEditor
                    value={fileContent}
                    onChange={setFileContent}
                    language={
                      selectedFile.endsWith('.css') ? 'css' :
                      selectedFile.endsWith('.json') ? 'json' :
                      'html'
                    }
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

          {/* Preview */}
          <div className="flex-1 overflow-hidden flex flex-col relative" style={{ order: isWideFormat ? 1 : 2 }}>
            {/* Slide-in Placeholder Menu */}
            <div
              className={`absolute top-0 right-0 bottom-0 w-96 bg-white shadow-xl border-l z-10 transform transition-transform duration-300 ease-in-out ${
                placeholderMenuOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-700">Placeholder Mappings</h4>
                  <button
                    onClick={() => setPlaceholderMenuOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    <X size={20} />
                  </button>
                </div>
                {/* Type Filter Switches */}
                <div className="flex flex-wrap gap-1 items-center">
                  <Filter size={14} className="text-gray-500 mr-1" />
                  <button
                    onClick={() => toggleTypeFilter('text')}
                    className={`p-1.5 transition-colors rounded border ${
                      typeFilters.text
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-400 border-gray-300'
                    }`}
                    title="Toggle text placeholders"
                  >
                    {getTypeIcon('text', 14, typeFilters.text)}
                  </button>
                  <button
                    onClick={() => toggleTypeFilter('image')}
                    className={`p-1.5 transition-colors rounded border ${
                      typeFilters.image
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-400 border-gray-300'
                    }`}
                    title="Toggle image placeholders"
                  >
                    {getTypeIcon('image', 14, typeFilters.image)}
                  </button>
                  <button
                    onClick={() => toggleTypeFilter('video')}
                    className={`p-1.5 transition-colors rounded border ${
                      typeFilters.video
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-400 border-gray-300'
                    }`}
                    title="Toggle video placeholders"
                  >
                    {getTypeIcon('video', 14, typeFilters.video)}
                  </button>
                  <button
                    onClick={() => toggleTypeFilter('url')}
                    className={`p-1.5 transition-colors rounded border ${
                      typeFilters.url
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-400 border-gray-300'
                    }`}
                    title="Toggle URL placeholders"
                  >
                    {getTypeIcon('url', 14, typeFilters.url)}
                  </button>
                  <button
                    onClick={() => toggleTypeFilter('tag')}
                    className={`p-1.5 transition-colors rounded border ${
                      typeFilters.tag
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-400 border-gray-300'
                    }`}
                    title="Toggle tag placeholders"
                  >
                    {getTypeIcon('tag', 14, typeFilters.tag)}
                  </button>
                  <button
                    onClick={() => toggleTypeFilter('style')}
                    className={`p-1.5 transition-colors rounded border ${
                      typeFilters.style
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-400 border-gray-300'
                    }`}
                    title="Toggle style placeholders"
                  >
                    {getTypeIcon('style', 14, typeFilters.style)}
                  </button>
                  <span className="text-gray-300 mx-1">|</span>
                  <button
                    onClick={toggleAllFilters}
                    className="px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded border border-gray-300 transition-colors"
                    title={Object.values(typeFilters).filter(Boolean).length > Object.keys(typeFilters).length / 2 ? "Deselect all" : "Select all"}
                  >
                    {Object.values(typeFilters).filter(Boolean).length > Object.keys(typeFilters).length / 2 ? "Deselect all" : "Select all"}
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-2 overflow-auto" style={{ maxHeight: 'calc(100% - 128px)' }}>
                {getPlaceholderMappings()
                  .filter(({ type }) => typeFilters[type])
                  .map(({ placeholder, binding, value, found, type }) => (
                  <div key={placeholder} className="bg-gray-50 rounded p-2 border border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      {getTypeIcon(type)}
                      <span className="text-xs font-mono text-gray-500">{`{{${placeholder}}}`}</span>
                      <span className="text-gray-400">←</span>
                      {binding === 'Unknown' || !binding ? (
                        <>
                          <AlertTriangle size={12} className="text-red-600" />
                          <span className="text-xs font-semibold text-red-600">Unknown</span>
                        </>
                      ) : (
                        <span className="text-xs font-semibold text-blue-600">{binding}</span>
                      )}
                    </div>
                    {binding !== 'Unknown' && binding && (
                      <div className="text-xs pl-1">
                        {found ? (
                          <div className="text-gray-700 truncate" title={value}>
                            {value}
                          </div>
                        ) : (
                          <div className="text-amber-600 italic">
                            {value ? `Default: ${value}` : 'Not found'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {getPlaceholderMappings().filter(({ type }) => typeFilters[type]).length === 0 && (
                  <div className="text-center text-gray-500 text-sm py-8">
                    {getPlaceholderMappings().length === 0
                      ? 'No placeholders found in template'
                      : 'No placeholders match the selected filters'}
                  </div>
                )}
              </div>
            </div>

            {/* Overlay */}
            {placeholderMenuOpen && (
              <div
                className="absolute inset-0 bg-black bg-opacity-30 z-5"
                onClick={() => setPlaceholderMenuOpen(false)}
              />
            )}

            <div className="flex items-center justify-between gap-3 mb-2">
              <h4 className="text-sm font-semibold text-gray-700">Template Preview</h4>
              <div className="flex items-center gap-2">
                {/* Background Switcher */}
                <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                  <button
                    onClick={() => setPreviewBackground('dark')}
                    className={`p-2 transition-colors ${
                      previewBackground === 'dark'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                    title="Dark background"
                  >
                    <Moon size={16} />
                  </button>
                  <button
                    onClick={() => setPreviewBackground('checkboard')}
                    className={`p-2 transition-colors border-x border-gray-300 ${
                      previewBackground === 'checkboard'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                    title="Checkboard background"
                  >
                    <Grid size={16} />
                  </button>
                  <button
                    onClick={() => setPreviewBackground('light')}
                    className={`p-2 transition-colors ${
                      previewBackground === 'light'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                    title="Light background"
                  >
                    <Sun size={16} />
                  </button>
                </div>

                {/* Message Navigation */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevious}
                    disabled={messages.length === 0}
                    className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Previous message"
                  >
                    <ChevronLeft size={16} className="text-gray-600" />
                  </button>

                  <div className="relative">
                    <select
                      value={selectedMessage ? `${selectedMessage.number}${selectedMessage.variant || ''}` : ''}
                      onChange={(e) => {
                        const cardKey = e.target.value;
                        const message = uniqueCards.find(m => `${m.number}${m.variant || ''}` === cardKey);
                        setSelectedMessage(message);
                      }}
                      disabled={messages.length === 0}
                      className="px-3 py-2 pr-8 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white text-sm"
                    >
                      {messages.length === 0 ? (
                        <option>No messages</option>
                      ) : (
                        uniqueCards.map((msg) => (
                          <option key={msg.id} value={`${msg.number}${msg.variant || ''}`}>
                            {msg.number}{msg.variant || ''}
                          </option>
                        ))
                      )}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>

                  <button
                    onClick={handleNext}
                    disabled={messages.length === 0}
                    className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Next message"
                  >
                    <ChevronRight size={16} className="text-gray-600" />
                  </button>
                </div>

                {/* Size Selector */}
                <select
                  value={previewSize}
                  onChange={(e) => setPreviewSize(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  {template.dimensions && template.dimensions.length > 0 ? (
                    template.dimensions.map((dimension) => (
                      <option key={dimension} value={dimension}>
                        {dimension}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="300x250">300x250</option>
                      <option value="300x600">300x600</option>
                      <option value="640x360">640x360</option>
                      <option value="970x250">970x250</option>
                    </>
                  )}
                </select>

                {/* Placeholder Menu Button */}
                <button
                  onClick={() => setPlaceholderMenuOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  title="View placeholder mappings"
                >
                  <Menu size={18} className="text-gray-600" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {getFilePreview()}
            </div>
          </div>
        </div>

        {/* Claude Chat for Template Editing */}
        <TemplateClaudeChat
          ref={claudeChatRef}
          templateName={template.name}
          templateFiles={template.files}
          currentFileContent={fileContent}
          currentFileName={selectedFile}
          onApplyCode={(code) => setFileContent(code)}
        />
      </div>
    </div>
  );
};

export default Templates;

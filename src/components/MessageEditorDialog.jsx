import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ChevronDown, AlertCircle, Loader, Trash2, Tag, CookingPot, Sparkles, PencilRuler, Rocket, Check, Type, ClipboardList, Calendar, ExternalLink, Search, Plus, Link2 } from 'lucide-react';
import AssetAutocomplete from './AssetAutocomplete';
import settings from '../services/settings';
import { generateTraffickingFields, generatePMMID } from '../utils/patternEvaluator';
import { applyTextFormattingSpans } from '../utils/textFormatter';
import { apiGet } from '../utils/api';

const MessageEditorDialog = ({
  editingMessage,
  setEditingMessage,
  audiences,
  topics,
  messages,
  updateMessage,
  deleteMessage,
  keywords,
  textFormatting = [],
  updateTextFormatting,
  previewSize,
  setPreviewSize,
  activeTab,
  setActiveTab,
  isGeneratingContent,
  handleGenerateContent,
  generatedVersions,
  onApplyField,
  selectedProducts = [],
  selectedStatuses = [],
  creatives = [],
  lookAndFeel,
  assets = []
}) => {
  // Compute trafficking fields automatically
  const computedTrafficking = useMemo(() => {
    if (!editingMessage) return {};

    try {
      const pmmid = generatePMMID(editingMessage, audiences, settings.getPattern('pmmid'));
      const trafficking = generateTraffickingFields(
        { ...editingMessage, pmmid },
        audiences,
        settings.getPattern('trafficking')
      );
      return trafficking;
    } catch (error) {
      console.error('Error computing trafficking fields:', error);
      return {};
    }
  }, [editingMessage, audiences]);

  // Template management state
  const [templates, setTemplates] = useState([]);
  const [templateConfig, setTemplateConfig] = useState(null);
  const [templateHtml, setTemplateHtml] = useState('');
  const [templateMainCss, setTemplateMainCss] = useState('');
  const [templateSizeCss, setTemplateSizeCss] = useState('');
  const [variantClassOptions, setVariantClassOptions] = useState([]);
  const [availableDimensions, setAvailableDimensions] = useState([]);
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(false);
  const [briefText, setBriefText] = useState('');

  // Load brief from JSON comment when message changes
  useEffect(() => {
    if (editingMessage?.comment) {
      try {
        const parsed = JSON.parse(editingMessage.comment);
        if (parsed.brief) {
          setBriefText(parsed.brief);
        }
      } catch {
        // Not JSON, ignore
      }
    }
  }, [editingMessage?.id]);

  // Related tasks state
  const [relatedTasks, setRelatedTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [taskSearch, setTaskSearch] = useState('');

  // Track original field values before AI preview changes
  const [originalFieldValues, setOriginalFieldValues] = useState(null);

  // Preview overrides - temporary values shown in preview without changing input
  const [previewOverrides, setPreviewOverrides] = useState({});

  // Track hovered line for showing action buttons
  const [hoveredLine, setHoveredLine] = useState(null);

  // Capture original values when generatedVersions first appears
  useEffect(() => {
    if (generatedVersions && !originalFieldValues && editingMessage) {
      setOriginalFieldValues({
        headline: editingMessage.headline || '',
        copy1: editingMessage.copy1 || '',
        copy2: editingMessage.copy2 || '',
        flash: editingMessage.flash || '',
        cta: editingMessage.cta || ''
      });
    }
    // Clear original values when generatedVersions is cleared
    if (!generatedVersions && originalFieldValues) {
      setOriginalFieldValues(null);
    }
  }, [generatedVersions, editingMessage, originalFieldValues]);

  // Fetch tasks and find those related to this message
  useEffect(() => {
    if (!editingMessage?.id) {
      setRelatedTasks([]);
      setAllTasks([]);
      return;
    }

    const fetchRelatedTasks = async () => {
      try {
        const response = await apiGet('/api/tasks');
        if (response.ok) {
          const data = await response.json();
          const tasks = data.tasks || [];
          setAllTasks(tasks);

          // Find tasks that reference this message in relatedContent or outputContent
          // v2 schema: relatedContent/outputContent are arrays of MC labels like ["MC282a", "MC283b"]
          const mcLabel = `MC${editingMessage.number || ''}${editingMessage.variant || ''}`;
          console.log('[MC Editor] Looking for tasks linked to MC:', mcLabel);

          const related = tasks.filter(task => {
            const relatedArr = task.relatedContent || [];
            const outputArr = task.outputContent || [];
            const inRelated = relatedArr.includes(mcLabel);
            const inOutput = outputArr.includes(mcLabel);
            if (inRelated || inOutput) {
              console.log('[MC Editor] Found related task:', task.id, {
                relatedContent: relatedArr,
                outputContent: outputArr
              });
            }
            return inRelated || inOutput;
          });

          console.log('[MC Editor] Total related tasks found:', related.length);
          setRelatedTasks(related);
        }
      } catch (error) {
        console.error('Error fetching tasks:', error);
        setRelatedTasks([]);
        setAllTasks([]);
      }
    };

    fetchRelatedTasks();
  }, [editingMessage?.id]);

  // Filter tasks for search (exclude already linked)
  const taskSearchResults = useMemo(() => {
    if (!taskSearch.trim() || taskSearch.length < 2) return [];

    const searchLower = taskSearch.toLowerCase();
    const relatedIds = new Set(relatedTasks.map(t => t.id));

    return allTasks
      .filter(task => !relatedIds.has(task.id))
      .filter(task => {
        const title = (task.title || '').toLowerCase();
        const description = (task.description || '').toLowerCase();
        // v2 schema: id is the task number now
        const tcNumber = task.id ? `tc${task.id}` : '';
        return title.includes(searchLower) ||
               description.includes(searchLower) ||
               tcNumber.includes(searchLower);
      })
      .slice(0, 5);
  }, [taskSearch, allTasks, relatedTasks]);

  // Link task to this MC (add to task's outputContent)
  // v2 schema: outputContent is array of MC labels like ["MC282a", "MC283b"]
  const linkTaskToMC = async (task) => {
    if (!editingMessage) return;

    const mcLabel = `MC${editingMessage.number || editingMessage.id}${editingMessage.variant || ''}`;

    // Check if already linked
    if ((task.outputContent || []).includes(mcLabel)) {
      console.log('Task already linked to this MC');
      return;
    }

    const updatedTask = {
      ...task,
      outputContent: [...(task.outputContent || []), mcLabel]
    };

    try {
      // Save to server
      const response = await apiGet('/api/tasks');
      if (response.ok) {
        const data = await response.json();
        const tasks = data.tasks || [];
        const updatedTasks = tasks.map(t => t.id === task.id ? updatedTask : t);

        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks: updatedTasks })
        });

        // Update local state
        setRelatedTasks(prev => [...prev, updatedTask]);
        setAllTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
        setTaskSearch('');
      }
    } catch (error) {
      console.error('Error linking task:', error);
    }
  };

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setEditingMessage(null);
      setIsClosing(false);
    }, 200); // Match animation duration
  }, [setEditingMessage]);

  // Keyboard shortcuts: ESC to close, Ctrl/Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && editingMessage) {
        handleClose();
      }
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && editingMessage) {
        e.preventDefault();
        updateMessage(editingMessage);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingMessage, handleClose, updateMessage]);

  // Skip animation state (persisted to localStorage)
  const [skipAnimation, setSkipAnimation] = useState(() => {
    const saved = localStorage.getItem('messageEditor_skipAnimation');
    return saved === 'true';
  });

  // Persist skipAnimation to localStorage
  useEffect(() => {
    localStorage.setItem('messageEditor_skipAnimation', skipAnimation);
  }, [skipAnimation]);

  // Status sync mode state (persisted to localStorage)
  const [statusSyncMode, setStatusSyncMode] = useState(() => {
    const saved = localStorage.getItem('messageEditor_statusSyncMode');
    return saved || 'all'; // 'all' or 'unique'
  });

  // Persist statusSyncMode to localStorage
  useEffect(() => {
    localStorage.setItem('messageEditor_statusSyncMode', statusSyncMode);
  }, [statusSyncMode]);

  // Auto-save state (persisted to localStorage)
  const [autoSave, setAutoSave] = useState(() => {
    const saved = localStorage.getItem('messageEditor_autoSave');
    return saved === 'true';
  });

  // Persist autoSave to localStorage
  useEffect(() => {
    localStorage.setItem('messageEditor_autoSave', autoSave);
  }, [autoSave]);

  // Track if this is the initial load to prevent auto-save on open
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Reset initial load flag when message changes
  useEffect(() => {
    setIsInitialLoad(true);
    const timer = setTimeout(() => setIsInitialLoad(false), 100);
    return () => clearTimeout(timer);
  }, [editingMessage?.id]);

  // Auto-save debounce timer ref
  const autoSaveTimerRef = useRef(null);

  // Event-based auto-save function (called from onChange handlers)
  const triggerAutoSave = useCallback((updatedMessage) => {
    if (!autoSave || !updatedMessage) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Debounce: wait 500ms before saving
    autoSaveTimerRef.current = setTimeout(() => {

      // Build all fields to save
      const allFields = {
        name: updatedMessage.name,
        number: updatedMessage.number,
        variant: updatedMessage.variant,
        status: updatedMessage.status,
        poms_id: updatedMessage.poms_id,
        start_date: updatedMessage.start_date,
        end_date: updatedMessage.end_date,
        template: updatedMessage.template,
        headline: updatedMessage.headline,
        copy1: updatedMessage.copy1,
        copy2: updatedMessage.copy2,
        disclaimer: updatedMessage.disclaimer,
        flash: updatedMessage.flash,
        cta: updatedMessage.cta,
        landingUrl: updatedMessage.landingUrl,
        template_variant_classes: updatedMessage.template_variant_classes,
        image1: updatedMessage.image1,
        image2: updatedMessage.image2,
        image3: updatedMessage.image3,
        image4: updatedMessage.image4,
        image5: updatedMessage.image5,
        image6: updatedMessage.image6,
        video1: updatedMessage.video1,
        comment: updatedMessage.comment,
        headline_style: updatedMessage.headline_style,
        copy1_style: updatedMessage.copy1_style,
        copy2_style: updatedMessage.copy2_style,
        disclaimer_style: updatedMessage.disclaimer_style,
        flash_style: updatedMessage.flash_style,
        cta_style: updatedMessage.cta_style,
        css: updatedMessage.css
      };

      // Update message in matrix state
      updateMessage(updatedMessage.id, allFields);

      // Find synced messages (same number + variant, different id)
      const variantCopies = messages.filter(m =>
        m.id !== updatedMessage.id &&
        m.number === updatedMessage.number &&
        m.variant === updatedMessage.variant &&
        m.status !== 'deleted'
      );

      // Sync to variant copies
      if (variantCopies.length > 0) {
        const excludeFields = [
          'audience', 'pmmid', 'id', 'version',
          'utm_campaign', 'utm_source', 'utm_medium', 'utm_content', 'utm_term', 'utm_cd26', 'final_trafficked_url'
        ];
        if (statusSyncMode === 'unique') {
          excludeFields.push('status');
        }

        const syncUpdates = Object.keys(allFields)
          .filter(key => !excludeFields.includes(key))
          .reduce((obj, key) => {
            obj[key] = allFields[key];
            return obj;
          }, {});

        variantCopies.forEach(syncedMsg => {
          updateMessage(syncedMsg.id, syncUpdates);
        });
      }
    }, 500);
  }, [autoSave, messages, updateMessage, statusSyncMode]);

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Helper: update field and trigger auto-save
  const updateField = useCallback((field, value) => {
    const updated = { ...editingMessage, [field]: value };
    setEditingMessage(updated);
    triggerAutoSave(updated);
  }, [editingMessage, triggerAutoSave]);

  // Helper: update multiple fields and trigger auto-save
  const updateFields = useCallback((updates) => {
    const updated = { ...editingMessage, ...updates };
    setEditingMessage(updated);
    triggerAutoSave(updated);
  }, [editingMessage, triggerAutoSave]);

  // Auto-save debounce timer ref for text formatting
  const textFormattingAutoSaveTimerRef = useRef(null);

  // Event-based auto-save for text formatting changes
  const triggerTextFormattingAutoSave = useCallback((updatedFormatting) => {
    if (!autoSave || !updateTextFormatting) return;

    // Clear existing timer
    if (textFormattingAutoSaveTimerRef.current) {
      clearTimeout(textFormattingAutoSaveTimerRef.current);
    }

    // Debounce: wait 120ms before saving
    textFormattingAutoSaveTimerRef.current = setTimeout(() => {
      updateTextFormatting(updatedFormatting);
    }, 120);
  }, [autoSave, updateTextFormatting]);

  // Cleanup text formatting auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (textFormattingAutoSaveTimerRef.current) {
        clearTimeout(textFormattingAutoSaveTimerRef.current);
      }
    };
  }, []);

  // Check if template is a non-HTML template (from keywords, not from templates folder)
  const isNonHtmlTemplate = useMemo(() => {
    const selectedTemplate = editingMessage?.template;
    if (!selectedTemplate) return false;
    // Check if template exists in HTML templates list
    const isHtmlTemplate = templates.some(t => t.name === selectedTemplate);
    return !isHtmlTemplate;
  }, [editingMessage?.template, templates]);

  // Helper functions for JSON comment structure
  const parseCommentJson = (comment) => {
    if (!comment) return { brief: '', generated: {} };
    try {
      const parsed = JSON.parse(comment);
      return {
        brief: parsed.brief || '',
        generated: parsed.generated || {}
      };
    } catch {
      // Not JSON, return empty structure
      return { brief: '', generated: {} };
    }
  };

  const updateCommentBrief = (newBrief) => {
    const current = parseCommentJson(editingMessage?.comment);
    current.brief = newBrief;
    updateField('comment', JSON.stringify(current, null, 2));
  };

  const addGeneratedToComment = (field, version) => {
    const current = parseCommentJson(editingMessage?.comment);
    if (!current.generated[field]) {
      current.generated[field] = [];
    }
    if (!current.generated[field].includes(version)) {
      current.generated[field].push(version);
    }
    updateField('comment', JSON.stringify(current, null, 2));
  };

  // Keep isAdobePSD for creative matching logic
  const isAdobePSD = editingMessage?.template === 'Adobe PSD';

  // Find matching creative for Adobe PSD templates
  const matchingCreative = useMemo(() => {
    if (!isAdobePSD || !editingMessage || !creatives?.length) return null;

    // Get MC number and variant from the message
    const mcNumber = editingMessage.number;
    const mcVariant = editingMessage.variant;

    // Find creative matching MC_Number, MC_Variant, and dimensions (previewSize)
    const match = creatives.find(c => {
      const matchesMC = String(c.MC_Number) === String(mcNumber);
      const matchesVariant = (c.MC_Variant || '').toLowerCase() === (mcVariant || '').toLowerCase();
      const matchesDimensions = c.File_dimensions === previewSize;

      return matchesMC && matchesVariant && matchesDimensions;
    });

    return match;
  }, [isAdobePSD, editingMessage?.number, editingMessage?.variant, previewSize, creatives]);

  // Track which formatting scope is selected for each field
  const [selectedFormattingScopes, setSelectedFormattingScopes] = useState({
    headline: 'default',
    copy1: 'default',
    copy2: 'default',
    flash: 'default',
    cta: 'default',
    disclaimer: 'default'
  });

  // Text formatting data structure - stores formatted variants
  const [textFormattingData, setTextFormattingData] = useState({
    headline: {},
    copy1: {},
    copy2: {},
    flash: {},
    cta: {},
    disclaimer: {}
  });

  // Track which fields are in "add mode" (showing scope buttons)
  const [formattingAddMode, setFormattingAddMode] = useState({
    headline: false,
    copy1: false,
    copy2: false,
    flash: false,
    cta: false,
    disclaimer: false
  });

  // Track edited values per field and scope
  const [editedFormattingValues, setEditedFormattingValues] = useState({});

  // Track which field/scope is currently saving
  const [savingFormatting, setSavingFormatting] = useState({ fieldName: null, scope: null });

  // Track which formatting dropdown is open (only one at a time)
  const [openFormattingDropdown, setOpenFormattingDropdown] = useState(null);

  // Sync warning state
  const [syncWarningVisible, setSyncWarningVisible] = useState(true);
  const [syncWarningCountdown, setSyncWarningCountdown] = useState(3);
  const [syncWarningPaused, setSyncWarningPaused] = useState(false);

  // Auto-hide sync warning after 3 seconds
  useEffect(() => {
    if (!syncWarningVisible || syncWarningPaused || syncWarningCountdown <= 0) return;

    const timer = setTimeout(() => {
      setSyncWarningCountdown(prev => {
        if (prev <= 1) {
          setSyncWarningVisible(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [syncWarningVisible, syncWarningCountdown, syncWarningPaused]);

  // Reset sync warning when switching messages
  useEffect(() => {
    setSyncWarningVisible(true);
    setSyncWarningCountdown(3);
    setSyncWarningPaused(false);
  }, [editingMessage?.id]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Check if any dropdown is open
      const hasOpenDropdown = sizeDropdownOpen || templateDropdownOpen || openFormattingDropdown;
      if (!hasOpenDropdown) return;

      // Check if click was inside a dropdown
      const clickedDropdown = e.target.closest('.dropdown');
      if (clickedDropdown) return;

      // Close all dropdowns
      setSizeDropdownOpen(false);
      setTemplateDropdownOpen(false);
      setOpenFormattingDropdown(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sizeDropdownOpen, templateDropdownOpen, openFormattingDropdown]);

  // Get new formatting entries to pass to parent for saving to matrix state
  const getNewFormattingEntries = () => {
    // Find the max existing ID
    const maxId = textFormatting.reduce((max, rule) => {
      const id = parseInt(rule.id, 10);
      return isNaN(id) ? max : Math.max(max, id);
    }, 0);

    let nextId = maxId + 1;

    const newEntries = Object.entries(editedFormattingValues)
      .filter(([key, data]) => key.includes(':new:') && data.text)
      .map(([key, data]) => {
        const fieldName = key.split(':')[0];
        const originalText = editingMessage?.[fieldName] || '';
        const scopes = data.scopes || ['All sizes'];
        const scopeArray = scopes.includes('All sizes') ? [] : scopes;
        const mcScope = data.isGlobal ? '' : `${editingMessage?.number || ''}${editingMessage?.variant || ''}`;

        return {
          id: String(nextId++),
          text_original: originalText,
          text_formatted: data.text,
          formatting_scope: scopeArray,
          formatting_mc_scope: mcScope
        };
      });
    return newEntries;
  };

  // Merge existing text formatting with new entries for real-time preview
  const mergedTextFormatting = useMemo(() => {
    const merged = [...(textFormatting || [])];

    // Add new formatting entries from editedFormattingValues
    Object.entries(editedFormattingValues).forEach(([key, data]) => {
      if (key.includes(':new:') && data.text) {
        // Extract field name from key (e.g., "headline:new:12345" -> "headline")
        const fieldName = key.split(':')[0];
        const originalText = editingMessage?.[fieldName] || '';
        const scopes = data.scopes || ['All sizes'];
        // Pass as array for textFormatter (empty array = all sizes)
        const scopeArray = scopes.includes('All sizes') ? [] : scopes;
        const mcScope = data.isGlobal !== false ? '' : `${editingMessage?.number || ''}${editingMessage?.variant || ''}`;

        merged.push({
          id: key,
          text_original: originalText,
          text_formatted: data.text,
          formatting_scope: scopeArray,
          formatting_mc_scope: mcScope
        });
      }
    });

    return merged;
  }, [textFormatting, editedFormattingValues, editingMessage]);

  // Get formatting rules for a specific text
  const getFormattingRulesForText = (text) => {
    if (!text || !textFormatting || textFormatting.length === 0) return [];
    return textFormatting.filter(rule => rule.text_original === text);
  };

  // Get all available scopes for a field - always show all scopes when formatting exists
  const getAvailableScopes = (fieldName) => {
    const text = editingMessage?.[fieldName];
    const rules = getFormattingRulesForText(text);

    // If no formatting rules, return empty (don't show scopes)
    if (rules.length === 0) return [];

    // Always return all scopes when formatting exists
    return ['default', '300x250', '300x600', '640x360', '970x250', '1080x1080', 'allSizes'];
  };

  // Check if a specific scope has custom formatting (different from default)
  const scopeHasCustomFormatting = (fieldName, scope) => {
    if (scope === 'default') return false;

    const text = editingMessage?.[fieldName];
    const rules = getFormattingRulesForText(text);

    if (scope === 'allSizes') {
      return rules.some(rule => !rule.formatting_scope || rule.formatting_scope.length === 0);
    }

    return rules.some(rule => rule.formatting_scope && rule.formatting_scope.includes(scope));
  };

  // Get the formatted text for a specific scope
  const getFormattedTextForScope = (fieldName, scope) => {
    const text = editingMessage?.[fieldName];
    if (!text) return '';
    if (scope === 'default') return text;

    const rules = getFormattingRulesForText(text);

    if (scope === 'allSizes') {
      const allSizesRule = rules.find(rule => !rule.formatting_scope || rule.formatting_scope.length === 0);
      return allSizesRule ? allSizesRule.text_formatted : text;
    }

    const scopeRule = rules.find(rule =>
      rule.formatting_scope && rule.formatting_scope.includes(scope)
    );
    return scopeRule ? scopeRule.text_formatted : text;
  };

  // Toggle add mode for a field
  const toggleAddMode = (fieldName) => {
    setFormattingAddMode(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }));
  };

  // Load templates list
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await apiGet('/api/templates');
        if (response.ok) {
          const data = await response.json();
          setTemplates(data);
        }
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    };
    loadTemplates();
  }, []);

  // Load template config when template changes
  useEffect(() => {
    const loadTemplateConfig = async () => {
      if (!editingMessage?.template) {
        setTemplateConfig(null);
        setVariantClassOptions([]);
        return;
      }

      try {
        const response = await apiGet(`/api/templates/${editingMessage.template}/template.json`);
        if (response.ok) {
          const data = await response.json();
          const config = JSON.parse(data.content);
          setTemplateConfig(config);

          // Find placeholder bound to Template_variant_classes
          const variantPlaceholder = Object.values(config.placeholders || {}).find(
            p => p['binding-messagingmatrix']?.replace(/_/g, ' ').toLowerCase() === 'template variant classes'
          );

          if (variantPlaceholder && variantPlaceholder.options) {
            // Parse comma-separated options
            const options = variantPlaceholder.options.split(',').map(o => o.trim()).filter(o => o);
            setVariantClassOptions(options);
          } else {
            setVariantClassOptions([]);
          }
        }
      } catch (error) {
        console.error('Error loading template config:', error);
        setTemplateConfig(null);
        setVariantClassOptions([]);
      }
    };

    loadTemplateConfig();
  }, [editingMessage?.template]);

  // Load template HTML when template changes
  useEffect(() => {
    const loadTemplateHtml = async () => {
      if (!editingMessage?.template) {
        setTemplateHtml('');
        return;
      }

      try {
        const response = await apiGet(`/api/templates/${editingMessage.template}/index.html`);
        if (response.ok) {
          const data = await response.json();
          setTemplateHtml(data.content);
        }
      } catch (error) {
        console.error('Error loading template HTML:', error);
        setTemplateHtml('');
      }
    };

    loadTemplateHtml();
  }, [editingMessage?.template]);

  // Load template CSS (main.css) when template changes
  useEffect(() => {
    const loadTemplateCss = async () => {
      if (!editingMessage?.template) {
        setTemplateMainCss('');
        return;
      }

      try {
        const response = await apiGet(`/api/templates/${editingMessage.template}/main.css`);
        if (response.ok) {
          const data = await response.json();
          setTemplateMainCss(data.content);
        } else {
          setTemplateMainCss('');
        }
      } catch (error) {
        console.error('Error loading template main CSS:', error);
        setTemplateMainCss('');
      }
    };

    loadTemplateCss();
  }, [editingMessage?.template]);

  // Load size-specific CSS when template or size changes
  useEffect(() => {
    const loadSizeCss = async () => {
      if (!editingMessage?.template || !previewSize) {
        setTemplateSizeCss('');
        return;
      }

      try {
        const response = await apiGet(`/api/templates/${editingMessage.template}/${previewSize}.css`);
        if (response.ok) {
          const data = await response.json();
          setTemplateSizeCss(data.content);
        } else {
          setTemplateSizeCss('');
        }
      } catch (error) {
        console.error('Error loading template size CSS:', error);
        setTemplateSizeCss('');
      }
    };

    loadSizeCss();
  }, [editingMessage?.template, previewSize]);

  // Load available dimensions when template changes
  useEffect(() => {
    if (!editingMessage?.template) {
      setAvailableDimensions([]);
      return;
    }

    // Handle Adobe PSD templates - get dimensions from matching creatives
    if (editingMessage.template === 'Adobe PSD') {
      const mcNumber = editingMessage.number;
      const mcVariant = editingMessage.variant;

      // Find all creatives that match this MC number and variant
      const matchingCreatives = creatives.filter(c => {
        const matchesMC = String(c.MC_Number) === String(mcNumber);
        const matchesVariant = (c.MC_Variant || '').toLowerCase() === (mcVariant || '').toLowerCase();
        return matchesMC && matchesVariant && c.File_dimensions;
      });

      // Get unique dimensions from matching creatives
      const dimensions = [...new Set(matchingCreatives.map(c => c.File_dimensions))].sort();

      setAvailableDimensions(dimensions);

      // If current previewSize is not in the available dimensions, reset to first available
      if (dimensions.length > 0 && !dimensions.includes(previewSize)) {
        setPreviewSize(dimensions[0]);
      }
      return;
    }

    // Find the template in the already-loaded templates array
    const selectedTemplate = templates.find(t => t.name === editingMessage.template);

    if (selectedTemplate && selectedTemplate.dimensions) {
      setAvailableDimensions(selectedTemplate.dimensions);

      // If current previewSize is not in the available dimensions, reset to first available or default
      if (selectedTemplate.dimensions.length > 0 && !selectedTemplate.dimensions.includes(previewSize)) {
        setPreviewSize(selectedTemplate.dimensions[0]);
      }
    } else {
      setAvailableDimensions([]);
    }
  }, [editingMessage?.template, editingMessage?.number, editingMessage?.variant, templates, creatives]);

  if (!editingMessage && !isClosing) return null;

  // Helper function to build full image URL using template.json path-messagingmatrix parameter
  const buildImageUrl = (imageKey, filename) => {
    if (!filename) return '';
    // If filename already starts with http:// or https://, use it as-is
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename;
    }

    // Map image keys to placeholder names in template.json
    const placeholderMap = {
      'image1': 'background_image_1',
      'image2': 'background_image_2',
      'image3': 'background_image_3',
      'image4': 'background_image_4',
      'image5': 'brand_image_1',
      'image6': 'sticker_image_1',
      'video1': 'background_video_1'
    };

    // Get the placeholder name for this image key
    const placeholderName = placeholderMap[imageKey.toLowerCase()];

    // Try to get path from template config first
    if (templateConfig && placeholderName && templateConfig.placeholders) {
      const placeholder = templateConfig.placeholders[placeholderName];
      if (placeholder && placeholder['path-messagingmatrix']) {
        return placeholder['path-messagingmatrix'] + filename;
      }
    }

    // Fallback to settings imageBaseUrls if template config doesn't have the path
    const imageBaseUrls = settings.getImageBaseUrls();
    return (imageBaseUrls[imageKey] || '') + filename;
  };

  // Generate preview HTML dynamically from template files
  const generatePreviewHtml = () => {
    // Handle Adobe PSD templates - show creative image from library
    if (isAdobePSD) {
      if (matchingCreative) {
        // Use proxy URL for the creative image
        const imageUrl = matchingCreative.File_driveID
          ? `/api/drive/proxy/${matchingCreative.File_driveID}`
          : matchingCreative.File_DirectLink;

        return `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #f0f0f0;
    }
    img {
      max-width: 100%;
      max-height: 100vh;
      object-fit: contain;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
  </style>
</head>
<body>
  <img src="${imageUrl}" alt="${matchingCreative.File_name}" />
</body>
</html>`;
      } else {
        // No matching creative found
        return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #666;
      text-align: center;
      padding: 20px;
    }
    .icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
    .message { font-size: 14px; margin-bottom: 8px; }
    .details { font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="icon">🎨</div>
  <div class="message">No matching creative found</div>
  <div class="details">Looking for MC${editingMessage?.number || '?'}${editingMessage?.variant || ''} @ ${previewSize}</div>
  <div class="details" style="margin-top: 8px;">Upload matching creative to Creative Library</div>
</body>
</html>`;
      }
    }

    // Return empty if no template HTML is loaded yet
    if (!templateHtml) {
      return '<html><body><div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#999;">Loading template...</div></body></html>';
    }

    // Start with the loaded template HTML
    let html = templateHtml;

    // Inject CSS by replacing <link> tags with <style> tags
    // Use dynamically loaded CSS from the selected template
    if (templateMainCss || templateSizeCss) {
      const combinedCss = `${templateMainCss}\n${templateSizeCss}`;

      // Replace main.css link
      html = html.replace(
        /<link rel="stylesheet" href="main\.css".*?>/i,
        `<style>${combinedCss}</style>`
      );

      // Remove [[css]] placeholder link
      html = html.replace(
        /<link rel="stylesheet" href="\[\[css\]\]".*?>/i,
        ''
      );
    }

    // Populate template with message data using template.json bindings
    const templateName = editingMessage.template || 'html';
    if (templateConfig && templateConfig.placeholders) {
      Object.keys(templateConfig.placeholders).forEach(placeholderName => {
        const config = templateConfig.placeholders[placeholderName];
        const binding = config['binding-messagingmatrix'];
        let value = config.default || '';

        if (binding) {
          // Convert binding to message field name (e.g., "message.Headline" -> "headline")
          const fieldName = binding.replace(/^message\./i, '').toLowerCase();

          // Text fields that should get span-based formatting
          const textFields = ['headline', 'copy1', 'copy2', 'flash', 'cta', 'disclaimer'];

          // Build message identifiers for MC scope matching
          const msgIdentifiers = {
            id: String(editingMessage.id),
            poms_id: editingMessage.poms_id,
            name: editingMessage.name,
            number: String(editingMessage.number || ''),
            variant: editingMessage.variant || '',
            numberVariant: `${editingMessage.number || ''}${editingMessage.variant || ''}`
          };

          // Map message fields to values (including style fields and span-formatted text)
          // Use mergedTextFormatting for real-time preview of new formatting entries
          // Use previewOverrides to show AI generated content without changing input
          const getFieldValue = (field) => {
            const value = previewOverrides[field] !== undefined ? previewOverrides[field] : editingMessage[field];
            if (textFields.includes(field) && value) {
              return applyTextFormattingSpans(value, mergedTextFormatting, msgIdentifiers);
            }
            return value;
          };

          const fieldMap = {
            'headline': getFieldValue('headline'),
            'copy1': getFieldValue('copy1'),
            'copy2': getFieldValue('copy2'),
            'flash': getFieldValue('flash'),
            'cta': getFieldValue('cta'),
            'disclaimer': getFieldValue('disclaimer'),
            'image1': editingMessage.image1,
            'image2': editingMessage.image2,
            'image3': editingMessage.image3,
            'image4': editingMessage.image4,
            'image5': editingMessage.image5,
            'image6': editingMessage.image6,
            'video1': editingMessage.video1,
            'template_variant_classes': skipAnimation
              ? (editingMessage.template_variant_classes || '').replace(/\banimated\b/g, '').trim()
              : editingMessage.template_variant_classes,
            // Style fields
            'headline_style': editingMessage.headline_style,
            'copy1_style': editingMessage.copy1_style,
            'copy2_style': editingMessage.copy2_style,
            'flash_style': editingMessage.flash_style,
            'cta_style': editingMessage.cta_style,
            'disclaimer_style': editingMessage.disclaimer_style,
            // CSS field
            'css_styles': editingMessage.css,
            'css': editingMessage.css
          };

          value = fieldMap[fieldName] || value;

          // Use path-messagingmatrix for images and videos
          if ((config.type === 'image' || config.type === 'video') && value) {
            const pathPrefix = config['path-messagingmatrix'] || '';
            // If value is already a full URL, use it as-is
            if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) {
              // If it starts with /, it's a relative path, so prepend the path prefix if available
              if (value.startsWith('/') && pathPrefix) {
                value = pathPrefix + value;
              } else if (!value.startsWith('http') && pathPrefix) {
                value = pathPrefix + value;
              }
            } else {
              // It's a file ID or filename, prepend the path
              value = pathPrefix + value;
            }
          }
        }

        // Replace placeholder in HTML
        const regex = new RegExp(`\\{\\{${placeholderName}\\}\\}`, 'g');
        html = html.replace(regex, value || '');
      });
    }

    // Clean up any remaining placeholders
    html = html.replace(/\{\{[^}]+\}\}/g, '');
    html = html.replace(/\[\[[^\]]+\]\]/g, '');

    // Fix any remaining hardcoded empty.png references in template HTML
    html = html.replace(
      /url\(['"]?empty\.png['"]?\)/gi,
      `url('/api/templates/${templateName}/empty.png')`
    );
    html = html.replace(
      /src=['"]empty\.png['"]/gi,
      `src="/api/templates/${templateName}/empty.png"`
    );

    // Add size class to body tag for CSS-based text formatting
    // Handle both cases: body with existing class and body without class
    if (/<body[^>]*class=/i.test(html)) {
      // Body already has a class attribute - append to it
      html = html.replace(/<body([^>]*class=["'])([^"']*)(['"'][^>]*)>/i, `<body$1$2 size-${previewSize}$3>`);
    } else {
      // Body has no class attribute - add one
      html = html.replace(/<body([^>]*)>/i, `<body$1 class="size-${previewSize}">`);
    }

    // Add CSS for text formatting visibility
    // Note: When scoped rules exist, text-{size} spans are generated for all sizes
    // When all-sizes rule exists, only text-allSizes span is generated
    // So we don't need to worry about conflicts between them
    const textFormattingCSS = `
      <style>
        /* Text formatting - hide all spans by default */
        .text-default, .text-allSizes, .text-300x250, .text-300x600, .text-640x360, .text-970x250, .text-1080x1080 {
          display: none;
        }
        /* Show default text when no size class on body */
        .text-default { display: inline; }
        /* When body has size class, hide default and show formatted text */
        body[class*="size-"] .text-default { display: none; }
        body[class*="size-"] .text-allSizes { display: inline; }
        body.size-300x250 .text-300x250 { display: inline; }
        body.size-300x600 .text-300x600 { display: inline; }
        body.size-640x360 .text-640x360 { display: inline; }
        body.size-970x250 .text-970x250 { display: inline; }
        body.size-1080x1080 .text-1080x1080 { display: inline; }
      </style>
    `;
    // Inject CSS into head
    html = html.replace(/<\/head>/i, `${textFormattingCSS}</head>`);

    return html;
  };

  // Get filtered messages for navigation (only those visible in matrix)
  const filteredMessages = messages
    .filter(m => {
      // Filter out deleted messages
      if (m.status === 'deleted') return false;

      // Get audience for this message to check product filter
      const audience = audiences.find(a => a.key === m.audience);

      // Filter by product if products are selected
      // Messages with no product (empty/undefined) pass through all product filters
      if (selectedProducts.length > 0 && audience) {
        if (audience.product && !selectedProducts.includes(audience.product)) {
          return false;
        }
      }

      // Filter by status if statuses are selected
      if (selectedStatuses.length > 0) {
        const messageStatus = (m.status || 'INCOMING').toUpperCase();
        if (!selectedStatuses.includes(messageStatus)) {
          return false;
        }
      }

      return true;
    });

  // Group by unique variant (number + variant) and keep only one representative per variant
  const variantMap = new Map();
  filteredMessages.forEach(m => {
    const variantKey = `${m.number}-${m.variant || 'a'}`;
    if (!variantMap.has(variantKey)) {
      variantMap.set(variantKey, m);
    }
  });

  // Always include the current editing message so navigation works even when filtered out
  const currentVariantKey = `${editingMessage.number}-${editingMessage.variant || 'a'}`;
  if (!variantMap.has(currentVariantKey)) {
    variantMap.set(currentVariantKey, editingMessage);
  }

  // Get unique variants sorted by number and variant
  const uniqueVariants = Array.from(variantMap.values())
    .sort((a, b) => {
      // Sort by number first, then by variant
      if (a.number !== b.number) return a.number - b.number;
      return (a.variant || 'a').localeCompare(b.variant || 'a');
    });

  // Find current variant
  const currentIndex = uniqueVariants.findIndex(m =>
    `${m.number}-${m.variant || 'a'}` === currentVariantKey
  );
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < uniqueVariants.length - 1;

  // Normalize legacy statuses to new workflow statuses
  const normalizeStatus = (status) => {
    const normalized = (status || 'INCOMING').toUpperCase();
    // Map legacy statuses to new workflow statuses
    const legacyMap = {
      'PLANNED': 'NAMING',
      'INPROGRESS': 'CONTENT'
    };
    return legacyMap[normalized] || normalized;
  };

  // Determine status color from lookAndFeel config
  const status = (editingMessage.status || 'INCOMING').toUpperCase();
  // Default colors for fallback
  const defaultStatusColors = {
    INCOMING: '#8B5CF6',
    NAMING: '#EAB308',
    CONTENT: '#F97316',
    PREVIEW: '#3B82F6',
    APPROVED: '#22C55E',
    ACTIVE: '#15803D',
    INACTIVE: '#9CA3AF',
    ERROR: '#EF4444',
    DEAD: '#64748B',
    MEMORY: '#06B6D4'
  };
  // Use lookAndFeel.statusColors from settings, fallback to defaults
  const statusColors = { ...defaultStatusColors, ...(lookAndFeel?.statusColors || {}) };
  // Try exact match first, then normalized, then fallback
  const statusColor = statusColors[status] || statusColors[normalizeStatus(status)] || statusColors['INCOMING'] || '#8B5CF6';

  // Function to determine if text should be dark or light based on background color
  const getTextColor = (hexColor) => {
    // Remove # if present
    const hex = hexColor.replace('#', '');
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // Return dark text for light backgrounds, light text for dark backgrounds
    return luminance > 0.6 ? '#000000' : '#ffffff';
  };

  const textColor = getTextColor(statusColor);

  // Find synced messages
  const syncedMessages = messages.filter(m =>
    m.id !== editingMessage.id &&
    m.number === editingMessage.number &&
    m.variant === editingMessage.variant &&
    m.status !== 'deleted'
  );

  // Helper function to update message and sync to variants
  const updateMessageWithSync = (messageId, updates) => {
    // Update the main message
    updateMessage(messageId, updates);

    // Sync to all variant copies (excluding audience-specific and unique-mode fields)
    if (syncedMessages.length > 0) {
      syncedMessages.forEach(syncedMsg => {
        // Fields that should always be unique per message (never synced)
        const excludeFields = [
          'audience',     // Each message has a unique audience
          'pmmid',        // Auto-generated from audience + other fields
          'id',           // Numeric ID - unique per message
          'version',      // Auto-increments per message
          // Trafficking fields are computed from PMMID, so they're unique per message
          'utm_campaign',
          'utm_source',
          'utm_medium',
          'utm_content',
          'utm_term',
          'utm_cd26',
          'final_trafficked_url'
        ];

        // If status sync mode is 'unique', also exclude status from sync
        if (statusSyncMode === 'unique') {
          excludeFields.push('status');
        }

        // Filter out excluded fields
        const syncUpdates = Object.keys(updates)
          .filter(key => !excludeFields.includes(key))
          .reduce((obj, key) => {
            obj[key] = updates[key];
            return obj;
          }, {});

        updateMessage(syncedMsg.id, syncUpdates);
      });
    }
  };

  // Determine if preview should be on side or top based on width
  const [width, height] = previewSize.split('x').map(Number);
  const isWide = width > height && width > 600; // Only landscape creatives with width > 600 go to top

  // Calculate scale based on layout mode
  // Wide layout: scale if >= 1080
  // Side view: scale to fit max 300px width
  let scale = 1;
  if (isWide) {
    if (width >= 1080 || height >= 1080) {
      scale = 0.5;
    }
  } else {
    if (width > 300) {
      scale = 300 / width;
    }
  }
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  // Tab configuration
  const tabs = [
    { id: 'naming', label: 'Naming', icon: Tag, color: 'pink' },
    { id: 'content', label: 'Content', icon: CookingPot, color: 'blue' },
    { id: 'generate', label: 'Generate', icon: Sparkles, color: 'purple' },
    { id: 'styles', label: 'Styles', icon: PencilRuler, color: 'orange' },
    { id: 'trafficking', label: 'Trafficking', icon: Rocket, color: 'green' },
    { id: 'task', label: 'Task', icon: ClipboardList, color: 'cyan' }
  ];

  // Render text input field with formatting info
  const renderTextInputWithFormatting = (fieldName, label, inputType = 'input', rows = 3) => {
    const defaultText = editingMessage?.[fieldName] || '';
    const formattingRules = getFormattingRulesForText(defaultText);
    const hasFormatting = formattingRules.length > 0;
    const isAddMode = formattingAddMode[fieldName];

    // Size options for dropdown
    const sizeOptions = ['All sizes', '1080x1080', '970x250', '640x360', '300x600', '300x250'];

    const handleDefaultValueChange = (value) => {
      updateField(fieldName, value);
    };

    const handleAddFormatting = () => {
      // Add a new empty formatting entry to editedFormattingValues
      const newKey = `${fieldName}:new:${Date.now()}`;
      const newEntryData = {
        text: defaultText,
        scopes: ['All sizes'],
        isGlobal: true,
        isNew: true
      };
      setEditedFormattingValues(prev => ({
        ...prev,
        [newKey]: newEntryData
      }));
      setFormattingAddMode(prev => ({ ...prev, [fieldName]: true }));

      // Auto-save: if auto-save is on and there's text, save immediately
      if (autoSave && defaultText && updateTextFormatting) {
        // Find max ID
        const maxId = textFormatting.reduce((max, rule) => {
          const id = parseInt(rule.id, 10);
          return isNaN(id) ? max : Math.max(max, id);
        }, 0);

        const newEntry = {
          id: String(maxId + 1),
          text_original: defaultText,
          text_formatted: defaultText,
          formatting_scope: [],
          formatting_mc_scope: ''
        };

        triggerTextFormattingAutoSave([...textFormatting, newEntry]);

        // Clear this new entry from editedFormattingValues since it's now saved
        setTimeout(() => {
          setEditedFormattingValues(prev => {
            const newValues = { ...prev };
            delete newValues[newKey];
            return newValues;
          });
        }, 200);
      }
    };

    const handleFormattingChange = (key, updates, existingRule = null) => {
      const updatedData = { ...editedFormattingValues[key], ...updates };

      setEditedFormattingValues(prev => ({
        ...prev,
        [key]: updatedData
      }));

      // Auto-save: if this is an existing rule with an ID, update textFormatting immediately
      if (autoSave && existingRule && existingRule.id && updateTextFormatting) {
        // Convert updates to the textFormatting format
        const scopeArray = updates.scopes
          ? (updates.scopes.includes('All sizes') ? [] : updates.scopes)
          : (existingRule.formatting_scope || []);
        const mcScope = updates.isGlobal !== undefined
          ? (updates.isGlobal ? '' : `${editingMessage?.number || ''}${editingMessage?.variant || ''}`)
          : (existingRule.formatting_mc_scope || '');

        const updatedFormatting = textFormatting.map(r =>
          r.id === existingRule.id
            ? {
                ...r,
                text_formatted: updates.text !== undefined ? updates.text : r.text_formatted,
                formatting_scope: scopeArray,
                formatting_mc_scope: mcScope
              }
            : r
        );
        triggerTextFormattingAutoSave(updatedFormatting);
      }

      // Auto-save: for NEW entries, add them to textFormatting when they have text
      if (autoSave && !existingRule && key.includes(':new:') && updateTextFormatting) {
        const textValue = updates.text !== undefined ? updates.text : updatedData.text;
        if (textValue) {
          // Build the new entry
          const fieldName = key.split(':')[0];
          const originalText = editingMessage?.[fieldName] || '';
          const scopes = updatedData.scopes || ['All sizes'];
          const scopeArray = scopes.includes('All sizes') ? [] : scopes;
          const mcScope = updatedData.isGlobal ? '' : `${editingMessage?.number || ''}${editingMessage?.variant || ''}`;

          // Find max ID
          const maxId = textFormatting.reduce((max, rule) => {
            const id = parseInt(rule.id, 10);
            return isNaN(id) ? max : Math.max(max, id);
          }, 0);

          const newEntry = {
            id: String(maxId + 1),
            text_original: originalText,
            text_formatted: textValue,
            formatting_scope: scopeArray,
            formatting_mc_scope: mcScope
          };

          // Add the new entry to textFormatting
          triggerTextFormattingAutoSave([...textFormatting, newEntry]);

          // Clear this new entry from editedFormattingValues since it's now saved
          // Use setTimeout to avoid state update conflict
          setTimeout(() => {
            setEditedFormattingValues(prev => {
              const newValues = { ...prev };
              delete newValues[key];
              return newValues;
            });
          }, 200); // After debounce completes
        }
      }
    };

    const handleDeleteFormatting = (key, rule) => {
      if (rule && rule.id && updateTextFormatting) {
        // Delete from matrix state (in-memory)
        const updatedFormatting = textFormatting.filter(r => r.id !== rule.id);
        updateTextFormatting(updatedFormatting);
      } else {
        // Just remove from local state (for new entries not yet saved)
        setEditedFormattingValues(prev => {
          const newValues = { ...prev };
          delete newValues[key];
          return newValues;
        });
      }
    };

    // Get new formatting entries from editedFormattingValues
    const newFormattingEntries = Object.entries(editedFormattingValues)
      .filter(([key]) => key.startsWith(`${fieldName}:new:`));

    // If there's formatting, use single line input even for textarea fields
    const useLineInput = hasFormatting || newFormattingEntries.length > 0;
    const InputComponent = (inputType === 'textarea' && !useLineInput) ? 'textarea' : 'input';

    return (
      <div className="form-group">
        {/* Label row with add button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '-2px' }}>
          <label className="form-label" style={{ marginTop: 0, marginBottom: 0 }}>{label}</label>
          <button
            onClick={handleAddFormatting}
            className="link-button"
            style={{ marginBottom: 0, padding: '2px 0' }}
          >
            <Type size={14} />
            <span>add text formatting</span>
          </button>
        </div>

        {/* Main input */}
        <div style={{ position: 'relative' }}>
          <InputComponent
            type="text"
            value={defaultText}
            onChange={(e) => handleDefaultValueChange(e.target.value)}
            rows={inputType === 'textarea' && !useLineInput ? rows : undefined}
            className={inputType === 'textarea' && !useLineInput ? 'form-textarea' : 'form-input'}
            style={{ width: '100%' }}
          />
          {isGeneratingContent && (
            <div style={{
              position: 'absolute',
              right: '12px',
              top: inputType === 'textarea' && !useLineInput ? '12px' : '50%',
              transform: inputType === 'textarea' && !useLineInput ? 'none' : 'translateY(-50%)'
            }}>
              <Loader size={16} className="animate-spin" style={{ color: '#9b59b6' }} />
            </div>
          )}
        </div>

        {/* Existing formatting rules */}
        {formattingRules.map((rule, idx) => {
          const key = `${fieldName}:existing:${rule.id || idx}`;
          const editedData = editedFormattingValues[key];
          const currentText = editedData?.text ?? rule.text_formatted;
          // Parse scopes - can be comma-separated string, array, or empty for "All sizes"
          let parsedScopes = [];
          if (Array.isArray(rule.formatting_scope)) {
            parsedScopes = rule.formatting_scope.filter(s => s);
          } else if (rule.formatting_scope && typeof rule.formatting_scope === 'string') {
            parsedScopes = rule.formatting_scope.split(',').map(s => s.trim()).filter(s => s);
          }
          const savedScopes = parsedScopes.length > 0 ? parsedScopes : ['All sizes'];
          const currentScopes = editedData?.scopes ?? savedScopes;
          const isGlobal = editedData?.isGlobal ?? true;
          const hasChanges = editedData && (
            editedData.text !== rule.text_formatted ||
            JSON.stringify(editedData.scopes) !== JSON.stringify(savedScopes)
          );
          const isSaving = savingFormatting.fieldName === fieldName && savingFormatting.scope === key;

          const toggleScope = (scope) => {
            let newScopes;
            if (scope === 'All sizes') {
              newScopes = ['All sizes'];
            } else if (currentScopes.includes('All sizes')) {
              newScopes = [scope];
            } else if (currentScopes.includes(scope)) {
              newScopes = currentScopes.filter(s => s !== scope);
              if (newScopes.length === 0) newScopes = ['All sizes'];
            } else {
              newScopes = [...currentScopes, scope];
            }
            handleFormattingChange(key, { text: currentText, scopes: newScopes, isGlobal }, rule);
          };

          const scopeLabel = currentScopes.includes('All sizes')
            ? 'All sizes'
            : currentScopes.length > 1
              ? `${currentScopes.length} sizes`
              : currentScopes[0];

          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <input
                type="text"
                className="form-input"
                value={currentText}
                onChange={(e) => handleFormattingChange(key, { text: e.target.value, scopes: currentScopes, isGlobal }, rule)}
                style={{ flex: 1, minWidth: 0 }}
              />
              <div className={`dropdown ${openFormattingDropdown === key ? 'open' : ''}`} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  className="dropdown-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenFormattingDropdown(openFormattingDropdown === key ? null : key);
                  }}
                  style={{ minWidth: '90px' }}
                >
                  <span>{scopeLabel}</span>
                  <ChevronDown size={16} />
                </button>
                <div className="dropdown-menu" onClick={(e) => e.stopPropagation()} style={{ minWidth: '140px', left: 'auto', right: 0 }}>
                  {sizeOptions.map(size => {
                    const isSelected = size === 'All sizes'
                      ? currentScopes.includes('All sizes')
                      : currentScopes.includes(size);
                    return (
                      <div
                        key={size}
                        className={`dropdown-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleScope(size)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        <div style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '3px',
                          border: '1px solid var(--white-50)',
                          background: isSelected ? 'var(--color-white)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {isSelected && <Check size={12} style={{ color: 'var(--color-primary)' }} />}
                        </div>
                        {size}
                      </div>
                    );
                  })}
                </div>
              </div>
              <button
                className={`toggle-tag ${isGlobal ? 'active' : ''}`}
                onClick={() => handleFormattingChange(key, { text: currentText, scopes: currentScopes, isGlobal: !isGlobal }, rule)}
              >
                {isGlobal ? 'Global' : 'Local'}
              </button>
              <button
                className="row-delete-btn"
                onClick={() => handleDeleteFormatting(key, rule)}
                title="Remove formatting"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}

        {/* New formatting entries */}
        {newFormattingEntries.map(([key, data]) => {
          const isSaving = savingFormatting.fieldName === fieldName && savingFormatting.scope === key;
          const hasContent = data.text && data.text !== defaultText;
          const currentScopes = data.scopes || ['All sizes'];

          const toggleNewScope = (scope) => {
            let newScopes;
            if (scope === 'All sizes') {
              newScopes = ['All sizes'];
            } else if (currentScopes.includes('All sizes')) {
              newScopes = [scope];
            } else if (currentScopes.includes(scope)) {
              newScopes = currentScopes.filter(s => s !== scope);
              if (newScopes.length === 0) newScopes = ['All sizes'];
            } else {
              newScopes = [...currentScopes, scope];
            }
            handleFormattingChange(key, { ...data, scopes: newScopes });
          };

          const scopeLabel = currentScopes.includes('All sizes')
            ? 'All sizes'
            : currentScopes.length > 1
              ? `${currentScopes.length} sizes`
              : currentScopes[0];

          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <input
                type="text"
                className="form-input"
                value={data.text}
                onChange={(e) => handleFormattingChange(key, { ...data, text: e.target.value })}
                placeholder="Enter formatted text..."
                style={{ flex: 1, minWidth: 0 }}
              />
              <div className={`dropdown ${openFormattingDropdown === key ? 'open' : ''}`} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  className="dropdown-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenFormattingDropdown(openFormattingDropdown === key ? null : key);
                  }}
                  style={{ minWidth: '90px' }}
                >
                  <span>{scopeLabel}</span>
                  <ChevronDown size={16} />
                </button>
                <div className="dropdown-menu" onClick={(e) => e.stopPropagation()} style={{ minWidth: '140px', left: 'auto', right: 0 }}>
                  {sizeOptions.map(size => {
                    const isSelected = size === 'All sizes'
                      ? currentScopes.includes('All sizes')
                      : currentScopes.includes(size);
                    return (
                      <div
                        key={size}
                        className={`dropdown-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleNewScope(size)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        <div style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '3px',
                          border: '1px solid var(--white-50)',
                          background: isSelected ? 'var(--color-white)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {isSelected && <Check size={12} style={{ color: 'var(--color-primary)' }} />}
                        </div>
                        {size}
                      </div>
                    );
                  })}
                </div>
              </div>
              <button
                className={`toggle-tag ${data.isGlobal ? 'active' : ''}`}
                onClick={() => handleFormattingChange(key, { ...data, isGlobal: !data.isGlobal })}
              >
                {data.isGlobal ? 'Global' : 'Local'}
              </button>
              <button
                className="row-delete-btn"
                onClick={() => handleDeleteFormatting(key, null)}
                title="Remove formatting"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  // Render preview panel
  const renderPreview = () => (
    <div className="dialog-preview">
      <div className="preview-header">
        <button
          className={`skip-animation-btn ${skipAnimation ? 'checked' : ''}`}
          onClick={() => setSkipAnimation(!skipAnimation)}
        >
          <div className="checkbox-box">
            <Check size={12} />
          </div>
          <span>Skip animation</span>
        </button>
        <div className={`dropdown ${sizeDropdownOpen ? 'open' : ''}`}>
          <button
            className="dropdown-trigger"
            onClick={() => setSizeDropdownOpen(!sizeDropdownOpen)}
            disabled={!editingMessage.template || availableDimensions.length === 0}
          >
            <span>{availableDimensions.length > 0 ? previewSize : 'N/A'}</span>
            <ChevronDown size={16} />
          </button>
          <div className="dropdown-menu">
            {availableDimensions.map(dim => (
              <div
                key={dim}
                className={`dropdown-item ${previewSize === dim ? 'selected' : ''}`}
                onClick={() => {
                  setPreviewSize(dim);
                  setSizeDropdownOpen(false);
                }}
              >
                {dim}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="preview-frame">
        {editingMessage.template ? (() => {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              {isNonHtmlTemplate && !warningDismissed && (
                <div
                  className="template-warning"
                  style={{
                    width: `${scaledWidth}px`,
                    boxSizing: 'border-box',
                    position: 'relative'
                  }}
                >
                  <AlertCircle size={18} className="template-warning-icon" />
                  <div className="template-warning-content">
                    <p className="template-warning-title">Non-HTML Template: {editingMessage?.template}</p>
                    <p className="template-warning-text">Changing content requires external tools (Adobe).</p>
                  </div>
                  <button
                    onClick={() => setWarningDismissed(true)}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      color: 'var(--white-60)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div style={{
                width: `${scaledWidth}px`,
                height: `${scaledHeight}px`,
                overflow: 'hidden',
                position: 'relative',
                boxShadow: 'var(--ui-shadow)'
              }}>
              <iframe
                key={`${editingMessage.id}-${previewSize}-${mergedTextFormatting.map(r => r.text_formatted || '').join('')}`}
                srcDoc={generatePreviewHtml()}
                style={{
                  width: `${width}px`,
                  height: `${height}px`,
                  transform: scale !== 1 ? `scale(${scale})` : 'none',
                  transformOrigin: 'top left',
                  border: 0,
                  position: 'absolute',
                  top: 0,
                  left: 0
                }}
                title="Message Preview"
                sandbox="allow-same-origin allow-scripts"
              />
              </div>
            </div>
          );
        })() : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--white-50)',
            fontSize: '13px',
            height: '300px'
          }}>
            Select a template to see preview
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(
    <div className={`dialog-overlay overlay-animated ${isClosing ? 'closing' : 'open'}`} onClick={handleClose}>
      <div className={`dialog-panel dialog-animated ${isClosing ? 'closing' : 'open'}`} onClick={(e) => e.stopPropagation()}>
        <div className={`dialog-layout ${isWide ? 'wide-layout' : ''}`}>
          {/* LEFT SIDEBAR */}
          <div className="dialog-sidebar">
            <h2 className="dialog-title">Edit</h2>

            {/* Navigation */}
            <div className="dialog-nav">
              <button
                onClick={() => {
                  if (uniqueVariants.length === 0) return;
                  const targetIndex = hasPrevious ? currentIndex - 1 : uniqueVariants.length - 1;
                  setEditingMessage(uniqueVariants[targetIndex]);
                }}
                className="dialog-nav-btn"
                title="Previous variant"
              >
                <ChevronLeft size={16} />
              </button>
              <div
                className="dialog-nav-indicator"
                style={{
                  backgroundColor: statusColor,
                  color: textColor,
                  borderRadius: '6px',
                  fontWeight: 600,
                  paddingTop: '3px',
                  position: 'relative'
                }}
              >
                {editingMessage.number || ''}{editingMessage.variant || ''}
                {/* Sync warning badge */}
                {!isNonHtmlTemplate && syncedMessages.length > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      background: '#f97316',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 700,
                      borderRadius: '10px',
                      padding: '2px 6px',
                      minWidth: '18px',
                      textAlign: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}
                    title={`${syncedMessages.length} other message${syncedMessages.length > 1 ? 's' : ''} will sync`}
                  >
                    {syncedMessages.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  if (uniqueVariants.length === 0) return;
                  const targetIndex = hasNext ? currentIndex + 1 : 0;
                  setEditingMessage(uniqueVariants[targetIndex]);
                }}
                className="dialog-nav-btn"
                title="Next variant"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Auto-Save Toggle */}
            <button
              className={`dialog-toggle ${autoSave ? 'checked' : ''}`}
              onClick={() => setAutoSave(!autoSave)}
            >
              <div className="checkbox-box">
                <Check size={14} />
              </div>
              <span>Auto-Save</span>
            </button>

            {/* Vertical Tabs */}
            <div className="dialog-tabs">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setPreviewOverrides({});
                  }}
                  className={`dialog-tab ${activeTab === tab.id ? 'active' : ''}`}
                >
                  <h2 className="text-xl">{tab.label}</h2>
                  <tab.icon size={18} />
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="dialog-actions">
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this message?')) {
                    deleteMessage(editingMessage.id);
                    handleClose();
                  }
                }}
                className="link-button"
              >
                <Trash2 size={16} />
                Delete
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleClose}
                  className="btn btn-secondary btn-lg"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Add new text formatting entries to matrix state
                    const newEntries = getNewFormattingEntries();
                    if (newEntries.length > 0 && updateTextFormatting) {
                      updateTextFormatting([...textFormatting, ...newEntries]);
                      setEditedFormattingValues({});
                    }
                    // Save all message fields
                    const allFields = {
                      name: editingMessage.name,
                      number: editingMessage.number,
                      variant: editingMessage.variant,
                      status: editingMessage.status,
                      poms_id: editingMessage.poms_id,
                      start_date: editingMessage.start_date,
                      end_date: editingMessage.end_date,
                      template: editingMessage.template,
                      headline: editingMessage.headline,
                      copy1: editingMessage.copy1,
                      copy2: editingMessage.copy2,
                      disclaimer: editingMessage.disclaimer,
                      flash: editingMessage.flash,
                      cta: editingMessage.cta,
                      landingUrl: editingMessage.landingUrl,
                      template_variant_classes: editingMessage.template_variant_classes,
                      image1: editingMessage.image1,
                      image2: editingMessage.image2,
                      image3: editingMessage.image3,
                      image4: editingMessage.image4,
                      image5: editingMessage.image5,
                      image6: editingMessage.image6,
                      video1: editingMessage.video1,
                      comment: editingMessage.comment,
                      headline_style: editingMessage.headline_style,
                      copy1_style: editingMessage.copy1_style,
                      copy2_style: editingMessage.copy2_style,
                      disclaimer_style: editingMessage.disclaimer_style,
                      flash_style: editingMessage.flash_style,
                      cta_style: editingMessage.cta_style,
                      css: editingMessage.css
                    };
                    updateMessageWithSync(editingMessage.id, allFields);
                  }}
                  className="btn btn-secondary btn-lg"
                  style={{ flex: 1 }}
                >
                  Save
                </button>
              </div>
              <button
                onClick={() => {
                  // Add new text formatting entries to matrix state
                  const newEntries = getNewFormattingEntries();
                  if (newEntries.length > 0 && updateTextFormatting) {
                    updateTextFormatting([...textFormatting, ...newEntries]);
                    setEditedFormattingValues({});
                  }
                  // Save all message fields
                  const allFields = {
                    name: editingMessage.name,
                    number: editingMessage.number,
                    variant: editingMessage.variant,
                    status: editingMessage.status,
                    poms_id: editingMessage.poms_id,
                    start_date: editingMessage.start_date,
                    end_date: editingMessage.end_date,
                    template: editingMessage.template,
                    headline: editingMessage.headline,
                    copy1: editingMessage.copy1,
                    copy2: editingMessage.copy2,
                    disclaimer: editingMessage.disclaimer,
                    flash: editingMessage.flash,
                    cta: editingMessage.cta,
                    landingUrl: editingMessage.landingUrl,
                    template_variant_classes: editingMessage.template_variant_classes,
                    image1: editingMessage.image1,
                    image2: editingMessage.image2,
                    image3: editingMessage.image3,
                    image4: editingMessage.image4,
                    image5: editingMessage.image5,
                    image6: editingMessage.image6,
                    video1: editingMessage.video1,
                    comment: editingMessage.comment,
                    headline_style: editingMessage.headline_style,
                    copy1_style: editingMessage.copy1_style,
                    copy2_style: editingMessage.copy2_style,
                    disclaimer_style: editingMessage.disclaimer_style,
                    flash_style: editingMessage.flash_style,
                    cta_style: editingMessage.cta_style,
                    css: editingMessage.css
                  };
                  updateMessageWithSync(editingMessage.id, allFields);
                  handleClose();
                }}
                className="btn btn-primary btn-lg"
              >
                Save & Close
              </button>
            </div>
          </div>

          {/* CONTENT AREA */}
          <div className="dialog-content-area">
            {/* MAIN CONTENT */}
            <div className="dialog-main custom-scrollbar">
              {/* Naming Tab */}
              {activeTab === 'naming' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input
                      type="text"
                      value={editingMessage.name || ''}
                      onChange={(e) => updateField('name', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">Audience Key</label>
                      <input
                        type="text"
                        value={editingMessage.audience || ''}
                        disabled
                        className="form-input"
                        style={{ opacity: 0.5 }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Topic Key</label>
                      <input
                        type="text"
                        value={editingMessage.topic || ''}
                        disabled
                        className="form-input"
                        style={{ opacity: 0.5 }}
                      />
                    </div>
                  </div>

                  <div className="form-grid-4">
                    <div className="form-group">
                      <label className="form-label">Number</label>
                      <input
                        type="number"
                        value={editingMessage.number || ''}
                        onChange={(e) => {
                          const newNumber = parseInt(e.target.value) || 0;
                          updateField('number', newNumber);
                        }}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Variant</label>
                      <input
                        type="text"
                        value={editingMessage.variant || ''}
                        onChange={(e) => {
                          const newVariant = e.target.value;
                          updateField('variant', newVariant);
                        }}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Version</label>
                      <input
                        type="number"
                        value={editingMessage.version || 1}
                        disabled
                        className="form-input"
                        style={{ opacity: 0.5 }}
                      />
                    </div>
                    <div className="form-group">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label className="form-label">Status</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => setStatusSyncMode('all')}
                            className={`toggle-tag ${statusSyncMode === 'all' ? 'active' : ''}`}
                          >
                            all
                          </button>
                          <button
                            onClick={() => setStatusSyncMode('unique')}
                            className={`toggle-tag ${statusSyncMode === 'unique' ? 'active' : ''}`}
                          >
                            unique
                          </button>
                        </div>
                      </div>
                      {(() => {
                        // Use keywords.messages.status for status options
                        const keywordValues = keywords.messages?.status;
                        const statusOptions = keywordValues && keywordValues.length > 0
                          ? keywordValues
                          : ['INCOMING', 'NAMING', 'CONTENT', 'PREVIEW', 'APPROVED', 'ACTIVE', 'INACTIVE', 'ERROR'];

                        return (
                          <select
                            value={editingMessage.status || 'INCOMING'}
                            onChange={(e) => updateField('status', e.target.value)}
                            className="form-input"
                            style={{
                              backgroundColor: statusColor,
                              borderColor: statusColor,
                              color: textColor,
                              fontWeight: 600
                            }}
                          >
                            {statusOptions.map((val) => {
                              // Use workflow status color from lookAndFeel (statusColors already merged with defaults)
                              const optionColor = statusColors[val] || statusColors[val.toUpperCase()] || '#808080';
                              return (
                                <option key={val} value={val} style={{ backgroundColor: optionColor, color: getTextColor(optionColor) }}>
                                  {val}
                                </option>
                              );
                            })}
                          </select>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="form-grid-1-1-2">
                    <div className="form-group">
                      <label className="form-label">ID</label>
                      <input
                        type="text"
                        value={editingMessage.id || ''}
                        disabled
                        className="form-input"
                        style={{ opacity: 0.5, fontSize: '12px' }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">POMS ID</label>
                      <input
                        type="text"
                        value={editingMessage.poms_id || ''}
                        onChange={(e) => updateField('poms_id', e.target.value)}
                        className="form-input"
                        style={{ fontSize: '12px' }}
                        placeholder="POMS ID"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">PMMID (Auto-generated)</label>
                      <input
                        type="text"
                        value={generatePMMID(editingMessage, audiences, settings.getPattern('pmmid'))}
                        disabled
                        className="form-input"
                        style={{ opacity: 0.5, fontFamily: 'monospace', fontSize: '11px' }}
                      />
                    </div>
                  </div>

                  <div className="form-grid-1-1-2">
                    <div className="form-group">
                      <label className="form-label">Start Date</label>
                      <input
                        type="date"
                        value={editingMessage.start_date || ''}
                        onChange={(e) => updateField('start_date', e.target.value)}
                        onClick={(e) => e.target.showPicker()}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">End Date</label>
                      <input
                        type="date"
                        value={editingMessage.end_date || ''}
                        onChange={(e) => updateField('end_date', e.target.value)}
                        onClick={(e) => e.target.showPicker()}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Template</label>
                      <div className={`dropdown ${templateDropdownOpen ? 'open' : ''}`} style={{ width: '100%' }}>
                        <button
                          className="dropdown-trigger"
                          onClick={() => setTemplateDropdownOpen(!templateDropdownOpen)}
                          style={{ width: '100%', justifyContent: 'space-between' }}
                        >
                          <span>{editingMessage.template || 'Select a template'}</span>
                          <ChevronDown size={16} />
                        </button>
                        <div className="dropdown-menu" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                          <div
                            className={`dropdown-item ${!editingMessage.template ? 'selected' : ''}`}
                            onClick={() => {
                              updateField('template', '');
                              setTemplateDropdownOpen(false);
                            }}
                          >
                            Select a template
                          </div>
                          {/* HTML Templates from templates folder */}
                          {templates.map(t => (
                            <div
                              key={t.name}
                              className={`dropdown-item ${editingMessage.template === t.name ? 'selected' : ''}`}
                              onClick={() => {
                                updateField('template', t.name);
                                setTemplateDropdownOpen(false);
                              }}
                            >
                              {t.name}
                            </div>
                          ))}
                          {/* Keyword Templates from Keywords sheet (e.g., Adobe PSD, Adobe AEP) */}
                          {keywords?.messages?.template?.map(t => (
                            <div
                              key={`kw-${t}`}
                              className={`dropdown-item ${editingMessage.template === t ? 'selected' : ''}`}
                              onClick={() => {
                                updateField('template', t);
                                setTemplateDropdownOpen(false);
                              }}
                            >
                              {t}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Content Tab */}
              {activeTab === 'content' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div className="form-group">
                      <label className="form-label">
                        Template Variant Classes
                        {variantClassOptions.length > 0 && (
                          <span style={{ fontSize: '11px', color: 'var(--white-50)', marginLeft: '8px' }}>({variantClassOptions.length} options)</span>
                        )}
                      </label>
                      {variantClassOptions.length > 0 ? (
                        <div style={{
                          background: 'var(--white-10)',
                          border: '1px solid var(--white-20)',
                          borderRadius: '5px',
                          padding: '8px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px'
                        }}>
                          {variantClassOptions.map(option => {
                            const selectedClasses = (editingMessage.template_variant_classes || '').split(/\s+/).filter(c => c);
                            const isSelected = selectedClasses.includes(option);

                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => {
                                  let newClasses;
                                  if (isSelected) {
                                    newClasses = selectedClasses.filter(c => c !== option);
                                  } else {
                                    newClasses = [...selectedClasses, option];
                                  }
                                  setEditingMessage({
                                    ...editingMessage,
                                    template_variant_classes: newClasses.join(' ')
                                  });
                                }}
                                className={`toggle-tag ${isSelected ? 'active' : ''}`}
                                style={{ fontSize: 'var(--font-size-xs)' }}
                              >
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={editingMessage.template_variant_classes || ''}
                          onChange={(e) => updateField('template_variant_classes', e.target.value)}
                          className="form-input"
                          placeholder="Select a template with variant options or enter manually"
                        />
                      )}
                    </div>

                    {renderTextInputWithFormatting('headline', 'Headline', 'input')}
                    {renderTextInputWithFormatting('copy1', 'Copy 1', 'textarea', 3)}
                    {renderTextInputWithFormatting('copy2', 'Copy 2', 'input')}
                    {renderTextInputWithFormatting('disclaimer', 'Disclaimer', 'textarea', 2)}
                    {renderTextInputWithFormatting('flash', 'Flash', 'input')}
                    {renderTextInputWithFormatting('cta', 'CTA', 'input')}

                    <div className="form-group">
                      <label className="form-label">Landing URL</label>
                      <input
                        type="text"
                        value={editingMessage.landingUrl || ''}
                        onChange={(e) => updateField('landingUrl', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Image 1</label>
                        <AssetAutocomplete
                          value={editingMessage.image1 || 'empty.png'}
                          onChange={(val) => updateField('image1', val)}
                          assets={assets}
                          filterType="image"
                          placeholder="Image URL or path"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Image 2</label>
                        <AssetAutocomplete
                          value={editingMessage.image2 || 'empty.png'}
                          onChange={(val) => updateField('image2', val)}
                          assets={assets}
                          filterType="image"
                          placeholder="Image URL or path"
                        />
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Image 3</label>
                        <AssetAutocomplete
                          value={editingMessage.image3 || 'empty.png'}
                          onChange={(val) => updateField('image3', val)}
                          assets={assets}
                          filterType="image"
                          placeholder="Image URL or path"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Image 4</label>
                        <AssetAutocomplete
                          value={editingMessage.image4 || 'empty.png'}
                          onChange={(val) => updateField('image4', val)}
                          assets={assets}
                          filterType="image"
                          placeholder="Image URL or path"
                        />
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Image 5 (Logo)</label>
                        <AssetAutocomplete
                          value={editingMessage.image5 || 'empty.png'}
                          onChange={(val) => updateField('image5', val)}
                          assets={assets}
                          filterType="image"
                          placeholder="Logo image URL or path"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Image 6 (Sticker)</label>
                        <AssetAutocomplete
                          value={editingMessage.image6 || 'empty.png'}
                          onChange={(val) => updateField('image6', val)}
                          assets={assets}
                          filterType="image"
                          placeholder="Sticker image URL or path"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Video 1 (Background)</label>
                      <AssetAutocomplete
                        value={editingMessage.video1 || 'emptyvideo.mp4'}
                        onChange={(val) => updateField('video1', val)}
                        assets={assets}
                        filterType="video"
                        placeholder="Video URL or path"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Comment</label>
                      <textarea
                        value={editingMessage.comment || ''}
                        onChange={(e) => {
                          updateField('comment', e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        onFocus={(e) => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        ref={(el) => {
                          if (el && editingMessage.comment) {
                            el.style.height = 'auto';
                            el.style.height = el.scrollHeight + 'px';
                          }
                        }}
                        rows={2}
                        className="form-textarea"
                        style={{ minHeight: '60px', resize: 'none', overflow: 'hidden' }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Generate Tab */}
              {activeTab === 'generate' && (() => {
                // Find sibling variants (same message number, same cell, different variant letter)
                // Only match if in the same audience/topic cell with the same message number
                const currentNumber = editingMessage?.number;
                const currentAudienceId = editingMessage?.audienceId;
                const currentTopicId = editingMessage?.topicId;
                const siblingVariants = (currentNumber && currentAudienceId && currentTopicId) ? messages.filter(m =>
                  m.number === currentNumber &&
                  m.audienceId === currentAudienceId &&
                  m.topicId === currentTopicId &&
                  m.id !== editingMessage?.id &&
                  m.status !== 'deleted'
                ).sort((a, b) => (a.variant || 'a').localeCompare(b.variant || 'a')) : [];

                return (
                  <>
                    {/* Generate Section */}
                    <div style={{
                      background: 'var(--white-05)',
                      borderRadius: '8px',
                      border: '1px solid var(--white-10)'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px'
                      }}>
                        <div>
                          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'white', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={18} style={{ color: 'white' }} />
                            AI Content Generation
                          </h3>
                          <p style={{ color: 'var(--white-50)', fontSize: '12px' }}>
                            Generate 5 versions of each field based on topic and audience
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => setBriefExpanded(!briefExpanded)}
                            className="btn btn-secondary"
                            style={{ padding: '10px 20px' }}
                          >
                            Add Brief
                          </button>
                          <button
                            onClick={() => handleGenerateContent(briefText)}
                            disabled={isGeneratingContent}
                            className="btn btn-primary"
                            style={{ padding: '10px 20px' }}
                          >
                            {isGeneratingContent ? (
                              <><Loader size={14} className="animate-spin" /> Generating...</>
                            ) : (
                              <><Sparkles size={14} /> Generate</>
                            )}
                          </button>
                        </div>
                      </div>
                      {briefExpanded && (
                        <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--white-10)', paddingTop: '16px' }}>
                          <textarea
                            value={briefText}
                            onChange={(e) => {
                              setBriefText(e.target.value);
                              e.target.style.height = 'auto';
                              e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                            onFocus={(e) => {
                              e.target.style.height = 'auto';
                              e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                            placeholder="Add additional instructions or context for AI generation..."
                            rows={2}
                            className="form-textarea"
                            style={{ minHeight: '60px', resize: 'none', overflow: 'hidden' }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => {
                                updateCommentBrief(briefText);
                              }}
                              disabled={!briefText.trim()}
                              className="btn btn-secondary"
                              style={{ padding: '8px 16px' }}
                            >
                              Save to Comments
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sibling Variants Section */}
                    {siblingVariants.length > 0 && (
                      <div style={{
                        background: 'var(--white-05)',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid var(--white-10)'
                      }}>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#ec4899',
                          marginBottom: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{
                            width: '4px',
                            height: '16px',
                            background: '#ec4899',
                            borderRadius: '2px'
                          }} />
                          Message Variants ({siblingVariants.length})
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--white-50)', marginBottom: '12px' }}>
                          Click on a variant to copy all its content fields
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {siblingVariants.map((variant) => (
                            <button
                              type="button"
                              key={variant.id}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const updates = {};
                                ['headline', 'copy1', 'copy2', 'flash', 'cta'].forEach(field => {
                                  if (variant[field]) {
                                    updates[field] = variant[field];
                                  }
                                });
                                if (Object.keys(updates).length > 0) {
                                  updateFields(updates);
                                }
                              }}
                              style={{
                                padding: '12px',
                                background: 'var(--white-05)',
                                border: '1px solid var(--white-10)',
                                borderRadius: '8px',
                                color: 'white',
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(236,72,153,0.1)';
                                e.currentTarget.style.borderColor = '#ec4899';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'var(--white-05)';
                                e.currentTarget.style.borderColor = 'var(--white-10)';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                <span style={{
                                  width: '22px',
                                  height: '22px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: 'rgba(236,72,153,0.2)',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  color: '#ec4899',
                                  textTransform: 'uppercase'
                                }}>
                                  {variant.variant || 'a'}
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: 500 }}>
                                  {variant.name || `Variant ${(variant.variant || 'a').toUpperCase()}`}
                                </span>
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--white-60)', paddingLeft: '32px' }}>
                                {variant.headline && <div><strong>H:</strong> {variant.headline.substring(0, 50)}{variant.headline.length > 50 ? '...' : ''}</div>}
                                {variant.copy1 && <div><strong>C1:</strong> {variant.copy1.substring(0, 50)}{variant.copy1.length > 50 ? '...' : ''}</div>}
                                {variant.cta && <div><strong>CTA:</strong> {variant.cta}</div>}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Generated Versions */}
                    {generatedVersions ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {[
                          { key: 'headline', label: 'Headline' },
                          { key: 'copy1', label: 'Copy 1' },
                          { key: 'copy2', label: 'Copy 2' },
                          { key: 'flash', label: 'Flash' },
                          { key: 'cta', label: 'CTA' }
                        ].filter(({ key }) => generatedVersions[key]?.length > 0)
                        .map(({ key, label }, idx) => {
                          const hasChanged = originalFieldValues &&
                            (editingMessage?.[key] || '') !== (originalFieldValues[key] || '');

                          // Check if this field has a placeholder in the template HTML
                          // First find the placeholder name that maps to this field
                          const placeholderName = templateConfig?.placeholders && Object.entries(templateConfig.placeholders).find(([name, p]) => {
                            const binding = p['binding-messagingmatrix'];
                            return binding && binding.replace(/^message\./i, '').toLowerCase() === key;
                          })?.[0];
                          // Then check if that placeholder is actually used in the HTML
                          const hasPlaceholder = placeholderName && templateHtml && templateHtml.includes(`{{${placeholderName}}}`);

                          return (
                            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {idx > 0 && (
                                <hr style={{ border: 'none', borderTop: '1px solid var(--white-10)', margin: '8px 0 12px 0' }} />
                              )}
                              <div style={{
                                fontSize: '12px',
                                fontWeight: 600,
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}>
                                <span>{label}</span>
                                {hasChanged && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (originalFieldValues) {
                                        updateField(key, originalFieldValues[key]);
                                      }
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      background: 'var(--white-10)',
                                      border: 'none',
                                      borderRadius: '4px',
                                      color: 'white',
                                      fontSize: '10px',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap'
                                    }}
                                    title="Restore original value"
                                  >
                                    Return to Original
                                  </button>
                                )}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {generatedVersions[key].map((version, idx) => {
                                  const lineId = `${key}-${idx}`;
                                  const isHovered = hoveredLine === lineId;

                                  return (
                                    <div
                                      key={idx}
                                      onMouseEnter={() => setHoveredLine(lineId)}
                                      onMouseLeave={() => setHoveredLine(null)}
                                      onClick={() => {
                                        if (version) {
                                          if (isNonHtmlTemplate || !hasPlaceholder) {
                                            // For non-dynamic templates or missing placeholders, add to comment instead
                                            addGeneratedToComment(key, version);
                                          } else {
                                            updateField(key, version);
                                          }
                                        }
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 12px',
                                        background: isHovered ? 'var(--white-10)' : 'var(--white-05)',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s',
                                        minHeight: '36px'
                                      }}
                                    >
                                      <span style={{ flex: 1, fontSize: '12px', color: 'white', lineHeight: '1.4' }}>{version}</span>
                                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0, opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s' }}>
                                          {!isNonHtmlTemplate && hasPlaceholder && (
                                            <>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  if (version) {
                                                    setPreviewOverrides(prev => ({ ...prev, [key]: version }));
                                                  }
                                                }}
                                                style={{
                                                  padding: '4px 8px',
                                                  background: previewOverrides[key] === version ? 'var(--white-40)' : 'var(--white-20)',
                                                  border: 'none',
                                                  borderRadius: '4px',
                                                  color: 'white',
                                                  fontSize: '10px',
                                                  cursor: 'pointer',
                                                  whiteSpace: 'nowrap'
                                                }}
                                                title="Preview in template"
                                              >
                                                Preview
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  if (version) {
                                                    updateField(key, version);
                                                    setPreviewOverrides(prev => {
                                                      const next = { ...prev };
                                                      delete next[key];
                                                      return next;
                                                    });
                                                  }
                                                }}
                                                style={{
                                                  padding: '4px 8px',
                                                  background: 'var(--white-20)',
                                                  border: 'none',
                                                  borderRadius: '4px',
                                                  color: 'white',
                                                  fontSize: '10px',
                                                  cursor: 'pointer',
                                                  whiteSpace: 'nowrap'
                                                }}
                                                title="Apply to content field"
                                              >
                                                Apply
                                              </button>
                                            </>
                                          )}
                                          {!isNonHtmlTemplate && !hasPlaceholder && (
                                            <span style={{
                                              fontSize: '10px',
                                              fontStyle: 'italic',
                                              color: 'white',
                                              whiteSpace: 'nowrap',
                                              lineHeight: '22px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              marginRight: '8px'
                                            }}>
                                              placeholder not available
                                            </span>
                                          )}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              addGeneratedToComment(key, version);
                                            }}
                                            style={{
                                              padding: '4px 8px',
                                              background: 'var(--white-20)',
                                              border: 'none',
                                              borderRadius: '4px',
                                              color: 'white',
                                              fontSize: '10px',
                                              cursor: 'pointer',
                                              whiteSpace: 'nowrap'
                                            }}
                                            title="Add to message comments"
                                          >
                                            Add to Comment
                                          </button>
                                        </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : !siblingVariants.length && !isGeneratingContent && (
                      <div style={{ textAlign: 'center', color: 'var(--white-50)', marginTop: '20px' }}>
                        <p style={{ fontSize: '13px' }}>
                          Click "Generate" to create AI-powered content variations
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Styles Tab */}
              {activeTab === 'styles' && (
                <>
                  <div style={{ opacity: isNonHtmlTemplate ? 0.5 : 1, pointerEvents: isNonHtmlTemplate ? 'none' : 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div className="form-group">
                      <label className="form-label">Headline Style</label>
                      <input
                        type="text"
                        value={editingMessage.headline_style || ''}
                        onChange={(e) => updateField('headline_style', e.target.value)}
                        className="form-input"
                        style={{ fontFamily: 'monospace', fontSize: '12px' }}
                        placeholder="e.g., color: #333; font-size: 24px;"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Copy 1 Style</label>
                      <input
                        type="text"
                        value={editingMessage.copy1_style || ''}
                        onChange={(e) => updateField('copy1_style', e.target.value)}
                        className="form-input"
                        style={{ fontFamily: 'monospace', fontSize: '12px' }}
                        placeholder="e.g., color: #666; font-size: 14px;"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Copy 2 Style</label>
                      <input
                        type="text"
                        value={editingMessage.copy2_style || ''}
                        onChange={(e) => updateField('copy2_style', e.target.value)}
                        className="form-input"
                        style={{ fontFamily: 'monospace', fontSize: '12px' }}
                        placeholder="e.g., color: #666; font-size: 14px;"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Disclaimer Style</label>
                      <input
                        type="text"
                        value={editingMessage.disclaimer_style || ''}
                        onChange={(e) => updateField('disclaimer_style', e.target.value)}
                        className="form-input"
                        style={{ fontFamily: 'monospace', fontSize: '12px' }}
                        placeholder="e.g., color: #999; font-size: 10px;"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Flash Style</label>
                      <input
                        type="text"
                        value={editingMessage.flash_style || ''}
                        onChange={(e) => updateField('flash_style', e.target.value)}
                        className="form-input"
                        style={{ fontFamily: 'monospace', fontSize: '12px' }}
                        placeholder="e.g., background: #ff0000; color: white;"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">CTA Style</label>
                      <input
                        type="text"
                        value={editingMessage.cta_style || ''}
                        onChange={(e) => updateField('cta_style', e.target.value)}
                        className="form-input"
                        style={{ fontFamily: 'monospace', fontSize: '12px' }}
                        placeholder="e.g., background: #007bff; color: white;"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Custom CSS</label>
                      <textarea
                        value={editingMessage.css || ''}
                        onChange={(e) => updateField('css', e.target.value)}
                        rows={10}
                        className="form-textarea"
                        style={{ fontFamily: 'monospace', fontSize: '11px' }}
                        placeholder="/* Enter custom CSS here */"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Trafficking Tab */}
              {activeTab === 'trafficking' && (
                <>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">UTM Campaign</label>
                      <input
                        type="text"
                        value={computedTrafficking.utm_campaign || ''}
                        disabled
                        className="form-input"
                        style={{ opacity: 0.5 }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">UTM Source</label>
                      <input
                        type="text"
                        value={computedTrafficking.utm_source || ''}
                        disabled
                        className="form-input"
                        style={{ opacity: 0.5 }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">UTM Medium</label>
                      <input
                        type="text"
                        value={computedTrafficking.utm_medium || ''}
                        disabled
                        className="form-input"
                        style={{ opacity: 0.5 }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">UTM Content</label>
                      <input
                        type="text"
                        value={computedTrafficking.utm_content || ''}
                        disabled
                        className="form-input"
                        style={{ opacity: 0.5 }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">UTM Term</label>
                      <input
                        type="text"
                        value={computedTrafficking.utm_term || ''}
                        disabled
                        className="form-input"
                        style={{ opacity: 0.5 }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">UTM CD26</label>
                      <input
                        type="text"
                        value={computedTrafficking.utm_cd26 || ''}
                        disabled
                        className="form-input"
                        style={{ opacity: 0.5 }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Final Trafficked URL</label>
                    <textarea
                      value={computedTrafficking.final_trafficked_url || ''}
                      disabled
                      className="form-textarea"
                      style={{ opacity: 0.5, fontFamily: 'monospace', fontSize: '11px', minHeight: '80px' }}
                    />
                  </div>
                </>
              )}

              {/* Task Tab */}
              {activeTab === 'task' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Link Task Search Section */}
                  <div style={{
                    background: 'var(--white-10)',
                    borderRadius: '12px',
                    padding: '16px',
                    border: '1px solid var(--white-10)'
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-white)', marginBottom: '12px' }}>
                      Link Task
                    </div>
                    <div style={{ position: 'relative' }}>
                      <Search size={16} style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--white-40)'
                      }} />
                      <input
                        type="text"
                        value={taskSearch}
                        onChange={(e) => setTaskSearch(e.target.value)}
                        placeholder="Search tasks by title, TC#, or description..."
                        className="form-input"
                        style={{ paddingLeft: '36px' }}
                      />
                    </div>

                    {/* Search Results */}
                    {taskSearchResults.length > 0 && (
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {taskSearchResults.map(task => (
                          <div
                            key={task.id}
                            style={{
                              background: 'var(--white-10)',
                              borderRadius: '8px',
                              padding: '12px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '12px', color: 'var(--white-40)', marginBottom: '2px' }}>
                                {task.id ? `TC${task.id}` : `#${task.id}`}
                              </div>
                              <div style={{
                                fontSize: '13px',
                                fontWeight: 500,
                                color: 'var(--color-white)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {task.title || 'Untitled Task'}
                              </div>
                            </div>
                            <button
                              onClick={() => linkTaskToMC(task)}
                              className="btn btn-primary"
                              style={{ fontSize: '12px', padding: '6px 12px', marginLeft: '12px' }}
                            >
                              <Link2 size={14} />
                              Link
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Related Tasks Section */}
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-white)' }}>
                    Related Tasks ({relatedTasks.length})
                  </div>

                  {relatedTasks.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '40px 20px',
                      color: 'var(--white-60)'
                    }}>
                      <ClipboardList size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                      <p style={{ fontSize: '14px' }}>No tasks linked to this message</p>
                    </div>
                  ) : (
                    relatedTasks.map(task => (
                      <div
                        key={task.id}
                        style={{
                          background: 'var(--white-10)',
                          borderRadius: '12px',
                          padding: '16px',
                          border: '1px solid var(--white-10)'
                        }}
                      >
                        {/* Task Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--white-40)', marginBottom: '4px' }}>
                              {task.id ? `TC${task.id}` : 'Task'}
                            </div>
                            <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-white)', margin: 0 }}>
                              {task.title || 'Untitled Task'}
                            </h4>
                          </div>
                          <a
                            href={`/tasks?task=${task.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              color: 'var(--white-60)',
                              textDecoration: 'none'
                            }}
                          >
                            <ExternalLink size={14} />
                            Open
                          </a>
                        </div>

                        {/* Task Description */}
                        {task.description && (
                          <p style={{
                            fontSize: '13px',
                            color: 'var(--white-80)',
                            marginBottom: '12px',
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap'
                          }}>
                            {task.description.length > 200
                              ? task.description.substring(0, 200) + '...'
                              : task.description}
                          </p>
                        )}

                        {/* Task Meta */}
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          {/* Status */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: task.bucket === 'done' ? '#22c55e' :
                                         task.bucket === 'in_progress' ? '#3b82f6' :
                                         task.bucket === 'blocked' ? '#ef4444' : '#9ca3af'
                            }} />
                            <span style={{ fontSize: '12px', color: 'var(--white-60)', textTransform: 'capitalize' }}>
                              {(task.bucket || 'unknown').replace('_', ' ')}
                            </span>
                          </div>

                          {/* Due Date */}
                          {task.dueDate && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Calendar size={14} style={{ color: 'var(--white-40)' }} />
                              <span style={{ fontSize: '12px', color: 'var(--white-60)' }}>
                                {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}

                          {/* Link Type */}
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'var(--white-10)',
                            color: 'var(--white-60)'
                          }}>
                            {(task.relatedContent || []).some(item => item.messageId === editingMessage?.id)
                              ? 'Source MC'
                              : 'Output MC'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* PREVIEW PANEL */}
            {renderPreview()}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MessageEditorDialog;

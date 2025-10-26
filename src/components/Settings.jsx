import React, { useState, useEffect, useMemo } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, AlertCircle, Check, ExternalLink, Palette, MessageSquare, Sparkles } from 'lucide-react';
import settings from '../services/settings';
import PageHeader, { getButtonStyle } from './PageHeader';
import AIAssistant from './AIAssistant';
import { callClaudeAPI } from '../api/claude-proxy';

// Google Sheets icon component
const GoogleSheetsIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M29.5 4H11C9.34315 4 8 5.34315 8 7V41C8 42.6569 9.34315 44 11 44H37C38.6569 44 40 42.6569 40 41V15.5L29.5 4Z" fill="#0F9D58"/>
    <path d="M29.5 4V12C29.5 13.933 31.067 15.5 33 15.5H40L29.5 4Z" fill="#87CEAC"/>
    <rect x="16" y="20" width="16" height="2" fill="white"/>
    <rect x="16" y="26" width="16" height="2" fill="white"/>
    <rect x="16" y="32" width="16" height="2" fill="white"/>
    <rect x="19" y="18" width="2" height="18" fill="white"/>
    <rect x="27" y="18" width="2" height="18" fill="white"/>
  </svg>
);

// Helper function to parse CSS string into style object
const parseStyle = (styleString) => {
  if (!styleString) return {};
  const styleObj = {};
  styleString.split(';').forEach(rule => {
    const [property, value] = rule.split(':').map(s => s.trim());
    if (property && value) {
      // Convert kebab-case to camelCase
      const camelProperty = property.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      styleObj[camelProperty] = value;
    }
  });
  return styleObj;
};

const Settings = ({ onMenuToggle, currentModuleName, matrixData }) => {
  const [config, setConfig] = useState({
    patterns: {
      pmmid: '',
      topicKey: '',
      trafficking: {
        utm_campaign: '',
        utm_source: '',
        utm_medium: '',
        utm_content: '',
        utm_term: '',
        utm_cd26: '',
        final_trafficked_url: ''
      },
      feed: {}
    },
    imageBaseUrls: {
      image1: '',
      image2: '',
      image3: '',
      image4: '',
      image5: '',
      image6: ''
    },
    spreadsheetId: '',
    googleDrive: {
      enabled: false,
      assetsFolderId: '',
      creativesFolderId: ''
    },
    treeStructure: 'Product → Strategy → Targeting Type → Audience → Topic → Messages',
    feedStructure: 'Text:advert_id,Text:pmmid,AdformSignal:ADFPLAID,ReportingLabel,IsDefault,IsActive,DateFrom,DateTo,Text:messaging_card_id,Text:messaging_card_variant,Text:advert_name,Text:template_variant_class,LP:clickTAG,Asset:background_image_1,Asset:background_image_2,Asset:background_image_3,Asset:background_image_4,Asset:sticker_image_1,Asset:background_image_logo,Text:headline_text_1,Text:copy_text_1,Text:copy_text_2,Text:click_text,Text:headline_style_1,Text:copy_style_1,Text:copy_style_2',
    lookAndFeel: {
      logo: '',
      headerColor: '#2870ed',
      logoStyle: 'height: 25px; margin-top: -6px;',
      buttonColor: '#ff6130',
      buttonStyle: 'border: 1px solid white;',
      secondaryColor1: '#eb4c79',
      secondaryColor2: '#02a3a4',
      secondaryColor3: '#711c7a',
      statusColors: {
        ACTIVE: '#34a853',
        INACTIVE: '#cccccc',
        ERROR: '#ff0000',
        INPROGRESS: '#ff6d01',
        PLANNED: '#ffff00'
      }
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [aiPrompts, setAiPrompts] = useState({});
  const [generatingModule, setGeneratingModule] = useState(null);
  const [dataStructureDoc, setDataStructureDoc] = useState('');
  const [readmeDoc, setReadmeDoc] = useState('');

  useEffect(() => {
    loadConfig();
    loadAiPrompts();
    loadContextDocuments();
  }, []);

  const loadContextDocuments = async () => {
    try {
      // Load data structure documentation
      const dataStructResponse = await fetch('/api/ai-data-structure');
      if (dataStructResponse.ok) {
        const { content } = await dataStructResponse.json();
        setDataStructureDoc(content);
      }

      // Load README
      const readmeResponse = await fetch('/README.md');
      if (readmeResponse.ok) {
        const readmeText = await readmeResponse.text();
        setReadmeDoc(readmeText);
      }
    } catch (error) {
      console.error('Error loading context documents:', error);
    }
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      // Load config from server API
      await settings.ensureInitialized();
      const configData = settings.getAll();
      setConfig(configData);
    } catch (error) {
      console.error('Error loading config:', error);
      setMessage({ type: 'error', text: 'Failed to load configuration' });
    } finally {
      setLoading(false);
    }
  };

  const loadAiPrompts = async () => {
    try {
      // Load all AI prompts from backend
      const response = await fetch('/api/ai-prompts');
      if (response.ok) {
        const prompts = await response.json();
        setAiPrompts(prompts);
      }
    } catch (error) {
      console.error('Error loading AI prompts:', error);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      // Save config to config.json via API
      const success = await settings.save({
        spreadsheetId: config.spreadsheetId,
        googleDrive: config.googleDrive,
        imageBaseUrls: config.imageBaseUrls,
        patterns: config.patterns,
        treeStructure: config.treeStructure,
        feedStructure: config.feedStructure,
        lookAndFeel: config.lookAndFeel
      });

      if (!success) {
        setMessage({ type: 'error', text: 'Failed to save configuration to file' });
        setSaving(false);
        return;
      }

      // Save AI prompts to text files
      console.log('💾 Saving AI Prompts - Current state:', aiPrompts);
      const allModules = ['matrix', 'creative-library', 'assets', 'monitoring', 'templates', 'users', 'tasks', 'settings'];
      const savePromises = allModules.map(module => {
        const promptValue = aiPrompts[module] || '';
        console.log(`📝 Saving ${module}:`, promptValue.substring(0, 100) + (promptValue.length > 100 ? '...' : ''));
        return fetch(`/api/ai-prompts/${module}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: promptValue })
        });
      });

      await Promise.all(savePromises);
      console.log('✅ All AI prompts saved');

      setMessage({ type: 'success', text: 'Configuration and AI prompts saved successfully' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error saving:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (path, value) => {
    setConfig(prev => {
      const newConfig = { ...prev };
      const keys = path.split('.');
      let current = newConfig;

      for (let i = 0; i < keys.length - 1; i++) {
        // Ensure nested objects exist
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        // Make a copy to avoid mutating the original
        if (i < keys.length - 2 || typeof current[keys[i]] === 'object') {
          current[keys[i]] = { ...current[keys[i]] };
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newConfig;
    });
  };

  const handleAiPromptChange = (module, value) => {
    // Update local state only (don't save to backend yet)
    setAiPrompts(prev => ({ ...prev, [module]: value }));
  };

  const resetAiPrompt = async (module) => {
    try {
      // Save empty prompt to delete the file and revert to default
      const response = await fetch(`/api/ai-prompts/${module}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '' })
      });

      if (response.ok) {
        setAiPrompts(prev => {
          const updated = { ...prev };
          delete updated[module];
          return updated;
        });
        setMessage({ type: 'success', text: `Reset ${module} prompt to default` });
      }
    } catch (error) {
      console.error('Error resetting AI prompt:', error);
      setMessage({ type: 'error', text: `Failed to reset ${module} prompt` });
    }
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const generateNewInstructions = async (module) => {
    try {
      setGeneratingModule(module);
      setMessage({ type: '', text: '' });

      // Get API key
      const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      const savedKey = localStorage.getItem('ai_assistant_api_key');
      const apiKey = envKey || savedKey;

      if (!apiKey) {
        setMessage({ type: 'error', text: 'Claude API key not configured. Please set it in AI Assistant.' });
        setGeneratingModule(null);
        return;
      }

      // Get current prompt
      const currentPrompt = aiPrompts[module] || '';

      // Build application context
      const applicationContext = `
# APPLICATION CONTEXT

## Messaging Matrix Data Structure:
${dataStructureDoc || 'Data structure documentation not available'}

## Application README:
${readmeDoc || 'README not available'}

---

This AI assistant will be helping users work with the "${module}" module of this Messaging Matrix application.
The instructions should be specific to this application's data model and workflows.`;

      // Build request to Claude
      const systemPrompt = `You are a helpful AI that creates system instructions for AI assistants working in a Messaging Matrix application.

Your task is to create ${currentPrompt ? 'improved' : 'new'} instructions for the "${module}" module.

IMPORTANT CONTEXT:
${applicationContext}

Guidelines for creating instructions:
- Make instructions SPECIFIC to the Messaging Matrix application (not generic)
- Reference the actual data structures (audiences, topics, messages, etc.)
- Include examples using the application's terminology
- Explain how the AI should interact with this specific module
- Add capabilities that leverage the application's features
- Make response guidelines actionable and application-specific
- Use the data model terminology consistently
- Return ONLY the improved instructions, no explanation or meta-commentary`;

      const userMessage = currentPrompt
        ? `Here are the current instructions for the ${module} module. Please improve them to be more specific to the Messaging Matrix application:\n\n${currentPrompt}`
        : `Please create comprehensive instructions for an AI assistant helping with the "${module}" module.`;

      const response = await callClaudeAPI(apiKey, [
        { role: 'user', content: systemPrompt },
        { role: 'assistant', content: 'I understand. I will improve the AI assistant instructions and return only the improved version without any explanation.' },
        { role: 'user', content: userMessage }
      ]);

      // Extract text from Claude API response
      const improvedInstructions = response.content?.[0]?.text || '';

      if (!improvedInstructions) {
        throw new Error('No response from Claude API');
      }

      // Update the prompt with suggested improvements (in local state only)
      handleAiPromptChange(module, improvedInstructions);
      setMessage({ type: 'success', text: `Generated new instructions for ${module}. Click Save to apply.` });

    } catch (error) {
      console.error('Error generating instructions:', error);
      setMessage({ type: 'error', text: 'Failed to generate new instructions' });
    } finally {
      setGeneratingModule(null);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  // Parse feed structure to extract column names (full names with prefixes)
  const feedVariables = useMemo(() => {
    if (!config.feedStructure) return [];

    return config.feedStructure
      .split(',')
      .map(field => field.trim())
      .filter(v => v); // Remove empty strings
  }, [config.feedStructure]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <PageHeader onMenuToggle={onMenuToggle} title={currentModuleName || 'Settings'} lookAndFeel={config.lookAndFeel}>
        <button
          onClick={saveConfig}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          style={getButtonStyle(config.lookAndFeel)}
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </PageHeader>

      {/* Content */}
      <div className="p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Message */}
          {message.text && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              {message.type === 'success' ? (
                <Check size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <p className={`text-sm ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {message.text}
              </p>
            </div>
          )}

          {/* Google Sheets Configuration */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <SettingsIcon size={20} className="text-blue-600" />
              Google Sheets Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Spreadsheet ID
                </label>
                <p className="text-xs text-gray-600 mb-2">
                  Share spreadsheet with: <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">messagingmatrix@messagingmatrix.iam.gserviceaccount.com</span>
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={config.spreadsheetId}
                    onChange={(e) => handleInputChange('spreadsheetId', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter Google Spreadsheet ID"
                  />
                  {config.spreadsheetId && (
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors"
                    >
                      <span>Open</span>
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>

              {/* Google Drive Folder IDs */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-md font-semibold text-gray-800 mb-4">Google Drive Integration</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assets Folder ID
                    </label>
                    <p className="text-xs text-gray-600 mb-2">
                      Google Drive folder ID for media library assets
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={config.googleDrive?.assetsFolderId || ''}
                        onChange={(e) => handleInputChange('googleDrive.assetsFolderId', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        placeholder="Enter Google Drive folder ID for assets"
                      />
                      {config.googleDrive?.assetsFolderId && (
                        <a
                          href={`https://drive.google.com/drive/folders/${config.googleDrive.assetsFolderId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors"
                        >
                          <span>Open</span>
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Creative Library Folder ID
                    </label>
                    <p className="text-xs text-gray-600 mb-2">
                      Google Drive folder ID for creative library files
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={config.googleDrive?.creativesFolderId || ''}
                        onChange={(e) => handleInputChange('googleDrive.creativesFolderId', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        placeholder="Enter Google Drive folder ID for creatives"
                      />
                      {config.googleDrive?.creativesFolderId && (
                        <a
                          href={`https://drive.google.com/drive/folders/${config.googleDrive.creativesFolderId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors"
                        >
                          <span>Open</span>
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Enable Google Drive Toggle */}
                  <div className="pt-4 border-t border-gray-200">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={config.googleDrive?.enabled || false}
                          onChange={(e) => handleInputChange('googleDrive.enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">Enable Google Drive Integration</span>
                        <p className="text-xs text-gray-600 mt-1">
                          When enabled, the application will sync assets and creatives with Google Drive folders.
                          This allows automatic syncing of files, loading images via proxy API, and managing files directly in Drive.
                          When disabled, only local spreadsheet data will be used.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tree Structure Configuration */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Tree Structure</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Decision Tree Hierarchy
                </label>
                <input
                  type="text"
                  value={config.treeStructure || 'Product → Strategy → Targeting Type → Audience → Topic → Messages'}
                  onChange={(e) => handleInputChange('treeStructure', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="Product → Strategy → Targeting Type → Audience → Topic → Messages"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Define the hierarchy levels for the tree view using → arrows to separate levels
                </p>
              </div>
            </div>
          </div>

          {/* Feed Structure Configuration */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Feed Structure</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Feed CSV Header
                </label>
                <textarea
                  value={config.feedStructure || 'Text:advert_id,Text:pmmid,AdformSignal:ADFPLAID,ReportingLabel,IsDefault,IsActive,DateFrom,DateTo,Text:messaging_card_id,Text:messaging_card_variant,Text:advert_name,Text:template_variant_class,LP:clickTAG,Asset:background_image_1,Asset:background_image_2,Asset:background_image_3,Asset:background_image_4,Asset:sticker_image_1,Asset:background_image_logo,Text:headline_text_1,Text:copy_text_1,Text:copy_text_2,Text:click_text,Text:headline_style_1,Text:copy_style_1,Text:copy_style_2'}
                  onChange={(e) => handleInputChange('feedStructure', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  rows="4"
                  placeholder="Text:advert_id,Text:pmmid,AdformSignal:ADFPLAID,..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Define the CSV header for the feed view using comma-separated field definitions (Type:field_name)
                </p>
              </div>
            </div>
          </div>

          {/* Look and Feel Configuration */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Palette size={20} className="text-purple-600" />
              Look and Feel
            </h2>

            {/* Live Header Preview */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Header Preview
              </label>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <div style={{ backgroundColor: config.lookAndFeel.headerColor }} className="shadow-sm border-b">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button className="p-2 hover:bg-white hover:bg-opacity-10 rounded transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                          <line x1="3" y1="12" x2="21" y2="12"></line>
                          <line x1="3" y1="6" x2="21" y2="6"></line>
                          <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                      </button>
                      {config.lookAndFeel.logo && (
                        <img
                          src={config.lookAndFeel.logo}
                          alt="Logo"
                          style={parseStyle(config.lookAndFeel.logoStyle)}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <h1 className="text-xl font-bold text-white">Settings Preview</h1>
                    </div>
                    <button
                      className="px-4 py-2 rounded text-white transition-colors font-medium text-sm"
                      style={{
                        backgroundColor: config.lookAndFeel.buttonColor,
                        ...(config.lookAndFeel.buttonStyle ? parseStyle(config.lookAndFeel.buttonStyle) : {})
                      }}
                    >
                      Action Button
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Live preview updates in real-time as you change colors and styles below
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Logo URL */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo URL
                </label>
                <input
                  type="text"
                  value={config.lookAndFeel.logo}
                  onChange={(e) => handleInputChange('lookAndFeel.logo', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="https://example.com/logo.svg"
                />
              </div>

              {/* Logo Style */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo Style (CSS)
                </label>
                <input
                  type="text"
                  value={config.lookAndFeel.logoStyle}
                  onChange={(e) => handleInputChange('lookAndFeel.logoStyle', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="height: 25px; margin-top: -6px;"
                />
                <p className="text-xs text-gray-500 mt-1">
                  CSS properties for logo styling
                </p>
              </div>

              {/* Header Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Header Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config.lookAndFeel.headerColor}
                    onChange={(e) => handleInputChange('lookAndFeel.headerColor', e.target.value)}
                    className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.lookAndFeel.headerColor}
                    onChange={(e) => handleInputChange('lookAndFeel.headerColor', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    placeholder="#2870ed"
                  />
                </div>
              </div>

              {/* Button Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Button Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config.lookAndFeel.buttonColor}
                    onChange={(e) => handleInputChange('lookAndFeel.buttonColor', e.target.value)}
                    className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.lookAndFeel.buttonColor}
                    onChange={(e) => handleInputChange('lookAndFeel.buttonColor', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    placeholder="#ff6130"
                  />
                </div>
              </div>

              {/* Button Style */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Button Style (CSS)
                </label>
                <input
                  type="text"
                  value={config.lookAndFeel.buttonStyle}
                  onChange={(e) => handleInputChange('lookAndFeel.buttonStyle', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="border: 1px solid white;"
                />
              </div>

              {/* Secondary Color 1 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Color 1
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config.lookAndFeel.secondaryColor1}
                    onChange={(e) => handleInputChange('lookAndFeel.secondaryColor1', e.target.value)}
                    className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.lookAndFeel.secondaryColor1}
                    onChange={(e) => handleInputChange('lookAndFeel.secondaryColor1', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    placeholder="#eb4c79"
                  />
                </div>
              </div>

              {/* Secondary Color 2 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Color 2
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config.lookAndFeel.secondaryColor2}
                    onChange={(e) => handleInputChange('lookAndFeel.secondaryColor2', e.target.value)}
                    className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.lookAndFeel.secondaryColor2}
                    onChange={(e) => handleInputChange('lookAndFeel.secondaryColor2', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    placeholder="#02a3a4"
                  />
                </div>
              </div>

              {/* Secondary Color 3 */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Color 3
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config.lookAndFeel.secondaryColor3}
                    onChange={(e) => handleInputChange('lookAndFeel.secondaryColor3', e.target.value)}
                    className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.lookAndFeel.secondaryColor3}
                    onChange={(e) => handleInputChange('lookAndFeel.secondaryColor3', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    placeholder="#711c7a"
                  />
                </div>
              </div>
            </div>

            {/* Status Colors Section */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-md font-semibold text-gray-800 mb-4">Status Colors</h3>
              <p className="text-xs text-gray-600 mb-4">
                These colors are used in status dropdowns and indicators throughout the application
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Active Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Active Status
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={config.lookAndFeel.statusColors?.ACTIVE || '#34a853'}
                      onChange={(e) => handleInputChange('lookAndFeel.statusColors.ACTIVE', e.target.value)}
                      className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={config.lookAndFeel.statusColors?.ACTIVE || '#34a853'}
                      onChange={(e) => handleInputChange('lookAndFeel.statusColors.ACTIVE', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      placeholder="#34a853"
                    />
                  </div>
                </div>

                {/* In Progress Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    In Progress Status
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={config.lookAndFeel.statusColors?.INPROGRESS || '#ff6d01'}
                      onChange={(e) => handleInputChange('lookAndFeel.statusColors.INPROGRESS', e.target.value)}
                      className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={config.lookAndFeel.statusColors?.INPROGRESS || '#ff6d01'}
                      onChange={(e) => handleInputChange('lookAndFeel.statusColors.INPROGRESS', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      placeholder="#ff6d01"
                    />
                  </div>
                </div>

                {/* Planned Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Planned Status
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={config.lookAndFeel.statusColors?.PLANNED || '#ffff00'}
                      onChange={(e) => handleInputChange('lookAndFeel.statusColors.PLANNED', e.target.value)}
                      className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={config.lookAndFeel.statusColors?.PLANNED || '#ffff00'}
                      onChange={(e) => handleInputChange('lookAndFeel.statusColors.PLANNED', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      placeholder="#ffff00"
                    />
                  </div>
                </div>

                {/* Inactive Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Inactive Status
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={config.lookAndFeel.statusColors?.INACTIVE || '#cccccc'}
                      onChange={(e) => handleInputChange('lookAndFeel.statusColors.INACTIVE', e.target.value)}
                      className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={config.lookAndFeel.statusColors?.INACTIVE || '#cccccc'}
                      onChange={(e) => handleInputChange('lookAndFeel.statusColors.INACTIVE', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      placeholder="#cccccc"
                    />
                  </div>
                </div>

                {/* Error Status */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Error Status
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={config.lookAndFeel.statusColors?.ERROR || '#ff0000'}
                      onChange={(e) => handleInputChange('lookAndFeel.statusColors.ERROR', e.target.value)}
                      className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={config.lookAndFeel.statusColors?.ERROR || '#ff0000'}
                      onChange={(e) => handleInputChange('lookAndFeel.statusColors.ERROR', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      placeholder="#ff0000"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pattern Configuration */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Pattern Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PMMID Pattern
                </label>
                <input
                  type="text"
                  value={config.patterns.pmmid}
                  onChange={(e) => handleInputChange('patterns.pmmid', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="p_{{audiences[Audience_Key].Buying_platform}}-s_{{audiences[Audience_Key].Strategy}}..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Variables: Audience_Key, Number, Topic_Key, Variant, Version, audiences[key].field
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Topic Key Pattern
                </label>
                <input
                  type="text"
                  value={config.patterns.topicKey}
                  onChange={(e) => handleInputChange('patterns.topicKey', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="{{Tag1}}_{{Tag2}}_{{Tag3}}_{{Tag4}}"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Variables: Tag1, Tag2, Tag3, Tag4
                </p>
              </div>

              {/* Trafficking Patterns */}
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-md font-semibold text-gray-800 mb-4">Trafficking Patterns</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      UTM Campaign Pattern
                    </label>
                    <input
                      type="text"
                      value={config.patterns.trafficking.utm_campaign}
                      onChange={(e) => handleInputChange('patterns.trafficking.utm_campaign', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      UTM Source Pattern
                    </label>
                    <input
                      type="text"
                      value={config.patterns.trafficking.utm_source}
                      onChange={(e) => handleInputChange('patterns.trafficking.utm_source', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      UTM Medium
                    </label>
                    <input
                      type="text"
                      value={config.patterns.trafficking.utm_medium}
                      onChange={(e) => handleInputChange('patterns.trafficking.utm_medium', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      UTM Content
                    </label>
                    <input
                      type="text"
                      value={config.patterns.trafficking.utm_content}
                      onChange={(e) => handleInputChange('patterns.trafficking.utm_content', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      UTM Term Pattern
                    </label>
                    <input
                      type="text"
                      value={config.patterns.trafficking.utm_term}
                      onChange={(e) => handleInputChange('patterns.trafficking.utm_term', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      UTM CD26 Pattern
                    </label>
                    <input
                      type="text"
                      value={config.patterns.trafficking.utm_cd26}
                      onChange={(e) => handleInputChange('patterns.trafficking.utm_cd26', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Final Trafficked URL Pattern
                    </label>
                    <textarea
                      value={config.patterns.trafficking.final_trafficked_url}
                      onChange={(e) => handleInputChange('patterns.trafficking.final_trafficked_url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      rows="3"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Variables: Landing_URL, PMMID, utm_campaign, utm_source, utm_medium, utm_content, utm_term, utm_cd26
                    </p>
                  </div>
                </div>
              </div>

              {/* Feed Patterns */}
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-md font-semibold text-gray-800 mb-4">Feed Patterns</h3>
                <p className="text-xs text-gray-600 mb-4">
                  Configure pattern templates for each feed variable extracted from the Feed Structure string
                </p>
                <div className="space-y-3">
                  {feedVariables.map((variable) => (
                    <div key={variable} className="flex items-center gap-4">
                      <label className="text-sm font-medium text-gray-700 w-48 flex-shrink-0">
                        {variable}
                      </label>
                      <input
                        type="text"
                        value={config.patterns.feed?.[variable] || ''}
                        onChange={(e) => handleInputChange(`patterns.feed.${variable}`, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        placeholder={`Pattern for ${variable}`}
                      />
                    </div>
                  ))}
                  {feedVariables.length === 0 && (
                    <p className="text-sm text-gray-500 italic">
                      No feed variables found. Configure Feed Structure above to define variables.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* AI Assistant Prompts Configuration */}
          <div className="bg-white rounded-lg shadow-sm p-8 mt-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <MessageSquare size={24} className="text-purple-600" />
                AI Assistant Prompts
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Customize the system prompts and context that the AI assistant receives for each module
              </p>
            </div>

            <div className="space-y-6">
              {/* Matrix Module */}
              <div className="border-b border-gray-200 pb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-md font-semibold text-gray-800">Matrix Module</h3>
                  <button
                    onClick={() => generateNewInstructions('matrix')}
                    disabled={generatingModule === 'matrix'}
                    className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingModule === 'matrix' ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Generate New Instructions
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={aiPrompts.matrix || ''}
                  onChange={(e) => handleAiPromptChange('matrix', e.target.value)}
                  placeholder="Leave empty to use default prompt..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-xs"
                  rows="8"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: Messaging matrix content improvement, audience/topic suggestions
                </p>
              </div>

              {/* Creative Library Module */}
              <div className="border-b border-gray-200 pb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-md font-semibold text-gray-800">Creative Library Module</h3>
                  <button
                    onClick={() => generateNewInstructions('creative-library')}
                    disabled={generatingModule === 'creative-library'}
                    className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingModule === 'creative-library' ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Generate New Instructions
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={aiPrompts['creative-library'] || ''}
                  onChange={(e) => handleAiPromptChange('creative-library', e.target.value)}
                  placeholder="Leave empty to use default prompt..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-xs"
                  rows="8"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: Creative asset management, naming conventions, organization
                </p>
              </div>

              {/* Assets Module */}
              <div className="border-b border-gray-200 pb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-md font-semibold text-gray-800">Assets Module</h3>
                  <button
                    onClick={() => generateNewInstructions('assets')}
                    disabled={generatingModule === 'assets'}
                    className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingModule === 'assets' ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Generate New Instructions
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={aiPrompts.assets || ''}
                  onChange={(e) => handleAiPromptChange('assets', e.target.value)}
                  placeholder="Leave empty to use default prompt..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-xs"
                  rows="8"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: Media asset organization, file management, workflows
                </p>
              </div>

              {/* Monitoring Module */}
              <div className="border-b border-gray-200 pb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-md font-semibold text-gray-800">Monitoring Module</h3>
                  <button
                    onClick={() => generateNewInstructions('monitoring')}
                    disabled={generatingModule === 'monitoring'}
                    className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingModule === 'monitoring' ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Generate New Instructions
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={aiPrompts.monitoring || ''}
                  onChange={(e) => handleAiPromptChange('monitoring', e.target.value)}
                  placeholder="Leave empty to use default prompt..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-xs"
                  rows="8"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: Performance analysis, anomaly detection, optimization suggestions
                </p>
              </div>

              {/* Templates Module */}
              <div className="border-b border-gray-200 pb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-md font-semibold text-gray-800">Templates Module</h3>
                  <button
                    onClick={() => generateNewInstructions('templates')}
                    disabled={generatingModule === 'templates'}
                    className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingModule === 'templates' ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Generate New Instructions
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={aiPrompts.templates || ''}
                  onChange={(e) => handleAiPromptChange('templates', e.target.value)}
                  placeholder="Leave empty to use default prompt..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-xs"
                  rows="8"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: HTML template management, code review, responsive design
                </p>
              </div>

              {/* Users Module */}
              <div className="border-b border-gray-200 pb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-md font-semibold text-gray-800">Users Module</h3>
                  <button
                    onClick={() => generateNewInstructions('users')}
                    disabled={generatingModule === 'users'}
                    className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingModule === 'users' ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Generate New Instructions
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={aiPrompts.users || ''}
                  onChange={(e) => handleAiPromptChange('users', e.target.value)}
                  placeholder="Leave empty to use default prompt..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-xs"
                  rows="8"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: User management, role assignments, access control
                </p>
              </div>

              {/* Tasks Module */}
              <div className="pb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-md font-semibold text-gray-800">Tasks Module</h3>
                  <button
                    onClick={() => generateNewInstructions('tasks')}
                    disabled={generatingModule === 'tasks'}
                    className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingModule === 'tasks' ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Generate New Instructions
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={aiPrompts.tasks || ''}
                  onChange={(e) => handleAiPromptChange('tasks', e.target.value)}
                  placeholder="Leave empty to use default prompt..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-xs"
                  rows="8"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: Task management, workflow organization, email-to-task conversion
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* AI Assistant */}
      <AIAssistant
        moduleContext={{ module: 'settings' }}
        matrixData={matrixData}
      />
    </div>
  );
};

export default Settings;

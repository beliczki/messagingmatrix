import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Menu, Save, RefreshCw, AlertCircle, Check, ExternalLink } from 'lucide-react';
import settings from '../services/settings';

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

const Settings = ({ onMenuToggle, currentModuleName }) => {
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
      }
    },
    imageBaseUrls: {
      image1: '',
      image2: '',
      image3: '',
      image4: '',
      image5: '',
      image6: ''
    },
    spreadsheetId: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadConfig();
  }, []);

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

  const saveConfig = async () => {
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      // Save to config.json via API
      const success = await settings.save({
        spreadsheetId: config.spreadsheetId,
        imageBaseUrls: config.imageBaseUrls,
        patterns: config.patterns
      });

      if (success) {
        setMessage({ type: 'success', text: 'Settings saved successfully to config.json' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save configuration to file' });
      }

      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error saving config:', error);
      setMessage({ type: 'error', text: 'Failed to save configuration' });
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
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newConfig;
    });
  };

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
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuToggle}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Open Menu"
            >
              <Menu size={24} className="text-gray-700" />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">{currentModuleName || 'Settings'}</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveConfig}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

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
            </div>
          </div>

          {/* Trafficking Pattern Configuration */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Trafficking Patterns</h2>
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

          {/* Image Base URLs */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Image Base URLs</h2>
            <div className="space-y-4">
              {Object.keys(config.imageBaseUrls).map((key) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </label>
                  <input
                    type="text"
                    value={config.imageBaseUrls[key]}
                    onChange={(e) => handleInputChange(`imageBaseUrls.${key}`, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder={`https://example.com/path/to/${key}/`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

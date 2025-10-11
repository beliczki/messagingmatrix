// Settings Service - Persistent settings storage via API
class SettingsService {
  constructor() {
    this.settings = null;
    this.apiUrl = 'http://localhost:3003/api/config';
    this.initialized = false;
    this.initPromise = this.init();
  }

  // Initialize settings from config file via API
  async init() {
    if (this.initialized) return;

    try {
      const response = await fetch(this.apiUrl);
      if (response.ok) {
        this.settings = await response.json();
        this.initialized = true;
      } else {
        throw new Error(`Failed to load config from server: ${response.status}`);
      }
    } catch (error) {
      console.error('Error loading settings from server:', error);
      throw new Error('Unable to load configuration. Make sure the server is running on port 3003 and config.json exists.');
    }
  }

  // Wait for initialization
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initPromise;
    }
  }

  // Load settings (kept for backward compatibility, but now async)
  async load() {
    await this.ensureInitialized();
    return this.settings;
  }

  // Save settings to config file via API
  async save(settings) {
    try {
      await this.ensureInitialized();

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        const result = await response.json();
        this.settings = result.config;
        return true;
      } else {
        console.error('Failed to save config to server');
        return false;
      }
    } catch (error) {
      console.error('Error saving settings to server:', error);
      return false;
    }
  }

  // Get a specific setting (synchronous - assumes initialized)
  get(key) {
    return this.settings?.[key];
  }

  // Set a specific setting
  async set(key, value) {
    await this.ensureInitialized();
    this.settings[key] = value;
    await this.save(this.settings);
  }

  // Get spreadsheet ID (from config.json only)
  getSpreadsheetId() {
    return this.settings?.spreadsheetId || '';
  }

  // Get service account key (with fallback to env variable)
  getServiceAccountKey() {
    return this.settings?.serviceAccountKey || import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_KEY || '';
  }

  // Update spreadsheet ID
  async setSpreadsheetId(id) {
    await this.set('spreadsheetId', id);
  }

  // Get image base URLs
  getImageBaseUrls() {
    return this.settings?.imageBaseUrls || {};
  }

  // Set image base URLs
  async setImageBaseUrls(urls) {
    await this.set('imageBaseUrls', urls);
  }

  // Reset to default settings (reload from config.json)
  async reset() {
    this.initialized = false;
    await this.init();
  }

  // Get all settings
  getAll() {
    if (!this.settings) {
      throw new Error('Settings not initialized. Make sure the server is running.');
    }
    return { ...this.settings };
  }

  // Get patterns
  getPatterns() {
    if (!this.settings?.patterns) {
      throw new Error('Patterns not configured. Check config.json file.');
    }
    return this.settings.patterns;
  }

  // Get specific pattern
  getPattern(key) {
    const patterns = this.getPatterns();
    return patterns[key];
  }

  // Set patterns
  async setPatterns(patterns) {
    await this.set('patterns', patterns);
  }
}

export default new SettingsService();

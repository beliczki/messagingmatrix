// Settings Service - Persistent settings storage
class SettingsService {
  constructor() {
    this.storageKey = 'messagingmatrix_settings';
    this.settings = this.load();
  }

  // Load settings from localStorage
  load() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }

    // Default settings
    return {
      spreadsheetId: import.meta.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID || '',
      serviceAccountKey: import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_KEY || '',
      lastUpdated: null
    };
  }

  // Save settings to localStorage
  save(settings) {
    try {
      this.settings = {
        ...settings,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  }

  // Get a specific setting
  get(key) {
    return this.settings[key];
  }

  // Set a specific setting
  set(key, value) {
    this.settings[key] = value;
    this.save(this.settings);
  }

  // Get spreadsheet ID (with fallback to env variable)
  getSpreadsheetId() {
    return this.settings.spreadsheetId || import.meta.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID || '';
  }

  // Get service account key (with fallback to env variable)
  getServiceAccountKey() {
    return this.settings.serviceAccountKey || import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_KEY || '';
  }

  // Update spreadsheet ID
  setSpreadsheetId(id) {
    this.set('spreadsheetId', id);
  }

  // Reset to default settings
  reset() {
    localStorage.removeItem(this.storageKey);
    this.settings = this.load();
  }

  // Get all settings
  getAll() {
    return { ...this.settings };
  }
}

export default new SettingsService();

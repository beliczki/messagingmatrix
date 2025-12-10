// Settings Service - Persistent settings storage via API
import { apiGet, apiPost } from '../utils/api.js';

class SettingsService {
  constructor() {
    this.settings = null;
    this.apiUrl = '/api/config';
    this.initialized = false;
    this.initPromise = null; // Don't auto-initialize - wait for ensureInitialized() to be called
  }

  // Initialize settings from config file via API
  async init() {
    if (this.initialized) return;

    try {
      const response = await apiGet(this.apiUrl);
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

  // Wait for initialization (lazy initialization - only starts when first needed)
  async ensureInitialized() {
    if (!this.initialized) {
      if (!this.initPromise) {
        this.initPromise = this.init();
      }
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

      const response = await apiPost(this.apiUrl, settings);

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

  // Get look and feel settings
  getLookAndFeel() {
    return this.settings?.lookAndFeel || {
      logo: 'https://s3.eu-central-1.amazonaws.com/pomscloud-storage/assets/43/hu-HU/background/EBH_Logo_screen_white.svg',
      headerColor: '#2870ed',
      logoStyle: 'height: 25px; margin-top: -6px;',
      buttonColor: '#ff6130',
      buttonStyle: 'border: 1px solid white;',
      secondaryColor1: '#eb4c79',
      secondaryColor2: '#02a3a4',
      secondaryColor3: '#711c7a'
    };
  }

  // Set look and feel settings
  async setLookAndFeel(lookAndFeel) {
    await this.set('lookAndFeel', lookAndFeel);
  }

  // Get status colors from look and feel settings
  getStatusColors() {
    const lookAndFeel = this.getLookAndFeel();
    return lookAndFeel?.statusColors || {
      ACTIVE: '#34a853',
      INACTIVE: '#cccccc',
      ERROR: '#ff0000',
      INPROGRESS: '#ff6d01',
      PLANNED: '#ffff00'
    };
  }

  // Get audience structure (comma-separated column names)
  // Returns null if not configured - caller should handle validation
  getAudienceStructure() {
    return this.settings?.audienceStructure || null;
  }

  // Get topic structure (comma-separated column names)
  // Returns null if not configured - caller should handle validation
  getTopicStructure() {
    return this.settings?.topicStructure || null;
  }

  // Get messages structure (comma-separated column names)
  // Returns null if not configured - caller should handle validation
  getMessagesStructure() {
    return this.settings?.messagesStructure || null;
  }

  // Get creative structure (comma-separated column names)
  // Returns default structure if not configured
  getCreativeStructure() {
    if (this.settings?.creativeStructure) {
      return this.settings.creativeStructure;
    }
    // Return default structure matching the creative parsing rules
    return 'ID,Brand,Product,Type,Visual_keyword,Visual_description,MC_Number,MC_Variant,Version,File_format,File_driveID,File_name,File_size,File_date,File_dimensions,File_DirectLink,File_thumbnail,Is_Dynamic';
  }

  // Get creative parsing rules (object with field rules)
  // Returns default rules merged with any configured rules
  getCreativeParsingRules() {
    // Default parsing rules
    // Example filename: ERSTE_SZK_MC171_b_calculator_mockup_lakasfelujitas_n3_1200x628.png
    const defaults = {
      Brand: { rule: 'fixed', value: 'ERSTE' },
      Product: { rule: 'after_segment', afterValue: 'ERSTE', matchKeywords: false },
      Type: { rule: 'extension_type' },
      Visual_keyword: { rule: 'empty' },
      MC_Number: { rule: 'pattern', pattern: 'MC(\\d+)', extractGroup: 1 },
      MC_Variant: { rule: 'after_pattern', pattern: '^MC\\d+$' },
      Version: { rule: 'pattern', pattern: '[nv](\\d+)', extractGroup: 1 },
      File_dimensions: { rule: 'last_segment', pattern: '(\\d+)x(\\d+)' },
      Visual_description: { rule: 'remaining' }
    };

    const configuredRules = this.settings?.creativeParsingRules;
    if (configuredRules && Object.keys(configuredRules).length > 0) {
      // Merge defaults with configured rules (configured takes precedence)
      return { ...defaults, ...configuredRules };
    }
    return defaults;
  }
}

export default new SettingsService();

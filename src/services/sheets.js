// Simplified Google Sheets Service - Local Storage + Service Account
import { SignJWT } from 'jose';
import settings from './settings';

class SheetsService {
  constructor() {
    this.baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    this.storageKey = 'messagingmatrix_data';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Get spreadsheet ID from settings
  get spreadsheetId() {
    return settings.getSpreadsheetId();
  }

  // Get service account key from settings
  get serviceAccountKey() {
    return settings.getServiceAccountKey();
  }

  // Check if configured
  isConfigured() {
    return true; // Always works with localStorage
  }

  // Get OAuth2 access token using service account
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.serviceAccountKey) {
      throw new Error('Service account key not configured');
    }

    try {
      const serviceAccount = JSON.parse(this.serviceAccountKey);

      // Create JWT
      const now = Math.floor(Date.now() / 1000);
      const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        this.pemToArrayBuffer(serviceAccount.private_key),
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256',
        },
        false,
        ['sign']
      );

      const jwt = await new SignJWT({
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      })
        .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
        .sign(privateKey);

      // Exchange JWT for access token
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to get access token: ${JSON.stringify(error)}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 min early

      return this.accessToken;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
    }
  }

  // Convert PEM to ArrayBuffer
  pemToArrayBuffer(pem) {
    const b64 = pem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Read data from localStorage (fallback to sheets if available)
  async read(sheetName) {
    // Try localStorage first
    const stored = localStorage.getItem(`${this.storageKey}_${sheetName}`);
    if (stored) {
      return JSON.parse(stored);
    }

    // Try reading from Google Sheets via server API if configured
    if (this.spreadsheetId) {
      try {
        const url = `/api/sheets/${this.spreadsheetId}/values/${sheetName}`;
        console.log(`Fetching ${sheetName} from Google Sheets via server:`, url);

        const response = await fetch(url);

        if (response.ok) {
          const data = await response.json();
          const values = data.values || [];
          console.log(`Loaded ${sheetName} from Google Sheets:`, values);
          localStorage.setItem(`${this.storageKey}_${sheetName}`, JSON.stringify(values));
          return values;
        } else {
          const error = await response.json();
          console.error(`Google Sheets API error for ${sheetName}:`, error);
        }
      } catch (e) {
        console.error(`Failed to read ${sheetName} from Google Sheets:`, e);
      }
    } else {
      console.warn('Google Sheets spreadsheet ID not configured');
    }

    return [];
  }

  // Write data to localStorage and Google Sheets
  async write(sheetName, values) {
    // Always save to localStorage
    localStorage.setItem(`${this.storageKey}_${sheetName}`, JSON.stringify(values));

    // Try to write to Google Sheets via server API if configured
    if (this.spreadsheetId) {
      try {
        // Step 1: Clear the entire sheet first
        const clearUrl = `/api/sheets/${this.spreadsheetId}/values/${sheetName}/clear`;

        const clearResponse = await fetch(clearUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!clearResponse.ok) {
          const error = await clearResponse.json();
          console.error(`Failed to clear ${sheetName}:`, error);
          throw new Error(`Google Sheets clear error: ${JSON.stringify(error)}`);
        }

        console.log(`Cleared ${sheetName}`);

        // Step 2: Write new data
        const url = `/api/sheets/${this.spreadsheetId}/values/${sheetName}`;

        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: values,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error(`Failed to write ${sheetName} to Google Sheets:`, error);
          throw new Error(`Google Sheets write error: ${JSON.stringify(error)}`);
        }

        console.log(`Successfully wrote ${sheetName} to Google Sheets`);
        return { success: true };
      } catch (error) {
        console.error(`Error writing ${sheetName} to Google Sheets:`, error);
        throw error;
      }
    }

    return { success: true };
  }

  // Load all data
  async loadAll() {
    const [audiences, topics, messages, keywords, assets, creatives] = await Promise.all([
      this.read('Audiences'),
      this.read('Topics'),
      this.read('Messages'),
      this.read('Keywords'),
      this.read('Assets'),
      this.read('Creatives')
    ]);

    return {
      audiences: this.parseAudiences(audiences),
      topics: this.parseTopics(topics),
      messages: this.parseMessages(messages),
      keywords: this.parseKeywords(keywords),
      assets: this.parseAssets(assets),
      creatives: this.parseCreatives(creatives)
    };
  }

  // Save all data
  async saveAll(audiences, topics, messages, feedData = null, feedFields = null, assetsData = null, creativesData = null) {
    const audienceRows = [
      ['ID', 'Name', 'Order', 'Status', 'Product', 'Strategy', 'Buying_platform', 'Data_source', 'Targeting_type', 'Device', 'Tag', 'Key', 'Comment', 'Campaign_name', 'Campaign_ID', 'Lineitem_name', 'Lineitem_ID'],
      ...audiences.map(a => [
        a.id,
        a.name,
        a.order,
        a.status || '',
        a.product || '',
        a.strategy || '',
        a.buying_platform || '',
        a.data_source || '',
        a.targeting_type || '',
        a.device || '',
        a.tag || '',
        a.key,
        a.comment || '',
        a.campaign_name || '',
        a.campaign_id || '',
        a.lineitem_name || '',
        a.lineitem_id || ''
      ])
    ];

    const topicRows = [
      ['ID', 'Name', 'Key', 'Order', 'Status', 'Product', 'Tag1', 'Tag2', 'Tag3', 'Tag4', 'Created', 'Comment'],
      ...topics.map(t => [
        t.id,
        t.name,
        t.key,
        t.order,
        t.status || '',
        t.product || '',
        t.tag1 || '',
        t.tag2 || '',
        t.tag3 || '',
        t.tag4 || '',
        t.created || '',
        t.comment || ''
      ])
    ];

    const messageRows = [
      ['ID', 'POMS_ID', 'Name', 'Number', 'Variant', 'Audience_Key', 'Topic_Key', 'Version', 'PMMID', 'Status', 'Start_date', 'End_date', 'Template', 'Template_variant_classes', 'Headline', 'Copy1', 'Copy2', 'Disclaimer', 'Headline_style', 'Copy1_style', 'Copy2_style', 'Disclaimer_style', 'CSS', 'Image1', 'Image2', 'Image3', 'Image4', 'Image5', 'Image6', 'Flash', 'Flash_style', 'CTA', 'CTA_style', 'Landing_URL', 'Comment', 'UTM_Campaign', 'UTM_Source', 'UTM_Medium', 'UTM_Content', 'UTM_Term', 'UTM_CD26', 'Final_Trafficked_URL'],
      ...messages
        .filter(m => m.status !== 'deleted')
        .map(m => [
          m.id || '',           // A: Numeric ID
          m.poms_id || '',      // B: POMS_ID
          m.name || '',         // C: Name (compound key like "aud1!top1!m1a!v1")
          m.number || 1,        // D: Number
          m.variant || 'a',     // E: Variant
          m.audience,           // F: Audience_Key
          m.topic,              // G: Topic_Key
          m.version || 1,       // H: Version
          m.pmmid || '',        // I: PMMID
          m.status || '',       // J: Status
          m.start_date || '',   // K: Start_date
          m.end_date || '',     // L: End_date
          m.template || '',     // M: Template
          m.template_variant_classes || '', // N: Template_variant_classes
          m.headline || '',     // O: Headline
          m.copy1 || '',        // P: Copy1
          m.copy2 || '',        // Q: Copy2
          m.disclaimer || '',   // R: Disclaimer
          m.headline_style || '', // S: Headline_style
          m.copy1_style || '',  // T: Copy1_style
          m.copy2_style || '',  // U: Copy2_style
          m.disclaimer_style || '', // V: Disclaimer_style
          m.css || '',          // W: CSS
          m.image1 || '',       // X: Image1
          m.image2 || '',       // Y: Image2
          m.image3 || '',       // Z: Image3
          m.image4 || '',       // AA: Image4
          m.image5 || '',       // AB: Image5
          m.image6 || '',       // AC: Image6
          m.flash || '',        // AD: Flash
          m.flash_style || '',  // AE: Flash_style
          m.cta || '',          // AF: CTA
          m.cta_style || '',    // AG: CTA_style
          m.landingUrl || '',   // AH: Landing_URL
          m.comment || '',      // AI: Comment
          m.utm_campaign || '', // AJ: UTM_Campaign
          m.utm_source || '',   // AK: UTM_Source
          m.utm_medium || '',   // AL: UTM_Medium
          m.utm_content || '',  // AM: UTM_Content
          m.utm_term || '',     // AN: UTM_Term
          m.utm_cd26 || '',     // AO: UTM_CD26
          m.final_trafficked_url || '' // AP: Final_Trafficked_URL
        ])
    ];

    const promises = [
      this.write('Audiences', audienceRows),
      this.write('Topics', topicRows),
      this.write('Messages', messageRows)
    ];

    // Include feed if provided
    if (feedData && feedFields && feedData.length > 0) {
      const feedRows = [
        // Header row from feedFields
        feedFields.map(f => f.header),
        // Data rows
        ...feedData.map(row =>
          feedFields.map(field => row[field.header] || '')
        )
      ];
      promises.push(this.write('Feed', feedRows));
    }

    // Include assets if provided
    if (assetsData && assetsData.length > 0) {
      const assetsRows = [
        ['ID', 'Brand', 'Product', 'Type', 'Visual_keyword', 'Visual_description', 'Placeholder_name', 'Version', 'File_format', 'File_driveID', 'File_name', 'File_size', 'File_date', 'File_dimensions', 'File_DirectLink', 'File_thumbnail'],
        ...assetsData.map(asset => [
          asset.ID || '',
          asset.Brand || '',
          asset.Product || '',
          asset.Type || '',
          asset.Visual_keyword || '',
          asset.Visual_description || '',
          asset.Placeholder_name || '',
          asset.Version || '',
          asset.File_format || '',
          asset.File_driveID || '',
          asset.File_name || '',
          asset.File_size || '',
          asset.File_date || '',
          asset.File_dimensions || '',
          asset.File_DirectLink || '',
          asset.File_thumbnail || ''
        ])
      ];
      promises.push(this.write('Assets', assetsRows));
    }

    // Include creatives if provided
    if (creativesData && creativesData.length > 0) {
      const creativesRows = [
        ['ID', 'Brand', 'Product', 'Type', 'Visual_keyword', 'Visual_description', 'MC_Number', 'MC_Variant', 'Version', 'File_format', 'File_driveID', 'File_name', 'File_size', 'File_date', 'File_dimensions', 'File_DirectLink', 'File_thumbnail', 'Is_Dynamic'],
        ...creativesData.map(creative => [
          creative.ID || '',
          creative.Brand || '',
          creative.Product || '',
          creative.Type || '',
          creative.Visual_keyword || '',
          creative.Visual_description || '',
          creative.MC_Number || '',
          creative.MC_Variant || '',
          creative.Version || '',
          creative.File_format || '',
          creative.File_driveID || '',
          creative.File_name || '',
          creative.File_size || '',
          creative.File_date || '',
          creative.File_dimensions || '',
          creative.File_DirectLink || '',
          creative.File_thumbnail || '',
          creative.Is_Dynamic || ''
        ])
      ];
      promises.push(this.write('Creatives', creativesRows));
    }

    await Promise.all(promises);
  }

  // Helper function to create a column map from header row
  createColumnMap(headerRow) {
    const map = {};
    headerRow.forEach((header, index) => {
      map[header] = index;
    });
    return map;
  }

  // Helper function to get value from row using column name
  getValue(row, columnMap, columnName, defaultValue = '') {
    const index = columnMap[columnName];
    return (index !== undefined && row[index] !== undefined) ? row[index] : defaultValue;
  }

  // Parse audiences using column names instead of indexes
  parseAudiences(rows) {
    if (!rows || rows.length < 2) return [];

    const headerRow = rows[0];
    const columnMap = this.createColumnMap(headerRow);

    return rows.slice(1).map((row, idx) => {
      return {
        id: parseInt(this.getValue(row, columnMap, 'ID')) || idx + 1,
        name: this.getValue(row, columnMap, 'Name'),
        order: parseInt(this.getValue(row, columnMap, 'Order')) || idx + 1,
        status: this.getValue(row, columnMap, 'Status'),
        product: this.getValue(row, columnMap, 'Product'),
        strategy: this.getValue(row, columnMap, 'Strategy'),
        buying_platform: this.getValue(row, columnMap, 'Buying_platform'),
        data_source: this.getValue(row, columnMap, 'Data_source'),
        targeting_type: this.getValue(row, columnMap, 'Targeting_type'),
        device: this.getValue(row, columnMap, 'Device'),
        tag: this.getValue(row, columnMap, 'Tag'),
        key: this.getValue(row, columnMap, 'Key') || `aud${idx + 1}`,
        comment: this.getValue(row, columnMap, 'Comment'),
        campaign_name: this.getValue(row, columnMap, 'Campaign_name'),
        campaign_id: this.getValue(row, columnMap, 'Campaign_ID'),
        lineitem_name: this.getValue(row, columnMap, 'Lineitem_name'),
        lineitem_id: this.getValue(row, columnMap, 'Lineitem_ID')
      };
    });
  }

  // Parse topics using column names instead of indexes
  parseTopics(rows) {
    if (!rows || rows.length < 2) return [];

    const headerRow = rows[0];
    const columnMap = this.createColumnMap(headerRow);

    return rows.slice(1).map((row, idx) => {
      return {
        id: parseInt(this.getValue(row, columnMap, 'ID')) || idx + 1,
        name: this.getValue(row, columnMap, 'Name'),
        key: this.getValue(row, columnMap, 'Key') || `top${idx + 1}`,
        order: parseInt(this.getValue(row, columnMap, 'Order')) || idx + 1,
        status: this.getValue(row, columnMap, 'Status'),
        product: this.getValue(row, columnMap, 'Product'),
        tag1: this.getValue(row, columnMap, 'Tag1'),
        tag2: this.getValue(row, columnMap, 'Tag2'),
        tag3: this.getValue(row, columnMap, 'Tag3'),
        tag4: this.getValue(row, columnMap, 'Tag4'),
        created: this.getValue(row, columnMap, 'Created'),
        comment: this.getValue(row, columnMap, 'Comment')
      };
    });
  }

  // Parse messages using column names instead of indexes
  parseMessages(rows) {
    if (!rows || rows.length < 2) return [];

    const headerRow = rows[0];
    const columnMap = this.createColumnMap(headerRow);

    return rows.slice(1)
      .filter(row => {
        // Skip empty rows or rows without required fields
        const hasId = this.getValue(row, columnMap, 'ID') || this.getValue(row, columnMap, 'Name');
        const hasAudience = this.getValue(row, columnMap, 'Audience_Key');
        const hasTopic = this.getValue(row, columnMap, 'Topic_Key');
        return hasId && hasAudience && hasTopic;
      })
      .map((row) => {
        const message = {
          id: parseInt(this.getValue(row, columnMap, 'ID')) || null,
          poms_id: this.getValue(row, columnMap, 'POMS_ID'),
          name: this.getValue(row, columnMap, 'Name'),
          number: parseInt(this.getValue(row, columnMap, 'Number')) || 1,
          variant: this.getValue(row, columnMap, 'Variant') || 'a',
          audience: this.getValue(row, columnMap, 'Audience_Key'),
          topic: this.getValue(row, columnMap, 'Topic_Key'),
          version: parseInt(this.getValue(row, columnMap, 'Version')) || 1,
          pmmid: this.getValue(row, columnMap, 'PMMID'),
          status: this.getValue(row, columnMap, 'Status'),
          start_date: this.getValue(row, columnMap, 'Start_date'),
          end_date: this.getValue(row, columnMap, 'End_date'),
          template: this.getValue(row, columnMap, 'Template'),
          template_variant_classes: this.getValue(row, columnMap, 'Template_variant_classes'),
          headline: this.getValue(row, columnMap, 'Headline'),
          copy1: this.getValue(row, columnMap, 'Copy1'),
          copy2: this.getValue(row, columnMap, 'Copy2'),
          disclaimer: this.getValue(row, columnMap, 'Disclaimer'),
          headline_style: this.getValue(row, columnMap, 'Headline_style'),
          copy1_style: this.getValue(row, columnMap, 'Copy1_style'),
          copy2_style: this.getValue(row, columnMap, 'Copy2_style'),
          disclaimer_style: this.getValue(row, columnMap, 'Disclaimer_style'),
          css: this.getValue(row, columnMap, 'CSS'),
          image1: this.getValue(row, columnMap, 'Image1'),
          image2: this.getValue(row, columnMap, 'Image2'),
          image3: this.getValue(row, columnMap, 'Image3'),
          image4: this.getValue(row, columnMap, 'Image4'),
          image5: this.getValue(row, columnMap, 'Image5'),
          image6: this.getValue(row, columnMap, 'Image6'),
          flash: this.getValue(row, columnMap, 'Flash'),
          flash_style: this.getValue(row, columnMap, 'Flash_style'),
          cta: this.getValue(row, columnMap, 'CTA'),
          cta_style: this.getValue(row, columnMap, 'CTA_style'),
          landingUrl: this.getValue(row, columnMap, 'Landing_URL'),
          comment: this.getValue(row, columnMap, 'Comment'),
          // Trafficking fields
          utm_campaign: this.getValue(row, columnMap, 'UTM_Campaign'),
          utm_source: this.getValue(row, columnMap, 'UTM_Source'),
          utm_medium: this.getValue(row, columnMap, 'UTM_Medium'),
          utm_content: this.getValue(row, columnMap, 'UTM_Content'),
          utm_term: this.getValue(row, columnMap, 'UTM_Term'),
          utm_cd26: this.getValue(row, columnMap, 'UTM_CD26'),
          final_trafficked_url: this.getValue(row, columnMap, 'Final_Trafficked_URL')
        };

        return message;
      });
  }

  // Parse keywords - three column structure (form, field, values)
  parseKeywords(rows) {
    if (!rows || rows.length < 2) return {};

    const keywords = {};

    rows.slice(1).forEach((row) => {
      const form = row[0];   // First column: form name (audiences, topics, messages)
      const field = row[1];  // Second column: field name (product, strategy, etc)
      const values = row[2]; // Third column: comma-separated values

      // Include field even if values are empty (form and field must be present)
      if (form && field) {
        // Normalize form and field to lowercase with underscores
        const normalizedForm = form.toLowerCase().trim();
        const normalizedField = field.toLowerCase().trim().replace(/\s+/g, '_');

        // Create nested structure: keywords.audiences.product = ['ANY', 'SZK', ...]
        if (!keywords[normalizedForm]) {
          keywords[normalizedForm] = {};
        }
        // If values is empty, create empty array
        keywords[normalizedForm][normalizedField] = values
          ? values.split(',').map(v => v.trim()).filter(v => v)
          : [];
      }
    });

    return keywords;
  }

  // Parse assets from spreadsheet
  parseAssets(rows) {
    if (!rows || rows.length < 2) return [];

    const headerRow = rows[0];
    const columnMap = this.createColumnMap(headerRow);

    return rows.slice(1)
      .filter(row => row.length > 0 && row.some(cell => cell))
      .map(row => {
        return {
          ID: this.getValue(row, columnMap, 'ID'),
          Brand: this.getValue(row, columnMap, 'Brand'),
          Product: this.getValue(row, columnMap, 'Product'),
          Type: this.getValue(row, columnMap, 'Type'),
          Visual_keyword: this.getValue(row, columnMap, 'Visual_keyword'),
          Visual_description: this.getValue(row, columnMap, 'Visual_description'),
          Placeholder_name: this.getValue(row, columnMap, 'Placeholder_name'),
          Version: this.getValue(row, columnMap, 'Version'),
          File_format: this.getValue(row, columnMap, 'File_format'),
          File_driveID: this.getValue(row, columnMap, 'File_driveID'),
          File_name: this.getValue(row, columnMap, 'File_name'),
          File_size: this.getValue(row, columnMap, 'File_size'),
          File_date: this.getValue(row, columnMap, 'File_date'),
          File_dimensions: this.getValue(row, columnMap, 'File_dimensions'),
          File_DirectLink: this.getValue(row, columnMap, 'File_DirectLink'),
          File_thumbnail: this.getValue(row, columnMap, 'File_thumbnail')
        };
      });
  }

  // Parse creatives from spreadsheet
  parseCreatives(rows) {
    if (!rows || rows.length < 2) return [];

    const headerRow = rows[0];
    const columnMap = this.createColumnMap(headerRow);

    return rows.slice(1)
      .filter(row => row.length > 0 && row.some(cell => cell))
      .map(row => {
        return {
          ID: this.getValue(row, columnMap, 'ID'),
          Brand: this.getValue(row, columnMap, 'Brand'),
          Product: this.getValue(row, columnMap, 'Product'),
          Type: this.getValue(row, columnMap, 'Type'),
          Visual_keyword: this.getValue(row, columnMap, 'Visual_keyword'),
          Visual_description: this.getValue(row, columnMap, 'Visual_description'),
          MC_Number: this.getValue(row, columnMap, 'MC_Number'),
          MC_Variant: this.getValue(row, columnMap, 'MC_Variant'),
          Version: this.getValue(row, columnMap, 'Version'),
          File_format: this.getValue(row, columnMap, 'File_format'),
          File_driveID: this.getValue(row, columnMap, 'File_driveID'),
          File_name: this.getValue(row, columnMap, 'File_name'),
          File_size: this.getValue(row, columnMap, 'File_size'),
          File_date: this.getValue(row, columnMap, 'File_date'),
          File_dimensions: this.getValue(row, columnMap, 'File_dimensions'),
          File_DirectLink: this.getValue(row, columnMap, 'File_DirectLink'),
          File_thumbnail: this.getValue(row, columnMap, 'File_thumbnail'),
          Is_Dynamic: this.getValue(row, columnMap, 'Is_Dynamic')
        };
      });
  }

  // Save keywords
  async saveKeywords(keywords) {
    const keywordRows = [
      ['Category', 'Value', 'Label']
    ];

    // Add all keywords by category
    Object.entries(keywords).forEach(([category, values]) => {
      values.forEach(item => {
        keywordRows.push([
          category.charAt(0).toUpperCase() + category.slice(1),
          item.value,
          item.label || item.value
        ]);
      });
    });

    await this.write('Keywords', keywordRows);
  }

  // Get spreadsheet URL
  getUrl() {
    return `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`;
  }
}

export default new SheetsService();

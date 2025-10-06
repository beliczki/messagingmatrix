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
      console.log(`Loaded ${sheetName} from localStorage`);
      return JSON.parse(stored);
    }

    // Try reading from Google Sheets using service account if configured
    if (this.serviceAccountKey && this.spreadsheetId) {
      try {
        const token = await this.getAccessToken();
        const url = `${this.baseUrl}/${this.spreadsheetId}/values/${sheetName}`;
        console.log(`Fetching ${sheetName} from Google Sheets with service account:`, url);

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });

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
      console.warn('Google Sheets service account key or spreadsheet ID not configured');
    }

    return [];
  }

  // Write data to localStorage and Google Sheets
  async write(sheetName, values) {
    // Always save to localStorage
    localStorage.setItem(`${this.storageKey}_${sheetName}`, JSON.stringify(values));

    // Try to write to Google Sheets if service account is configured
    if (this.serviceAccountKey && this.spreadsheetId) {
      try {
        const token = await this.getAccessToken();

        // Step 1: Clear the entire sheet first
        const clearUrl = `${this.baseUrl}/${this.spreadsheetId}/values/${sheetName}:clear`;

        const clearResponse = await fetch(clearUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
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
        const url = `${this.baseUrl}/${this.spreadsheetId}/values/${sheetName}?valueInputOption=RAW`;

        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: sheetName,
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
    const [audiences, topics, messages] = await Promise.all([
      this.read('Audiences'),
      this.read('Topics'),
      this.read('Messages')
    ]);

    return {
      audiences: this.parseAudiences(audiences),
      topics: this.parseTopics(topics),
      messages: this.parseMessages(messages)
    };
  }

  // Save all data
  async saveAll(audiences, topics, messages) {
    const audienceRows = [
      ['ID', 'Name', 'Key', 'Order', 'Status'],
      ...audiences.map(a => [a.id, a.name, a.key, a.order, a.status || ''])
    ];

    const topicRows = [
      ['ID', 'Name', 'Key', 'Order', 'Status'],
      ...topics.map(t => [t.id, t.name, t.key, t.order, t.status || ''])
    ];

    const messageRows = [
      ['ID', 'Name', 'Number', 'Variant', 'Audience_Key', 'Topic_Key', 'Version', 'Status', 'Template', 'Landing_URL', 'Headline', 'Copy1', 'Copy2', 'Flash', 'CTA', 'Comment'],
      ...messages
        .filter(m => m.status !== 'deleted')
        .map(m => [
          m.id || '',           // A: Numeric ID
          m.name || '',         // B: Name (compound key like "aud1!top1!m1a!v1")
          m.number || 1,
          m.variant || 'a',
          m.audience,
          m.topic,
          m.version || 1,
          m.status || '',
          m.template || '',
          m.landingUrl || '',
          m.headline || '',
          m.copy1 || '',
          m.copy2 || '',
          m.flash || '',
          m.cta || '',
          m.comment || ''
        ])
    ];

    await Promise.all([
      this.write('Audiences', audienceRows),
      this.write('Topics', topicRows),
      this.write('Messages', messageRows)
    ]);
  }

  // Parse audiences
  // Columns: A=ID, B=Name, C=Key, D=Order, E=Status
  parseAudiences(rows) {
    if (!rows || rows.length < 2) return [];
    return rows.slice(1).map((row, idx) => ({
      id: parseInt(row[0]) || idx + 1,  // A: Numeric ID
      name: row[1] || '',                // B: Name
      key: row[2] || `aud${idx + 1}`,   // C: Key
      order: parseInt(row[3]) || idx + 1,
      status: row[4] || ''
    }));
  }

  // Parse topics
  // Columns: A=ID, B=Name, C=Key, D=Order, E=Status
  parseTopics(rows) {
    if (!rows || rows.length < 2) return [];
    return rows.slice(1).map((row, idx) => ({
      id: parseInt(row[0]) || idx + 1,  // A: Numeric ID
      name: row[1] || '',                // B: Name
      key: row[2] || `top${idx + 1}`,   // C: Key
      order: parseInt(row[3]) || idx + 1,
      status: row[4] || ''
    }));
  }

  // Parse messages
  // Columns: A=ID, B=Name, C=Number, D=Variant, E=Audience_Key, F=Topic_Key, G=Version, H=Status, I=Template, J=Landing_URL, K=Headline, L=Copy1, M=Copy2, N=Flash, O=CTA, P=Comment
  parseMessages(rows) {
    if (!rows || rows.length < 2) return [];

    console.log('Parsing messages from sheet:', rows);

    return rows.slice(1)
      .filter(row => {
        // Skip empty rows or rows without required fields
        const hasId = row[0] || row[1];
        const hasAudience = row[4];
        const hasTopic = row[5];
        return hasId && hasAudience && hasTopic;
      })
      .map((row) => {
        const message = {
          id: parseInt(row[0]) || null,  // A: Numeric ID
          name: row[1] || row[0],        // B: Name (compound key)
          number: parseInt(row[2]) || 1, // C: Number
          variant: row[3] || 'a',        // D: Variant
          audience: row[4],              // E: Audience_Key
          topic: row[5],                 // F: Topic_Key
          version: parseInt(row[6]) || 1, // G: Version
          status: row[7] || '',          // H: Status (empty = PLANNED)
          template: row[8] || '',        // I: Template
          landingUrl: row[9] || '',      // J: Landing_URL
          headline: row[10] || '',       // K: Headline
          copy1: row[11] || '',          // L: Copy1
          copy2: row[12] || '',          // M: Copy2
          flash: row[13] || '',          // N: Flash
          cta: row[14] || '',            // O: CTA
          comment: row[15] || ''         // P: Comment
        };

        console.log(`Parsed: ${message.name} (ID: ${message.id}) -> Topic:"${message.topic}" Audience:"${message.audience}" Headline:"${message.headline}"`);
        return message;
      });
  }

  // Get spreadsheet URL
  getUrl() {
    return `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`;
  }
}

export default new SheetsService();

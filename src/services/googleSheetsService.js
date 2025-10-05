// Google Sheets API Service
// This service handles all Google Sheets operations using the browser-compatible API

class GoogleSheetsService {
  constructor() {
    this.apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
    this.spreadsheetId = import.meta.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID;
    this.baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  }

  // Initialize the service and validate configuration
  async initialize() {
    if (!this.apiKey) {
      throw new Error('Google Sheets API key not configured. Please set VITE_GOOGLE_SHEETS_API_KEY in your .env file.');
    }
    if (!this.spreadsheetId) {
      throw new Error('Spreadsheet ID not configured. Please set VITE_GOOGLE_SHEETS_SPREADSHEET_ID in your .env file.');
    }
    
    // Test the connection
    try {
      await this.getSpreadsheetInfo();
      return true;
    } catch (error) {
      throw new Error(`Failed to connect to Google Sheets: ${error.message}`);
    }
  }

  // Get basic spreadsheet information
  async getSpreadsheetInfo() {
    const url = `${this.baseUrl}/${this.spreadsheetId}?key=${this.apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch spreadsheet info');
    }
    
    return await response.json();
  }

  // Read data from a specific range
  async readRange(range = 'Sheet1!A:Z') {
    const url = `${this.baseUrl}/${this.spreadsheetId}/values/${range}?key=${this.apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to read data');
    }
    
    const data = await response.json();
    return data.values || [];
  }

  // Parse spreadsheet data into structured format for Claude artifacts
  parseSpreadsheetData(rows) {
    if (!rows || rows.length === 0) {
      return { audiences: [], topics: [], messages: [] };
    }

    const audiences = [];
    const topics = [];
    const messages = [];

    // Skip header row if it exists
    const dataRows = rows[0]?.includes('Type') ? rows.slice(1) : rows;

    dataRows.forEach((row, index) => {
      if (!row || row.length === 0) return;

      const type = row[0]?.trim();
      const name = row[1]?.trim();
      const key = row[2]?.trim();

      if (type === 'Audience' && name && key) {
        audiences.push({
          id: audiences.length + 1,
          name,
          key
        });
      } else if (type === 'Topic' && name && key) {
        topics.push({
          id: topics.length + 1,
          name,
          key
        });
      } else if (type === 'Message' && row.length >= 9) {
        const topicKey = row[3]?.trim();
        const audienceKey = row[4]?.trim();
        const messageNumber = parseInt(row[5]?.trim());
        const variant = row[6]?.trim();
        const messageId = row[7]?.trim();
        const content = row[8]?.trim();

        if (topicKey && audienceKey && messageNumber && variant && messageId && content) {
          messages.push({
            topicKey,
            audienceKey,
            messageNumber,
            variant,
            messageId,
            content
          });
        }
      }
    });

    return { audiences, topics, messages };
  }

  // Sync data from spreadsheet
  async syncFromSpreadsheet() {
    try {
      const rows = await this.readRange('Sheet1!A:I'); // Adjust range as needed
      return this.parseSpreadsheetData(rows);
    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    }
  }

  // Get spreadsheet URL for manual editing
  getSpreadsheetUrl() {
    return `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`;
  }

  // Generate sample data structure for the spreadsheet
  generateSampleData() {
    return [
      ['Type', 'Name', 'Key', 'TopicKey', 'AudienceKey', 'MessageNumber', 'Variant', 'MessageID', 'Content'],
      ['Audience', 'Young Adults', 'ya', '', '', '', '', '', ''],
      ['Audience', 'Professionals', 'prof', '', '', '', '', '', ''],
      ['Topic', 'Product Launch', 'launch', '', '', '', '', '', ''],
      ['Topic', 'Brand Awareness', 'brand', '', '', '', '', '', ''],
      ['Message', '', '', 'launch', 'ya', '1', 'a', 'ya!launch!m1!a', 'Exciting new product for young innovators!'],
      ['Message', '', '', 'launch', 'prof', '1', 'a', 'prof!launch!m1!a', 'Professional-grade solution for your business needs.'],
      ['Message', '', '', 'brand', 'ya', '2', 'a', 'ya!brand!m2!a', 'Join the movement of creative young minds!']
    ];
  }
}

// Export singleton instance
export default new GoogleSheetsService();

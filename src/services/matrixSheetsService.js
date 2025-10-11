// Matrix Editor Google Sheets Service
// Handles multiple sheets: audiences, topics, messages, templates

// Import secrets configuration
import secrets from '../../secrets.local.js';

class MatrixSheetsService {
  constructor() {
    this.spreadsheetId = secrets.google.spreadsheetId;
    this.clientId = secrets.google.clientId;
    this.clientSecret = secrets.google.clientSecret;
    this.apiKey = secrets.google.apiKey;
    this.baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    
    this.sheets = {
      audiences: 'audiences',
      topics: 'topics', 
      messages: 'messages',
      templates: 'templates'
    };
  }

  // Initialize and test connection
  async initialize() {
    const { default: serviceAccountAuth } = await import('./serviceAccountAuth');
    
    if (!serviceAccountAuth.isConfigured()) {
      throw new Error('Service account not configured. Please set VITE_GOOGLE_SERVICE_ACCOUNT_KEY in your .env file.');
    }
    
    try {
      await this.getSpreadsheetInfo();
      return true;
    } catch (error) {
      throw new Error(`Failed to connect to Google Sheets: ${error.message}`);
    }
  }

  // Get spreadsheet info using service account
  async getSpreadsheetInfo() {
    const { default: serviceAccountAuth } = await import('./serviceAccountAuth');
    const url = `${this.baseUrl}/${this.spreadsheetId}`;
    
    try {
      return await serviceAccountAuth.makeAuthenticatedRequest(url);
    } catch (error) {
      throw new Error(error.message || 'Failed to fetch spreadsheet info');
    }
  }

  // Read data from a specific sheet using service account
  async readSheet(sheetName, range = 'A:Z') {
    const { default: serviceAccountAuth } = await import('./serviceAccountAuth');
    const fullRange = `${sheetName}!${range}`;
    const url = `${this.baseUrl}/${this.spreadsheetId}/values/${fullRange}`;
    
    try {
      const data = await serviceAccountAuth.makeAuthenticatedRequest(url);
      return data.values || [];
    } catch (error) {
      console.error(`Error reading ${sheetName}:`, error);
      throw error;
    }
  }

  // Parse audiences data
  parseAudiences(rows) {
    if (!rows || rows.length <= 1) return [];

    const audiences = [];
    const dataRows = rows.slice(1); // Skip header

    dataRows.forEach((row, index) => {
      if (!row || row.length === 0) return;

      const [id, name, order, status, strategy, buying_platform, data_source, targeting_type, device, tag, key, comment, campaign_name, campaign_id, lineitem_name, lineitem_id] = row;
      if (name && key) {
        audiences.push({
          id: id?.trim() || `aud_${index + 1}`,
          name: name.trim(),
          order: parseInt(order) || index + 1,
          status: status?.trim() || 'active',
          strategy: strategy?.trim() || '',
          buying_platform: buying_platform?.trim() || '',
          data_source: data_source?.trim() || '',
          targeting_type: targeting_type?.trim() || '',
          device: device?.trim() || '',
          tag: tag?.trim() || '',
          key: key.trim(),
          comment: comment?.trim() || '',
          campaign_name: campaign_name?.trim() || '',
          campaign_id: campaign_id?.trim() || '',
          lineitem_name: lineitem_name?.trim() || '',
          lineitem_id: lineitem_id?.trim() || ''
        });
      }
    });

    return audiences.sort((a, b) => a.order - b.order);
  }

  // Parse topics data
  parseTopics(rows) {
    if (!rows || rows.length <= 1) return [];

    const topics = [];
    const dataRows = rows.slice(1); // Skip header

    dataRows.forEach((row, index) => {
      if (!row || row.length === 0) return;

      const [id, name, key, order, status, tag1, tag2, tag3, tag4, created, comment] = row;
      if (name && key) {
        topics.push({
          id: id?.trim() || `topic_${index + 1}`,
          name: name.trim(),
          key: key.trim(),
          order: parseInt(order) || index + 1,
          status: status?.trim() || 'active',
          tag1: tag1?.trim() || '',
          tag2: tag2?.trim() || '',
          tag3: tag3?.trim() || '',
          tag4: tag4?.trim() || '',
          created: created?.trim() || '',
          comment: comment?.trim() || ''
        });
      }
    });

    return topics.sort((a, b) => a.order - b.order);
  }

  // Parse templates data
  parseTemplates(rows) {
    if (!rows || rows.length <= 1) return [];
    
    const templates = [];
    const dataRows = rows.slice(1); // Skip header
    
    dataRows.forEach((row, index) => {
      if (!row || row.length === 0) return;
      
      const [name, type, dimensions, version] = row;
      if (name) {
        templates.push({
          id: index + 1,
          name: name.trim(),
          type: type?.trim() || '',
          dimensions: dimensions?.trim() || '',
          version: version?.trim() || '1.0'
        });
      }
    });
    
    return templates;
  }

  // Parse messages data
  parseMessages(rows) {
    if (!rows || rows.length <= 1) return [];
    
    const messages = [];
    const dataRows = rows.slice(1); // Skip header
    
    dataRows.forEach((row, index) => {
      if (!row || row.length === 0) return;
      
      const [
        name, number, variant, audience, topic, version, template,
        landingUrl, headline, copy1, copy2, flash, cta, comment, status
      ] = row;
      
      if (name && number && audience && topic) {
        messages.push({
          id: `msg_${index + 1}`,
          name: name.trim(),
          number: parseInt(number) || 1,
          variant: variant?.trim() || 'a',
          audience: audience.trim(),
          topic: topic.trim(),
          version: parseInt(version) || 1,
          template: template?.trim() || '',
          landingUrl: landingUrl?.trim() || '',
          headline: headline?.trim() || '',
          copy1: copy1?.trim() || '',
          copy2: copy2?.trim() || '',
          flash: flash?.trim() || '',
          cta: cta?.trim() || '',
          comment: comment?.trim() || '',
          status: status?.trim() || 'active',
          isNew: false,
          isModified: false
        });
      }
    });
    
    return messages;
  }

  // Generate message name based on pattern
  generateMessageName(audience, topic, number, variant, version) {
    return `${audience}!${topic}!m${number}!${variant}!n${version}`;
  }

  // Get next message number for a topic-audience combination
  getNextMessageNumber(messages, topic, audience) {
    const existingMessages = messages.filter(m => 
      m.topic === topic && m.audience === audience
    );
    
    if (existingMessages.length === 0) {
      // Find the highest message number across all combinations
      const allNumbers = messages.map(m => m.number);
      return Math.max(0, ...allNumbers) + 1;
    }
    
    return existingMessages[0].number; // Same number, different variant
  }

  // Get next variant letter for a message number
  getNextVariant(messages, topic, audience, number) {
    const existingVariants = messages
      .filter(m => m.topic === topic && m.audience === audience && m.number === number)
      .map(m => m.variant);
    
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    for (let i = 0; i < letters.length; i++) {
      if (!existingVariants.includes(letters[i])) {
        return letters[i];
      }
    }
    return 'a'; // Fallback
  }

  // Sync all data from spreadsheet
  async syncAllData() {
    try {
      const [audiencesRows, topicsRows, messagesRows, templatesRows] = await Promise.all([
        this.readSheet(this.sheets.audiences),
        this.readSheet(this.sheets.topics),
        this.readSheet(this.sheets.messages),
        this.readSheet(this.sheets.templates)
      ]);

      const audiences = this.parseAudiences(audiencesRows);
      const topics = this.parseTopics(topicsRows);
      const messages = this.parseMessages(messagesRows);
      const templates = this.parseTemplates(templatesRows);

      return {
        audiences,
        topics,
        messages,
        templates
      };
    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    }
  }

  // Get spreadsheet URL for manual editing
  getSpreadsheetUrl() {
    return `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`;
  }

  // Write data back to sheets using service account
  async writeToSheet(sheetName, data, range = 'A:Z') {
    const { default: serviceAccountAuth } = await import('./serviceAccountAuth');
    
    if (!serviceAccountAuth.isConfigured()) {
      throw new Error('Service account not configured. Please set VITE_GOOGLE_SHEETS_API_KEY.');
    }

    const fullRange = `${sheetName}!${range}`;
    const url = `${this.baseUrl}/${this.spreadsheetId}/values/${fullRange}?valueInputOption=USER_ENTERED`;
    
    const requestBody = {
      values: data
    };

    try {
      const response = await serviceAccountAuth.makeAuthenticatedRequest(url, {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      return { success: true, response };
    } catch (error) {
      console.error(`Failed to write to ${sheetName}:`, error);
      throw error;
    }
  }

  // Append data to sheet
  async appendToSheet(sheetName, data) {
    const { default: serviceAccountAuth } = await import('./serviceAccountAuth');
    
    if (!serviceAccountAuth.isConfigured()) {
      throw new Error('Service account not configured. Please set VITE_GOOGLE_SHEETS_API_KEY.');
    }

    const url = `${this.baseUrl}/${this.spreadsheetId}/values/${sheetName}:append?valueInputOption=USER_ENTERED`;
    
    const requestBody = {
      values: data
    };

    try {
      const response = await serviceAccountAuth.makeAuthenticatedRequest(url, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      return { success: true, response };
    } catch (error) {
      console.error(`Failed to append to ${sheetName}:`, error);
      throw error;
    }
  }

  // Update specific range in sheet
  async updateRange(sheetName, range, data) {
    const { default: serviceAccountAuth } = await import('./serviceAccountAuth');
    
    if (!serviceAccountAuth.isConfigured()) {
      throw new Error('Service account not configured. Please set VITE_GOOGLE_SHEETS_API_KEY.');
    }

    const fullRange = `${sheetName}!${range}`;
    const url = `${this.baseUrl}/${this.spreadsheetId}/values/${fullRange}?valueInputOption=USER_ENTERED`;
    
    const requestBody = {
      values: data
    };

    try {
      const response = await serviceAccountAuth.makeAuthenticatedRequest(url, {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      return { success: true, response };
    } catch (error) {
      console.error(`Failed to update range ${fullRange}:`, error);
      throw error;
    }
  }

  // Save changes from change log
  async saveChangesToSpreadsheet(changeLog) {
    const { default: serviceAccountAuth } = await import('./serviceAccountAuth');
    
    if (!serviceAccountAuth.isConfigured()) {
      throw new Error('Service account not configured. Please set VITE_GOOGLE_SHEETS_API_KEY.');
    }

    const results = [];
    const errors = [];

    try {
      // Group changes by type and sheet
      const changesBySheet = this.groupChangesBySheet(changeLog);

      // Process each sheet's changes
      for (const [sheetName, changes] of Object.entries(changesBySheet)) {
        try {
          if (sheetName === 'audiences') {
            await this.saveAudienceChanges(changes);
          } else if (sheetName === 'topics') {
            await this.saveTopicChanges(changes);
          } else if (sheetName === 'messages') {
            await this.saveMessageChanges(changes);
          }
          
          results.push({ sheet: sheetName, success: true, count: changes.length });
        } catch (error) {
          errors.push({ sheet: sheetName, error: error.message, count: changes.length });
        }
      }

      return { 
        success: errors.length === 0, 
        results, 
        errors,
        totalChanges: changeLog.length 
      };

    } catch (error) {
      console.error('Failed to save changes:', error);
      throw error;
    }
  }

  // Group changes by the sheet they affect
  groupChangesBySheet(changeLog) {
    const groups = {
      audiences: [],
      topics: [],
      messages: []
    };

    changeLog.forEach(change => {
      if (change.type === 'audience') {
        groups.audiences.push(change);
      } else if (change.type === 'topic') {
        groups.topics.push(change);
      } else if (change.type === 'message') {
        groups.messages.push(change);
      }
    });

    // Only return groups that have changes
    return Object.fromEntries(
      Object.entries(groups).filter(([_, changes]) => changes.length > 0)
    );
  }

  // Ensure the Status column exists in the messages sheet
  async ensureStatusColumn(currentData) {
    if (!currentData || currentData.length === 0) {
      console.log('No current data in messages sheet');
      return;
    }

    const headerRow = currentData[0];
    console.log('Current header row has', headerRow.length, 'columns:', headerRow);

    // Check if Status column (15th column) exists
    if (headerRow.length < 15 || !headerRow[14] || headerRow[14].toLowerCase() !== 'status') {
      console.log('Status column missing or incorrect. Current 15th column:', headerRow[14]);
      
      // Create the updated header row
      const updatedHeader = [...headerRow];
      
      // Ensure we have exactly 15 columns with proper headers
      const expectedHeaders = [
        'Name', 'Number', 'Variant', 'Audience', 'Topic', 'Version', 
        'Template', 'Landing URL', 'Headline', 'Copy1', 'Copy2', 
        'Flash', 'CTA', 'Comment', 'Status'
      ];
      
      // Fill in any missing columns up to position 15
      for (let i = 0; i < 15; i++) {
        if (!updatedHeader[i] || updatedHeader[i].trim() === '') {
          updatedHeader[i] = expectedHeaders[i];
        }
      }
      
      // If we don't have a Status column at position 15, add it
      if (updatedHeader.length < 15 || updatedHeader[14].toLowerCase() !== 'status') {
        updatedHeader[14] = 'Status';
      }
      
      console.log('Updating header row to:', updatedHeader);
      
      try {
        // Update the header row
        await this.updateRange('messages', 'A1:O1', [updatedHeader]);
        console.log('Successfully updated header row with Status column');
      } catch (error) {
        console.error('Failed to update header row:', error);
        // Continue anyway - the data will still be written to column 15
      }
    } else {
      console.log('Status column already exists at position 15');
    }
  }

  // Save audience changes
  async saveAudienceChanges(changes) {
    // Read current audiences to get the right row positions
    const currentData = await this.readSheet('audiences');

    for (const change of changes) {
      if (change.action === 'create') {
        // Append new audience
        const newRow = [
          change.data.id || '',
          change.data.name,
          change.data.order,
          change.data.status || 'active',
          change.data.strategy || '',
          change.data.buying_platform || '',
          change.data.data_source || '',
          change.data.targeting_type || '',
          change.data.device || '',
          change.data.tag || '',
          change.data.key,
          change.data.comment || '',
          change.data.campaign_name || '',
          change.data.campaign_id || '',
          change.data.lineitem_name || '',
          change.data.lineitem_id || ''
        ];
        await this.appendToSheet('audiences', [newRow]);
      }
      // Add update/delete logic here if needed
    }
  }

  // Save topic changes
  async saveTopicChanges(changes) {
    // Read current topics to get the right row positions
    const currentData = await this.readSheet('topics');

    for (const change of changes) {
      if (change.action === 'create') {
        // Append new topic
        const newRow = [
          change.data.id || '',
          change.data.name,
          change.data.key,
          change.data.order,
          change.data.status || 'active',
          change.data.tag1 || '',
          change.data.tag2 || '',
          change.data.tag3 || '',
          change.data.tag4 || '',
          change.data.created || new Date().toISOString().split('T')[0],
          change.data.comment || ''
        ];
        await this.appendToSheet('topics', [newRow]);
      }
      // Add update/delete logic here if needed
    }
  }

  // Save message changes
  async saveMessageChanges(changes) {
    // Read current messages to get the right row positions
    const currentData = await this.readSheet('messages');
    
    // Check if Status column exists and add header if needed
    await this.ensureStatusColumn(currentData);
    
    for (const change of changes) {
      if (change.action === 'create') {
        // Append new message
        const newRow = [
          change.data.name,
          change.data.number,
          change.data.variant,
          change.data.audience,
          change.data.topic,
          change.data.version,
          change.data.template || '',
          change.data.landingUrl || '',
          change.data.headline || '',
          change.data.copy1 || '',
          change.data.copy2 || '',
          change.data.flash || '',
          change.data.cta || '',
          change.data.comment || '',
          change.data.status || 'active'
        ];
        await this.appendToSheet('messages', [newRow]);
      } else if (change.action === 'remove') {
        // Handle removal by appending new row with status 'removed'
        console.log('Message removal - appending row with status=removed:', change.data.name);
        
        const updatedRow = [
          change.data.name,                    // Column 1: Name
          change.data.number,                  // Column 2: Number
          change.data.variant,                 // Column 3: Variant
          change.data.audience,                // Column 4: Audience
          change.data.topic,                   // Column 5: Topic
          change.data.version,                 // Column 6: Version
          change.data.template || '',          // Column 7: Template
          change.data.landingUrl || '',        // Column 8: Landing URL
          change.data.headline || '',          // Column 9: Headline
          change.data.copy1 || '',             // Column 10: Copy1
          change.data.copy2 || '',             // Column 11: Copy2
          change.data.flash || '',             // Column 12: Flash
          change.data.cta || '',               // Column 13: CTA
          change.data.comment || '',           // Column 14: Comment
          'removed'                            // Column 15: Status
        ];
        
        console.log('Appending row with', updatedRow.length, 'columns. Status at position 15:', updatedRow[14]);
        await this.appendToSheet('messages', [updatedRow]);
      } else if (change.action === 'update') {
        // Find the message row and update it
        // This would require more complex logic to find and update specific rows
        console.log('Message update - would need to find row and update:', change);
      } else if (change.action === 'move' || change.action === 'copy') {
        // For moves and copies, we might need to update existing rows or add new ones
        console.log('Message move/copy - complex update needed:', change);
      }
    }
  }
}

// Export singleton instance
export default new MatrixSheetsService();

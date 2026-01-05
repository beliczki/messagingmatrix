import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure Web Crypto API is available globally for jose library
if (!globalThis.crypto) {
  globalThis.crypto = crypto.webcrypto;
}

import { SignJWT, importPKCS8 } from 'jose';
import { fetchEmails, markEmailAsSeen } from './services/emailService.js';
import multer from 'multer';
import sizeOf from 'image-size';
import driveStorage from './src/services/driveStorage.js';
import { applyTextFormattingSpans } from './src/utils/textFormatter.js';
import db from './db/index.js';
import syncService from './services/syncService.js';

dotenv.config();

// Server version - increment this whenever server.js is modified
// Format: MAJOR.MINOR.PATCH (e.g., 1.0.0 -> 1.0.1 for small changes)
const SERVER_VERSION = '1.0.2';

// Initialize SQLite database
console.log('🔄 Initializing SQLite cache database...');
db.initialize();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3003;

// Load Google Service Account
let serviceAccount = null;
let accessToken = null;
let tokenExpiry = null;

try {
  const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './service-account.json';
  const fullPath = path.join(__dirname, serviceAccountPath);
  if (fs.existsSync(fullPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    console.log('✓ Service account loaded:', serviceAccount.client_email);
  } else {
    console.warn('⚠ Service account file not found at:', fullPath);
  }
} catch (error) {
  console.error('✗ Error loading service account:', error.message);
}

// Get Google OAuth2 access token using service account
async function getAccessToken() {
  // Return cached token if still valid
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  if (!serviceAccount) {
    throw new Error('Service account not configured');
  }

  try {
    // Import the private key
    const privateKey = await importPKCS8(serviceAccount.private_key, 'RS256');

    // Create JWT
    const now = Math.floor(Date.now() / 1000);
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
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 min early

    console.log('✓ Google OAuth2 token obtained');
    return accessToken;
  } catch (error) {
    console.error('✗ Error getting access token:', error);
    throw error;
  }
}

// Configure CORS dynamically based on environment
const isDevelopment = process.env.NODE_ENV !== 'production';
const allowedOrigins = [
  'https://messagingmatrix.ai',
  'http://messagingmatrix.ai',
  'https://erste.messagingmatrix.ai',
  'http://erste.messagingmatrix.ai',
  'https://telekom.messagingmatrix.ai',
  'http://telekom.messagingmatrix.ai'
];

// Add development origins
if (isDevelopment) {
  allowedOrigins.push(
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  );
}

// Add custom CORS origins from environment variable (comma-separated)
if (process.env.CORS_ORIGINS) {
  const customOrigins = process.env.CORS_ORIGINS.split(',').map(o => o.trim());
  allowedOrigins.push(...customOrigins);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`⚠ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Increase JSON body size limit to 50MB for base64 images in AI Assistant
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// JWT Authentication Middleware
function verifyToken(req, res, next) {
  // Get token from Authorization header: "Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract token after "Bearer "

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    // Split JWT into parts
    const [header, payload, signature] = token.split('.');

    if (!header || !payload || !signature) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Verify signature
    const validSignature = crypto
      .createHmac('sha256', process.env.JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== validSignature) {
      return res.status(401).json({ error: 'Invalid token signature' });
    }

    // Decode and verify payload
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());

    // Check expiration
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ error: 'Token expired' });
    }

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    next(); // Token is valid, continue to route
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Serve static files from public/share directory for HTML ad previews
app.use('/api/share-static', express.static(path.join(__dirname, 'public', 'share')));

// Google Sheets API endpoints
const SHEETS_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

// Get spreadsheet data (read from a specific sheet/range)
app.get('/api/sheets/:spreadsheetId/values/:range', verifyToken, async (req, res) => {
  try {
    const { spreadsheetId, range } = req.params;
    const token = await getAccessToken();

    const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}`;
    console.log(`Fetching sheet data: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Google Sheets API error:', error);
      return res.status(response.status).json({ error: error.error?.message || 'Failed to read sheet' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error reading sheet:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update spreadsheet data (write to a specific sheet/range)
app.put('/api/sheets/:spreadsheetId/values/:range', async (req, res) => {
  try {
    const { spreadsheetId, range } = req.params;
    const { values } = req.body;
    const token = await getAccessToken();

    const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
    console.log(`Updating sheet data: ${url}`);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        values
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Google Sheets API error:', error);
      return res.status(response.status).json({ error: error.error?.message || 'Failed to update sheet' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error updating sheet:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear spreadsheet data
app.post('/api/sheets/:spreadsheetId/values/:range/clear', verifyToken, async (req, res) => {
  try {
    const { spreadsheetId, range } = req.params;
    const token = await getAccessToken();

    const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;
    console.log(`Clearing sheet data: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Google Sheets API error:', error);
      return res.status(response.status).json({ error: error.error?.message || 'Failed to clear sheet' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error clearing sheet:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get spreadsheet metadata
app.get('/api/sheets/:spreadsheetId', verifyToken, async (req, res) => {
  try {
    const { spreadsheetId } = req.params;
    const token = await getAccessToken();

    const url = `${SHEETS_BASE_URL}/${spreadsheetId}`;
    console.log(`Fetching spreadsheet metadata: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Google Sheets API error:', error);
      return res.status(response.status).json({ error: error.error?.message || 'Failed to get spreadsheet info' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error getting spreadsheet info:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get basic config (NO AUTH REQUIRED - only lookAndFeel for login page)
app.get('/api/config-basic', (req, res) => {
  try {
    const sqlite = db.getSqlite();
    const stmt = sqlite.prepare('SELECT value FROM config WHERE key = ?');
    const row = stmt.get('lookAndFeel');

    if (!row) {
      // Return default lookAndFeel if not found
      return res.json({
        lookAndFeel: {
          logo: 'https://s3.eu-central-1.amazonaws.com/pomscloud-storage/assets/43/hu-HU/background/EBH_Logo_screen_white.svg',
          headerColor: '#2870ed',
          logoStyle: 'height: 25px; margin-top: -6px;',
          buttonColor: '#ff6130',
          buttonStyle: 'border: 1px solid white;',
          secondaryColor1: '#eb4c79',
          secondaryColor2: '#02a3a4',
          secondaryColor3: '#711c7a',
          pageTitle: 'Matrix 1.0',
          fontFamily: 'Inter',
          cobranding: {
            enabled: false,
            logoUrl: ''
          }
        }
      });
    }

    const lookAndFeel = JSON.parse(row.value);
    res.json({ lookAndFeel });
  } catch (error) {
    console.error('Error reading basic config:', error);
    res.status(500).json({ error: 'Failed to read basic config from database' });
  }
});

// Get config (from SQLite) - REQUIRES JWT AUTH
app.get('/api/config', verifyToken, (req, res) => {
  try {
    const sqlite = db.getSqlite();
    const stmt = sqlite.prepare('SELECT * FROM config');
    const rows = stmt.all();

    // Rebuild config object from key-value pairs
    const config = {};
    rows.forEach(row => {
      try {
        // Try to parse as JSON (for complex values like googleDrive, patterns, etc.)
        config[row.key] = JSON.parse(row.value);
      } catch {
        // If not JSON, use as string
        config[row.key] = row.value;
      }
    });

    res.json(config);
  } catch (error) {
    console.error('Error reading config:', error);
    res.status(500).json({ error: 'Failed to read config from database' });
  }
});

// ========================================
// SQLite Cache Layer Endpoints
// ========================================

// Get cached data from SQLite (faster than Sheets)
app.get('/api/cache/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const sqlite = db.getSqlite();

    // Validate table name (security)
    const validTables = ['audiences', 'topics', 'messages', 'assets', 'creatives', 'text_formatting'];
    if (!validTables.includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    // Check if cache is stale
    const isStale = db.isCacheStale(table, 15); // 15 minutes
    const metadata = db.getCacheMetadata(table);

    // Get data from SQLite
    const stmt = sqlite.prepare(`SELECT * FROM ${table}`);
    const rows = stmt.all();

    res.json({
      data: rows,
      cached: true,
      cacheAge: metadata?.last_sync || null,
      isStale,
      count: rows.length
    });
  } catch (error) {
    console.error(`Error reading cache for ${req.params.table}:`, error);
    res.status(500).json({ error: 'Failed to read cache' });
  }
});

// Sync Google Sheets to SQLite cache
app.post('/api/cache/sync', async (req, res) => {
  try {
    const { spreadsheetId } = req.body;

    if (!spreadsheetId) {
      return res.status(400).json({ error: 'spreadsheetId required' });
    }

    console.log('🔄 Syncing Google Sheets to SQLite cache...');

    // Fetch all sheets data
    const token = await getAccessToken();
    const baseUrl = `${SHEETS_BASE_URL}/${spreadsheetId}/values`;

    const [audiences, topics, messages, assets, creatives, textFormatting] = await Promise.all([
      fetch(`${baseUrl}/Audiences`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).then(d => d.values || []),

      fetch(`${baseUrl}/Topics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).then(d => d.values || []),

      fetch(`${baseUrl}/Messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).then(d => d.values || []),

      fetch(`${baseUrl}/Assets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).then(d => d.values || []),

      fetch(`${baseUrl}/Creatives`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).then(d => d.values || []),

      fetch(`${baseUrl}/textformats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).then(d => d.values || []).catch(() => [])
    ]);

    // Sync to SQLite
    const results = await syncService.syncAll({
      audiences,
      topics,
      messages,
      assets,
      creatives,
      textFormatting
    });

    res.json({
      success: true,
      message: 'Cache synced successfully',
      results: results.results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error syncing cache:', error);
    res.status(500).json({ error: 'Failed to sync cache', details: error.message });
  }
});

// Get cache status/metadata
app.get('/api/cache/status', (req, res) => {
  try {
    const sqlite = db.getSqlite();
    const stmt = sqlite.prepare('SELECT * FROM cache_metadata');
    const metadata = stmt.all();

    res.json({
      tables: metadata,
      databaseSize: fs.statSync(path.join(__dirname, 'db', 'messaging-matrix.db')).size
    });
  } catch (error) {
    console.error('Error getting cache status:', error);
    res.status(500).json({ error: 'Failed to get cache status' });
  }
});

// Diagnostic endpoint - check service account setup
app.get('/api/diagnostics', (req, res) => {
  try {
    const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './service-account.json';
    const fullPath = path.join(__dirname, serviceAccountPath);

    const diagnostics = {
      version: SERVER_VERSION,
      serviceAccountPath: serviceAccountPath,
      fullPath: fullPath,
      fileExists: fs.existsSync(fullPath),
      hasServiceAccount: !!serviceAccount,
      serviceAccountEmail: serviceAccount?.client_email || 'not loaded',
      hasAccessToken: !!accessToken,
      tokenExpiry: tokenExpiry ? new Date(tokenExpiry).toISOString() : 'no token',
      __dirname: __dirname,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        GOOGLE_SERVICE_ACCOUNT_PATH: process.env.GOOGLE_SERVICE_ACCOUNT_PATH
      }
    };

    res.json(diagnostics);
  } catch (error) {
    console.error('Error in diagnostics:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Update config (to SQLite)
app.post('/api/config', (req, res) => {
  try {
    const newConfig = req.body;
    const sqlite = db.getSqlite();

    // Prepare update statement
    const stmt = sqlite.prepare(`
      INSERT OR REPLACE INTO config (key, value, category, description, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Update all config keys
    const transaction = sqlite.transaction((config) => {
      Object.keys(config).forEach(key => {
        const value = config[key];
        const jsonValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

        // Determine category based on key
        let category = 'general';
        if (key === 'spreadsheetId') category = 'googleSheets';
        else if (key === 'googleDrive') category = 'googleDrive';
        else if (key === 'patterns') category = 'patterns';
        else if (key === 'treeStructure') category = 'ui';
        else if (key === 'feedStructure') category = 'feed';
        else if (key === 'lookAndFeel') category = 'ui';
        else if (key.includes('imageBaseUrl')) category = 'assets';
        else if (key.includes('Structure')) category = 'structure';
        else if (key === 'creativeParsingRules') category = 'structure';

        stmt.run(key, jsonValue, category, null, new Date().toISOString());
      });
    });

    transaction(newConfig);

    res.json({ success: true, config: newConfig });
  } catch (error) {
    console.error('Error writing config:', error);
    res.status(500).json({ error: 'Failed to write config to database' });
  }
});

// Add text formatting rule
app.post('/api/textformatting', async (req, res) => {
  try {
    const { text_original, text_formatted, formatting_scope, formatting_mc_scope } = req.body;

    if (!text_original || !text_formatted) {
      return res.status(400).json({ error: 'text_original and text_formatted are required' });
    }

    // Get spreadsheet ID from config
    const configPath = path.join(__dirname, 'config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    const spreadsheetId = config.spreadsheetId;

    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Spreadsheet ID not configured' });
    }

    // Initialize Google Sheets client
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Read current textformats sheet
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'textformats!A:E'
    });

    const currentData = getResponse.data.values || [];

    // Find next ID
    let nextId = 1;
    if (currentData.length > 1) {
      const ids = currentData.slice(1).map(row => parseInt(row[0]) || 0);
      nextId = Math.max(...ids) + 1;
    }

    // Create new row
    const newRow = [
      nextId.toString(),
      text_original,
      text_formatted,
      formatting_scope || '',
      formatting_mc_scope || ''
    ];

    // Append new row
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'textformats!A:E',
      valueInputOption: 'RAW',
      resource: {
        values: [newRow]
      }
    });

    res.json({ success: true, id: nextId });
  } catch (error) {
    console.error('Error adding text formatting:', error);
    res.status(500).json({ error: 'Failed to add text formatting', details: error.message });
  }
});

// Add multiple text formatting rules (batch)
app.post('/api/textformatting/batch', async (req, res) => {
  try {
    const { rules } = req.body;

    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({ error: 'rules array is required' });
    }

    // Get spreadsheet ID from config
    const configPath = path.join(__dirname, 'config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    const spreadsheetId = config.spreadsheetId;

    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Spreadsheet ID not configured' });
    }

    // Initialize Google Sheets client
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Read current textformats sheet
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'textformats!A:E'
    });

    const currentData = getResponse.data.values || [];

    // Find next ID
    let nextId = 1;
    if (currentData.length > 1) {
      const ids = currentData.slice(1).map(row => parseInt(row[0]) || 0);
      nextId = Math.max(...ids) + 1;
    }

    // Create new rows for all rules
    const newRows = rules.map(rule => {
      const row = [
        (nextId++).toString(),
        rule.text_original,
        rule.text_formatted,
        rule.formatting_scope || '',
        rule.formatting_mc_scope || ''
      ];
      return row;
    });

    // Append all rows at once
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'textformats!A:E',
      valueInputOption: 'RAW',
      resource: {
        values: newRows
      }
    });

    res.json({ success: true, count: newRows.length });
  } catch (error) {
    console.error('Error adding text formatting rules:', error);
    res.status(500).json({ error: 'Failed to add text formatting rules', details: error.message });
  }
});

// Delete text formatting rule by ID
app.post('/api/textformatting/delete', async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }

    // Get spreadsheet ID from config
    const configPath = path.join(__dirname, 'config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    const spreadsheetId = config.spreadsheetId;

    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Spreadsheet ID not configured' });
    }

    // Initialize Google Sheets client
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Read current textformats sheet
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'textformats!A:E'
    });

    const currentData = getResponse.data.values || [];

    if (currentData.length <= 1) {
      return res.status(404).json({ error: 'No data to delete' });
    }

    // Find the row index with the matching ID (accounting for header row)
    const rowIndex = currentData.findIndex((row, index) => index > 0 && row[0] === String(id));

    if (rowIndex === -1) {
      return res.status(404).json({ error: 'Text formatting rule not found' });
    }

    // Get the sheet ID for the textformats sheet
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const textformatsSheet = spreadsheet.data.sheets.find(s => s.properties.title === 'textformats');

    if (!textformatsSheet) {
      return res.status(404).json({ error: 'textformats sheet not found' });
    }

    const sheetId = textformatsSheet.properties.sheetId;

    // Delete the row using batchUpdate
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1
            }
          }
        }]
      }
    });

    res.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting text formatting:', error);
    res.status(500).json({ error: 'Failed to delete text formatting', details: error.message });
  }
});

app.post('/api/claude', verifyToken, async (req, res) => {
  try {
    const { messages, model = 'claude-3-5-sonnet-20241022', max_tokens = 4096 } = req.body;

    // Use API key from environment
    const apiKey = process.env.VITE_ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured in .env' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens,
        messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI Assistant Prompts endpoints
const promptsDir = path.join(__dirname, 'AI'); // AI directory

// Ensure AI directory exists
if (!fs.existsSync(promptsDir)) {
  fs.mkdirSync(promptsDir, { recursive: true });
}

// Map of module names to filenames
const promptFileMap = {
  'client-context': 'AiClientContext.txt',
  'matrix': 'AIMatrixInstructions.txt',
  'creative-library': 'AICreativeLibraryInstructions.txt',
  'assets': 'AIAssetsInstructions.txt',
  'monitoring': 'AIMonitoringInstructions.txt',
  'templates': 'AITemplatesInstructions.txt',
  'users': 'AIUsersInstructions.txt',
  'tasks': 'AITasksInstructions.txt',
  'settings': 'AISettingsInstructions.txt',
  'email-to-task': 'AIEmailToTaskInstructions.txt',
  'message-generation': 'AIMessageGenerationInstructions.txt'
};

// Get all AI prompts
app.get('/api/ai-prompts', verifyToken, (req, res) => {
  try {
    const prompts = {};

    // Load all prompts from files
    for (const [module, filename] of Object.entries(promptFileMap)) {
      const filePath = path.join(promptsDir, filename);

      if (fs.existsSync(filePath)) {
        prompts[module] = fs.readFileSync(filePath, 'utf8');
      } else {
        prompts[module] = ''; // Empty string if file doesn't exist
      }
    }

    res.json(prompts);
  } catch (error) {
    console.error('Error reading AI prompts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get AI prompt for a specific module
app.get('/api/ai-prompts/:module', verifyToken, (req, res) => {
  try {
    const { module } = req.params;
    const filename = promptFileMap[module];

    if (!filename) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const filePath = path.join(promptsDir, filename);

    // If file doesn't exist, return empty string (will use default)
    if (!fs.existsSync(filePath)) {
      return res.json({ prompt: '' });
    }

    const prompt = fs.readFileSync(filePath, 'utf8');
    res.json({ prompt });
  } catch (error) {
    console.error('Error reading AI prompt:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save AI prompt for a specific module
app.post('/api/ai-prompts/:module', verifyToken, (req, res) => {
  try {
    const { module } = req.params;
    const { prompt } = req.body;
    const filename = promptFileMap[module];

    console.log(`[AI Prompts] Saving module: ${module}, filename: ${filename}`);

    if (!filename) {
      console.error(`[AI Prompts] Module not found: ${module}`);
      return res.status(404).json({ error: 'Module not found' });
    }

    const filePath = path.join(promptsDir, filename);
    console.log(`[AI Prompts] File path: ${filePath}`);

    // Ensure prompt is a string
    const promptStr = typeof prompt === 'string' ? prompt : '';

    // If prompt is empty, delete the file (will revert to default)
    if (!promptStr || promptStr.trim() === '') {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[AI Prompts] Deleted empty prompt file: ${filePath}`);
      }
      return res.json({ success: true, message: 'Prompt reset to default' });
    }

    // Ensure directory exists before writing
    if (!fs.existsSync(promptsDir)) {
      fs.mkdirSync(promptsDir, { recursive: true });
      console.log(`[AI Prompts] Created directory: ${promptsDir}`);
    }

    // Save prompt to file
    fs.writeFileSync(filePath, promptStr, 'utf8');
    console.log(`[AI Prompts] Saved ${module} prompt (${promptStr.length} chars) to ${filePath}`);
    res.json({ success: true, message: 'Prompt saved successfully' });
  } catch (error) {
    console.error('[AI Prompts] Error saving:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all AI prompts at once
app.get('/api/ai-prompts', (req, res) => {
  try {
    const prompts = {};

    Object.keys(promptFileMap).forEach(module => {
      const filename = promptFileMap[module];
      const filePath = path.join(promptsDir, filename);

      if (fs.existsSync(filePath)) {
        prompts[module] = fs.readFileSync(filePath, 'utf8');
      } else {
        prompts[module] = '';
      }
    });

    res.json(prompts);
  } catch (error) {
    console.error('Error reading AI prompts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get AI data structure documentation
app.get('/api/ai-data-structure', verifyToken, (req, res) => {
  try {
    const filePath = path.join(promptsDir, 'AIMessagingMatrixDataStructure.txt');

    if (!fs.existsSync(filePath)) {
      return res.json({ content: '' });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ content });
  } catch (error) {
    console.error('Error reading data structure file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Share/Preview endpoints
const sharesDir = path.join(__dirname, 'public', 'share');

// Ensure shares directory exists
if (!fs.existsSync(sharesDir)) {
  fs.mkdirSync(sharesDir, { recursive: true });
}

// Get share by ID (from SQLite)
app.get('/api/shares/:shareId', (req, res) => {
  try {
    const { shareId } = req.params;
    const sqlite = db.getSqlite();

    const stmt = sqlite.prepare('SELECT * FROM share_galleries WHERE id = ?');
    const share = stmt.get(shareId);

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    // Parse JSON fields
    const shareData = {
      shareId: share.id,
      title: share.title,
      description: share.description,
      createdBy: share.created_by,
      assetIds: share.asset_ids ? JSON.parse(share.asset_ids) : [],
      assets: share.metadata ? JSON.parse(share.metadata).assets : [],
      createdAt: share.created_at,
      baseColor: share.metadata ? JSON.parse(share.metadata).baseColor : null,
      comments: share.metadata ? JSON.parse(share.metadata).comments || [] : [],
      driveAssets: share.drive_file_ids ? JSON.parse(share.drive_file_ids) : {}
    };

    res.json(shareData);
  } catch (error) {
    console.error('Error reading share:', error);
    res.status(500).json({ error: 'Failed to read share' });
  }
});

// Helper function to populate template with message data
function populateTemplate(html, messageData, templateConfig, imageBaseUrls, size = '', textFormatting = []) {
  if (!messageData || !html) return html;
  let result = html;

  // Text fields that should get span-based formatting
  const textFields = ['headline', 'copy1', 'copy2', 'flash', 'cta', 'disclaimer'];

  if (templateConfig && templateConfig.placeholders) {
    Object.keys(templateConfig.placeholders).forEach(placeholderName => {
      const config = templateConfig.placeholders[placeholderName];
      const binding = config['binding-messagingmatrix'];
      let value = config.default || '';

      if (binding) {
        const fieldName = binding.replace(/^message\./i, '').toLowerCase();
        value = messageData[fieldName] || value;

        // Apply span-based text formatting for text fields
        if (textFields.includes(fieldName) && value && textFormatting && textFormatting.length > 0) {
          // Build message identifiers for MC scope matching
          const msgIdentifiers = {
            id: String(messageData.id),
            poms_id: messageData.poms_id,
            name: messageData.name,
            number: String(messageData.number || ''),
            variant: messageData.variant || '',
            numberVariant: `${messageData.number || ''}${messageData.variant || ''}`
          };
          value = applyTextFormattingSpans(value, textFormatting, msgIdentifiers);
        }

        // Build full image URL if this is an image field
        if (config.type === 'image' && value && imageBaseUrls) {
          if (!value.startsWith('http://') && !value.startsWith('https://')) {
            value = (imageBaseUrls[fieldName] || '') + value;
          }
        }
      }

      const regex = new RegExp(`\\{\\{${placeholderName}\\}\\}`, 'g');
      result = result.replace(regex, value);
    });
  }

  // Add size class to body tag for CSS-based text formatting
  if (size) {
    result = result.replace(/<body([^>]*)>/i, `<body$1 class="size-${size}">`);
  }

  return result;
}

// Create new share
app.post('/api/shares', async (req, res) => {
  try {
    const { assetIds, creatives = [], title, baseColor, templateData = {}, textFormatting = [], driveAssets = {} } = req.body;

    // Load config from SQLite to get image base URLs
    const sqlite = db.getSqlite();
    const configStmt = sqlite.prepare('SELECT * FROM config');
    const configRows = configStmt.all();

    // Rebuild config object from key-value pairs
    const config = {};
    configRows.forEach(row => {
      try {
        config[row.key] = JSON.parse(row.value);
      } catch {
        config[row.key] = row.value;
      }
    });

    const imageBaseUrls = config.imageBaseUrls || {};

    // Generate unique share ID
    const shareId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const shareDir = path.join(sharesDir, shareId);

    // Create share directory
    fs.mkdirSync(shareDir, { recursive: true });

    // Process dynamic ads - create static HTML versions
    const processedAssets = [];

    for (const creative of creatives) {
      if (creative.isDynamic && creative.messageData && templateData.templateHtml && templateData.templateCss) {
        try {
          // Generate folder name: MC{{Number}}_{{Variant}}_{{Dimensions}}_{{Version}}
          const mcNumber = creative.messageData.number || '0';
          const mcVariant = creative.messageData.variant || 'A';
          const dimensions = `${creative.bannerSize.width}x${creative.bannerSize.height}`;
          const version = creative.messageData.version || 'v1';
          const folderName = `MC${mcNumber}_${mcVariant}_${dimensions}_${version}`;
          const adDir = path.join(shareDir, folderName);

          // Create ad directory
          fs.mkdirSync(adDir, { recursive: true });

          // Get CSS for this size
          const sizeKey = dimensions;
          let combinedCss = '';
          if (templateData.templateCss.main) {
            combinedCss += templateData.templateCss.main + '\n';
          }
          if (templateData.templateCss[sizeKey]) {
            combinedCss += templateData.templateCss[sizeKey];
          }

          // Save CSS file
          fs.writeFileSync(path.join(adDir, 'styles.css'), combinedCss, 'utf8');

          // Build imageBaseUrls from template config
          const templateImageBaseUrls = {};
          if (templateData.templateConfig && templateData.templateConfig.placeholders) {
            Object.keys(templateData.templateConfig.placeholders).forEach(placeholderName => {
              const config = templateData.templateConfig.placeholders[placeholderName];
              if (config.type === 'image' || config.type === 'video') {
                const binding = config['binding-messagingmatrix'];
                if (binding) {
                  const fieldName = binding.replace(/^message\./i, '').toLowerCase();
                  templateImageBaseUrls[fieldName] = config['path-messagingmatrix'] || '';
                }
              }
            });
          }

          // Populate template with message data (with text formatting)
          let populatedHtml = populateTemplate(
            templateData.templateHtml,
            creative.messageData,
            templateData.templateConfig,
            templateImageBaseUrls, // Use template-based URLs instead of config
            dimensions,
            textFormatting
          );

          // Note: Images are NOT saved in share folder to save space
          // They will be fetched from Drive when downloading ZIP

          // Replace CSS links with the actual styles file
          populatedHtml = populatedHtml.replace(
            /<link rel="stylesheet" href="main\.css".*?>/g,
            '<link rel="stylesheet" href="styles.css">'
          );
          populatedHtml = populatedHtml.replace(
            /<link rel="stylesheet" href="\[\[css\]\]".*?>/g,
            ''
          );

          // Save HTML file
          fs.writeFileSync(path.join(adDir, 'index.html'), populatedHtml, 'utf8');

          // Copy and populate manifest.json
          const templateName = templateData.templateName || 'html';
          const manifestSourcePath = path.join(templatesDir, templateName, 'manifest.json');

          if (fs.existsSync(manifestSourcePath)) {
            try {
              let manifestContent = fs.readFileSync(manifestSourcePath, 'utf8');
              const manifest = JSON.parse(manifestContent);

              // Replace {{ad.width}} and {{ad.height}} with actual values
              manifest.width = creative.bannerSize.width.toString();
              manifest.height = creative.bannerSize.height.toString();

              // Set title: MC{Number}_{Variant}_{Version} - {Name}
              const titleName = creative.messageData.name || `Message ${mcNumber}`;
              manifest.title = `MC${mcNumber}_${mcVariant}_${version} - ${titleName}`;

              // Save populated manifest
              fs.writeFileSync(path.join(adDir, 'manifest.json'), JSON.stringify(manifest, null, 4), 'utf8');
              console.log(`  ✓ Copied and populated manifest.json`);
            } catch (manifestError) {
              console.error(`  ✗ Error processing manifest.json:`, manifestError.message);
            }
          }

          console.log(`✓ Created static ad: ${folderName}`);

          // Add to processed assets list with new path and mark as local folder review
          processedAssets.push({
            ...creative,
            staticPath: `/api/share-static/${shareId}/${folderName}/index.html`,
            folderName,
            isLocalFolderReview: true,
            reviewType: 'static-local'
          });
        } catch (error) {
          console.error(`Error processing dynamic ad ${creative.id}:`, error);
          // Continue with other ads even if one fails
        }
      } else {
        // Non-dynamic creative, keep as-is
        processedAssets.push(creative);
      }
    }

    // Create share data
    const shareData = {
      shareId,
      assetIds,
      assets: processedAssets,
      title,
      baseColor,
      createdAt: new Date().toISOString(),
      comments: []
    };

    // Save to SQLite database (sqlite already declared above for config)
    const shareStmt = sqlite.prepare(`
      INSERT INTO share_galleries (id, title, description, created_by, creative_ids, asset_ids, metadata, drive_file_ids, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    shareStmt.run(
      shareId,
      title || null,
      null, // description
      null, // created_by
      null, // creative_ids (deprecated in favor of metadata)
      JSON.stringify(assetIds),
      JSON.stringify(shareData), // Store full shareData in metadata for backward compatibility
      Object.keys(driveAssets).length > 0 ? JSON.stringify(driveAssets) : null, // Store Drive file IDs
      new Date().toISOString()
    );

    // Build full share URL
    // Use APP_BASE_URL from environment if set, otherwise detect from request
    const baseUrl = process.env.APP_BASE_URL ||
                    `${req.protocol}://${req.get('host')}`;
    const fullShareUrl = `${baseUrl}/share/${shareId}`;

    // Return share info
    res.json({
      shareId,
      url: fullShareUrl
    });
  } catch (error) {
    console.error('Error creating share:', error);
    res.status(500).json({ error: 'Failed to create share' });
  }
});

// Add comment to share (SQLite)
app.post('/api/shares/:shareId/comments', (req, res) => {
  try {
    const { shareId } = req.params;
    const { author, text } = req.body;
    const sqlite = db.getSqlite();

    // Get share from database
    const getStmt = sqlite.prepare('SELECT metadata FROM share_galleries WHERE id = ?');
    const share = getStmt.get(shareId);

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    const shareData = JSON.parse(share.metadata);

    const comment = {
      id: Date.now().toString(),
      author,
      text,
      timestamp: new Date().toISOString()
    };

    if (!shareData.comments) {
      shareData.comments = [];
    }
    shareData.comments.push(comment);

    // Update database
    const updateStmt = sqlite.prepare(`
      UPDATE share_galleries
      SET metadata = ?, updated_at = ?
      WHERE id = ?
    `);

    updateStmt.run(
      JSON.stringify(shareData),
      new Date().toISOString(),
      shareId
    );

    res.json({ comment });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Google Drive asset proxy endpoint
// Redirects to the cached direct link or fetches a new one
app.get('/api/drive-asset/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const sqlite = db.getSqlite();

    // Try to find file in assets or creatives cache
    let asset = sqlite.prepare('SELECT file_direct_link FROM assets WHERE file_drive_id = ?').get(fileId);
    if (!asset) {
      asset = sqlite.prepare('SELECT file_direct_link FROM creatives WHERE file_drive_id = ?').get(fileId);
    }

    if (asset && asset.file_direct_link) {
      // Redirect to cached direct link
      return res.redirect(asset.file_direct_link);
    }

    // If not in cache or no direct link, use public Drive URL
    const publicUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    res.redirect(publicUrl);
  } catch (error) {
    console.error('Error proxying Drive asset:', error);
    res.status(500).json({ error: 'Failed to proxy Drive asset' });
  }
});

// HTML ad renderer for shares with Drive assets
// Injects Drive proxy URLs into HTML templates for iframe viewing
app.get('/api/share-html/:shareId/:assetId', async (req, res) => {
  try {
    const { shareId, assetId } = req.params;
    const sqlite = db.getSqlite();

    // Get share data
    const shareStmt = sqlite.prepare('SELECT drive_file_ids FROM share_galleries WHERE id = ?');
    const share = shareStmt.get(shareId);

    if (!share) {
      return res.status(404).send('Share not found');
    }

    // Parse Drive file IDs
    const driveFileIds = share.drive_file_ids ? JSON.parse(share.drive_file_ids) : {};
    const assetData = driveFileIds[assetId];

    if (!assetData || !assetData.htmlFileId) {
      return res.status(404).send('HTML asset not found in share');
    }

    // Get HTML content from Drive (or local path if it's a local folder review)
    const shareDir = path.join(sharesDir, shareId, assetData.folderName || '');
    const htmlPath = path.join(shareDir, 'index.html');

    if (fs.existsSync(htmlPath)) {
      // Local folder review - serve directly
      res.setHeader('Content-Type', 'text/html');
      res.sendFile(htmlPath);
    } else {
      // TODO: Fetch HTML from Drive and inject Drive proxy URLs for images
      res.status(501).send('Drive-based HTML rendering not yet implemented');
    }
  } catch (error) {
    console.error('Error rendering share HTML:', error);
    res.status(500).send('Failed to render HTML');
  }
});

// HTML ad download for ZIP packaging
// Returns HTML with local relative paths for standalone usage
app.get('/api/share-html-download/:shareId/:assetId', async (req, res) => {
  try {
    const { shareId, assetId } = req.params;

    // For now, this is the same as the regular endpoint
    // In the future, this could modify paths to be relative for ZIP downloads
    res.redirect(`/api/share-html/${shareId}/${assetId}`);
  } catch (error) {
    console.error('Error downloading share HTML:', error);
    res.status(500).send('Failed to download HTML');
  }
});

// Template endpoints
const templatesDir = path.join(__dirname, 'src', 'templates');

// List all templates
app.get('/api/templates', (req, res) => {
  try {
    if (!fs.existsSync(templatesDir)) {
      return res.json([]);
    }

    // Get visible templates config
    const sqlite = db.getSqlite();
    const visibleTemplatesRow = sqlite.prepare('SELECT value FROM config WHERE key = ?').get('visibleTemplates');
    let visibleTemplates = null;
    if (visibleTemplatesRow?.value) {
      try {
        visibleTemplates = JSON.parse(visibleTemplatesRow.value);
      } catch (e) {
        console.warn('Failed to parse visibleTemplates config');
      }
    }

    const templates = fs.readdirSync(templatesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .filter(dirent => {
        // If visibleTemplates is not set or empty, show all
        if (!visibleTemplates || visibleTemplates.length === 0) return true;
        return visibleTemplates.includes(dirent.name);
      })
      .map(dirent => {
        const templatePath = path.join(templatesDir, dirent.name);
        const templateJsonPath = path.join(templatePath, 'template.json');

        // Get all files in template directory
        const files = fs.existsSync(templatePath)
          ? fs.readdirSync(templatePath)
          : [];

        // Extract dimensions from CSS filenames (e.g., "300x250.css" -> "300x250")
        const dimensions = files
          .filter(file => /^\d+x\d+\.css$/.test(file))
          .map(file => file.replace('.css', ''))
          .sort();

        // Get file metadata including last modified time
        const filesWithMeta = files.map(file => {
          const filePath = path.join(templatePath, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            lastModified: stats.mtime.toISOString(),
            size: stats.size
          };
        });

        // Find the most recently modified file
        const lastModifiedFile = filesWithMeta.length > 0
          ? filesWithMeta.reduce((latest, current) =>
              new Date(current.lastModified) > new Date(latest.lastModified) ? current : latest
            ).name
          : null;

        // Read template.json if it exists
        let templateData = {};
        if (fs.existsSync(templateJsonPath)) {
          try {
            templateData = JSON.parse(fs.readFileSync(templateJsonPath, 'utf8'));
          } catch (err) {
            console.error(`Error parsing template.json for ${dirent.name}:`, err);
          }
        }

        return {
          name: dirent.name,
          dimensions,
          files,
          filesWithMeta,
          lastModifiedFile,
          lastModified: filesWithMeta.length > 0
            ? filesWithMeta.reduce((latest, current) =>
                new Date(current.lastModified) > new Date(latest.lastModified) ? current : latest
              ).lastModified
            : new Date().toISOString(),
          description: 'Template',
          ...templateData
        };
      });

    res.json(templates);
  } catch (error) {
    console.error('Error listing templates:', error);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

// Get all available template folders (for settings, unfiltered)
app.get('/api/templates/folders', (req, res) => {
  try {
    console.log('📁 Template folders endpoint called');
    console.log('📁 Templates directory:', templatesDir);
    console.log('📁 Directory exists:', fs.existsSync(templatesDir));

    if (!fs.existsSync(templatesDir)) {
      console.log('📁 Templates directory does not exist');
      return res.json({ folders: [] });
    }

    const entries = fs.readdirSync(templatesDir, { withFileTypes: true });
    console.log('📁 Directory entries:', entries.map(e => ({ name: e.name, isDir: e.isDirectory() })));

    const folders = entries
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .sort();

    console.log('📁 Found folders:', folders);
    res.json({ folders });
  } catch (error) {
    console.error('Error listing template folders:', error);
    res.status(500).json({ error: 'Failed to list template folders' });
  }
});

// Get template file content
app.get('/api/templates/:templateName/:fileName', (req, res) => {
  try {
    const { templateName, fileName } = req.params;
    const filePath = path.join(templatesDir, templateName, fileName);

    // Security check: ensure the path is within templates directory
    const resolvedPath = path.resolve(filePath);
    const resolvedTemplatesDir = path.resolve(templatesDir);
    if (!resolvedPath.startsWith(resolvedTemplatesDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ content });
  } catch (error) {
    console.error('Error reading template file:', error);
    res.status(500).json({ error: 'Failed to read template file' });
  }
});

// Save template file content
app.post('/api/templates/:templateName/:fileName', (req, res) => {
  try {
    const { templateName, fileName } = req.params;
    const { content } = req.body;
    const filePath = path.join(templatesDir, templateName, fileName);

    // Security check: ensure the path is within templates directory
    const resolvedPath = path.resolve(filePath);
    const resolvedTemplatesDir = path.resolve(templatesDir);
    if (!resolvedPath.startsWith(resolvedTemplatesDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Ensure template directory exists
    const templateDir = path.join(templatesDir, templateName);
    if (!fs.existsSync(templateDir)) {
      fs.mkdirSync(templateDir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving template file:', error);
    res.status(500).json({ error: 'Failed to save template file' });
  }
});

// Helper function to get email config from SQLite
function getEmailConfigFromDb() {
  try {
    const sqlite = db.getSqlite();
    const stmt = sqlite.prepare('SELECT value FROM config WHERE key = ?');
    const row = stmt.get('emailAccount');

    if (!row) {
      throw new Error('Email account configuration not found in database');
    }

    return JSON.parse(row.value);
  } catch (error) {
    console.error('Error loading email config from database:', error);
    throw error;
  }
}

// Message search endpoint for MC matching
// Searches messages by keywords across multiple fields
app.get('/api/messages/search', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;

    if (!q) {
      return res.json({ messages: [] });
    }

    // Load messages from Google Sheets cache or current state
    // For now, we'll search the cached matrix data
    const sheetsService = await import('./services/sheets.js');
    const matrixData = await sheetsService.loadFromSheets();

    if (!matrixData || !matrixData.messages) {
      return res.json({ messages: [] });
    }

    const keywords = q.toLowerCase().split(/[\s,]+/).filter(k => k.length > 1);
    const messages = matrixData.messages;
    const audiences = matrixData.audiences || [];
    const topics = matrixData.topics || [];

    // Score each message based on keyword matches
    const scoredMessages = messages.map(msg => {
      let score = 0;
      const matchedFields = [];

      // Build searchable text from message fields
      const searchableFields = {
        name: msg.name || msg.Name || '',
        pmmid: msg.pmmid || msg.PMMID || '',
        copy1: msg.copy1 || msg.Copy1 || '',
        copy2: msg.copy2 || msg.Copy2 || '',
        comment: msg.comment || msg.Comment || '',
        topic: msg.topic || '',
        audience: msg.audience || ''
      };

      // Get audience and topic names
      const audience = audiences.find(a => a.key === msg.audience);
      const topic = topics.find(t => t.key === msg.topic);
      if (audience) searchableFields.audienceName = audience.name || '';
      if (topic) searchableFields.topicName = topic.name || '';

      // Score keywords against fields
      keywords.forEach(keyword => {
        Object.entries(searchableFields).forEach(([field, value]) => {
          if (value && value.toLowerCase().includes(keyword)) {
            // Weight certain fields higher
            const weight = field === 'name' || field === 'pmmid' ? 3 :
                          field === 'audienceName' || field === 'topicName' ? 2 : 1;
            score += weight;
            if (!matchedFields.includes(field)) {
              matchedFields.push(field);
            }
          }
        });
      });

      return {
        id: msg.id,
        pmmid: searchableFields.pmmid || `MC${msg.number || msg.id}${msg.variant || ''}`,
        name: searchableFields.name,
        audience: searchableFields.audienceName || msg.audience,
        topic: searchableFields.topicName || msg.topic,
        status: msg.status,
        score,
        matchedFields
      };
    });

    // Filter and sort by score
    const results = scoredMessages
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, parseInt(limit));

    // Normalize scores to 0-1 range
    const maxScore = results[0]?.score || 1;
    const normalizedResults = results.map(r => ({
      ...r,
      matchScore: Math.round((r.score / maxScore) * 100) / 100
    }));

    res.json({ messages: normalizedResults });
  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Email endpoints
// Get emails from IMAP server
app.get('/api/emails', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const unseenOnly = req.query.unseenOnly !== 'false';

    // Get email config from SQLite database
    const emailConfig = getEmailConfigFromDb();

    const emails = await fetchEmails(limit, unseenOnly, emailConfig);
    res.json({ emails });
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: error.message });
  }
});

// Convert emails to tasks using Claude
app.post('/api/emails/convert-to-tasks', async (req, res) => {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails)) {
      return res.status(400).json({ error: 'emails array is required' });
    }

    // Use API key from environment
    const apiKey = process.env.VITE_ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured in .env' });
    }

    // Create a prompt for Claude to analyze emails and create tasks
    const emailSummaries = emails.map((email, idx) =>
      `Email ${idx + 1}:\nFrom: ${email.fromName} <${email.from}>\nSubject: ${email.subject}\nDate: ${email.date}\nBody:\n${email.body}\n`
    ).join('\n---\n\n');

    const prompt = `You are an intelligent task manager for a creative/advertising workflow system. Analyze the following emails and extract actionable tasks.

## CRITICAL: SPLIT BY PRODUCT
If an email mentions MULTIPLE PRODUCTS, create a SEPARATE TASK for each product.

Example: "Update rates for SZK and HK campaigns"
→ Creates 2 tasks: one for SZK, one for HK

## PRODUCT CODES (use these exact codes):
- HK = Lakáshitel (Home Loan)
- SZK = Személyi Kölcsön (Personal Loan)
- SZA = Számlavezetés (Account Management)
- HITEL = General Loans
- MARKET = Marketplace/General
- BIZTOS = Biztosítás (Insurance)
- MEGTAKARITAS = Savings Products
- KARTYA = Cards
- GENERAL = If product unclear

## TASK TYPE DETECTION:
- "creation" = NEW creative (keywords: új, new, create, készíts, kampány indítás)
- "modification" = UPDATE existing (keywords: módosítás, update, change, fix, javítás, rate change, copy change)

## LANGUAGE RULE:
Keep title, description, context, keywords in the ORIGINAL email language. Do NOT translate.

## FIELD INSTRUCTIONS:

**title**: Brief one-line task title (original language)

**description**: 2-3 sentence summary of what needs to be done (original language)

**product**: Use product code from list above (HK, SZK, SZA, etc.)

**taskType**: "creation" or "modification"

**suggestedMCName** (for creation tasks only):
- Format: "[Product] - [Campaign/Topic] - [Audience]"
- Example: "SZK - Őszi kampány - REM"

**suggestedRelatedMC** (for modification tasks only):
- Extract any MC name, PMMID, or creative reference mentioned
- Examples: "MC123", "PMMID-456", "Lakáshitel_REMAlt_2024"
- If none mentioned, set to null

**context**: Full email thread in markdown format (original language)
- Use ## headings for each message
- Include timestamps
- Preserve all details

**keywords**: 3-8 searchable terms for finding related MCs

**priority**:
- "High" = urgent, ASAP, deadline within 2 days
- "Medium" = normal request
- "Low" = whenever possible, low priority mentioned

**dueDate**: Extract deadline as ISO date string, or null

## JSON OUTPUT FORMAT:
[
  {
    "title": "Brief task title",
    "description": "Summary of what needs to be done",
    "context": "Markdown email thread",
    "priority": "High|Medium|Low",
    "dueDate": "2024-01-15 or null",
    "source": "Email subject",
    "from": "sender@email.com",
    "status": "pending",
    "emailUid": 12345,
    "taskType": "creation|modification",
    "keywords": ["keyword1", "keyword2"],
    "product": "HK|SZK|SZA|HITEL|MARKET|etc",
    "suggestedMCName": "For creation tasks or null",
    "suggestedRelatedMC": "For modification tasks or null"
  }
]

If email has no actionable tasks, skip it.

Here are the emails:

${emailSummaries}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Extract JSON from Claude's response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    let tasks = [];

    if (jsonMatch) {
      try {
        tasks = JSON.parse(jsonMatch[0]);

        // Load matrix data for MC search
        let matrixData = null;
        try {
          const sheetsService = await import('./services/sheets.js');
          matrixData = await sheetsService.loadFromSheets();
        } catch (loadErr) {
          console.log('Could not load matrix data for MC matching:', loadErr.message);
        }

        // Add email UIDs, original email content, and search for matching MCs
        tasks = await Promise.all(tasks.map(async (task, idx) => {
          const originalEmail = emails[idx];
          const enhancedTask = {
            ...task,
            id: `task-${Date.now()}-${idx}`,
            emailUid: originalEmail?.uid || null,
            emailBody: originalEmail?.body || '',
            emailSubject: originalEmail?.subject || '',
            emailDate: originalEmail?.date || null,
            createdAt: new Date().toISOString(),
            // Set workflow type based on task type
            workflowType: task.taskType === 'creation' || task.taskType === 'modification' ? 'creative' : 'general',
            // Ensure keywords is an array
            keywords: Array.isArray(task.keywords) ? task.keywords : [],
            // New fields from improved prompt
            product: task.product || null,
            suggestedMCName: task.suggestedMCName || null,
            suggestedRelatedMC: task.suggestedRelatedMC || null,
            suggestedMCs: []
          };

          // For modification tasks, search for matching MCs
          if (task.taskType === 'modification' && matrixData && enhancedTask.keywords.length > 0) {
            try {
              const keywords = enhancedTask.keywords.join(' ');
              const messages = matrixData.messages || [];
              const audiences = matrixData.audiences || [];
              const topics = matrixData.topics || [];

              // Score each message
              const searchKeywords = keywords.toLowerCase().split(/[\s,]+/).filter(k => k.length > 1);
              const scoredMessages = messages.map(msg => {
                let score = 0;
                const matchedFields = [];

                const searchableFields = {
                  name: (msg.name || msg.Name || '').toLowerCase(),
                  pmmid: (msg.pmmid || msg.PMMID || '').toLowerCase(),
                  copy1: (msg.copy1 || msg.Copy1 || '').toLowerCase(),
                  comment: (msg.comment || msg.Comment || '').toLowerCase()
                };

                const audience = audiences.find(a => a.key === msg.audience);
                const topic = topics.find(t => t.key === msg.topic);
                if (audience) searchableFields.audienceName = (audience.name || '').toLowerCase();
                if (topic) searchableFields.topicName = (topic.name || '').toLowerCase();

                searchKeywords.forEach(kw => {
                  Object.entries(searchableFields).forEach(([field, value]) => {
                    if (value && value.includes(kw)) {
                      const weight = field === 'name' || field === 'pmmid' ? 3 :
                                    field === 'audienceName' || field === 'topicName' ? 2 : 1;
                      score += weight;
                      if (!matchedFields.includes(field)) matchedFields.push(field);
                    }
                  });
                });

                return {
                  id: msg.id,
                  pmmid: msg.pmmid || msg.PMMID || `MC${msg.number || msg.id}${msg.variant || ''}`,
                  name: msg.name || msg.Name || '',
                  audience: audience?.name || msg.audience,
                  topic: topic?.name || msg.topic,
                  status: msg.status,
                  score,
                  matchedFields
                };
              });

              // Get top 5 matches
              const results = scoredMessages
                .filter(m => m.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);

              const maxScore = results[0]?.score || 1;
              enhancedTask.suggestedMCs = results.map(r => ({
                id: r.id,
                pmmid: r.pmmid,
                name: r.name,
                audience: r.audience,
                topic: r.topic,
                status: r.status,
                matchScore: Math.round((r.score / maxScore) * 100) / 100,
                matchedFields: r.matchedFields
              }));

              console.log(`🔍 Found ${enhancedTask.suggestedMCs.length} matching MCs for task: "${task.title}"`);
            } catch (searchErr) {
              console.error('Error searching for matching MCs:', searchErr);
            }
          }

          return enhancedTask;
        }));
      } catch (err) {
        console.error('Error parsing tasks JSON:', err);
        return res.status(500).json({ error: 'Failed to parse tasks from Claude response' });
      }
    }

    res.json({ tasks, rawResponse: content });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark email as read
app.post('/api/emails/:uid/mark-read', async (req, res) => {
  try {
    const uid = req.params.uid;

    // Get email config from SQLite database
    const emailConfig = getEmailConfigFromDb();

    await markEmailAsSeen(uid, emailConfig);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking email as read:', error);
    res.status(500).json({ error: error.message });
  }
});

// Task endpoints (SQLite-backed)

// Get available labels (products from config)
app.get('/api/task-labels', (req, res) => {
  try {
    // Product labels from AiClientContext.txt
    const productLabels = [
      'SZK', 'HK', 'VAL', 'MIKRO', 'SZA', 'LTP', 'HITEL', 'MARKET',
      'OtthonStart', 'MunkásHitel', 'Babaváró', 'Diak', 'Online',
      'Cseperedő', 'BeErste', 'CARD', 'GEORGE'
    ];

    const labels = {
      products: productLabels,
      topics: [], // No topic labels as requested
      all: productLabels
    };

    res.json(labels);
  } catch (error) {
    console.error('Error getting task labels:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all tasks (from SQLite)
// v2 schema: id is auto-increment integer, no taskNumber/status/workflowType/labels/suggestedMCName/suggestedRelatedMC/suggestedMCs
app.get('/api/tasks', (req, res) => {
  try {
    const sqlite = db.getSqlite();

    const query = 'SELECT * FROM tasks ORDER BY created_at DESC';
    const stmt = sqlite.prepare(query);
    const tasks = stmt.all();

    // Helper to parse comma-separated MC references to array
    const parseCommaSeparated = (str) => {
      if (!str) return [];
      return str.split(',').map(s => s.trim()).filter(Boolean);
    };

    // Transform tasks to match frontend naming conventions
    const transformedTasks = tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.due_date,
      source: task.source,
      from: task.from,
      emailUid: task.email_uid,
      emailBody: task.email_body,
      emailSubject: task.email_subject,
      emailDate: task.email_date,
      context: task.context,
      userNotes: task.user_notes,
      relatedContent: parseCommaSeparated(task.related_content),
      outputContent: parseCommaSeparated(task.output_content),
      bucket: task.bucket,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      product: task.product,
      audience: task.audience,
      topic: task.topic,
      taskType: task.task_type,
      keywords: task.keywords ? task.keywords.split(',').map(s => s.trim()).filter(Boolean) : []
    }));

    res.json({ tasks: transformedTasks });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save tasks (bulk replace - to SQLite)
// v2 schema: id is auto-increment, removed: taskNumber, status, workflowType, labels, suggestedMCName, suggestedMCs, suggestedRelatedMC
app.post('/api/tasks', (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error: 'tasks must be an array' });
    }

    const sqlite = db.getSqlite();

    // Helper to convert array to comma-separated string
    const arrayToCommaSep = (arr) => {
      if (!arr || !Array.isArray(arr)) return null;
      return arr.length > 0 ? arr.join(',') : null;
    };

    // Replace all tasks with transaction
    const transaction = sqlite.transaction(() => {
      // Clear existing tasks
      sqlite.prepare('DELETE FROM tasks').run();

      // Insert new tasks - id is explicit to preserve existing IDs
      const stmt = sqlite.prepare(`
        INSERT INTO tasks (
          id, title, description, priority, due_date,
          source, "from", email_uid, email_body, email_subject, email_date,
          context, user_notes, related_content, output_content, bucket, created_at, updated_at,
          product, audience, topic, task_type, keywords
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      tasks.forEach(task => {
        console.log(`💾 Saving task TC${task.id}: "${task.title?.substring(0, 30)}..."`);

        stmt.run(
          task.id,
          task.title,
          task.description || null,
          task.priority || null,
          task.dueDate || null,
          task.source || null,
          task.from || null,
          task.emailUid || null,
          task.emailBody || null,
          task.emailSubject || null,
          task.emailDate || null,
          task.context || null,
          task.userNotes || null,
          arrayToCommaSep(task.relatedContent),
          arrayToCommaSep(task.outputContent),
          task.bucket || 'incoming',
          task.createdAt || new Date().toISOString(),
          task.updatedAt || new Date().toISOString(),
          task.product || null,
          task.audience || null,
          task.topic || null,
          task.taskType || null,
          arrayToCommaSep(task.keywords)
        );
      });
    });

    transaction();

    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Error saving tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a single task
// v2 schema: id is auto-increment integer, no need to generate task_number
app.post('/api/tasks/create', (req, res) => {
  try {
    const task = req.body;

    if (!task.title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const sqlite = db.getSqlite();

    // Helper to convert array to comma-separated string
    const arrayToCommaSep = (arr) => {
      if (!arr || !Array.isArray(arr)) return null;
      return arr.length > 0 ? arr.join(',') : null;
    };

    const stmt = sqlite.prepare(`
      INSERT INTO tasks (
        title, description, priority, due_date,
        source, "from", email_uid, bucket, created_at, updated_at,
        context, user_notes, related_content, output_content,
        product, audience, topic, task_type, keywords,
        email_body, email_subject, email_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    const result = stmt.run(
      task.title,
      task.description || null,
      task.priority || null,
      task.dueDate || null,
      task.source || null,
      task.from || null,
      task.emailUid || null,
      task.bucket || 'incoming',
      task.createdAt || now,
      now,
      task.context || null,
      task.userNotes || null,
      arrayToCommaSep(task.relatedContent),
      arrayToCommaSep(task.outputContent),
      task.product || null,
      task.audience || null,
      task.topic || null,
      task.taskType || null,
      arrayToCommaSep(task.keywords),
      task.emailBody || null,
      task.emailSubject || null,
      task.emailDate || null
    );

    // Get the auto-generated ID
    const newId = result.lastInsertRowid;

    res.json({ success: true, task: { ...task, id: newId } });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a single task
// v2 schema: removed status, workflowType fields
app.put('/api/tasks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const sqlite = db.getSqlite();

    // Helper to convert array to comma-separated string
    const arrayToCommaSep = (arr) => {
      if (!arr || !Array.isArray(arr)) return null;
      return arr.length > 0 ? arr.join(',') : null;
    };

    // Build dynamic update query
    const fields = [];
    const values = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.priority !== undefined) {
      fields.push('priority = ?');
      values.push(updates.priority);
    }
    if (updates.dueDate !== undefined) {
      fields.push('due_date = ?');
      values.push(updates.dueDate);
    }
    if (updates.bucket !== undefined) {
      fields.push('bucket = ?');
      values.push(updates.bucket);
    }
    if (updates.source !== undefined) {
      fields.push('source = ?');
      values.push(updates.source);
    }
    if (updates.from !== undefined) {
      fields.push('"from" = ?');
      values.push(updates.from);
    }
    if (updates.product !== undefined) {
      fields.push('product = ?');
      values.push(updates.product);
    }
    if (updates.audience !== undefined) {
      fields.push('audience = ?');
      values.push(updates.audience);
    }
    if (updates.topic !== undefined) {
      fields.push('topic = ?');
      values.push(updates.topic);
    }
    if (updates.taskType !== undefined) {
      fields.push('task_type = ?');
      values.push(updates.taskType);
    }
    if (updates.context !== undefined) {
      fields.push('context = ?');
      values.push(updates.context);
    }
    if (updates.userNotes !== undefined) {
      fields.push('user_notes = ?');
      values.push(updates.userNotes);
    }
    if (updates.relatedContent !== undefined) {
      fields.push('related_content = ?');
      values.push(arrayToCommaSep(updates.relatedContent));
    }
    if (updates.outputContent !== undefined) {
      fields.push('output_content = ?');
      values.push(arrayToCommaSep(updates.outputContent));
    }
    if (updates.keywords !== undefined) {
      fields.push('keywords = ?');
      values.push(arrayToCommaSep(updates.keywords));
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = sqlite.prepare(`
      UPDATE tasks
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...values);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a single task
app.delete('/api/tasks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const sqlite = db.getSqlite();

    const stmt = sqlite.prepare('DELETE FROM tasks WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get processed email UIDs (from SQLite)
app.get('/api/processed-emails', (req, res) => {
  try {
    const sqlite = db.getSqlite();
    const stmt = sqlite.prepare('SELECT uid FROM processed_emails');
    const rows = stmt.all();

    // Return just the UIDs for backward compatibility
    const processedEmails = rows.map(row => row.uid);

    res.json({ processedEmails });
  } catch (error) {
    console.error('Error getting processed emails:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add processed email UIDs (to SQLite)
app.post('/api/processed-emails', (req, res) => {
  try {
    const { emailUids, emailData } = req.body;

    if (!Array.isArray(emailUids) && !emailData) {
      return res.status(400).json({ error: 'emailUids array or emailData required' });
    }

    const sqlite = db.getSqlite();
    const stmt = sqlite.prepare(`
      INSERT OR IGNORE INTO processed_emails (uid, email_from, subject, tasks_created)
      VALUES (?, ?, ?, ?)
    `);

    // If emailData provided (more detailed), use it
    if (emailData) {
      stmt.run(
        emailData.uid,
        emailData.from || null,
        emailData.subject || null,
        emailData.tasksCreated || 0
      );
    }
    // Otherwise, batch insert UIDs only
    else if (emailUids) {
      const transaction = sqlite.transaction((uids) => {
        uids.forEach(uid => {
          stmt.run(uid, null, null, 0);
        });
      });
      transaction(emailUids);
    }

    // Return all processed UIDs
    const allStmt = sqlite.prepare('SELECT uid FROM processed_emails');
    const processedEmails = allStmt.all().map(row => row.uid);

    res.json({ success: true, processedEmails });
  } catch (error) {
    console.error('Error saving processed emails:', error);
    res.status(500).json({ error: error.message });
  }
});

// User management endpoints (SQLite-backed, replaces localStorage)

// Get all users (for admin)
app.get('/api/users', (req, res) => {
  try {
    const sqlite = db.getSqlite();
    const stmt = sqlite.prepare('SELECT id, email, role, created_at, updated_at FROM users');
    const users = stmt.all();

    res.json({ users });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Register new user
app.post('/api/users/register', (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const sqlite = db.getSqlite();

    // Check if user already exists
    const existingUser = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Generate user ID
    const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Insert user (password is already hashed on client side)
    const stmt = sqlite.prepare(`
      INSERT INTO users (id, email, password, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      email,
      password, // Already hashed by client
      role || 'user',
      new Date().toISOString(),
      new Date().toISOString()
    );

    res.json({
      success: true,
      user: {
        id: userId,
        email,
        role: role || 'user'
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login user
app.post('/api/users/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const sqlite = db.getSqlite();

    // Find user by email
    const stmt = sqlite.prepare('SELECT id, email, password, role FROM users WHERE email = ?');
    const user = stmt.get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password (password is already hashed on client side)
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create JWT token
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000), // Issued at
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // Expires in 24 hours
    };

    // Create JWT: base64(header).base64(payload).signature
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', process.env.JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    const token = `${header}.${body}.${signature}`;

    // Return user and token
    res.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single user by ID
app.get('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const sqlite = db.getSqlite();

    const stmt = sqlite.prepare('SELECT id, email, role, created_at, updated_at FROM users WHERE id = ?');
    const user = stmt.get(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user
app.put('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const sqlite = db.getSqlite();

    // Build dynamic update query
    const fields = [];
    const values = [];

    if (updates.email !== undefined) {
      fields.push('email = ?');
      values.push(updates.email);
    }
    if (updates.password !== undefined) {
      fields.push('password = ?');
      values.push(updates.password);
    }
    if (updates.role !== undefined) {
      fields.push('role = ?');
      values.push(updates.role);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = sqlite.prepare(`
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...values);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const sqlite = db.getSqlite();

    const stmt = sqlite.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Migrate users from localStorage (client-side migration endpoint)
app.post('/api/users/migrate', (req, res) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users)) {
      return res.status(400).json({ error: 'users must be an array' });
    }

    const sqlite = db.getSqlite();

    const transaction = sqlite.transaction((userList) => {
      const stmt = sqlite.prepare(`
        INSERT OR IGNORE INTO users (id, email, password, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      userList.forEach(user => {
        stmt.run(
          user.id,
          user.email,
          user.password,
          user.role || 'user',
          user.createdAt || new Date().toISOString(),
          new Date().toISOString()
        );
      });
    });

    transaction(users);

    res.json({ success: true, migrated: users.length });
  } catch (error) {
    console.error('Error migrating users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Asset management endpoints
const tempDir = path.join(__dirname, 'temp-uploads');
const creativesDir = path.join(__dirname, 'src', 'creatives');
const assetsDir = path.join(__dirname, 'src', 'assets');

// Ensure directories exist
[tempDir, creativesDir, assetsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `temp-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Helper to extract metadata from filename
// Pattern: Brand_Product_Type_Visual_keyword_Visual_description_Dimensions_Placeholder_name_Cropping_template_Version_Format
function extractMetadata(filename) {
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|mp4|gif|webp|svg)$/i, '');
  const parts = nameWithoutExt.split('_');

  // Extract dimensions (look for patterns like 1200x628, 300x250, etc.)
  const dimensionsMatch = nameWithoutExt.match(/(\d+)x(\d+)/);
  const dimensions = dimensionsMatch ? dimensionsMatch[0] : '';

  // Extract version (look for patterns like v1, v2, v10, etc.)
  const versionMatch = nameWithoutExt.match(/v(\d+)/i);
  const version = versionMatch ? versionMatch[1] : '1';

  // Match keywords to common values
  const lowerFilename = filename.toLowerCase();
  const brands = ['nike', 'adidas', 'puma', 'reebok', 'apple', 'samsung', 'google'];
  const matchedBrand = brands.find(brand => lowerFilename.includes(brand));

  const types = ['banner', 'poster', 'social', 'video', 'carousel', 'story', 'reel'];
  const matchedType = types.find(type => lowerFilename.includes(type));

  // Try to intelligently parse the parts
  let brand = '';
  let product = '';
  let type = '';
  let visualKeyword = '';
  let visualDescription = '';
  let placeholderName = '';
  let croppingTemplate = '';

  if (parts.length >= 9) {
    // Full pattern match
    [brand, product, type, visualKeyword, visualDescription, , placeholderName, croppingTemplate] = parts;
  } else if (parts.length >= 2) {
    // Partial match - try to extract what we can
    brand = parts[0] || matchedBrand || '';
    product = parts[1] || '';
    type = parts[2] || matchedType || '';
    visualKeyword = parts[3] || '';
    visualDescription = parts[4] || '';
    placeholderName = parts.length > 6 ? parts[parts.length - 3] : '';
    croppingTemplate = parts.length > 7 ? parts[parts.length - 2] : '';
  } else {
    brand = matchedBrand || '';
    type = matchedType || '';
  }

  return {
    brand: brand.replace(/-/g, ' '),
    product: product.replace(/-/g, ' '),
    type: type.replace(/-/g, ' '),
    visualKeyword: visualKeyword.replace(/-/g, ' '),
    visualDescription: visualDescription.replace(/-/g, ' '),
    dimensions,
    placeholderName: placeholderName.replace(/-/g, ' '),
    croppingTemplate: croppingTemplate.replace(/-/g, ' '),
    version,
    format: filename.split('.').pop().toLowerCase()
  };
}

// Preview metadata for uploaded file
app.post('/api/assets/preview-metadata', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const metadata = extractMetadata(req.file.originalname);

    // Auto-detect dimensions for images
    try {
      const filePath = path.join(tempDir, req.file.filename);
      const ext = req.file.originalname.split('.').pop().toLowerCase();

      // Handle images
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
        // Read file as buffer for image-size library
        const imageBuffer = await fsPromises.readFile(filePath);
        const dimensions = sizeOf(imageBuffer);
        if (dimensions && dimensions.width && dimensions.height) {
          metadata.dimensions = `${dimensions.width}x${dimensions.height}`;
          console.log(`Detected dimensions: ${metadata.dimensions} for ${req.file.originalname}`);
        }
      }
      // For videos, we'll skip auto-detection for now (requires ffprobe)
      // User can manually enter dimensions if needed
    } catch (dimensionError) {
      console.warn('Could not extract dimensions:', dimensionError.message);
      // Continue without dimensions - not critical
    }

    res.json({
      originalName: req.file.originalname,
      tempFilename: req.file.filename,
      metadata
    });
  } catch (error) {
    console.error('Error previewing metadata:', error);
    res.status(500).json({ error: 'Failed to preview metadata' });
  }
});

// Confirm upload and move to final location
app.post('/api/assets/confirm-upload', async (req, res) => {
  try {
    const { tempFilename, metadata, targetDir = 'creatives', originalName } = req.body;

    if (!tempFilename || !metadata) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Construct final filename using new pattern:
    // Brand_Product_Type_Visual_keyword_Visual_description_Dimensions_Placeholder_name_Cropping_template_Version_Format
    const parts = [
      (metadata.brand || 'unknown').replace(/\s+/g, '-'),
      (metadata.product || 'unknown').replace(/\s+/g, '-'),
      (metadata.type || 'unknown').replace(/\s+/g, '-'),
      (metadata.visualKeyword || 'unknown').replace(/\s+/g, '-'),
      (metadata.visualDescription || 'desc').replace(/\s+/g, '-'),
      (metadata.dimensions || '').replace(/\s+/g, ''),
      (metadata.placeholderName || 'placeholder').replace(/\s+/g, '-'),
      (metadata.croppingTemplate || 'default').replace(/\s+/g, '-'),
      `v${metadata.version || '1'}`,
    ];

    const format = metadata.format || 'jpg';
    const finalFilename = `${parts.join('_')}.${format}`;

    // Determine target directory
    const targetDirectory = targetDir === 'assets' ? assetsDir : creativesDir;

    // Move file from temp to final location
    const tempPath = path.join(tempDir, tempFilename);
    const finalPath = path.join(targetDirectory, finalFilename);

    if (!fs.existsSync(tempPath)) {
      return res.status(404).json({ error: 'Temp file not found' });
    }

    await fsPromises.rename(tempPath, finalPath);

    // Update assets registry (SQLite)
    try {
      const sqlite = db.getSqlite();

      // Create new asset record
      const assetRecord = {
        id: `${Date.now()}_${Math.random().toString(36).substring(7)}`,
        filename: finalFilename,
        originalFilename: originalName || tempFilename,
        uploadDate: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        metadata: {
          brand: metadata.brand || '',
          product: metadata.product || '',
          type: metadata.type || '',
          visualKeyword: metadata.visualKeyword || '',
          visualDescription: metadata.visualDescription || '',
          dimensions: metadata.dimensions || '',
          placeholderName: metadata.placeholderName || '',
          croppingTemplate: metadata.croppingTemplate || '',
          version: metadata.version || '1',
          format: metadata.format || format
        },
        tags: metadata.tags || [],
        platforms: metadata.platforms || [],
        status: 'active',
        directory: targetDir
      };

      // Insert into SQLite
      const stmt = sqlite.prepare(`
        INSERT INTO uploaded_assets (
          id, filename, original_filename, upload_date, last_modified,
          metadata, tags, platforms, status, directory
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        assetRecord.id,
        assetRecord.filename,
        assetRecord.originalFilename,
        assetRecord.uploadDate,
        assetRecord.lastModified,
        JSON.stringify(assetRecord.metadata),
        JSON.stringify(assetRecord.tags),
        JSON.stringify(assetRecord.platforms),
        assetRecord.status,
        assetRecord.directory
      );

      console.log('Asset added to registry:', assetRecord);
    } catch (registryError) {
      console.error('Error updating assets registry:', registryError);
      // Continue even if registry update fails
    }

    res.json({
      success: true,
      filename: finalFilename,
      path: finalPath
    });
  } catch (error) {
    console.error('Error confirming upload:', error);
    res.status(500).json({ error: 'Failed to confirm upload' });
  }
});

// Cancel upload and remove temp file
app.post('/api/assets/cancel-upload', async (req, res) => {
  try {
    const { tempFilename } = req.body;

    if (!tempFilename) {
      return res.status(400).json({ error: 'Missing tempFilename' });
    }

    const tempPath = path.join(tempDir, tempFilename);

    if (fs.existsSync(tempPath)) {
      await fsPromises.unlink(tempPath);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error canceling upload:', error);
    res.status(500).json({ error: 'Failed to cancel upload' });
  }
});

// Serve temporary files for preview
app.get('/api/assets/temp-preview/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const tempPath = path.join(tempDir, filename);

    // Security check: ensure filename doesn't contain path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!fs.existsSync(tempPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Serve the file
    res.sendFile(tempPath);
  } catch (error) {
    console.error('Error serving temp file:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// Get assets registry (from SQLite)
app.get('/api/assets/registry', async (req, res) => {
  try {
    const sqlite = db.getSqlite();
    const stmt = sqlite.prepare('SELECT * FROM uploaded_assets ORDER BY upload_date DESC');
    const assets = stmt.all();

    // Parse JSON fields
    const parsedAssets = assets.map(asset => ({
      id: asset.id,
      filename: asset.filename,
      originalFilename: asset.original_filename,
      uploadDate: asset.upload_date,
      lastModified: asset.last_modified,
      metadata: asset.metadata ? JSON.parse(asset.metadata) : {},
      tags: asset.tags ? JSON.parse(asset.tags) : [],
      platforms: asset.platforms ? JSON.parse(asset.platforms) : [],
      status: asset.status,
      directory: asset.directory
    }));

    res.json({
      assets: parsedAssets,
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reading assets registry:', error);
    res.status(500).json({ error: 'Failed to read assets registry' });
  }
});

// Add/Update asset in registry (using SQLite)
app.post('/api/assets/registry', async (req, res) => {
  try {
    const assetRecord = req.body;

    if (!assetRecord.filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const sqlite = db.getSqlite();

    // Generate ID if not provided
    if (!assetRecord.id) {
      assetRecord.id = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    // Prepare data
    const uploadDate = assetRecord.uploadDate || new Date().toISOString();
    const lastModified = new Date().toISOString();
    const metadata = JSON.stringify(assetRecord.metadata || {});
    const tags = JSON.stringify(assetRecord.tags || []);
    const platforms = JSON.stringify(assetRecord.platforms || []);

    // Insert or replace
    const stmt = sqlite.prepare(`
      INSERT OR REPLACE INTO uploaded_assets (
        id, filename, original_filename, upload_date, last_modified,
        metadata, tags, platforms, status, directory, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      assetRecord.id,
      assetRecord.filename,
      assetRecord.originalFilename || assetRecord.filename,
      uploadDate,
      lastModified,
      metadata,
      tags,
      platforms,
      assetRecord.status || 'active',
      assetRecord.directory || 'assets',
      lastModified
    );

    res.json({ success: true, asset: { ...assetRecord, id: assetRecord.id, uploadDate, lastModified } });
  } catch (error) {
    console.error('Error updating assets registry:', error);
    res.status(500).json({ error: 'Failed to update assets registry' });
  }
});

// Delete asset from registry (using SQLite)
app.delete('/api/assets/registry', async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Asset ID is required' });
    }

    const sqlite = db.getSqlite();

    // Check if asset exists
    const checkStmt = sqlite.prepare('SELECT id FROM uploaded_assets WHERE id = ?');
    const existing = checkStmt.get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Asset not found in registry' });
    }

    // Delete asset
    const deleteStmt = sqlite.prepare('DELETE FROM uploaded_assets WHERE id = ?');
    deleteStmt.run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting from assets registry:', error);
    res.status(500).json({ error: 'Failed to delete from assets registry' });
  }
});

// Get file stats (modification times)
app.get('/api/assets/stats', async (req, res) => {
  try {
    const stats = [];

    // Get stats for both creatives and assets directories
    for (const dir of [creativesDir, assetsDir]) {
      if (fs.existsSync(dir)) {
        const files = await fsPromises.readdir(dir);

        for (const file of files) {
          if (file.startsWith('.')) continue; // Skip hidden files

          const filePath = path.join(dir, file);
          const fileStat = await fsPromises.stat(filePath);

          if (fileStat.isFile()) {
            stats.push({
              filename: file,
              mtime: fileStat.mtime.toISOString(),
              size: fileStat.size
            });
          }
        }
      }
    }

    res.json(stats);
  } catch (error) {
    console.error('Error getting asset stats:', error);
    res.status(500).json({ error: 'Failed to get asset stats' });
  }
});

// Start server with proper error handling

// ========================================
// Google Drive Storage Integration
// ========================================

// Initialize Drive Storage
async function initializeDriveStorage() {
  try {
    console.log('🔄 Initializing Google Drive storage...');

    // Get config from SQLite
    const sqlite = db.getSqlite();
    const configStmt = sqlite.prepare('SELECT * FROM config');
    const configRows = configStmt.all();

    // Rebuild config object from key-value pairs
    const config = {};
    configRows.forEach(row => {
      try {
        config[row.key] = JSON.parse(row.value);
      } catch {
        config[row.key] = row.value;
      }
    });

    if (config.googleDrive && config.googleDrive.enabled) {
      const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './service-account.json';
      const fullPath = path.join(__dirname, serviceAccountPath);

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Drive initialization timeout (10s)')), 10000)
      );

      await Promise.race([
        driveStorage.initialize(
          fullPath,
          config.googleDrive.assetsFolderId,
          config.googleDrive.creativesFolderId
        ),
        timeoutPromise
      ]);

      console.log('✓ Google Drive storage initialized');
    } else {
      console.log('⚠ Google Drive storage disabled in config');
    }
  } catch (error) {
    console.error('✗ Failed to initialize Google Drive storage:', error.message);
    console.error('   Server will continue without Drive integration');
  }
}

// Upload file to Google Drive
app.post('/api/drive/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { folderType = 'assets', metadata } = req.body;
    const parsedMetadata = metadata ? JSON.parse(metadata) : {};

    // Read file data
    const fileData = fs.readFileSync(req.file.path);

    // Upload to Drive
    const result = await driveStorage.uploadFile(
      fileData,
      req.file.originalname,
      req.file.mimetype,
      folderType,
      parsedMetadata
    );

    // Clean up temp file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      file: result
    });
  } catch (error) {
    console.error('Error uploading to Drive:', error);
    res.status(500).json({ error: 'Failed to upload to Drive' });
  }
});

// List files from Google Drive
app.get('/api/drive/files', async (req, res) => {
  try {
    const { folderType = 'assets', pageSize = 100, pageToken, orderBy } = req.query;

    const result = await driveStorage.listFiles(folderType, {
      pageSize: parseInt(pageSize),
      pageToken,
      orderBy
    });

    // Debug: Check files returned
    console.log(`📤 Drive files API returning ${result.files?.length || 0} files, hasNextPage: ${!!result.nextPageToken}`);

    // Check for empty.mp4
    const emptyFile = result.files?.find(f => f.name.toLowerCase().includes('empty'));
    if (emptyFile) {
      console.log('✅ Server found empty.mp4:', emptyFile.name, emptyFile.id);
    } else {
      console.log('❌ Server: empty.mp4 NOT in response');
    }

    res.json(result);
  } catch (error) {
    console.error('Error listing Drive files:', error);
    res.status(500).json({ error: 'Failed to list Drive files' });
  }
});

// Get file metadata from Google Drive
app.get('/api/drive/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const metadata = await driveStorage.getFileMetadata(fileId);

    res.json(metadata);
  } catch (error) {
    console.error('Error getting file metadata:', error);
    res.status(500).json({ error: 'Failed to get file metadata' });
  }
});

// Download file from Google Drive
app.get('/api/drive/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    // Get file metadata first
    const metadata = await driveStorage.getFileMetadata(fileId);

    // Use file ID + modified time as ETag
    const etag = `"${fileId}-${metadata.modifiedTime || 'static'}"`;

    // Check if client has cached version
    const clientEtag = req.headers['if-none-match'];
    if (clientEtag === etag) {
      res.status(304).end();
      return;
    }

    // Download file
    const fileData = await driveStorage.downloadFile(fileId);

    // Set headers with caching
    res.setHeader('Content-Type', metadata.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${metadata.name}"`);
    res.setHeader('Content-Length', fileData.length);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache downloads for 1 hour
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', new Date(metadata.modifiedTime || Date.now()).toUTCString());

    // Send file
    res.send(fileData);
  } catch (error) {
    console.error('Error downloading from Drive:', error);
    res.status(500).json({ error: 'Failed to download from Drive' });
  }
});

// Delete file from Google Drive
app.delete('/api/drive/files/:fileId', async (req, res) => {
  try {
    const { fileId} = req.params;
    await driveStorage.deleteFile(fileId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file from Drive:', error);
    res.status(500).json({ error: 'Failed to delete file from Drive' });
  }
});

// Update file metadata in Google Drive
app.patch('/api/drive/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { metadata } = req.body;

    const updated = await driveStorage.updateFileMetadata(fileId, metadata);

    res.json(updated);
  } catch (error) {
    console.error('Error updating file metadata:', error);
    res.status(500).json({ error: 'Failed to update file metadata' });
  }
});

// Search files in Google Drive
app.get('/api/drive/search', async (req, res) => {
  try {
    const { q: searchTerm, folderType = 'assets' } = req.query;

    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term required' });
    }

    const results = await driveStorage.searchFiles(searchTerm, folderType);

    res.json({ files: results });
  } catch (error) {
    console.error('Error searching Drive files:', error);
    res.status(500).json({ error: 'Failed to search Drive files' });
  }
});

// Move file to different folder
app.post('/api/drive/files/:fileId/move', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { folderType } = req.body;

    const updated = await driveStorage.moveFile(fileId, folderType);

    res.json(updated);
  } catch (error) {
    console.error('Error moving file:', error);
    res.status(500).json({ error: 'Failed to move file' });
  }
});

// Get storage quota
app.get('/api/drive/quota', async (req, res) => {
  try {
    const quota = await driveStorage.getStorageQuota();

    res.json(quota);
  } catch (error) {
    console.error('Error getting storage quota:', error);
    res.status(500).json({ error: 'Failed to get storage quota' });
  }
});

// Batch upload files to Google Drive
app.post('/api/drive/upload-batch', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const { folderType = 'assets', metadata } = req.body;
    const parsedMetadata = metadata ? JSON.parse(metadata) : {};

    const files = req.files.map(file => ({
      fileData: fs.readFileSync(file.path),
      fileName: file.originalname,
      mimeType: file.mimetype,
      metadata: parsedMetadata
    }));

    // Upload to Drive
    const results = await driveStorage.uploadMultipleFiles(files, folderType);

    // Clean up temp files
    req.files.forEach(file => {
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        console.error('Error deleting temp file:', e);
      }
    });

    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error batch uploading to Drive:', error);
    res.status(500).json({ error: 'Failed to batch upload to Drive' });
  }
});

// Helper function to get cached Drive file
async function getCachedDriveFile(fileId, metadata) {
  const cacheDir = path.join(__dirname, 'cache', 'drive');
  const cachePath = path.join(cacheDir, `${fileId}.cache`);
  const metaPath = path.join(cacheDir, `${fileId}.meta.json`);

  // Ensure cache directory exists
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // Check if cached file exists
  if (fs.existsSync(cachePath) && fs.existsSync(metaPath)) {
    try {
      const cachedMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

      // Check if cache is still valid (compare modified times)
      if (cachedMeta.modifiedTime === metadata.modifiedTime) {
        console.log(`✅ Cache HIT for ${fileId}`);
        return fs.readFileSync(cachePath);
      } else {
        console.log(`⚠️ Cache STALE for ${fileId} (modified time changed)`);
      }
    } catch (error) {
      console.warn(`Cache read error for ${fileId}:`, error.message);
    }
  } else {
    console.log(`❌ Cache MISS for ${fileId}`);
  }

  // Cache miss or stale - download from Drive
  console.log(`⬇️ Downloading ${fileId} from Drive...`);
  const fileData = await driveStorage.downloadFile(fileId);

  // Save to cache
  try {
    fs.writeFileSync(cachePath, fileData);
    fs.writeFileSync(metaPath, JSON.stringify({
      fileId,
      modifiedTime: metadata.modifiedTime,
      mimeType: metadata.mimeType,
      name: metadata.name,
      size: fileData.length,
      cachedAt: new Date().toISOString()
    }));
    console.log(`💾 Cached ${fileId} to disk (${fileData.length} bytes)`);
  } catch (error) {
    console.warn(`Failed to cache ${fileId}:`, error.message);
  }

  return fileData;
}

// Proxy endpoint to serve Drive files (supports both file IDs and filenames)
app.get('/api/drive/proxy/:fileIdOrName', async (req, res) => {
  try {
    const { fileIdOrName } = req.params;

    console.log(`🎬 Drive proxy request: ${fileIdOrName}`);

    // Check if Drive storage is initialized
    if (!driveStorage.initialized) {
      console.warn(`Drive proxy request for ${fileIdOrName} but Drive is not initialized`);
      return res.status(404).json({ error: 'Google Drive integration is disabled' });
    }

    let fileId = fileIdOrName;

    // Check if the parameter looks like a filename (has a file extension)
    const hasExtension = /\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|avi|pdf|zip|psd|html|htm|css|js|json)$/i.test(fileIdOrName);

    if (hasExtension) {
      // This is a filename - search for it in Drive
      console.log(`Searching for file by name: ${fileIdOrName}`);

      // Search in both assets and creatives folders
      let files = await driveStorage.searchFiles(fileIdOrName, 'assets');
      console.log(`Assets search returned ${files.length} results`);

      if (files.length === 0) {
        // Try creatives folder if not found in assets
        files = await driveStorage.searchFiles(fileIdOrName, 'creatives');
        console.log(`Creatives search returned ${files.length} results`);
      }

      if (files.length === 0) {
        console.error(`File not found: ${fileIdOrName}`);
        console.log(`Attempted search in both assets and creatives folders`);
        return res.status(404).json({ error: `File not found: ${fileIdOrName}` });
      }

      // Use the first matching file
      fileId = files[0].id;
      console.log(`Found file: ${files[0].name} (ID: ${fileId})`);
    }

    // Get file metadata first to check ETag
    const metadata = await driveStorage.getFileMetadata(fileId);

    // Use file ID + modified time as ETag for cache validation
    const etag = `"${fileId}-${metadata.modifiedTime || 'static'}"`;

    // Check if client has cached version
    const clientEtag = req.headers['if-none-match'];
    if (clientEtag === etag) {
      // File hasn't changed, return 304 Not Modified
      res.status(304).end();
      return;
    }

    // Get file from cache or download from Drive
    const fileData = await getCachedDriveFile(fileId, metadata);
    const fileSize = fileData.length;

    // Handle byte-range requests (crucial for video seeking and caching)
    const range = req.headers.range;

    // Add CORS headers for srcDoc iframes and cross-origin video requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

    if (range) {
      // Parse range header (e.g., "bytes=0-1023")
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      // Slice the file buffer
      const chunk = fileData.slice(start, end + 1);

      // Send 206 Partial Content response
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunksize);
      res.setHeader('Content-Type', metadata.mimeType || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', new Date(metadata.modifiedTime || Date.now()).toUTCString());
      res.send(chunk);
    } else {
      // Send full file
      res.setHeader('Content-Type', metadata.mimeType || 'application/octet-stream');
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes'); // Advertise range support
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', new Date(metadata.modifiedTime || Date.now()).toUTCString());
      res.send(fileData);
    }
  } catch (error) {
    console.error('Error proxying Drive file:', error);
    res.status(500).json({ error: 'Failed to proxy Drive file' });
  }
});

// Serve static files from dist folder in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, 'dist');

  // Check if dist folder exists
  if (fs.existsSync(distPath)) {
    console.log('✓ Serving static files from:', distPath);

    // Serve static assets
    app.use(express.static(distPath));

    // Handle SPA routing - serve index.html for all non-API routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.warn('⚠ Production mode but dist folder not found. Run "npm run build" first.');
  }
}

const server = app.listen(PORT, () => {
  console.log(`\n✓ Server v${SERVER_VERSION} running on http://localhost:${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ Make sure VITE_ANTHROPIC_API_KEY is set in your .env file\n`);

  // Initialize Google Drive storage (non-blocking)
  initializeDriveStorage().catch(err => {
    console.error('✗ Drive init failed, but server is running:', err.message);
  });
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n✗ ERROR: Port ${PORT} is already in use!`);
    console.error(`  Please stop the running Node.js process on port ${PORT} first.\n`);
    if (process.platform === 'win32') {
      console.error(`  Windows: Run 'npm run kill' to free up the port.\n`);
    } else {
      console.error(`  Linux/Mac: Run 'lsof -ti:${PORT} | xargs kill -9'\n`);
    }
    process.exit(1);
  } else {
    console.error('\n✗ Server error:', err);
    process.exit(1);
  }
});

// Graceful shutdown handler
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);

  // Don't crash server for IMAP socket timeouts - just log them
  if (error.code === 'ETIMEOUT' || error.message?.includes('Socket timeout')) {
    console.error('⚠ IMAP connection timeout - server will continue running');
    return;
  }

  // For other exceptions, shutdown gracefully
  gracefulShutdown('EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

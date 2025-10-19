import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SignJWT, importPKCS8 } from 'jose';
import { fetchEmails, markEmailAsSeen } from './services/emailService.js';
import multer from 'multer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3003;

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

// Configure CORS with explicit options for Chrome compatibility
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://messagingmatrix.ai',
    'http://messagingmatrix.ai'
  ],
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Google Sheets API endpoints
const SHEETS_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

// Get spreadsheet data (read from a specific sheet/range)
app.get('/api/sheets/:spreadsheetId/values/:range', async (req, res) => {
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
app.post('/api/sheets/:spreadsheetId/values/:range/clear', async (req, res) => {
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
app.get('/api/sheets/:spreadsheetId', async (req, res) => {
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

// Get config
app.get('/api/config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.json(config);
  } catch (error) {
    console.error('Error reading config:', error);
    res.status(500).json({ error: 'Failed to read config file' });
  }
});

// Update config
app.post('/api/config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'config.json');
    const newConfig = req.body;

    // Add lastUpdated timestamp
    newConfig.lastUpdated = new Date().toISOString();

    // Write to file with pretty formatting
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');

    res.json({ success: true, config: newConfig });
  } catch (error) {
    console.error('Error writing config:', error);
    res.status(500).json({ error: 'Failed to write config file' });
  }
});

app.post('/api/claude', async (req, res) => {
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

// Share/Preview endpoints
const sharesDir = path.join(__dirname, 'public', 'share');

// Ensure shares directory exists
if (!fs.existsSync(sharesDir)) {
  fs.mkdirSync(sharesDir, { recursive: true });
}

// Get share by ID
app.get('/api/shares/:shareId', (req, res) => {
  try {
    const { shareId } = req.params;
    const sharePath = path.join(sharesDir, shareId, 'share.json');

    if (!fs.existsSync(sharePath)) {
      return res.status(404).json({ error: 'Share not found' });
    }

    const shareData = JSON.parse(fs.readFileSync(sharePath, 'utf8'));
    res.json(shareData);
  } catch (error) {
    console.error('Error reading share:', error);
    res.status(500).json({ error: 'Failed to read share' });
  }
});

// Helper function to populate template with message data
function populateTemplate(html, messageData, templateConfig, imageBaseUrls) {
  if (!messageData || !html) return html;
  let result = html;

  if (templateConfig && templateConfig.placeholders) {
    Object.keys(templateConfig.placeholders).forEach(placeholderName => {
      const config = templateConfig.placeholders[placeholderName];
      const binding = config['binding-messagingmatrix'];
      let value = config.default || '';

      if (binding) {
        const fieldName = binding.replace(/^message\./i, '').toLowerCase();
        value = messageData[fieldName] || value;

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

  return result;
}

// Create new share
app.post('/api/shares', async (req, res) => {
  try {
    const { assetIds, creatives = [], title, baseColor, templateData = {} } = req.body;

    // Load config to get image base URLs
    const configPath = path.join(__dirname, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
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

          // Populate template with message data
          let populatedHtml = populateTemplate(
            templateData.templateHtml,
            creative.messageData,
            templateData.templateConfig,
            imageBaseUrls
          );

          // Extract and copy images to local folder
          const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
          const imagesToCopy = [];
          let match;

          while ((match = imgRegex.exec(populatedHtml)) !== null) {
            imagesToCopy.push(match[1]);
          }

          // Copy images and update HTML references
          for (const imgSrc of imagesToCopy) {
            try {
              let localImagePath = null;
              const imgFilename = path.basename(imgSrc);

              // Handle local file paths (e.g., /src/assets/image.png or src/assets/image.png)
              if (imgSrc.startsWith('/')) {
                // Absolute path from project root
                localImagePath = path.join(__dirname, imgSrc);
              } else if (imgSrc.startsWith('src/') || imgSrc.startsWith('public/')) {
                // Relative path from project root
                localImagePath = path.join(__dirname, imgSrc);
              } else if (!imgSrc.startsWith('http://') && !imgSrc.startsWith('https://')) {
                // Try to find the image in common locations
                const possiblePaths = [
                  path.join(__dirname, 'src', 'assets', imgFilename),
                  path.join(__dirname, 'src', 'creatives', imgFilename),
                  path.join(__dirname, 'public', imgFilename)
                ];

                for (const possiblePath of possiblePaths) {
                  if (fs.existsSync(possiblePath)) {
                    localImagePath = possiblePath;
                    break;
                  }
                }
              }

              // Copy the image file if we found a local path
              if (localImagePath && fs.existsSync(localImagePath)) {
                const destPath = path.join(adDir, imgFilename);
                fs.copyFileSync(localImagePath, destPath);

                // Update HTML to reference local image
                populatedHtml = populatedHtml.replace(
                  new RegExp(`src=["']${imgSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'g'),
                  `src="${imgFilename}"`
                );

                console.log(`  ✓ Copied image: ${imgFilename}`);
              } else if (imgSrc.startsWith('http://') || imgSrc.startsWith('https://')) {
                // For remote URLs, keep the original URL (downloading would add complexity and latency)
                console.log(`  → Remote image (kept as URL): ${imgFilename}`);
              }
            } catch (imgError) {
              console.error(`  ✗ Error copying image ${imgSrc}:`, imgError.message);
            }
          }

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

              // Replace {{ad.width}} and {{ad.height}} with actual values
              manifestContent = manifestContent.replace(/\{\{ad\.width\}\}/g, creative.bannerSize.width.toString());
              manifestContent = manifestContent.replace(/\{\{ad\.height\}\}/g, creative.bannerSize.height.toString());

              // Save populated manifest
              fs.writeFileSync(path.join(adDir, 'manifest.json'), manifestContent, 'utf8');
              console.log(`  ✓ Copied and populated manifest.json`);
            } catch (manifestError) {
              console.error(`  ✗ Error processing manifest.json:`, manifestError.message);
            }
          }

          console.log(`✓ Created static ad: ${folderName}`);

          // Add to processed assets list with new path and mark as local folder review
          processedAssets.push({
            ...creative,
            staticPath: `/share/${shareId}/${folderName}/index.html`,
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

    // Write share.json
    fs.writeFileSync(
      path.join(shareDir, 'share.json'),
      JSON.stringify(shareData, null, 2),
      'utf8'
    );

    // Return share info
    res.json({
      shareId,
      url: `/share/${shareId}`
    });
  } catch (error) {
    console.error('Error creating share:', error);
    res.status(500).json({ error: 'Failed to create share' });
  }
});

// Add comment to share
app.post('/api/shares/:shareId/comments', (req, res) => {
  try {
    const { shareId } = req.params;
    const { author, text } = req.body;
    const sharePath = path.join(sharesDir, shareId, 'share.json');

    if (!fs.existsSync(sharePath)) {
      return res.status(404).json({ error: 'Share not found' });
    }

    const shareData = JSON.parse(fs.readFileSync(sharePath, 'utf8'));

    const comment = {
      id: Date.now().toString(),
      author,
      text,
      timestamp: new Date().toISOString()
    };

    shareData.comments.push(comment);

    fs.writeFileSync(sharePath, JSON.stringify(shareData, null, 2), 'utf8');

    res.json({ comment });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
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

    const templates = fs.readdirSync(templatesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
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

// Email endpoints
// Get emails from IMAP server
app.get('/api/emails', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const unseenOnly = req.query.unseenOnly !== 'false';

    const emails = await fetchEmails(limit, unseenOnly);
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

    const prompt = `You are an intelligent task manager. Analyze the following emails and extract actionable tasks from them. For each email, identify:
1. What action needs to be taken
2. The priority level (High, Medium, Low)
3. A clear, concise task description
4. Any relevant deadline or due date mentioned
5. The email source (subject and sender)

Return your response as a JSON array of tasks with this structure:
[
  {
    "title": "Task title",
    "description": "Detailed description",
    "priority": "High|Medium|Low",
    "dueDate": "ISO date string or null",
    "source": "Email subject",
    "from": "Sender name/email",
    "status": "pending",
    "emailUid": email UID number
  }
]

If an email doesn't contain actionable tasks, you can skip it or note it as informational.

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
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
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
        // Add email UIDs to tasks
        tasks = tasks.map((task, idx) => ({
          ...task,
          id: `task-${Date.now()}-${idx}`,
          emailUid: emails[idx]?.uid || null,
          createdAt: new Date().toISOString()
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
    await markEmailAsSeen(uid);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking email as read:', error);
    res.status(500).json({ error: error.message });
  }
});

// Task endpoints
const tasksFilePath = path.join(__dirname, 'tasks.json');
const processedEmailsFilePath = path.join(__dirname, 'processed-emails.json');

// Helper function to read tasks
function readTasks() {
  try {
    if (fs.existsSync(tasksFilePath)) {
      const data = fs.readFileSync(tasksFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading tasks:', error);
  }
  return [];
}

// Helper function to write tasks
function writeTasks(tasks) {
  try {
    fs.writeFileSync(tasksFilePath, JSON.stringify(tasks, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing tasks:', error);
    return false;
  }
}

// Helper function to read processed emails
function readProcessedEmails() {
  try {
    if (fs.existsSync(processedEmailsFilePath)) {
      const data = fs.readFileSync(processedEmailsFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading processed emails:', error);
  }
  return [];
}

// Helper function to write processed emails
function writeProcessedEmails(emailUids) {
  try {
    fs.writeFileSync(processedEmailsFilePath, JSON.stringify(emailUids, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing processed emails:', error);
    return false;
  }
}

// Get all tasks
app.get('/api/tasks', (req, res) => {
  try {
    const tasks = readTasks();
    res.json({ tasks });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save tasks
app.post('/api/tasks', (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error: 'tasks must be an array' });
    }

    const success = writeTasks(tasks);
    if (success) {
      res.json({ success: true, tasks });
    } else {
      res.status(500).json({ error: 'Failed to save tasks' });
    }
  } catch (error) {
    console.error('Error saving tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get processed email UIDs
app.get('/api/processed-emails', (req, res) => {
  try {
    const processedEmails = readProcessedEmails();
    res.json({ processedEmails });
  } catch (error) {
    console.error('Error getting processed emails:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add processed email UIDs
app.post('/api/processed-emails', (req, res) => {
  try {
    const { emailUids } = req.body;
    if (!Array.isArray(emailUids)) {
      return res.status(400).json({ error: 'emailUids must be an array' });
    }

    const existingProcessed = readProcessedEmails();
    const updated = [...new Set([...existingProcessed, ...emailUids])];

    const success = writeProcessedEmails(updated);
    if (success) {
      res.json({ success: true, processedEmails: updated });
    } else {
      res.status(500).json({ error: 'Failed to save processed emails' });
    }
  } catch (error) {
    console.error('Error saving processed emails:', error);
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
function extractMetadata(filename) {
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|mp4|gif)$/i, '');
  const parts = nameWithoutExt.split('_');

  const sizeMatch = nameWithoutExt.match(/(\d+)x(\d+)/);
  const size = sizeMatch ? `${sizeMatch[1]}x${sizeMatch[2]}` : '';

  let product = '';
  let platform = '';
  let variant = '';
  let templateSource = '';

  if (parts.length >= 2) {
    product = parts[0] || '';
    platform = parts[1] || '';
  }
  if (parts.length >= 4) {
    variant = parts[3] || '';
  }
  if (parts.length >= 5) {
    templateSource = parts[4] || '';
  }

  return {
    product,
    platform,
    size,
    variant,
    templateSource,
    ext: filename.split('.').pop().toLowerCase()
  };
}

// Preview metadata for uploaded file
app.post('/api/assets/preview-metadata', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const metadata = extractMetadata(req.file.originalname);

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
    const { tempFilename, metadata, targetDir = 'creatives' } = req.body;

    if (!tempFilename || !metadata) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Construct final filename
    const finalFilename = `${metadata.product}_${metadata.platform}_${metadata.size}_${metadata.variant}_${metadata.templateSource}.${metadata.ext}`;

    // Determine target directory
    const targetDirectory = targetDir === 'assets' ? assetsDir : creativesDir;

    // Move file from temp to final location
    const tempPath = path.join(tempDir, tempFilename);
    const finalPath = path.join(targetDirectory, finalFilename);

    if (!fs.existsSync(tempPath)) {
      return res.status(404).json({ error: 'Temp file not found' });
    }

    await fsPromises.rename(tempPath, finalPath);

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
const server = app.listen(PORT, () => {
  console.log(`\n✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Make sure VITE_ANTHROPIC_API_KEY is set in your .env file\n`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n✗ ERROR: Port ${PORT} is already in use!`);
    console.error(`  Run 'npm run kill' to free up the port, then try again.\n`);
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

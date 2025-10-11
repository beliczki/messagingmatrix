import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3003;

// Configure CORS with explicit options for Chrome compatibility
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Claude API proxy server running on http://localhost:${PORT}`);
  console.log(`Make sure VITE_ANTHROPIC_API_KEY is set in your .env file`);
});

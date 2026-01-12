import { apiPost, authenticatedFetch } from '../utils/api.js';

// Unified AI API proxy that routes to different providers
// All responses are normalized to Claude-like format for frontend compatibility

/**
 * Call AI API with provider routing
 * @param {string} apiKey - API key (legacy, now read from server .env)
 * @param {Array} messages - Messages array
 * @param {string} model - Model ID (determines provider from prefix or explicit model ID)
 * @param {number} maxTokens - Max tokens for response
 * @param {string} provider - Optional explicit provider ('claude', 'gemini', 'grok')
 * @returns {Promise<Object>} - Normalized response with content, model, stop_reason, usage
 */
export async function callAIAPI(apiKey, messages, model, maxTokens = 4096, provider = null) {
  // Determine provider from model ID if not explicitly specified
  const resolvedProvider = provider || getProviderFromModel(model);

  // Route to appropriate endpoint
  const endpoint = `/api/${resolvedProvider}`;

  try {
    const response = await authenticatedFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        model,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `API error (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    // Check if it's a connection error
    if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to backend server. Make sure to run: npm run server');
    }
    throw error;
  }
}

/**
 * Determine provider from model ID
 * @param {string} model - Model ID
 * @returns {string} - Provider name ('claude', 'gemini', 'grok')
 */
function getProviderFromModel(model) {
  if (!model) return 'claude';

  const modelLower = model.toLowerCase();

  if (modelLower.includes('gemini')) {
    return 'gemini';
  }
  if (modelLower.includes('grok')) {
    return 'grok';
  }
  // Default to Claude for claude-* models or any unrecognized models
  return 'claude';
}

/**
 * Legacy function for backwards compatibility
 * Routes to callAIAPI with Claude as default
 */
export async function callClaudeAPI(apiKey, messages, model = 'claude-3-5-sonnet-20241022', maxTokens = 4096) {
  return callAIAPI(apiKey, messages, model, maxTokens, 'claude');
}

/**
 * Call Gemini API
 */
export async function callGeminiAPI(apiKey, messages, model = 'gemini-2.0-flash', maxTokens = 4096) {
  return callAIAPI(apiKey, messages, model, maxTokens, 'gemini');
}

/**
 * Call Grok API
 */
export async function callGrokAPI(apiKey, messages, model = 'grok-3', maxTokens = 4096) {
  return callAIAPI(apiKey, messages, model, maxTokens, 'grok');
}

/**
 * Call AI API with streaming response
 * @param {string} apiKey - API key (legacy, now read from server .env)
 * @param {Array} messages - Messages array
 * @param {string} model - Model ID (determines provider from prefix or explicit model ID)
 * @param {number} maxTokens - Max tokens for response
 * @param {number} temperature - Temperature for response (0-2)
 * @param {function} onChunk - Callback for each text chunk: (text) => void
 * @param {function} onDone - Callback when stream completes: () => void
 * @param {function} onError - Callback for errors: (error) => void
 * @returns {Promise<void>}
 */
export async function callAIAPIStream(apiKey, messages, model, maxTokens = 4096, temperature = 0.7, onChunk, onDone, onError) {
  const resolvedProvider = getProviderFromModel(model);
  const endpoint = `/api/${resolvedProvider}/stream`;

  try {
    const token = localStorage.getItem('auth_token');
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(
      (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3003' : '')) + endpoint,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages,
          model,
          max_tokens: maxTokens,
          temperature
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `API error (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              onError?.(new Error(data.error));
              return;
            }
            if (data.content) {
              onChunk?.(data.content);
            }
            if (data.done) {
              onDone?.();
              return;
            }
          } catch (e) {
            // Skip unparseable lines
          }
        }
      }
    }

    onDone?.();
  } catch (error) {
    if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
      onError?.(new Error('Cannot connect to backend server. Make sure to run: npm run server'));
    } else {
      onError?.(error);
    }
  }
}

/**
 * Generate image using Gemini's image generation model
 * @param {string} prompt - Description of the image to generate
 * @param {Object} options - Generation options
 * @param {string} options.inputImage - Optional base64 data URL of reference image
 * @param {string} options.aspectRatio - Aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4)
 * @param {string} options.imageSize - Image size (1K, 2K)
 * @param {string} options.model - Model to use (default: gemini-2.0-flash-exp-image-generation)
 * @returns {Promise<Object>} - { image: { mimeType, data }, description }
 */
export async function generateImage(prompt, options = {}) {
  const { inputImage, aspectRatio = '1:1', imageSize = '1K', model = 'gemini-2.0-flash-exp-image-generation' } = options;

  try {
    const response = await authenticatedFetch('/api/gemini/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        inputImage,
        aspectRatio,
        imageSize,
        model
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Image generation failed (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to backend server. Make sure to run: npm run server');
    }
    throw error;
  }
}

/**
 * Generate description for a creative/image using AI vision
 * @param {string} imageDataUrl - Base64 data URL of the image/screenshot
 * @param {Object} context - Context about the creative (audienceName, topicName, templateName)
 * @param {string} model - AI model to use (default: gemini-2.0-flash)
 * @returns {Promise<Object>} - AI response with description
 */
export async function generateCreativeDescription(imageDataUrl, context = {}, model = 'gemini-2.0-flash') {
  const prompt = `Analyze this creative/advertisement image and provide a detailed visual description.

Context:
- Audience: ${context.audienceName || 'N/A'}
- Topic: ${context.topicName || 'N/A'}
- Template: ${context.templateName || 'N/A'}

Please describe:
1. Overall layout and composition
2. Key visual elements (images, graphics, colors)
3. Text content and typography if visible
4. Call-to-action elements
5. Brand elements or logos
6. Mood/style (professional, playful, urgent, etc.)

Provide a concise but comprehensive description (2-3 paragraphs) that could help recreate this creative or generate a similar one.`;

  // Extract base64 data from data URL
  const base64Match = imageDataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!base64Match) {
    throw new Error('Invalid image data URL format');
  }

  const mimeType = base64Match[1];
  const base64Data = base64Match[2];

  // Build messages with image attachment for Gemini
  const messages = [{
    role: 'user',
    content: [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: base64Data
        }
      },
      { type: 'text', text: prompt }
    ]
  }];

  return callAIAPI(null, messages, model, 2048, 'gemini');
}

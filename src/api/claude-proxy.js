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

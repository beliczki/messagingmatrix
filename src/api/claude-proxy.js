// API proxy that calls our backend server to avoid CORS issues

export async function callClaudeAPI(apiKey, messages, model = 'claude-3-5-sonnet-20241022', maxTokens = 4096) {
  try {
    // Call our backend proxy server
    const response = await fetch('http://localhost:3003/api/claude', {
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

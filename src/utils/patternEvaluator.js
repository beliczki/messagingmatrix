// Pattern Evaluator Utility
// Evaluates pattern templates by replacing placeholders with actual values

/**
 * Evaluates a pattern template by replacing placeholders
 * @param {string} pattern - The pattern template with {{placeholders}}
 * @param {object} context - Context object containing data (message, audiences, topics, etc.)
 * @returns {string} - Evaluated pattern with replaced values
 */
export function evaluatePattern(pattern, context) {
  if (!pattern) return '';

  let result = pattern;

  // Replace all {{placeholder}} patterns
  const regex = /\{\{([^}]+)\}\}/g;
  result = result.replace(regex, (match, expression) => {
    try {
      return evaluateExpression(expression.trim(), context);
    } catch (error) {
      console.warn(`Failed to evaluate expression: ${expression}`, error);
      return match; // Return original if evaluation fails
    }
  });

  return result;
}

/**
 * Evaluates a single expression
 * @param {string} expression - The expression to evaluate (e.g., "Audience_Key" or "audiences[Audience_Key].Strategy")
 * @param {object} context - Context object containing data
 * @returns {string} - Evaluated value
 */
function evaluateExpression(expression, context) {
  // Handle simple variables first
  if (context.hasOwnProperty(expression)) {
    return String(context[expression] || '');
  }

  // Handle array access patterns like audiences[key].field
  const arrayAccessMatch = expression.match(/^(\w+)\[([^\]]+)\]\.(\w+)$/);
  if (arrayAccessMatch) {
    const [, arrayName, keyExpr, field] = arrayAccessMatch;

    // Evaluate the key expression first
    const key = evaluateExpression(keyExpr, context);

    // Get the array from context
    const array = context[arrayName];
    if (!array || !Array.isArray(array)) {
      return '';
    }

    // Find the item by key field
    const item = array.find(item => item.key === key);
    if (!item) {
      return '';
    }

    // Return the field value (case-insensitive lookup)
    // Try exact match first, then case-insensitive
    if (item[field] !== undefined) {
      return String(item[field] || '');
    }

    // Try lowercase version
    const fieldLower = field.toLowerCase();
    if (item[fieldLower] !== undefined) {
      return String(item[fieldLower] || '');
    }

    // Try with underscores (PascalCase to snake_case)
    const fieldSnake = field.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    if (item[fieldSnake] !== undefined) {
      return String(item[fieldSnake] || '');
    }

    return '';
  }

  // Handle nested object access like message.field
  const objectAccessMatch = expression.match(/^(\w+)\.(\w+)$/);
  if (objectAccessMatch) {
    const [, objectName, field] = objectAccessMatch;
    const obj = context[objectName];
    if (obj && typeof obj === 'object') {
      return String(obj[field] || '');
    }
  }

  return '';
}

/**
 * Build trafficking URL with smart query parameter handling
 * @param {string} landingUrl - Base landing URL
 * @param {object} params - Query parameters object
 * @returns {string} - Complete URL with query parameters
 */
export function buildTraffickingUrl(landingUrl, params) {
  if (!landingUrl) return '';

  // Remove trailing & if present
  let url = landingUrl.trim().replace(/&$/, '');

  // Check if URL already has query parameters
  const hasQueryParams = url.includes('?');
  const separator = hasQueryParams ? '&' : '?';

  // Build query string from params
  const queryParts = [];
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  });

  if (queryParts.length === 0) {
    return url;
  }

  return `${url}${separator}${queryParts.join('&')}`;
}

/**
 * Generate PMMID based on pattern
 * @param {object} message - Message object
 * @param {array} audiences - Array of audiences
 * @param {string} pattern - PMMID pattern template
 * @returns {string} - Generated PMMID
 */
export function generatePMMID(message, audiences, pattern) {
  const context = {
    ...message,
    audiences,
    Audience_Key: message.audience,
    Topic_Key: message.topic,
    Number: message.number,
    Variant: message.variant,
    Version: message.version
  };

  return evaluatePattern(pattern, context);
}

/**
 * Generate Topic Key based on pattern
 * @param {object} topic - Topic object
 * @param {string} pattern - Topic key pattern template
 * @returns {string} - Generated topic key
 */
export function generateTopicKey(topic, pattern) {
  const context = {
    ...topic,
    Tag1: topic.tag1 || '',
    Tag2: topic.tag2 || '',
    Tag3: topic.tag3 || '',
    Tag4: topic.tag4 || '',
    Product: topic.product || ''
  };

  return evaluatePattern(pattern, context);
}

/**
 * Generate all trafficking fields based on patterns
 * @param {object} message - Message object
 * @param {array} audiences - Array of audiences
 * @param {object} patterns - Trafficking patterns from settings
 * @returns {object} - Object with all trafficking fields
 */
export function generateTraffickingFields(message, audiences, patterns) {
  const context = {
    ...message,
    audiences,
    Audience_Key: message.audience,
    Topic_Key: message.topic,
    Number: message.number,
    Variant: message.variant,
    Version: message.version,
    Landing_URL: message.landingUrl || '',
    PMMID: message.pmmid || ''
  };

  // Evaluate all trafficking patterns
  const utmCampaign = evaluatePattern(patterns.utm_campaign, context);
  const utmSource = evaluatePattern(patterns.utm_source, context);
  const utmMedium = evaluatePattern(patterns.utm_medium, context);
  const utmContent = evaluatePattern(patterns.utm_content, context);
  const utmTerm = evaluatePattern(patterns.utm_term, context);
  const utmCd26 = evaluatePattern(patterns.utm_cd26, context);

  // Build final URL
  const finalUrl = buildTraffickingUrl(message.landingUrl || '', {
    utm_campaign: utmCampaign,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_content: utmContent,
    utm_term: utmTerm,
    utm_cd26: utmCd26
  });

  return {
    utm_campaign: utmCampaign,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_content: utmContent,
    utm_term: utmTerm,
    utm_cd26: utmCd26,
    final_trafficked_url: finalUrl
  };
}

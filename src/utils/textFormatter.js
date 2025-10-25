/**
 * Text Formatting Utility
 *
 * Applies text formatting rules based on exact text matching and size scope.
 * Uses span-based approach where all variants are included in HTML and CSS controls visibility.
 *
 * Rules structure:
 * {
 *   id: string,
 *   text_original: string,      // Text to match exactly
 *   text_formatted: string,      // Formatted replacement text
 *   formatting_scope: string[]   // Empty array = all sizes, or array of specific sizes like ["300x250", "640x360"]
 * }
 */

/**
 * Generate span-wrapped HTML with all text formatting variants
 * CSS using body class (e.g., size-300x250) will control which variant is visible
 * @param {string} text - The original text
 * @param {Array} formattingRules - Array of formatting rules from Text_Formatting sheet
 * @returns {string} - HTML with spans for default and all size-specific variants
 */
export const applyTextFormattingSpans = (text, formattingRules) => {
  // All available sizes in templates
  const allSizes = ['300x250', '300x600', '640x360', '970x250', '1080x1080'];

  // Return original text if no text or no rules
  if (!text || !formattingRules || formattingRules.length === 0) {
    return text;
  }

  // Find all rules that match this text
  const matchingRules = formattingRules.filter(rule => rule.text_original === text);

  // If no matching rules, return original text as-is
  if (matchingRules.length === 0) {
    return text;
  }

  // Check if we have any scoped rules (rules with non-empty scope)
  const hasScopedRules = matchingRules.some(rule => rule.formatting_scope && rule.formatting_scope.length > 0);

  // Build spans for all variants
  const spans = [];

  if (hasScopedRules) {
    // Generate spans for ALL sizes
    // Default span (fallback)
    spans.push(`<span class="text-default">${text}</span>`);

    // Create a map of size -> formatted text
    const sizeTextMap = {};
    matchingRules.forEach(rule => {
      if (rule.formatting_scope && rule.formatting_scope.length > 0) {
        rule.formatting_scope.forEach(size => {
          sizeTextMap[size] = rule.text_formatted;
        });
      }
    });

    // Generate span for each size
    allSizes.forEach(size => {
      const textForSize = sizeTextMap[size] || text; // Use formatted if in scope, otherwise original
      spans.push(`<span class="text-${size}">${textForSize}</span>`);
    });
  } else {
    // No scoped rules - scope is full (applies to all sizes)
    // Use text-default and text-allSizes
    spans.push(`<span class="text-default">${text}</span>`);

    // Find the formatted text from the all-sizes rule
    const allSizesRule = matchingRules.find(rule => !rule.formatting_scope || rule.formatting_scope.length === 0);
    if (allSizesRule) {
      spans.push(`<span class="text-allSizes">${allSizesRule.text_formatted}</span>`);
    }
  }

  return spans.join('');
};

/**
 * Legacy function for backwards compatibility - applies formatting for a specific size
 * @param {string} text - The text to potentially format
 * @param {string} size - The current size (e.g., "300x250", "640x360")
 * @param {Array} formattingRules - Array of formatting rules from Text_Formatting sheet
 * @returns {string} - The formatted text if a matching rule is found, otherwise original text
 */
export const applyTextFormatting = (text, size, formattingRules) => {
  // Return original if no text or no rules
  if (!text || !formattingRules || formattingRules.length === 0) {
    return text;
  }

  // Find matching rule where text_original exactly matches the input text
  const matchingRule = formattingRules.find(rule => {
    // Must have exact match on original text
    if (rule.text_original !== text) {
      return false;
    }

    // Check scope
    // Empty scope array means apply to all sizes
    if (!rule.formatting_scope || rule.formatting_scope.length === 0) {
      return true;
    }

    // Otherwise, check if current size is in the scope
    return rule.formatting_scope.includes(size);
  });

  // Return formatted text if match found, otherwise original
  return matchingRule ? matchingRule.text_formatted : text;
};

/**
 * Escape HTML special characters while preserving <br/> and <br> tags
 * @param {string} text - Text to escape
 * @returns {string} - HTML-escaped text with br tags preserved
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    // Convert escaped br tags back to real br tags
    .replace(/&lt;br\s*\/?&gt;/gi, '<br/>');
}

/**
 * Apply text formatting to all text fields in a message object
 * @param {Object} message - Message object with text fields (headline, copy1, copy2, flash, cta, disclaimer)
 * @param {string} size - The current size (e.g., "300x250", "640x360")
 * @param {Array} formattingRules - Array of formatting rules from Text_Formatting sheet
 * @returns {Object} - New message object with formatted text fields
 */
export const applyTextFormattingToMessage = (message, size, formattingRules) => {
  if (!message || !formattingRules || formattingRules.length === 0) {
    return message;
  }

  const textFields = ['headline', 'copy1', 'copy2', 'flash', 'cta', 'disclaimer'];
  const formattedMessage = { ...message };

  textFields.forEach(field => {
    if (formattedMessage[field]) {
      formattedMessage[field] = applyTextFormatting(
        formattedMessage[field],
        size,
        formattingRules
      );
    }
  });

  return formattedMessage;
};

/**
 * Extract size from template name or use default
 * @param {string} templateName - Template name (e.g., "banner_300x250", "300x250")
 * @returns {string} - Size string (e.g., "300x250")
 */
export const extractSizeFromTemplate = (templateName) => {
  if (!templateName) return '';

  // Match patterns like "300x250", "640x360", "1080x1080"
  const sizeMatch = templateName.match(/(\d+x\d+)/);
  return sizeMatch ? sizeMatch[1] : '';
};

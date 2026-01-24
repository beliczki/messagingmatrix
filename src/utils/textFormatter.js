/**
 * Text Formatting Utility
 *
 * Applies text formatting rules based on exact text matching, size scope, and MC scope.
 * Uses span-based approach where all variants are included in HTML and CSS controls visibility.
 *
 * Rules structure:
 * {
 *   id: string,
 *   text_original: string,           // Text to match exactly
 *   text_formatted: string,           // Formatted replacement text
 *   formatting_scope: string[]        // Empty array = all sizes, or array of specific sizes like ["300x250", "640x360"]
 *   formatting_mc_scope: string[]     // Empty array = global (all MCs), or array of specific MC IDs
 * }
 */

/**
 * Generate span-wrapped HTML with all text formatting variants
 * CSS using body class (e.g., size-300x250) will control which variant is visible
 * @param {string} text - The original text
 * @param {Array} formattingRules - Array of formatting rules from Text_Formatting sheet
 * @param {string|object} messageId - Message ID string or object with multiple identifiers {id, poms_id, name, number, variant, numberVariant}
 * @param {Array} templateSizes - Optional array of sizes from template config (e.g., ['300x250', '500x200'])
 * @returns {string} - HTML with spans for default and all size-specific variants
 */
export const applyTextFormattingSpans = (text, formattingRules, messageId = null, templateSizes = null) => {
  // Start with template sizes if provided, otherwise use defaults
  const baseSizes = templateSizes && templateSizes.length > 0
    ? templateSizes
    : ['300x250', '300x600', '640x360', '970x250', '1080x1080'];

  // Also extract any sizes used in formatting rules to ensure all needed spans are generated
  const sizesFromRules = new Set();
  if (formattingRules && formattingRules.length > 0) {
    formattingRules.forEach(rule => {
      if (rule.text_original === text) {
        // Parse formatting_scope (can be array or comma-separated string)
        let scopeArray = [];
        if (Array.isArray(rule.formatting_scope)) {
          scopeArray = rule.formatting_scope;
        } else if (rule.formatting_scope && typeof rule.formatting_scope === 'string') {
          scopeArray = rule.formatting_scope.split(',').map(s => s.trim());
        }
        scopeArray.filter(s => s).forEach(size => sizesFromRules.add(size));
      }
    });
  }

  // Merge base sizes with sizes from rules (unique values only)
  const allSizes = [...new Set([...baseSizes, ...sizesFromRules])];

  // Debug: log function entry
  // console.log('📥 applyTextFormattingSpans called:', {
  //   text: text?.substring(0, 40) + '...',
  //   hasText: !!text,
  //   rulesCount: formattingRules?.length || 0,
  //   hasMessageId: !!messageId,
  //   messageIdType: typeof messageId
  // });

  // Return original text if no text or no rules
  if (!text || !formattingRules || formattingRules.length === 0) {
    return text;
  }

  // Find all rules that match this text and MC scope
  const matchingRules = formattingRules.filter(rule => {
    // Must match text exactly
    if (rule.text_original !== text) return false;

    // Check MC scope: empty = global (apply to all), or must include this messageId
    // Handle both array and comma-separated string formats
    let mcScopeArray = [];
    if (Array.isArray(rule.formatting_mc_scope)) {
      mcScopeArray = rule.formatting_mc_scope.filter(s => s);
    } else if (rule.formatting_mc_scope && typeof rule.formatting_mc_scope === 'string') {
      mcScopeArray = rule.formatting_mc_scope.split(',').map(s => s.trim()).filter(s => s);
    }

    if (mcScopeArray.length > 0) {
      if (!messageId) {
        // console.log('⚠️ MC Scope rule exists but no messageId provided:', {
        //   text: text.substring(0, 40),
        //   ruleId: rule.id,
        //   mcScope: mcScopeArray
        // });
        return false;
      }

      // MC scope is specified, check if any identifier matches
      // messageId can be a string or an object with multiple identifiers
      let identifiersToCheck = [];

      if (typeof messageId === 'object') {
        // Object with multiple identifiers - check all of them
        identifiersToCheck = [
          messageId.id,
          messageId.poms_id,
          messageId.name,
          messageId.number,
          messageId.numberVariant,
          `${messageId.number}${messageId.variant}`, // e.g., "1a"
          `MC${messageId.number}${messageId.variant}` // e.g., "MC1a"
        ].filter(id => id && id !== ''); // Remove empty/null values
      } else {
        // Simple string ID
        identifiersToCheck = [String(messageId)];
      }

      // Check if any identifier matches any value in the MC scope
      const matches = identifiersToCheck.some(identifier =>
        mcScopeArray.includes(identifier)
      );

      // Debug MC scope matching for this specific text
      // console.log('🔍 Checking MC Scope match:', {
      //   text: text.substring(0, 40),
      //   ruleId: rule.id,
      //   mcScope: mcScopeArray,
      //   identifiersChecked: identifiersToCheck,
      //   matches: matches
      // });

      return matches;
    }

    // No MC scope specified, apply globally
    // console.log('✅ Global rule (no MC scope):', {
    //   text: text.substring(0, 40),
    //   ruleId: rule.id
    // });
    return true;
  });

  // If no matching rules, return original text as-is
  if (matchingRules.length === 0) {
    return text;
  }

  // Helper to parse formatting_scope (can be array or comma-separated string)
  const parseScopeArray = (scope) => {
    if (Array.isArray(scope)) return scope.filter(s => s);
    if (scope && typeof scope === 'string') return scope.split(',').map(s => s.trim()).filter(s => s);
    return [];
  };

  // Check if we have any scoped rules (rules with non-empty scope)
  const hasScopedRules = matchingRules.some(rule => parseScopeArray(rule.formatting_scope).length > 0);

  // Build spans for all variants
  const spans = [];

  if (hasScopedRules) {
    // Generate spans for ALL sizes
    // Default span (fallback)
    spans.push(`<span class="text-default">${text}</span>`);

    // Find any "all sizes" rule (empty scope) to use as fallback for sizes without specific rules
    const allSizesRule = matchingRules.find(rule => parseScopeArray(rule.formatting_scope).length === 0);
    const allSizesFallback = allSizesRule ? allSizesRule.text_formatted : text;

    // Create a map of size -> formatted text
    const sizeTextMap = {};
    matchingRules.forEach(rule => {
      const scopeArray = parseScopeArray(rule.formatting_scope);
      if (scopeArray.length > 0) {
        scopeArray.forEach(size => {
          sizeTextMap[size] = rule.text_formatted;
        });
      }
    });

    // Generate span for each size
    // Priority: scoped rule > all-sizes rule > original text
    allSizes.forEach(size => {
      const textForSize = sizeTextMap[size] || allSizesFallback;
      spans.push(`<span class="text-${size}">${textForSize}</span>`);
    });
  } else {
    // No scoped rules - scope is full (applies to all sizes)
    // Use text-default and text-allSizes
    spans.push(`<span class="text-default">${text}</span>`);

    // Find the formatted text from the all-sizes rule
    const allSizesRule = matchingRules.find(rule => parseScopeArray(rule.formatting_scope).length === 0);
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
 * @param {string|object} messageId - Message ID string or object with multiple identifiers
 * @returns {string} - The formatted text if a matching rule is found, otherwise original text
 */
export const applyTextFormatting = (text, size, formattingRules, messageId = null) => {
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

    // Check MC scope: empty = global (apply to all), or must include this messageId
    // Handle both array and comma-separated string formats
    let mcScopeArray = [];
    if (Array.isArray(rule.formatting_mc_scope)) {
      mcScopeArray = rule.formatting_mc_scope.filter(s => s);
    } else if (rule.formatting_mc_scope && typeof rule.formatting_mc_scope === 'string') {
      mcScopeArray = rule.formatting_mc_scope.split(',').map(s => s.trim()).filter(s => s);
    }

    if (mcScopeArray.length > 0) {
      if (!messageId) return false;

      // Build list of identifiers to check (same logic as applyTextFormattingSpans)
      let identifiersToCheck = [];
      if (typeof messageId === 'object') {
        identifiersToCheck = [
          messageId.id,
          messageId.poms_id,
          messageId.name,
          messageId.number,
          messageId.numberVariant,
          `${messageId.number}${messageId.variant}`,
          `MC${messageId.number}${messageId.variant}`
        ].filter(id => id && id !== '');
      } else {
        identifiersToCheck = [String(messageId)];
      }

      // Check if any identifier matches
      const matches = identifiersToCheck.some(identifier =>
        mcScopeArray.includes(identifier)
      );

      if (!matches) return false;
    }

    // Check size scope - handle both array and comma-separated string formats
    let scopeArray = [];
    if (Array.isArray(rule.formatting_scope)) {
      scopeArray = rule.formatting_scope.filter(s => s);
    } else if (rule.formatting_scope && typeof rule.formatting_scope === 'string') {
      scopeArray = rule.formatting_scope.split(',').map(s => s.trim()).filter(s => s);
    }

    // Empty scope means apply to all sizes
    if (scopeArray.length === 0) {
      return true;
    }

    // Otherwise, check if current size is in the scope
    return scopeArray.includes(size);
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
 * @param {string} messageId - Optional message ID to filter MC-scoped rules
 * @returns {Object} - New message object with formatted text fields
 */
export const applyTextFormattingToMessage = (message, size, formattingRules, messageId = null) => {
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
        formattingRules,
        messageId || message.id // Use provided messageId or fallback to message.id
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

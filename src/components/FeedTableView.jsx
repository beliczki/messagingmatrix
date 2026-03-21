import React from 'react';
import { evaluatePattern } from '../utils/patternEvaluator';
import { applyTextFormattingSpans } from '../utils/textFormatter';

const FeedTableView = ({
  messages,
  audiences,
  topics,
  feedStructure,
  feedPatterns,
  statusFilters,
  productFilters,
  mcFilter,
  textFormatting,
  templateSizesMap,
  getStatusColors,
  onMessageClick
}) => {
  // Smart fallback pattern mapping for common feed column formats
  const getDefaultPattern = (name) => {
    // Remove prefix like "Text:", "Asset:", "LP:" etc.
    const cleanName = name.replace(/^[^:]+:/, '');
    const cleanNameLower = cleanName.toLowerCase();

    // Common mappings for feed columns to message fields (case-insensitive)
    const commonMappings = {
      // Text fields
      'headline_text_1': '{{headline}}',
      'headline_text': '{{headline}}',
      'headline': '{{headline}}',
      'copy_text_1': '{{copy1}}',
      'copy1': '{{copy1}}',
      'copy_text_2': '{{copy2}}',
      'copy2': '{{copy2}}',
      'click_text': '{{cta}}',
      'cta_text_1': '{{cta}}',
      'cta': '{{cta}}',
      'flash_text': '{{flash}}',
      'sticker_text_1': '{{flash}}',
      'flash': '{{flash}}',
      'disclaimer_text': '{{disclaimer}}',
      'disclaimer': '{{disclaimer}}',
      // Style fields
      'headline_style_1': '{{headline_style}}',
      'headline_style': '{{headline_style}}',
      'copy_style_1': '{{copy1_style}}',
      'copy1_style': '{{copy1_style}}',
      'copy_style_2': '{{copy2_style}}',
      'copy2_style': '{{copy2_style}}',
      'flash_style': '{{flash_style}}',
      'sticker_style_1': '{{flash_style}}',
      'cta_style': '{{cta_style}}',
      'cta_style_1': '{{cta_style}}',
      'disclaimer_style': '{{disclaimer_style}}',
      'css_styles': '{{css}}',
      'css': '{{css}}',
      // Other fields
      'template_variant_class': '{{template_variant_classes}}',
      'template_variant_classes': '{{template_variant_classes}}',
      'messaging_card_id': '{{number}}',
      'messaging_card_variant': '{{variant}}',
      'advert_name': '{{name}}',
      'name': '{{name}}',
      'number': '{{number}}',
      'variant': '{{variant}}',
      'landingurl': '{{landingUrl}}',
      'clicktag': '{{landingUrl}}',
      // Image fields
      'background_image_1': '{{image1}}',
      'image1': '{{image1}}',
      'background_image_2': '{{image2}}',
      'image2': '{{image2}}',
      'background_image_3': '{{image3}}',
      'image3': '{{image3}}',
      'background_image_4': '{{image4}}',
      'image4': '{{image4}}',
      'sticker_image_1': '{{image6}}',
      'image6': '{{image6}}',
      'background_image_logo': '{{image5}}',
      'image5': '{{image5}}'
    };

    return commonMappings[cleanNameLower] || `{{${cleanNameLower}}}`;
  };

  // Filter messages
  const filteredMessages = messages.filter(msg => {
    // Only show messages with dynamic (HTML) templates
    // Exclude messages without template or with non-HTML templates like 'Adobe PSD'
    if (!msg.template || msg.template === 'Adobe PSD') return false;

    // Filter by status if any status filters are selected
    if (statusFilters.length > 0) {
      const msgStatus = (msg.status || 'INCOMING').toUpperCase();
      if (!statusFilters.includes(msgStatus)) return false;
    }

    // Filter by product if any product filters are selected
    if (productFilters.length > 0) {
      const audience = audiences.find(a => a.key === msg.audience);
      const topic = topics.find(t => t.key === msg.topic);
      const audienceProduct = audience?.product;
      const topicProduct = topic?.product;

      // Message matches if either audience or topic product is in the filter
      const matchesProduct =
        (audienceProduct && productFilters.includes(audienceProduct)) ||
        (topicProduct && productFilters.includes(topicProduct));

      if (!matchesProduct) return false;
    }

    // Filter by MC text filter (same logic as MatrixGridView)
    if (mcFilter && mcFilter.trim()) {
      const lowerFilter = mcFilter.toLowerCase();
      const searchableFields = [
        String(msg.number || ''),
        msg.variant || '',
        msg.name || '',
        msg.headline || '',
        msg.copy1 || '',
        msg.copy2 || '',
        msg.image1 || '',
        msg.image2 || '',
        msg.image3 || ''
      ].join(' ').toLowerCase();

      if (!searchableFields.includes(lowerFilter)) return false;
    }

    return true;
  });

  const columns = feedStructure.split(',').map(col => col.trim());

  return (
    <div className="bg-white overflow-hidden flex flex-col" style={{ height: '100%', width: '100%' }}>
      <div className="flex-1 overflow-auto" style={{ width: '100%' }}>
        <table className="border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700" style={{ whiteSpace: 'nowrap' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {messages.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-8 text-gray-500">
                  No messages found. Add messages in Matrix view to see them here.
                </td>
              </tr>
            ) : (
              filteredMessages.map((msg, rowIdx) => {
                const status = (msg.status || 'INCOMING').toUpperCase();
                const colors = getStatusColors(status);

                return (
                  <tr
                    key={`${msg.id}-${rowIdx}`}
                    onClick={() => onMessageClick(msg)}
                    className={`${colors.bg} border-b border-gray-200 cursor-pointer hover:bg-opacity-80 transition-colors`}
                  >
                    {columns.map((colName, idx) => {
                      // Get pattern for this column - use feedPatterns first, then smart fallback
                      let pattern = feedPatterns[colName];
                      if (!pattern) {
                        pattern = getDefaultPattern(colName);
                      }

                      // Build context for pattern evaluation
                      const context = {
                        ...msg,
                        audiences,
                        topics,
                        Audience_Key: msg.audience,
                        Topic_Key: msg.topic,
                        Number: msg.number || '',
                        Variant: msg.variant || '',
                        Version: msg.version || '',
                        status: status
                      };

                      // Evaluate pattern to get cell value
                      let cellValue = evaluatePattern(pattern, context);

                      // Strip line breaks from cell values
                      if (cellValue) {
                        cellValue = cellValue.replace(/[\r\n]+/g, ' ').replace(/\\n/g, ' ').trim();
                      }

                      // Truncate long fields for display (but keep full data in title)
                      let displayValue = cellValue;
                      if (cellValue) {
                        // Truncate CSS to 20 chars
                        if (pattern.includes('{{css}}')) {
                          displayValue = cellValue.length > 20 ? cellValue.substring(0, 20) + '...' : cellValue;
                        }
                        // Truncate clickTAG/landing URL to 20 chars
                        else if (colName.toLowerCase().includes('clicktag') || colName.toLowerCase().includes('landing')) {
                          displayValue = cellValue.length > 20 ? cellValue.substring(0, 20) + '...' : cellValue;
                        }
                      }

                      // Apply text formatting with spans for text fields (case-insensitive check)
                      const patternLower = pattern.toLowerCase();
                      const textFieldPatterns = ['headline', 'copy1', 'copy2', 'flash', 'cta', 'disclaimer'];
                      const isTextField = textFieldPatterns.some(field =>
                        patternLower.includes(`{{${field}}}`)
                      );

                      if (isTextField && cellValue) {
                        // Pass message object with multiple identifiers for MC scope matching
                        const msgIdentifiers = {
                          id: String(msg.id),
                          poms_id: msg.poms_id,
                          name: msg.name,
                          number: String(msg.number || ''),
                          variant: msg.variant || '',
                          numberVariant: `${msg.number || ''}${msg.variant || ''}`
                        };
                        displayValue = applyTextFormattingSpans(cellValue, textFormatting, msgIdentifiers, templateSizesMap?.[msg.template] || null);
                      }

                      return (
                        <td key={idx} className="border border-gray-300 px-4 py-2 text-sm text-gray-700" title={cellValue}>
                          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{displayValue}</div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeedTableView;

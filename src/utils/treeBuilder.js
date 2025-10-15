/**
 * Tree building utilities for TreeView component
 * Handles parsing tree structure patterns and building hierarchical trees
 */

/**
 * Parse tree structure pattern string into level definitions
 * @param {string} structureString - Pattern like "Audiences.Product → Audiences.Strategy → ..."
 * @returns {Array} Array of level objects with source, field, and label properties
 */
export const parseTreeStructure = (structureString) => {
  const levels = structureString.split('→').map(s => s.trim());
  return levels.map(level => {
    const [source, field] = level.split('.').map(s => s.trim());
    return { source, field, label: field };
  });
};

/**
 * Get value from an item based on source and field
 * @param {Object} item - The data item
 * @param {string} source - Source type (Audiences, Topics, Messages)
 * @param {string} field - Field name to extract
 * @returns {string} The extracted value
 */
const getValue = (item, source, field) => {
  const fieldLower = field.toLowerCase().replace('_', '');

  if ((source === 'Audiences' || source === 'Audience') && item.type === 'audience') {
    if (field === 'Name') return item.name;
    if (field === 'Product') return item.product;
    if (field === 'Strategy') return item.strategy;
    if (field === 'Targeting_type' || field === 'Targetingtype') return item.targeting_type;
    return item[fieldLower] || item[field.toLowerCase()] || `Unknown ${field}`;
  }

  if ((source === 'Topics' || source === 'Topic') && item.type === 'topic') {
    if (field === 'Name') return item.name;
    return item[fieldLower] || item[field.toLowerCase()] || `Unknown ${field}`;
  }

  if ((source === 'Messages' || source === 'Message') && item.type === 'message') {
    if (field === 'Number') return item.number;
    if (field === 'Variant') return item.variant;
    return item[fieldLower] || item[field.toLowerCase()] || `Unknown ${field}`;
  }

  return `Unknown ${field}`;
};

/**
 * Build hierarchical tree structure based on parsed pattern
 * @param {Array} audiences - Array of audience objects
 * @param {Array} topics - Array of topic objects
 * @param {Function} getMessages - Function to get messages for a topic and audience
 * @param {string} treeStructure - Tree structure pattern string
 * @returns {Object} Hierarchical tree object
 */
export const buildTree = (audiences, topics, getMessages, treeStructure) => {
  const parsedLevels = parseTreeStructure(treeStructure);

  /**
   * Recursive function to build tree at any level
   * @param {Array} items - Items to process at this level
   * @param {number} levelIndex - Current level index
   * @param {Array} parentPath - Path of parent node values
   * @returns {Object} Tree nodes at this level
   */
  const buildRecursiveTree = (items, levelIndex, parentPath = []) => {
    if (levelIndex >= parsedLevels.length) {
      return {};
    }

    const currentLevel = parsedLevels[levelIndex];
    const tree = {};
    const isLastLevel = levelIndex === parsedLevels.length - 1;

    // Group items by the current level's field value
    const groups = {};
    items.forEach((item, itemIndex) => {
      const value = getValue(item, currentLevel.source, currentLevel.field);
      const groupKey = isLastLevel && item.type === 'message' ? `${value}:${item.id || itemIndex}` : value;

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });

    // Create tree nodes for each group
    Object.entries(groups).forEach(([groupKey, groupItems]) => {
      const value = isLastLevel && groupItems[0].type === 'message' ? groupKey.split(':')[0] : groupKey;
      // Build unique node key that includes parent path to avoid collisions
      const pathPrefix = parentPath.length > 0 ? parentPath.join('/') + '/' : '';
      const nodeKey = `${pathPrefix}${currentLevel.source}.${currentLevel.field}:${groupKey}`;

      tree[nodeKey] = {
        label: currentLevel.label,
        value: value,
        source: currentLevel.source,
        field: currentLevel.field,
        data: groupItems[0], // Use first item as representative
        children: {},
        depth: levelIndex // Store the depth of this node in the tree
      };

      // Build children if not at last level
      if (levelIndex < parsedLevels.length - 1) {
        const nextLevel = parsedLevels[levelIndex + 1];
        let nextItems = [];

        // Determine items for next level based on next level's source
        if (nextLevel.source === 'Audiences' || nextLevel.source === 'Audience') {
          // Next level needs audiences - filter from all audiences based on current path
          nextItems = audiences.filter(aud => {
            // Check if this audience matches all levels up to current
            for (let i = 0; i <= levelIndex; i++) {
              const level = parsedLevels[i];
              if (level.source === 'Audiences' || level.source === 'Audience') {
                const audValue = getValue({ ...aud, type: 'audience' }, level.source, level.field);
                const pathValue = i === levelIndex ? value : parentPath[i];
                if (audValue !== pathValue) return false;
              }
            }
            return true;
          }).map(aud => ({ ...aud, type: 'audience' }));

        } else if (nextLevel.source === 'Topics' || nextLevel.source === 'Topic') {
          // Next level needs topics - use the audience from current item
          const currentAudience = groupItems[0].type === 'audience' ? groupItems[0] : null;
          if (currentAudience) {
            nextItems = topics.filter(topic => {
              const msgs = getMessages(topic.key, currentAudience.key);
              return msgs.length > 0;
            }).map(topic => ({ ...topic, type: 'topic', audienceKey: currentAudience.key }));
          }

        } else if (nextLevel.source === 'Messages' || nextLevel.source === 'Message') {
          // Next level needs messages
          if (groupItems[0].type === 'message') {
            // Already have messages, pass them through (for Number → Variant transition)
            nextItems = groupItems;
          } else if (groupItems[0].type === 'topic') {
            // Get messages for this topic
            const currentTopic = groupItems[0];
            if (currentTopic.audienceKey) {
              nextItems = getMessages(currentTopic.key, currentTopic.audienceKey).map(msg => ({ ...msg, type: 'message' }));
            }
          }
        }

        if (nextItems.length > 0) {
          const newPath = [...parentPath, value];
          tree[nodeKey].children = buildRecursiveTree(nextItems, levelIndex + 1, newPath);
        }
      }
    });

    return tree;
  };

  // Start with all audiences
  const initialItems = audiences.map(aud => ({ ...aud, type: 'audience' }));
  return buildRecursiveTree(initialItems, 0, []);
};

/**
 * tree2Builder - Simplified tree construction for TreeView 2.0
 * Builds TreeNode instances from audiences, topics, and messages
 */

import { TreeNode } from '../classes/TreeNode.js';

/**
 * Parse tree structure pattern string into level definitions
 * @param {string} structureString - Pattern like "Audiences.Product → Audiences.Strategy → ..."
 * @returns {Array} Array of level objects with source, field, and label properties
 */
export const parseTreeStructure = (structureString) => {
  if (!structureString) return [];

  // Handle both arrow types: → and ->
  const normalizedString = structureString.replace(/->/g, '→');
  const levels = normalizedString.split('→').map(s => s.trim());

  return levels.map(level => {
    const [source, field] = level.split('.').map(s => s.trim());
    return { source, field, label: field };
  });
};

/**
 * Get value from an item based on source and field
 */
const getValue = (item, source, field) => {
  if (!field) return 'Unknown';
  const fieldLower = field.toLowerCase().replace('_', '');

  if ((source === 'Audiences' || source === 'Audience') && item.type === 'audience') {
    if (field === 'Name') return item.name || '';
    if (field === 'Product') return item.product || '';
    if (field === 'Strategy') return item.strategy || '';
    if (field === 'Targeting_type' || field === 'Targetingtype') return item.targeting_type || '';
    return item[fieldLower] || item[field.toLowerCase()] || '';
  }

  if ((source === 'Topics' || source === 'Topic') && item.type === 'topic') {
    if (field === 'Name') return item.name || '';
    return item[fieldLower] || item[field.toLowerCase()] || '';
  }

  if ((source === 'Messages' || source === 'Message') && item.type === 'message') {
    if (field === 'Number') return String(item.number || '');
    if (field === 'Variant') return item.variant || '';
    return item[fieldLower] || item[field.toLowerCase()] || '';
  }

  return '';
};

/**
 * Group items by a field value
 */
const groupBy = (items, keyFn) => {
  const groups = {};
  items.forEach(item => {
    const key = keyFn(item) || 'Unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return groups;
};

/**
 * Generate a unique node ID
 */
let nodeIdCounter = 0;
const generateNodeId = (parentPath, value) => {
  nodeIdCounter++;
  const safePath = parentPath.replace(/[^a-zA-Z0-9]/g, '_');
  const safeValue = String(value).replace(/[^a-zA-Z0-9]/g, '_');
  return `node_${safePath}_${safeValue}_${nodeIdCounter}`;
};

/**
 * Build tree structure using TreeNode class
 * @param {Array} audiences - Array of audience objects
 * @param {Array} topics - Array of topic objects
 * @param {Function} getMessages - Function to get messages for a topic and audience
 * @param {string} treeStructure - Tree structure pattern string
 * @param {Array} statusFilters - Optional status filters
 * @returns {Object} { nodes: TreeNode[], levelCount: number }
 */
export const buildTree2 = (audiences, topics, getMessages, treeStructure, statusFilters = []) => {
  // Reset ID counter for each build
  nodeIdCounter = 0;

  const parsedLevels = parseTreeStructure(treeStructure);

  if (parsedLevels.length === 0 || !audiences || audiences.length === 0) {
    return { nodes: [], levelCount: 0 };
  }

  const rootNodes = [];

  /**
   * Recursive function to build TreeNode hierarchy
   */
  const buildLevel = (items, levelIndex, parentNode, parentPath) => {
    if (levelIndex >= parsedLevels.length || items.length === 0) {
      return;
    }

    const currentLevel = parsedLevels[levelIndex];
    const isLastLevel = levelIndex === parsedLevels.length - 1;

    // Group items by field value
    const groups = groupBy(items, item => {
      const value = getValue(item, currentLevel.source, currentLevel.field);
      // For last level messages, include ID to keep them unique
      if (isLastLevel && item.type === 'message') {
        return `${value}:${item.id}`;
      }
      return value;
    });

    // Create TreeNode for each group
    Object.entries(groups).forEach(([groupKey, groupItems]) => {
      const value = isLastLevel && groupItems[0].type === 'message'
        ? groupKey.split(':')[0]
        : groupKey;

      const newPath = parentPath ? `${parentPath}/${value}` : value;

      // Create the node
      const node = new TreeNode({
        id: generateNodeId(parentPath || 'root', value),
        value: value,
        label: currentLevel.label,
        source: currentLevel.source,
        field: currentLevel.field,
        originalData: groupItems[0],
        status: groupItems[0].status || ''
      });

      // Add to parent or roots
      if (parentNode) {
        parentNode.addChild(node);
      } else {
        rootNodes.push(node);
      }

      // Build children if not at last level
      if (levelIndex < parsedLevels.length - 1) {
        const nextLevel = parsedLevels[levelIndex + 1];
        let nextItems = [];

        if (nextLevel.source === 'Audiences' || nextLevel.source === 'Audience') {
          // Filter audiences that match the current path
          nextItems = audiences.filter(aud => {
            for (let i = 0; i <= levelIndex; i++) {
              const level = parsedLevels[i];
              if (level.source === 'Audiences' || level.source === 'Audience') {
                const audValue = getValue({ ...aud, type: 'audience' }, level.source, level.field);
                // Check against path values
                const pathParts = newPath.split('/');
                if (audValue !== pathParts[i]) return false;
              }
            }
            return true;
          }).map(aud => ({ ...aud, type: 'audience' }));

        } else if (nextLevel.source === 'Topics' || nextLevel.source === 'Topic') {
          // Get topics for this audience
          const currentAudience = groupItems[0].type === 'audience' ? groupItems[0] : null;
          if (currentAudience) {
            nextItems = topics.filter(topic => {
              const msgs = getMessages(topic.key, currentAudience.key);
              // Apply status filter if present
              if (statusFilters && statusFilters.length > 0) {
                return msgs.some(m => statusFilters.includes(m.status));
              }
              return msgs.length > 0;
            }).map(topic => ({ ...topic, type: 'topic', audienceKey: currentAudience.key }));
          }

        } else if (nextLevel.source === 'Messages' || nextLevel.source === 'Message') {
          if (groupItems[0].type === 'message') {
            // Already messages, pass through (Number → Variant)
            nextItems = groupItems;
          } else if (groupItems[0].type === 'topic') {
            // Get messages for this topic + audience
            const currentTopic = groupItems[0];
            if (currentTopic.audienceKey) {
              let msgs = getMessages(currentTopic.key, currentTopic.audienceKey)
                .map(msg => ({ ...msg, type: 'message' }));

              // Apply status filter
              if (statusFilters && statusFilters.length > 0) {
                msgs = msgs.filter(m => statusFilters.includes(m.status));
              }
              nextItems = msgs;
            }
          }
        }

        if (nextItems.length > 0) {
          buildLevel(nextItems, levelIndex + 1, node, newPath);
        }
      }
    });
  };

  // Start building from audiences
  const initialItems = audiences.map(aud => ({ ...aud, type: 'audience' }));
  buildLevel(initialItems, 0, null, '');

  // Wrap all root nodes under a "Decision tree" parent node
  if (rootNodes.length > 0) {
    const decisionTreeRoot = new TreeNode({
      id: 'decision_tree_root',
      value: 'Decision tree',
      label: '',
      source: 'Root',
      field: 'Root',
      originalData: null,
      status: ''
    });

    // Add all current root nodes as children of the decision tree root
    rootNodes.forEach(node => {
      decisionTreeRoot.addChild(node);
    });

    return {
      nodes: [decisionTreeRoot],
      levelCount: parsedLevels.length + 1  // +1 for the new root level
    };
  }

  return {
    nodes: rootNodes,
    levelCount: parsedLevels.length
  };
};

/**
 * Count total nodes in tree
 */
export const countNodes = (nodes) => {
  let count = 0;
  const traverse = (nodeList) => {
    nodeList.forEach(node => {
      count++;
      traverse(node.children);
    });
  };
  traverse(nodes);
  return count;
};

/**
 * Find maximum depth of tree
 */
export const getMaxDepth = (nodes) => {
  let maxDepth = 0;
  const traverse = (nodeList, depth) => {
    nodeList.forEach(node => {
      maxDepth = Math.max(maxDepth, depth);
      traverse(node.children, depth + 1);
    });
  };
  traverse(nodes, 0);
  return maxDepth + 1; // Convert to level count
};

/**
 * Flatten tree to array of nodes
 */
export const flattenTree = (nodes) => {
  const result = [];
  const traverse = (nodeList) => {
    nodeList.forEach(node => {
      result.push(node);
      traverse(node.children);
    });
  };
  traverse(nodes);
  return result;
};

export default buildTree2;

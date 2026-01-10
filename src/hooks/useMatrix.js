import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import sheets from '../services/sheets';
import settings from '../services/settings';
import { generatePMMID, generateTopicKey, generateTraffickingFields } from '../utils/patternEvaluator';

// Module-level cache to persist across hook calls
let cachedMatrixResult = null;

// Normalize value for comparison (treat empty string, null, undefined as equivalent)
const normalizeValue = (val) => {
  if (val === null || val === undefined || val === '') return '';
  return val;
};

// Check if two values are equivalent (lenient comparison)
const valuesEqual = (a, b) => {
  const normA = normalizeValue(a);
  const normB = normalizeValue(b);

  // Both empty
  if (normA === '' && normB === '') return true;

  // Same value
  if (normA === normB) return true;

  // Compare as strings for number/string equivalence (e.g., "1" vs 1)
  if (String(normA) === String(normB)) return true;

  return false;
};

// Deep compare two values for equality (lenient)
const deepEqual = (a, b) => {
  // Handle primitives and empty values
  if (valuesEqual(a, b)) return true;

  // If one is object and other isn't (after normalization), not equal
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (a === null || b === null) return false;

  // Array comparison
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  // Object comparison - only compare keys that have non-empty values
  const keysA = Object.keys(a).filter(k => normalizeValue(a[k]) !== '');
  const keysB = Object.keys(b).filter(k => normalizeValue(b[k]) !== '');

  // Get union of non-empty keys
  const allKeys = new Set([...keysA, ...keysB]);

  return [...allKeys].every(key => deepEqual(a[key], b[key]));
};

// Compare arrays by ID and track changes
const computeArrayChanges = (original, current, entityType) => {
  const changes = {
    added: [],      // New items (by ID)
    modified: [],   // Modified items (by ID)
    deleted: [],    // Deleted items (by ID)
    changedFields: {} // Map of id -> [changed field names]
  };

  if (!original || !current) return changes;

  const originalMap = new Map(original.map(item => [String(item.id), item]));
  const currentMap = new Map(current.map(item => [String(item.id), item]));

  // Find added and modified
  current.forEach(item => {
    const id = String(item.id);
    const originalItem = originalMap.get(id);

    if (!originalItem) {
      // New item
      changes.added.push(id);
    } else {
      // Check for modifications
      const changedFields = [];
      Object.keys(item).forEach(key => {
        if (!deepEqual(item[key], originalItem[key])) {
          changedFields.push(key);
        }
      });
      // Also check for removed fields
      Object.keys(originalItem).forEach(key => {
        if (!(key in item) && !changedFields.includes(key)) {
          changedFields.push(key);
        }
      });

      if (changedFields.length > 0) {
        changes.modified.push(id);
        changes.changedFields[id] = changedFields;
      }
    }
  });

  // Find deleted
  original.forEach(item => {
    const id = String(item.id);
    if (!currentMap.has(id)) {
      changes.deleted.push(id);
    }
  });

  return changes;
};

export const useMatrix = (currentUser = null) => {
  // State
  const [audiences, setAudiences] = useState([]);
  const [topics, setTopics] = useState([]);
  const [messages, setMessages] = useState([]);
  const [keywords, setKeywords] = useState({});
  const [assets, setAssets] = useState([]);
  const [creatives, setCreatives] = useState([]);
  const [textFormatting, setTextFormatting] = useState([]);
  const [messagesByCell, setMessagesByCell] = useState({}); // Fast lookup: "topicKey-audienceKey" -> [messages]
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  // Original state (loaded from spreadsheet)
  const [originalState, setOriginalState] = useState({
    audiences: [],
    topics: [],
    messages: [],
    assets: [],
    creatives: [],
    textFormatting: []
  });

  // Rebuild message lookup index whenever messages change
  useEffect(() => {
    const lookup = {};
    messages
      .filter(m => m.status !== 'deleted')
      .forEach(m => {
        const cellKey = `${m.topic}-${m.audience}`;
        if (!lookup[cellKey]) {
          lookup[cellKey] = [];
        }
        lookup[cellKey].push(m);
      });
    setMessagesByCell(lookup);
  }, [messages]);

  // Load data from sheets
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Ensure settings are initialized before loading sheets data
      await settings.ensureInitialized();

      const data = await sheets.loadAll();

      // Generate keys for topics using pattern
      const topicKeyPattern = settings.getPattern('topicKey');
      const topicsWithKeys = (data.topics || []).map((topic, index) => {
        // Check if topic has a fallback key (like top67) or no key
        const hasFallbackKey = topic.key && /^top\d+$/.test(topic.key);
        const needsKeyGeneration = !topic.key || hasFallbackKey;

        if (needsKeyGeneration && topicKeyPattern) {
          // Generate key from pattern
          const generatedKey = generateTopicKey(topic, topicKeyPattern);
          if (generatedKey && generatedKey.trim()) {
            return { ...topic, key: generatedKey };
          }
        }

        // Keep existing key if it's not a fallback, or generate fallback if no pattern
        if (topic.key && !hasFallbackKey) return topic;

        // Fallback: generate incremental key based on highest existing
        const existingKeys = (data.topics || [])
          .map(t => t.key)
          .filter(k => k && /^top\d+$/.test(k))
          .map(k => parseInt(k.replace('top', ''), 10));
        const maxKey = existingKeys.length > 0 ? Math.max(...existingKeys) : 0;
        return { ...topic, key: `top${maxKey + index + 1}` };
      });

      // Store as current state
      setAudiences(data.audiences);
      setTopics(topicsWithKeys);
      setMessages(data.messages);
      setKeywords(data.keywords || {});
      setAssets(data.assets || []);
      setCreatives(data.creatives || []);
      setTextFormatting(data.textFormatting || []);
      setLastSync(new Date());

      // Store deep copy as original state (baseline for change tracking)
      setOriginalState({
        audiences: JSON.parse(JSON.stringify(data.audiences || [])),
        topics: JSON.parse(JSON.stringify(topicsWithKeys)),
        messages: JSON.parse(JSON.stringify(data.messages || [])),
        assets: JSON.parse(JSON.stringify(data.assets || [])),
        creatives: JSON.parse(JSON.stringify(data.creatives || [])),
        textFormatting: JSON.parse(JSON.stringify(data.textFormatting || []))
      });
    } catch (err) {
      console.error('Load error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save data to sheets
  const save = useCallback(async (feedData = null, feedFields = null, assetsData = null, creativesData = null) => {
    // SAFETY GUARD: Prevent saving if no matrix data is loaded
    // This prevents accidentally wiping the spreadsheet when save is called before data loads
    const hasMatrixData = audiences.length > 0 || topics.length > 0 || messages.length > 0;
    if (!hasMatrixData) {
      const errorMsg = 'Cannot save: No matrix data loaded. Please wait for data to load before saving.';
      console.error('🛑 [useMatrix.save] BLOCKED:', errorMsg);
      throw new Error(errorMsg);
    }

    setIsSaving(true);
    setError(null);

    try {
      // Compute complete messages with auto-generated fields before saving
      const pmmidPattern = settings.getPattern('pmmid');
      const traffickingPatterns = settings.getPattern('trafficking');

      const completeMessages = messages
        .filter(m => m.status !== 'deleted')
        .map(msg => {
          try {
            // Generate PMMID
            const pmmid = generatePMMID(msg, audiences, pmmidPattern);

            // Generate trafficking fields
            const trafficking = generateTraffickingFields(
              { ...msg, pmmid },
              audiences,
              traffickingPatterns
            );

            // Return message with all computed fields
            return {
              ...msg,
              pmmid,
              ...trafficking
            };
          } catch (error) {
            console.error('Error generating fields for message:', msg.id, error);
            return msg; // Return original if there's an error
          }
        });

      // Debug: log feed data being saved
      // if (feedData && feedData.length > 0) {
      //   console.log('💾 Saving feed data to spreadsheet:', {
      //     rowCount: feedData.length,
      //     columnCount: feedFields?.length || 0,
      //     firstRowSample: feedData[0],
      //     hasSpans: JSON.stringify(feedData[0]).includes('<span')
      //   });
      // }

      await sheets.saveAll(audiences, topics, completeMessages, feedData, feedFields, assetsData, creativesData);
      setLastSync(new Date());

      // Reset original state to current state (change counter goes to 0)
      setOriginalState({
        audiences: JSON.parse(JSON.stringify(audiences)),
        topics: JSON.parse(JSON.stringify(topics)),
        messages: JSON.parse(JSON.stringify(messages)),
        assets: JSON.parse(JSON.stringify(assets)),
        creatives: JSON.parse(JSON.stringify(creatives)),
        textFormatting: JSON.parse(JSON.stringify(textFormatting))
      });
    } catch (err) {
      console.error('❌ [useMatrix.save] Error saving:', err);
      setError(err.message);
      throw err; // Re-throw so callers can handle the error
    } finally {
      setIsSaving(false);
    }
  }, [audiences, topics, messages, assets, creatives, textFormatting]);

  // Add audience - accepts either a name string or a full object
  const addAudience = useCallback((nameOrObject) => {
    if (typeof nameOrObject === 'object') {
      // Adding a full object
      setAudiences(prev => [...prev, nameOrObject]);
    } else {
      // Legacy: just a name string
      const maxId = Math.max(0, ...audiences.map(a => parseInt(a.id) || 0));
      const newId = maxId + 1;
      const order = Math.max(0, ...audiences.map(a => a.order)) + 1;
      const key = `aud${order}`;

      setAudiences(prev => [...prev, {
        id: newId,
        key,
        name: nameOrObject,
        order,
        status: ''
      }]);
    }
  }, [audiences]);

  // Add topic - accepts either a name string or a full object
  const addTopic = useCallback((nameOrObject) => {
    if (typeof nameOrObject === 'object') {
      // Adding a full object - generate key from pattern if not provided
      const topicKeyPattern = settings.getPattern('topicKey');
      let topicWithKey = nameOrObject;
      if (topicKeyPattern && !nameOrObject.key) {
        topicWithKey = {
          ...nameOrObject,
          key: generateTopicKey(nameOrObject, topicKeyPattern)
        };
      }
      setTopics(prev => [...prev, topicWithKey]);
    } else {
      // Legacy: just a name string
      const maxId = Math.max(0, ...topics.map(t => parseInt(t.id) || 0));
      const newId = maxId + 1;
      const order = Math.max(0, ...topics.map(t => t.order)) + 1;

      // Create topic object first
      const newTopic = {
        id: newId,
        name: nameOrObject,
        order,
        status: ''
      };

      // Generate key from pattern if available, otherwise use fallback
      const topicKeyPattern = settings.getPattern('topicKey');
      newTopic.key = topicKeyPattern
        ? generateTopicKey(newTopic, topicKeyPattern)
        : `top${order}`;

      setTopics(prev => [...prev, newTopic]);
    }
  }, [topics]);

  // Add message
  const addMessage = useCallback((topic, audience) => {
    // Check if cell already has messages
    const cellMessages = messages.filter(m =>
      m.topic === topic &&
      m.audience === audience &&
      m.status !== 'deleted'
    );

    let number;
    let variant;

    if (cellMessages.length > 0) {
      // Cell has messages - use same number, increment variant
      number = cellMessages[0].number;

      // Find highest variant in this cell
      const variants = cellMessages.map(m => m.variant || 'a');
      const maxVariant = variants.sort().pop(); // Get last (highest) variant

      // Increment variant (a→b, b→c, etc.)
      variant = String.fromCharCode(maxVariant.charCodeAt(0) + 1);
    } else {
      // Cell is empty - use global next highest number with variant 'a'
      const allActiveMessages = messages.filter(m => m.status !== 'deleted');
      const maxNumber = allActiveMessages.length > 0
        ? Math.max(...allActiveMessages.map(m => m.number || 0))
        : 0;

      number = maxNumber + 1;
      variant = 'a';
    }

    const version = 1;

    // Generate PMMID
    const pmmid = `a_${audience}-t_${topic}-m_${number}-v_${variant}-n_${version}`;

    // Auto-increment numeric ID
    const maxId = Math.max(0, ...messages.map(m => parseInt(m.id) || 0));
    const newId = maxId + 1;

    setMessages(prev => [...prev, {
      id: newId,      // Numeric ID
      name: '',       // Empty name - user will fill it in
      number,
      variant,
      audience,
      topic,
      version,
      pmmid,
      status: 'INCOMING',
      start_date: '',
      end_date: '',
      template: '',
      template_variant_classes: '',
      headline: '',
      copy1: '',
      copy2: '',
      image1: '',
      image2: '',
      image3: '',
      image4: '',
      image5: '',
      image6: '',
      video1: '',
      flash: '',
      cta: '',
      landingUrl: '',
      comment: '',
      // Trafficking fields
      utm_campaign: '',
      utm_source: '',
      utm_medium: '',
      utm_content: '',
      utm_term: '',
      utm_cd26: '',
      final_trafficked_url: ''
    }]);
  }, [messages]);

  // Update message
  const updateMessage = useCallback((id, updates) => {
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, ...updates } : m
    ));
  }, []);

  // Delete message
  const deleteMessage = useCallback((id) => {
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, status: 'deleted' } : m
    ));
  }, []);

  // Move message - updates audience (and optionally topic) and PMMID
  const moveMessage = useCallback((id, newAudience, newTopic = null) => {
    setMessages(prev => prev.map(m => {
      if (m.id === id) {
        const topic = newTopic || m.topic;
        // Update PMMID with new audience/topic key
        const newPmmid = `a_${newAudience}-t_${topic}-m_${m.number}-v_${m.variant}-n_${m.version}`;
        return {
          ...m,
          audience: newAudience,
          topic: topic,
          pmmid: newPmmid
        };
      }
      return m;
    }));
  }, []);

  // Copy message - keeps same message number, updates audience in PMMID
  const copyMessage = useCallback((id, newAudience) => {
    // Use functional update to get the latest state (important for batch copies)
    setMessages(prev => {
      const msg = prev.find(m => m.id === id);
      if (!msg) return prev;

      // Generate new numeric ID based on current state
      const maxId = Math.max(0, ...prev.map(m => parseInt(m.id) || 0));
      const newId = maxId + 1;

      // Update PMMID with new audience key (keep same number/variant/version)
      const newPmmid = `a_${newAudience}-t_${msg.topic}-m_${msg.number}-v_${msg.variant}-n_${msg.version}`;

      return [...prev, {
        ...msg,
        id: newId,           // New numeric ID
        pmmid: newPmmid,     // Updated PMMID with new audience
        audience: newAudience // New audience key
      }];
    });
  }, []);

  // Update audience (by id)
  const updateAudience = useCallback((id, updates) => {
    setAudiences(prev => prev.map(a =>
      a.id === id ? { ...a, ...updates } : a
    ));
  }, []);

  // Delete audience (by id)
  const deleteAudience = useCallback((id) => {
    setAudiences(prev => prev.filter(a => a.id !== id));
  }, []);

  // Update topic (by id)
  const updateTopic = useCallback((id, updates) => {
    setTopics(prev => prev.map(t => {
      if (t.id !== id) return t;

      const updatedTopic = { ...t, ...updates };

      // Auto-regenerate topic key if tag or product fields changed
      const keyFieldsChanged =
        updates.hasOwnProperty('tag1') ||
        updates.hasOwnProperty('tag2') ||
        updates.hasOwnProperty('tag3') ||
        updates.hasOwnProperty('tag4') ||
        updates.hasOwnProperty('product');

      if (keyFieldsChanged) {
        const topicKeyPattern = settings.getPattern('topicKey');
        if (topicKeyPattern) {
          updatedTopic.key = generateTopicKey(updatedTopic, topicKeyPattern);
        }
      }

      return updatedTopic;
    }));
  }, []);

  // Delete topic (by id)
  const deleteTopic = useCallback((id) => {
    setTopics(prev => prev.filter(t => t.id !== id));
  }, []);

  // Regenerate all topic keys based on current pattern
  const regenerateTopicKeys = useCallback(() => {
    const topicKeyPattern = settings.getPattern('topicKey');
    if (!topicKeyPattern) return;

    setTopics(prev => prev.map(topic => ({
      ...topic,
      key: generateTopicKey(topic, topicKeyPattern)
    })));

  }, []);

  // Get messages for cell - O(1) lookup instead of O(n) filtering
  const getMessages = useCallback((topic, audience) => {
    const cellKey = `${topic}-${audience}`;
    return messagesByCell[cellKey] || [];
  }, [messagesByCell]);

  // Load on mount - only if user is authenticated
  useEffect(() => {
    if (currentUser) {
      load();
    }
  }, [load, currentUser]);

  // Save keywords
  const saveKeywords = useCallback(async (updatedKeywords) => {
    setIsSaving(true);
    setError(null);

    try {
      await sheets.saveKeywords(updatedKeywords);
      setKeywords(updatedKeywords);
      setLastSync(new Date());
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Compute changes between current and original state
  const changeTracking = useMemo(() => {
    // Skip if original state hasn't been loaded yet (all empty arrays)
    const originalLoaded = originalState.audiences.length > 0 ||
                          originalState.topics.length > 0 ||
                          originalState.messages.length > 0;

    if (!originalLoaded) {
      return {
        audiences: { added: [], modified: [], deleted: [], changedFields: {} },
        topics: { added: [], modified: [], deleted: [], changedFields: {} },
        messages: { added: [], modified: [], deleted: [], changedFields: {} },
        assets: { added: [], modified: [], deleted: [], changedFields: {} },
        creatives: { added: [], modified: [], deleted: [], changedFields: {} },
        textFormatting: { added: [], modified: [], deleted: [], changedFields: {} },
        totalChanges: 0,
        hasChanges: false
      };
    }

    const audienceChanges = computeArrayChanges(originalState.audiences, audiences);
    const topicChanges = computeArrayChanges(originalState.topics, topics);

    // For messages, exclude new items that are deleted (undone adds shouldn't count as changes)
    // But keep original items that are now deleted (to count them as deleted)
    const originalMessageIds = new Set(originalState.messages.map(m => String(m.id)));
    const messagesForTracking = messages.filter(m => {
      // Keep if: not deleted, OR was in original (to detect deletions of original items)
      return m.status !== 'deleted' || originalMessageIds.has(String(m.id));
    });
    const messageChanges = computeArrayChanges(originalState.messages, messagesForTracking);

    const textFormattingChanges = computeArrayChanges(originalState.textFormatting, textFormatting);

    // Skip assets and creatives - they get modified by Google Drive sync with computed fields
    // (file_driveID, file_thumbnail, file_date, etc.) that aren't in the spreadsheet
    const emptyChanges = { added: [], modified: [], deleted: [], changedFields: {} };

    // Count unique changes (each added/modified/deleted item counts as 1)
    const totalChanges =
      audienceChanges.added.length + audienceChanges.modified.length + audienceChanges.deleted.length +
      topicChanges.added.length + topicChanges.modified.length + topicChanges.deleted.length +
      messageChanges.added.length + messageChanges.modified.length + messageChanges.deleted.length +
      textFormattingChanges.added.length + textFormattingChanges.modified.length + textFormattingChanges.deleted.length;

    return {
      audiences: audienceChanges,
      topics: topicChanges,
      messages: messageChanges,
      assets: emptyChanges,      // Skipped - modified by Drive sync
      creatives: emptyChanges,   // Skipped - modified by Drive sync
      textFormatting: textFormattingChanges,
      totalChanges,
      hasChanges: totalChanges > 0
    };
  }, [audiences, topics, messages, assets, creatives, textFormatting, originalState]);

  // Track reference changes for debugging
  const prevDepsRef = useRef({ audiences, topics, messages, keywords, assets, creatives, textFormatting });
  const depsChanged = {
    audiences: prevDepsRef.current.audiences !== audiences,
    topics: prevDepsRef.current.topics !== topics,
    messages: prevDepsRef.current.messages !== messages,
    keywords: prevDepsRef.current.keywords !== keywords,
    assets: prevDepsRef.current.assets !== assets,
    creatives: prevDepsRef.current.creatives !== creatives,
    textFormatting: prevDepsRef.current.textFormatting !== textFormatting
  };

  prevDepsRef.current = { audiences, topics, messages, keywords, assets, creatives, textFormatting };

  // Computed: Matrix data is fully loaded when not loading and has core data
  const isFullyLoaded = !isLoading && audiences.length > 0 && topics.length > 0;

  // Check if arrays have actually changed OR if metadata has changed
  const shouldUpdate = !cachedMatrixResult ||
    cachedMatrixResult.audiences !== audiences ||
    cachedMatrixResult.topics !== topics ||
    cachedMatrixResult.messages !== messages ||
    cachedMatrixResult.keywords !== keywords ||
    cachedMatrixResult.assets !== assets ||
    cachedMatrixResult.creatives !== creatives ||
    cachedMatrixResult.textFormatting !== textFormatting ||
    cachedMatrixResult.messagesByCell !== messagesByCell ||
    cachedMatrixResult.isLoading !== isLoading ||
    cachedMatrixResult.isFullyLoaded !== isFullyLoaded ||
    cachedMatrixResult.isSaving !== isSaving ||
    cachedMatrixResult.error !== error ||
    cachedMatrixResult.lastSync !== lastSync ||
    cachedMatrixResult.changeTracking !== changeTracking ||
    cachedMatrixResult.originalState !== originalState;

  if (shouldUpdate) {
    cachedMatrixResult = {
      audiences,
      topics,
      messages,
      keywords,
      assets,
      creatives,
      textFormatting,
      setTextFormatting,
      messagesByCell,
      setAssets,
      setCreatives,
      isLoading,
      isFullyLoaded,
      isSaving,
      error,
      lastSync,
      load,
      save,
      saveKeywords,
      addAudience,
      addTopic,
      addMessage,
      updateMessage,
      deleteMessage,
      moveMessage,
      copyMessage,
      updateAudience,
      updateTopic,
      deleteAudience,
      deleteTopic,
      regenerateTopicKeys,
      getMessages,
      getUrl: () => sheets.getUrl(),
      getSpreadsheetId: () => sheets.spreadsheetId,
      // Change tracking
      changeTracking,
      originalState
    };
  }

  return cachedMatrixResult;
};

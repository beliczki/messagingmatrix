import { useState, useCallback, useEffect } from 'react';
import sheets from '../services/sheets';
import settings from '../services/settings';
import { generatePMMID, generateTraffickingFields } from '../utils/patternEvaluator';

export const useMatrix = () => {
  // State
  const [audiences, setAudiences] = useState([]);
  const [topics, setTopics] = useState([]);
  const [messages, setMessages] = useState([]);
  const [keywords, setKeywords] = useState({});
  const [messagesByCell, setMessagesByCell] = useState({}); // Fast lookup: "topicKey-audienceKey" -> [messages]
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

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

      setAudiences(data.audiences);
      setTopics(data.topics);
      setMessages(data.messages);
      setKeywords(data.keywords || {});
      setLastSync(new Date());
    } catch (err) {
      console.error('Load error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save data to sheets
  const save = useCallback(async (feedData = null, feedFields = null) => {
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

      await sheets.saveAll(audiences, topics, completeMessages, feedData, feedFields);
      setLastSync(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }, [audiences, topics, messages]);

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
      // Adding a full object
      setTopics(prev => [...prev, nameOrObject]);
    } else {
      // Legacy: just a name string
      const maxId = Math.max(0, ...topics.map(t => parseInt(t.id) || 0));
      const newId = maxId + 1;
      const order = Math.max(0, ...topics.map(t => t.order)) + 1;
      const key = `top${order}`;

      setTopics(prev => [...prev, {
        id: newId,
        key,
        name: nameOrObject,
        order,
        status: ''
      }]);
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
      status: 'PLANNED',
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

  // Move message - updates audience and PMMID
  const moveMessage = useCallback((id, newAudience) => {
    setMessages(prev => prev.map(m => {
      if (m.id === id) {
        // Update PMMID with new audience key
        const newPmmid = `a_${newAudience}-t_${m.topic}-m_${m.number}-v_${m.variant}-n_${m.version}`;
        return {
          ...m,
          audience: newAudience,
          pmmid: newPmmid
        };
      }
      return m;
    }));
  }, []);

  // Copy message - keeps same message number, updates audience in PMMID
  const copyMessage = useCallback((id, newAudience) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;

    // Generate new numeric ID
    const maxId = Math.max(0, ...messages.map(m => parseInt(m.id) || 0));
    const newId = maxId + 1;

    // Update PMMID with new audience key (keep same number/variant/version)
    const newPmmid = `a_${newAudience}-t_${msg.topic}-m_${msg.number}-v_${msg.variant}-n_${msg.version}`;

    setMessages(prev => [...prev, {
      ...msg,
      id: newId,           // New numeric ID
      pmmid: newPmmid,     // Updated PMMID with new audience
      audience: newAudience // New audience key
    }]);
  }, [messages]);

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
    setTopics(prev => prev.map(t =>
      t.id === id ? { ...t, ...updates } : t
    ));
  }, []);

  // Delete topic (by id)
  const deleteTopic = useCallback((id) => {
    setTopics(prev => prev.filter(t => t.id !== id));
  }, []);

  // Get messages for cell - O(1) lookup instead of O(n) filtering
  const getMessages = useCallback((topic, audience) => {
    const cellKey = `${topic}-${audience}`;
    return messagesByCell[cellKey] || [];
  }, [messagesByCell]);

  // Load on mount
  useEffect(() => {
    load();
  }, [load]);

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

  return {
    audiences,
    topics,
    messages,
    keywords,
    isLoading,
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
    getMessages,
    getUrl: () => sheets.getUrl(),
    getSpreadsheetId: () => sheets.spreadsheetId
  };
};

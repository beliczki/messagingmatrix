import { useState, useCallback, useEffect } from 'react';
import matrixSheetsService from '../services/matrixSheetsService';
import serviceAccountAuth from '../services/serviceAccountAuth';

export const useMatrixData = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  // Data states
  const [audiences, setAudiences] = useState([]);
  const [topics, setTopics] = useState([]);
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState([]);
  
  // Change tracking
  const [changeLog, setChangeLog] = useState([]);
  const [nextMessageNumber, setNextMessageNumber] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize connection
  const initialize = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Initialize services
      await matrixSheetsService.initialize();
      
      // Check if service account is configured
      if (!serviceAccountAuth.isConfigured()) {
        throw new Error('Service account not configured. Please set VITE_GOOGLE_SHEETS_API_KEY in your environment.');
      }
      
      setIsConnected(true);
      await syncData();
    } catch (err) {
      setError(err.message);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync data from spreadsheet
  const syncData = useCallback(async () => {
    if (!isConnected && !isLoading) {
      setError('Not connected to Google Sheets. Please initialize first.');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await matrixSheetsService.syncAllData();
      
      // Sort audiences and topics by order, then alphabetically by key
      const sortedAudiences = (data.audiences || []).sort((a, b) => {
        if (a.order !== b.order) return (a.order || 0) - (b.order || 0);
        return (a.key || '').localeCompare(b.key || '');
      });

      const sortedTopics = (data.topics || []).sort((a, b) => {
        if (a.order !== b.order) return (a.order || 0) - (b.order || 0);
        return (a.key || '').localeCompare(b.key || '');
      });
      
      setAudiences(sortedAudiences);
      setTopics(sortedTopics);
      setMessages(data.messages || []);
      setTemplates(data.templates || []);
      
      // Calculate next message number (consider all messages including removed ones)
      const maxNumber = Math.max(0, ...(data.messages || []).map(m => m.number));
      setNextMessageNumber(maxNumber + 1);
      
      setLastSyncTime(new Date());
      return true;
    } catch (err) {
      setError(`Sync failed: ${err.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, isLoading]);

  // Add change to log
  const logChange = useCallback((type, action, data) => {
    const change = {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      type, // 'audience', 'topic', 'message'
      action, // 'create', 'update', 'delete', 'move'
      data,
      synced: false
    };
    
    setChangeLog(prev => [...prev, change]);
    return change.id;
  }, []);

  // Add new audience
  const addAudience = useCallback((name) => {
    const newOrder = Math.max(0, ...audiences.map(a => a.order)) + 1;
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10) || `aud${newOrder}`;
    
    const newAudience = {
      id: `temp_aud_${Date.now()}`,
      name,
      key,
      order: newOrder,
      status: 'active',
      isNew: true
    };
    
    setAudiences(prev => [...prev, newAudience]);
    logChange('audience', 'create', newAudience);
    
    return newAudience;
  }, [audiences, logChange]);

  // Add new topic
  const addTopic = useCallback((name) => {
    const newOrder = Math.max(0, ...topics.map(t => t.order)) + 1;
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10) || `top${newOrder}`;
    
    const newTopic = {
      id: `temp_top_${Date.now()}`,
      name,
      key,
      order: newOrder,
      status: 'active',
      isNew: true
    };
    
    setTopics(prev => [...prev, newTopic]);
    logChange('topic', 'create', newTopic);
    
    return newTopic;
  }, [topics, logChange]);

  // Add new message
  const addMessage = useCallback((topicKey, audienceKey) => {
    const topic = topics.find(t => t.key === topicKey);
    const audience = audiences.find(a => a.key === audienceKey);
    
    if (!topic || !audience) {
      console.error('Topic or audience not found');
      return null;
    }

    // Get next message number and variant
    const number = matrixSheetsService.getNextMessageNumber(messages, topicKey, audienceKey);
    const variant = matrixSheetsService.getNextVariant(messages, topicKey, audienceKey, number);
    const version = 1;
    
    const name = matrixSheetsService.generateMessageName(audienceKey, topicKey, number, variant, version);
    
    const newMessage = {
      id: `temp_msg_${Date.now()}`,
      name,
      number,
      variant,
      audience: audienceKey,
      topic: topicKey,
      version,
      template: '',
      landingUrl: '',
      headline: '',
      copy1: '',
      copy2: '',
      flash: '',
      cta: '',
      comment: '',
      status: 'active',
      isNew: true,
      isModified: false
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // Update next message number if this is a new number
    if (number >= nextMessageNumber) {
      setNextMessageNumber(number + 1);
    }
    
    logChange('message', 'create', newMessage);
    
    return newMessage;
  }, [topics, audiences, messages, nextMessageNumber, logChange]);

  // Update message
  const updateMessage = useCallback((messageId, updates) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const updatedMessage = { ...msg, ...updates, isModified: true };
        logChange('message', 'update', { id: messageId, changes: updates });
        return updatedMessage;
      }
      return msg;
    }));
  }, [logChange]);

  // Move message to different audience
  const moveMessage = useCallback((messageId, newAudienceKey) => {
    const message = messages.find(m => m.id === messageId);
    const newAudience = audiences.find(a => a.key === newAudienceKey);
    
    if (!message || !newAudience) return;

    const newName = matrixSheetsService.generateMessageName(
      newAudienceKey, 
      message.topic, 
      message.number, 
      message.variant, 
      message.version
    );

    const updates = {
      audience: newAudienceKey,
      name: newName,
      isModified: true
    };

    updateMessage(messageId, updates);
    logChange('message', 'move', { 
      messageId, 
      from: message.audience, 
      to: newAudienceKey 
    });
  }, [messages, audiences, updateMessage, logChange]);

  // Copy message to different audience
  const copyMessage = useCallback((messageId, newAudienceKey) => {
    const originalMessage = messages.find(m => m.id === messageId);
    const newAudience = audiences.find(a => a.key === newAudienceKey);
    
    if (!originalMessage || !newAudience) return null;

    const variant = matrixSheetsService.getNextVariant(
      messages, 
      originalMessage.topic, 
      newAudienceKey, 
      originalMessage.number
    );

    const newName = matrixSheetsService.generateMessageName(
      newAudienceKey, 
      originalMessage.topic, 
      originalMessage.number, 
      variant, 
      originalMessage.version
    );

    const copiedMessage = {
      ...originalMessage,
      id: `temp_msg_copy_${Date.now()}`,
      name: newName,
      audience: newAudienceKey,
      variant,
      isNew: true,
      isModified: false
    };

    setMessages(prev => [...prev, copiedMessage]);
    logChange('message', 'copy', { 
      originalId: messageId, 
      newMessage: copiedMessage 
    });

    return copiedMessage;
  }, [messages, audiences, logChange]);

  // Remove message (soft delete by setting status)
  const removeMessage = useCallback((messageId) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const updatedMessage = { ...msg, status: 'removed', isModified: true };
        
        // Log the change
        logChange('message', 'remove', updatedMessage);
        
        return updatedMessage;
      }
      return msg;
    }));
  }, [logChange]);

  // Update audience name
  const updateAudienceName = useCallback((audienceKey, newName) => {
    setAudiences(prev => prev.map(aud => {
      if (aud.key === audienceKey) {
        const updatedAudience = { ...aud, name: newName, isModified: true };
        
        // Log the change
        logChange('audience', 'update', updatedAudience);
        
        return updatedAudience;
      }
      return aud;
    }));
  }, [logChange]);

  // Update topic name
  const updateTopicName = useCallback((topicKey, newName) => {
    setTopics(prev => prev.map(topic => {
      if (topic.key === topicKey) {
        const updatedTopic = { ...topic, name: newName, isModified: true };
        
        // Log the change
        logChange('topic', 'update', updatedTopic);
        
        return updatedTopic;
      }
      return topic;
    }));
  }, [logChange]);

  // Get messages for a specific topic-audience combination (exclude removed)
  const getMessagesForCell = useCallback((topicKey, audienceKey) => {
    return messages.filter(m => 
      m.topic === topicKey && 
      m.audience === audienceKey && 
      (m.status || 'active') !== 'removed'
    );
  }, [messages]);

  // Save changes to spreadsheet
  const saveChanges = useCallback(async (changesToSave = null) => {
    const unsyncedChanges = changesToSave || changeLog.filter(change => !change.synced);
    
    if (unsyncedChanges.length === 0) {
      return { success: true, message: 'No changes to save' };
    }

    if (!serviceAccountAuth.isConfigured()) {
      setError('Service account not configured. Please set VITE_GOOGLE_SHEETS_API_KEY.');
      return { success: false, error: 'Service account not configured' };
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await matrixSheetsService.saveChangesToSpreadsheet(unsyncedChanges);
      
      if (result.success) {
        // Mark saved changes as synced
        setChangeLog(prev => prev.map(change => {
          if (unsyncedChanges.some(c => c.id === change.id)) {
            return { ...change, synced: true };
          }
          return change;
        }));

        // Optionally refresh data from spreadsheet
        await syncData();
      }

      return result;
    } catch (err) {
      setError(`Failed to save changes: ${err.message}`);
      return { success: false, error: err.message };
    } finally {
      setIsSaving(false);
    }
  }, [changeLog, syncData]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-sync every 60 seconds when connected
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(async () => {
      try {
        await syncData();
      } catch (err) {
        console.warn('Auto-sync failed:', err);
      }
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [isConnected, syncData]);

  return {
    // Connection state
    isConnected,
    isLoading,
    error,
    lastSyncTime,
    isSaving,

    // Data
    audiences,
    topics,
    messages,
    templates,
    changeLog,

    // Actions
    initialize,
    syncData,
    addAudience,
    addTopic,
    addMessage,
    updateMessage,
    moveMessage,
    copyMessage,
    removeMessage,
    updateAudienceName,
    updateTopicName,
    getMessagesForCell,
    clearError,
    saveChanges,

    // Utils
    getSpreadsheetUrl: () => matrixSheetsService.getSpreadsheetUrl()
  };
};

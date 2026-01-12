import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Send, Loader, RefreshCw, ChevronDown, ChevronUp, ChevronRight, GripHorizontal, Image as ImageIcon, X, Paperclip, Code, FileText, Check } from 'lucide-react';
// X is already imported
import { callAIAPI, callAIAPIStream } from '../api/claude-proxy';
import { apiGet } from '../utils/api';
import { marked } from 'marked';

// Default AI Provider configurations (fallback)
const DEFAULT_AI_PROVIDERS = {
  claude: {
    id: 'claude',
    name: 'Claude',
    icon: '🟣',
    models: [
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet', isDefault: true },
      { id: 'claude-opus-4-5-20251101', name: 'Claude 4.5 Opus' }
    ],
    available: true
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    icon: '🔵',
    models: [
      { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', isDefault: true },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
    ],
    available: true
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    icon: '⚫',
    models: [
      { id: 'grok-4-1-fast-reasoning', name: 'Grok 4.1 Fast Reasoning', isDefault: true }
    ],
    available: true
  }
};

// Load AI providers from localStorage (configured in Settings) or use defaults
const getAIProviders = () => {
  try {
    const savedModels = localStorage.getItem('ai_models_config');
    if (savedModels) {
      const parsed = JSON.parse(savedModels);
      // Merge with defaults, updating models but keeping provider structure
      return {
        claude: {
          ...DEFAULT_AI_PROVIDERS.claude,
          models: parsed.claude || DEFAULT_AI_PROVIDERS.claude.models
        },
        gemini: {
          ...DEFAULT_AI_PROVIDERS.gemini,
          models: parsed.gemini || DEFAULT_AI_PROVIDERS.gemini.models
        },
        grok: {
          ...DEFAULT_AI_PROVIDERS.grok,
          models: parsed.grok || DEFAULT_AI_PROVIDERS.grok.models
        }
      };
    }
  } catch (e) {
    console.error('Failed to load AI models config:', e);
  }
  return DEFAULT_AI_PROVIDERS;
};

const AIAssistant = forwardRef(({ matrixState, onAddAudience, onAddTopic, onAddMessage, onDeleteAudience, onDeleteTopic, taskContext, onTaskAction, moduleContext, matrixData, filteredItems, getItemUrl, editingMessage, onApplyField, setGeneratedVersions, setActiveEditorTab, setIsGeneratingContent }, ref) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [attachedImages, setAttachedImages] = useState([]);
  const [isAttachingFiltered, setIsAttachingFiltered] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed
  const [isClosing, setIsClosing] = useState(false);
  const [pendingSuggestions, setPendingSuggestions] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customPrompts, setCustomPrompts] = useState({});
  const [promptsLoaded, setPromptsLoaded] = useState(false);
  const [dataStructureDoc, setDataStructureDoc] = useState('');
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'context'
  const [contextParts, setContextParts] = useState(() => {
    const saved = localStorage.getItem('ai_assistant_context_parts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Default all enabled
      }
    }
    return {
      clientContext: true,
      moduleInstructions: true,
      dataStructure: true,
      audiences: true,
      topics: true,
      messages: true,
      messagesByAudience: false,
      messagesByTopic: false,
      keywords: true,
      assets: true,
      creatives: true,
      textFormatting: true
    };
  });
  const [height, setHeight] = useState(() => {
    const saved = localStorage.getItem('ai_assistant_height');
    return saved ? parseInt(saved) : window.innerHeight * 0.6; // Default 60% of viewport height
  });
  const [isResizing, setIsResizing] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  // Load AI providers from config (can be updated in Settings)
  const [aiProviders, setAiProviders] = useState(() => getAIProviders());
  const [selectedProvider, setSelectedProvider] = useState(() => {
    return localStorage.getItem('ai_assistant_provider') || 'claude';
  });
  const [selectedModel, setSelectedModel] = useState(() => {
    const saved = localStorage.getItem('ai_assistant_model');
    if (saved) return saved;
    // Default to first model of default provider
    const providers = getAIProviders();
    const provider = providers[localStorage.getItem('ai_assistant_provider') || 'claude'];
    const defaultModel = provider?.models.find(m => m.isDefault) || provider?.models[0];
    return defaultModel?.id || 'claude-sonnet-4-5-20250929';
  });
  const [temperature, setTemperature] = useState(() => {
    const saved = localStorage.getItem('ai_assistant_temperature');
    return saved ? parseFloat(saved) : 0.7;
  });

  // Persist temperature
  useEffect(() => {
    localStorage.setItem('ai_assistant_temperature', temperature.toString());
  }, [temperature]);

  // Reload AI providers when localStorage changes (from Settings)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'ai_models_config') {
        setAiProviders(getAIProviders());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Flat list of all models for simplified selector
  const allModels = Object.values(aiProviders).flatMap(provider =>
    provider.models.map(model => ({
      ...model,
      provider: provider.id,
      providerIcon: provider.icon,
      providerName: provider.name
    }))
  );
  const messagesEndRef = useRef(null);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);
  const modelDropdownRef = useRef(null);
  const streamingMessageRef = useRef(null);

  // Markdown rendering preference (persisted to localStorage)
  const [renderMarkdown, setRenderMarkdown] = useState(() => {
    const saved = localStorage.getItem('ai_assistant_render_markdown');
    return saved !== 'false'; // Default to true
  });
  // Track streaming message content
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Persist markdown preference
  useEffect(() => {
    localStorage.setItem('ai_assistant_render_markdown', renderMarkdown.toString());
  }, [renderMarkdown]);

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsCollapsed(true);
      setIsClosing(false);
    }, 200); // Match animation duration
  };

  // Handle toggle (for bottom panel click)
  const handleToggle = () => {
    if (!isCollapsed) {
      handleClose();
    } else {
      setIsCollapsed(false);
    }
  };

  // Load API key from .env or localStorage on mount
  useEffect(() => {
    // First check .env
    const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (envKey) {
      setApiKey(envKey);
      setIsConfigured(true);
      setShowConfig(false);
    } else {
      // Fall back to localStorage
      const savedKey = localStorage.getItem('ai_assistant_api_key');
      if (savedKey) {
        setApiKey(savedKey);
        setIsConfigured(true);
      } else {
        setShowConfig(true);
      }
    }
  }, []);

  // Load custom prompts and data structure from backend API on mount
  useEffect(() => {
    const loadCustomPrompts = async () => {
      try {
        const response = await apiGet('/api/ai-prompts');
        if (response.ok) {
          const prompts = await response.json();
          setCustomPrompts(prompts);
        } else {
          console.error('Failed to load prompts, status:', response.status);
        }
      } catch (error) {
        console.error('Error loading custom prompts:', error);
      }
    };

    const loadDataStructure = async () => {
      try {
        const response = await apiGet('/api/ai-data-structure');
        if (response.ok) {
          const { content } = await response.json();
          setDataStructureDoc(content);
        } else {
          console.error('Failed to load data structure, status:', response.status);
        }
      } catch (error) {
        console.error('Error loading data structure:', error);
      }
    };

    Promise.all([loadCustomPrompts(), loadDataStructure()]).then(() => {
      setPromptsLoaded(true);
    });
  }, []);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    processEmailsToTasks: async (emails, onTasksCreated) => {
      if (!isConfigured || isLoading) {
        alert('AI Assistant API is not configured or busy');
        return;
      }

      // Expand the assistant panel to show the process
      setIsCollapsed(false);
      setActiveTab('chat');

      // Build email summaries context
      const emailSummaries = emails.map((email, idx) =>
        `Email ${idx + 1}:\nFrom: ${email.fromName} <${email.from}>\nSubject: ${email.subject}\nDate: ${email.date}\nBody:\n${email.body}\n`
      ).join('\n---\n\n');

      // Get client context and email-to-task prompt from loaded prompts or use fallback
      const clientContext = customPrompts['client-context'] || '';
      const clientContextSection = clientContext ? `${clientContext}\n\n---\n\n` : '';
      const basePrompt = customPrompts['email-to-task'] || `You are an intelligent task manager. Analyze the following emails and extract actionable tasks from them. For each email, identify:
1. What action needs to be taken
2. The priority level (High, Medium, Low)
3. A clear, concise task summary (2-3 sentences max - DO NOT copy the entire email)
4. Any relevant deadline or due date mentioned
5. The email source (subject and sender)
6. Extract and structure the COMPLETE conversation context from the ENTIRE email thread

CRITICAL INSTRUCTION - PRESERVE ORIGINAL LANGUAGE:
- **IMPORTANT**: The "title", "description", and "context" fields MUST be in the ORIGINAL LANGUAGE of the email
- DO NOT translate to English or any other language
- If the email is in Hungarian, write the task in Hungarian
- If the email is in German, write the task in German
- If the email is in English, write the task in English
- Keep the exact same language as the email for all fields

INSTRUCTIONS FOR THE "title" FIELD:
- Brief task title (one line)
- In the ORIGINAL LANGUAGE of the email
- Actionable and clear

INSTRUCTIONS FOR THE "description" FIELD:
- Concise 2-3 sentence summary of what needs to be done and why
- In the ORIGINAL LANGUAGE of the email
- NOT the full email content - just a brief summary

INSTRUCTIONS FOR THE "context" FIELD:
- Extract key points from the email thread - focus on the most recent and relevant messages
- Organize the conversation chronologically showing who said what
- Use Markdown formatting for structure (headings, bold, lists, etc.)
- Preserve the ORIGINAL LANGUAGE - DO NOT translate
- Summarize older messages briefly, but keep recent messages more detailed
- Format it clearly with headings like "## John Doe wrote:" or "### Maria Smith replied:"
- Include timestamps for key messages
- Keep the context field concise but informative (aim for 200-400 words)
- Make it easy to read by using markdown formatting (bold for names, ## for message headers, etc.)

Return your response as a JSON array of tasks with this structure:
[
  {
    "title": "Brief task title in ORIGINAL LANGUAGE",
    "description": "Concise 2-3 sentence summary in ORIGINAL LANGUAGE",
    "context": "Markdown-formatted complete conversation thread in ORIGINAL LANGUAGE",
    "priority": "High|Medium|Low",
    "dueDate": "ISO date string or null",
    "source": "Email subject",
    "from": "Sender name/email",
    "status": "pending",
    "emailUid": email UID number
  }
]

CRITICAL JSON FORMATTING RULES:
- Return ONLY the JSON array - no markdown code fences, no explanations
- Do NOT wrap the JSON in \`\`\`json code blocks
- Ensure all strings are properly escaped (escape quotes with \\", newlines with \\n)
- Make sure the JSON is valid and parseable
- If an email doesn't contain actionable tasks, skip it (return empty array [] if no tasks)

RESPONSE MUST START WITH [ AND END WITH ]`;

      const emailPrompt = `${clientContextSection}${basePrompt}

Here are the emails:

${emailSummaries}`;

      // Add context message showing the emails
      const contextMessage = {
        role: 'system',
        content: `📧 Processing ${emails.length} email(s):\n\n${emails.map((e, i) => `${i + 1}. ${e.subject} (from ${e.fromName})`).join('\n')}`
      };
      setMessages(prev => [...prev, contextMessage]);

      // Add user message with the prompt
      const userMessage = {
        role: 'user',
        content: emailPrompt
      };
      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);
      setIsStreaming(true);
      setStreamingContent('');

      let fullResponse = '';

      // Use streaming API for email-to-task
      await callAIAPIStream(
        apiKey,
        [userMessage],
        selectedModel,
        16384,
        temperature,
        // onChunk
        (chunk) => {
          fullResponse += chunk;
          setStreamingContent(fullResponse);
          scrollToBottom();
        },
        // onDone
        () => {
          setIsStreaming(false);
          setStreamingContent('');

          const responseText = fullResponse;

          // Add assistant response to chat
          const assistantMessage = {
            role: 'assistant',
            content: responseText
          };
          setMessages(prev => [...prev, assistantMessage]);

          // Extract JSON from the response - try multiple patterns
          let jsonMatch = responseText.match(/```json\s*\n([\s\S]*?)\n```/);
          if (!jsonMatch) {
            jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/);
          }
          if (!jsonMatch) {
            jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              jsonMatch = [null, jsonMatch[0]];
            }
          }
          if (!jsonMatch) {
            const firstBracket = responseText.indexOf('[');
            const lastBracket = responseText.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
              jsonMatch = [null, responseText.substring(firstBracket, lastBracket + 1)];
            }
          }

          if (jsonMatch) {
            const jsonText = jsonMatch[1] || jsonMatch[0];
            try {
              const tasks = JSON.parse(jsonText.trim());

              const enrichedTasks = tasks.map((task, idx) => {
                const originalEmail = emails[idx];
                return {
                  ...task,
                  id: `task-${Date.now()}-${idx}`,
                  emailUid: originalEmail?.uid || null,
                  emailBody: originalEmail?.body || '',
                  emailSubject: originalEmail?.subject || '',
                  emailDate: originalEmail?.date || null,
                  createdAt: new Date().toISOString()
                };
              });

              if (onTasksCreated) {
                onTasksCreated(enrichedTasks);
              }

              const successMessage = {
                role: 'system',
                content: `✅ Extracted and created ${enrichedTasks.length} task(s) from ${emails.length} email(s)!`
              };
              setMessages(prev => [...prev, successMessage]);
            } catch (parseError) {
              console.error('Error parsing tasks JSON:', parseError);
              const errorMessage = {
                role: 'system',
                content: `❌ Failed to parse tasks from response. Parse error: ${parseError.message}`
              };
              setMessages(prev => [...prev, errorMessage]);
            }
          } else {
            const errorMessage = {
              role: 'system',
              content: '❌ No task data found in response. Please try again.'
            };
            setMessages(prev => [...prev, errorMessage]);
          }
          setIsLoading(false);
        },
        // onError
        (error) => {
          console.error('Error processing emails:', error);
          setIsStreaming(false);
          setStreamingContent('');
          const errorMessage = {
            role: 'assistant',
            content: `Error: ${error.message}`
          };
          setMessages(prev => [...prev, errorMessage]);
          setIsLoading(false);
        }
      );
    },
    generateMessageContent: async (contextData, callback) => {
      if (!isConfigured || isLoading) {
        alert('AI Assistant API is not configured or busy');
        return;
      }

      // Don't expand the assistant panel - keep it closed
      // setIsCollapsed(false);

      // Set generating state
      setIsGenerating(true);

      // Get example messages from the matrix for style/pattern reference
      const { messages: matrixMessages = [] } = matrixState || {};
      const exampleMessages = matrixMessages
        .filter(m => m.status !== 'deleted' && (m.headline || m.copy1 || m.cta))
        .slice(0, 5) // Get up to 5 examples
        .map(m => ({
          headline: m.headline || '',
          copy1: m.copy1 || '',
          copy2: m.copy2 || '',
          flash: m.flash || '',
          cta: m.cta || ''
        }));

      // Build examples section
      let examplesSection = '';
      if (exampleMessages.length > 0) {
        examplesSection = `\n**Examples from Other Messages (for style, length, and tone reference):**\n\n`;
        exampleMessages.forEach((msg, idx) => {
          examplesSection += `Example ${idx + 1}:\n`;
          if (msg.headline) examplesSection += `- Headline: "${msg.headline}"\n`;
          if (msg.copy1) examplesSection += `- Copy 1: "${msg.copy1}"\n`;
          if (msg.copy2) examplesSection += `- Copy 2: "${msg.copy2}"\n`;
          if (msg.flash) examplesSection += `- Flash: "${msg.flash}"\n`;
          if (msg.cta) examplesSection += `- CTA: "${msg.cta}"\n`;
          examplesSection += `\n`;
        });
      }

      // Build the generation prompt from configurable template
      let generationPrompt = customPrompts['message-generation'] || '';

      // If no custom prompt, use default
      if (!generationPrompt.trim()) {
        generationPrompt = `Generate marketing message content for the following context:

**Audience:**
- Name: {{AUDIENCE_NAME}}
- Strategy: {{AUDIENCE_STRATEGY}}
- Device: {{AUDIENCE_DEVICE}}
- Targeting: {{AUDIENCE_TARGETING}}
- Comment: {{AUDIENCE_COMMENT}}

**Topic:**
- Name: {{TOPIC_NAME}}
- Tags: {{TOPIC_TAGS}}
- Comment: {{TOPIC_COMMENT}}

**Current Message Content (if any):**
- Name: {{MESSAGE_NAME}}
- Headline: {{MESSAGE_HEADLINE}}
- Copy 1: {{MESSAGE_COPY1}}
- Copy 2: {{MESSAGE_COPY2}}
- Flash: {{MESSAGE_FLASH}}
- CTA: {{MESSAGE_CTA}}

{{EXAMPLES_SECTION}}

Please generate 5 DIFFERENT versions of each field. Each version should be unique and offer variety in approach, tone, or wording while maintaining brand consistency.

Respond ONLY with a JSON object in this exact format:

\`\`\`json
{
  "headline": ["Version 1", "Version 2", "Version 3", "Version 4", "Version 5"],
  "copy1": ["Version 1", "Version 2", "Version 3", "Version 4", "Version 5"],
  "copy2": ["Version 1", "Version 2", "Version 3", "Version 4", "Version 5"],
  "flash": ["Version 1", "Version 2", "Version 3", "Version 4", "Version 5"],
  "cta": ["Version 1", "Version 2", "Version 3", "Version 4", "Version 5"]
}
\`\`\``;
      }

      // Replace placeholders with actual values
      generationPrompt = generationPrompt
        .replace(/\{\{AUDIENCE_NAME\}\}/g, contextData.audience.name || 'N/A')
        .replace(/\{\{AUDIENCE_STRATEGY\}\}/g, contextData.audience.strategy || 'N/A')
        .replace(/\{\{AUDIENCE_DEVICE\}\}/g, contextData.audience.device || 'N/A')
        .replace(/\{\{AUDIENCE_TARGETING\}\}/g, contextData.audience.targeting_type || 'N/A')
        .replace(/\{\{AUDIENCE_COMMENT\}\}/g, contextData.audience.comment || 'N/A')
        .replace(/\{\{TOPIC_NAME\}\}/g, contextData.topic.name || 'N/A')
        .replace(/\{\{TOPIC_TAGS\}\}/g, [contextData.topic.tag1, contextData.topic.tag2, contextData.topic.tag3, contextData.topic.tag4].filter(Boolean).join(', ') || 'N/A')
        .replace(/\{\{TOPIC_COMMENT\}\}/g, contextData.topic.comment || 'N/A')
        .replace(/\{\{MESSAGE_NAME\}\}/g, contextData.currentMessage.name || 'N/A')
        .replace(/\{\{MESSAGE_HEADLINE\}\}/g, contextData.currentMessage.headline || 'N/A')
        .replace(/\{\{MESSAGE_COPY1\}\}/g, contextData.currentMessage.copy1 || 'N/A')
        .replace(/\{\{MESSAGE_COPY2\}\}/g, contextData.currentMessage.copy2 || 'N/A')
        .replace(/\{\{MESSAGE_FLASH\}\}/g, contextData.currentMessage.flash || 'N/A')
        .replace(/\{\{MESSAGE_CTA\}\}/g, contextData.currentMessage.cta || 'N/A')
        .replace(/\{\{EXAMPLES_SECTION\}\}/g, examplesSection)
        .replace(/\{\{BRIEF\}\}/g, contextData.brief || '');

      // If brief is provided but not in template, append it
      if (contextData.brief && !generationPrompt.includes('{{BRIEF}}')) {
        generationPrompt += `\n\n**Additional Instructions/Brief:**\n${contextData.brief}`;
      }

      // Find sibling variants for context
      const { messages: matrixMsgs = [] } = matrixState || {};
      const siblingVariants = matrixMsgs.filter(m =>
        m.number === contextData.currentMessage.number &&
        m.id !== contextData.currentMessage.id &&
        m.status !== 'deleted'
      ).map(v => ({
        variant: v.variant || 'a',
        name: v.name,
        headline: v.headline,
        copy1: v.copy1,
        copy2: v.copy2,
        flash: v.flash,
        cta: v.cta
      }));

      // Add variants info to chat if they exist
      if (siblingVariants.length > 0) {
        const variantsMessage = {
          role: 'system',
          content: `📋 Sibling Variants (${siblingVariants.length}):\n\`\`\`json\n${JSON.stringify(siblingVariants, null, 2)}\n\`\`\``
        };
        setMessages(prev => [...prev, variantsMessage]);
      }

      // Add user message to chat
      const userMessage = {
        role: 'user',
        content: generationPrompt
      };

      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);
      setIsStreaming(true);
      setStreamingContent('');

      let fullResponse = '';

      // Use streaming API for content generation
      await callAIAPIStream(
        apiKey,
        [userMessage],
        selectedModel,
        4096,
        temperature,
        // onChunk
        (chunk) => {
          fullResponse += chunk;
          setStreamingContent(fullResponse);
          scrollToBottom();
        },
        // onDone
        () => {
          setIsStreaming(false);
          setStreamingContent('');

          const responseText = fullResponse;

          // Add assistant response to chat
          const assistantMessage = {
            role: 'assistant',
            content: responseText
          };
          setMessages(prev => [...prev, assistantMessage]);

          // Extract JSON from the response - try multiple patterns
          let jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
          if (!jsonMatch) {
            jsonMatch = responseText.match(/```json([\s\S]*?)```/);
          }
          if (!jsonMatch) {
            jsonMatch = responseText.match(/\{[\s\S]*?"headline"[\s\S]*?\}/);
            if (jsonMatch) {
              jsonMatch = [null, jsonMatch[0]];
            }
          }

          if (jsonMatch) {
            try {
              const jsonText = jsonMatch[1].trim();
              const generatedContent = JSON.parse(jsonText);

              const hasContent = generatedContent.headline?.length || generatedContent.copy1?.length || generatedContent.cta?.length;
              if (hasContent) {
                if (setGeneratedVersions) {
                  setGeneratedVersions(generatedContent);
                }
                if (setActiveEditorTab) {
                  setActiveEditorTab('generate');
                }
                const successMessage = {
                  role: 'system',
                  content: '✅ Generated 5 versions for each field! Switch to Generate tab to apply.'
                };
                setMessages(prev => [...prev, successMessage]);
              } else {
                const errorMessage = {
                  role: 'system',
                  content: '❌ Generated content is empty. Please try again.'
                };
                setMessages(prev => [...prev, errorMessage]);
              }
            } catch (parseError) {
              console.error('Error parsing JSON:', parseError);
              const errorMessage = {
                role: 'system',
                content: '❌ Failed to parse generated content. Please try again.'
              };
              setMessages(prev => [...prev, errorMessage]);
            }
          } else {
            const errorMessage = {
              role: 'system',
              content: '❌ Response did not contain expected JSON format. Please review the response above and try again.'
            };
            setMessages(prev => [...prev, errorMessage]);
          }
          setIsLoading(false);
        },
        // onError
        (error) => {
          console.error('Error generating content:', error);
          setIsStreaming(false);
          setStreamingContent('');
          const errorMessage = {
            role: 'assistant',
            content: `Error: ${error.message}`
          };
          setMessages(prev => [...prev, errorMessage]);
          setIsLoading(false);
        }
      );

      // These are called in onDone/onError callbacks, but also set here for safety
      setIsGenerating(false);
      if (setIsGeneratingContent) {
        setIsGeneratingContent(false);
      }
    },
    getIsGenerating: () => isGenerating
  }));

  // Handle resize
  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = height;
  };

  // Build initial context when component mounts or module changes
  useEffect(() => {
    buildContextPrompt();
  }, [moduleContext?.module, taskContext]);

  
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const deltaY = resizeStartY.current - e.clientY; // Inverted because dragging up increases height
      const newHeight = Math.max(200, Math.min(window.innerHeight * 0.9, resizeStartHeight.current + deltaY));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem('ai_assistant_height', height.toString());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, height]);

  // Handle model selection
  const handleSelectModel = (providerId, modelId) => {
    const provider = aiProviders[providerId];
    if (!provider?.available) {
      // Show coming soon message
      return;
    }
    setSelectedProvider(providerId);
    setSelectedModel(modelId);
    localStorage.setItem('ai_assistant_provider', providerId);
    localStorage.setItem('ai_assistant_model', modelId);
    setShowModelDropdown(false);
  };

  // Get current provider and model display info
  const getCurrentProviderInfo = () => {
    const provider = aiProviders[selectedProvider] || aiProviders.claude;
    const model = provider.models.find(m => m.id === selectedModel) || provider.models[0];
    return { provider, model };
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target)) {
        setShowModelDropdown(false);
      }
    };

    if (showModelDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showModelDropdown]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Save context parts to localStorage
  useEffect(() => {
    localStorage.setItem('ai_assistant_context_parts', JSON.stringify(contextParts));
  }, [contextParts]);

  // Toggle a context part
  const toggleContextPart = (partKey) => {
    setContextParts(prev => ({
      ...prev,
      [partKey]: !prev[partKey]
    }));
  };

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('ai_assistant_api_key', apiKey.trim());
      setIsConfigured(true);
      setShowConfig(false);
    }
  };

  const removeApiKey = () => {
    localStorage.removeItem('ai_assistant_api_key');
    setApiKey('');
    setIsConfigured(false);
    setShowConfig(true);
  };

  // Build comprehensive app state context (uses loaded data structure doc + ALL current data)
  const buildAppStateContext = () => {
    const data = matrixData || matrixState;
    if (!data) return '';

    const { audiences = [], topics = [], messages = [], keywords = {}, assets = [], creatives = [], textFormatting = [] } = data;
    const activeMessages = messages.filter(m => m.status !== 'deleted');

    let result = '';

    // Data structure documentation
    if (contextParts.dataStructure && dataStructureDoc) {
      result += `${dataStructureDoc}\n\n`;
    }

    // Current data counts (always show if any data part is enabled)
    const anyDataEnabled = contextParts.audiences || contextParts.topics || contextParts.messages ||
                           contextParts.keywords || contextParts.assets || contextParts.creatives ||
                           contextParts.textFormatting;

    if (anyDataEnabled) {
      result += `**Current Data Counts:**\n`;
      if (contextParts.audiences) result += `- Audiences: ${audiences.length}\n`;
      if (contextParts.topics) result += `- Topics: ${topics.length}\n`;
      if (contextParts.messages) result += `- Messages: ${activeMessages.length}\n`;
      if (contextParts.audiences && contextParts.topics) {
        result += `- Matrix cells: ${audiences.length} × ${topics.length} = ${audiences.length * topics.length} possible cells\n`;
      }
      if (contextParts.keywords) result += `- Keywords: ${Object.keys(keywords).length} categories\n`;
      if (contextParts.assets) result += `- Assets: ${assets.length}\n`;
      if (contextParts.creatives) result += `- Creatives: ${creatives.length}\n`;
      if (contextParts.textFormatting) result += `- Text Formatting Styles: ${textFormatting.length}\n`;
      result += `\n---\n\n## CURRENT DATA:\n\n`;
    }

    // Individual data sections
    if (contextParts.audiences) {
      result += `### ALL AUDIENCES (${audiences.length} total):\n${audiences.length > 0 ? JSON.stringify(audiences, null, 2) : 'No audiences defined'}\n\n`;
    }
    if (contextParts.topics) {
      result += `### ALL TOPICS (${topics.length} total):\n${topics.length > 0 ? JSON.stringify(topics, null, 2) : 'No topics defined'}\n\n`;
    }
    if (contextParts.messages) {
      result += `### ALL MESSAGES (${activeMessages.length} active):\n${activeMessages.length > 0 ? JSON.stringify(activeMessages, null, 2) : 'No messages defined'}\n\n`;
    }
    if (contextParts.messagesByAudience && activeMessages.length > 0) {
      // Group messages by audience
      const byAudience = {};
      activeMessages.forEach(msg => {
        const audienceKey = msg.audience || 'unassigned';
        if (!byAudience[audienceKey]) byAudience[audienceKey] = [];
        byAudience[audienceKey].push(msg);
      });
      result += `### MESSAGES GROUPED BY AUDIENCE:\n`;
      Object.keys(byAudience).forEach(audienceKey => {
        const audienceName = audiences.find(a => a.key === audienceKey)?.name || audienceKey;
        result += `\n**${audienceName}** (${byAudience[audienceKey].length} messages):\n${JSON.stringify(byAudience[audienceKey], null, 2)}\n`;
      });
      result += `\n`;
    }
    if (contextParts.messagesByTopic && activeMessages.length > 0) {
      // Group messages by topic
      const byTopic = {};
      activeMessages.forEach(msg => {
        const topicKey = msg.topic || 'unassigned';
        if (!byTopic[topicKey]) byTopic[topicKey] = [];
        byTopic[topicKey].push(msg);
      });
      result += `### MESSAGES GROUPED BY TOPIC:\n`;
      Object.keys(byTopic).forEach(topicKey => {
        const topicName = topics.find(t => t.key === topicKey)?.name || topicKey;
        result += `\n**${topicName}** (${byTopic[topicKey].length} messages):\n${JSON.stringify(byTopic[topicKey], null, 2)}\n`;
      });
      result += `\n`;
    }
    if (contextParts.keywords) {
      result += `### ALL KEYWORDS:\n${Object.keys(keywords).length > 0 ? JSON.stringify(keywords, null, 2) : 'No keywords defined'}\n\n`;
    }
    if (contextParts.assets) {
      result += `### ALL ASSETS (${assets.length} total):\n${assets.length > 0 ? JSON.stringify(assets, null, 2) : 'No assets'}\n\n`;
    }
    if (contextParts.creatives) {
      result += `### ALL CREATIVES (${creatives.length} total):\n${creatives.length > 0 ? JSON.stringify(creatives, null, 2) : 'No creatives'}\n\n`;
    }
    if (contextParts.textFormatting) {
      result += `### ALL TEXT FORMATTING (${textFormatting.length} styles):\n${textFormatting.length > 0 ? JSON.stringify(textFormatting, null, 2) : 'No text formatting styles defined'}\n\n`;
    }

    return result;
  };

  const buildContextPrompt = () => {
    const appStateContext = buildAppStateContext();

    // Get client context (added to ALL modules) - respect toggle
    const clientContext = customPrompts['client-context'] || '';
    const clientContextSection = (contextParts.clientContext && clientContext) ? `${clientContext}\n\n---\n\n` : '';

    // Message editing context - use message-generation prompt with populated placeholders
    if (editingMessage) {
      let messageInstructions = contextParts.moduleInstructions ? (customPrompts['message-generation'] || '') : '';

      // Get audience and topic data for the editing message
      const data = matrixData || matrixState || {};
      const audiences = data.audiences || [];
      const topics = data.topics || [];
      const audience = audiences.find(a => a.key === editingMessage.audience) || {};
      const topic = topics.find(t => t.key === editingMessage.topic) || {};

      // Build examples section (same logic as generateMessageContent)
      const matrixMessages = data.messages || [];
      const exampleMessages = matrixMessages
        .filter(m => m.status !== 'deleted' && m.id !== editingMessage.id && (m.headline || m.copy1 || m.cta))
        .slice(0, 5)
        .map(m => ({
          headline: m.headline || '',
          copy1: m.copy1 || '',
          copy2: m.copy2 || '',
          flash: m.flash || '',
          cta: m.cta || ''
        }));

      let examplesSection = '';
      if (exampleMessages.length > 0) {
        examplesSection = `\n**Examples from Other Messages (for style, length, and tone reference):**\n\n`;
        exampleMessages.forEach((msg, idx) => {
          examplesSection += `Example ${idx + 1}:\n`;
          if (msg.headline) examplesSection += `- Headline: "${msg.headline}"\n`;
          if (msg.copy1) examplesSection += `- Copy 1: "${msg.copy1}"\n`;
          if (msg.copy2) examplesSection += `- Copy 2: "${msg.copy2}"\n`;
          if (msg.flash) examplesSection += `- Flash: "${msg.flash}"\n`;
          if (msg.cta) examplesSection += `- CTA: "${msg.cta}"\n`;
          examplesSection += `\n`;
        });
      }

      // Replace placeholders with actual values
      messageInstructions = messageInstructions
        .replace(/\{\{AUDIENCE_NAME\}\}/g, audience.name || 'N/A')
        .replace(/\{\{AUDIENCE_STRATEGY\}\}/g, audience.strategy || 'N/A')
        .replace(/\{\{AUDIENCE_DEVICE\}\}/g, audience.device || 'N/A')
        .replace(/\{\{AUDIENCE_TARGETING\}\}/g, audience.targeting_type || 'N/A')
        .replace(/\{\{AUDIENCE_COMMENT\}\}/g, audience.comment || 'N/A')
        .replace(/\{\{TOPIC_NAME\}\}/g, topic.name || 'N/A')
        .replace(/\{\{TOPIC_TAGS\}\}/g, [topic.tag1, topic.tag2, topic.tag3, topic.tag4].filter(Boolean).join(', ') || 'N/A')
        .replace(/\{\{TOPIC_COMMENT\}\}/g, topic.comment || 'N/A')
        .replace(/\{\{MESSAGE_NAME\}\}/g, editingMessage.name || 'N/A')
        .replace(/\{\{MESSAGE_HEADLINE\}\}/g, editingMessage.headline || 'N/A')
        .replace(/\{\{MESSAGE_COPY1\}\}/g, editingMessage.copy1 || 'N/A')
        .replace(/\{\{MESSAGE_COPY2\}\}/g, editingMessage.copy2 || 'N/A')
        .replace(/\{\{MESSAGE_FLASH\}\}/g, editingMessage.flash || 'N/A')
        .replace(/\{\{MESSAGE_CTA\}\}/g, editingMessage.cta || 'N/A')
        .replace(/\{\{EXAMPLES_SECTION\}\}/g, examplesSection);

      const context = `${clientContextSection}${messageInstructions}
${appStateContext}`;
      return context;
    }

    // Module-specific contexts (creative-library, assets, monitoring, templates, users, settings)
    if (moduleContext) {
      const module = moduleContext.module;

      // Use prompt from file (loaded from backend on component mount) - respect toggle
      if (customPrompts[module] && customPrompts[module].trim() !== '') {
        const moduleInstructions = contextParts.moduleInstructions ? customPrompts[module] : '';
        const context = `${clientContextSection}${moduleInstructions}
${appStateContext}`;
        return context;
      }

      // If prompts haven't loaded yet, return loading message
      if (!promptsLoaded) {
        return `Loading AI Assistant configuration...`;
      }

      // If no file-based prompt found after loading, return error message
      console.error(`❌ No prompt file found for module: ${module}`);
      return `Error: AI Assistant prompt not configured for module "${module}". Please check that AI${module.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Instructions.txt exists in the root directory.`;
    }

    // Task Management Context
    if (taskContext) {
      const { tasks, emails } = taskContext;

      // Include ALL tasks and emails in full detail
      const taskStateJSON = `## COMPLETE TASK MANAGEMENT DATA:

### ALL TASKS (${tasks.length} total):
${JSON.stringify(tasks, null, 2)}

### ALL EMAILS (${emails.length} total):
${JSON.stringify(emails, null, 2)}`;

      // Use prompt from file - respect toggle
      if (customPrompts.tasks && customPrompts.tasks.trim() !== '') {
        const moduleInstructions = contextParts.moduleInstructions ? customPrompts.tasks : '';
        const context = `${clientContextSection}${taskStateJSON}

${moduleInstructions}`;
        return context;
      }

      // If prompts haven't loaded yet, return loading message
      if (!promptsLoaded) {
        return `${taskStateJSON}

Loading AI Assistant configuration...`;
      }

      // If no file-based prompt found after loading, return error message
      console.error('❌ No prompt file found for tasks module');
      return `${taskStateJSON}

Error: AI Assistant prompt not configured for tasks. Please check that AITasksInstructions.txt exists in the root directory.`;
    }

    // Matrix Context (default)
    const data = matrixData || matrixState;
    if (!data) {
      return 'Loading application data...';
    }

    // Build complete matrix context using appStateContext (already respects toggles)
    const moduleInstructions = contextParts.moduleInstructions ? (customPrompts.matrix || '') : '';
    const matrixContextFull = `${clientContextSection}${moduleInstructions}

---

# APPLICATION CONTEXT

${appStateContext}`;

    // If prompts haven't loaded yet, return loading message
    if (!promptsLoaded) {
      return `${matrixContextFull}

⏳ Loading AI Assistant instructions...`;
    }

    // If no file-based prompt found after loading, return error message
    if (!customPrompts.matrix || customPrompts.matrix.trim() === '') {
      console.error('❌ No prompt file found for matrix module');
      return `${matrixContextFull}

⚠️ Error: AI Assistant instructions not configured for matrix. Please check that AIMatrixInstructions.txt exists in the root directory.`;
    }

    return matrixContextFull;
  };

  const sendMessage = async () => {
    if ((!input.trim() && attachedImages.length === 0) || !isConfigured || isLoading) return;

    // Build user message content - can be string or array with images
    let userMessageContent;
    if (attachedImages.length > 0) {
      // Multi-modal message with text and images
      userMessageContent = [
        { type: 'text', text: input.trim() || 'Please analyze these images.' },
        ...attachedImages.map(img => ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.mimeType,
            data: img.data
          }
        }))
      ];
    } else {
      // Text-only message
      userMessageContent = input.trim();
    }

    const userMessage = {
      role: 'user',
      content: userMessageContent,
      // Store image info for display
      images: attachedImages.length > 0 ? attachedImages : undefined
    };

    const savedUserInput = input.trim().toLowerCase();
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachedImages([]);
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingContent('');

    // Build context from matrix state
    const contextPrompt = buildContextPrompt();

    // Prepare messages for API - clean them to only include role and content
    const cleanMessage = (msg) => ({
      role: msg.role,
      content: msg.content
    });

    const apiMessages = [
      {
        role: 'user',
        content: contextPrompt
      },
      ...messages.filter(m => m.role !== 'system').map(cleanMessage),
      cleanMessage(userMessage)
    ];

    let fullResponse = '';

    // Use streaming API
    await callAIAPIStream(
      apiKey,
      apiMessages,
      selectedModel,
      4096,
      temperature,
      // onChunk - called for each text chunk
      (chunk) => {
        fullResponse += chunk;
        setStreamingContent(fullResponse);
        scrollToBottom();
      },
      // onDone - called when stream completes
      () => {
        setIsStreaming(false);
        setStreamingContent('');

        const assistantMessage = {
          role: 'assistant',
          content: fullResponse
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);

        // Process commands and suggestions after response is complete
        const userInput = savedUserInput;
        const isAddCommand = userInput.includes('add');
        const isRemoveCommand = userInput.includes('remove');

        if (isAddCommand && pendingSuggestions) {
          let addedAudiences = 0;
          let addedTopics = 0;
          const isAddAll = userInput.includes('add all');

          if (pendingSuggestions.suggestAudiences) {
            pendingSuggestions.suggestAudiences.forEach(aud => {
              if (isAddAll || userInput.includes(aud.name.toLowerCase())) {
                if (onAddAudience) {
                  onAddAudience(aud.name);
                  addedAudiences++;
                }
              }
            });
          }

          if (pendingSuggestions.suggestTopics) {
            pendingSuggestions.suggestTopics.forEach(topic => {
              if (isAddAll || userInput.includes(topic.name.toLowerCase())) {
                if (onAddTopic) {
                  onAddTopic(topic.name);
                  addedTopics++;
                }
              }
            });
          }

          if (addedAudiences > 0 || addedTopics > 0) {
            const confirmationMessage = {
              role: 'system',
              content: `✅ Added to matrix: ${addedAudiences} audience(s) and ${addedTopics} topic(s).`
            };
            setMessages(prev => [...prev, confirmationMessage]);
            setPendingSuggestions(null);
          }
        } else if (isRemoveCommand && matrixState) {
          const { audiences = [], topics = [] } = matrixState;
          let removed = [];

          audiences.forEach(aud => {
            if (userInput.includes(aud.name.toLowerCase()) || userInput.includes(aud.key.toLowerCase())) {
              if (onDeleteAudience) {
                onDeleteAudience(aud.id);
                removed.push(`audience "${aud.name}"`);
              }
            }
          });

          topics.forEach(topic => {
            if (userInput.includes(topic.name.toLowerCase()) || userInput.includes(topic.key.toLowerCase())) {
              if (onDeleteTopic) {
                onDeleteTopic(topic.id);
                removed.push(`topic "${topic.name}"`);
              }
            }
          });

          if (removed.length > 0) {
            const confirmationMessage = {
              role: 'system',
              content: `✅ Removed from matrix: ${removed.join(', ')}.`
            };
            setMessages(prev => [...prev, confirmationMessage]);
          }
        }

        // Parse and store any json-suggestions in the response
        const jsonSuggestionsMatch = fullResponse.match(/```json-suggestions\n([\s\S]*?)\n```/);
        if (jsonSuggestionsMatch) {
          try {
            const suggestions = JSON.parse(jsonSuggestionsMatch[1]);
            setPendingSuggestions(suggestions);

            const totalSuggestions =
              (suggestions.suggestAudiences?.length || 0) +
              (suggestions.suggestTopics?.length || 0);

            const infoMessage = {
              role: 'system',
              content: `💡 ${totalSuggestions} suggestion(s) ready. Say "add all" to add everything, or "add [name]" to add specific items.`
            };
            setMessages(prev => [...prev, infoMessage]);
          } catch (parseError) {
            console.error('Error parsing json-suggestions:', parseError);
          }
        }
      },
      // onError - called on error
      (error) => {
        console.error('Error calling AI API:', error);
        setIsStreaming(false);
        setStreamingContent('');
        const errorMessage = {
          role: 'assistant',
          content: `Error: ${error.message}. Make sure your API key is valid.`
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);
      }
    );
  };

  const clearChat = () => {
    setMessages([]);
    setAttachedImages([]);
  };

  // Handle image file selection
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    const imagePromises = files.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          // Get base64 data and mime type
          const base64Data = event.target.result.split(',')[1];
          const mimeType = file.type;
          resolve({
            name: file.name,
            mimeType,
            data: base64Data
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    try {
      const images = await Promise.all(imagePromises);
      setAttachedImages(prev => [...prev, ...images]);
    } catch (error) {
      console.error('Error reading images:', error);
    }
  };

  // Handle attaching filtered items from Creative Library or Assets
  const handleAttachFilteredItems = async () => {
    if (!filteredItems || filteredItems.length === 0) {
      console.warn('No filtered items to attach');
      return;
    }

    setIsAttachingFiltered(true);

    try {
      // Limit to first 10 items to avoid overwhelming the API
      const itemsToAttach = filteredItems.slice(0, 10);

      const imagePromises = itemsToAttach.map(async (item) => {
        try {
          // Get the URL for this item
          const url = getItemUrl ? getItemUrl(item) : (item.url || item.File_DirectLink);
          if (!url) {
            console.warn('No URL for item:', item);
            return null;
          }

          const filename = item.File_name || item.filename || `item-${item.ID || item.id}`;

          // Try fetch first (works for proxy URLs and local URLs)
          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();

            // Convert to base64
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (event) => {
                const base64Data = event.target.result.split(',')[1];
                const mimeType = blob.type || 'image/jpeg';
                resolve({
                  name: filename,
                  mimeType,
                  data: base64Data
                });
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (fetchError) {
            console.warn(`Fetch failed for ${filename}, trying canvas method:`, fetchError.message);

            // Fallback: Use canvas to convert image (works around CORS for img tags)
            return new Promise((resolve, reject) => {
              const img = new Image();
              img.crossOrigin = 'anonymous'; // Try with CORS first

              img.onload = () => {
                try {
                  const canvas = document.createElement('canvas');
                  canvas.width = img.width;
                  canvas.height = img.height;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(img, 0, 0);

                  // Convert canvas to base64
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                  const base64Data = dataUrl.split(',')[1];

                  resolve({
                    name: filename,
                    mimeType: 'image/jpeg',
                    data: base64Data
                  });
                } catch (canvasError) {
                  console.error('Canvas conversion failed:', canvasError);
                  reject(canvasError);
                }
              };

              img.onerror = (err) => {
                console.error('Image load failed:', err);
                reject(new Error('Failed to load image'));
              };

              img.src = url;
            });
          }
        } catch (error) {
          console.error('Error processing item:', item, error);
          return null;
        }
      });

      const images = await Promise.all(imagePromises);
      const validImages = images.filter(img => img !== null);

      if (validImages.length > 0) {
        setAttachedImages(prev => [...prev, ...validImages]);
        console.log(`✓ Attached ${validImages.length} filtered items`);
      } else {
        console.warn('No images could be attached. Check console for errors.');
      }
    } catch (error) {
      console.error('Error attaching filtered items:', error);
    } finally {
      setIsAttachingFiltered(false);
    }
  };

  // Remove attached image
  const removeImage = (index) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Get module-specific hints for empty state
  const getModuleHints = () => {
    if (moduleContext) {
      const hints = {
        'creative-library': {
          title: 'AI can help manage your Creative Library',
          description: 'AI can analyze your creative assets and suggest improvements',
          color: 'teal',
          examples: [
            '"Analyze my creative naming conventions"',
            '"What creative sizes am I missing?"',
            '"Suggest a better folder structure"',
            '"How can I improve creative organization?"'
          ]
        },
        'assets': {
          title: 'AI can help organize your Assets',
          description: 'AI can suggest asset management strategies and workflows',
          color: 'orange',
          examples: [
            '"Suggest naming conventions for my assets"',
            '"How should I organize my media files?"',
            '"What\'s the best way to tag assets?"',
            '"Help me create a folder structure"'
          ]
        },
        'monitoring': {
          title: 'AI can help analyze performance data',
          description: 'AI can provide insights on campaign metrics and optimization',
          color: 'green',
          examples: [
            '"What metrics should I focus on?"',
            '"Analyze this performance trend"',
            '"Suggest optimization strategies"',
            '"What thresholds should I set for alerts?"'
          ]
        },
        'templates': {
          title: 'AI can help improve your Templates',
          description: 'AI can review template code and suggest improvements',
          color: 'amber',
          examples: [
            '"Review my template structure"',
            '"Suggest improvements for responsive design"',
            '"How can I optimize placeholders?"',
            '"What are template development best practices?"'
          ]
        },
        'users': {
          title: 'AI can help manage Users',
          description: 'AI can advise on user roles, permissions, and access control',
          color: 'indigo',
          examples: [
            '"Suggest appropriate user roles"',
            '"How should I organize my team?"',
            '"What permissions should each role have?"',
            '"Best practices for user onboarding"'
          ]
        },
        'settings': {
          title: 'AI can help configure Settings',
          description: 'AI can advise on optimal configuration and integrations',
          color: 'gray',
          examples: [
            '"Help me set up Google Drive integration"',
            '"What are the optimal settings for my workflow?"',
            '"How do I configure security settings?"',
            '"Troubleshoot my configuration"'
          ]
        }
      };
      return hints[moduleContext.module];
    }
    return null;
  };

  return (
    <>
      {/* Styles for markdown content and cursor blink */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .ai-markdown-content {
          line-height: 1.5;
        }
        .ai-markdown-content p {
          margin: 0 0 0.5em 0;
        }
        .ai-markdown-content p:last-child {
          margin-bottom: 0;
        }
        .ai-markdown-content h1, .ai-markdown-content h2, .ai-markdown-content h3 {
          margin: 0.5em 0 0.3em 0;
          font-weight: 600;
        }
        .ai-markdown-content h1 { font-size: 1.3em; }
        .ai-markdown-content h2 { font-size: 1.15em; }
        .ai-markdown-content h3 { font-size: 1.05em; }
        .ai-markdown-content ul, .ai-markdown-content ol {
          margin: 0.3em 0;
          padding-left: 1.5em;
        }
        .ai-markdown-content li {
          margin: 0.2em 0;
        }
        .ai-markdown-content code {
          background: rgba(255,255,255,0.15);
          padding: 0.1em 0.3em;
          border-radius: 3px;
          font-family: monospace;
          font-size: 0.9em;
        }
        .ai-markdown-content pre {
          background: rgba(0,0,0,0.3);
          padding: 0.5em;
          border-radius: 4px;
          overflow-x: auto;
          margin: 0.5em 0;
        }
        .ai-markdown-content pre code {
          background: transparent;
          padding: 0;
        }
        .ai-markdown-content blockquote {
          border-left: 3px solid rgba(255,255,255,0.3);
          margin: 0.5em 0;
          padding-left: 0.8em;
          color: rgba(255,255,255,0.8);
        }
        .ai-markdown-content a {
          color: #60a5fa;
          text-decoration: underline;
        }
        .ai-markdown-content table {
          border-collapse: collapse;
          margin: 0.5em 0;
          width: 100%;
        }
        .ai-markdown-content th, .ai-markdown-content td {
          border: 1px solid rgba(255,255,255,0.2);
          padding: 0.3em 0.5em;
          text-align: left;
        }
        .ai-markdown-content th {
          background: rgba(255,255,255,0.1);
        }
      `}</style>
      {/* Bottom Panel Button - Always visible */}
      <div
        className="bottom-panel"
        onClick={handleToggle}
      >
        <Bot size={20} className="bottom-panel-icon" />
        <span className="bottom-panel-title">AI Assistant</span>
        {isGenerating && (
          <span className="bottom-panel-btn" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <Loader size={10} className="animate-spin" />
            Thinking...
          </span>
        )}
      </div>

      {/* Dialog - rendered via portal when expanded */}
      {(!isCollapsed || isClosing) && createPortal(
        <div
          className={`dialog-overlay overlay-animated ${isClosing ? 'closing' : 'open'}`}
          onClick={handleClose}
        >
          {/* Dialog */}
          <div className={`dialog dialog-animated ${isClosing ? 'closing' : 'open'}`} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-layout" style={{ flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-4)',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bot size={24} style={{ color: 'white' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'white', fontSize: '16px', fontWeight: 600 }}>AI Assistant</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
                    {isGenerating ? 'Message Generation' :
                     editingMessage ? 'Messages' :
                     moduleContext?.module === 'creative-library' ? 'Creative Library' :
                     moduleContext?.module === 'assets' ? 'Assets' :
                     moduleContext?.module === 'monitoring' ? 'Monitoring' :
                     moduleContext?.module === 'templates' ? 'Templates' :
                     moduleContext?.module === 'users' ? 'Users' :
                     moduleContext?.module === 'settings' ? 'Settings' :
                     taskContext ? 'Tasks' : 'Matrix'}
                  </span>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '2px' }}>
                <button
                  onClick={() => setActiveTab('chat')}
                  style={{
                    padding: '8px 16px',
                    background: activeTab === 'chat' ? 'rgba(255,255,255,0.2)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: activeTab === 'chat' ? 'white' : 'rgba(255,255,255,0.7)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab('context')}
                  style={{
                    padding: '8px 16px',
                    background: activeTab === 'context' ? 'rgba(255,255,255,0.2)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: activeTab === 'context' ? 'white' : 'rgba(255,255,255,0.7)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Context
                </button>
              </div>
            </div>

            {/* Model Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div ref={modelDropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    color: 'white',
                    fontSize: '13px',
                    cursor: 'pointer',
                    minWidth: '160px',
                    justifyContent: 'space-between'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{getCurrentProviderInfo().provider.icon}</span>
                    <span>{getCurrentProviderInfo().model.name}</span>
                  </span>
                  <ChevronDown size={14} style={{
                    opacity: 0.7,
                    transform: showModelDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }} />
                </button>

                {/* Model Dropdown Menu */}
                {showModelDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      right: 0,
                      minWidth: '200px',
                      background: 'var(--color-primary)',
                      borderRadius: '8px',
                      boxShadow: 'var(--ui-shadow)',
                      zIndex: 1000,
                      overflow: 'hidden'
                    }}>
                    {/* Flat model list */}
                    <div style={{ padding: '4px 0' }}>
                      {allModels.map((model) => {
                        const isSelected = selectedModel === model.id;
                        return (
                          <div
                            key={model.id}
                            onClick={() => handleSelectModel(model.provider, model.id)}
                            style={{
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(255,255,255,0.1)' : 'transparent',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? 'rgba(255,255,255,0.1)' : 'transparent'}
                          >
                            <div style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '3px',
                              border: '1px solid rgba(255,255,255,0.3)',
                              background: isSelected ? 'white' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {isSelected && <Check size={12} style={{ color: 'var(--color-primary)' }} />}
                            </div>
                            <span style={{ color: 'white', fontSize: '13px' }}>{model.name}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Temperature slider */}
                    <div style={{
                      borderTop: '1px solid rgba(255,255,255,0.2)',
                      padding: '12px',
                      background: 'rgba(0,0,0,0.15)'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px'
                      }}>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Temperature
                        </span>
                        <span style={{ fontSize: '12px', color: 'white', fontWeight: 500 }}>
                          {temperature.toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '100%',
                          height: '4px',
                          borderRadius: '2px',
                          background: `linear-gradient(to right, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.8) ${temperature * 50}%, rgba(255,255,255,0.2) ${temperature * 50}%, rgba(255,255,255,0.2) 100%)`,
                          appearance: 'none',
                          cursor: 'pointer'
                        }}
                      />
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '4px',
                        fontSize: '10px',
                        color: 'rgba(255,255,255,0.4)'
                      }}>
                        <span>Precise</span>
                        <span>Creative</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={clearChat}
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: 'pointer'
                }}
                title="New chat"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={handleClose}
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: 'pointer'
                }}
                title="Collapse"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          </div>

          {/* Config Panel */}
          {showConfig && (
            <div style={{
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'white' }}>
                  AI Assistant API Key
                </label>
                {import.meta.env.VITE_ANTHROPIC_API_KEY ? (
                  <div style={{
                    padding: '8px 12px',
                    background: 'rgba(52, 168, 83, 0.2)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.9)'
                  }}>
                    ✓ API key configured in .env file
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-ant-..."
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          background: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '6px',
                          color: 'white',
                          fontSize: '13px'
                        }}
                      />
                      <button
                        onClick={saveApiKey}
                        className="btn btn-primary"
                      >
                        Save
                      </button>
                      {isConfigured && (
                        <button
                          onClick={removeApiKey}
                          className="btn btn-danger"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                      Your API key is stored locally in your browser. Get your key from{' '}
                      <a
                        href="https://console.anthropic.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'rgba(255,255,255,0.8)' }}
                      >
                        console.anthropic.com
                      </a>
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Chat Tab Content */}
          {activeTab === 'chat' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', marginTop: '32px' }}>
                  <Bot size={48} style={{ margin: '0 auto 16px', color: 'rgba(255,255,255,0.3)' }} />
                  {(() => {
                    const moduleHints = getModuleHints();
                    if (moduleHints) {
                      return (
                        <>
                          <p style={{ fontSize: '14px', fontWeight: 500, color: 'white' }}>
                            {moduleHints.title}
                          </p>
                          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '8px' }}>
                            {moduleHints.description}
                          </p>
                          <div style={{
                            marginTop: '16px',
                            padding: '12px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            textAlign: 'left'
                          }}>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: 'white', marginBottom: '8px' }}>Try asking:</p>
                            <ul style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', listStyle: 'disc', paddingLeft: '20px' }}>
                              {moduleHints.examples.map((example, idx) => (
                                <li key={idx} style={{ marginBottom: '4px' }}>{example}</li>
                              ))}
                            </ul>
                          </div>
                        </>
                      );
                    } else if (taskContext) {
                      return (
                        <>
                          <p style={{ fontSize: '14px', fontWeight: 500, color: 'white' }}>
                            Ask AI to help manage and organize your tasks.
                          </p>
                          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '8px' }}>
                            AI can see your current tasks and help with workflow management.
                          </p>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <p style={{ fontSize: '14px', fontWeight: 500, color: 'white' }}>
                            Ask AI to help improve your messaging matrix content.
                          </p>
                          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '8px' }}>
                            AI can see your current audiences, topics, and messages.
                          </p>
                        </>
                      );
                    }
                  })()}
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : msg.role === 'system' ? 'center' : 'flex-start'
                  }}
                >
                  <div style={{
                    maxWidth: msg.role === 'system' ? '100%' : '80%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: msg.role === 'user' ? 'rgba(255,255,255,0.2)' : msg.role === 'system' ? 'rgba(52,168,83,0.2)' : 'rgba(0,0,0,0.2)',
                    color: 'white',
                    fontSize: '13px',
                    position: 'relative'
                  }}>
                    {/* Markdown toggle for assistant messages */}
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => setRenderMarkdown(!renderMarkdown)}
                        title={renderMarkdown ? 'Show raw text' : 'Show formatted'}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: 'rgba(255,255,255,0.1)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0.6,
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.opacity = 1}
                        onMouseLeave={(e) => e.target.style.opacity = 0.6}
                      >
                        {renderMarkdown ? <Code size={14} color="white" /> : <FileText size={14} color="white" />}
                      </button>
                    )}
                    {typeof msg.content === 'string' ? (
                      msg.role === 'assistant' && renderMarkdown ? (
                        <div
                          className="ai-markdown-content"
                          style={{ paddingRight: '24px' }}
                          dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }}
                        />
                      ) : (
                        <p style={{ whiteSpace: 'pre-wrap', margin: 0, paddingRight: msg.role === 'assistant' ? '24px' : 0 }}>{msg.content}</p>
                      )
                    ) : (
                      <div>
                        {msg.content.find(c => c.type === 'text') && (
                          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                            {msg.content.find(c => c.type === 'text').text}
                          </p>
                        )}
                        {msg.images && msg.images.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                            {msg.images.map((image, imgIdx) => (
                              <img
                                key={imgIdx}
                                src={`data:${image.mimeType};base64,${image.data}`}
                                alt={image.name}
                                style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)' }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming message display */}
              {isStreaming && streamingContent && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0,0,0,0.2)',
                    color: 'white',
                    fontSize: '13px',
                    position: 'relative'
                  }}>
                    <button
                      onClick={() => setRenderMarkdown(!renderMarkdown)}
                      title={renderMarkdown ? 'Show raw text' : 'Show formatted'}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.6
                      }}
                    >
                      {renderMarkdown ? <Code size={14} color="white" /> : <FileText size={14} color="white" />}
                    </button>
                    {renderMarkdown ? (
                      <div
                        className="ai-markdown-content"
                        style={{ paddingRight: '24px' }}
                        dangerouslySetInnerHTML={{ __html: marked.parse(streamingContent) }}
                      />
                    ) : (
                      <p style={{ whiteSpace: 'pre-wrap', margin: 0, paddingRight: '24px' }}>{streamingContent}</p>
                    )}
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '16px',
                      background: 'white',
                      marginLeft: '2px',
                      animation: 'blink 1s infinite'
                    }} />
                  </div>
                </div>
              )}

              {/* Loading indicator (only shown before streaming starts) */}
              {isLoading && !isStreaming && !streamingContent && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                    <Loader size={16} className="animate-spin" style={{ color: 'white' }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Context Tab Content */}
          {activeTab === 'context' && (() => {
            // Get counts for data items
            const data = matrixData || matrixState || {};
            const audiences = data.audiences || [];
            const topics = data.topics || [];
            const messages = (data.messages || []).filter(m => m.status !== 'deleted');
            const keywords = data.keywords || {};
            const assets = data.assets || [];
            const creatives = data.creatives || [];
            const textFormatting = data.textFormatting || [];

            // Scrollbar styles
            const scrollbarStyles = {
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.3) transparent'
            };

            return (
            <div style={{ flex: 1, overflow: 'hidden', padding: 'var(--space-4)', display: 'flex', gap: '16px' }}>
              {/* Context Parts Checkboxes - Left Side */}
              <div style={{
                width: '240px',
                flexShrink: 0,
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'white', marginBottom: '16px', flexShrink: 0 }}>Context Parts</h3>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  overflow: 'auto',
                  flex: 1,
                  marginRight: '-8px',
                  paddingRight: '8px',
                  ...scrollbarStyles
                }}>
                  {[
                    { key: 'clientContext', label: 'Client Context', description: 'Client-specific instructions', anchor: '# CLIENT' },
                    { key: 'moduleInstructions', label: 'Module Instructions', description: 'AI behavior instructions', anchor: 'IMPORTANT' },
                    { key: 'dataStructure', label: 'Data Structure', description: 'Schema documentation', anchor: '# Data Structure' },
                    { key: 'audiences', label: 'Audiences', description: 'All audience data', count: audiences.length, anchor: '### ALL AUDIENCES' },
                    { key: 'topics', label: 'Topics', description: 'All topic data', count: topics.length, anchor: '### ALL TOPICS' },
                    { key: 'messages', label: 'Messages', description: 'All message data', count: messages.length, anchor: '### ALL MESSAGES' },
                    { key: 'messagesByAudience', label: 'By Audience', description: 'Grouped by audience', indent: true, anchor: '### MESSAGES GROUPED BY AUDIENCE' },
                    { key: 'messagesByTopic', label: 'By Topic', description: 'Grouped by topic', indent: true, anchor: '### MESSAGES GROUPED BY TOPIC' },
                    { key: 'keywords', label: 'Keywords', description: 'Keyword categories', count: Object.keys(keywords).length, anchor: '### ALL KEYWORDS' },
                    { key: 'assets', label: 'Assets', description: 'Asset library data', count: assets.length, anchor: '### ALL ASSETS' },
                    { key: 'creatives', label: 'Creatives', description: 'Creative library data', count: creatives.length, anchor: '### ALL CREATIVES' },
                    { key: 'textFormatting', label: 'Text Formatting', description: 'Formatting rules', count: textFormatting.length, anchor: '### ALL TEXT FORMATTING' }
                  ].map(({ key, label, description, indent, count, anchor }) => (
                    <label
                      key={key}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '8px 10px',
                        paddingLeft: indent ? '24px' : '10px',
                        background: contextParts[key] ? 'rgba(255,255,255,0.1)' : 'transparent',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        borderLeft: indent ? '2px solid rgba(255,255,255,0.2)' : 'none',
                        marginLeft: indent ? '10px' : '0'
                      }}
                      onMouseEnter={(e) => {
                        if (!contextParts[key]) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      }}
                      onMouseLeave={(e) => {
                        if (!contextParts[key]) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={contextParts[key]}
                        onChange={() => toggleContextPart(key)}
                        style={{
                          width: '16px',
                          height: '16px',
                          marginTop: '2px',
                          accentColor: '#3b82f6',
                          cursor: 'pointer'
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', color: 'white', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {label}
                          {count !== undefined && (
                            <span style={{
                              fontSize: '11px',
                              padding: '1px 6px',
                              background: 'rgba(255,255,255,0.15)',
                              borderRadius: '10px',
                              color: 'rgba(255,255,255,0.8)'
                            }}>
                              {count}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{description}</div>
                      </div>
                      {contextParts[key] && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const preEl = document.getElementById('context-preview-pre');
                            if (preEl && anchor) {
                              // Use Range API to find text position
                              const textNode = preEl.firstChild;
                              if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                                const text = textNode.textContent || '';
                                const anchorIndex = text.indexOf(anchor);
                                if (anchorIndex !== -1) {
                                  // Create a range to the anchor position
                                  const range = document.createRange();
                                  range.setStart(textNode, anchorIndex);
                                  range.setEnd(textNode, anchorIndex + anchor.length);

                                  // Get the bounding rect of the range
                                  const rect = range.getBoundingClientRect();
                                  const preRect = preEl.getBoundingClientRect();

                                  // Calculate scroll position relative to the pre element
                                  const scrollOffset = rect.top - preRect.top + preEl.scrollTop - 50;
                                  preEl.scrollTop = Math.max(0, scrollOffset);
                                }
                              }
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '4px',
                            cursor: 'pointer',
                            color: 'rgba(255,255,255,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            marginTop: '2px',
                            transition: 'color 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                          title={`Jump to ${label}`}
                        >
                          <ChevronRight size={14} />
                        </button>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Context Preview - Right Side */}
              {(() => {
                const contextText = buildContextPrompt();
                const charCount = contextText.length;
                // Estimate tokens: ~3.5 chars per token (JSON/code is denser than prose)
                const estimatedTokens = Math.ceil(charCount / 3.5);
                return (
                  <div style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '8px',
                    padding: '16px',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'white', margin: 0 }}>Context Preview</h3>
                      <div style={{
                        display: 'flex',
                        gap: '12px',
                        fontSize: '12px',
                        color: 'rgba(255,255,255,0.6)',
                        background: 'rgba(0,0,0,0.2)',
                        padding: '4px 10px',
                        borderRadius: '4px'
                      }}>
                        <span><strong style={{ color: 'rgba(255,255,255,0.9)' }}>{charCount.toLocaleString()}</strong> chars</span>
                        <span>~<strong style={{ color: 'rgba(255,255,255,0.9)' }}>{estimatedTokens.toLocaleString()}</strong> tokens</span>
                      </div>
                    </div>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>
                      This is the context that will be sent with your next message to the AI assistant.
                    </p>
                    <pre
                      id="context-preview-pre"
                      style={{
                        flex: 1,
                        fontSize: '11px',
                        lineHeight: '16px',
                        fontFamily: 'monospace',
                        background: 'rgba(0,0,0,0.2)',
                        padding: '16px',
                        borderRadius: '6px',
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        color: 'rgba(255,255,255,0.9)',
                        margin: 0,
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'rgba(255,255,255,0.3) transparent'
                      }}
                    >
                      {contextText}
                    </pre>
                  </div>
                );
              })()}
            </div>
            );
          })()}

          {/* Input */}
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            borderTop: '1px solid rgba(255,255,255,0.1)'
          }}>
            {!isConfigured ? (
              <div style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                Please configure your API key to start chatting
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Image Previews */}
                {attachedImages.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    padding: '8px',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '6px'
                  }}>
                    {attachedImages.map((image, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <img
                          src={`data:${image.mimeType};base64,${image.data}`}
                          alt={image.name}
                          style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px' }}
                        />
                        <button
                          onClick={() => removeImage(idx)}
                          style={{
                            position: 'absolute',
                            top: '-4px',
                            right: '-4px',
                            width: '16px',
                            height: '16px',
                            background: '#ef4444',
                            border: 'none',
                            borderRadius: '50%',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input Row */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Image Upload Button */}
                  <input
                    type="file"
                    id="image-upload"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="image-upload"
                    style={{
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '6px',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                    title="Attach images"
                  >
                    <ImageIcon size={18} />
                  </label>

                  {/* Attach Filtered Items Button */}
                  {filteredItems && filteredItems.length > 0 && (
                    <button
                      onClick={handleAttachFilteredItems}
                      disabled={isAttachingFiltered || isLoading}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        opacity: isAttachingFiltered || isLoading ? 0.5 : 1
                      }}
                      title={`Attach ${Math.min(filteredItems.length, 10)} filtered items`}
                    >
                      {isAttachingFiltered ? (
                        <><Loader size={14} className="animate-spin" /> Attaching...</>
                      ) : (
                        <><Paperclip size={14} /> Attach {Math.min(filteredItems.length, 10)}</>
                      )}
                    </button>
                  )}

                  {/* Text Input */}
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={taskContext ? "Ask AI for task management help..." : "Ask AI for suggestions..."}
                    disabled={isLoading}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '14px',
                      opacity: isLoading ? 0.5 : 1
                    }}
                  />

                  {/* Send Button */}
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || (!input.trim() && attachedImages.length === 0)}
                    className="btn btn-primary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: isLoading || (!input.trim() && attachedImages.length === 0) ? 0.5 : 1
                    }}
                  >
                    <Send size={16} />
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
        </div>,
        document.body
      )}
    </>
  );
});

AIAssistant.displayName = 'AIAssistant';

export default AIAssistant;

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { MessageSquare, Send, Loader, RefreshCw, ChevronDown, ChevronUp, GripHorizontal, Image as ImageIcon, X, Paperclip } from 'lucide-react';
import { callClaudeAPI } from '../api/claude-proxy';

const AIAssistant = forwardRef(({ matrixState, onAddAudience, onAddTopic, onAddMessage, onDeleteAudience, onDeleteTopic, taskContext, onTaskAction, moduleContext, matrixData, filteredItems, getItemUrl }, ref) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [attachedImages, setAttachedImages] = useState([]);
  const [isAttachingFiltered, setIsAttachingFiltered] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed
  const [pendingSuggestions, setPendingSuggestions] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customPrompts, setCustomPrompts] = useState({});
  const [promptsLoaded, setPromptsLoaded] = useState(false);
  const [dataStructureDoc, setDataStructureDoc] = useState('');
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'context'
  const [height, setHeight] = useState(() => {
    const saved = localStorage.getItem('ai_assistant_height');
    return saved ? parseInt(saved) : window.innerHeight * 0.6; // Default 60% of viewport height
  });
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef(null);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

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
        const response = await fetch('/api/ai-prompts');
        if (response.ok) {
          const prompts = await response.json();
          setCustomPrompts(prompts);
          console.log('🤖 AI Assistant - Loaded custom prompts from backend:', prompts);
        } else {
          console.error('Failed to load prompts, status:', response.status);
        }
      } catch (error) {
        console.error('Error loading custom prompts:', error);
      }
    };

    const loadDataStructure = async () => {
      try {
        const response = await fetch('/api/ai-data-structure');
        if (response.ok) {
          const { content } = await response.json();
          setDataStructureDoc(content);
          console.log('🤖 AI Assistant - Loaded data structure documentation from backend');
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

If an email doesn't contain actionable tasks, you can skip it or note it as informational.`;

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

      try {
        // Call Claude API with higher max_tokens for long email threads
        const data = await callClaudeAPI(apiKey, [userMessage], 'claude-sonnet-4-5-20250929', 16384);
        const responseText = data.content[0].text;

        // Add assistant response to chat
        const assistantMessage = {
          role: 'assistant',
          content: responseText
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Check if response was truncated
        if (data.stop_reason === 'max_tokens') {
          const warningMessage = {
            role: 'system',
            content: '⚠️ Warning: Response was truncated due to length. The task extraction may be incomplete. Consider processing fewer emails at once.'
          };
          setMessages(prev => [...prev, warningMessage]);
        }

        // Extract JSON from the response - try multiple patterns
        let jsonMatch = responseText.match(/```json\s*\n([\s\S]*?)\n```/);
        if (!jsonMatch) {
          // Try without newlines
          jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/);
        }
        if (!jsonMatch) {
          // Try to find JSON array directly
          jsonMatch = responseText.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            jsonMatch = [null, jsonMatch[0]]; // Format to match other patterns
          }
        }

        if (jsonMatch) {
          const jsonText = jsonMatch[1] || jsonMatch[0];
          try {
            const tasks = JSON.parse(jsonText.trim());

            // Add email content and IDs to tasks
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

            // Automatically create tasks
            if (onTasksCreated) {
              onTasksCreated(enrichedTasks);
            }

            // Show success message
            const successMessage = {
              role: 'system',
              content: `✅ Extracted and created ${enrichedTasks.length} task(s) from ${emails.length} email(s)!`
            };
            setMessages(prev => [...prev, successMessage]);
          } catch (parseError) {
            console.error('Error parsing tasks JSON:', parseError);
            console.error('Attempted to parse:', jsonText);
            console.error('Full response:', responseText);
            const errorMessage = {
              role: 'system',
              content: `❌ Failed to parse tasks from response. Parse error: ${parseError.message}\n\nCheck browser console for details.`
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
      } catch (error) {
        console.error('Error processing emails:', error);
        const errorMessage = {
          role: 'assistant',
          content: `Error: ${error.message}`
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
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

      // Build the generation prompt
      const generationPrompt = `Generate marketing message content for the following context:

**Audience:**
- Name: ${contextData.audience.name}
- Strategy: ${contextData.audience.strategy || 'N/A'}
- Device: ${contextData.audience.device || 'N/A'}
- Targeting: ${contextData.audience.targeting_type || 'N/A'}
- Comment: ${contextData.audience.comment || 'N/A'}

**Topic:**
- Name: ${contextData.topic.name}
- Tags: ${[contextData.topic.tag1, contextData.topic.tag2, contextData.topic.tag3, contextData.topic.tag4].filter(Boolean).join(', ') || 'N/A'}
- Comment: ${contextData.topic.comment || 'N/A'}

**Current Message Content (if any):**
- Name: ${contextData.currentMessage.name || 'N/A'}
- Headline: ${contextData.currentMessage.headline || 'N/A'}
- Copy 1: ${contextData.currentMessage.copy1 || 'N/A'}
- Copy 2: ${contextData.currentMessage.copy2 || 'N/A'}
- Flash: ${contextData.currentMessage.flash || 'N/A'}
- CTA: ${contextData.currentMessage.cta || 'N/A'}
${examplesSection}
**IMPORTANT INSTRUCTIONS:**
- Study the examples above carefully to match the writing style, tone, and text length
- Use similar language patterns and vocabulary
- Match the level of formality/informality
- Keep text lengths similar to the examples
- Maintain consistency with the brand voice shown in examples
- Use placeholders like {{placeholder}} for dynamic content if you see this pattern in examples

Please generate compelling marketing message content. Respond ONLY with a JSON object in this exact format:

\`\`\`json
{
  "headline": "Your generated headline here",
  "copy1": "Your generated first copy text here",
  "copy2": "Your generated second copy text here",
  "flash": "Your generated flash text here",
  "cta": "Your generated call-to-action here"
}
\`\`\`

Make sure the content is:
- Relevant to the audience and topic
- Matching the style, tone, and length of the examples provided
- Engaging and action-oriented
- Appropriate for the specified device and platform
- Using placeholders where the examples use them`;

      // Add user message to chat
      const userMessage = {
        role: 'user',
        content: generationPrompt
      };

      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);

      try {
        // Call Claude API
        const data = await callClaudeAPI(apiKey, [userMessage], 'claude-3-5-sonnet-20241022', 2048);
        const responseText = data.content[0].text;

        // Add assistant response to chat
        const assistantMessage = {
          role: 'assistant',
          content: responseText
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Extract JSON from the response - try multiple patterns
        let jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
        if (!jsonMatch) {
          // Try without newlines
          jsonMatch = responseText.match(/```json([\s\S]*?)```/);
        }
        if (!jsonMatch) {
          // Try to find JSON object directly
          jsonMatch = responseText.match(/\{[\s\S]*?"headline"[\s\S]*?\}/);
          if (jsonMatch) {
            jsonMatch = [null, jsonMatch[0]]; // Format to match other patterns
          }
        }

        if (jsonMatch) {
          try {
            const jsonText = jsonMatch[1].trim();
            const generatedContent = JSON.parse(jsonText);

            // Validate that we have at least some content
            if (generatedContent.headline || generatedContent.copy1 || generatedContent.cta) {
              // Add success message
              const successMessage = {
                role: 'system',
                content: '✅ Content generated and applied to the message editor!'
              };
              setMessages(prev => [...prev, successMessage]);

              // Call the callback with the generated content
              callback(generatedContent);
            } else {
              const errorMessage = {
                role: 'system',
                content: '❌ Generated content is empty. Please try again.'
              };
              setMessages(prev => [...prev, errorMessage]);
            }
          } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
            console.log('Failed to parse:', jsonMatch[1]);
            const errorMessage = {
              role: 'system',
              content: '❌ Failed to parse generated content. Please try again.'
            };
            setMessages(prev => [...prev, errorMessage]);
          }
        } else {
          console.log('No JSON found in response:', responseText);
          const errorMessage = {
            role: 'system',
            content: '❌ Response did not contain expected JSON format. Please review the response above and try again.'
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      } catch (error) {
        console.error('Error generating content:', error);
        const errorMessage = {
          role: 'assistant',
          content: `Error: ${error.message}`
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
        setIsGenerating(false);
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

  // Log context when component mounts or module changes
  useEffect(() => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🤖 AI ASSISTANT LOADED');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📍 Module:', moduleContext?.module || 'matrix');
    console.log('📍 Task Context:', !!taskContext);
    console.log('');
    console.log('🔄 Building initial context...');
    const initialContext = buildContextPrompt();
    console.log('');
    console.log('✅ Context built and ready');
    console.log('═══════════════════════════════════════════════════════');
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

    // If we have the data structure documentation loaded, use it and append ALL data
    if (dataStructureDoc) {
      const activeMessages = messages.filter(m => m.status !== 'deleted');

      return `
${dataStructureDoc}

**Current Data Counts:**
- Audiences: ${audiences.length}
- Topics: ${topics.length}
- Messages: ${activeMessages.length}
- Matrix cells: ${audiences.length} × ${topics.length} = ${audiences.length * topics.length} possible cells
- Keywords: ${Object.keys(keywords).length} categories
- Assets: ${assets.length}
- Creatives: ${creatives.length}
- Text Formatting Styles: ${textFormatting.length}

---

## COMPLETE CURRENT DATA (Full Dataset):

### ALL AUDIENCES (${audiences.length} total):
${audiences.length > 0 ? JSON.stringify(audiences, null, 2) : 'No audiences defined'}

### ALL TOPICS (${topics.length} total):
${topics.length > 0 ? JSON.stringify(topics, null, 2) : 'No topics defined'}

### ALL MESSAGES (${activeMessages.length} active):
${activeMessages.length > 0 ? JSON.stringify(activeMessages, null, 2) : 'No messages defined'}

### ALL KEYWORDS:
${Object.keys(keywords).length > 0 ? JSON.stringify(keywords, null, 2) : 'No keywords defined'}

### ALL ASSETS (${assets.length} total):
${assets.length > 0 ? JSON.stringify(assets, null, 2) : 'No assets'}

### ALL CREATIVES (${creatives.length} total):
${creatives.length > 0 ? JSON.stringify(creatives, null, 2) : 'No creatives'}

### ALL TEXT FORMATTING (${textFormatting.length} styles):
${textFormatting.length > 0 ? JSON.stringify(textFormatting, null, 2) : 'No text formatting styles defined'}
`;
    }

    // Fallback if data structure file not loaded (shouldn't happen)
    return '';
  };

  const buildContextPrompt = () => {
    const appStateContext = buildAppStateContext();

    // Get client context (added to ALL modules)
    const clientContext = customPrompts['client-context'] || '';
    const clientContextSection = clientContext ? `${clientContext}\n\n---\n\n` : '';

    console.log('🤖 AI Assistant Context Builder - Custom Prompts:', customPrompts);
    console.log('🤖 Prompts Loaded:', promptsLoaded);
    console.log('🏢 Client Context Length:', clientContext.length, 'characters');

    // Module-specific contexts (creative-library, assets, monitoring, templates, users, settings)
    if (moduleContext) {
      const module = moduleContext.module;

      // Use prompt from file (loaded from backend on component mount)
      if (customPrompts[module] && customPrompts[module].trim() !== '') {
        const context = `${clientContextSection}${customPrompts[module]}
${appStateContext}`;

        console.log('🤖 AI Assistant - Final Context Prompt:', context);
        console.log('📊 Context Length:', context.length, 'characters');
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

      // Use prompt from file
      if (customPrompts.tasks && customPrompts.tasks.trim() !== '') {
        const context = `${clientContextSection}${taskStateJSON}

${customPrompts.tasks}`;

        console.log('🤖 AI Assistant - Final Context Prompt:', context);
        console.log('📊 Context Length:', context.length, 'characters');
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

    const { audiences = [], topics = [], messages: matrixMessages = [], keywords = {}, assets = [], creatives = [], textFormatting = [] } = data;
    const activeMessages = matrixMessages.filter(m => m.status !== 'deleted');

    // Build complete matrix context: Client Context -> Instructions -> README -> Data
    const matrixContextFull = `${clientContextSection}${customPrompts.matrix || ''}

---

# APPLICATION CONTEXT

${dataStructureDoc}

---

## MESSAGING MATRIX SNAPSHOT:

**Dimensions:**
- Audiences: ${audiences.length}
- Topics: ${topics.length}
- Active Messages: ${activeMessages.length}
- Matrix Coverage: ${activeMessages.length} / ${audiences.length * topics.length} cells filled (${audiences.length * topics.length > 0 ? Math.round((activeMessages.length / (audiences.length * topics.length)) * 100) : 0}%)
- Keywords: ${Object.keys(keywords).length} categories
- Assets: ${assets.length}
- Creatives: ${creatives.length}
- Text Formatting Styles: ${textFormatting.length}

---

## COMPLETE CURRENT DATA (Full Dataset):

### ALL AUDIENCES (${audiences.length} total):
${audiences.length > 0 ? JSON.stringify(audiences, null, 2) : 'No audiences defined'}

### ALL TOPICS (${topics.length} total):
${topics.length > 0 ? JSON.stringify(topics, null, 2) : 'No topics defined'}

### ALL MESSAGES (${activeMessages.length} active):
${activeMessages.length > 0 ? JSON.stringify(activeMessages, null, 2) : 'No messages defined'}

### ALL KEYWORDS (${Object.keys(keywords).length} categories):
${Object.keys(keywords).length > 0 ? JSON.stringify(keywords, null, 2) : 'No keywords defined'}

### ALL ASSETS (${assets.length} total):
${assets.length > 0 ? JSON.stringify(assets, null, 2) : 'No assets defined'}

### ALL CREATIVES (${creatives.length} total):
${creatives.length > 0 ? JSON.stringify(creatives, null, 2) : 'No creatives defined'}

### ALL TEXT FORMATTING (${textFormatting.length} styles):
${textFormatting.length > 0 ? JSON.stringify(textFormatting, null, 2) : 'No text formatting styles defined'}`;

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

    console.log('🤖 AI Assistant - Final Context Prompt:', matrixContextFull);
    console.log('📊 Context Length:', matrixContextFull.length, 'characters');
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

    console.log('📤 User Message:', {
      role: userMessage.role,
      contentType: typeof userMessage.content,
      isMultiModal: Array.isArray(userMessage.content),
      hasImages: attachedImages.length > 0,
      imageCount: attachedImages.length,
      textPreview: typeof userMessage.content === 'string'
        ? userMessage.content.substring(0, 100)
        : userMessage.content[0]?.text?.substring(0, 100)
    });

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachedImages([]);
    setIsLoading(true);

    try {
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

      console.log('═══════════════════════════════════════════════════════');
      console.log('🚀 SENDING TO CLAUDE API');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📋 Request Details:');
      console.log('  Model:', 'claude-3-5-sonnet-20241022');
      console.log('  Max Tokens:', 4096);
      console.log('  Message Count:', apiMessages.length);
      console.log('  Previous Conversation Messages:', messages.filter(m => m.role !== 'system').length);
      console.log('');
      console.log('📝 All Messages Being Sent:');
      apiMessages.forEach((msg, idx) => {
        const contentPreview = typeof msg.content === 'string'
          ? msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : '')
          : `[Multi-modal: ${msg.content.length} parts]`;
        console.log(`  [${idx}] ${msg.role}:`, contentPreview);
        if (Array.isArray(msg.content)) {
          msg.content.forEach((part, partIdx) => {
            if (part.type === 'text') {
              console.log(`      [${partIdx}] text:`, part.text.substring(0, 100));
            } else if (part.type === 'image') {
              console.log(`      [${partIdx}] image:`, part.source.media_type, `(${part.source.data.length} chars base64)`);
            }
          });
        }
      });
      console.log('');
      console.log('📊 Payload Size Estimate:');
      const payloadSize = JSON.stringify(apiMessages).length;
      console.log(`  ${(payloadSize / 1024).toFixed(2)} KB (${payloadSize.toLocaleString()} bytes)`);
      console.log('═══════════════════════════════════════════════════════');

      // Call Claude API directly
      const data = await callClaudeAPI(apiKey, apiMessages, 'claude-3-5-sonnet-20241022', 4096);

      console.log('✅ Claude API Response Received');
      console.log('  Response Length:', data.content[0].text.length, 'characters');

      const responseText = data.content[0].text;

      const assistantMessage = {
        role: 'assistant',
        content: responseText
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Check if user input contains "add" or "remove" keywords
      const userInput = input.trim().toLowerCase();
      const isAddCommand = userInput.includes('add');
      const isRemoveCommand = userInput.includes('remove');

      if (isAddCommand && pendingSuggestions) {
        // Execute add based on pending suggestions
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
          setPendingSuggestions(null); // Clear pending suggestions
        }
      } else if (isRemoveCommand && matrixState) {
        // Handle remove command
        const { audiences = [], topics = [] } = matrixState;
        let removed = [];

        // Try to find audience or topic by name or key
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
      const jsonSuggestionsMatch = responseText.match(/```json-suggestions\n([\s\S]*?)\n```/);
      if (jsonSuggestionsMatch) {
        try {
          const suggestions = JSON.parse(jsonSuggestionsMatch[1]);
          setPendingSuggestions(suggestions);

          // Show info message about pending suggestions
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
    } catch (error) {
      console.error('Error calling Claude API:', error);
      const errorMessage = {
        role: 'assistant',
        content: `Error: ${error.message}. Make sure your API key is valid.`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
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

  if (isCollapsed) {
    return (
      <div className="fixed bottom-0 right-0 bg-white shadow-lg rounded-tl-lg z-50">
        <button
          onClick={() => setIsCollapsed(false)}
          className="px-4 py-3 flex items-center gap-2 hover:bg-gray-50 rounded-tl-lg"
        >
          <MessageSquare size={20} className="text-purple-600" />
          <span className="font-semibold text-gray-800">AI Assistant</span>
          {isGenerating ? (
            <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded flex items-center gap-1">
              <Loader size={12} className="animate-spin" />
              Thinking...
            </span>
          ) : isConfigured ? (
            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Ready</span>
          ) : null}
          <ChevronUp size={20} className="text-gray-600" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-0 right-0 bg-white shadow-2xl flex flex-col z-50 rounded-tl-lg"
      style={{ height: `${height}px`, width: '75%' }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleResizeStart}
        className={`w-full h-2 flex items-center justify-center cursor-ns-resize hover:bg-gray-200 transition-colors ${isResizing ? 'bg-gray-300' : 'bg-gray-100'}`}
        title="Drag to resize"
      >
        <GripHorizontal size={16} className="text-gray-400" />
      </div>

      {/* Header with Tabs */}
      <div className="border-b bg-gray-50">
        <div className="px-4 pt-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <MessageSquare size={20} className="text-purple-600" />
              <span className="font-semibold text-gray-800">AI Assistant</span>
              {isConfigured && <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Ready</span>}
            </div>

            {/* Tabs inline with header */}
            <div className="flex -mb-[1px]">
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'chat'
                    ? 'bg-white border-b-2 border-purple-500 text-purple-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => setActiveTab('context')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'context'
                    ? 'bg-white border-b-2 border-purple-500 text-purple-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Context
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={clearChat}
              className="p-1 hover:bg-gray-100 rounded"
              title="New chat"
            >
              <RefreshCw size={16} className="text-gray-600" />
            </button>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 hover:bg-gray-100 rounded"
              title="Collapse"
            >
              <ChevronDown size={20} className="text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div className="border-b px-4 py-3 bg-gray-50">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              AI Assistant API Key
            </label>
            {import.meta.env.VITE_ANTHROPIC_API_KEY ? (
              <div className="px-3 py-2 bg-green-50 border border-green-300 rounded text-sm text-green-700">
                ✓ API key configured in .env file
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                  <button
                    onClick={saveApiKey}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                  >
                    Save
                  </button>
                  {isConfigured && (
                    <button
                      onClick={removeApiKey}
                      className="px-4 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Your API key is stored locally in your browser. Get your key from{' '}
                  <a
                    href="https://console.anthropic.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:underline"
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
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <MessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
            {(() => {
              const moduleHints = getModuleHints();
              if (moduleHints) {
                const colorClasses = {
                  teal: { bg: 'bg-teal-50', border: 'border-teal-200', title: 'text-teal-800', text: 'text-teal-700' },
                  orange: { bg: 'bg-orange-50', border: 'border-orange-200', title: 'text-orange-800', text: 'text-orange-700' },
                  green: { bg: 'bg-green-50', border: 'border-green-200', title: 'text-green-800', text: 'text-green-700' },
                  amber: { bg: 'bg-amber-50', border: 'border-amber-200', title: 'text-amber-800', text: 'text-amber-700' },
                  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', title: 'text-indigo-800', text: 'text-indigo-700' },
                  gray: { bg: 'bg-gray-50', border: 'border-gray-200', title: 'text-gray-800', text: 'text-gray-700' }
                };
                const colors = colorClasses[moduleHints.color] || colorClasses.gray;

                return (
                  <>
                    <p className="text-sm font-medium">
                      {moduleHints.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {moduleHints.description}
                    </p>
                    <div className={`mt-4 p-3 ${colors.bg} border ${colors.border} rounded text-left`}>
                      <p className={`text-xs font-semibold ${colors.title} mb-2`}>✨ Try asking:</p>
                      <div className={`text-xs ${colors.text} space-y-1`}>
                        <ul className="list-disc list-inside">
                          {moduleHints.examples.map((example, idx) => (
                            <li key={idx}>{example}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </>
                );
              } else if (taskContext) {
                return (
                  <>
                    <p className="text-sm font-medium">
                      Ask AI to help manage and organize your tasks.
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      AI can see your current tasks and help with workflow management.
                    </p>
                    <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded text-left">
                      <p className="text-xs font-semibold text-purple-800 mb-2">✨ AI can help you:</p>
                      <div className="text-xs text-purple-700 space-y-1">
                        <ul className="list-disc list-inside">
                          <li>"Analyze my tasks and suggest priorities"</li>
                          <li>"Which tasks should I move to Planning?"</li>
                          <li>"Help me organize tasks by urgency"</li>
                          <li>"What should I work on first?"</li>
                          <li>"Break down this task into steps"</li>
                        </ul>
                      </div>
                    </div>
                  </>
                );
              } else {
                return (
                  <>
                    <p className="text-sm font-medium">
                      Ask AI to help improve your messaging matrix content.
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      AI can see your current audiences, topics, and messages.
                    </p>
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-left">
                      <p className="text-xs font-semibold text-blue-800 mb-2">✨ AI can suggest changes to your matrix!</p>
                      <div className="text-xs text-blue-700 space-y-1">
                        <p><strong>1. Ask for suggestions:</strong> "Suggest 3 audiences for tech products"</p>
                        <p><strong>2. Review suggestions</strong> from AI</p>
                        <p><strong>3. Apply selectively:</strong></p>
                        <ul className="list-disc list-inside ml-2">
                          <li>"add all" - Add everything</li>
                          <li>"add Young Professionals" - Add specific item</li>
                          <li>"remove Students" - Remove by name or key</li>
                        </ul>
                      </div>
                    </div>
                  </>
                );
              }
            })()}
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' :
              msg.role === 'system' ? 'justify-center' :
              'justify-start'
            }`}
          >
            <div
              className={`${
                msg.role === 'system' ? 'max-w-full' : 'max-w-[80%]'
              } rounded-lg px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : msg.role === 'system'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {/* Handle text content (string or array) */}
              {typeof msg.content === 'string' ? (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="space-y-2">
                  {/* Show text part */}
                  {msg.content.find(c => c.type === 'text') && (
                    <p className="text-sm whitespace-pre-wrap">
                      {msg.content.find(c => c.type === 'text').text}
                    </p>
                  )}
                  {/* Show images if any */}
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {msg.images.map((image, imgIdx) => (
                        <img
                          key={imgIdx}
                          src={`data:${image.mimeType};base64,${image.data}`}
                          alt={image.name}
                          className="max-w-[200px] max-h-[200px] rounded border border-white/20"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <Loader size={16} className="animate-spin text-purple-600" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
        </div>
      )}

      {/* Context Tab Content */}
      {activeTab === 'context' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">AI Assistant Context</h3>
            <p className="text-xs text-gray-600 mb-4">
              This is the complete context that will be sent with your next message to the AI assistant.
            </p>
            <pre className="text-xs font-mono bg-white p-4 rounded border border-gray-300 overflow-x-auto whitespace-pre-wrap">
              {buildContextPrompt()}
            </pre>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t px-4 py-3">
        {!isConfigured ? (
          <div className="text-center text-sm text-gray-500">
            Please configure your API key to start chatting
          </div>
        ) : (
          <div className="space-y-2">
            {/* Image Previews */}
            {attachedImages.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                {attachedImages.map((image, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={`data:${image.mimeType};base64,${image.data}`}
                      alt={image.name}
                      className="w-16 h-16 object-cover rounded border border-gray-300"
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove image"
                    >
                      <X size={12} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-[10px] px-1 truncate rounded-b">
                      {image.name}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Input Row */}
            <div className="flex gap-2">
              {/* Image Upload Button */}
              <input
                type="file"
                id="image-upload"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <label
                htmlFor="image-upload"
                className="p-2 border border-gray-300 rounded hover:bg-gray-50 cursor-pointer transition-colors flex items-center justify-center"
                title="Attach images"
              >
                <ImageIcon size={20} className="text-gray-600" />
              </label>

              {/* Attach Filtered Items Button (only show in Creative Library and Assets) */}
              {filteredItems && filteredItems.length > 0 && (
                <button
                  onClick={handleAttachFilteredItems}
                  disabled={isAttachingFiltered || isLoading}
                  className="px-3 py-2 border border-purple-300 bg-purple-50 text-purple-700 rounded hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
                  title={`Attach ${Math.min(filteredItems.length, 10)} filtered items`}
                >
                  {isAttachingFiltered ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      Attaching...
                    </>
                  ) : (
                    <>
                      <Paperclip size={16} />
                      Attach {Math.min(filteredItems.length, 10)} filtered
                    </>
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
              />

              {/* Send Button */}
              <button
                onClick={sendMessage}
                disabled={isLoading || (!input.trim() && attachedImages.length === 0)}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send size={16} />
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

AIAssistant.displayName = 'AIAssistant';

export default AIAssistant;

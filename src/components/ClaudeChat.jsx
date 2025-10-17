import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { MessageSquare, Send, Loader, RefreshCw, ChevronDown, ChevronUp, GripHorizontal } from 'lucide-react';
import { callClaudeAPI } from '../api/claude-proxy';

const ClaudeChat = forwardRef(({ matrixState, onAddAudience, onAddTopic, onAddMessage, onDeleteAudience, onDeleteTopic, taskContext, onTaskAction }, ref) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed
  const [pendingSuggestions, setPendingSuggestions] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [height, setHeight] = useState(() => {
    const saved = localStorage.getItem('claude_chat_height');
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
      const savedKey = localStorage.getItem('claude_api_key');
      if (savedKey) {
        setApiKey(savedKey);
        setIsConfigured(true);
      } else {
        setShowConfig(true);
      }
    }
  }, []);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    generateMessageContent: async (contextData, callback) => {
      if (!isConfigured || isLoading) {
        alert('Claude API is not configured or busy');
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

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const deltaY = resizeStartY.current - e.clientY; // Inverted because dragging up increases height
      const newHeight = Math.max(200, Math.min(window.innerHeight * 0.9, resizeStartHeight.current + deltaY));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem('claude_chat_height', height.toString());
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
      localStorage.setItem('claude_api_key', apiKey.trim());
      setIsConfigured(true);
      setShowConfig(false);
    }
  };

  const removeApiKey = () => {
    localStorage.removeItem('claude_api_key');
    setApiKey('');
    setIsConfigured(false);
    setShowConfig(true);
  };

  const buildContextPrompt = () => {
    // Task Management Context
    if (taskContext) {
      const { tasks, emails } = taskContext;

      const context = `Current Task Management State (JSON):

${JSON.stringify({
  tasks: tasks.slice(0, 20),
  emails: emails.slice(0, 5)
}, null, 2)}

You are an AI assistant helping with task management for email-to-task conversion and workflow organization.

## Your Capabilities:

1. **Analyze Tasks**: Help prioritize, organize, and suggest improvements to existing tasks
2. **Categorize Tasks**: Suggest which bucket (Backlog, Planning, In Production, Review, Dead) tasks should be in
3. **Extract Actionable Items**: Help identify key action items from task descriptions
4. **Set Priorities**: Suggest appropriate priority levels (High, Medium, Low) based on task urgency
5. **Workflow Advice**: Provide guidance on task workflow and project management best practices

## Task Buckets:
- **Backlog**: All ideas and requests
- **Planning**: Items being scoped/briefed
- **In Production**: Active work
- **Review**: Under review or approved
- **Dead**: Discontinued tasks

## Response Guidelines:
- Focus on practical, actionable advice
- When suggesting bucket changes, explain your reasoning
- Help break down complex tasks into manageable steps
- Identify dependencies between tasks
- Suggest due dates when appropriate

Ask about specific tasks, request workflow advice, or ask for help organizing your task list.`;

      return context;
    }

    // Matrix Context (original)
    const { audiences = [], topics = [], messages: matrixMessages = [] } = matrixState || {};

    const context = `Current Messaging Matrix State (JSON):

${JSON.stringify({ audiences, topics, messages: matrixMessages.filter(m => m.status !== 'deleted').slice(0, 10) }, null, 2)}

You are an AI assistant helping to improve messaging content for a marketing messaging matrix.

**IMPORTANT**: You can suggest changes to the matrix, but they will ONLY be applied when the user explicitly says "add" or "remove".

## Suggestion Format:

When suggesting items, use this format:

\`\`\`json-suggestions
{
  "suggestAudiences": [
    {"name": "Audience Name"}
  ],
  "suggestTopics": [
    {"name": "Topic Name"}
  ]
}
\`\`\`

Example response:
"Based on your current matrix, here are 3 audience suggestions:

\`\`\`json-suggestions
{
  "suggestAudiences": [
    {"name": "Young Professionals"},
    {"name": "Students"},
    {"name": "Retirees"}
  ]
}
\`\`\`

These audiences would help you target different age demographics effectively."

The user can then say "add Young Professionals and Students" or "add all" to apply the suggestions.

## When User Says "Add" or "Remove":

- Detect which items the user want to add/remove
- For "add all", add all pending suggestions
- For "add [name]", add only the specified item
- For "remove [name or key]", find and mark the item for removal
- ONLY provide json-suggestions blocks when suggesting. Do NOT provide them when user says add/remove.`;

    return context;
  };

  const sendMessage = async () => {
    if (!input.trim() || !isConfigured || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build context from matrix state
      const contextPrompt = buildContextPrompt();

      // Prepare messages for API
      const apiMessages = [
        {
          role: 'user',
          content: contextPrompt
        },
        ...messages.filter(m => m.role !== 'system'),
        userMessage
      ];

      // Call Claude API directly
      const data = await callClaudeAPI(apiKey, apiMessages, 'claude-3-5-sonnet-20241022', 4096);

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
  };

  if (isCollapsed) {
    return (
      <div className="fixed bottom-0 right-0 bg-white shadow-lg rounded-tl-lg z-50">
        <button
          onClick={() => setIsCollapsed(false)}
          className="px-4 py-3 flex items-center gap-2 hover:bg-gray-50 rounded-tl-lg"
        >
          <MessageSquare size={20} className="text-purple-600" />
          <span className="font-semibold text-gray-800">Claude AI Assistant</span>
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

      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className="text-purple-600" />
          <span className="font-semibold text-gray-800">Claude AI Assistant</span>
          {isConfigured && <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Ready</span>}
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

      {/* Config Panel */}
      {showConfig && (
        <div className="border-b px-4 py-3 bg-gray-50">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Claude API Key
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <MessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
            {taskContext ? (
              <>
                <p className="text-sm font-medium">
                  Ask Claude to help manage and organize your tasks.
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Claude can see your current tasks and help with workflow management.
                </p>
                <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded text-left">
                  <p className="text-xs font-semibold text-purple-800 mb-2">✨ Claude can help you:</p>
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
            ) : (
              <>
                <p className="text-sm font-medium">
                  Ask Claude to help improve your messaging matrix content.
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Claude can see your current audiences, topics, and messages.
                </p>
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-left">
                  <p className="text-xs font-semibold text-blue-800 mb-2">✨ Claude can suggest changes to your matrix!</p>
                  <div className="text-xs text-blue-700 space-y-1">
                    <p><strong>1. Ask for suggestions:</strong> "Suggest 3 audiences for tech products"</p>
                    <p><strong>2. Review suggestions</strong> from Claude</p>
                    <p><strong>3. Apply selectively:</strong></p>
                    <ul className="list-disc list-inside ml-2">
                      <li>"add all" - Add everything</li>
                      <li>"add Young Professionals" - Add specific item</li>
                      <li>"remove Students" - Remove by name or key</li>
                    </ul>
                  </div>
                </div>
              </>
            )}
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
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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

      {/* Input */}
      <div className="border-t px-4 py-3">
        {!isConfigured ? (
          <div className="text-center text-sm text-gray-500">
            Please configure your API key to start chatting
          </div>
        ) : (
          <div className="flex gap-2">
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
              placeholder={taskContext ? "Ask Claude for task management help..." : "Ask Claude for suggestions..."}
              disabled={isLoading}
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send size={16} />
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

ClaudeChat.displayName = 'ClaudeChat';

export default ClaudeChat;

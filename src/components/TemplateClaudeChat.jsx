import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { MessageSquare, Send, Loader, RefreshCw, ChevronDown, ChevronUp, GripHorizontal, Code } from 'lucide-react';
import { callClaudeAPI } from '../api/claude-proxy';

/**
 * Specialized Claude Chat for Template Editing
 * Helps modify template HTML, CSS, and JSON with clear, simple, commented code
 */
const TemplateClaudeChat = forwardRef(({
  templateName,
  templateFiles,
  currentFileContent,
  currentFileName,
  onApplyCode
}, ref) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [height, setHeight] = useState(() => {
    const saved = localStorage.getItem('template_claude_chat_height');
    return saved ? parseInt(saved) : window.innerHeight * 0.5;
  });
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef(null);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  // Load API key from .env or localStorage on mount
  useEffect(() => {
    const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (envKey) {
      setApiKey(envKey);
      setIsConfigured(true);
      setShowConfig(false);
    } else {
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
    suggestImprovements: async () => {
      if (!isConfigured || isLoading) {
        alert('Claude API is not configured or busy');
        return;
      }

      const suggestionPrompt = `Please review this ${currentFileName} file and suggest improvements. Focus on:
- Code clarity and organization
- Best practices
- Accessibility
- Performance
- Maintainability

Current file: ${currentFileName}
\`\`\`
${currentFileContent}
\`\`\`

Provide clear, actionable suggestions.`;

      await sendMessageProgrammatic(suggestionPrompt);
    }
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
      const deltaY = resizeStartY.current - e.clientY;
      const newHeight = Math.max(200, Math.min(window.innerHeight * 0.9, resizeStartHeight.current + deltaY));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem('template_claude_chat_height', height.toString());
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

  // Build context about the template
  const buildTemplateContext = () => {
    const fileTypes = templateFiles.map(f => {
      if (f.endsWith('.html')) return 'HTML';
      if (f.endsWith('.css')) return 'CSS';
      if (f.endsWith('.json')) return 'JSON';
      return 'Unknown';
    }).join(', ');

    return `You are helping edit template files for "${templateName}".

**Available Files:** ${templateFiles.join(', ')} (${fileTypes})

**Currently Editing:** ${currentFileName}

**Current File Content:**
\`\`\`${currentFileName.split('.').pop()}
${currentFileContent}
\`\`\`

**IMPORTANT INSTRUCTIONS:**
1. **Always provide clear, simple, and well-commented code**
2. **Add comments explaining what each section does**
3. **Follow best practices for ${currentFileName.split('.').pop().toUpperCase()} files**
4. **When suggesting code changes, provide the complete modified code in a code block**
5. **Format code blocks like this:**
   \`\`\`${currentFileName.split('.').pop()}
   <!-- your code here -->
   \`\`\`

**Code Quality Guidelines:**
- Use meaningful class names and IDs
- Add comments for complex logic
- Keep code organized and indented properly
- For HTML: Use semantic tags, add ARIA labels for accessibility
- For CSS: Use clear selectors, add comments for sections, group related styles
- For JSON: Use clear property names, add meaningful defaults

**Response Format:**
When providing code modifications, always:
1. Explain what you're changing and why
2. Provide the complete modified code in a code block
3. Highlight the key changes with comments

Example response:
"I'll improve the HTML structure by adding semantic tags and accessibility attributes.

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <!-- Template metadata -->
  <meta charset="UTF-8">
  <title>Ad Template</title>
</head>
<body>
  <!-- Main container with ARIA label -->
  <div class="ad-container" role="main" aria-label="Advertisement">
    <!-- Content goes here -->
  </div>
</body>
</html>
\`\`\`

Key changes:
- Added semantic HTML5 tags
- Added ARIA labels for accessibility
- Added helpful comments"`;
  };

  const sendMessageProgrammatic = async (messageText) => {
    const userMessage = {
      role: 'user',
      content: messageText
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setIsCollapsed(false);

    try {
      const contextPrompt = buildTemplateContext();

      const apiMessages = [
        {
          role: 'user',
          content: contextPrompt
        },
        ...messages.filter(m => m.role !== 'system'),
        userMessage
      ];

      const data = await callClaudeAPI(apiKey, apiMessages, 'claude-3-5-sonnet-20241022', 4096);
      const responseText = data.content[0].text;

      const assistantMessage = {
        role: 'assistant',
        content: responseText
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Check if response contains code blocks
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)\n```/g;
      const codeBlocks = [...responseText.matchAll(codeBlockRegex)];

      if (codeBlocks.length > 0) {
        const infoMessage = {
          role: 'system',
          content: `💡 ${codeBlocks.length} code block(s) found. Review the code above, and if you'd like to apply it, copy and paste it into the editor.`
        };
        setMessages(prev => [...prev, infoMessage]);
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

  const sendMessage = async () => {
    if (!input.trim() || !isConfigured || isLoading) return;

    await sendMessageProgrammatic(input.trim());
    setInput('');
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (isCollapsed) {
    return (
      <div className="fixed bottom-0 right-0 bg-white shadow-lg rounded-tl-lg z-50 border-t-2 border-purple-500">
        <button
          onClick={() => setIsCollapsed(false)}
          className="px-4 py-3 flex items-center gap-2 hover:bg-gray-50 rounded-tl-lg transition-colors"
        >
          <MessageSquare size={20} className="text-purple-600" />
          <span className="font-semibold text-gray-800">Template AI Assistant</span>
          {isConfigured ? (
            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Ready</span>
          ) : (
            <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded">Setup Required</span>
          )}
          <ChevronUp size={20} className="text-gray-600" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-0 right-0 bg-white shadow-2xl flex flex-col z-50 rounded-tl-lg border-t-2 border-purple-500"
      style={{ height: `${height}px`, width: '50%', minWidth: '600px' }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleResizeStart}
        className={`w-full h-2 flex items-center justify-center cursor-ns-resize hover:bg-purple-200 transition-colors ${isResizing ? 'bg-purple-300' : 'bg-purple-100'}`}
        title="Drag to resize"
      >
        <GripHorizontal size={16} className="text-purple-600" />
      </div>

      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
        <div className="flex items-center gap-2">
          <Code size={20} className="text-purple-600" />
          <span className="font-semibold text-gray-800">Template AI Assistant</span>
          <span className="text-xs text-gray-500">• {templateName}</span>
          {isConfigured && <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Ready</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearChat}
            className="p-1.5 hover:bg-purple-100 rounded transition-colors"
            title="New chat"
          >
            <RefreshCw size={16} className="text-gray-600" />
          </button>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1.5 hover:bg-purple-100 rounded transition-colors"
            title="Collapse"
          >
            <ChevronDown size={20} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div className="border-b px-4 py-3 bg-amber-50">
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
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm transition-colors"
                  >
                    Save
                  </button>
                  {isConfigured && (
                    <button
                      onClick={removeApiKey}
                      className="px-4 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm transition-colors"
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
            <Code size={48} className="mx-auto mb-4 text-purple-300" />
            <p className="text-sm font-medium mb-2">
              Ask Claude to help modify your template code
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Currently editing: <span className="font-mono text-purple-600">{currentFileName}</span>
            </p>
            <div className="mt-4 p-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg text-left">
              <p className="text-xs font-semibold text-purple-800 mb-3 flex items-center gap-2">
                <Code size={14} />
                ✨ Template Editing Assistant
              </p>
              <div className="text-xs text-gray-700 space-y-2">
                <p className="font-semibold text-purple-700">Try asking:</p>
                <ul className="list-disc list-inside ml-2 space-y-1 text-gray-600">
                  <li>"Add comments to explain the code"</li>
                  <li>"Improve the HTML structure with semantic tags"</li>
                  <li>"Add accessibility attributes to this template"</li>
                  <li>"Reorganize the CSS with clear sections"</li>
                  <li>"Add a new placeholder to template.json"</li>
                  <li>"Optimize this code for better performance"</li>
                </ul>
                <div className="mt-3 pt-3 border-t border-purple-200">
                  <p className="font-semibold text-purple-700 mb-1">Code Quality Focus:</p>
                  <p className="text-gray-600">Claude will provide clear, commented, and well-organized code following best practices.</p>
                </div>
              </div>
            </div>
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
                msg.role === 'system' ? 'max-w-full' : 'max-w-[85%]'
              } rounded-lg px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white shadow-md'
                  : msg.role === 'system'
                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                  : 'bg-gray-100 text-gray-800 shadow-sm'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2 shadow-sm">
              <div className="flex items-center gap-2">
                <Loader size={16} className="animate-spin text-purple-600" />
                <span className="text-sm text-gray-600">Claude is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t px-4 py-3 bg-gray-50">
        {!isConfigured ? (
          <div className="text-center text-sm text-gray-500">
            <button
              onClick={() => setShowConfig(true)}
              className="text-purple-600 hover:underline font-medium"
            >
              Configure your API key
            </button> to start chatting with Claude
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
              placeholder={`Ask Claude to modify ${currentFileName}...`}
              disabled={isLoading}
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 text-sm"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
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

TemplateClaudeChat.displayName = 'TemplateClaudeChat';

export default TemplateClaudeChat;

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Send, Loader, RefreshCw, X, Code } from 'lucide-react';
import { callClaudeAPI } from '../api/claude-proxy';

/**
 * Specialized Claude Chat for Template Editing
 * Matches the Matrix AI Assistant design pattern:
 * - bottom-panel pill trigger button
 * - dialog via createPortal with iOS-style animations
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
  const [isClosing, setIsClosing] = useState(false);
  const messagesEndRef = useRef(null);

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

  // Close with animation (matching Matrix AI assistant pattern)
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsCollapsed(true);
      setIsClosing(false);
    }, 200);
  };

  const handleToggle = () => {
    if (!isCollapsed) {
      handleClose();
    } else {
      setIsCollapsed(false);
    }
  };

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
3. Highlight the key changes with comments`;
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
          content: `${codeBlocks.length} code block(s) found. Review the code above, and if you'd like to apply it, copy and paste it into the editor.`
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

  return (
    <>
      {/* Bottom Panel Button — matches Matrix AI assistant */}
      <div
        className="bottom-panel"
        onClick={handleToggle}
      >
        <Bot size={20} className="bottom-panel-icon" />
        <span className="bottom-panel-title">AI Assistant</span>
        {isLoading && (
          <span className="bottom-panel-btn" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <Loader size={10} className="animate-spin" />
            Thinking...
          </span>
        )}
      </div>

      {/* Dialog — rendered via portal when expanded */}
      {(!isCollapsed || isClosing) && createPortal(
        <div
          className={`dialog-overlay overlay-animated ${isClosing ? 'closing' : 'open'}`}
          onClick={handleClose}
        >
          <div
            className={`dialog dialog-animated ${isClosing ? 'closing' : 'open'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-layout" style={{ flexDirection: 'column', height: '100%' }}>
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-4)',
                borderBottom: '1px solid rgba(255,255,255,0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bot size={24} style={{ color: 'white' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: 'white', fontSize: '16px', fontWeight: 600 }}>AI Assistant</span>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
                      Templates — {templateName} / {currentFileName}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Config toggle */}
                  <button
                    onClick={() => setShowConfig(!showConfig)}
                    style={{
                      padding: '8px 12px',
                      background: showConfig ? 'rgba(255,255,255,0.2)' : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: isConfigured ? 'rgba(255,255,255,0.7)' : '#fbbf24',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    {isConfigured ? 'API Key' : 'Setup API Key'}
                  </button>
                  {/* New chat */}
                  <button
                    onClick={clearChat}
                    style={{
                      padding: '8px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'rgba(255,255,255,0.7)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="New chat"
                  >
                    <RefreshCw size={16} />
                  </button>
                  {/* Close */}
                  <button
                    onClick={handleClose}
                    style={{
                      padding: '8px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'rgba(255,255,255,0.7)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Config Panel */}
              {showConfig && (
                <div style={{
                  padding: 'var(--space-4)',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)'
                }}>
                  {import.meta.env.VITE_ANTHROPIC_API_KEY ? (
                    <div style={{
                      padding: '8px 12px',
                      background: 'rgba(34,197,94,0.15)',
                      borderRadius: '6px',
                      color: '#86efac',
                      fontSize: '13px'
                    }}>
                      API key configured in .env file
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                            fontSize: '13px',
                            outline: 'none'
                          }}
                        />
                        <button
                          onClick={saveApiKey}
                          className="btn btn-primary"
                          style={{ fontSize: '13px', padding: '8px 16px' }}
                        >
                          Save
                        </button>
                        {isConfigured && (
                          <button
                            onClick={removeApiKey}
                            className="btn btn-danger"
                            style={{ fontSize: '13px', padding: '8px 16px' }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>
                        Your API key is stored locally in your browser.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Messages */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 'var(--space-4)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.15) transparent'
              }}>
                {messages.length === 0 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    gap: '12px',
                    opacity: 0.6
                  }}>
                    <Code size={48} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    <span style={{ color: 'white', fontSize: '14px', fontWeight: 500 }}>
                      Ask Claude to help modify your template code
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
                      Currently editing: {currentFileName}
                    </span>
                    <div style={{
                      marginTop: '16px',
                      padding: '16px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '8px',
                      maxWidth: '400px',
                      width: '100%'
                    }}>
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 600 }}>
                        Try asking:
                      </span>
                      <ul style={{
                        margin: '8px 0 0 16px',
                        padding: 0,
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: '12px',
                        listStyle: 'disc',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <li>"Add comments to explain the code"</li>
                        <li>"Improve the HTML structure"</li>
                        <li>"Reorganize the CSS with clear sections"</li>
                        <li>"Add a new placeholder to template.json"</li>
                      </ul>
                    </div>
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' :
                                     msg.role === 'system' ? 'center' :
                                     'flex-start'
                    }}
                  >
                    <div style={{
                      maxWidth: msg.role === 'system' ? '100%' : '85%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
                      ...(msg.role === 'user' ? {
                        background: 'rgba(255,255,255,0.2)',
                        color: 'white'
                      } : msg.role === 'system' ? {
                        background: 'rgba(97,175,239,0.15)',
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: '12px'
                      } : {
                        background: 'rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.9)'
                      })
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Loader size={14} className="animate-spin" style={{ color: 'rgba(255,255,255,0.6)' }} />
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Claude is thinking...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{
                padding: 'var(--space-4)',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                gap: '8px'
              }}>
                {!isConfigured ? (
                  <div style={{
                    flex: 1,
                    textAlign: 'center',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '13px',
                    padding: '8px 0'
                  }}>
                    <button
                      onClick={() => setShowConfig(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.8)',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontSize: '13px'
                      }}
                    >
                      Configure your API key
                    </button> to start chatting
                  </div>
                ) : (
                  <>
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
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '13px',
                        outline: 'none',
                        opacity: isLoading ? 0.5 : 1
                      }}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={isLoading || !input.trim()}
                      style={{
                        padding: '10px 16px',
                        background: isLoading || !input.trim() ? 'rgba(255,255,255,0.1)' : 'white',
                        color: isLoading || !input.trim() ? 'rgba(255,255,255,0.3)' : 'var(--color-primary)',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 600,
                        fontSize: '13px'
                      }}
                    >
                      <Send size={14} />
                      Send
                    </button>
                  </>
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

TemplateClaudeChat.displayName = 'TemplateClaudeChat';

export default TemplateClaudeChat;

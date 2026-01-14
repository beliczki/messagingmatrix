import React, { useState, useEffect, useMemo } from 'react';
import { X, Share2, Copy, Check, Loader2, Search, ClipboardList } from 'lucide-react';
import { createPreview } from '../services/previewService';
import { apiGet } from '../utils/api';

const CreativeShare = ({
  isOpen,
  onClose,
  selectedCreativeIds,
  selectedCreatives = [],
  shareTitle,
  setShareTitle,
  selectedBaseColor,
  setSelectedBaseColor,
  generatedShareUrl,
  setGeneratedShareUrl,
  copiedUrl,
  setCopiedUrl,
  lookAndFeel,
  templatesCache = {},
  getTemplateForCreative,
  textFormatting = []
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState('');

  // Task linking state
  const [allTasks, setAllTasks] = useState([]);
  const [taskSearch, setTaskSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDropdownOpen, setTaskDropdownOpen] = useState(false);

  // ESC key to close dialog
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch tasks when dialog opens
  useEffect(() => {
    if (!isOpen) {
      // Reset task state when dialog closes
      setTaskSearch('');
      setSelectedTask(null);
      setTaskDropdownOpen(false);
      return;
    }

    const fetchTasks = async () => {
      try {
        const response = await apiGet('/api/tasks');
        if (response.ok) {
          const data = await response.json();
          setAllTasks(data.tasks || []);
        }
      } catch (error) {
        console.error('Error fetching tasks:', error);
        setAllTasks([]);
      }
    };

    fetchTasks();
  }, [isOpen]);

  // Filter tasks based on search
  const filteredTasks = useMemo(() => {
    if (!taskSearch.trim()) return allTasks.slice(0, 10);

    const searchLower = taskSearch.toLowerCase();
    return allTasks
      .filter(task => {
        const title = (task.title || '').toLowerCase();
        const tcNumber = `tc${task.id}`.toLowerCase();
        return title.includes(searchLower) || tcNumber.includes(searchLower);
      })
      .slice(0, 10);
  }, [taskSearch, allTasks]);

  // Click outside to close task dropdown
  useEffect(() => {
    if (!taskDropdownOpen) return;

    const handleClickOutside = (e) => {
      const dropdown = e.target.closest('[data-task-dropdown]');
      if (!dropdown) {
        setTaskDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [taskDropdownOpen]);

  if (!isOpen) return null;

  const handleCreateShare = async () => {
    if (selectedCreativeIds.size > 0) {
      try {
        // Clear any existing URL before creating new one
        setGeneratedShareUrl(null);
        setCopiedUrl(false);
        setIsCreating(true);
        setCreationStatus('Creating share...');

        // Prepare creatives with their template data attached
        // This is needed because functions (like getTemplateForCreative) can't be serialized
        const creativesWithTemplates = selectedCreatives.map(creative => {
          if (creative.isDynamic && creative.messageData) {
            const templateName = creative.messageData.template;
            const templateData = templatesCache[templateName] || {};
            return {
              ...creative,
              templateHtml: templateData.html || '',
              templateCss: templateData.css || {},
              templateConfig: templateData.config || null,
              templateName: templateName
            };
          }
          return creative;
        });

        const result = await createPreview(
          Array.from(selectedCreativeIds),
          creativesWithTemplates,
          shareTitle,
          selectedBaseColor,
          {}, // Template data is now on each creative
          textFormatting
        );

        // Link share to task if one is selected
        if (selectedTask && result.url) {
          setCreationStatus('Linking to task...');
          try {
            // Append share URL to task's shareLinks array
            const currentLinks = selectedTask.shareLinks || [];

            // Only add if not already present
            if (!currentLinks.includes(result.url)) {
              const response = await fetch(`/api/tasks/${selectedTask.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  shareLinks: [...currentLinks, result.url]
                })
              });

              if (!response.ok) {
                console.warn('Failed to link share to task:', await response.text());
              }
            }
          } catch (linkError) {
            console.warn('Failed to link share to task:', linkError);
            // Don't fail the whole operation if linking fails
          }
        }

        setCreationStatus('Share created successfully!');
        setGeneratedShareUrl(result.url);
      } catch (error) {
        console.error('Failed to create share:', error);
        setCreationStatus('');
        alert(`Failed to create share link: ${error.message}`);
      } finally {
        setIsCreating(false);
      }
    }
  };

  const handleCreateAnother = () => {
    setGeneratedShareUrl(null);
    setCopiedUrl(false);
    setShareTitle('');
  };

  const handleCopyUrl = () => {
    if (generatedShareUrl) {
      navigator.clipboard.writeText(generatedShareUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="rounded-lg ui-shadow w-full max-w-md" style={{ backgroundColor: selectedBaseColor }}>
        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <h3 className="text-lg font-bold text-white">
            {generatedShareUrl ? 'Share Link Created!' : 'Create Share Link'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded transition-colors">
            <X size={20} className="text-white" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Preview Background Color Selector */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Preview Background Color</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedBaseColor(lookAndFeel?.headerColor || '#2870ed')}
                disabled={isCreating}
                className={`w-12 h-12 rounded-lg border-2 transition-all ${
                  selectedBaseColor === (lookAndFeel?.headerColor || '#2870ed')
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-white/40 hover:border-white/70'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{ backgroundColor: lookAndFeel?.headerColor || '#2870ed' }}
                title="Header Color"
              />
              <button
                onClick={() => setSelectedBaseColor(lookAndFeel?.secondaryColor1 || '#eb4c79')}
                disabled={isCreating}
                className={`w-12 h-12 rounded-lg border-2 transition-all ${
                  selectedBaseColor === (lookAndFeel?.secondaryColor1 || '#eb4c79')
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-white/40 hover:border-white/70'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{ backgroundColor: lookAndFeel?.secondaryColor1 || '#eb4c79' }}
                title="Secondary Color 1"
              />
              <button
                onClick={() => setSelectedBaseColor(lookAndFeel?.secondaryColor2 || '#02a3a4')}
                disabled={isCreating}
                className={`w-12 h-12 rounded-lg border-2 transition-all ${
                  selectedBaseColor === (lookAndFeel?.secondaryColor2 || '#02a3a4')
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-white/40 hover:border-white/70'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{ backgroundColor: lookAndFeel?.secondaryColor2 || '#02a3a4' }}
                title="Secondary Color 2"
              />
              <button
                onClick={() => setSelectedBaseColor(lookAndFeel?.secondaryColor3 || '#711c7a')}
                disabled={isCreating}
                className={`w-12 h-12 rounded-lg border-2 transition-all ${
                  selectedBaseColor === (lookAndFeel?.secondaryColor3 || '#711c7a')
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-white/40 hover:border-white/70'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{ backgroundColor: lookAndFeel?.secondaryColor3 || '#711c7a' }}
                title="Secondary Color 3"
              />
            </div>
          </div>

          {/* Add to Task Dropdown */}
          <div data-task-dropdown>
            <label className="block text-sm font-medium text-white mb-2">Add to Task (optional)</label>
            <div className="relative">
              {selectedTask ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-white/20 border border-white/40 rounded text-white">
                  <ClipboardList size={16} className="text-white/60" />
                  <span className="flex-1 truncate">TC{selectedTask.id}: {selectedTask.title || 'Untitled Task'}</span>
                  <button
                    onClick={() => setSelectedTask(null)}
                    className="p-1 hover:bg-white/20 rounded"
                    disabled={isCreating}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      value={taskSearch}
                      onChange={(e) => {
                        setTaskSearch(e.target.value);
                        setTaskDropdownOpen(true);
                      }}
                      onFocus={() => setTaskDropdownOpen(true)}
                      placeholder="Search tasks by title or TC#..."
                      disabled={isCreating}
                      className="w-full pl-10 pr-3 py-2 bg-white/20 border border-white/40 rounded text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
                    />
                  </div>
                  {taskDropdownOpen && filteredTasks.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-white/20 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredTasks.map(task => (
                        <button
                          key={task.id}
                          onClick={() => {
                            setSelectedTask(task);
                            setTaskSearch('');
                            setTaskDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-white/10 transition-colors flex items-center gap-2"
                        >
                          <span className="text-xs text-white/40 shrink-0">TC{task.id}</span>
                          <span className="text-white text-sm truncate">{task.title || 'Untitled Task'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Loading Status */}
          {isCreating && (
            <div className="flex items-center gap-3 px-4 py-3 bg-white/10 rounded-lg">
              <Loader2 size={20} className="text-white animate-spin" />
              <span className="text-white text-sm">{creationStatus}</span>
            </div>
          )}

          {!generatedShareUrl && !isCreating ? (
            <div>
              <input
                type="text"
                value={shareTitle}
                onChange={(e) => setShareTitle(e.target.value)}
                placeholder="Title (optional)"
                className="w-full px-3 py-2 bg-white/20 border border-white/40 rounded text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>
          ) : generatedShareUrl && !isCreating ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={generatedShareUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-white/20 border border-white/40 rounded text-white"
              />
              <button
                onClick={handleCopyUrl}
                className="px-4 py-2 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors"
              >
                {copiedUrl ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/20">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-4 py-2 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatedShareUrl ? 'Done' : 'Cancel'}
          </button>
          {generatedShareUrl ? (
            <button
              onClick={handleCreateAnother}
              disabled={isCreating}
              className="px-4 py-2 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Share2 size={16} />
              Create Another
            </button>
          ) : (
            <button
              onClick={handleCreateShare}
              disabled={isCreating}
              className="px-4 py-2 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Share2 size={16} />
                  Create Link
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreativeShare;

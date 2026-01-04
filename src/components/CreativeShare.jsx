import React, { useState, useEffect } from 'react';
import { X, Share2, Copy, Check, Loader2 } from 'lucide-react';
import { createPreview } from '../services/previewService';

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

  if (!isOpen) return null;

  const handleCreateShare = async () => {
    if (selectedCreativeIds.size > 0) {
      try {
        // Clear any existing URL before creating new one
        setGeneratedShareUrl(null);
        setCopiedUrl(false);
        setIsCreating(true);
        setCreationStatus('Creating share...');

        const result = await createPreview(
          Array.from(selectedCreativeIds),
          selectedCreatives,
          shareTitle,
          selectedBaseColor,
          {
            templatesCache,
            getTemplateForCreative
          },
          textFormatting
        );

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
      <div className="rounded-lg shadow-xl w-full max-w-md" style={{ backgroundColor: selectedBaseColor }}>
        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <h3 className="text-lg font-bold text-white">
            {generatedShareUrl ? 'Share Link Created!' : 'Create Share Link'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded transition-colors">
            <X size={20} className="text-white" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Base Color Selector */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Base Color</label>
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

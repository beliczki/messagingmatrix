import React, { useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, AlertCircle, Loader, Trash2 } from 'lucide-react';
import settings from '../services/settings';
import { generateTraffickingFields, generatePMMID } from '../utils/patternEvaluator';

const MessageEditorDialog = ({
  editingMessage,
  setEditingMessage,
  audiences,
  topics,
  messages,
  updateMessage,
  deleteMessage,
  keywords,
  previewSize,
  setPreviewSize,
  activeTab,
  setActiveTab,
  isGeneratingContent,
  handleGenerateContent
}) => {
  // Compute trafficking fields automatically
  const computedTrafficking = useMemo(() => {
    if (!editingMessage) return {};

    try {
      const pmmid = generatePMMID(editingMessage, audiences, settings.getPattern('pmmid'));
      const trafficking = generateTraffickingFields(
        { ...editingMessage, pmmid },
        audiences,
        settings.getPattern('trafficking')
      );
      return trafficking;
    } catch (error) {
      console.error('Error computing trafficking fields:', error);
      return {};
    }
  }, [editingMessage, audiences]);

  if (!editingMessage) return null;

  // Helper function to build full image URL
  const buildImageUrl = (imageKey, filename) => {
    if (!filename) return '';
    // If filename already starts with http:// or https://, use it as-is
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename;
    }
    // Get image base URLs from settings
    const imageBaseUrls = settings.getImageBaseUrls();
    // Otherwise, prepend the base URL
    return (imageBaseUrls[imageKey] || '') + filename;
  };

  // Generate preview HTML
  const generatePreviewHtml = () => {
    const templateHtml = `<html id="html">
  <head>
    <title>${editingMessage.name || 'Preview'}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/src/templates/html/main.css" />
    <link rel="stylesheet" href="/src/templates/html/${previewSize}.css" />
  </head>
  <body>
      <div class="click-url" id="clickLayer">
        <div id="adContainer" class="template_variant_class ${editingMessage.template_variant_classes || ''}">
          <div id="backgroundContainer">
            <div id="imageWrapper">
              <div style="background-image:url('{{background_image_1}}')" class="background_image_1"></div>
            </div>
            <div id="videoWrapper">
              <video autoplay muted playsinline loop onload="playVideo()">
                <source src="{{background_video_1}}" type="video/mp4" class="background_video_1"></video>
            </div>
          </div>
          <main>
            <div id="objectWrapper">
              <div style="background-image:url('{{background_image_2}}')" class="background_image_2"></div>
            </div>
            <div id="textContainer">
              <div id="stickerContainer">
                <div class="stickerTextWrapper">
                  <p class="sticker_text_1 sticker_style_1" style="{{sticker_style_1}}">{{sticker_text_1}}</p>
                </div>
                <div class="stickerImageWrapper">
                  <div style="background-image:url('{{sticker_image_1}}')" class="sticker_image_1">
                  {{sticker_image_1}}
                  </div>
                </div>
              </div>
              <div id="cardContainer">
                <div class="cardImageWrapper">
                  <div style="background-image:url('{{background_image_3}}')" class="background_image_3">
                  {{background_image_3}}
                  </div>
                </div>
              </div>
              <div id="headlineWrapper">
                <h2 class="headline_text_1 headline_style_1" style="{{headline_style_1}}">{{headline_text_1}}</h2>
              </div>
              <div id="copyWrapper1">
                <p class="copy_text_1 copy_style_1" style="{{copy_style_1}}">{{copy_text_1}}</p>
              </div>
              <div id="copyWrapper2">
                <p class="thm copy_style_2" style="{{copy_style_2}}">{{copy_text_2}}</b></p>
              </div>
              <div id="buttonWrapper">
                <span class="cta_text_1 cta_style_1" style="{{cta_style_1}}" data="{{cta_text_1}}">{{cta_text_1}}</span>
              </div>
              <div id="disclaimerWrapper1">
                <p class="disclaimer_text_1 disclaimer_style_1" style="{{disclaimer_style_1}}" data="{{disclaimer_text_1}}">{{disclaimer_text_1}}</p>
              </div>
            </div>
          </main>
          <div id="frameContainer"></div>
          <div id="logoContainer">
            <div id="logoWrapper">
              <img src="{{brand_image_1}}" class="logo logo_image_1 brand_image_1"/>
            </div>
          </div>
        </div>
    </div>
  </body>
</html>`;

    return templateHtml
      .replace(/\{\{headline_text_1\}\}/g, editingMessage.headline || '')
      .replace(/\{\{copy_text_1\}\}/g, editingMessage.copy1 || '')
      .replace(/\{\{copy_text_2\}\}/g, editingMessage.copy2 || '')
      .replace(/\{\{cta_text_1\}\}/g, editingMessage.cta || '')
      .replace(/\{\{sticker_text_1\}\}/g, editingMessage.flash || '')
      .replace(/\{\{background_image_1\}\}/g, buildImageUrl('image1', editingMessage.image1))
      .replace(/\{\{background_image_2\}\}/g, buildImageUrl('image2', editingMessage.image2))
      .replace(/\{\{background_image_3\}\}/g, buildImageUrl('image3', editingMessage.image3))
      .replace(/\{\{brand_image_1\}\}/g, buildImageUrl('image5', editingMessage.image5))
      .replace(/\{\{sticker_image_1\}\}/g, buildImageUrl('image6', editingMessage.image6))
      .replace(/\{\{[^}]+\}\}/g, '')
      .replace(/\[\[[^\]]+\]\]/g, '');
  };

  // Get all messages for navigation
  const allMessages = messages
    .filter(m => m.status !== 'deleted')
    .sort((a, b) => {
      // Sort by number first, then by variant
      if (a.number !== b.number) return a.number - b.number;
      return (a.variant || 'a').localeCompare(b.variant || 'a');
    });

  const currentIndex = allMessages.findIndex(m => m.id === editingMessage.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allMessages.length - 1;

  // Determine status color
  const status = (editingMessage.status || 'PLANNED').toUpperCase();
  let badgeColor = 'bg-yellow-100'; // PLANNED (default)
  let textColor = 'text-yellow-700';

  if (status === 'ACTIVE') {
    badgeColor = 'bg-green-100';
    textColor = 'text-green-700';
  } else if (status === 'INACTIVE') {
    badgeColor = 'bg-gray-200';
    textColor = 'text-gray-700';
  } else if (status === 'INPROGRESS') {
    badgeColor = 'bg-orange-100';
    textColor = 'text-orange-700';
  }

  // Find synced messages
  const syncedMessages = messages.filter(m =>
    m.id !== editingMessage.id &&
    m.number === editingMessage.number &&
    m.variant === editingMessage.variant &&
    m.status !== 'deleted'
  );

  // Determine if preview should be on side or top based on width
  const [width, height] = previewSize.split('x').map(Number);
  const isWide = width > 600; // Wide sizes go to top

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Edit Messaging Card</h2>
            <div className={`flex items-center gap-2 ${badgeColor} px-3 py-1 rounded`}>
              <span className={`font-bold ${textColor} text-lg`}>{editingMessage.number || ''}</span>
              <span className={`text-sm font-semibold ${textColor}`}>{editingMessage.variant || ''}</span>
            </div>
            <select
              value={previewSize}
              onChange={(e) => setPreviewSize(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="300x250">300x250</option>
              <option value="300x600">300x600</option>
              <option value="640x360">640x360</option>
              <option value="970x250">970x250</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (hasPrevious) {
                  setEditingMessage(allMessages[currentIndex - 1]);
                } else {
                  // Wrap around to last message
                  setEditingMessage(allMessages[allMessages.length - 1]);
                }
              }}
              className="p-1 hover:bg-gray-100 rounded"
              title="Previous message (all variants)"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => {
                if (hasNext) {
                  setEditingMessage(allMessages[currentIndex + 1]);
                } else {
                  // Wrap around to first message
                  setEditingMessage(allMessages[0]);
                }
              }}
              className="p-1 hover:bg-gray-100 rounded"
              title="Next message (all variants)"
            >
              <ChevronRight size={20} />
            </button>
            <button
              onClick={() => setEditingMessage(null)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b bg-gray-50">
          <div className="flex">
            <button
              onClick={() => setActiveTab('naming')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'naming'
                  ? 'bg-white border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Naming
            </button>
            <button
              onClick={() => setActiveTab('content')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'content'
                  ? 'bg-white border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Content
            </button>
            <button
              onClick={() => setActiveTab('trafficking')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'trafficking'
                  ? 'bg-white border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Trafficking
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Naming Tab */}
          {activeTab === 'naming' && (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editingMessage.name || ''}
                    onChange={(e) => setEditingMessage({ ...editingMessage, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Audience Key</label>
                    <input
                      type="text"
                      value={editingMessage.audience || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Topic Key</label>
                    <input
                      type="text"
                      value={editingMessage.topic || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Number</label>
                    <input
                      type="number"
                      value={editingMessage.number || ''}
                      onChange={(e) => {
                        const newNumber = parseInt(e.target.value) || 0;
                        setEditingMessage({ ...editingMessage, number: newNumber });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Variant</label>
                    <input
                      type="text"
                      value={editingMessage.variant || ''}
                      onChange={(e) => {
                        const newVariant = e.target.value;
                        setEditingMessage({ ...editingMessage, variant: newVariant });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Version (auto-increments)</label>
                    <input
                      type="number"
                      value={editingMessage.version || 1}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    {(() => {
                      const keywordValues = keywords.messages && keywords.messages.status;
                      const statusOptions = keywordValues && keywordValues.length > 0
                        ? keywordValues
                        : ['PLANNED', 'INPROGRESS', 'ACTIVE', 'INACTIVE'];

                      return (
                        <select
                          value={editingMessage.status || 'PLANNED'}
                          onChange={(e) => setEditingMessage({ ...editingMessage, status: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {statusOptions.map((val) => (
                            <option key={val} value={val}>{val}</option>
                          ))}
                        </select>
                      );
                    })()}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PMMID (Auto-generated)</label>
                  <input
                    type="text"
                    value={generatePMMID(editingMessage, audiences, settings.getPattern('pmmid'))}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed font-mono text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={editingMessage.start_date || ''}
                      onChange={(e) => setEditingMessage({ ...editingMessage, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={editingMessage.end_date || ''}
                      onChange={(e) => setEditingMessage({ ...editingMessage, end_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Naming Tab Footer */}
              <div className="border-t bg-white px-6 py-4 flex items-center justify-between shrink-0">
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this message?')) {
                      deleteMessage(editingMessage.id);
                      setEditingMessage(null);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50"
                >
                  <Trash2 size={16} />
                  Delete Message
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingMessage(null)}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      updateMessage(editingMessage.id, {
                        name: editingMessage.name,
                        number: editingMessage.number,
                        variant: editingMessage.variant,
                        status: editingMessage.status,
                        start_date: editingMessage.start_date,
                        end_date: editingMessage.end_date
                      });
                      setEditingMessage(null);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save & Close
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Content Tab */}
          {activeTab === 'content' && (
            <>
              <div className="flex-1 overflow-y-auto p-6">
                <div className={isWide ? 'space-y-6' : 'flex gap-6'}>
                  {/* Preview - Top position for wide sizes */}
                  {isWide && (
                    <div className="border border-gray-300 rounded bg-gray-50 p-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">Preview</div>
                      <div className="flex justify-center">
                        <iframe
                          key={`${editingMessage.id}-${previewSize}`}
                          srcDoc={generatePreviewHtml()}
                          style={{ width: `${width}px`, height: `${height}px` }}
                          className="border-0"
                          title="Message Preview"
                        />
                      </div>
                    </div>
                  )}

                  {/* Content Fields */}
                  <div className={isWide ? 'w-full space-y-4' : 'w-[60%] space-y-4'}>
                    {/* Warning about synced fields */}
                    {syncedMessages.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-300 rounded p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={16} />
                          <div className="text-sm">
                            <p className="font-semibold text-yellow-800 mb-1">
                              Content Sync Warning: {syncedMessages.length} other message{syncedMessages.length > 1 ? 's' : ''} will be updated
                            </p>
                            <p className="text-yellow-700 mb-2">
                              Changes to Template, Template Variant Classes, Landing URL, Headline, Copy 1, Copy 2, Flash, CTA, and Image fields will be automatically applied to:
                            </p>
                            <ul className="text-yellow-700 list-disc list-inside">
                              {syncedMessages.map(m => {
                                const aud = audiences.find(a => a.key === m.audience);
                                return (
                                  <li key={m.id}>
                                    <span className="font-medium">{aud ? aud.name : m.audience}</span>
                                    {' '}({m.name})
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={editingMessage.headline || ''}
                          onChange={(e) => setEditingMessage({ ...editingMessage, headline: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                        />
                        {isGeneratingContent && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <Loader size={16} className="animate-spin text-purple-600" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Copy 1</label>
                      <div className="relative">
                        <textarea
                          value={editingMessage.copy1 || ''}
                          onChange={(e) => setEditingMessage({ ...editingMessage, copy1: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                        />
                        {isGeneratingContent && (
                          <div className="absolute right-3 top-3">
                            <Loader size={16} className="animate-spin text-purple-600" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Copy 2</label>
                      <div className="relative">
                        <textarea
                          value={editingMessage.copy2 || ''}
                          onChange={(e) => setEditingMessage({ ...editingMessage, copy2: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                        />
                        {isGeneratingContent && (
                          <div className="absolute right-3 top-3">
                            <Loader size={16} className="animate-spin text-purple-600" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Flash</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={editingMessage.flash || ''}
                            onChange={(e) => setEditingMessage({ ...editingMessage, flash: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                          />
                          {isGeneratingContent && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <Loader size={16} className="animate-spin text-purple-600" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CTA</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={editingMessage.cta || ''}
                            onChange={(e) => setEditingMessage({ ...editingMessage, cta: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                          />
                          {isGeneratingContent && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <Loader size={16} className="animate-spin text-purple-600" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Landing URL</label>
                      <input
                        type="text"
                        value={editingMessage.landingUrl || ''}
                        onChange={(e) => setEditingMessage({ ...editingMessage, landingUrl: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                      <input
                        type="text"
                        value={editingMessage.template || ''}
                        onChange={(e) => setEditingMessage({ ...editingMessage, template: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Template Variant Classes</label>
                      <input
                        type="text"
                        value={editingMessage.template_variant_classes || ''}
                        onChange={(e) => setEditingMessage({ ...editingMessage, template_variant_classes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="CSS classes for template variants"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Image 1</label>
                        <input
                          type="text"
                          value={editingMessage.image1 || ''}
                          onChange={(e) => setEditingMessage({ ...editingMessage, image1: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Image URL or path"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Image 2</label>
                        <input
                          type="text"
                          value={editingMessage.image2 || ''}
                          onChange={(e) => setEditingMessage({ ...editingMessage, image2: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Image URL or path"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Image 3</label>
                        <input
                          type="text"
                          value={editingMessage.image3 || ''}
                          onChange={(e) => setEditingMessage({ ...editingMessage, image3: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Image URL or path"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Image 4</label>
                        <input
                          type="text"
                          value={editingMessage.image4 || ''}
                          onChange={(e) => setEditingMessage({ ...editingMessage, image4: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Image URL or path"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Image 5 (Logo)</label>
                        <input
                          type="text"
                          value={editingMessage.image5 || ''}
                          onChange={(e) => setEditingMessage({ ...editingMessage, image5: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Logo image URL or path"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Image 6 (Sticker)</label>
                        <input
                          type="text"
                          value={editingMessage.image6 || ''}
                          onChange={(e) => setEditingMessage({ ...editingMessage, image6: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Sticker image URL or path"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                      <textarea
                        value={editingMessage.comment || ''}
                        onChange={(e) => setEditingMessage({ ...editingMessage, comment: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Right Column - Preview (40%) for narrow sizes */}
                  {!isWide && (
                    <div className="w-[40%]">
                      <div className="border border-gray-300 rounded bg-gray-50 p-4">
                        <div className="text-sm font-medium text-gray-700 mb-2">Preview</div>
                        <iframe
                          key={`${editingMessage.id}-${previewSize}`}
                          srcDoc={generatePreviewHtml()}
                          className="w-full h-[600px] border-0"
                          title="Message Preview"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Content Tab Footer */}
              <div className="border-t bg-white px-6 py-4 flex items-center justify-between shrink-0">
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this message?')) {
                      deleteMessage(editingMessage.id);
                      setEditingMessage(null);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50"
                >
                  <Trash2 size={16} />
                  Delete Message
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerateContent}
                    disabled={isGeneratingContent}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGeneratingContent ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate'
                    )}
                  </button>
                  <button
                    onClick={() => setEditingMessage(null)}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      updateMessage(editingMessage.id, {
                        headline: editingMessage.headline,
                        copy1: editingMessage.copy1,
                        copy2: editingMessage.copy2,
                        flash: editingMessage.flash,
                        cta: editingMessage.cta,
                        landingUrl: editingMessage.landingUrl,
                        template: editingMessage.template,
                        template_variant_classes: editingMessage.template_variant_classes,
                        image1: editingMessage.image1,
                        image2: editingMessage.image2,
                        image3: editingMessage.image3,
                        image4: editingMessage.image4,
                        image5: editingMessage.image5,
                        image6: editingMessage.image6,
                        comment: editingMessage.comment
                      });
                      setEditingMessage(null);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save & Close
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Trafficking Tab */}
          {activeTab === 'trafficking' && (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UTM Campaign</label>
                  <input
                    type="text"
                    value={computedTrafficking.utm_campaign || ''}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                    placeholder="Campaign identifier"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UTM Source</label>
                  <input
                    type="text"
                    value={computedTrafficking.utm_source || ''}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                    placeholder="Traffic source"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UTM Medium</label>
                  <input
                    type="text"
                    value={computedTrafficking.utm_medium || ''}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                    placeholder="Marketing medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UTM Content</label>
                  <input
                    type="text"
                    value={computedTrafficking.utm_content || ''}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                    placeholder="Ad variation identifier"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UTM Term</label>
                  <input
                    type="text"
                    value={computedTrafficking.utm_term || ''}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                    placeholder="Keyword"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UTM CD26</label>
                  <input
                    type="text"
                    value={computedTrafficking.utm_cd26 || ''}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                    placeholder="Custom dimension"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Final Trafficked URL</label>
                <textarea
                  value={computedTrafficking.final_trafficked_url || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed font-mono text-sm"
                  placeholder="Complete URL with all parameters"
                  rows={3}
                />
              </div>
              </div>

              {/* Trafficking Tab Footer */}
              <div className="border-t bg-white px-6 py-4 flex items-center justify-between shrink-0">
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this message?')) {
                      deleteMessage(editingMessage.id);
                      setEditingMessage(null);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50"
                >
                  <Trash2 size={16} />
                  Delete Message
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingMessage(null)}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // Save and close
                      updateMessage(editingMessage.id, {
                        utm_campaign: editingMessage.utm_campaign,
                        utm_source: editingMessage.utm_source,
                        utm_medium: editingMessage.utm_medium,
                        utm_content: editingMessage.utm_content,
                        utm_term: editingMessage.utm_term,
                        utm_cd26: editingMessage.utm_cd26,
                        final_trafficked_url: editingMessage.final_trafficked_url
                      });
                      setEditingMessage(null);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save & Close
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageEditorDialog;

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Save, Loader, ExternalLink, Download, X, RefreshCw, Users, Image, List, Type, Package, Check, Tag, Key, FlaskConical } from 'lucide-react';
import settings from '../services/settings';
import { generatePMMID, generateTraffickingFields } from '../utils/patternEvaluator';
import SaveProgressDialog from './SaveProgressDialog';

// Google Sheets icon component
const GoogleSheetsIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M29.5 4H11C9.34315 4 8 5.34315 8 7V41C8 42.6569 9.34315 44 11 44H37C38.6569 44 40 42.6569 40 41V15.5L29.5 4Z" fill="#0F9D58"/>
    <path d="M29.5 4V12C29.5 13.933 31.067 15.5 33 15.5H40L29.5 4Z" fill="#87CEAC"/>
    <rect x="16" y="20" width="16" height="2" fill="white"/>
    <rect x="16" y="26" width="16" height="2" fill="white"/>
    <rect x="16" y="32" width="16" height="2" fill="white"/>
    <rect x="19" y="18" width="2" height="18" fill="white"/>
    <rect x="27" y="18" width="2" height="18" fill="white"/>
  </svg>
);

// Google Drive icon component
const GoogleDriveIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.1 42L6 25.5L16.1 9H31.9L22 25.5L16.1 42Z" fill="#4285F4"/>
    <path d="M31.9 9L42 25.5L31.9 42H16.1L26 25.5L31.9 9Z" fill="#FBBC05"/>
    <path d="M16.1 42L26 25.5L31.9 42H16.1Z" fill="#34A853"/>
    <path d="M6 25.5L16.1 9H31.9L22 25.5H6Z" fill="#EA4335"/>
  </svg>
);

const MatrixStatePanel = ({
  audiences,
  topics,
  messages,
  keywords,
  assets,
  creatives,
  textFormatting,
  feedData,
  lastSync,
  isSaving,
  saveProgress,
  onSave,
  onClearReload,
  onRegenerateTopicKeys,
  downloadFeedCSV,
  changeTracking,
  originalState,
  // Drive sync props
  creativesFolderId,
  assetsFolderId,
  onSyncCreatives,
  onSyncAssets,
  syncingCreatives = false,
  syncingAssets = false,
  onReloadTemplates,
  reloadingTemplates = false,
  // Module-specific props
  activeTabs = null, // null = all tabs active, array = only these tabs are active for this module
  pendingChanges = null, // { added: number, removed: number } - pending drive sync changes
  isFullyLoaded = true // Whether matrix data is fully loaded
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [activeTab, setActiveTab] = useState('audiences');
  const [changesOnly, setChangesOnly] = useState(false);

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 200); // Match animation duration
  };

  // ESC key to close panel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Handle toggle (for bottom panel click)
  const handleToggle = () => {
    if (isOpen) {
      handleClose();
    } else {
      setIsOpen(true);
    }
  };

  // Format last sync time
  const formatSync = (time) => {
    if (!time) return 'Never';
    const mins = Math.floor((Date.now() - time) / 60000);
    if (mins < 1) return 'Just now';
    if (mins === 1) return '1 min ago';
    if (mins < 60) return `${mins} mins ago`;
    return new Date(time).toLocaleTimeString();
  };

  // Compute complete message data with auto-filled fields
  const completeMessages = useMemo(() => {
    return messages
      .filter(m => m.status !== 'deleted')
      .map(msg => {
        try {
          const pmmidPattern = settings.getPattern('pmmid');
          const traffickingPatterns = settings.getPattern('trafficking');
          const pmmid = generatePMMID(msg, audiences, pmmidPattern);
          const trafficking = generateTraffickingFields(
            { ...msg, pmmid },
            audiences,
            traffickingPatterns
          );
          return { ...msg, pmmid, ...trafficking };
        } catch (error) {
          console.error('Error generating fields for message:', msg.id, error);
          return msg;
        }
      });
  }, [messages, audiences]);

  // Count keywords entries
  const keywordsCount = Object.keys(keywords || {}).reduce((count, form) => {
    return count + Object.keys((keywords || {})[form] || {}).length;
  }, 0);

  // Get change count for a specific tab
  const getTabChangeCount = (tabId) => {
    let count = 0;
    if (changeTracking) {
      const tabChanges = changeTracking[tabId];
      if (tabChanges) {
        count = (tabChanges.added?.length || 0) + (tabChanges.modified?.length || 0);
      }
    }
    // Add pending Drive changes for creatives tab
    if (tabId === 'creatives' && pendingChanges) {
      count += (pendingChanges.added || 0) + (pendingChanges.removed || 0);
    }
    return count;
  };

  const tabs = [
    { id: 'audiences', label: 'Audiences', icon: Users, count: audiences?.length || 0, changes: getTabChangeCount('audiences') },
    { id: 'topics', label: 'Topics', icon: Tag, count: topics?.length || 0, changes: getTabChangeCount('topics') },
    { id: 'messages', label: 'Messages', icon: FlaskConical, count: completeMessages.length, changes: getTabChangeCount('messages') },
    { id: 'assets', label: 'Assets', icon: Package, count: assets?.length || 0, changes: getTabChangeCount('assets') },
    { id: 'creatives', label: 'Creatives', icon: Image, count: creatives?.length || 0, changes: getTabChangeCount('creatives') },
    { id: 'feed', label: 'Feed', icon: List, count: feedData?.length || 0, changes: 0 },
    { id: 'keywords', label: 'Keywords', icon: Key, count: keywordsCount, changes: 0 },
    { id: 'textFormatting', label: 'Formatting', icon: Type, count: textFormatting?.length || 0, changes: getTabChangeCount('textFormatting') }
  ];

  const getActiveTabData = () => {
    switch (activeTab) {
      case 'audiences': return audiences || [];
      case 'topics': return topics || [];
      case 'messages': return completeMessages;
      case 'assets': return assets || [];
      case 'creatives': return creatives || [];
      case 'feed': return feedData || [];
      case 'keywords': return keywords || {};
      case 'textFormatting': return textFormatting || [];
      default: return [];
    }
  };

  // Get change info for current tab
  const getActiveTabChanges = () => {
    if (!changeTracking) return null;
    switch (activeTab) {
      case 'audiences': return changeTracking.audiences;
      case 'topics': return changeTracking.topics;
      case 'messages': return changeTracking.messages;
      case 'assets': return changeTracking.assets;
      case 'creatives': return changeTracking.creatives;
      case 'textFormatting': return changeTracking.textFormatting;
      default: return null;
    }
  };

  // Filter data to only changed items if changesOnly is true
  const getFilteredData = () => {
    const data = getActiveTabData();
    const changes = getActiveTabChanges();

    if (!changesOnly) {
      return data;
    }

    if (!Array.isArray(data)) {
      return data;
    }

    // Collect all changed IDs from changeTracking
    const changedIds = new Set();
    if (changes) {
      const { added, modified } = changes;
      added?.forEach(id => changedIds.add(String(id)));
      modified?.forEach(id => changedIds.add(String(id)));
    }

    // Add pending Drive sync changes for creatives tab
    if (activeTab === 'creatives' && pendingChanges) {
      if (pendingChanges.addedIds) {
        pendingChanges.addedIds.forEach(id => changedIds.add(String(id)));
      }
    }

    // If no changes to show, return empty array
    if (changedIds.size === 0) {
      return [];
    }

    // Note: creatives use uppercase 'ID' field, others use lowercase 'id'
    return data.filter(item => {
      const itemId = String(item.id ?? item.ID ?? '');
      return changedIds.has(itemId);
    });
  };

  // Escape HTML entities for safe display in dangerouslySetInnerHTML
  // Note: Don't escape quotes since JSON needs them for display
  const escapeHtml = (str) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  // Render JSON with highlighted changes
  const renderHighlightedJson = (data, changes) => {
    if (!Array.isArray(data)) {
      return escapeHtml(JSON.stringify(data, null, 2));
    }

    // Build sets for all added/modified IDs
    const addedIds = new Set();
    const modifiedIds = new Set();
    let changedFields = {};

    if (changes) {
      changes.added?.forEach(id => addedIds.add(String(id)));
      changes.modified?.forEach(id => modifiedIds.add(String(id)));
      changedFields = changes.changedFields || {};
    }

    // Include pending Drive changes for creatives tab (treat as "added")
    if (activeTab === 'creatives' && pendingChanges?.addedIds) {
      pendingChanges.addedIds.forEach(id => addedIds.add(String(id)));
    }

    // If no changes at all, just return plain JSON (with HTML escaped)
    if (addedIds.size === 0 && modifiedIds.size === 0) {
      return data.map(item => escapeHtml(JSON.stringify(item, null, 2))).join(',\n');
    }

    return data.map((item) => {
      // Note: creatives use uppercase 'ID' field, others use lowercase 'id'
      const id = String(item.id ?? item.ID ?? '');
      const isAdded = addedIds.has(id);
      const isModified = modifiedIds.has(id);
      const itemChangedFields = changedFields[id] || [];

      if (!isAdded && !isModified) {
        return escapeHtml(JSON.stringify(item, null, 2));
      }

      const lines = JSON.stringify(item, null, 2).split('\n');
      return lines.map((line) => {
        let shouldHighlight = isAdded;

        if (isModified && !isAdded) {
          for (const field of itemChangedFields) {
            if (line.includes(`"${field}":`)) {
              shouldHighlight = true;
              break;
            }
          }
        }

        if (shouldHighlight) {
          return `<span class="json-changed">${escapeHtml(line)}</span>`;
        }
        return escapeHtml(line);
      }).join('\n');
    }).join(',\n');
  };

  const changeCount = changeTracking?.totalChanges || 0;
  const pendingCount = pendingChanges ? (pendingChanges.added || 0) + (pendingChanges.removed || 0) : 0;
  const totalBadgeCount = changeCount + pendingCount;

  return (
    <>
      {/* Bottom Panel - Just the pill content */}
      <div className="bottom-panel" onClick={handleToggle}>
        <Save size={20} className="bottom-panel-icon" />
        <span className="bottom-panel-title">Matrix State</span>
        <button
          onClick={(e) => { e.stopPropagation(); onClearReload(); }}
          className="bottom-panel-btn"
        >
          Reload
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          disabled={isSaving || saveProgress !== null || !isFullyLoaded}
          className="bottom-panel-btn"
          style={{ opacity: isSaving || saveProgress || !isFullyLoaded ? 0.7 : 1, position: 'relative' }}
          title={!isFullyLoaded ? 'Matrix data is still loading...' : undefined}
        >
          {saveProgress ? (
            <><Loader size={14} className="animate-spin" /> Saving...</>
          ) : isSaving ? (
            <><Loader size={14} className="animate-spin" /> Saving...</>
          ) : !isFullyLoaded ? (
            <><Loader size={14} className="animate-spin" /> Loading...</>
          ) : (
            <>Save</>
          )}
          {totalBadgeCount > 0 && !isSaving && !saveProgress && isFullyLoaded && (
            <span style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              background: '#ffcc00',
              color: '#000',
              fontSize: '10px',
              fontWeight: 700,
              borderRadius: '10px',
              padding: '2px 6px',
              minWidth: '18px',
              textAlign: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}>
              {totalBadgeCount}
            </span>
          )}
        </button>
      </div>

      {/* Dialog - rendered via portal to escape z-index stacking context */}
      {(isOpen || isClosing) && createPortal(
        <div className={`dialog-overlay overlay-animated ${isClosing ? 'closing' : 'open'}`} onClick={handleClose}>
          <div className={`dialog dialog-animated ${isClosing ? 'closing' : 'open'}`} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-layout">
              {/* LEFT SIDEBAR */}
              <div className="dialog-sidebar custom-scrollbar">
                <h2 className="dialog-title">Matrix State</h2>
                {/* Matrix data link to sheets */}
                {(() => {
                  const spreadsheetId = settings.getSpreadsheetId();
                  return spreadsheetId ? (
                    <div style={{ marginTop: '-8px', marginBottom: '8px' }}>
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: 'rgba(255,255,255,0.6)',
                          fontSize: '12px',
                          textDecoration: 'none'
                        }}
                        title="Open in Google Sheets"
                      >
                        <GoogleSheetsIcon size={18} />
                        <span style={{ textDecoration: 'underline' }}>Matrix data</span>
                        <ExternalLink size={12} />
                      </a>
                      <div style={{
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: '11px',
                        marginLeft: '24px',
                        marginTop: '2px'
                      }}>
                        Synced: {formatSync(lastSync)}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: '12px',
                      marginTop: '-8px',
                      marginBottom: '8px'
                    }}>
                      Synced: {formatSync(lastSync)}
                    </div>
                  );
                })()}

                {/* Drive Folder Links */}
                {creativesFolderId && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '8px'
                  }}>
                    <a
                      href={`https://drive.google.com/drive/folders/${creativesFolderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: '12px',
                        textDecoration: 'none',
                        flex: 1
                      }}
                      title="Open Creatives folder in Drive"
                    >
                      <GoogleDriveIcon size={18} />
                      <span style={{ textDecoration: 'underline' }}>Creatives</span>
                      <ExternalLink size={12} />
                    </a>
                    {onSyncCreatives && (
                      <button
                        onClick={onSyncCreatives}
                        disabled={syncingCreatives}
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px',
                          cursor: syncingCreatives ? 'wait' : 'pointer',
                          color: 'rgba(255,255,255,0.7)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Sync creatives from Drive"
                      >
                        <RefreshCw size={14} className={syncingCreatives ? 'animate-spin' : ''} />
                      </button>
                    )}
                  </div>
                )}

                {assetsFolderId && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '16px'
                  }}>
                    <a
                      href={`https://drive.google.com/drive/folders/${assetsFolderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: '12px',
                        textDecoration: 'none',
                        flex: 1
                      }}
                      title="Open Assets folder in Drive"
                    >
                      <GoogleDriveIcon size={18} />
                      <span style={{ textDecoration: 'underline' }}>Assets</span>
                      <ExternalLink size={12} />
                    </a>
                    <button
                      onClick={onSyncAssets}
                      disabled={syncingAssets || !onSyncAssets}
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px',
                        cursor: syncingAssets || !onSyncAssets ? 'not-allowed' : 'pointer',
                        color: 'rgba(255,255,255,0.7)',
                        opacity: onSyncAssets ? 1 : 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Sync assets from Drive"
                    >
                      <RefreshCw size={14} className={syncingAssets ? 'animate-spin' : ''} />
                    </button>
                  </div>
                )}

                {/* Reload Templates button */}
                {onReloadTemplates && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '6px'
                  }}>
                    <Type size={14} style={{ opacity: 0.7 }} />
                    <span style={{ fontSize: '12px', opacity: 0.7 }}>Templates</span>
                    <button
                      onClick={onReloadTemplates}
                      disabled={reloadingTemplates}
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px',
                        cursor: reloadingTemplates ? 'wait' : 'pointer',
                        color: 'rgba(255,255,255,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Reload templates (CSS/HTML) - Ctrl+Shift+T"
                    >
                      <RefreshCw size={14} className={reloadingTemplates ? 'animate-spin' : ''} />
                    </button>
                  </div>
                )}

                {/* Vertical Tabs */}
                <div className="dialog-tabs">
                  {tabs.map(tab => {
                    // If activeTabs is set, dim icons/counters for tabs that aren't in the active list
                    const isTabActive = !activeTabs || activeTabs.includes(tab.id);
                    const dimmedOpacity = isTabActive ? 1 : 0.4;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`dialog-tab ${activeTab === tab.id ? 'active' : ''}`}
                        title={!isTabActive ? 'Not affected by save from this module' : undefined}
                      >
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem', fontWeight: 500 }}>
                          {tab.label}
                          <span style={{
                            fontSize: '11px',
                            opacity: isTabActive ? 0.7 : 0.3,
                            fontWeight: 400,
                            transition: 'opacity 0.2s ease'
                          }}>
                            ({tab.count})
                          </span>
                          {tab.changes > 0 && (
                            <span style={{
                              fontSize: '10px',
                              background: '#ffcc00',
                              color: '#000',
                              padding: '1px 6px',
                              borderRadius: '8px',
                              fontWeight: 600,
                              opacity: dimmedOpacity,
                              transition: 'opacity 0.2s ease'
                            }}>
                              {tab.changes}
                            </span>
                          )}
                        </h3>
                        <tab.icon size={18} style={{ opacity: dimmedOpacity, transition: 'opacity 0.2s ease' }} />
                      </button>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="dialog-actions">
                  {feedData && feedData.length > 0 && downloadFeedCSV && (
                    <button onClick={downloadFeedCSV} className="link-button">
                      <Download size={16} />
                      Download Feed
                    </button>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                    <button
                      onClick={handleClose}
                      className="btn btn-secondary btn-lg"
                      style={{ flex: 1 }}
                    >
                      Close
                    </button>
                    <button
                      onClick={onClearReload}
                      className="btn btn-secondary btn-lg"
                      style={{ flex: 1 }}
                    >
                      <RefreshCw size={16} />
                      Reload
                    </button>
                  </div>
                  <button
                    onClick={onSave}
                    disabled={isSaving || saveProgress !== null || !isFullyLoaded}
                    className="btn btn-primary btn-lg"
                    style={{ position: 'relative', opacity: !isFullyLoaded ? 0.7 : 1 }}
                    title={!isFullyLoaded ? 'Matrix data is still loading...' : undefined}
                  >
                    {saveProgress ? (
                      <><Loader size={14} className="animate-spin" /> {saveProgress.message}</>
                    ) : isSaving ? (
                      <><Loader size={14} className="animate-spin" /> Saving...</>
                    ) : !isFullyLoaded ? (
                      <><Loader size={14} className="animate-spin" /> Loading...</>
                    ) : (
                      <>Save to Sheets</>
                    )}
                    {totalBadgeCount > 0 && !isSaving && !saveProgress && isFullyLoaded && (
                      <span style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-6px',
                        background: '#ffcc00',
                        color: '#000',
                        fontSize: '10px',
                        fontWeight: 700,
                        borderRadius: '10px',
                        padding: '2px 6px',
                        minWidth: '18px',
                        textAlign: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }}>
                        {totalBadgeCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* RIGHT CONTENT - JSON Preview */}
              <div className="dialog-content-area" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {/* Changes Only Toggle - absolute positioned */}
                <button
                  className={`dialog-toggle ${changesOnly ? 'checked' : ''}`}
                  onClick={() => setChangesOnly(!changesOnly)}
                  style={{
                    position: 'absolute',
                    top: '2rem',
                    right: '2rem',
                    zIndex: 10
                  }}
                >
                  <div className="checkbox-box">
                    <Check size={14} />
                  </div>
                  <span>Changes only</span>
                </button>

                <div className="dialog-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <style>{`
                    .json-changed {
                      background: rgba(255, 204, 0, 0.3);
                      color: #ffcc00;
                      display: inline;
                    }
                  `}</style>
                  <pre
                    className="custom-scrollbar"
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      padding: '16px',
                      borderRadius: '8px',
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      flex: 1,
                      overflow: 'auto'
                    }}
                    dangerouslySetInnerHTML={{
                      __html: `[${renderHighlightedJson(getFilteredData(), getActiveTabChanges())}]`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <SaveProgressDialog saveProgress={saveProgress} />
    </>
  );
};

export default MatrixStatePanel;

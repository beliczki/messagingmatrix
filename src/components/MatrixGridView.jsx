import React, { useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { Plus, Edit2, Eye, Copy, Move, X, Circle, CheckCircle2 } from 'lucide-react';

// Default status colors matching Settings.jsx defaults
const DEFAULT_STATUS_COLORS = {
  INCOMING: '#8B5CF6',
  NAMING: '#EAB308',
  CONTENT: '#F97316',
  PREVIEW: '#3B82F6',
  APPROVED: '#22C55E',
  ACTIVE: '#15803D',
  INACTIVE: '#9CA3AF',
  ERROR: '#EF4444',
  DEAD: '#64748B',
  MEMORY: '#06B6D4'
};

// Move MessageCard outside to prevent recreation on every render
const MessageCard = memo(({
  msg,
  displayMode,
  lookAndFeel,
  isSelectMode,
  selectedMessages,
  shakingMessageId,
  onDragStart,
  setDraggedMsg,
  onDragEnd,
  onMessageMouseDown,
  onMessageMouseUp,
  onEditMessage,
  setActiveTab,
  lastClickRef,
  staticTemplates = []
}) => {
  const status = (msg.status || 'INCOMING').toUpperCase();
  // Use lookAndFeel.statusColors with proper defaults
  const statusColors = { ...DEFAULT_STATUS_COLORS, ...(lookAndFeel?.statusColors || {}) };
  const statusColorHex = statusColors[status] || DEFAULT_STATUS_COLORS.INCOMING;
  const bgColor = statusColorHex;

  // Calculate text color based on background
  const hex = (statusColorHex || '#ffff00').replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor = luminance > 0.5 ? '#1f2937' : '#ffffff';

  const isSelected = selectedMessages && selectedMessages.has(msg.id);
  const isShaking = shakingMessageId === msg.id;

  const handleMouseUp = (e) => {
    onMessageMouseUp && onMessageMouseUp(e, msg);
    if (isSelectMode) return;

    const now = Date.now();
    const timeDiff = now - lastClickRef.current.time;
    const sameMsg = lastClickRef.current.msgId === msg.id;

    if (sameMsg && timeDiff < 400) {
      e.stopPropagation();
      e.preventDefault();
      onEditMessage(msg);
      lastClickRef.current = { time: 0, msgId: null };
    } else {
      lastClickRef.current = { time: now, msgId: msg.id };
    }
  };

  return (
    <div
      draggable={!isSelectMode || isSelected}
      onDragStart={(e) => onDragStart(e, msg)}
      onDragEnd={() => {
        setDraggedMsg(null);
        onDragEnd && onDragEnd();
      }}
      onMouseDown={(e) => onMessageMouseDown && onMessageMouseDown(e, msg)}
      onMouseUp={handleMouseUp}
      className={`message-card group ${isShaking ? 'shake' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: displayMode === 'minimal' ? '6px 10px' : '8px 12px',
        borderRadius: '6px',
        cursor: isSelectMode ? (isSelected ? 'grab' : 'pointer') : 'pointer',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        border: isSelected ? '2px solid white' : '2px solid transparent',
        backgroundColor: bgColor,
        color: textColor,
        WebkitUserDrag: 'element',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        if (!isSelectMode) {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <span className="mc-number" style={{ fontWeight: '700', fontSize: '0.875rem' }}>
        {msg.number || ''}
      </span>
      <span className="mc-variant" style={{ fontSize: '0.7rem', opacity: 0.7 }}>
        {msg.variant || ''}
      </span>
      {(!msg.template || staticTemplates.includes(msg.template)) && (
        <span style={{
          fontSize: '0.6rem',
          opacity: 0.7,
          marginLeft: '4px',
          fontWeight: '700',
          letterSpacing: '0.03em',
          backgroundColor: 'rgba(0,0,0,0.2)',
          padding: '1px 3px',
          borderRadius: '2px'
        }}>
          IMG
        </span>
      )}
      {displayMode === 'informative' && msg.name && (
        <span style={{
          fontSize: '0.7rem',
          opacity: 0.8,
          marginLeft: '4px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '120px'
        }}>
          {msg.name}
        </span>
      )}
    </div>
  );
});

const MatrixGridView = ({
  matrixContainerRef,
  matrixZoom,
  matrixPan,
  spacePressed,
  displayMode,
  onDisplayModeChange,
  mcFilter,
  filteredAudiences,
  filteredTopics,
  lookAndFeel,
  getStatusColors,
  getMessages,
  statusFilters,
  draggedMsg,
  onWheel,
  onPanStart,
  onPanMove,
  onPanEnd,
  onEditAudience,
  onAddAudience,
  onEditTopic,
  onAddTopic,
  onAddMessage,
  onEditMessage,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  setDraggedMsg,
  setActiveTab,
  isSelectMode,
  selectedMessages,
  selectModeCell,
  onSelectAllInCell,
  onMoveOrCopyToCell,
  shakingMessageId,
  isDraggingSelected,
  isCopyMode,
  dragHoverCell,
  dragOriginCell,
  onMessageMouseDown,
  onMessageMouseUp,
  staticTemplates = []
}) => {
  const scrollContainerRef = useRef(null);
  const tableRef = useRef(null);
  const [scrolled, setScrolled] = React.useState({ x: false, y: false });

  // Track hovered cell using refs + DOM manipulation (no re-renders)
  const hoveredCellRef = useRef(null);

  // Update highlight classes without React re-render
  const updateHoverHighlight = useCallback((topicIndex, audienceIndex) => {
    const table = tableRef.current;
    if (!table) return;

    // Remove all existing highlights
    table.querySelectorAll('.cell-highlight, .row-highlight, .col-highlight').forEach(el => {
      el.classList.remove('cell-highlight', 'row-highlight', 'col-highlight');
    });
    // Reset header highlights (they use inline style instead of class)
    table.querySelectorAll('[data-highlighted="true"]').forEach(el => {
      el.dataset.highlighted = '';
      el.style.backgroundColor = 'var(--color-primary)';
    });

    if (topicIndex === null || audienceIndex === null) {
      hoveredCellRef.current = null;
      return;
    }

    hoveredCellRef.current = { topicIndex, audienceIndex };

    // Add highlights using data attributes
    // Highlight current cell
    const currentCell = table.querySelector(`[data-cell="${topicIndex}-${audienceIndex}"]`);
    if (currentCell) currentCell.classList.add('cell-highlight');

    // Highlight row header with color-mix (preserves opaque background for clipping)
    const rowHeader = table.querySelector(`[data-row="${topicIndex}"]`);
    if (rowHeader) {
      rowHeader.dataset.highlighted = 'true';
      rowHeader.style.backgroundColor = 'color-mix(in srgb, var(--color-primary) 90%, white 10%)';
    }

    // Highlight column header with color-mix (preserves opaque background for clipping)
    const colHeader = table.querySelector(`[data-col="${audienceIndex}"]`);
    if (colHeader) {
      colHeader.dataset.highlighted = 'true';
      colHeader.style.backgroundColor = 'color-mix(in srgb, var(--color-primary) 90%, white 10%)';
    }

    // Highlight cells in the path (same row to the left, same column above)
    for (let i = 0; i < audienceIndex; i++) {
      const pathCell = table.querySelector(`[data-cell="${topicIndex}-${i}"]`);
      if (pathCell) pathCell.classList.add('row-highlight');
    }
    for (let i = 0; i < topicIndex; i++) {
      const pathCell = table.querySelector(`[data-cell="${i}-${audienceIndex}"]`);
      if (pathCell) pathCell.classList.add('col-highlight');
    }
  }, []);

  // Helper function to filter messages by status and MC filter
  const filterMessages = (messages) => {
    let filtered = messages;

    if (statusFilters.length > 0) {
      filtered = filtered.filter(msg => {
        const msgStatus = (msg.status || 'INCOMING').toUpperCase();
        return statusFilters.includes(msgStatus);
      });
    }

    if (mcFilter && mcFilter.trim()) {
      const filterLower = mcFilter.trim().toLowerCase();
      filtered = filtered.filter(msg => {
        const msgNumber = String(msg.number || '').toLowerCase();
        const msgVariant = String(msg.variant || '').toLowerCase();
        const numberVariant = msgNumber + msgVariant;
        const mcNumberVariant = 'mc' + numberVariant;

        if (msgNumber.includes(filterLower) ||
            msgVariant.includes(filterLower) ||
            numberVariant.includes(filterLower) ||
            mcNumberVariant.includes(filterLower) ||
            filterLower.includes(msgNumber) ||
            filterLower.includes(numberVariant)) {
          return true;
        }

        if (msg.name && msg.name.toLowerCase().includes(filterLower)) return true;

        for (let i = 1; i <= 6; i++) {
          const imgField = msg['image' + i];
          if (imgField && imgField.toLowerCase().includes(filterLower)) return true;
        }

        if (msg.video1 && msg.video1.toLowerCase().includes(filterLower)) return true;
        if (msg.headline && msg.headline.toLowerCase().includes(filterLower)) return true;
        if (msg.copy1 && msg.copy1.toLowerCase().includes(filterLower)) return true;
        if (msg.copy2 && msg.copy2.toLowerCase().includes(filterLower)) return true;
        if (msg.cta && msg.cta.toLowerCase().includes(filterLower)) return true;
        if (msg.disclaimer && msg.disclaimer.toLowerCase().includes(filterLower)) return true;
        if (msg.sticker && msg.sticker.toLowerCase().includes(filterLower)) return true;
        if (msg.template && msg.template.toLowerCase().includes(filterLower)) return true;
        if (msg.template_variant_class && msg.template_variant_class.toLowerCase().includes(filterLower)) return true;

        return false;
      });
    }

    return filtered;
  };

  // Filter visible audiences and topics
  let visibleAudiences = filteredAudiences;
  let visibleTopics = filteredTopics;

  if (mcFilter && mcFilter.trim()) {
    visibleAudiences = filteredAudiences.filter(aud => {
      return filteredTopics.some(topic => {
        const msgs = getMessages(topic.key, aud.key);
        return filterMessages(msgs).length > 0;
      });
    });

    visibleTopics = filteredTopics.filter(topic => {
      return filteredAudiences.some(aud => {
        const msgs = getMessages(topic.key, aud.key);
        return filterMessages(msgs).length > 0;
      });
    });
  }

  // Count messages per audience (across all visible topics)
  const audienceMessageCounts = useMemo(() => {
    const counts = {};
    visibleAudiences.forEach(aud => {
      let count = 0;
      visibleTopics.forEach(topic => {
        const msgs = getMessages(topic.key, aud.key);
        const filtered = filterMessages(msgs);
        count += filtered.length;
      });
      counts[aud.key] = count;
    });
    return counts;
  }, [visibleAudiences, visibleTopics, getMessages, mcFilter, statusFilters]);

  // Use non-passive wheel event listener to properly prevent scroll when space is pressed
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      if (spacePressed) {
        // Space + wheel = zoom only, prevent scroll completely
        e.preventDefault();
        e.stopPropagation();
        onWheel && onWheel(e);
        return false;
      }
      // Without space, let native scrolling happen
    };

    // Must use { passive: false } to allow preventDefault() on wheel events
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [spacePressed, onWheel]);

  // Track scroll position for shadow effects
  const handleScroll = useCallback((e) => {
    const container = e.target;
    setScrolled({
      x: container.scrollLeft > 0,
      y: container.scrollTop > 0
    });
  }, []);

  // Sync container ref
  useEffect(() => {
    if (matrixContainerRef) {
      matrixContainerRef.current = scrollContainerRef.current;
    }
  }, [matrixContainerRef]);

  // Cell dimensions
  const cellWidth = displayMode === 'minimal' ? 180 : 250;
  const firstColWidth = 200;

  // Track last click for double-click detection (draggable elements don't fire onDoubleClick reliably)
  const lastClickRef = useRef({ time: 0, msgId: null });

  // Function to determine if text should be dark or light based on background color
  const getTextColor = (hexColor) => {
    const hex = (hexColor || '#ffff00').replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1f2937' : '#ffffff';
  };

  // Shadow styles for sticky elements - 40px shadows, clipped to only cast in intended direction
  const headerShadow = scrolled.y ? '0 8px 40px -4px rgba(0,0,0,0.2)' : 'none';
  const columnShadow = scrolled.x ? '8px 0 40px -4px rgba(0,0,0,0.2)' : 'none';
  const cornerShadow = (scrolled.x && scrolled.y) ? '8px 8px 40px -4px rgba(0,0,0,0.25)' :
                       scrolled.x ? '8px 0 40px -4px rgba(0,0,0,0.2)' :
                       scrolled.y ? '0 8px 40px -4px rgba(0,0,0,0.2)' : 'none';
  // Clip paths to restrict shadow direction - prevents shadow from bleeding into neighboring sticky cells
  const headerClip = 'inset(0 0 -50px 0)';      // Allow shadow only below
  const columnClip = 'inset(0 -50px 0 0)';      // Allow shadow only to the right
  const cornerClip = 'inset(0 -50px -50px 0)';  // Allow shadow below and to the right

  // Show empty state when no data
  if (visibleAudiences.length === 0 && visibleTopics.length === 0) {
    return (
      <div
        className="matrix-grid-scroll custom-scrollbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '1.25rem'
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ marginBottom: '1rem' }}>No audiences or topics match the current filters.</p>
          <p style={{ opacity: 0.7, fontSize: '0.875rem' }}>
            Try adjusting the Product or Status filters in the toolbar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="matrix-grid-scroll custom-scrollbar"
      style={{
        cursor: spacePressed ? 'grab' : 'default'
      }}
      onScroll={handleScroll}
      onMouseDown={onPanStart}
      onMouseMove={onPanMove}
      onMouseUp={onPanEnd}
      onMouseLeave={() => { onPanEnd(); updateHoverHighlight(null, null); }}
    >
      {/* Use CSS zoom instead of transform - this preserves sticky behavior */}
      <div style={{ zoom: matrixZoom }}>
        <table ref={tableRef} style={{ tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: '2px' }}>
          <thead>
            <tr>
              {/* Corner cell - sticky top and left */}
              <th
                style={{
                  position: 'sticky',
                  top: 0,
                  left: 0,
                  zIndex: 30,
                  width: firstColWidth,
                  minWidth: firstColWidth,
                  backgroundColor: 'var(--color-primary)',
                  opacity: 0.85,
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  boxShadow: cornerShadow,
                  clipPath: cornerClip,
                  transition: 'box-shadow 0.2s ease-in-out'
                }}
                onMouseEnter={() => updateHoverHighlight(null, null)}
              >
                {/* Empty corner - filters are in toolbar */}
              </th>

              {/* Audience headers - sticky top */}
              {visibleAudiences.map((aud, audIndex) => {
                const strategyPrefix = aud.strategy ? aud.strategy.substring(0, 3).toUpperCase() : '';
                // Get bottom border color based on strategy type (pro/rem)
                const strategyLower = (aud.strategy || '').toLowerCase();
                const secondaryColor1 = lookAndFeel?.secondaryColor1 || '#eb4c79';
                const secondaryColor2 = lookAndFeel?.secondaryColor2 || '#02a3a4';
                const productBorderColor = strategyLower.startsWith('pro') ? secondaryColor1 :
                                          strategyLower.startsWith('rem') ? secondaryColor2 : secondaryColor1;
                return (
                  <th
                    key={aud.key}
                    data-col={audIndex}
                    className="matrix-audience-header"
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 20,
                      width: cellWidth,
                      minWidth: cellWidth,
                      height: '8.5rem',
                      backgroundColor: 'var(--color-primary)',
                      opacity: 0.85,
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      borderBottom: `3px solid ${productBorderColor}`,
                      borderRadius: '0 0 8px 8px',
                      boxShadow: headerShadow,
                      clipPath: headerClip,
                      transition: 'background 0.15s ease, box-shadow 0.2s ease-in-out',
                      padding: '12px',
                      verticalAlign: 'bottom'
                    }}
                    onMouseEnter={() => updateHoverHighlight(null, null)}
                  >
                    <div className="group relative">
                      {/* Product tag on top */}
                      {aud.product && (
                        <span className="audience-tag product" style={{
                          background: 'rgba(255, 255, 255, 0.2)',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: '500',
                          display: 'inline-block',
                          marginBottom: '8px'
                        }}>
                          {aud.product}
                        </span>
                      )}
                      {/* Name */}
                      <div className="audience-name" style={{
                        fontWeight: '600',
                        color: 'white',
                        marginBottom: '8px',
                        fontSize: '1rem'
                      }}>
                        {aud.name}
                      </div>
                      {/* Tags at bottom - centered */}
                      {displayMode === 'informative' && (
                        <div className="audience-tags" style={{
                          display: 'flex',
                          gap: '4px',
                          flexWrap: 'wrap',
                          justifyContent: 'center'
                        }}>
                          {strategyPrefix && (
                            <span className="audience-tag" style={{
                              background: 'rgba(255, 255, 255, 0.2)',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.65rem',
                              fontWeight: '500'
                            }}>
                              {strategyPrefix}
                            </span>
                          )}
                          {aud.lineitem_id && (
                            <span className="audience-tag" style={{
                              background: 'rgba(255, 255, 255, 0.2)',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.65rem',
                              fontWeight: '500'
                            }}>
                              {aud.lineitem_id}
                            </span>
                          )}
                          <span className="audience-tag" style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: '500'
                          }}>
                            {aud.key}
                          </span>
                          {audienceMessageCounts[aud.key] > 0 && (
                            <span className="audience-tag message-count" style={{
                              background: 'rgba(255, 255, 255, 0.35)',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.65rem',
                              fontWeight: '600'
                            }}>
                              {audienceMessageCounts[aud.key]} MC
                            </span>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => onEditAudience(aud)}
                        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                        style={{ color: 'white' }}
                        title="Edit audience"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  </th>
                );
              })}

              {/* Add audience column */}
              <th
                className="p-2"
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                  width: '20rem',
                  minWidth: '20rem',
                  backgroundColor: 'var(--color-primary)',
                  boxShadow: headerShadow,
                  clipPath: headerClip,
                  transition: 'box-shadow 0.2s ease-in-out'
                }}
              >
                {!spacePressed && !isDraggingSelected && (
                  <button
                    onClick={onAddAudience}
                    className="w-full h-full p-2 rounded"
                    style={{ color: 'rgba(255, 255, 255, 0.7)' }}
                    title="Add Audience"
                  >
                    <Plus size={20} />
                  </button>
                )}
              </th>
            </tr>
          </thead>

          <tbody>
            {visibleTopics.map((topic, topicIndex) => {
              // Check if this row is completely empty (for cross-row move feature)
              const isRowEmpty = visibleAudiences.every(aud => {
                const msgs = getMessages(topic.key, aud.key);
                return filterMessages(msgs).length === 0;
              });

              return (
                <tr key={topic.key}>
                  {/* Topic cell - sticky left */}
                  <td
                    data-row={topicIndex}
                    className="matrix-topic-header"
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      width: firstColWidth,
                      minWidth: firstColWidth,
                      maxWidth: firstColWidth,
                      backgroundColor: 'var(--color-primary)',
                      opacity: 0.85,
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      borderRight: '3px solid white',
                      borderRadius: '0 8px 8px 0',
                      padding: '12px',
                      verticalAlign: 'top',
                      textAlign: 'right',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={() => updateHoverHighlight(null, null)}
                  >
                    <div className="group relative">
                      {/* Product tag on top - right aligned */}
                      {topic.product && (
                        <span className="topic-tag product" style={{
                          background: 'rgba(255, 255, 255, 0.2)',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: '500',
                          display: 'inline-block',
                          marginBottom: '8px'
                        }}>
                          {topic.product}
                        </span>
                      )}
                      {/* Name - right aligned */}
                      <div className="topic-name" style={{
                        fontWeight: '600',
                        color: 'white',
                        marginBottom: '8px',
                        fontSize: displayMode === 'minimal' ? '0.875rem' : '1rem'
                      }}>
                        {topic.name}
                      </div>
                      {/* Tags at bottom - right aligned */}
                      {displayMode === 'informative' && (
                        <div className="topic-tags" style={{
                          display: 'flex',
                          gap: '4px',
                          flexWrap: 'wrap',
                          justifyContent: 'flex-end'
                        }}>
                          {[topic.tag1, topic.tag2, topic.tag3, topic.tag4].filter(Boolean).map((tag, idx) => (
                            <span key={idx} className="topic-tag" style={{
                              background: 'rgba(255, 255, 255, 0.2)',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.65rem',
                              fontWeight: '500'
                            }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => onEditTopic(topic)}
                        className="absolute top-0 left-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                        style={{ color: 'white' }}
                        title="Edit topic"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  </td>

                  {/* Message cells - style-guide design */}
                  {visibleAudiences.map((aud, audIndex) => {
                    const allCellMsgs = getMessages(topic.key, aud.key);
                    const cellMsgs = filterMessages(allCellMsgs);

                    const isHoverCell = dragHoverCell && dragHoverCell.topic === topic.key && dragHoverCell.audience === aud.key;
                    const isDragging = draggedMsg !== null || isDraggingSelected;
                    const isOriginCell = dragOriginCell && dragOriginCell.topic === topic.key && dragOriginCell.audience === aud.key;
                    const isSameRowDrop = isDragging && draggedMsg && draggedMsg.topic === topic.key && !isOriginCell;
                    const isCrossRowDrop = isDragging && draggedMsg && draggedMsg.topic !== topic.key && isRowEmpty;
                    const isValidDropZone = isSameRowDrop || isCrossRowDrop;

                    // Drag-related background colors only (hover highlight handled via CSS)
                    let cellBgColor = 'var(--color-primary)';
                    if (isHoverCell && isOriginCell) {
                      cellBgColor = 'rgba(255,255,255,0.05)';
                    } else if (isHoverCell && isValidDropZone) {
                      // Copy: blue, Move (same-row or cross-row): green
                      cellBgColor = isCopyMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(34, 197, 94, 0.3)';
                    } else if (isHoverCell && !isValidDropZone) {
                      cellBgColor = 'rgba(239, 68, 68, 0.2)';
                    }

                    return (
                      <td
                        key={aud.key}
                        data-cell={`${topicIndex}-${audIndex}`}
                        className="matrix-cell-content group/cell"
                        style={{
                          width: cellWidth,
                          minWidth: cellWidth,
                          padding: '12px',
                          backgroundColor: cellBgColor,
                          transition: 'background 0.15s ease',
                          verticalAlign: cellMsgs.length === 0 ? 'middle' : 'top',
                          position: 'relative',
                          borderRight: '1px solid rgba(255,255,255,0.1)',
                          borderBottom: '1px solid rgba(255,255,255,0.1)',
                          height: cellMsgs.length === 0 ? '80px' : 'auto'
                        }}
                        onDragOver={(e) => onDragOver(e, topic.key, aud.key)}
                        onDrop={(e) => onDrop(e, topic.key, aud.key)}
                        onMouseEnter={() => {
                          if (!isDragging) {
                            updateHoverHighlight(topicIndex, audIndex);
                          }
                        }}
                        onMouseLeave={() => {
                          if (!isDragging) {
                            updateHoverHighlight(null, null);
                          }
                        }}
                      >
                        {isHoverCell && isValidDropZone && (
                          <div style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            backgroundColor: isCopyMode ? '#3B82F6' : '#22C55E',
                            color: 'white'
                          }}>
                            {isCopyMode ? (
                              <>
                                <Copy size={12} />
                                <span>COPY</span>
                              </>
                            ) : isCrossRowDrop ? (
                              <>
                                <Move size={12} />
                                <span>MOVE TO ROW</span>
                              </>
                            ) : (
                              <>
                                <Move size={12} />
                                <span>MOVE</span>
                              </>
                            )}
                          </div>
                        )}
                        {isHoverCell && isOriginCell && (
                          <div style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            backgroundColor: 'rgba(255,255,255,0.3)',
                            color: 'white'
                          }}>
                            <X size={12} />
                            <span>ORIGIN</span>
                          </div>
                        )}
                        {/* Message cards container - flex wrap, center when empty */}
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                          alignItems: 'flex-start',
                          justifyContent: cellMsgs.length === 0 ? 'center' : 'flex-start',
                          textAlign: cellMsgs.length === 0 ? 'center' : 'left',
                          width: '100%'
                        }}>
                          {cellMsgs.map((msg) => (
                            <MessageCard
                              key={msg.id}
                              msg={msg}
                              displayMode={displayMode}
                              lookAndFeel={lookAndFeel}
                              isSelectMode={isSelectMode}
                              selectedMessages={selectedMessages}
                              shakingMessageId={shakingMessageId}
                              onDragStart={onDragStart}
                              setDraggedMsg={setDraggedMsg}
                              onDragEnd={onDragEnd}
                              onMessageMouseDown={onMessageMouseDown}
                              onMessageMouseUp={onMessageMouseUp}
                              onEditMessage={onEditMessage}
                              setActiveTab={setActiveTab}
                              lastClickRef={lastClickRef}
                              staticTemplates={staticTemplates}
                            />
                          ))}

                          {/* Selection mode: Select all button in cells with messages */}
                          {isSelectMode && cellMsgs.length > 0 && selectModeCell?.topic === topic.key && selectModeCell?.audience === aud.key && (
                            <button
                              onClick={() => onSelectAllInCell(topic.key, aud.key)}
                              style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                border: 'none',
                                background: 'rgba(255,255,255,0.2)',
                                color: 'rgba(255,255,255,0.8)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.4)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                              }}
                              title={cellMsgs.every(m => selectedMessages.has(m.id)) ? 'Deselect all in cell' : 'Select all in cell'}
                            >
                              {cellMsgs.every(m => selectedMessages.has(m.id)) ? (
                                <CheckCircle2 size={16} />
                              ) : (
                                <Circle size={16} />
                              )}
                            </button>
                          )}

                          {/* Selection mode: Move/Copy here button in empty cells - same row or empty destination row */}
                          {isSelectMode && selectedMessages.size > 0 && cellMsgs.length === 0 && (selectModeCell?.topic === topic.key || isRowEmpty) && (() => {
                            const isCrossRowTarget = selectModeCell?.topic !== topic.key && isRowEmpty;
                            return (
                              <button
                                onClick={() => onMoveOrCopyToCell(topic.key, aud.key, isCopyMode)}
                                className="hidden group-hover/cell:flex"
                                style={{
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '12px 20px',
                                  borderRadius: '8px',
                                  border: '2px dashed rgba(255,255,255,0.3)',
                                  background: 'transparent',
                                  color: 'rgba(255,255,255,0.5)',
                                  fontSize: '0.875rem',
                                  fontWeight: '500',
                                  gap: '6px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
                                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                                }}
                              >
                                {isCopyMode ? (
                                  <>
                                    <Copy size={18} />
                                    <span>Copy here</span>
                                  </>
                                ) : isCrossRowTarget ? (
                                  <>
                                    <Move size={18} />
                                    <span>Move to row</span>
                                  </>
                                ) : (
                                  <>
                                    <Move size={18} />
                                    <span>Move here</span>
                                  </>
                                )}
                              </button>
                            );
                          })()}

                          {/* Add message button - shows on cell hover, bigger when cell is empty (hidden in selection mode) */}
                          {!isSelectMode && !spacePressed && !isDraggingSelected && (
                            <button
                              onClick={() => onAddMessage(topic.key, aud.key)}
                              className="hidden group-hover/cell:flex"
                              style={{
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: cellMsgs.length === 0 ? '12px 20px' : '8px 10px',
                                borderRadius: cellMsgs.length === 0 ? '8px' : '6px 0 0 0',
                                border: cellMsgs.length === 0
                                  ? '2px dashed rgba(255,255,255,0.3)'
                                  : '1px dashed rgba(255,255,255,0.3)',
                                borderRight: cellMsgs.length === 0 ? '2px dashed rgba(255,255,255,0.3)' : 'none',
                                borderBottom: cellMsgs.length === 0 ? '2px dashed rgba(255,255,255,0.3)' : 'none',
                                background: 'transparent',
                                color: 'rgba(255,255,255,0.5)',
                                cursor: 'pointer',
                                fontSize: cellMsgs.length === 0 ? '1rem' : '0.7rem',
                                fontWeight: '500',
                                transition: 'all 0.15s ease',
                                ...(cellMsgs.length > 0 ? {
                                  position: 'absolute',
                                  bottom: 0,
                                  right: 0
                                } : {})
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <Plus size={cellMsgs.length === 0 ? 20 : 14} />
                              {cellMsgs.length === 0 && displayMode !== 'minimal' && <span style={{ marginLeft: '6px' }}>Add Message</span>}
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  {/* Empty end cell */}
                  <td style={{ width: '20rem', minWidth: '20rem', backgroundColor: 'var(--color-primary)' }}></td>
                </tr>
              );
            })}

            {/* Add topic row */}
            <tr>
              <td
                className="p-2"
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 10,
                  backgroundColor: 'var(--color-primary)',
                  boxShadow: columnShadow,
                  clipPath: columnClip,
                  transition: 'box-shadow 0.2s ease-in-out'
                }}
              >
                {!spacePressed && !isDraggingSelected && (
                  <button
                    onClick={onAddTopic}
                    className="w-full h-full p-2 rounded"
                    style={{ color: 'rgba(255, 255, 255, 0.7)' }}
                    title="Add Topic"
                  >
                    <Plus size={20} />
                  </button>
                )}
              </td>
              {visibleAudiences.map((aud) => (
                <td key={aud.key} style={{ backgroundColor: 'var(--color-primary)' }}></td>
              ))}
              <td style={{ width: '20rem', minWidth: '20rem', height: '20rem', backgroundColor: 'var(--color-primary)' }}></td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default MatrixGridView;

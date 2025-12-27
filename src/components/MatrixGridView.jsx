import React, { useRef, useEffect, useCallback } from 'react';
import { Plus, Edit2, Eye, Check, Copy, Move, X } from 'lucide-react';

const MatrixGridView = ({
  matrixContainerRef,
  matrixZoom,
  matrixPan,
  spacePressed,
  displayMode,
  onDisplayModeChange,
  audienceFilter,
  topicFilter,
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
  onAudienceFilterChange,
  onTopicFilterChange,
  onMcFilterChange,
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
  isDraggingSelected,
  isCopyMode,
  dragHoverCell,
  dragOriginCell,
  onMessageMouseDown,
  onMessageMouseUp
}) => {
  const scrollContainerRef = useRef(null);
  const [scrolled, setScrolled] = React.useState({ x: false, y: false });

  // Helper function to filter messages by status and MC filter
  const filterMessages = (messages) => {
    let filtered = messages;

    if (statusFilters.length > 0) {
      filtered = filtered.filter(msg => {
        const msgStatus = (msg.status || 'PLANNED').toUpperCase();
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

  // Message card component
  const MessageCard = ({ msg }) => {
    const status = (msg.status || 'PLANNED').toUpperCase();
    const statusColorHex = lookAndFeel?.statusColors?.[status] || '#ffff00';
    const bgColor = statusColorHex;
    const textColor = getTextColor(statusColorHex);
    const isSelected = selectedMessages && selectedMessages.has(msg.id);

    const handleMouseUp = (e) => {
      // First call the parent handler
      onMessageMouseUp && onMessageMouseUp(e, msg);

      // Don't handle double-click in select mode
      if (isSelectMode) return;

      const now = Date.now();
      const timeDiff = now - lastClickRef.current.time;
      const sameMsg = lastClickRef.current.msgId === msg.id;

      // Double-click detected (within 400ms on same message)
      if (sameMsg && timeDiff < 400) {
        e.stopPropagation();
        e.preventDefault();
        console.log('🖱️ Double-click detected, opening editor for:', msg.id);
        onEditMessage(msg);
        setActiveTab('naming');
        lastClickRef.current = { time: 0, msgId: null }; // Reset
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
        className={`border rounded ${displayMode === 'minimal' ? 'p-1' : 'p-2'} hover:shadow group relative select-none ${
          isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
        } ${isSelectMode ? (isSelected ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer') : 'cursor-move'}`}
        style={{
          backgroundColor: isSelected ? '#EFF6FF' : bgColor,
          borderColor: isSelected ? '#3B82F6' : bgColor,
          borderWidth: '2px',
          color: isSelected ? '#1f2937' : textColor,
          WebkitUserDrag: 'element'
        }}
      >
        {isSelectMode && isSelected && (
          <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-500 text-white rounded-full p-1 shadow-md z-10">
            <Move size={12} />
          </div>
        )}
        <div className={`flex items-start gap-2 ${isSelectMode && isSelected ? 'pointer-events-none' : ''}`}>
          {isSelectMode && (
            <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
              isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
            }`}>
              {isSelected && <Check size={14} className="text-white" />}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-1">
                <span className="font-bold" style={{ color: isSelected ? '#2563eb' : textColor }}>{msg.number || ''}</span>
                <span className="text-xs font-semibold" style={{ opacity: 0.7 }}>{msg.variant || ''}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditMessage(msg);
                    setActiveTab('naming');
                  }}
                  className="p-0.5 hover:bg-white/30 rounded transition-colors"
                  title="Edit naming"
                >
                  <Edit2 size={12} style={{ color: isSelected ? '#4b5563' : textColor }} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditMessage(msg);
                    setActiveTab('content');
                  }}
                  className="p-0.5 hover:bg-white/30 rounded transition-colors"
                  title="Preview content"
                >
                  <Eye size={12} style={{ color: isSelected ? '#4b5563' : textColor }} />
                </button>
              </div>
            </div>
            {displayMode === 'informative' && (
              <p className="text-sm whitespace-pre-wrap break-words" style={{ opacity: 0.85 }}>
                {msg.name || 'No name'}
              </p>
            )}
          </div>
        </div>
      </div>
    );
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

  return (
    <div
      ref={scrollContainerRef}
      className="bg-white rounded-lg shadow"
      style={{
        height: 'calc(100vh - 97px - 57px)',
        overflow: 'auto',
        cursor: spacePressed ? 'grab' : 'default'
      }}
      onScroll={handleScroll}
      onMouseDown={onPanStart}
      onMouseMove={onPanMove}
      onMouseUp={onPanEnd}
      onMouseLeave={onPanEnd}
    >
      {/* Use CSS zoom instead of transform - this preserves sticky behavior */}
      <div style={{ zoom: matrixZoom }}>
        <table style={{ tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              {/* Corner cell - sticky top and left */}
              <th
                className="p-2"
                style={{
                  position: 'sticky',
                  top: 0,
                  left: 0,
                  zIndex: 30,
                  width: firstColWidth,
                  minWidth: firstColWidth,
                  backgroundColor: '#f3f4f6',
                  borderRight: '1px solid #d1d5db',
                  borderBottom: '1px solid #d1d5db',
                  boxShadow: cornerShadow,
                  clipPath: cornerClip,
                  transition: 'box-shadow 0.2s ease-in-out'
                }}
              >
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={audienceFilter}
                    onChange={(e) => onAudienceFilterChange(e.target.value)}
                    placeholder="Filter Audiences"
                    className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={topicFilter}
                    onChange={(e) => onTopicFilterChange(e.target.value)}
                    placeholder="Filter Topics"
                    className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={mcFilter}
                      onChange={(e) => onMcFilterChange(e.target.value)}
                      placeholder="Search MC, name, images..."
                      className="flex-1 px-2 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => onDisplayModeChange(displayMode === 'informative' ? 'minimal' : 'informative')}
                      className="p-2 bg-gray-200 hover:bg-gray-300 rounded transition-colors flex-shrink-0"
                      title={displayMode === 'informative' ? 'Switch to Minimal view' : 'Switch to Informative view'}
                    >
                      <Eye size={displayMode === 'informative' ? 20 : 14} className="text-gray-600" />
                    </button>
                  </div>
                </div>
              </th>

              {/* Audience headers - sticky top */}
              {visibleAudiences.map((aud) => {
                const colors = getStatusColors(aud.status);
                const strategyPrefix = aud.strategy ? aud.strategy.substring(0, 3).toUpperCase() : '';
                // Get background color from colors.bg class or default
                const bgColor = colors.bg?.includes('blue') ? '#dbeafe' :
                               colors.bg?.includes('green') ? '#dcfce7' :
                               colors.bg?.includes('yellow') ? '#fef9c3' :
                               colors.bg?.includes('red') ? '#fee2e2' :
                               colors.bg?.includes('purple') ? '#f3e8ff' :
                               colors.bg?.includes('gray') ? '#f3f4f6' : '#dbeafe';
                // Get bottom border color based on strategy type (pro/rem)
                const strategyLower = (aud.strategy || '').toLowerCase();
                const secondaryColor1 = lookAndFeel?.secondaryColor1 || '#eb4c79';
                const secondaryColor2 = lookAndFeel?.secondaryColor2 || '#02a3a4';
                const productBorderColor = strategyLower.startsWith('pro') ? secondaryColor2 :
                                          strategyLower.startsWith('rem') ? secondaryColor1 : null;
                return (
                  <th
                    key={aud.key}
                    className="p-4"
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 20,
                      width: cellWidth,
                      minWidth: cellWidth,
                      backgroundColor: bgColor,
                      borderRight: '1px solid #d1d5db',
                      borderBottom: productBorderColor ? `5px solid ${productBorderColor}` : '1px solid #d1d5db',
                      boxShadow: headerShadow,
                      clipPath: headerClip,
                      transition: 'box-shadow 0.2s ease-in-out'
                    }}
                  >
                    <div className="group relative">
                      <div className={`font-semibold text-lg mb-2 ${colors.text || 'text-blue-700'}`}>{aud.name}</div>
                      {displayMode === 'informative' && (
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {aud.product && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${colors.keyBg || 'bg-blue-100'} ${colors.keyText || 'text-blue-600'}`}>
                              {aud.product}
                            </span>
                          )}
                          {strategyPrefix && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${colors.keyBg || 'bg-blue-100'} ${colors.keyText || 'text-blue-600'}`}>
                              {strategyPrefix}
                            </span>
                          )}
                          {aud.lineitem_id && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${colors.keyBg || 'bg-blue-100'} ${colors.keyText || 'text-blue-600'}`}>
                              {aud.lineitem_id}
                            </span>
                          )}
                          <div className={`text-xs px-2 py-1 rounded inline-block ${colors.keyBg || 'bg-blue-100'} ${colors.keyText || 'text-blue-600'}`}>
                            {aud.key}
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => onEditAudience(aud)}
                        className={`absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-blue-100`}
                        title="Edit audience"
                      >
                        <Edit2 size={14} className={colors.text || 'text-blue-600'} />
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
                  width: 50,
                  minWidth: 50,
                  backgroundColor: '#f9fafb',
                  borderRight: '1px solid #d1d5db',
                  borderBottom: '1px solid #d1d5db',
                  boxShadow: headerShadow,
                  clipPath: headerClip,
                  transition: 'box-shadow 0.2s ease-in-out'
                }}
              >
                {!spacePressed && !isDraggingSelected && (
                  <button
                    onClick={onAddAudience}
                    className="w-full h-full p-2 text-blue-500 hover:bg-blue-50 rounded"
                    title="Add Audience"
                  >
                    <Plus size={20} />
                  </button>
                )}
              </th>
            </tr>
          </thead>

          <tbody>
            {visibleTopics.map((topic) => {
              const colors = getStatusColors(topic.status);
              // Get background color from colors.bg class or default
              const topicBgColor = colors.bg?.includes('blue') ? '#dbeafe' :
                                  colors.bg?.includes('green') ? '#dcfce7' :
                                  colors.bg?.includes('yellow') ? '#fef9c3' :
                                  colors.bg?.includes('red') ? '#fee2e2' :
                                  colors.bg?.includes('purple') ? '#f3e8ff' :
                                  colors.bg?.includes('gray') ? '#f3f4f6' : '#dcfce7';
              return (
                <tr key={topic.key}>
                  {/* Topic cell - sticky left */}
                  <td
                    className={`${displayMode === 'minimal' ? 'p-2' : 'p-4'} align-top`}
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      width: firstColWidth,
                      minWidth: firstColWidth,
                      backgroundColor: topicBgColor,
                      borderRight: '1px solid #d1d5db',
                      borderBottom: '1px solid #d1d5db',
                      boxShadow: columnShadow,
                      clipPath: columnClip,
                      transition: 'box-shadow 0.2s ease-in-out'
                    }}
                  >
                    <div className="group relative">
                      <div className={`font-semibold ${displayMode === 'minimal' ? 'text-base' : 'text-lg'} mb-1 ${colors.text || 'text-green-700'}`}>
                        {topic.name}
                      </div>
                      {displayMode === 'informative' && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {topic.product && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${colors.keyBg || 'bg-green-100'} ${colors.keyText || 'text-green-600'}`}>
                              {topic.product}
                            </span>
                          )}
                          <div className={`text-xs px-2 py-1 rounded inline-block ${colors.keyBg || 'bg-green-100'} ${colors.keyText || 'text-green-600'}`}>
                            {topic.key}
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => onEditTopic(topic)}
                        className={`absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-green-100`}
                        title="Edit topic"
                      >
                        <Edit2 size={14} className={colors.text || 'text-green-600'} />
                      </button>
                    </div>
                  </td>

                  {/* Message cells */}
                  {visibleAudiences.map((aud) => {
                    const allCellMsgs = getMessages(topic.key, aud.key);
                    const cellMsgs = filterMessages(allCellMsgs);

                    const isHoverCell = dragHoverCell && dragHoverCell.topic === topic.key && dragHoverCell.audience === aud.key;
                    const isDragging = draggedMsg !== null || isDraggingSelected;
                    const isOriginCell = dragOriginCell && dragOriginCell.topic === topic.key && dragOriginCell.audience === aud.key;
                    const isValidDropZone = isDragging && draggedMsg && draggedMsg.topic === topic.key && !isOriginCell;

                    return (
                      <td
                        key={aud.key}
                        className={`${displayMode === 'minimal' ? 'p-1' : 'p-2'} align-top transition-colors relative group/cell`}
                        style={{
                          width: cellWidth,
                          minWidth: cellWidth,
                          minHeight: displayMode === 'minimal' ? 40 : 100,
                          borderRight: '1px solid #d1d5db',
                          borderBottom: '1px solid #d1d5db',
                          backgroundColor: isHoverCell && isOriginCell ? '#f3f4f6' :
                                          isHoverCell && isValidDropZone ? (isCopyMode ? '#dbeafe' : '#dcfce7') :
                                          isHoverCell && !isValidDropZone ? '#fee2e2' : '#ffffff'
                        }}
                        onDragOver={(e) => onDragOver(e, topic.key, aud.key)}
                        onDrop={(e) => onDrop(e, topic.key, aud.key)}
                      >
                        {isHoverCell && isValidDropZone && (
                          <div className={`absolute top-1 right-1 flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                            isCopyMode ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'
                          }`}>
                            {isCopyMode ? (
                              <>
                                <Copy size={12} />
                                <span>COPY</span>
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
                          <div className="absolute top-1 right-1 flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-gray-400 text-white">
                            <X size={12} />
                            <span>ORIGIN</span>
                          </div>
                        )}
                        <div className={`${displayMode === 'minimal' ? 'flex flex-wrap gap-1' : 'space-y-2'}`}>
                          {cellMsgs.map((msg) => (
                            <MessageCard key={msg.id} msg={msg} />
                          ))}

                          {!spacePressed && !isDraggingSelected && (
                            <button
                              onClick={() => onAddMessage(topic.key, aud.key)}
                              className={`${displayMode === 'minimal' ? 'w-auto px-2' : 'w-full'} border-2 border-dashed border-gray-300 rounded p-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 hidden group-hover/cell:block`}
                            >
                              {displayMode === 'minimal' ? '+' : '+ Add Message'}
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  <td style={{ width: 50, minWidth: 50, borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db', backgroundColor: '#ffffff' }}></td>
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
                  backgroundColor: '#f9fafb',
                  borderRight: '1px solid #d1d5db',
                  borderBottom: '1px solid #d1d5db',
                  boxShadow: columnShadow,
                  clipPath: columnClip,
                  transition: 'box-shadow 0.2s ease-in-out'
                }}
              >
                {!spacePressed && !isDraggingSelected && (
                  <button
                    onClick={onAddTopic}
                    className="w-full h-full p-2 text-green-500 hover:bg-green-50 rounded"
                    title="Add Topic"
                  >
                    <Plus size={20} />
                  </button>
                )}
              </td>
              {visibleAudiences.map((aud) => (
                <td key={aud.key} style={{ borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db', backgroundColor: '#ffffff' }}></td>
              ))}
              <td style={{ borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db', backgroundColor: '#ffffff' }}></td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default MatrixGridView;

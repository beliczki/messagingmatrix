import React from 'react';
import { Plus, Edit2, Eye, Check, Copy, Move, X } from 'lucide-react';

const MatrixGridView = ({
  matrixContainerRef,
  matrixZoom,
  matrixPan,
  spacePressed,
  displayMode,
  audienceFilter,
  topicFilter,
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
  return (
    <div
      ref={matrixContainerRef}
      className="bg-white rounded-lg shadow overflow-hidden"
      style={{
        height: 'calc(100vh - 97px - 57px)',
        position: 'relative',
        cursor: spacePressed ? 'grab' : 'default'
      }}
      onWheel={onWheel}
      onMouseDown={onPanStart}
      onMouseMove={onPanMove}
      onMouseUp={onPanEnd}
      onMouseLeave={onPanEnd}
    >
      <div style={{
        transform: `translate(${matrixPan.x}px, ${matrixPan.y}px) scale(${matrixZoom})`,
        transformOrigin: 'top left',
        display: 'inline-block',
        minWidth: '100%'
      }}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 p-2 bg-gray-100 min-w-[200px]">
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
                </div>
              </th>
              {filteredAudiences.map((aud) => {
                const colors = getStatusColors(aud.status);
                const strategyPrefix = aud.strategy ? aud.strategy.substring(0, 3).toUpperCase() : '';
                return (
                  <th key={aud.key} className={`border p-4 min-w-[250px] ${colors.bg} ${colors.border || 'border-gray-300'}`}>
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
                          <div className={`text-xs px-2 py-1 rounded inline-block ${colors.keyBg || 'bg-blue-100'} ${colors.keyText || 'text-blue-600'}`}>
                            {aud.key}
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => onEditAudience(aud)}
                        className={`absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded ${colors.keyBg ? `hover:${colors.keyBg}` : 'hover:bg-blue-100'}`}
                        title="Edit audience"
                      >
                        <Edit2 size={14} className={colors.text || 'text-blue-600'} />
                      </button>
                    </div>
                  </th>
                );
              })}
              <th className="border border-gray-300 p-2">
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
            {filteredTopics.map((topic) => {
              const colors = getStatusColors(topic.status);
              return (
                <tr key={topic.key}>
                  <td className={`border ${displayMode === 'minimal' ? 'p-2' : 'p-4'} ${colors.bg || 'bg-green-50'} ${colors.border || 'border-gray-300'}`}>
                    <div className="group relative">
                      <div className={`font-semibold ${displayMode === 'minimal' ? 'text-base' : 'text-lg'} mb-1 ${colors.text || 'text-green-700'}`}>{topic.name}</div>
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
                        className={`absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded ${colors.keyBg ? `hover:${colors.keyBg}` : 'hover:bg-green-100'}`}
                        title="Edit topic"
                      >
                        <Edit2 size={14} className={colors.text || 'text-green-600'} />
                      </button>
                    </div>
                  </td>

                  {filteredAudiences.map((aud) => {
                    const allCellMsgs = getMessages(topic.key, aud.key);

                    // Filter messages by status if any status filters are selected
                    const cellMsgs = statusFilters.length === 0
                      ? allCellMsgs
                      : allCellMsgs.filter(msg => {
                          const msgStatus = (msg.status || 'PLANNED').toUpperCase();
                          return statusFilters.includes(msgStatus);
                        });

                    // Check if this cell is the drag hover target
                    const isHoverCell = dragHoverCell && dragHoverCell.topic === topic.key && dragHoverCell.audience === aud.key;
                    const isDragging = draggedMsg !== null || isDraggingSelected;

                    // Check if this is the origin cell
                    const isOriginCell = dragOriginCell && dragOriginCell.topic === topic.key && dragOriginCell.audience === aud.key;

                    // Determine if this is a valid drop zone
                    const isValidDropZone = isDragging && draggedMsg && draggedMsg.topic === topic.key && !isOriginCell;

                    return (
                      <td
                        key={aud.key}
                        className={`border ${displayMode === 'minimal' ? 'p-1' : 'p-2'} align-top transition-colors relative group/cell ${
                          isHoverCell && isOriginCell
                            ? 'border-gray-400 bg-gray-100 border-2'
                            : isHoverCell && isValidDropZone
                            ? isCopyMode
                              ? 'border-blue-500 bg-blue-50 border-2'
                              : 'border-green-500 bg-green-50 border-2'
                            : isHoverCell && !isValidDropZone
                            ? 'border-red-500 bg-red-50 border-2'
                            : 'border-gray-300'
                        }`}
                        onDragOver={(e) => onDragOver(e, topic.key, aud.key)}
                        onDrop={(e) => onDrop(e, topic.key, aud.key)}
                      >
                        {/* Show mode indicator badge when hovering */}
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
                        {/* Show "no drop" indicator on origin cell */}
                        {isHoverCell && isOriginCell && (
                          <div className="absolute top-1 right-1 flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-gray-400 text-white">
                            <X size={12} />
                            <span>ORIGIN</span>
                          </div>
                        )}
                        <div className={`${displayMode === 'minimal' ? 'min-h-[40px]' : 'min-h-[100px]'} ${displayMode === 'minimal' ? 'flex flex-wrap gap-1' : 'space-y-2'}`}>
                          {cellMsgs.map((msg) => {
                            // Determine status and color from settings
                            const status = (msg.status || 'PLANNED').toUpperCase();
                            const statusColorHex = lookAndFeel?.statusColors?.[status] || '#ffff00';

                            // Convert hex to lighter background color with opacity
                            const bgColor = `${statusColorHex}33`;
                            const borderColor = statusColorHex;

                            // Check if this message is selected
                            const isSelected = selectedMessages && selectedMessages.has(msg.id);

                            return (
                              <div
                                key={msg.id}
                                draggable={!isSelectMode || isSelected}
                                onDragStart={(e) => onDragStart(e, msg)}
                                onDragEnd={() => {
                                  setDraggedMsg(null);
                                  onDragEnd && onDragEnd();
                                }}
                                onMouseDown={(e) => onMessageMouseDown && onMessageMouseDown(e, msg)}
                                onMouseUp={(e) => onMessageMouseUp && onMessageMouseUp(e, msg)}
                                onDoubleClick={() => {
                                  if (!isSelectMode) {
                                    onEditMessage(msg);
                                    setActiveTab('naming');
                                  }
                                }}
                                className={`border rounded ${displayMode === 'minimal' ? 'p-1' : 'p-2'} hover:shadow group relative select-none ${
                                  isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                                } ${
                                  isSelectMode
                                    ? (isSelected ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer')
                                    : 'cursor-move'
                                }`}
                                style={{
                                  backgroundColor: isSelected ? '#EFF6FF' : bgColor,
                                  borderColor: isSelected ? '#3B82F6' : borderColor,
                                  borderWidth: isSelected ? '2px' : '1px',
                                  WebkitUserDrag: 'element'
                                }}
                              >
                                {/* Drag indicator for selected cards - appears on hover */}
                                {isSelectMode && isSelected && (
                                  <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-500 text-white rounded-full p-1 shadow-md z-10">
                                    <Move size={12} />
                                  </div>
                                )}
                                <div className={`flex items-start gap-2 ${isSelectMode && isSelected ? 'pointer-events-none' : ''}`}>
                                  {/* Selection indicator */}
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
                                        <span className="font-bold text-blue-600">{msg.number || ''}</span>
                                        <span className="text-xs font-semibold text-gray-500">{msg.variant || ''}</span>
                                      </div>
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onEditMessage(msg);
                                            setActiveTab('naming');
                                          }}
                                          className="p-0.5 hover:bg-white/50 rounded transition-colors"
                                          title="Edit naming"
                                        >
                                          <Edit2 size={12} className="text-gray-600" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onEditMessage(msg);
                                            setActiveTab('content');
                                          }}
                                          className="p-0.5 hover:bg-white/50 rounded transition-colors"
                                          title="Preview content"
                                        >
                                          <Eye size={12} className="text-gray-600" />
                                        </button>
                                      </div>
                                    </div>
                                    {displayMode === 'informative' && (
                                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                                        {msg.name || 'No name'}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Add message button - appears on hover */}
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

                  <td className="border border-gray-300"></td>
                </tr>
              );
            })}

            <tr>
              <td className="border border-gray-300 p-2">
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
              {filteredAudiences.map((aud) => (
                <td key={aud.key} className="border border-gray-300"></td>
              ))}
              <td className="border border-gray-300"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MatrixGridView;

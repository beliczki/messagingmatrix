import React from 'react';
import { Plus, Edit2, Edit3, Eye } from 'lucide-react';

const MatrixTableView = ({
  filteredAudiences,
  filteredTopics,
  uniqueProducts,
  topicFilter,
  setTopicFilter,
  audienceFilter,
  setAudienceFilter,
  productFilter,
  setProductFilter,
  activeOnly,
  setActiveOnly,
  displayMode,
  zoom,
  handleMatrixWheel,
  containerHeight,
  getStatusColors,
  getMessages,
  onDragStart,
  onDragOver,
  onDrop,
  setDraggedMsg,
  setEditingAudience,
  setEditingTopic,
  setEditingMessage,
  setActiveTab,
  handleAddAudience,
  handleAddTopic,
  addMessage
}) => {
  return (
    <div
      className="bg-white rounded-lg shadow overflow-auto"
      onWheel={handleMatrixWheel}
      style={{ height: containerHeight > 0 ? `${containerHeight}px` : 'auto' }}
    >
      <div
        style={{
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'top left',
          transition: 'transform 0.2s ease-out'
        }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 p-2 bg-gray-100 min-w-[200px]">
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={topicFilter}
                    onChange={(e) => setTopicFilter(e.target.value)}
                    placeholder="Filter Topics"
                    className="w-24 px-2 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={audienceFilter}
                    onChange={(e) => setAudienceFilter(e.target.value)}
                    placeholder="Filter Audiences"
                    className="w-24 px-2 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={productFilter}
                    onChange={(e) => setProductFilter(e.target.value)}
                    className="w-24 px-2 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Products</option>
                    {uniqueProducts.map(product => (
                      <option key={product} value={product}>{product}</option>
                    ))}
                  </select>
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap ${
                    activeOnly
                      ? 'bg-green-50 border border-green-300 text-green-700 font-medium'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={activeOnly}
                      onChange={(e) => setActiveOnly(e.target.checked)}
                      className="w-4 h-4 text-green-600 bg-white border-gray-300 rounded focus:ring-2 focus:ring-green-500 accent-green-600"
                    />
                    <span className="text-sm">ACTIVE</span>
                  </label>
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
                        onClick={() => setEditingAudience(aud)}
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
                <button
                  onClick={handleAddAudience}
                  className="w-full h-full p-2 text-blue-500 hover:bg-blue-50 rounded"
                  title="Add Audience"
                >
                  <Plus size={20} />
                </button>
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
                        onClick={() => setEditingTopic(topic)}
                        className={`absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded ${colors.keyBg ? `hover:${colors.keyBg}` : 'hover:bg-green-100'}`}
                        title="Edit topic"
                      >
                        <Edit2 size={14} className={colors.text || 'text-green-600'} />
                      </button>
                    </div>
                  </td>

                  {filteredAudiences.map((aud) => {
                    const cellMsgs = getMessages(topic.key, aud.key);
                    const cellKey = `${topic.key}-${aud.key}`;

                    return (
                      <td
                        key={aud.key}
                        className={`border border-gray-300 ${displayMode === 'minimal' ? 'p-1' : 'p-2'} align-top`}
                        onDragOver={onDragOver}
                        onDrop={(e) => onDrop(e, topic.key, aud.key)}
                      >
                        <div className={`${displayMode === 'minimal' ? 'min-h-[40px]' : 'min-h-[100px]'} ${displayMode === 'minimal' ? 'flex flex-wrap gap-1' : 'space-y-2'}`}>
                          {cellMsgs.map((msg) => {
                            // Determine status and color
                            const status = (msg.status || 'PLANNED').toUpperCase();
                            let statusColor = 'bg-yellow-100 border-yellow-300'; // PLANNED (default)
                            let statusText = 'PLANNED';

                            if (status === 'ACTIVE') {
                              statusColor = 'bg-green-100 border-green-300';
                              statusText = 'ACTIVE';
                            } else if (status === 'INACTIVE') {
                              statusColor = 'bg-gray-200 border-gray-400';
                              statusText = 'INACTIVE';
                            } else if (status === 'INPROGRESS') {
                              statusColor = 'bg-orange-100 border-orange-300';
                              statusText = 'INPROGRESS';
                            }

                            return (
                              <div
                                key={msg.id}
                                draggable
                                onDragStart={(e) => onDragStart(e, msg)}
                                onDragEnd={() => setDraggedMsg(null)}
                                onDoubleClick={() => {
                                  setEditingMessage(msg);
                                  setActiveTab('naming');
                                }}
                                className={`${statusColor} border rounded ${displayMode === 'minimal' ? 'p-1' : 'p-2'} cursor-move hover:shadow group relative`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-1 mb-1">
                                      <span className="font-bold text-blue-600">{msg.number || ''}</span>
                                      <span className="text-xs font-semibold text-gray-500">{msg.variant || ''}</span>
                                    </div>
                                    {displayMode === 'informative' && (
                                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                                        {msg.name || 'No name'}
                                      </p>
                                    )}
                                  </div>
                                  {displayMode === 'informative' && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingMessage(msg);
                                          setActiveTab('content');
                                        }}
                                        className="p-1 text-gray-500 hover:text-green-600 transition-colors"
                                        title="Preview message"
                                      >
                                        <Eye size={12} />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingMessage(msg);
                                          setActiveTab('naming');
                                        }}
                                        className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                                        title="Edit message"
                                      >
                                        <Edit3 size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          <button
                            onClick={() => addMessage(topic.key, aud.key)}
                            className={`${displayMode === 'minimal' ? 'w-auto px-2' : 'w-full'} border-2 border-dashed border-gray-300 rounded p-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50`}
                          >
                            {displayMode === 'minimal' ? '+' : '+ Add Message'}
                          </button>
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
                <button
                  onClick={handleAddTopic}
                  className="w-full h-full p-2 text-green-500 hover:bg-green-50 rounded"
                  title="Add Topic"
                >
                  <Plus size={20} />
                </button>
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

export default MatrixTableView;

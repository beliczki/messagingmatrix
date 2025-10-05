import React from 'react';
import { Edit3, Trash2, Move, Sparkles } from 'lucide-react';

const MessageCard = ({ message, onEdit, onRemove, onDragStart, onDragEnd, isDragging }) => {
  const handleDragStart = (e) => {
    onDragStart(e, message);
  };

  const getCardColor = () => {
    if (message.isNew) return 'bg-green-100 border-green-300';
    if (message.isModified) return 'bg-yellow-100 border-yellow-300';
    return 'bg-blue-100 border-blue-300';
  };

  const getStatusIcon = () => {
    if (message.isNew) return <Sparkles size={12} className="text-green-600" />;
    if (message.isModified) return <Edit3 size={12} className="text-yellow-600" />;
    return null;
  };

  return (
    <div 
      className={`border rounded p-3 group relative cursor-move transition-all ${getCardColor()} hover:shadow-md`}
      draggable={!isDragging}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Message header with actions */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono text-gray-600">
            m{message.number}{message.variant}
          </span>
          {getStatusIcon()}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
            title="Edit message"
          >
            <Edit3 size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Remove this message? (This will set status to removed)')) {
                onRemove();
              }
            }}
            className="p-1 text-gray-500 hover:text-red-600 transition-colors"
            title="Remove message"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Simplified message info */}
      <div className="text-sm space-y-1">
        <div className="font-medium text-gray-800 text-xs font-mono line-clamp-1">
          {message.name || 'Unnamed Message'}
        </div>
        <div className="text-xs text-gray-600 flex gap-2">
          <span>#{message.number}</span>
          <span>{message.variant}</span>
          <span>v{message.version}</span>
        </div>
      </div>

      {/* Drag handle */}
      <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Move size={12} className="text-gray-400" />
      </div>
    </div>
  );
};

export default MessageCard;

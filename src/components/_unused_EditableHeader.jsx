import React, { useState, useRef, useEffect } from 'react';
import { Edit3, Check, X } from 'lucide-react';

const EditableHeader = ({ text, onSave, className = '', placeholder = 'Enter text...' }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(text);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(text);
  }, [text]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditValue(text);
  };

  const handleSave = () => {
    if (editValue.trim() && editValue !== text) {
      onSave(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(text);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder={placeholder}
          className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <button
          onClick={handleSave}
          className="p-1 text-green-600 hover:text-green-800 transition-colors"
          title="Save"
        >
          <Check size={14} />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 text-red-600 hover:text-red-800 transition-colors"
          title="Cancel"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className={`group flex items-center gap-2 ${className}`}>
      <span className="flex-1">{text}</span>
      <button
        onClick={handleEdit}
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-blue-600 transition-all"
        title="Edit name"
      >
        <Edit3 size={14} />
      </button>
    </div>
  );
};

export default EditableHeader;

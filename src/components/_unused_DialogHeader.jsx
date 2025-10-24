import React from 'react';
import { X } from 'lucide-react';

const DialogHeader = ({ title, onClose, lookAndFeel }) => {
  const headerColor = lookAndFeel?.headerColor || '#2870ed';

  return (
    <div
      className="flex items-center justify-between p-6 border-b"
      style={{ backgroundColor: headerColor }}
    >
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <button
        onClick={onClose}
        className="p-2 rounded transition-colors"
        style={{ color: 'white' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <X size={20} />
      </button>
    </div>
  );
};

export default DialogHeader;

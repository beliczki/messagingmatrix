import React from 'react';
import { X } from 'lucide-react';

const Preview = ({ asset, onClose }) => {
  if (!asset) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div className="max-w-7xl max-h-screen" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 mb-4">
          <h3 className="text-xl font-bold text-white">{asset.product || asset.filename}</h3>
          <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded">
            <X size={20} className="text-white" />
          </button>
        </div>
        {asset.extension === 'mp4' ? (
          <video src={asset.url} controls autoPlay className="max-w-full max-h-[80vh] rounded-lg" />
        ) : (
          <img src={asset.url} alt={asset.filename} className="max-w-full max-h-[80vh] rounded-lg" />
        )}
      </div>
    </div>
  );
};

export default Preview;

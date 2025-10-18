import React from 'react';
import { Image as ImageIcon, Monitor, Check } from 'lucide-react';

const CreativeLibraryListView = ({
  gridRef,
  filteredCreatives,
  selectorMode,
  selectedCreativeIds,
  onToggleSelection,
  onSelectCreative
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table ref={gridRef} className="w-full">
          <thead className="bg-gray-50">
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Creative</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Variant</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Tags</th>
            </tr>
          </thead>
          <tbody>
            {filteredCreatives.map(creative => {
              const isVideo = creative.extension === 'mp4';
              const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(creative.extension);
              const isSelected = selectedCreativeIds.has(creative.id);

              return (
                <tr
                  key={creative.id}
                  data-creative-id={creative.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
                  onClick={() => {
                    if (selectorMode) {
                      onToggleSelection(creative.id);
                    } else {
                      onSelectCreative(creative);
                    }
                  }}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {selectorMode && (
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-300'
                        }`}>
                          {isSelected && <Check size={14} className="text-white" />}
                        </div>
                      )}
                      <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                        {isImage && <img src={creative.url} alt={creative.filename} className="w-full h-full object-cover" loading="lazy" />}
                        {isVideo && <video src={creative.url} className="w-full h-full object-cover" preload="metadata" />}
                        {!isImage && !isVideo && <ImageIcon size={24} className="text-gray-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-800 truncate">{creative.product || 'Untitled'}</p>
                        <p className="text-xs text-gray-500 truncate">{creative.filename}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {creative.size && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                        <Monitor size={12} />
                        {creative.size}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{creative.date || '-'}</td>
                  <td className="py-3 px-4">
                    {creative.variant && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                        {creative.variant.toUpperCase()}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {creative.platforms.map(platform => (
                        <span key={platform} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{platform}</span>
                      ))}
                      {creative.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{tag}</span>
                      ))}
                      {creative.tags.length > 2 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">+{creative.tags.length - 2}</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CreativeLibraryListView;

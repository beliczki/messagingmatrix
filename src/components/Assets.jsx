import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Upload, X, Filter, Check } from 'lucide-react';
import PageHeader, { getButtonStyle } from './PageHeader';
import CreativePreview from './CreativePreview';
import { processAssets, filterAssets } from '../utils/assetUtils';

const Assets = ({ onMenuToggle, currentModuleName, lookAndFeel }) => {
  const [assets, setAssets] = useState([]);
  const [viewMode, setViewMode] = useState('grid4');
  const [filterText, setFilterText] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [pendingUploads, setPendingUploads] = useState([]);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  useEffect(() => {
    loadAssetsList();
  }, []);

  const loadAssetsList = async () => {
    const assetModules = import.meta.glob('/src/assets/*.*', { eager: true, as: 'url' });
    const assetList = await processAssets(assetModules);
    setAssets(assetList);
  };

  const handleFileUpload = async (files) => {
    const fileArray = Array.from(files);
    const previews = [];

    for (const file of fileArray) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/assets/preview-metadata', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('Preview failed');
        }

        const result = await response.json();
        previews.push({
          originalName: result.originalName,
          tempFilename: result.tempFilename,
          metadata: result.metadata
        });
      } catch (error) {
        console.error('Error previewing file:', error);
        alert(`Failed to preview ${file.name}: ${error.message}`);
      }
    }

    if (previews.length > 0) {
      setPendingUploads(previews);
      setShowUploadDialog(false);
      setShowMetadataDialog(true);
    }
  };

  const handleConfirmUploads = async () => {
    setShowMetadataDialog(false);
    setUploadingFiles(pendingUploads);
    setUploadProgress({});

    for (const upload of pendingUploads) {
      try {
        const response = await fetch('/api/assets/confirm-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tempFilename: upload.tempFilename,
            metadata: upload.metadata,
            targetDir: 'assets'
          })
        });

        if (!response.ok) {
          throw new Error('Upload confirmation failed');
        }

        const result = await response.json();
        console.log('File uploaded:', result);

        setUploadProgress(prev => ({
          ...prev,
          [upload.originalName]: 'completed'
        }));
      } catch (error) {
        console.error('Error confirming upload:', error);
        setUploadProgress(prev => ({
          ...prev,
          [upload.originalName]: 'error'
        }));
      }
    }

    await loadAssetsList();

    setTimeout(() => {
      setUploadingFiles([]);
      setUploadProgress({});
      setPendingUploads([]);
    }, 1500);
  };

  const handleCancelUploads = async () => {
    for (const upload of pendingUploads) {
      try {
        await fetch('/api/assets/cancel-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tempFilename: upload.tempFilename })
        });
      } catch (error) {
        console.error('Error canceling upload:', error);
      }
    }

    setPendingUploads([]);
    setShowMetadataDialog(false);
  };

  const updatePendingMetadata = (index, field, value) => {
    setPendingUploads(prev => {
      const updated = [...prev];
      updated[index].metadata[field] = value;
      return updated;
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const filteredAssets = filterAssets(assets, filterText);

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        onMenuToggle={onMenuToggle}
        title={currentModuleName || 'Assets'}
        lookAndFeel={lookAndFeel}
        viewMode={viewMode}
        setViewMode={setViewMode}
        viewModes={[
          { value: 'grid3', label: '3 Columns' },
          { value: 'grid4', label: '4 Columns' },
          { value: 'list', label: 'List View' }
        ]}
      >
        <button
          onClick={() => setShowUploadDialog(true)}
          className="flex items-center gap-2 px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
          style={getButtonStyle(lookAndFeel)}
        >
          <Upload size={16} />
          Upload
        </button>
      </PageHeader>

      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2 flex-1">
              <Filter size={18} className="text-gray-400" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter assets (use 'and' / 'or' operators)..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {viewMode === 'grid3' ? (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
              {filteredAssets.map(asset => {
                const isVideo = asset.extension === 'mp4';
                const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(asset.extension);

                return (
                  <div
                    key={asset.id}
                    className="group cursor-pointer mb-4 break-inside-avoid"
                    onClick={() => setSelectedAsset(asset)}
                  >
                    <div className="relative rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                      {isImage && (
                        <img
                          src={asset.url}
                          alt={asset.filename}
                          className="w-full h-auto object-cover"
                          loading="lazy"
                        />
                      )}
                      {isVideo && (
                        <video
                          src={asset.url}
                          className="w-full h-auto object-cover"
                          preload="metadata"
                        />
                      )}
                      {!isImage && !isVideo && (
                        <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
                          <ImageIcon size={48} className="text-gray-400" />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 pointer-events-none">
                        <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">
                          {asset.product || asset.filename}
                        </h3>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs font-medium uppercase">
                            {asset.extension}
                          </span>
                          {asset.size && (
                            <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs">
                              {asset.size}
                            </span>
                          )}
                          {asset.variant && (
                            <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs">
                              v{asset.variant.toUpperCase()}
                            </span>
                          )}
                        </div>

                        {(asset.platforms.length > 0 || asset.tags.length > 0) && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {asset.platforms.map(platform => (
                              <span key={platform} className="px-2 py-0.5 bg-blue-500/80 backdrop-blur-sm text-white rounded text-xs">
                                {platform}
                              </span>
                            ))}
                            {asset.tags.slice(0, 2).map(tag => (
                              <span key={tag} className="px-2 py-0.5 bg-green-500/80 backdrop-blur-sm text-white rounded text-xs">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'grid4' ? (
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
              {filteredAssets.map(asset => {
                const isVideo = asset.extension === 'mp4';
                const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(asset.extension);

                return (
                  <div
                    key={asset.id}
                    className="group cursor-pointer mb-4 break-inside-avoid"
                    onClick={() => setSelectedAsset(asset)}
                  >
                    <div className="relative rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                      {isImage && (
                        <img
                          src={asset.url}
                          alt={asset.filename}
                          className="w-full h-auto object-cover"
                          loading="lazy"
                        />
                      )}
                      {isVideo && (
                        <video
                          src={asset.url}
                          className="w-full h-auto object-cover"
                          preload="metadata"
                        />
                      )}
                      {!isImage && !isVideo && (
                        <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
                          <ImageIcon size={48} className="text-gray-400" />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 pointer-events-none">
                        <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">
                          {asset.product || asset.filename}
                        </h3>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs font-medium uppercase">
                            {asset.extension}
                          </span>
                          {asset.size && (
                            <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs">
                              {asset.size}
                            </span>
                          )}
                          {asset.variant && (
                            <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs">
                              v{asset.variant.toUpperCase()}
                            </span>
                          )}
                        </div>

                        {(asset.platforms.length > 0 || asset.tags.length > 0) && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {asset.platforms.map(platform => (
                              <span key={platform} className="px-2 py-0.5 bg-blue-500/80 backdrop-blur-sm text-white rounded text-xs">
                                {platform}
                              </span>
                            ))}
                            {asset.tags.slice(0, 2).map(tag => (
                              <span key={tag} className="px-2 py-0.5 bg-green-500/80 backdrop-blur-sm text-white rounded text-xs">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Asset</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Variant</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.map(asset => {
                      const isVideo = asset.extension === 'mp4';
                      const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(asset.extension);

                      return (
                        <tr
                          key={asset.id}
                          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSelectedAsset(asset)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                                {isImage && <img src={asset.url} alt={asset.filename} className="w-full h-full object-cover" loading="lazy" />}
                                {isVideo && <video src={asset.url} className="w-full h-full object-cover" preload="metadata" />}
                                {!isImage && !isVideo && <ImageIcon size={24} className="text-gray-400" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-800 truncate">{asset.product || 'Untitled'}</p>
                                <p className="text-xs text-gray-500 truncate">{asset.filename}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {asset.size && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                {asset.size}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{asset.date || '-'}</td>
                          <td className="py-3 px-4">
                            {asset.variant && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                {asset.variant.toUpperCase()}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {asset.platforms.map(platform => (
                                <span key={platform} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{platform}</span>
                              ))}
                              {asset.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{tag}</span>
                              ))}
                              {asset.tags.length > 2 && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">+{asset.tags.length - 2}</span>
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
          )}

          {filteredAssets.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <ImageIcon size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No assets found</p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Dialog */}
      {showUploadDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold text-gray-800">Upload Assets</h3>
              <button onClick={() => setShowUploadDialog(false)} className="p-2 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => document.getElementById('asset-file-input').click()}
              >
                <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-gray-700 mb-2 font-medium">Drag and drop files here</p>
                <p className="text-sm text-gray-500">or click to browse</p>
                <input
                  id="asset-file-input"
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                />
              </div>

              {uploadingFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {uploadingFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700 truncate flex-1">{file.originalName}</span>
                      {uploadProgress[file.originalName] === 'completed' && (
                        <Check size={16} className="text-green-500 ml-2" />
                      )}
                      {uploadProgress[file.originalName] === 'error' && (
                        <X size={16} className="text-red-500 ml-2" />
                      )}
                      {!uploadProgress[file.originalName] && (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-2" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Metadata Confirmation Dialog */}
      {showMetadataDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold text-gray-800">Confirm File Metadata</h3>
              <button onClick={handleCancelUploads} className="p-2 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-sm text-gray-600 mb-4">
                Review and edit the metadata for each file. Files will be renamed as: <br />
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">product_platform_size_variant_templateSource.ext</code>
              </p>
              <div className="space-y-4">
                {pendingUploads.map((upload, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <p className="font-semibold text-gray-800 mb-3 truncate">{upload.originalName}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Product</label>
                        <input
                          type="text"
                          value={upload.metadata.product}
                          onChange={(e) => updatePendingMetadata(index, 'product', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Platform</label>
                        <input
                          type="text"
                          value={upload.metadata.platform}
                          onChange={(e) => updatePendingMetadata(index, 'platform', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Size</label>
                        <input
                          type="text"
                          value={upload.metadata.size}
                          onChange={(e) => updatePendingMetadata(index, 'size', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Variant</label>
                        <input
                          type="text"
                          value={upload.metadata.variant}
                          onChange={(e) => updatePendingMetadata(index, 'variant', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Template Source</label>
                        <input
                          type="text"
                          value={upload.metadata.templateSource}
                          onChange={(e) => updatePendingMetadata(index, 'templateSource', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Extension</label>
                        <input
                          type="text"
                          value={upload.metadata.ext}
                          readOnly
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-50 cursor-not-allowed"
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">
                        New filename: <span className="font-mono">{`${upload.metadata.product}_${upload.metadata.platform}_${upload.metadata.size}_${upload.metadata.variant}_${upload.metadata.templateSource}.${upload.metadata.ext}`}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t">
              <button
                onClick={handleCancelUploads}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUploads}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <Upload size={16} />
                Confirm & Upload ({pendingUploads.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Dialog */}
      {uploadingFiles.length > 0 && !showMetadataDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold text-gray-800">Uploading Files...</h3>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {uploadingFiles.map((upload, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700 truncate flex-1">{upload.originalName}</span>
                    {uploadProgress[upload.originalName] === 'completed' && (
                      <Check size={16} className="text-green-500 ml-2" />
                    )}
                    {uploadProgress[upload.originalName] === 'error' && (
                      <X size={16} className="text-red-500 ml-2" />
                    )}
                    {!uploadProgress[upload.originalName] && (
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-2" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Asset Preview */}
      <CreativePreview
        creative={selectedAsset}
        onClose={() => setSelectedAsset(null)}
      />
    </div>
  );
};

export default Assets;

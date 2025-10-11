import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Menu, Grid, List, Upload, X, Search, Calendar, Tag, Monitor } from 'lucide-react';

// Helper function to extract metadata from filename
const extractMetadata = (filename) => {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|mp4|gif)$/i, '');

  // Split by underscores
  const parts = nameWithoutExt.split('_');

  // Extract size (e.g., 1080x1080, 300x250)
  const sizeMatch = nameWithoutExt.match(/(\d+)x(\d+)/);
  const size = sizeMatch ? `${sizeMatch[1]}x${sizeMatch[2]}` : null;

  // Extract date (e.g., 251006, YYMMDD format)
  const dateMatch = nameWithoutExt.match(/(\d{6})/);
  let date = null;
  if (dateMatch) {
    const dateStr = dateMatch[1];
    // Convert YYMMDD to proper date
    const year = 20 + parseInt(dateStr.substring(0, 2));
    const month = parseInt(dateStr.substring(2, 4));
    const day = parseInt(dateStr.substring(4, 6));
    date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Extract platform/variant keywords
  const platforms = [];
  if (nameWithoutExt.toLowerCase().includes('fb')) platforms.push('Facebook');
  if (nameWithoutExt.toLowerCase().includes('google') || nameWithoutExt.toLowerCase().includes('pmax')) platforms.push('Google');
  if (nameWithoutExt.toLowerCase().includes('banner')) platforms.push('Display');

  // Extract campaign type/stage
  const tags = [];
  if (nameWithoutExt.toLowerCase().includes('pro')) tags.push('Prospecting');
  if (nameWithoutExt.toLowerCase().includes('rem')) tags.push('Remarketing');
  if (nameWithoutExt.toLowerCase().includes('ltp')) tags.push('LTP');
  if (nameWithoutExt.toLowerCase().includes('cube')) tags.push('Cube');
  if (nameWithoutExt.toLowerCase().includes('halfpage')) tags.push('Half Page');

  // Extract product name (usually second part after ERSTE)
  let product = '';
  if (parts.length > 1) {
    product = parts[1].replace(/^\d+/, ''); // Remove leading numbers
  }

  // Extract variant (letters like a, b, c, d or numbers)
  const variantMatch = nameWithoutExt.match(/_([A-Za-z]|[0-9]+)(?:_|\.|$)/);
  const variant = variantMatch ? variantMatch[1] : null;

  return {
    filename,
    product,
    size,
    date,
    platforms,
    tags,
    variant,
    extension: filename.split('.').pop().toLowerCase()
  };
};

const AssetsLibrary = ({ onMenuToggle, currentModuleName }) => {
  const [assets, setAssets] = useState([]);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterSize, setFilterSize] = useState('all');
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      // Get all files from src/assets directory
      // Using import.meta.glob to get all assets
      const assetModules = import.meta.glob('/src/assets/*.*', { eager: true, as: 'url' });

      const assetList = Object.entries(assetModules).map(([path, url]) => {
        const filename = path.split('/').pop();
        const metadata = extractMetadata(filename);

        return {
          ...metadata,
          path,
          url,
          id: filename
        };
      });

      setAssets(assetList);
    } catch (error) {
      console.error('Error loading assets:', error);
    }
  };

  // Filter assets
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesPlatform = filterPlatform === 'all' ||
                           asset.platforms.some(p => p.toLowerCase() === filterPlatform.toLowerCase());

    const matchesSize = filterSize === 'all' || asset.size === filterSize;

    return matchesSearch && matchesPlatform && matchesSize;
  });

  // Get unique platforms and sizes for filters
  const allPlatforms = [...new Set(assets.flatMap(a => a.platforms))];
  const allSizes = [...new Set(assets.map(a => a.size).filter(Boolean))].sort();

  const AssetCard = ({ asset }) => {
    const isVideo = asset.extension === 'mp4';
    const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(asset.extension);

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
        {/* Preview */}
        <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
          {isImage && (
            <img
              src={asset.url}
              alt={asset.filename}
              className="w-full h-full object-contain"
              loading="lazy"
            />
          )}
          {isVideo && (
            <video
              src={asset.url}
              className="w-full h-full object-contain"
              controls
              preload="metadata"
            />
          )}
          {!isImage && !isVideo && (
            <ImageIcon size={48} className="text-gray-400" />
          )}
        </div>

        {/* Metadata */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-800 text-sm mb-2 truncate" title={asset.filename}>
            {asset.product || asset.filename}
          </h3>

          <div className="space-y-2 text-xs">
            {asset.size && (
              <div className="flex items-center gap-2 text-gray-600">
                <Monitor size={14} />
                <span>{asset.size}</span>
              </div>
            )}

            {asset.date && (
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar size={14} />
                <span>{asset.date}</span>
              </div>
            )}

            {asset.variant && (
              <div className="flex items-center gap-2 text-gray-600">
                <Tag size={14} />
                <span>Variant: {asset.variant.toUpperCase()}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-1 mt-2">
              {asset.platforms.map(platform => (
                <span key={platform} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  {platform}
                </span>
              ))}
              {asset.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AssetRow = ({ asset }) => {
    const isVideo = asset.extension === 'mp4';
    const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(asset.extension);

    return (
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        <td className="py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
              {isImage && (
                <img
                  src={asset.url}
                  alt={asset.filename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
              {isVideo && (
                <video
                  src={asset.url}
                  className="w-full h-full object-cover"
                  preload="metadata"
                />
              )}
              {!isImage && !isVideo && (
                <ImageIcon size={24} className="text-gray-400" />
              )}
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
              <Monitor size={12} />
              {asset.size}
            </span>
          )}
        </td>
        <td className="py-3 px-4 text-sm text-gray-600">
          {asset.date || '-'}
        </td>
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
              <span key={platform} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                {platform}
              </span>
            ))}
            {asset.tags.slice(0, 2).map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                {tag}
              </span>
            ))}
            {asset.tags.length > 2 && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                +{asset.tags.length - 2}
              </span>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuToggle}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Open Menu"
            >
              <Menu size={24} className="text-gray-700" />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">{currentModuleName || 'Assets Library'}</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded transition-colors text-xs ${
                  viewMode === 'grid'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Grid View"
              >
                <Grid size={16} />
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded transition-colors text-xs ${
                  viewMode === 'list'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="List View"
              >
                <List size={16} />
                List
              </button>
            </div>

            {/* Upload Button */}
            <button
              onClick={() => setShowUploadDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Upload size={16} />
              Upload
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search
                </label>
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search assets..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Platform Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Platform
                </label>
                <select
                  value={filterPlatform}
                  onChange={(e) => setFilterPlatform(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Platforms</option>
                  {allPlatforms.map(platform => (
                    <option key={platform} value={platform}>{platform}</option>
                  ))}
                </select>
              </div>

              {/* Size Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size
                </label>
                <select
                  value={filterSize}
                  onChange={(e) => setFilterSize(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Sizes</option>
                  {allSizes.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-gray-600">
              <span>Showing {filteredAssets.length} of {assets.length} assets</span>
              <span>{allPlatforms.length} platforms • {allSizes.length} sizes</span>
            </div>
          </div>

          {/* Assets Grid/List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAssets.map(asset => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
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
                    {filteredAssets.map(asset => (
                      <AssetRow key={asset.id} asset={asset} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filteredAssets.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <ImageIcon size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No assets found</p>
              <p className="text-sm mt-2">Try adjusting your filters or upload new assets</p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Dialog */}
      {showUploadDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Upload Asset</h3>
                <p className="text-sm text-gray-600 mt-1">Add new files to your library</p>
              </div>
              <button
                onClick={() => setShowUploadDialog(false)}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
                <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-gray-700 mb-2">Drag and drop files here</p>
                <p className="text-sm text-gray-500 mb-4">or</p>
                <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                  Browse Files
                </button>
                <p className="text-xs text-gray-500 mt-4">
                  Supports: JPG, PNG, MP4, GIF (max 50MB)
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={() => setShowUploadDialog(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetsLibrary;

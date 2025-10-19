import React, { useState, useEffect } from 'react';
import {
  Share2,
  MessageSquare,
  Send,
  Calendar,
  X,
  Image as ImageIcon,
  Download,
  ExternalLink,
  DownloadCloud,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Info,
  CheckSquare,
  Square
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  getPreviewById,
  addComment
} from '../services/previewService';
import { useAuth } from '../contexts/AuthContext';

const PublicPreviewView = ({ previewId }) => {
  const { currentUser } = useAuth();
  const [preview, setPreview] = useState(null);
  const [previewAssets, setPreviewAssets] = useState([]);
  const [allAssets, setAllAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [lookAndFeel, setLookAndFeel] = useState(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [assetDimensions, setAssetDimensions] = useState(null);
  const [referencePoint, setReferencePoint] = useState(null);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [hoveredCommentRef, setHoveredCommentRef] = useState(null);
  const [userClickedRef, setUserClickedRef] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [rectangleStart, setRectangleStart] = useState(null);
  const [mouseDownTime, setMouseDownTime] = useState(null);
  const [showOnlyCommented, setShowOnlyCommented] = useState(false);
  const [downloadingAdId, setDownloadingAdId] = useState(null);

  // Load configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const config = await response.json();
          setLookAndFeel(config.lookAndFeel);
        }
      } catch (error) {
        console.error('Failed to load configuration:', error);
      }
    };
    loadConfig();
  }, []);

  // Load all assets
  useEffect(() => {
    const loadAllAssets = async () => {
      const assetModules = import.meta.glob('/src/creatives/*.*', { eager: true, as: 'url' });
      const assetList = Object.entries(assetModules).map(([path, url]) => {
        const filename = path.split('/').pop();
        return {
          id: filename,
          filename,
          url,
          extension: filename.split('.').pop().toLowerCase(),
          product: filename,
          size: null
        };
      });
      console.log('PublicPreviewView: Loaded all assets:', assetList);
      setAllAssets(assetList);
    };
    loadAllAssets();
  }, []);

  useEffect(() => {
    if (allAssets.length > 0) {
      loadPreview();
    }
  }, [previewId, allAssets]);

  // Auto-populate comment author with logged-in user's email
  useEffect(() => {
    if (currentUser && currentUser.email) {
      setCommentAuthor(currentUser.email);
    }
  }, [currentUser]);

  // Helper function to check if asset is a static local folder review
  const isStaticLocalReview = (asset) => {
    return asset.isLocalFolderReview === true && asset.staticPath;
  };

  // Helper function to extract coordinates from comment text
  const extractCoordinates = (text) => {
    // Try rectangle format first: @rect(x1%, y1%, x2%, y2%)
    const rectPattern = /@rect\((\d+)%,\s*(\d+)%,\s*(\d+)%,\s*(\d+)%\)/;
    const rectMatch = text.match(rectPattern);
    if (rectMatch) {
      return {
        type: 'rectangle',
        x1: parseInt(rectMatch[1]),
        y1: parseInt(rectMatch[2]),
        x2: parseInt(rectMatch[3]),
        y2: parseInt(rectMatch[4])
      };
    }

    // Try point format: @(x%, y%)
    const pointPattern = /@\((\d+)%,\s*(\d+)%\)/;
    const pointMatch = text.match(pointPattern);
    if (pointMatch) {
      return {
        type: 'point',
        x: parseInt(pointMatch[1]),
        y: parseInt(pointMatch[2])
      };
    }

    return null;
  };

  const loadPreview = async () => {
    setLoading(true);
    const loadedPreview = await getPreviewById(previewId);

    if (!loadedPreview) {
      setLoading(false);
      return;
    }

    console.log('PublicPreviewView: Loaded preview:', loadedPreview);
    console.log('PublicPreviewView: All assets:', allAssets);
    console.log('PublicPreviewView: Asset IDs from preview:', loadedPreview.assetIds);

    setPreview(loadedPreview);

    // Check if we have assets array in the share data (for static local reviews)
    if (loadedPreview.assets && Array.isArray(loadedPreview.assets)) {
      console.log('PublicPreviewView: Using assets from share data:', loadedPreview.assets);
      setPreviewAssets(loadedPreview.assets);
    } else {
      // Fallback to loading from allAssets (for regular shares)
      const assets = allAssets.filter(asset => {
        const matches = loadedPreview.assetIds.includes(asset.id);
        console.log(`Checking asset ${asset.id}: ${matches}`);
        return matches;
      });

      console.log('PublicPreviewView: Filtered assets:', assets);
      setPreviewAssets(assets);
    }

    setLoading(false);
  };

  const handleImageMouseDown = (e) => {
    e.preventDefault(); // Prevent default image drag behavior

    const img = e.target;
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const percentX = (x / rect.width) * 100;
    const percentY = (y / rect.height) * 100;

    // Start tracking for potential rectangle
    setIsDrawing(true);
    setMouseDownTime(Date.now());
    setRectangleStart({
      x: Math.round(percentX),
      y: Math.round(percentY)
    });

    setImageOffset({ x: rect.left, y: rect.top });
  };

  const handleImageMouseMove = (e) => {
    if (!isDrawing) return;
    e.preventDefault(); // Prevent default behavior during drag

    const img = e.target;
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const percentX = (x / rect.width) * 100;
    const percentY = (y / rect.height) * 100;

    // Update rectangle reference as user drags
    const refRect = {
      type: 'rectangle',
      x1: rectangleStart.x,
      y1: rectangleStart.y,
      x2: Math.round(percentX),
      y2: Math.round(percentY)
    };
    setReferencePoint(refRect);
    setUserClickedRef(refRect);
  };

  const handleImageMouseUp = (e) => {
    if (!isDrawing) return;
    e.preventDefault(); // Prevent default behavior

    const img = e.target;
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const percentX = (x / rect.width) * 100;
    const percentY = (y / rect.height) * 100;

    const currentX = Math.round(percentX);
    const currentY = Math.round(percentY);

    // Check if this was a click (no significant movement) or a drag
    const dx = Math.abs(currentX - rectangleStart.x);
    const dy = Math.abs(currentY - rectangleStart.y);
    const isClick = dx < 2 && dy < 2; // Less than 2% movement = click

    if (isClick) {
      // Create point reference
      const refPoint = {
        type: 'point',
        x: rectangleStart.x,
        y: rectangleStart.y
      };
      setReferencePoint(refPoint);
      setUserClickedRef(refPoint);
    } else {
      // Create rectangle reference (already set during drag)
      const refRect = {
        type: 'rectangle',
        x1: rectangleStart.x,
        y1: rectangleStart.y,
        x2: currentX,
        y2: currentY
      };
      setReferencePoint(refRect);
      setUserClickedRef(refRect);
    }

    setIsDrawing(false);
    setMouseDownTime(null);
  };

  const handleAddComment = async (assetId) => {
    if (!commentAuthor.trim() || !commentText.trim()) return;

    try {
      let commentWithAsset = `[${assetId}] `;
      if (referencePoint) {
        if (referencePoint.type === 'rectangle') {
          commentWithAsset += `@rect(${referencePoint.x1}%, ${referencePoint.y1}%, ${referencePoint.x2}%, ${referencePoint.y2}%) `;
        } else {
          commentWithAsset += `@(${referencePoint.x}%, ${referencePoint.y}%) `;
        }
      }
      commentWithAsset += commentText;

      await addComment(previewId, commentAuthor, commentWithAsset);

      // Clear everything after posting (keep author if user is logged in)
      if (!currentUser || !currentUser.email) {
        setCommentAuthor('');
      }
      setCommentText('');
      setReferencePoint(null);
      setUserClickedRef(null);
      setRectangleStart(null);
      setIsDrawing(false);
      loadPreview(); // Reload to get updated comments
    } catch (error) {
      console.error('Failed to add comment:', error);
      alert('Failed to add comment. Please try again.');
    }
  };

  const handleDownloadAll = async () => {
    if (previewAssets.length === 0) return;

    setDownloading(true);
    try {
      const zip = new JSZip();

      // Fetch and add each asset to the ZIP
      for (const asset of previewAssets) {
        try {
          // Check if this is a static HTML ad
          if (isStaticLocalReview(asset) && asset.staticPath && asset.folderName) {
            // Create a folder for this HTML ad
            const adFolder = zip.folder(asset.folderName);

            // Extract folder path from staticPath
            const pathParts = asset.staticPath.split('/');
            const folderPath = pathParts.slice(0, -1).join('/');

            // List of known files to fetch
            const knownFiles = ['index.html', 'styles.css', 'manifest.json'];

            // Fetch known files
            for (const filename of knownFiles) {
              try {
                const fileUrl = `${folderPath}/${filename}`;
                const response = await fetch(fileUrl);
                if (response.ok) {
                  const blob = await response.blob();
                  adFolder.file(filename, blob);
                }
              } catch (error) {
                console.error(`Failed to fetch ${filename}:`, error);
              }
            }

            // Fetch index.html to parse for images
            try {
              const htmlResponse = await fetch(`${folderPath}/index.html`);
              if (htmlResponse.ok) {
                const htmlText = await htmlResponse.text();

                // Extract image references from HTML
                const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
                const imageSources = [];
                let match;

                while ((match = imgRegex.exec(htmlText)) !== null) {
                  const imgSrc = match[1];
                  // Only include local images (not http/https URLs)
                  if (!imgSrc.startsWith('http://') && !imgSrc.startsWith('https://')) {
                    imageSources.push(imgSrc);
                  }
                }

                // Fetch and add images to zip
                for (const imgSrc of imageSources) {
                  try {
                    const imgUrl = `${folderPath}/${imgSrc}`;
                    const imgResponse = await fetch(imgUrl);
                    if (imgResponse.ok) {
                      const imgBlob = await imgResponse.blob();
                      adFolder.file(imgSrc, imgBlob);
                    }
                  } catch (error) {
                    console.error(`Failed to fetch image ${imgSrc}:`, error);
                  }
                }
              }
            } catch (error) {
              console.error('Failed to parse HTML for images:', error);
            }
          } else {
            // Regular asset (image, video, etc.)
            const response = await fetch(asset.url);
            const blob = await response.blob();
            zip.file(asset.filename, blob);
          }
        } catch (error) {
          console.error(`Failed to fetch ${asset.filename || asset.folderName}:`, error);
        }
      }

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Use preview title or date for ZIP filename
      const zipFilename = `${preview.title || 'Preview'}_${new Date().toISOString().split('T')[0]}.zip`;

      // Trigger download
      saveAs(zipBlob, zipFilename);
    } catch (error) {
      console.error('Failed to create ZIP:', error);
      alert('Failed to create download archive. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadStaticAd = async (asset) => {
    if (!asset.staticPath || !asset.folderName) return;

    setDownloadingAdId(asset.id);
    try {
      const zip = new JSZip();

      // Extract folder path from staticPath (/share/{shareId}/{folderName}/index.html)
      const pathParts = asset.staticPath.split('/');
      const folderPath = pathParts.slice(0, -1).join('/'); // Remove index.html

      // List of known files to fetch
      const knownFiles = ['index.html', 'styles.css', 'manifest.json'];

      // Fetch known files
      for (const filename of knownFiles) {
        try {
          const fileUrl = `${folderPath}/${filename}`;
          const response = await fetch(fileUrl);
          if (response.ok) {
            const blob = await response.blob();
            zip.file(filename, blob);
          }
        } catch (error) {
          console.error(`Failed to fetch ${filename}:`, error);
        }
      }

      // Fetch index.html to parse for images
      try {
        const htmlResponse = await fetch(`${folderPath}/index.html`);
        if (htmlResponse.ok) {
          const htmlText = await htmlResponse.text();

          // Extract image references from HTML
          const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
          const imageSources = [];
          let match;

          while ((match = imgRegex.exec(htmlText)) !== null) {
            const imgSrc = match[1];
            // Only include local images (not http/https URLs)
            if (!imgSrc.startsWith('http://') && !imgSrc.startsWith('https://')) {
              imageSources.push(imgSrc);
            }
          }

          // Fetch and add images to zip
          for (const imgSrc of imageSources) {
            try {
              const imgUrl = `${folderPath}/${imgSrc}`;
              const imgResponse = await fetch(imgUrl);
              if (imgResponse.ok) {
                const imgBlob = await imgResponse.blob();
                zip.file(imgSrc, imgBlob);
              }
            } catch (error) {
              console.error(`Failed to fetch image ${imgSrc}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('Failed to parse HTML for images:', error);
      }

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Trigger download
      const zipFilename = `${asset.folderName}.zip`;
      saveAs(zipBlob, zipFilename);
    } catch (error) {
      console.error('Failed to create static ad ZIP:', error);
      alert('Failed to download ad. Please try again.');
    } finally {
      setDownloadingAdId(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }) + ' ' + date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Share2 size={48} className="mx-auto mb-4 text-gray-300 animate-pulse" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading Preview...</h2>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Share2 size={48} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Preview Not Found</h2>
          <p className="text-gray-600">This preview link does not exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const baseColor = preview.baseColor || '#2870ed';

  // Filter assets based on showOnlyCommented checkbox
  const displayedAssets = showOnlyCommented
    ? previewAssets.filter(asset => {
        const assetComments = preview.comments?.filter(c => c.text.startsWith(`[${asset.id}]`)) || [];
        return assetComments.length > 0;
      })
    : previewAssets;

  return (
    <div className="min-h-screen" style={{ backgroundColor: baseColor }}>
      {/* Header */}
      <div className="shadow-sm sticky top-0 z-10" style={{ backgroundColor: baseColor }}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 flex items-start gap-4">
              {/* Logo */}
              {/* {lookAndFeel?.logo && (
                <div className="flex-shrink-0">
                  <img
                    src={lookAndFeel.logo}
                    alt="Logo"
                    style={lookAndFeel.logoStyle ?
                      Object.fromEntries(
                        lookAndFeel.logoStyle.split(';')
                          .map(s => s.trim())
                          .filter(s => s)
                          .map(s => s.split(':').map(p => p.trim()))
                      ) : {}}
                  />
                </div>
              )} */}

              {/* Title and Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold text-white">
                  <span className="text-white/80">Creative preview: </span>
                  {preview.title}
                </h1>
                <div className="flex items-center gap-4 mt-3 text-sm text-white/90">
                  <div className="flex items-center gap-1">
                    <ImageIcon size={16} />
                    <span>{previewAssets.length} assets</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare size={16} />
                    <span>{preview.comments?.length || 0} comments</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar size={16} />
                    <span>{formatDate(preview.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOnlyCommented(!showOnlyCommented)}
                className="flex items-center gap-2 px-4 py-2 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={showOnlyCommented ? 'Show all assets' : 'Show only assets with comments'}
              >
                {showOnlyCommented ? <CheckSquare size={16} /> : <Square size={16} />}
                Commented
              </button>
              <button
                onClick={handleDownloadAll}
                disabled={downloading || previewAssets.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DownloadCloud size={16} />
                {downloading ? 'Downloading...' : `Download All (${previewAssets.length})`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Assets Gallery */}
        {displayedAssets.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg">
            <ImageIcon size={48} className="mx-auto mb-4 text-gray-300" />
            <p>{showOnlyCommented ? 'No assets with comments' : 'No assets in this preview'}</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
            {displayedAssets.map(asset => {
              const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(asset.extension);
              const isVideo = asset.extension === 'mp4';
              const isStatic = isStaticLocalReview(asset);
              const assetComments = preview.comments?.filter(c => c.text.startsWith(`[${asset.id}]`)) || [];

              return (
                <div
                  key={asset.id}
                  className="group cursor-pointer mb-4 break-inside-avoid"
                  onClick={() => setSelectedAsset(asset)}
                >
                  <div className="relative rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 bg-white">
                    {isStatic && asset.bannerSize && (
                      <div
                        style={{
                          width: '100%',
                          aspectRatio: `${asset.bannerSize.width} / ${asset.bannerSize.height}`,
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        <div
                          style={{
                            width: `${asset.bannerSize.width}px`,
                            height: `${asset.bannerSize.height}px`,
                            transformOrigin: 'top left',
                            transform: 'scale(var(--scale))',
                            position: 'absolute',
                            top: 0,
                            left: 0
                          }}
                          ref={(el) => {
                            if (el) {
                              const parentWidth = el.parentElement?.offsetWidth || asset.bannerSize.width;
                              const scale = parentWidth / asset.bannerSize.width;
                              el.style.setProperty('--scale', scale.toString());
                            }
                          }}
                        >
                          <iframe
                            src={asset.staticPath}
                            className="pointer-events-none"
                            style={{
                              width: `${asset.bannerSize.width}px`,
                              height: `${asset.bannerSize.height}px`,
                              border: 0,
                              display: 'block'
                            }}
                            title={asset.folderName || asset.filename}
                          />
                        </div>
                      </div>
                    )}
                    {!isStatic && isImage && (
                      <img
                        src={asset.url}
                        alt={asset.filename}
                        className="w-full h-auto object-cover"
                        loading="lazy"
                      />
                    )}
                    {!isStatic && isVideo && (
                      <video
                        src={asset.url}
                        className="w-full h-auto object-cover"
                        preload="metadata"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 pointer-events-none">
                      <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">
                        {asset.product || asset.filename}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs font-medium uppercase">
                          {asset.extension}
                        </span>
                        {assetComments.length > 0 && (
                          <span className="px-2 py-1 bg-blue-500/80 backdrop-blur-sm text-white rounded text-xs flex items-center gap-1">
                            <MessageSquare size={12} />
                            {assetComments.length}
                          </span>
                        )}
                        {asset.size && (
                          <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs">
                            {asset.size}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Asset Preview Dialog with Left Sidebar */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex" style={{ backgroundColor: baseColor }}>
          {/* Left Sidebar Panel */}
          <div
            className="flex flex-col transition-all duration-300 ease-in-out relative"
            style={{
              width: leftPanelOpen ? '400px' : '60px',
              backgroundColor: baseColor
            }}
          >
            {/* Panel Content - Full Width */}
            {leftPanelOpen && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Collapse Button Header */}
                <div className="p-4 border-b border-white/20">
                  <button
                    onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                    className="flex-shrink-0 p-2 bg-white/10 backdrop-blur-sm rounded hover:bg-white/20 transition-colors"
                    title="Collapse panel"
                  >
                    <ChevronLeft size={20} className="text-white" />
                  </button>
                </div>

                {/* File Details Section */}
                <div className="p-4 border-b border-white/20">
                  <h3 className="text-md font-bold text-white flex items-center gap-2 mb-3">
                    <Info size={18} />
                    {isStaticLocalReview(selectedAsset) ? 'Ad Details' : 'File Details'}
                  </h3>

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-white/70">{isStaticLocalReview(selectedAsset) ? 'Ad name:' : 'File name:'}</span>
                      <p className="text-white font-medium truncate">
                        {isStaticLocalReview(selectedAsset) ? selectedAsset.folderName : selectedAsset.filename}
                      </p>
                    </div>

                    {assetDimensions && (
                      <div>
                        <span className="text-white/70">Dimensions:</span>
                        <p className="text-white font-medium">{assetDimensions.width} × {assetDimensions.height} px</p>
                      </div>
                    )}

                    <div>
                      <span className="text-white/70">Format:</span>
                      <p className="text-white font-medium uppercase">
                        {isStaticLocalReview(selectedAsset) ? 'HTML Ad' : selectedAsset.extension}
                      </p>
                    </div>

                    {isStaticLocalReview(selectedAsset) && selectedAsset.messageData && selectedAsset.messageData.name && (
                      <div>
                        <span className="text-white/70">Message:</span>
                        <p className="text-white font-medium truncate">{selectedAsset.messageData.name}</p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 mt-4">
                    {isStaticLocalReview(selectedAsset) ? (
                      <>
                        <button
                          onClick={() => handleDownloadStaticAd(selectedAsset)}
                          disabled={downloadingAdId === selectedAsset.id}
                          className="flex items-center gap-2 px-3 py-2 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Download as ZIP"
                        >
                          <Download size={16} />
                          {downloadingAdId === selectedAsset.id ? 'Downloading...' : 'Download'}
                        </button>
                        <a
                          href={selectedAsset.staticPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors text-sm"
                          title="Open"
                        >
                          <ExternalLink size={16} />
                          Open
                        </a>
                      </>
                    ) : (
                      <>
                        <a
                          href={selectedAsset.url}
                          download={selectedAsset.filename}
                          className="flex items-center gap-2 px-3 py-2 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors text-sm"
                          title="Download"
                        >
                          <Download size={16} />
                          Download
                        </a>
                        <a
                          href={selectedAsset.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors"
                          title="Open in new tab"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {/* Comments Section */}
                <div className="p-4 border-b border-white/20">
                  <h3 className="text-md font-bold text-white flex items-center gap-2 mb-3">
                    <MessageSquare size={18} />
                    Comments
                  </h3>

                  {/* Comment Form */}
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={commentAuthor}
                      onChange={(e) => setCommentAuthor(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-3 py-2 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded focus:ring-2 focus:ring-white/50 text-sm"
                    />

                    {/* Reference Point/Rectangle Display */}
                    {referencePoint && (
                      <div className="flex items-center justify-between px-3 py-2 bg-white/10 border border-white/30 rounded text-sm">
                        <span className="text-white/70">Reference:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">
                            {referencePoint.type === 'rectangle'
                              ? `Rect: (${referencePoint.x1}%, ${referencePoint.y1}%) to (${referencePoint.x2}%, ${referencePoint.y2}%)`
                              : `X: ${referencePoint.x}%, Y: ${referencePoint.y}%`
                            }
                          </span>
                          <button
                            onClick={() => {
                              setReferencePoint(null);
                              setUserClickedRef(null);
                              setRectangleStart(null);
                              setIsDrawing(false);
                            }}
                            className="p-1 hover:bg-white/20 rounded transition-colors"
                            title="Clear reference"
                          >
                            <X size={14} className="text-white" />
                          </button>
                        </div>
                      </div>
                    )}

                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add a comment..."
                      rows={3}
                      className="w-full px-3 py-2 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded focus:ring-2 focus:ring-white/50 resize-none text-sm"
                    />
                    <button
                      onClick={() => handleAddComment(selectedAsset.id)}
                      disabled={!commentAuthor.trim() || !commentText.trim()}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/90"
                      style={{ color: baseColor }}
                    >
                      <Send size={14} />
                      Post Comment
                    </button>
                  </div>
                </div>

                {/* Comments List */}
                <div className="flex-1 overflow-auto p-4">
                  {(() => {
                    const assetComments = preview.comments?.filter(c => c.text.startsWith(`[${selectedAsset.id}]`)) || [];

                    if (assetComments.length === 0) {
                      return (
                        <p className="text-center text-white/50 text-xs py-8">
                          No comments yet. Be the first to comment!
                        </p>
                      );
                    }

                    // Sort comments by creation date - newest first
                    const sortedComments = [...assetComments].sort((a, b) =>
                      new Date(b.createdAt) - new Date(a.createdAt)
                    );

                    return sortedComments.map(comment => {
                      // Remove the [assetId] prefix and extract text and coordinates
                      let displayText = comment.text.replace(/^\[.*?\]\s*/, '');
                      const coords = extractCoordinates(comment.text);

                      // Remove coordinate markers from display text
                      if (coords) {
                        if (coords.type === 'rectangle') {
                          displayText = displayText.replace(/@rect\(\d+%,\s*\d+%,\s*\d+%,\s*\d+%\)\s*/, '');
                        } else {
                          displayText = displayText.replace(/@\(\d+%,\s*\d+%\)\s*/, '');
                        }
                      }

                      return (
                        <div
                          key={comment.id}
                          className="border-b border-white/20 py-2 last:border-0 transition-colors hover:bg-white/10 px-2 rounded cursor-pointer"
                          onMouseEnter={() => {
                            if (coords) {
                              setHoveredCommentRef(coords);
                              // Don't set referencePoint when hovering over saved comments
                            }
                          }}
                          onMouseLeave={() => {
                            setHoveredCommentRef(null);
                            // Keep the user-clicked reference intact
                          }}
                        >
                          {/* Comment Text - Bold */}
                          <p className="font-bold text-white text-xs whitespace-pre-wrap mb-1">
                            {displayText}
                          </p>

                          {/* Reference - if exists */}
                          {coords && (
                            <p className="text-white/70 text-xs mb-1">
                              {coords.type === 'rectangle'
                                ? `Reference: Rect (${coords.x1}%, ${coords.y1}%) to (${coords.x2}%, ${coords.y2}%)`
                                : `Reference: Point (${coords.x}%, ${coords.y}%)`
                              }
                            </p>
                          )}

                          {/* Author + Date */}
                          <p className="text-white/60 text-xs">
                            {comment.author} • {formatDate(comment.createdAt)}
                          </p>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Panel Content - Collapsed (Icon Mode) */}
            {!leftPanelOpen && (
              <div className="flex-1 flex flex-col items-center py-4 gap-4">
                <button
                  onClick={() => setLeftPanelOpen(true)}
                  className="p-3 bg-white/10 backdrop-blur-sm rounded hover:bg-white/20 transition-colors"
                  title="Expand panel"
                >
                  <ChevronRight size={24} className="text-white" />
                </button>
                <button
                  onClick={() => setLeftPanelOpen(true)}
                  className="p-3 hover:bg-white/20 rounded transition-colors"
                  title="Asset Info"
                >
                  <ImageIcon size={24} className="text-white" />
                </button>
                <button
                  onClick={() => setLeftPanelOpen(true)}
                  className="p-3 hover:bg-white/20 rounded transition-colors relative"
                  title="Comments"
                >
                  <MessageSquare size={24} className="text-white" />
                  {preview.comments?.filter(c => c.text.startsWith(`[${selectedAsset.id}]`)).length > 0 && (
                    <span
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-xs flex items-center justify-center font-semibold"
                      style={{ color: baseColor }}
                    >
                      {preview.comments.filter(c => c.text.startsWith(`[${selectedAsset.id}]`)).length}
                    </span>
                  )}
                </button>
                {isStaticLocalReview(selectedAsset) ? (
                  <>
                    <button
                      onClick={() => handleDownloadStaticAd(selectedAsset)}
                      disabled={downloadingAdId === selectedAsset.id}
                      className="p-3 hover:bg-white/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Download as ZIP"
                    >
                      <Download size={24} className="text-white" />
                    </button>
                    <a
                      href={selectedAsset.staticPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 hover:bg-white/20 rounded transition-colors"
                      title="Open"
                    >
                      <ExternalLink size={24} className="text-white" />
                    </a>
                  </>
                ) : (
                  <>
                    <a
                      href={selectedAsset.url}
                      download={selectedAsset.filename}
                      className="p-3 hover:bg-white/20 rounded transition-colors"
                      title="Download"
                    >
                      <Download size={24} className="text-white" />
                    </a>
                    <a
                      href={selectedAsset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 hover:bg-white/20 rounded transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink size={24} className="text-white" />
                    </a>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Centered Asset Preview */}
          <div className="flex-1 flex items-center justify-center p-8 relative select-none" onDragStart={(e) => e.preventDefault()}>
            {/* Navigation and Close Buttons */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              {/* Previous Asset Button */}
              <button
                onClick={() => {
                  const currentIndex = previewAssets.findIndex(a => a.id === selectedAsset.id);
                  if (currentIndex > 0) {
                    setSelectedAsset(previewAssets[currentIndex - 1]);
                  }
                }}
                disabled={previewAssets.findIndex(a => a.id === selectedAsset.id) === 0}
                className="p-2 bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous asset"
              >
                <ArrowLeft size={24} className="text-white" />
              </button>

              {/* Next Asset Button */}
              <button
                onClick={() => {
                  const currentIndex = previewAssets.findIndex(a => a.id === selectedAsset.id);
                  if (currentIndex < previewAssets.length - 1) {
                    setSelectedAsset(previewAssets[currentIndex + 1]);
                  }
                }}
                disabled={previewAssets.findIndex(a => a.id === selectedAsset.id) === previewAssets.length - 1}
                className="p-2 bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next asset"
              >
                <ArrowRight size={24} className="text-white" />
              </button>

              {/* Close Button */}
              <button
                onClick={() => {
                  setSelectedAsset(null);
                  setLeftPanelOpen(true); // Reset panel state when closing
                }}
                className="p-2 bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 rounded transition-colors"
                title="Close"
              >
                <X size={24} className="text-white" />
              </button>
            </div>

            {/* Asset Display */}
            <div className="flex items-center justify-center relative" style={{ height: '80vh' }}>
              {isStaticLocalReview(selectedAsset) ? (
                <iframe
                  src={selectedAsset.staticPath}
                  className="rounded-lg shadow-2xl bg-white"
                  style={{
                    width: selectedAsset.bannerSize ? `${selectedAsset.bannerSize.width}px` : '800px',
                    height: selectedAsset.bannerSize ? `${selectedAsset.bannerSize.height}px` : '600px',
                    maxWidth: '90vw',
                    maxHeight: '80vh',
                    border: 'none'
                  }}
                  title={selectedAsset.folderName || selectedAsset.filename}
                  onLoad={(e) => {
                    if (selectedAsset.bannerSize) {
                      setAssetDimensions({
                        width: selectedAsset.bannerSize.width,
                        height: selectedAsset.bannerSize.height
                      });
                    }
                  }}
                />
              ) : selectedAsset.extension === 'mp4' ? (
                <video
                  src={selectedAsset.url}
                  controls
                  autoPlay
                  loop
                  className="max-w-full max-h-full rounded-lg shadow-2xl"
                  onLoadedMetadata={(e) => {
                    setAssetDimensions({
                      width: e.target.videoWidth,
                      height: e.target.videoHeight
                    });
                  }}
                />
              ) : (
                <div className="relative" style={{ maxHeight: '80vh', maxWidth: '100%' }}>
                  <img
                    src={selectedAsset.url}
                    alt={selectedAsset.filename}
                    className="object-contain rounded-lg shadow-2xl cursor-crosshair"
                    style={{ maxHeight: '80vh', maxWidth: '100%', height: 'auto', width: 'auto' }}
                    draggable="false"
                    onMouseDown={handleImageMouseDown}
                    onMouseMove={handleImageMouseMove}
                    onMouseUp={handleImageMouseUp}
                    onLoad={(e) => {
                      setAssetDimensions({
                        width: e.target.naturalWidth,
                        height: e.target.naturalHeight
                      });
                    }}
                  />

                  {/* Animation Styles */}
                  <style>{`
                    @keyframes dash-animation {
                      to {
                        stroke-dashoffset: -20;
                      }
                    }
                    @keyframes dash-color-switch {
                      0%, 100% {
                        stroke: rgba(255, 255, 255, 1);
                      }
                      50% {
                        stroke: rgba(0, 0, 0, 1);
                      }
                    }
                    @keyframes circle-scale-pulse {
                      0%, 100% {
                        transform: scale(0.9);
                      }
                      50% {
                        transform: scale(0.4);
                      }
                    }
                    .animated-dash {
                      animation: dash-animation 1s linear infinite, dash-color-switch 0.75s ease-in-out infinite;
                    }
                    .scale-pulse {
                      transform-origin: center;
                      transform-box: fill-box;
                      animation: circle-scale-pulse 1.5s ease-in-out infinite;
                    }
                  `}</style>

                  {/* User-Clicked Reference Marker - Dashed (hidden when hovering over comment) */}
                  {userClickedRef && !hoveredCommentRef && (
                    <>
                      {userClickedRef.type === 'point' ? (
                        <svg
                          className="absolute pointer-events-none"
                          style={{
                            left: `${userClickedRef.x}%`,
                            top: `${userClickedRef.y}%`,
                            transform: 'translate(-50%, -50%)',
                            width: '100px',
                            height: '100px',
                            overflow: 'visible'
                          }}
                        >
                          <g className="scale-pulse">
                            <circle
                              cx="50"
                              cy="50"
                              r="38"
                              fill="none"
                              stroke="white"
                              strokeWidth="2"
                              strokeDasharray="10 10"
                              className="animated-dash"
                            />
                          </g>
                        </svg>
                      ) : (
                        <svg
                          className="absolute pointer-events-none"
                          style={{
                            left: `${Math.min(userClickedRef.x1, userClickedRef.x2)}%`,
                            top: `${Math.min(userClickedRef.y1, userClickedRef.y2)}%`,
                            width: `${Math.abs(userClickedRef.x2 - userClickedRef.x1)}%`,
                            height: `${Math.abs(userClickedRef.y2 - userClickedRef.y1)}%`,
                            overflow: 'visible'
                          }}
                        >
                          <rect
                            x="0"
                            y="0"
                            width="100%"
                            height="100%"
                            fill="none"
                            stroke="white"
                            strokeWidth="1"
                            strokeDasharray="10 10"
                            className="animated-dash"
                          />
                        </svg>
                      )}
                    </>
                  )}

                  {/* Hovered Comment Reference Marker - Solid */}
                  {hoveredCommentRef && (
                    <>
                      {hoveredCommentRef.type === 'point' ? (
                        <svg
                          className="absolute pointer-events-none"
                          style={{
                            left: `${hoveredCommentRef.x}%`,
                            top: `${hoveredCommentRef.y}%`,
                            transform: 'translate(-50%, -50%)',
                            width: '100px',
                            height: '100px',
                            overflow: 'visible'
                          }}
                        >
                          <g className="scale-pulse">
                            <circle
                              cx="50"
                              cy="50"
                              r="38"
                              fill="none"
                              stroke="white"
                              strokeWidth="2"
                              strokeDasharray="10 10"
                              className="animated-dash"
                            />
                          </g>
                        </svg>
                      ) : (
                        <svg
                          className="absolute pointer-events-none"
                          style={{
                            left: `${Math.min(hoveredCommentRef.x1, hoveredCommentRef.x2)}%`,
                            top: `${Math.min(hoveredCommentRef.y1, hoveredCommentRef.y2)}%`,
                            width: `${Math.abs(hoveredCommentRef.x2 - hoveredCommentRef.x1)}%`,
                            height: `${Math.abs(hoveredCommentRef.y2 - hoveredCommentRef.y1)}%`,
                            overflow: 'visible'
                          }}
                        >
                          <rect
                            x="0"
                            y="0"
                            width="100%"
                            height="100%"
                            fill="none"
                            stroke="white"
                            strokeWidth="1"
                            strokeDasharray="10 10"
                            className="animated-dash"
                          />
                        </svg>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicPreviewView;

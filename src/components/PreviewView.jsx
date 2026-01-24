import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiGet, apiPost, authenticatedFetch } from '../utils/api';
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
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Info,
  CheckSquare,
  Square,
  Filter
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  getPreviewById,
  addComment
} from '../services/previewService';
import { useAuth } from '../contexts/AuthContext';

// Lazy loading iframe - only loads when visible in viewport
const LazyIframe = ({ src, width, height, title, className, style }) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Start loading 100px before visible
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width, height, ...style }} className={className}>
      {isVisible ? (
        <iframe
          src={src}
          width={width}
          height={height}
          title={title}
          style={{ border: 0, display: 'block' }}
        />
      ) : (
        <div className="w-full h-full bg-white/5" />
      )}
    </div>
  );
};

// Masonry Grid Component - fills shortest column first (same as Creative Library)
const MasonryGrid = ({ assets, preview, isStaticLocalReview, getAssetUrl, onAssetClick }) => {
  const [columnCount, setColumnCount] = useState(4);

  // Responsive column count
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 640) setColumnCount(1);
      else if (width < 1024) setColumnCount(2);
      else if (width < 1280) setColumnCount(3);
      else setColumnCount(4);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // Distribute assets to columns using shortest-column algorithm
  const columns = useMemo(() => {
    const cols = Array.from({ length: columnCount }, () => []);
    const heights = Array(columnCount).fill(0);

    assets.forEach(asset => {
      // Estimate height based on aspect ratio (default to 1:1 if unknown)
      let aspectRatio = 1;
      if (asset.bannerSize) {
        aspectRatio = asset.bannerSize.height / asset.bannerSize.width;
      } else if (asset.size) {
        const match = asset.size.match(/(\d+)x(\d+)/);
        if (match) {
          aspectRatio = parseInt(match[2]) / parseInt(match[1]);
        }
      }

      // Find shortest column
      const shortestCol = heights.indexOf(Math.min(...heights));

      // Add asset to shortest column
      cols[shortestCol].push(asset);

      // Update height estimate (using column width of ~300px)
      heights[shortestCol] += 300 * aspectRatio + 16; // 16px gap
    });

    return cols;
  }, [assets, columnCount]);

  const renderAsset = (asset) => {
    const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(asset.extension);
    const isVideo = asset.extension === 'mp4';
    const isStatic = isStaticLocalReview(asset);
    const assetComments = preview.comments?.filter(c => c.text.startsWith(`[${asset.id}]`)) || [];

    // Get banner size - fallback to parsing from size string if bannerSize object missing
    let bannerSize = asset.bannerSize;
    if (!bannerSize && asset.size) {
      const match = asset.size.match(/(\d+)x(\d+)/);
      if (match) {
        bannerSize = { width: parseInt(match[1]), height: parseInt(match[2]) };
      }
    }

    return (
      <div
        key={asset.id}
        className="group cursor-pointer mb-4"
        onClick={() => onAssetClick(asset)}
      >
        <div className="relative rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 bg-white/10">
          {isStatic && bannerSize && (
            <div
              style={{
                width: '100%',
                aspectRatio: `${bannerSize.width} / ${bannerSize.height}`,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${bannerSize.width}px`,
                  height: `${bannerSize.height}px`,
                  transformOrigin: 'top left',
                  transform: 'scale(var(--scale))',
                  position: 'absolute',
                  top: 0,
                  left: 0
                }}
                ref={(el) => {
                  if (el) {
                    const parentWidth = el.parentElement?.offsetWidth || bannerSize.width;
                    const scale = parentWidth / bannerSize.width;
                    el.style.setProperty('--scale', scale.toString());
                  }
                }}
              >
                <LazyIframe
                  src={asset.staticPath}
                  width={bannerSize.width}
                  height={bannerSize.height}
                  title={asset.folderName || asset.filename}
                />
                {/* Click overlay to capture clicks over iframe */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${bannerSize.width}px`,
                    height: `${bannerSize.height}px`,
                    cursor: 'pointer',
                    zIndex: 10
                  }}
                />
              </div>
            </div>
          )}
          {/* Fallback for static without bannerSize */}
          {isStatic && !bannerSize && (
            <div style={{ position: 'relative', minHeight: '200px' }}>
              <LazyIframe
                src={asset.staticPath}
                width="100%"
                height={200}
                title={asset.folderName || asset.filename}
                style={{ minHeight: '200px' }}
              />
              {/* Click overlay to capture clicks over iframe */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  cursor: 'pointer',
                  zIndex: 10
                }}
              />
            </div>
          )}
          {!isStatic && isImage && (
            <img
              src={getAssetUrl(asset)}
              alt={asset.filename}
              className="w-full h-auto object-cover"
              loading="lazy"
            />
          )}
          {!isStatic && isVideo && (
            <video
              src={getAssetUrl(asset)}
              className="w-full h-auto object-cover"
              preload="metadata"
            />
          )}
          {/* Hover Overlay with Info - same as Creative Library */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 pointer-events-none">
            <div className="flex items-center gap-2 flex-wrap">
              {isStatic && asset.messageData ? (
                // Dynamic HTML ad - show product, MC number, variant, size, version
                <>
                  {asset.product && (
                    <span className="px-2 py-1 bg-blue-500/80 backdrop-blur-sm text-white rounded text-xs">
                      {asset.product}
                    </span>
                  )}
                  <span className="px-2 py-1 bg-purple-500/80 backdrop-blur-sm text-white rounded text-xs font-medium">
                    MC{asset.messageData.number}
                  </span>
                  <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs">
                    {(asset.messageData.variant || asset.variant || 'a').toUpperCase()}
                  </span>
                  {bannerSize && (
                    <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs">
                      {bannerSize.width}x{bannerSize.height}
                    </span>
                  )}
                  <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs">
                    v{asset.messageData.version || 1}
                  </span>
                </>
              ) : (
                // Static file - show product, extension, size
                <>
                  {asset.product && (
                    <span className="px-2 py-1 bg-blue-500/80 backdrop-blur-sm text-white rounded text-xs">
                      {asset.product}
                    </span>
                  )}
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
                      {asset.variant.toUpperCase()}
                    </span>
                  )}
                </>
              )}
              {/* Comment count badge */}
              {assetComments.length > 0 && (
                <span className="px-2 py-1 bg-orange-500/80 backdrop-blur-sm text-white rounded text-xs flex items-center gap-1">
                  <MessageSquare size={12} />
                  {assetComments.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex gap-4 justify-center">
      {columns.map((columnAssets, colIndex) => (
        <div key={colIndex} className="flex-1 max-w-xs flex flex-col">
          {columnAssets.map(asset => renderAsset(asset))}
        </div>
      ))}
    </div>
  );
};

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
  const [sizeFilter, setSizeFilter] = useState('all');
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);

  // Load configuration (use public endpoint - no auth required for share links)
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Use relative URL in production, localhost in development
        const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3003' : '');
        const response = await fetch(`${API_URL}/api/config-basic`);
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
    // Load preview when previewId changes
    // Note: We don't require allAssets anymore since Drive-based shares
    // have assets embedded in the share metadata
    if (previewId) {
      loadPreview();
    }
  }, [previewId]);

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

  // Helper function to get the correct URL for an asset
  const getAssetUrl = (asset) => {
    // For Drive assets, use fullResUrl (proxy endpoint) or driveId if available
    if (asset.driveId || asset.source === 'drive') {
      return asset.fullResUrl || `/api/drive/proxy/${asset.driveId || asset.id}`;
    }
    // For local assets, use the regular url
    return asset.url;
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

  // Sort assets based on sortSettings from share
  const sortAssets = (assets, sortSettings) => {
    if (!sortSettings || !sortSettings.column) return assets;

    const { column, direction } = sortSettings;
    const sorted = [...assets].sort((a, b) => {
      let comparison = 0;

      switch (column) {
        case 'name': {
          // Sort by MC number numerically for dynamic, filename for others
          const getMcNumber = (asset) => {
            if (asset.isDynamic && asset.messageData?.number) {
              return parseInt(asset.messageData.number, 10) || 0;
            }
            const match = (asset.filename || asset.folderName || '').match(/MC(\d+)/i);
            if (match) return parseInt(match[1], 10) || 0;
            return 0;
          };
          const mcNumA = getMcNumber(a);
          const mcNumB = getMcNumber(b);
          if (mcNumA > 0 || mcNumB > 0) {
            comparison = mcNumA - mcNumB;
          } else {
            comparison = (a.filename || '').localeCompare(b.filename || '');
          }
          break;
        }
        case 'size': {
          const parseSize = (size) => {
            if (!size) return 0;
            const match = size.match(/(\d+)x(\d+)/);
            if (match) return parseInt(match[1]) * parseInt(match[2]);
            return 0;
          };
          comparison = parseSize(a.size) - parseSize(b.size);
          break;
        }
        case 'template': {
          const templateA = (a.messageData?.template || '').toLowerCase();
          const templateB = (b.messageData?.template || '').toLowerCase();
          comparison = templateA.localeCompare(templateB);
          break;
        }
        case 'date': {
          const dateA = a.date || a.File_date || '';
          const dateB = b.date || b.File_date || '';
          const timeA = dateA ? new Date(dateA).getTime() : 0;
          const timeB = dateB ? new Date(dateB).getTime() : 0;
          comparison = timeA - timeB;
          break;
        }
        case 'product': {
          const productA = (a.product || '').toLowerCase();
          const productB = (b.product || '').toLowerCase();
          comparison = productA.localeCompare(productB);
          break;
        }
        default:
          comparison = 0;
      }

      return direction === 'asc' ? comparison : -comparison;
    });

    return sorted;
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
    let assets;
    if (loadedPreview.assets && Array.isArray(loadedPreview.assets)) {
      console.log('PublicPreviewView: Using assets from share data:', loadedPreview.assets);
      console.log('PublicPreviewView: First asset sample:', loadedPreview.assets[0]);
      assets = loadedPreview.assets;
    } else {
      // Fallback to loading from allAssets (for regular shares)
      assets = allAssets.filter(asset => {
        const matches = loadedPreview.assetIds.includes(asset.id);
        console.log(`Checking asset ${asset.id}: ${matches}`);
        return matches;
      });
      console.log('PublicPreviewView: Filtered assets:', assets);
    }

    // Apply sort settings if present
    if (loadedPreview.sortSettings) {
      console.log('PublicPreviewView: Applying sort settings:', loadedPreview.sortSettings);
      assets = sortAssets(assets, loadedPreview.sortSettings);
    }

    setPreviewAssets(assets);
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

      const newComment = await addComment(previewId, commentAuthor, commentWithAsset);

      // Update preview state with new comment instead of reloading
      setPreview(prev => ({
        ...prev,
        comments: [...(prev.comments || []), newComment]
      }));

      // Create a task for this comment
      const asset = previewAssets.find(a => a.id === assetId);
      if (asset) {
        const assetName = asset.folderName || asset.filename || assetId;
        const taskTitle = `Preview Comment: ${assetName.replace(/_/g, ' ')}`;
        const previewUrl = `${window.location.origin}/share/${previewId}`;
        const taskDescription = `${commentText}\n\nPreview: ${previewUrl}`;

        // Create related content with the asset image
        const relatedContent = [{
          type: 'image',
          url: getAssetUrl(asset),
          filename: asset.filename || asset.folderName,
          addedAt: new Date().toISOString()
        }];

        // Create the task
        await apiPost('/api/tasks/create', {
          title: taskTitle,
          description: taskDescription,
          priority: 'Medium',
          status: 'pending',
          bucket: 'incoming',
          source: `Preview Comment by ${commentAuthor}`,
          from: commentAuthor,
          relatedContent
        });
      }

      // Clear everything after posting (keep author if user is logged in)
      if (!currentUser || !currentUser.email) {
        setCommentAuthor('');
      }
      setCommentText('');
      setReferencePoint(null);
      setUserClickedRef(null);
      setRectangleStart(null);
      setIsDrawing(false);
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

            // Track all image files to fetch
            const imagesToFetch = new Set();

            // Fetch and process HTML
            let htmlText = '';
            try {
              const htmlResponse = await fetch(`${folderPath}/index.html`);
              if (htmlResponse.ok) {
                htmlText = await htmlResponse.text();

                // Extract images from <img> tags
                const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
                let match;
                while ((match = imgRegex.exec(htmlText)) !== null) {
                  const imgSrc = match[1];
                  // Extract filename from URL (could be /api/drive/proxy/filename or just filename)
                  const filename = imgSrc.includes('/') ? imgSrc.split('/').pop() : imgSrc;
                  if (filename && !imgSrc.startsWith('http://') && !imgSrc.startsWith('https://')) {
                    imagesToFetch.add(filename);
                  }
                }

                // Extract images from background-image:url(...) in inline styles
                const bgImageRegex = /background-image\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/g;
                while ((match = bgImageRegex.exec(htmlText)) !== null) {
                  const imgSrc = match[1];
                  // Extract filename from URL
                  const filename = imgSrc.includes('/') ? imgSrc.split('/').pop() : imgSrc;
                  if (filename && !imgSrc.startsWith('http://') && !imgSrc.startsWith('https://')) {
                    imagesToFetch.add(filename);
                  }
                }
              }
            } catch (error) {
              console.error('Failed to fetch HTML:', error);
            }

            // Fetch and process CSS
            let cssText = '';
            try {
              const cssResponse = await fetch(`${folderPath}/styles.css`);
              if (cssResponse.ok) {
                cssText = await cssResponse.text();

                // Extract images from url() in CSS
                const cssUrlRegex = /url\(['"]?([^'")\s]+)['"]?\)/g;
                let match;
                while ((match = cssUrlRegex.exec(cssText)) !== null) {
                  const urlPath = match[1];
                  // Extract filename from URL
                  const filename = urlPath.includes('/') ? urlPath.split('/').pop() : urlPath;
                  if (filename && !urlPath.startsWith('http://') && !urlPath.startsWith('https://') && !urlPath.startsWith('data:')) {
                    imagesToFetch.add(filename);
                  }
                }
              }
            } catch (error) {
              console.error('Failed to fetch CSS:', error);
            }

            // Fetch all image files from Drive
            for (const imgSrc of imagesToFetch) {
              try {
                // Use the same Drive proxy endpoint that works for display
                const driveResponse = await apiGet(`/api/drive/proxy/${imgSrc}`);
                if (driveResponse.ok) {
                  const imgBlob = await driveResponse.blob();
                  adFolder.file(imgSrc, imgBlob);
                  console.log(`✓ Downloaded ${imgSrc} from Drive`);
                } else {
                  console.warn(`Skipping ${imgSrc} - not found (${driveResponse.status})`);
                }
              } catch (error) {
                console.error(`Failed to fetch image ${imgSrc}:`, error);
              }
            }

            // Add HTML with relative paths (replace /api/drive/proxy/ with just filenames)
            if (htmlText) {
              let cleanedHtml = htmlText;

              // Replace all /api/drive/proxy/{filename} with just {filename}
              cleanedHtml = cleanedHtml.replace(/\/api\/drive\/proxy\//g, '');

              adFolder.file('index.html', cleanedHtml);
            }

            // Add CSS (already has relative paths from server)
            if (cssText) {
              adFolder.file('styles.css', cssText);
            }

            // Fetch and add manifest.json
            try {
              const manifestResponse = await fetch(`${folderPath}/manifest.json`);
              if (manifestResponse.ok) {
                const manifestBlob = await manifestResponse.blob();
                adFolder.file('manifest.json', manifestBlob);
              }
            } catch (error) {
              console.error('Failed to fetch manifest:', error);
            }
          } else {
            // Regular asset (image, video, etc.)
            const response = await fetch(getAssetUrl(asset));
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

      // Track all image files to fetch
      const imagesToFetch = new Set();

      // Fetch and process HTML
      let htmlText = '';
      try {
        const htmlResponse = await fetch(`${folderPath}/index.html`);
        if (htmlResponse.ok) {
          htmlText = await htmlResponse.text();

          // Extract images from <img> tags
          const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
          let match;
          while ((match = imgRegex.exec(htmlText)) !== null) {
            const imgSrc = match[1];
            // Extract filename from URL (could be /api/drive/proxy/filename or just filename)
            const filename = imgSrc.includes('/') ? imgSrc.split('/').pop() : imgSrc;
            if (filename && !imgSrc.startsWith('http://') && !imgSrc.startsWith('https://')) {
              imagesToFetch.add(filename);
            }
          }

          // Extract images from background-image:url(...) in inline styles
          const bgImageRegex = /background-image\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/g;
          while ((match = bgImageRegex.exec(htmlText)) !== null) {
            const imgSrc = match[1];
            // Extract filename from URL
            const filename = imgSrc.includes('/') ? imgSrc.split('/').pop() : imgSrc;
            if (filename && !imgSrc.startsWith('http://') && !imgSrc.startsWith('https://')) {
              imagesToFetch.add(filename);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch HTML:', error);
      }

      // Fetch and process CSS
      let cssText = '';
      try {
        const cssResponse = await fetch(`${folderPath}/styles.css`);
        if (cssResponse.ok) {
          cssText = await cssResponse.text();

          // Extract images from url() in CSS
          const cssUrlRegex = /url\(['"]?([^'")\s]+)['"]?\)/g;
          let match;
          while ((match = cssUrlRegex.exec(cssText)) !== null) {
            const urlPath = match[1];
            // Extract filename from URL
            const filename = urlPath.includes('/') ? urlPath.split('/').pop() : urlPath;
            if (filename && !urlPath.startsWith('http://') && !urlPath.startsWith('https://') && !urlPath.startsWith('data:')) {
              imagesToFetch.add(filename);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch CSS:', error);
      }

      // Fetch all image files from Drive
      for (const imgSrc of imagesToFetch) {
        try {
          // Use the same Drive proxy endpoint that works for display
          const driveResponse = await apiGet(`/api/drive/proxy/${imgSrc}`);
          if (driveResponse.ok) {
            const imgBlob = await driveResponse.blob();
            zip.file(imgSrc, imgBlob);
            console.log(`✓ Downloaded ${imgSrc} from Drive`);
          } else {
            console.warn(`Skipping ${imgSrc} - not found (${driveResponse.status})`);
          }
        } catch (error) {
          console.error(`Failed to fetch image ${imgSrc}:`, error);
        }
      }

      // Add HTML with relative paths (replace /api/drive/proxy/ with just filenames)
      if (htmlText) {
        let cleanedHtml = htmlText;

        // Replace all /api/drive/proxy/{filename} with just {filename}
        cleanedHtml = cleanedHtml.replace(/\/api\/drive\/proxy\//g, '');

        zip.file('index.html', cleanedHtml);
      }

      // Add CSS (already has relative paths from server)
      if (cssText) {
        zip.file('styles.css', cssText);
      }

      // Fetch and add manifest.json
      try {
        const manifestResponse = await fetch(`${folderPath}/manifest.json`);
        if (manifestResponse.ok) {
          const manifestBlob = await manifestResponse.blob();
          zip.file('manifest.json', manifestBlob);
        }
      } catch (error) {
        console.error('Failed to fetch manifest:', error);
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

  // Get unique sizes from assets (must be before early returns to maintain hook order)
  const uniqueSizes = useMemo(() => {
    const sizes = new Set();
    previewAssets.forEach(asset => {
      if (asset.size) {
        sizes.add(asset.size);
      } else if (asset.bannerSize) {
        sizes.add(`${asset.bannerSize.width}x${asset.bannerSize.height}`);
      }
    });
    // Sort sizes by width then height
    return Array.from(sizes).sort((a, b) => {
      const [aW, aH] = a.split('x').map(Number);
      const [bW, bH] = b.split('x').map(Number);
      return aW - bW || aH - bH;
    });
  }, [previewAssets]);

  // Filter assets based on size filter and showOnlyCommented checkbox
  const displayedAssets = useMemo(() => {
    let filtered = previewAssets;

    // Apply size filter
    if (sizeFilter !== 'all') {
      filtered = filtered.filter(asset => {
        const assetSize = asset.size || (asset.bannerSize ? `${asset.bannerSize.width}x${asset.bannerSize.height}` : null);
        return assetSize === sizeFilter;
      });
    }

    // Apply comment filter
    if (showOnlyCommented && preview) {
      filtered = filtered.filter(asset => {
        const assetComments = preview.comments?.filter(c => c.text.startsWith(`[${asset.id}]`)) || [];
        return assetComments.length > 0;
      });
    }

    return filtered;
  }, [previewAssets, sizeFilter, showOnlyCommented, preview]);

  // Close size dropdown when clicking outside
  useEffect(() => {
    if (!sizeDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-size-dropdown]')) {
        setSizeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sizeDropdownOpen]);

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
              {/* Size Filter Dropdown */}
              {uniqueSizes.length > 1 && (
                <div className="relative" data-size-dropdown>
                  <button
                    onClick={() => setSizeDropdownOpen(!sizeDropdownOpen)}
                    className="flex items-center gap-2 px-4 py-2 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors"
                  >
                    <Filter size={16} />
                    {sizeFilter === 'all' ? 'All Sizes' : sizeFilter}
                    <ChevronDown size={16} className={`transition-transform ${sizeDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {sizeDropdownOpen && (
                    <div className="absolute right-0 mt-1 bg-gray-900 border border-white/20 rounded-lg shadow-lg z-20 min-w-[140px] max-h-64 overflow-y-auto">
                      <button
                        onClick={() => {
                          setSizeFilter('all');
                          setSizeDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors ${sizeFilter === 'all' ? 'bg-white/20 text-white font-medium' : 'text-white/80'}`}
                      >
                        All Sizes ({previewAssets.length})
                      </button>
                      {uniqueSizes.map(size => {
                        const count = previewAssets.filter(a => {
                          const assetSize = a.size || (a.bannerSize ? `${a.bannerSize.width}x${a.bannerSize.height}` : null);
                          return assetSize === size;
                        }).length;
                        return (
                          <button
                            key={size}
                            onClick={() => {
                              setSizeFilter(size);
                              setSizeDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors ${sizeFilter === size ? 'bg-white/20 text-white font-medium' : 'text-white/80'}`}
                          >
                            {size} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
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
                disabled={downloading || displayedAssets.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DownloadCloud size={16} />
                {downloading ? 'Downloading...' : `Download All (${displayedAssets.length})`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Assets Gallery - Shortest Column Masonry */}
        {displayedAssets.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg">
            <ImageIcon size={48} className="mx-auto mb-4 text-gray-300" />
            <p>
              {sizeFilter !== 'all' && showOnlyCommented
                ? `No ${sizeFilter} assets with comments`
                : sizeFilter !== 'all'
                ? `No ${sizeFilter} assets`
                : showOnlyCommented
                ? 'No assets with comments'
                : 'No assets in this preview'}
            </p>
          </div>
        ) : (
          <MasonryGrid
            assets={displayedAssets}
            preview={preview}
            isStaticLocalReview={isStaticLocalReview}
            getAssetUrl={getAssetUrl}
            onAssetClick={setSelectedAsset}
          />
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
                          href={getAssetUrl(selectedAsset)}
                          download={selectedAsset.filename}
                          className="flex items-center gap-2 px-3 py-2 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors text-sm"
                          title="Download"
                        >
                          <Download size={16} />
                          Download
                        </a>
                        <a
                          href={getAssetUrl(selectedAsset)}
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
                      href={getAssetUrl(selectedAsset)}
                      download={selectedAsset.filename}
                      className="p-3 hover:bg-white/20 rounded transition-colors"
                      title="Download"
                    >
                      <Download size={24} className="text-white" />
                    </a>
                    <a
                      href={getAssetUrl(selectedAsset)}
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
                    // Clear reference markers when switching assets
                    setReferencePoint(null);
                    setUserClickedRef(null);
                    setRectangleStart(null);
                    setIsDrawing(false);
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
                    // Clear reference markers when switching assets
                    setReferencePoint(null);
                    setUserClickedRef(null);
                    setRectangleStart(null);
                    setIsDrawing(false);
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
                  // Clear reference markers when closing
                  setReferencePoint(null);
                  setUserClickedRef(null);
                  setRectangleStart(null);
                  setIsDrawing(false);
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
                <div
                  className="relative"
                  style={{
                    // Calculate scaled dimensions to fit viewport
                    width: (() => {
                      if (!selectedAsset.bannerSize) return '800px';
                      const maxW = window.innerWidth * 0.7; // 70vw (accounting for side panel)
                      const maxH = window.innerHeight * 0.8; // 80vh
                      const scaleW = maxW / selectedAsset.bannerSize.width;
                      const scaleH = maxH / selectedAsset.bannerSize.height;
                      const scale = Math.min(scaleW, scaleH, 1); // Don't scale up, only down
                      return `${selectedAsset.bannerSize.width * scale}px`;
                    })(),
                    height: (() => {
                      if (!selectedAsset.bannerSize) return '600px';
                      const maxW = window.innerWidth * 0.7;
                      const maxH = window.innerHeight * 0.8;
                      const scaleW = maxW / selectedAsset.bannerSize.width;
                      const scaleH = maxH / selectedAsset.bannerSize.height;
                      const scale = Math.min(scaleW, scaleH, 1);
                      return `${selectedAsset.bannerSize.height * scale}px`;
                    })(),
                    overflow: 'hidden'
                  }}
                >
                  <iframe
                    src={selectedAsset.staticPath}
                    className="rounded-lg shadow-2xl bg-white"
                    style={{
                      width: selectedAsset.bannerSize ? `${selectedAsset.bannerSize.width}px` : '800px',
                      height: selectedAsset.bannerSize ? `${selectedAsset.bannerSize.height}px` : '600px',
                      border: 'none',
                      display: 'block',
                      transformOrigin: 'top left',
                      transform: (() => {
                        if (!selectedAsset.bannerSize) return 'none';
                        const maxW = window.innerWidth * 0.7;
                        const maxH = window.innerHeight * 0.8;
                        const scaleW = maxW / selectedAsset.bannerSize.width;
                        const scaleH = maxH / selectedAsset.bannerSize.height;
                        const scale = Math.min(scaleW, scaleH, 1);
                        return `scale(${scale})`;
                      })()
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

                  {/* Transparent overlay for capturing mouse events */}
                  <div
                    className="absolute top-0 left-0 right-0 bottom-0 cursor-crosshair"
                    style={{
                      pointerEvents: 'all',
                      zIndex: 10
                    }}
                    onMouseDown={handleImageMouseDown}
                    onMouseMove={handleImageMouseMove}
                    onMouseUp={handleImageMouseUp}
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
                            overflow: 'visible',
                            zIndex: 20
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
                            overflow: 'visible',
                            zIndex: 20
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
                            overflow: 'visible',
                            zIndex: 20
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
                            overflow: 'visible',
                            zIndex: 20
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
              ) : selectedAsset.extension === 'mp4' ? (
                <video
                  src={getAssetUrl(selectedAsset)}
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
                    src={getAssetUrl(selectedAsset)}
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

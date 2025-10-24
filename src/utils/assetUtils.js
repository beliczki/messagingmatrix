// Shared utility functions for asset/creative management

// Helper function to extract metadata from filename
export const extractMetadata = (filename) => {
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|mp4|gif)$/i, '');
  const parts = nameWithoutExt.split('_');
  const sizeMatch = nameWithoutExt.match(/(\d+)x(\d+)/);
  const size = sizeMatch ? `${sizeMatch[1]}x${sizeMatch[2]}` : null;

  const dateMatch = nameWithoutExt.match(/(\d{6})/);
  let date = null;
  if (dateMatch) {
    const dateStr = dateMatch[1];
    const year = 20 + parseInt(dateStr.substring(0, 2));
    const month = parseInt(dateStr.substring(2, 4));
    const day = parseInt(dateStr.substring(4, 6));
    date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const platforms = [];
  if (nameWithoutExt.toLowerCase().includes('fb')) platforms.push('Facebook');
  if (nameWithoutExt.toLowerCase().includes('google') || nameWithoutExt.toLowerCase().includes('pmax')) platforms.push('Google');
  if (nameWithoutExt.toLowerCase().includes('banner')) platforms.push('Display');

  const tags = [];
  if (nameWithoutExt.toLowerCase().includes('pro')) tags.push('Prospecting');
  if (nameWithoutExt.toLowerCase().includes('rem')) tags.push('Remarketing');
  if (nameWithoutExt.toLowerCase().includes('ltp')) tags.push('LTP');
  if (nameWithoutExt.toLowerCase().includes('cube')) tags.push('Cube');
  if (nameWithoutExt.toLowerCase().includes('halfpage')) tags.push('Half Page');

  let product = '';
  if (parts.length > 1) {
    product = parts[1].replace(/^\d+/, '');
  }

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

// Process loaded assets from import.meta.glob results
// Note: import.meta.glob() must be called with string literals in the component
// Note: Still used by CreativeLibrary.jsx (not migrated to Drive yet)
export const processAssets = async (assetModules) => {
  try {
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

    // Fetch file stats from backend to get actual modification times
    try {
      const response = await fetch('/api/assets/stats');
      if (response.ok) {
        const stats = await response.json();

        // Add modification time to each asset
        assetList.forEach(asset => {
          const stat = stats.find(s => s.filename === asset.filename);
          if (stat) {
            asset.modifiedTime = new Date(stat.mtime).getTime();
          }
        });

        // Sort by modification time descending (newest first)
        assetList.sort((a, b) => {
          // If both have modification times, use those
          if (a.modifiedTime && b.modifiedTime) {
            return b.modifiedTime - a.modifiedTime;
          }
          // If one has modification time, it goes first
          if (a.modifiedTime) return -1;
          if (b.modifiedTime) return 1;

          // Fallback to date from filename
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return b.date.localeCompare(a.date);
        });
      }
    } catch (error) {
      console.error('Could not fetch file stats, falling back to filename date:', error);
      // Fallback: Sort by date from filename
      assetList.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
      });
    }

    return assetList;
  } catch (error) {
    console.error('Error processing assets:', error);
    return [];
  }
};

// Filter assets based on search text with AND/OR operators
export const filterAssets = (assets, filterText) => {
  // Safety checks
  if (!assets || !Array.isArray(assets)) return [];
  if (!filterText || !filterText.trim()) return assets;

  return assets.filter(asset => {
    if (!asset) return false;
    // Build searchable text from ALL fields of the asset object
    const searchableFields = [];

    // Iterate through all properties of the asset
    Object.keys(asset).forEach(key => {
      const value = asset[key];

      // Skip non-searchable fields
      if (key === 'url' || key === 'thumbnail' || key === 'id' || key === 'source') {
        return;
      }

      // Handle different value types
      if (value === null || value === undefined) {
        return;
      } else if (Array.isArray(value)) {
        // Add all array elements
        searchableFields.push(...value.filter(v => v !== null && v !== undefined));
      } else if (typeof value === 'string' || typeof value === 'number') {
        searchableFields.push(String(value));
      } else if (typeof value === 'object') {
        // Handle nested objects (like messageData)
        Object.values(value).forEach(nestedValue => {
          if (nestedValue !== null && nestedValue !== undefined) {
            if (typeof nestedValue === 'string' || typeof nestedValue === 'number') {
              searchableFields.push(String(nestedValue));
            }
          }
        });
      }
    });

    const searchableText = searchableFields.join(' ').toLowerCase();

    const filterLower = filterText.toLowerCase();

    // Check if the filter contains 'or' operator
    if (filterLower.includes(' or ')) {
      // Split by ' or ' and check if any term matches
      const orTerms = filterLower.split(' or ').map(t => t.trim()).filter(t => t.length > 0);
      return orTerms.some(term => {
        // Each term can still contain 'and' conditions
        if (term.includes(' and ')) {
          const andTerms = term.split(' and ').map(t => t.trim()).filter(t => t.length > 0);
          return andTerms.every(andTerm => searchableText.includes(andTerm));
        }
        return searchableText.includes(term);
      });
    } else if (filterLower.includes(' and ')) {
      // Split by ' and ' and check if all terms match
      const andTerms = filterLower.split(' and ').map(t => t.trim()).filter(t => t.length > 0);
      return andTerms.every(term => searchableText.includes(term));
    } else {
      // Default behavior: split by whitespace and use AND logic
      const terms = filterLower.split(/\s+/).filter(t => t.length > 0);
      return terms.every(term => searchableText.includes(term));
    }
  });
};

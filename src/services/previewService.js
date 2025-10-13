// Preview Service - Manages preview asset collections
// Uses API endpoints for persistence

const API_BASE_URL = '/api';

// Get single preview by ID
export const getPreviewById = async (previewId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/shares/${previewId}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get preview: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading preview:', error);
    return null;
  }
};

// Create new preview from selected asset IDs
export const createPreview = async (assetIds, title = '', baseColor = '#2870ed') => {
  try {
    console.log('previewService: Creating preview with', assetIds.length, 'assets');
    console.log('previewService: API URL:', `${API_BASE_URL}/shares`);

    const response = await fetch(`${API_BASE_URL}/shares`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assetIds,
        title: title || `Preview ${new Date().toLocaleDateString()}`,
        baseColor
      })
    });

    console.log('previewService: Response status:', response.status);
    console.log('previewService: Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('previewService: Error response:', errorText);
      throw new Error(`Failed to create preview: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('previewService: Success result:', result);
    return {
      id: result.shareId,
      url: result.url
    };
  } catch (error) {
    console.error('previewService: Error creating preview:', error);
    throw error;
  }
};

// Add comment to preview
export const addComment = async (previewId, author, text) => {
  try {
    const response = await fetch(`${API_BASE_URL}/shares/${previewId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ author, text })
    });

    if (!response.ok) {
      throw new Error(`Failed to add comment: ${response.statusText}`);
    }

    const result = await response.json();
    return result.comment;
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
};

// Generate public URL for preview
export const getPublicUrl = (previewId) => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/share/${previewId}`;
};

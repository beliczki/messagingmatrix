// API Helper - Automatically includes JWT token in requests

// Use VITE_API_URL if set, otherwise use empty string for relative URLs (same origin)
// This allows nginx to proxy /api requests to the backend
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3003' : '');

// Get auth token from localStorage
const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return token ? {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  } : {
    'Content-Type': 'application/json'
  };
};

// Wrapper around fetch that includes auth headers
export const authenticatedFetch = async (url, options = {}) => {
  const authHeaders = getAuthHeaders();

  const fetchOptions = {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers
    }
  };

  const response = await fetch(url, fetchOptions);

  // If 401 Unauthorized, token might be expired - redirect to login
  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    window.location.href = '/login';
  }

  return response;
};

// Helper for GET requests
export const apiGet = async (endpoint) => {
  return authenticatedFetch(`${API_URL}${endpoint}`);
};

// Helper for POST requests
export const apiPost = async (endpoint, data) => {
  return authenticatedFetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export default { authenticatedFetch, apiGet, apiPost };

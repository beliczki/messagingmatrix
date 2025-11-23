/**
 * Clear localStorage and reload the app while preserving authentication data
 * This ensures users stay logged in when clearing matrix data
 */
export const clearAndReloadApp = () => {
  // Preserve all authentication-related data
  const authData = {
    current_user: localStorage.getItem('current_user'),
    app_users: localStorage.getItem('app_users'),
    auth_token: localStorage.getItem('auth_token')
  };

  // Clear all localStorage
  localStorage.clear();

  // Restore authentication data
  Object.entries(authData).forEach(([key, value]) => {
    if (value) localStorage.setItem(key, value);
  });

  // Reload page to fetch fresh data from spreadsheet
  window.location.reload();
};

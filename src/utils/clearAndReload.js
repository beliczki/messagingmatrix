/**
 * Clear sheet data from localStorage and reload the app
 * This clears cached spreadsheet data to force a fresh fetch from Google Sheets
 * while preserving authentication and user preference data (filters, view settings, etc.)
 */
export const clearAndReloadApp = () => {
  // Only clear spreadsheet data keys (messagingmatrix_data_*)
  // This preserves: auth tokens, filter settings, view preferences, etc.
  const keysToRemove = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // Clear sheet data cache keys
    if (key && key.startsWith('messagingmatrix_data_')) {
      keysToRemove.push(key);
    }
  }

  // Remove the collected keys
  keysToRemove.forEach(key => {
    console.log(`🗑️ Clearing cached sheet data: ${key}`);
    localStorage.removeItem(key);
  });

  console.log(`✅ Cleared ${keysToRemove.length} cached sheet data entries`);

  // Reload page to fetch fresh data from spreadsheet
  window.location.reload();
};

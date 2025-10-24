# Debug Google Sheets Sync

This skill helps debug Google Sheets synchronization issues.

## Steps

1. Check localStorage sync status:
   - Read lastSync timestamp from localStorage
   - Check if messageIndex exists
   - Verify data integrity

2. Test Google Sheets authentication:
   - Call `/api/config` to verify backend is running
   - Check service account token status
   - Verify spreadsheet ID in config.json

3. Test sync operations:
   - Try loading data from sheets
   - Check for API errors
   - Verify data format

4. Common issues to check:
   - Service account key file exists at path in .env
   - Spreadsheet is shared with service account email
   - Token cache expiration
   - Network connectivity
   - CORS configuration

5. Report findings and suggest fixes

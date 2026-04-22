// Server-side single-row Google Sheets helpers for the MCP server.
//
// The frontend `src/services/sheets.js` does full-table rewrites (clear + write).
// MCP writes must be surgical — one row at a time — so concurrent UI edits
// don't clobber MCP changes. Those helpers live here.
//
// `getAccessToken` is passed in from server.js so we reuse its cached Google
// OAuth2 token, rather than maintaining a second auth cache.

const SHEETS_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

export async function readAll(getAccessToken, spreadsheetId, sheetName) {
  const token = await getAccessToken();
  const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets read failed for "${sheetName}" (${response.status}): ${text}`);
  }
  const data = await response.json();
  return data.values || [];
}

export function createColumnMap(headerRow) {
  const map = {};
  (headerRow || []).forEach((header, index) => {
    if (header != null && header !== '') map[String(header).trim()] = index;
  });
  return map;
}

export function rowToObject(row, columnMap) {
  const out = {};
  for (const [name, idx] of Object.entries(columnMap)) {
    out[name] = row[idx] !== undefined ? row[idx] : '';
  }
  return out;
}

export function objectToRow(obj, headerRow) {
  return headerRow.map(col => {
    if (obj[col] === undefined || obj[col] === null) return '';
    return typeof obj[col] === 'object' ? JSON.stringify(obj[col]) : String(obj[col]);
  });
}

// Find the index (0-based, including header) of the first row where `predicate(row, obj)` is true.
// Returns { index, row, object } or null.
export async function findRow(getAccessToken, spreadsheetId, sheetName, predicate) {
  const rows = await readAll(getAccessToken, spreadsheetId, sheetName);
  if (rows.length < 2) return null;
  const header = rows[0];
  const cmap = createColumnMap(header);
  for (let i = 1; i < rows.length; i++) {
    const obj = rowToObject(rows[i], cmap);
    if (predicate(rows[i], obj)) {
      return { index: i, row: rows[i], object: obj, header, columnMap: cmap };
    }
  }
  return null;
}

// Append a single row at the bottom of the sheet. `rowObject` keys are matched
// against the sheet's header row; missing columns → empty strings.
export async function appendRow(getAccessToken, spreadsheetId, sheetName, rowObject) {
  const token = await getAccessToken();
  const rows = await readAll(getAccessToken, spreadsheetId, sheetName);
  if (rows.length === 0) {
    throw new Error(`Sheet "${sheetName}" has no header row — cannot append`);
  }
  const header = rows[0];
  const values = [objectToRow(rowObject, header)];

  const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ range: sheetName, values }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets append failed for "${sheetName}" (${response.status}): ${text}`);
  }
  return { row: rows.length + 1, values: values[0] };
}

// Update a single row (1-based index matching Sheets UI) with a new set of values.
// `rowObject` is merged into the existing row — fields not present keep their old value.
export async function updateRow(getAccessToken, spreadsheetId, sheetName, rowIndex1Based, rowObject, header, existingRow) {
  const token = await getAccessToken();
  const merged = { ...rowToObject(existingRow, createColumnMap(header)), ...rowObject };
  const newRow = objectToRow(merged, header);

  const endCol = columnLetter(header.length);
  const range = `${sheetName}!A${rowIndex1Based}:${endCol}${rowIndex1Based}`;

  const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ range, values: [newRow] }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets update failed for "${sheetName}" row ${rowIndex1Based} (${response.status}): ${text}`);
  }
  return { row: rowIndex1Based, values: newRow };
}

// Delete a row. Requires the numeric sheet id, which we look up via spreadsheet metadata.
export async function deleteRow(getAccessToken, spreadsheetId, sheetName, rowIndex0Based) {
  const token = await getAccessToken();

  const metaResponse = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!metaResponse.ok) {
    throw new Error(`Failed to read spreadsheet metadata (${metaResponse.status}): ${await metaResponse.text()}`);
  }
  const meta = await metaResponse.json();
  const sheet = (meta.sheets || []).find(s => s.properties?.title === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found in spreadsheet`);
  const sheetId = sheet.properties.sheetId;

  const response = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex0Based,
            endIndex: rowIndex0Based + 1,
          },
        },
      }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Sheets deleteRow failed (${response.status}): ${await response.text()}`);
  }
  return { deletedRow: rowIndex0Based };
}

// Convert 1-based column index to Sheets letter notation: 1 → A, 27 → AA.
export function columnLetter(n) {
  let s = '';
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

import { getAccessToken } from './auth.js';
import { findOrCreateFolder, findFileInFolder, moveFileToFolder } from './drive-api.js';

const API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const SPREADSHEET_ID_KEY = 'vocab-builder-spreadsheet-id';
const APP_FOLDER_NAME = 'VocabBuilderAPP';
const SPREADSHEET_NAME = 'Vocab Builder Data';
const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet';

const WORDS_SHEET = 'Words';
const CATEGORIES_SHEET = 'Categories';
const SESSIONS_SHEET = 'Sessions';

const WORDS_HEADER = [
  'Word', 'Translation', 'Definition', 'Example', 'PartOfSpeech', 'Category',
  'Learned', 'TimesReviewed', 'CorrectStreak', 'LastReviewed', 'DateAdded', 'Tags',
];
const CATEGORIES_HEADER = ['Name'];
const SESSIONS_HEADER = ['Date', 'Total', 'Correct', 'OnlyDue', 'Category', 'Tag', 'Timestamp'];

let spreadsheetId = localStorage.getItem(SPREADSHEET_ID_KEY);
let sheetIds = null; // { Words: <numeric id>, Categories: <numeric id> }

async function apiFetch(pathAndQuery, options = {}) {
  const token = await getAccessToken();
  const url = pathAndQuery ? `${API_BASE}/${pathAndQuery}` : API_BASE;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets error (${res.status}): ${body}`);
  }
  return res.status === 204 || res.status === 200 && res.headers.get('content-length') === '0'
    ? null
    : res.json();
}

async function findOrCreateSpreadsheet() {
  const folderId = await findOrCreateFolder(APP_FOLDER_NAME);

  const existingId = await findFileInFolder(folderId, SPREADSHEET_NAME, SPREADSHEET_MIME);
  if (existingId) {
    spreadsheetId = existingId;
    localStorage.setItem(SPREADSHEET_ID_KEY, spreadsheetId);
    await loadSheetIds();
    return spreadsheetId;
  }

  const created = await apiFetch('', {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: SPREADSHEET_NAME },
      sheets: [
        { properties: { title: WORDS_SHEET } },
        { properties: { title: CATEGORIES_SHEET } },
        { properties: { title: SESSIONS_SHEET } },
      ],
    }),
  });

  await moveFileToFolder(created.spreadsheetId, folderId);

  spreadsheetId = created.spreadsheetId;
  localStorage.setItem(SPREADSHEET_ID_KEY, spreadsheetId);
  sheetIds = {};
  for (const sheet of created.sheets) {
    sheetIds[sheet.properties.title] = sheet.properties.sheetId;
  }

  await apiFetch(`${spreadsheetId}/values/${WORDS_SHEET}!A1:L1?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [WORDS_HEADER] }),
  });
  await apiFetch(`${spreadsheetId}/values/${CATEGORIES_SHEET}!A1:A1?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [CATEGORIES_HEADER] }),
  });
  await apiFetch(`${spreadsheetId}/values/${SESSIONS_SHEET}!A1:G1?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [SESSIONS_HEADER] }),
  });

  return spreadsheetId;
}

async function loadSheetIds() {
  if (sheetIds) return sheetIds;
  const meta = await apiFetch(`${spreadsheetId}?fields=sheets.properties`);
  sheetIds = {};
  for (const sheet of meta.sheets) {
    sheetIds[sheet.properties.title] = sheet.properties.sheetId;
  }
  return sheetIds;
}

/**
 * Adds the Categories tab to spreadsheets created before this feature
 * existed.
 */
async function ensureCategoriesSheet() {
  if (sheetIds[CATEGORIES_SHEET] !== undefined) return;

  const result = await apiFetch(`${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: CATEGORIES_SHEET } } }] }),
  });
  sheetIds[CATEGORIES_SHEET] = result.replies[0].addSheet.properties.sheetId;

  await apiFetch(`${spreadsheetId}/values/${CATEGORIES_SHEET}!A1:A1?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [CATEGORIES_HEADER] }),
  });
}

/**
 * Adds the Sessions tab to spreadsheets created before this feature existed.
 */
async function ensureSessionsSheet() {
  if (sheetIds[SESSIONS_SHEET] !== undefined) return;

  const result = await apiFetch(`${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SESSIONS_SHEET } } }] }),
  });
  sheetIds[SESSIONS_SHEET] = result.replies[0].addSheet.properties.sheetId;

  await apiFetch(`${spreadsheetId}/values/${SESSIONS_SHEET}!A1:G1?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [SESSIONS_HEADER] }),
  });
}

let wordsTagsHeaderEnsured = false;

/**
 * Rewrites the Words tab's header row for spreadsheets created before the
 * Tags column existed. That column is always appended (never inserted) when
 * writing rows, so existing cells are never shifted — this just backfills
 * the header label once per session.
 */
async function ensureWordsTagsHeader() {
  if (wordsTagsHeaderEnsured) return;
  wordsTagsHeaderEnsured = true;
  await apiFetch(`${spreadsheetId}/values/${WORDS_SHEET}!A1:L1?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [WORDS_HEADER] }),
  });
}

export async function ensureSpreadsheet() {
  if (spreadsheetId) {
    await loadSheetIds();
  } else {
    await findOrCreateSpreadsheet();
  }
  await ensureCategoriesSheet();
  await ensureSessionsSheet();
  await ensureWordsTagsHeader();
  return spreadsheetId;
}

export async function fetchWords() {
  const id = await ensureSpreadsheet();
  const result = await apiFetch(`${id}/values/${WORDS_SHEET}!A2:L?valueRenderOption=UNFORMATTED_VALUE`);
  return (result.values || [])
    .map((row, i) => {
      const [
        word, translation, definition, example, partOfSpeech, category,
        learned, timesReviewed, correctStreak, lastReviewed, dateAdded, tags,
      ] = row;
      return {
        word,
        translation,
        definition: definition || '',
        example: example || '',
        partOfSpeech: partOfSpeech || '',
        category: category || '',
        learned: learned === true || learned === 'TRUE',
        timesReviewed: parseFloat(timesReviewed) || 0,
        correctStreak: parseFloat(correctStreak) || 0,
        lastReviewed: lastReviewed || '',
        dateAdded: dateAdded || '',
        tags: tags ? String(tags).split(',').map((t) => t.trim()).filter(Boolean) : [],
        _row: i + 2,
      };
    })
    .filter((w) => w.word);
}

function wordToRow(w) {
  return [
    w.word, w.translation, w.definition ?? '', w.example ?? '', w.partOfSpeech ?? '', w.category ?? '',
    w.learned ? 'TRUE' : 'FALSE', w.timesReviewed ?? 0, w.correctStreak ?? 0, w.lastReviewed ?? '', w.dateAdded ?? '',
    Array.isArray(w.tags) ? w.tags.join(',') : '',
  ];
}

export async function appendWordRow(word) {
  const id = await ensureSpreadsheet();
  await apiFetch(`${id}/values/${WORDS_SHEET}:append?valueInputOption=RAW`, {
    method: 'POST',
    body: JSON.stringify({ values: [wordToRow(word)] }),
  });
}

/** Appends many words in a single API call — used by bulk import so an N-word batch costs 1 request, not N. */
export async function appendWordRows(words) {
  if (words.length === 0) return;
  const id = await ensureSpreadsheet();
  await apiFetch(`${id}/values/${WORDS_SHEET}:append?valueInputOption=RAW`, {
    method: 'POST',
    body: JSON.stringify({ values: words.map(wordToRow) }),
  });
}

export async function putWordRow(row, word) {
  const id = await ensureSpreadsheet();
  await apiFetch(`${id}/values/${WORDS_SHEET}!A${row}:L${row}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [wordToRow(word)] }),
  });
}

/**
 * Rewrites many (possibly non-adjacent) Words rows in a single API call —
 * used when a change (e.g. removing a tag) touches every word that uses it.
 * updates: [{ row, word }, ...]
 */
export async function putWordRows(updates) {
  if (updates.length === 0) return;
  const id = await ensureSpreadsheet();
  await apiFetch(`${id}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: updates.map(({ row, word }) => ({
        range: `${WORDS_SHEET}!A${row}:L${row}`,
        values: [wordToRow(word)],
      })),
    }),
  });
}

export async function fetchCategories() {
  const id = await ensureSpreadsheet();
  const result = await apiFetch(`${id}/values/${CATEGORIES_SHEET}!A2:A?valueRenderOption=UNFORMATTED_VALUE`);
  return (result.values || [])
    .map((row, i) => ({ name: row[0], _row: i + 2 }))
    .filter((c) => c.name);
}

export async function appendCategoryRow(name) {
  const id = await ensureSpreadsheet();
  await apiFetch(`${id}/values/${CATEGORIES_SHEET}:append?valueInputOption=RAW`, {
    method: 'POST',
    body: JSON.stringify({ values: [[name]] }),
  });
}

export async function fetchSessions() {
  const id = await ensureSpreadsheet();
  const result = await apiFetch(`${id}/values/${SESSIONS_SHEET}!A2:G?valueRenderOption=UNFORMATTED_VALUE`);
  return (result.values || [])
    .map((row) => {
      const [date, total, correct, onlyDue, category, tag, timestamp] = row;
      return {
        date: date || '',
        total: parseFloat(total) || 0,
        correct: parseFloat(correct) || 0,
        onlyDue: onlyDue === true || onlyDue === 'TRUE',
        category: category || '',
        tag: tag || '',
        timestamp: timestamp || '',
      };
    })
    .filter((s) => s.date);
}

export async function appendSessionRow(session) {
  const id = await ensureSpreadsheet();
  await apiFetch(`${id}/values/${SESSIONS_SHEET}:append?valueInputOption=RAW`, {
    method: 'POST',
    body: JSON.stringify({
      values: [[
        session.date, session.total, session.correct,
        session.onlyDue ? 'TRUE' : 'FALSE', session.category ?? '', session.tag ?? '',
        session.timestamp,
      ]],
    }),
  });
}

/**
 * Deletes rows (1-based) from the given tab in one batch. Descending order
 * within a sheet is required so earlier deletes don't shift indices out
 * from under later ones in the same request.
 */
export async function deleteRows(sheetName, rows) {
  if (rows.length === 0) return;
  const id = await ensureSpreadsheet();
  const ids = await loadSheetIds();
  const sheetId = ids[sheetName];
  const sorted = [...rows].sort((a, b) => b - a);

  await apiFetch(`${id}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: sorted.map((row) => ({
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row },
        },
      })),
    }),
  });
}

export async function clearAndWrite(sheetName, headerColumns, rows) {
  const id = await ensureSpreadsheet();
  const lastCol = String.fromCharCode('A'.charCodeAt(0) + headerColumns - 1);
  await apiFetch(`${id}/values/${sheetName}!A2:${lastCol}:clear`, { method: 'POST', body: '{}' });
  if (rows.length > 0) {
    await apiFetch(`${id}/values/${sheetName}!A2?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values: rows }),
    });
  }
}

export async function getSheetGid(sheetName) {
  await ensureSpreadsheet();
  return sheetIds[sheetName];
}

export const SHEET_NAMES = {
  WORDS: WORDS_SHEET,
  CATEGORIES: CATEGORIES_SHEET,
  SESSIONS: SESSIONS_SHEET,
};

export const WORDS_HEADER_COLUMNS = WORDS_HEADER.length;

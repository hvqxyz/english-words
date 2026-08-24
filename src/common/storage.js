import {
  fetchWords,
  appendWordRow,
  appendWordRows,
  putWordRow,
  fetchCategories,
  appendCategoryRow,
  deleteRows,
  clearAndWrite,
  ensureSpreadsheet,
  getSheetGid,
  SHEET_NAMES,
  WORDS_HEADER_COLUMNS,
} from './sheets-api.js';

export { SHEET_NAMES };

const CURRENT_VERSION = 1;

export const PARTS_OF_SPEECH = [
  'noun', 'verb', 'adjective', 'adverb', 'phrase', 'idiom', 'preposition', 'other',
];

/**
 * A word is "known" once its correct-answer streak reaches this many
 * practice sessions in a row.
 */
export const LEARNED_STREAK_THRESHOLD = 5;

/**
 * Spaced-repetition schedule: days to wait before a word comes up again in
 * "Due only" practice, indexed by its current correct streak (index 6+
 * reuses the last value). A fresh/never-reviewed word (streak 0) is always
 * due immediately.
 */
const REVIEW_INTERVAL_DAYS = [0, 1, 2, 4, 7, 14, 30];

export function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shiftDateKey(dateKey, deltaDays) {
  const d = new Date(dateKey + 'T00:00:00');
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dateRangeInclusive(startKey, endKey) {
  const dates = [];
  const cur = new Date(startKey + 'T00:00:00');
  const end = new Date(endKey + 'T00:00:00');
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function daysBetween(fromKey, toKey) {
  const from = new Date(fromKey + 'T00:00:00');
  const to = new Date(toKey + 'T00:00:00');
  return Math.round((to - from) / 86400000);
}

const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * A read-through cache for a Sheets fetch that rarely changes: repeated
 * reads within CACHE_TTL_MS reuse the last result instead of re-fetching,
 * and callers that write the underlying sheet call .invalidate() so the
 * next .get() is immediately fresh rather than waiting out the TTL.
 */
function createTtlCache(fetchFn) {
  let cache = null; // { data, timestamp }
  return {
    async get() {
      if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) return cache.data;
      const data = await fetchFn();
      cache = { data, timestamp: Date.now() };
      return data;
    },
    invalidate() {
      cache = null;
    },
  };
}

const wordsCache = createTtlCache(fetchWords);
const categoriesCache = createTtlCache(fetchCategories);

export async function getWords() {
  return wordsCache.get();
}

export async function getCategories() {
  return categoriesCache.get();
}

export async function getSpreadsheetUrl(sheetName) {
  const id = await ensureSpreadsheet();
  const base = `https://docs.google.com/spreadsheets/d/${id}/edit`;
  if (!sheetName) return base;
  const gid = await getSheetGid(sheetName);
  return gid !== undefined ? `${base}#gid=${gid}` : base;
}

/**
 * entry: { word, translation, definition, example, partOfSpeech, category, tags }
 */
export async function addWord(entry) {
  const { word, translation, definition, example, partOfSpeech, category, tags } = entry;
  await appendWordRow({
    word, translation, definition, example, partOfSpeech, category,
    tags: tags || [],
    learned: false,
    timesReviewed: 0,
    correctStreak: 0,
    lastReviewed: '',
    dateAdded: todayKey(),
  });
  wordsCache.invalidate();
}

/**
 * Adds many words in a single Sheets API request (see appendWordRows) — used
 * by bulk import so a batch of N words costs 1 request instead of N.
 * entries: [{ word, translation, definition, example, partOfSpeech, category, tags }, ...]
 */
export async function addWords(entries) {
  const today = todayKey();
  await appendWordRows(entries.map(({ word, translation, definition, example, partOfSpeech, category, tags }) => ({
    word, translation, definition, example, partOfSpeech, category,
    tags: tags || [],
    learned: false,
    timesReviewed: 0,
    correctStreak: 0,
    lastReviewed: '',
    dateAdded: today,
  })));
  wordsCache.invalidate();
}

export async function updateWord(word, patch) {
  await putWordRow(word._row, { ...word, ...patch });
  wordsCache.invalidate();
}

export async function deleteWord(row) {
  await deleteRows(SHEET_NAMES.WORDS, [row]);
  wordsCache.invalidate();
}

export async function addCategory(name) {
  await appendCategoryRow(name);
  categoriesCache.invalidate();
}

export async function deleteCategory(row) {
  await deleteRows(SHEET_NAMES.CATEGORIES, [row]);
  categoriesCache.invalidate();
}

/**
 * Days until a word is due again in "Due only" practice, based on its
 * current correct-answer streak — see REVIEW_INTERVAL_DAYS.
 */
export function reviewIntervalDays(correctStreak) {
  const index = Math.min(Math.max(correctStreak, 0), REVIEW_INTERVAL_DAYS.length - 1);
  return REVIEW_INTERVAL_DAYS[index];
}

/** A never-reviewed word is always due; otherwise due once its interval has elapsed. */
export function isDue(word, today = todayKey()) {
  if (!word.lastReviewed) return true;
  return daysBetween(word.lastReviewed, today) >= reviewIntervalDays(word.correctStreak);
}

export function dueWords(words, today = todayKey()) {
  return words.filter((w) => isDue(w, today));
}

function shuffled(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Builds a shuffled practice session from `words`: only words due for review
 * when `onlyDue` is true, otherwise every word. `limit` (falsy = no cap)
 * trims the session to that many cards.
 */
export function buildPracticeQueue(words, { onlyDue = true, limit = 0 } = {}) {
  const pool = onlyDue ? dueWords(words) : words;
  const queue = shuffled(pool);
  return limit ? queue.slice(0, limit) : queue;
}

/**
 * Applies one practice answer to a word: a correct answer advances the
 * streak (and marks the word "learned" once it crosses
 * LEARNED_STREAK_THRESHOLD); an incorrect answer resets the streak and
 * un-marks "learned". Persists the result and invalidates the words cache.
 */
export async function recordReview(word, correct) {
  const correctStreak = correct ? word.correctStreak + 1 : 0;
  const patch = {
    timesReviewed: word.timesReviewed + 1,
    correctStreak,
    lastReviewed: todayKey(),
    learned: correctStreak >= LEARNED_STREAK_THRESHOLD,
  };
  await updateWord(word, patch);
  return { ...word, ...patch };
}

/** Top-line counts for the Stats page. */
export function summarizeWords(words, today = todayKey()) {
  const total = words.length;
  const learned = words.filter((w) => w.learned).length;
  const due = dueWords(words, today).length;
  const categories = new Set(words.map((w) => w.category).filter(Boolean)).size;
  return { total, learned, due, categories };
}

const UNCATEGORIZED_LABEL = 'Uncategorized';

/** Word counts per category (including an "Uncategorized" bucket), most-used first. */
export function categoryBreakdown(words) {
  const counts = new Map();
  words.forEach((w) => {
    const key = w.category || UNCATEGORIZED_LABEL;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

/** Every distinct tag currently used across `words`, alphabetically — for tag-input suggestions. */
export function getAllTags(words) {
  const set = new Set();
  words.forEach((w) => (w.tags || []).forEach((t) => set.add(t)));
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Cumulative word-count points from the first added word through today (or
 * the last-added date, if later), one point per day — for a growth-over-time
 * line chart. Returns [] when there are no words yet.
 */
export function wordsAddedOverTimePoints(words) {
  const dated = words.filter((w) => w.dateAdded).map((w) => w.dateAdded).sort();
  if (dated.length === 0) return [];
  const today = todayKey();
  const endKey = dated[dated.length - 1] > today ? dated[dated.length - 1] : today;
  const dates = dateRangeInclusive(dated[0], endKey);
  const countsByDate = {};
  dated.forEach((d) => {
    countsByDate[d] = (countsByDate[d] || 0) + 1;
  });
  let running = 0;
  return dates.map((date) => {
    running += countsByDate[date] || 0;
    return { x: date, y: running };
  });
}

export async function exportToFile() {
  const [words, categories] = await Promise.all([fetchWords(), fetchCategories()]);
  const clean = {
    words: words.map(({ _row, ...w }) => w),
    categories: categories.map((c) => c.name),
  };

  const blob = new Blob([JSON.stringify({ version: CURRENT_VERSION, ...clean })], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vocab-builder-export-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

export function validateImportedData(parsed) {
  if (!parsed || typeof parsed !== 'object') return 'File does not contain a valid JSON object.';
  if (!Array.isArray(parsed.words)) return 'Missing "words" array.';
  if (parsed.categories !== undefined && !Array.isArray(parsed.categories)) return 'Invalid "categories" array.';

  for (const w of parsed.words) {
    if (!w || typeof w !== 'object') return 'Invalid word entry.';
    if (typeof w.word !== 'string' || !w.word.trim()) return 'Every word needs a "word" value.';
    if (typeof w.translation !== 'string' || !w.translation.trim()) return `Missing translation for "${w.word}".`;
    for (const field of ['definition', 'example', 'partOfSpeech', 'category', 'lastReviewed', 'dateAdded']) {
      if (w[field] !== undefined && typeof w[field] !== 'string') return `Invalid ${field} for "${w.word}".`;
    }
    if (w.timesReviewed !== undefined && (!isFiniteNumber(w.timesReviewed) || w.timesReviewed < 0)) {
      return `Invalid timesReviewed for "${w.word}".`;
    }
    if (w.correctStreak !== undefined && (!isFiniteNumber(w.correctStreak) || w.correctStreak < 0)) {
      return `Invalid correctStreak for "${w.word}".`;
    }
    if (w.tags !== undefined && (!Array.isArray(w.tags) || w.tags.some((t) => typeof t !== 'string'))) {
      return `Invalid tags for "${w.word}".`;
    }
  }

  if (parsed.categories) {
    for (const c of parsed.categories) {
      if (typeof c !== 'string' || !c.trim()) return 'Invalid category name.';
    }
  }

  return null;
}

export function parseImportFile(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('File is not valid JSON.');
  }

  const error = validateImportedData(parsed);
  if (error) throw new Error(error);

  return {
    version: CURRENT_VERSION,
    words: parsed.words,
    categories: parsed.categories || [],
  };
}

/**
 * Replaces all rows in both tabs with the imported words/categories.
 */
export async function applyImportedData(data) {
  const wordRows = data.words.map((w) => [
    w.word,
    w.translation,
    w.definition ?? '',
    w.example ?? '',
    w.partOfSpeech ?? '',
    w.category ?? '',
    w.learned ? 'TRUE' : 'FALSE',
    w.timesReviewed ?? 0,
    w.correctStreak ?? 0,
    w.lastReviewed ?? '',
    w.dateAdded ?? todayKey(),
    Array.isArray(w.tags) ? w.tags.join(',') : '',
  ]);
  const categoryRows = data.categories.map((name) => [name]);

  await clearAndWrite(SHEET_NAMES.WORDS, WORDS_HEADER_COLUMNS, wordRows);
  await clearAndWrite(SHEET_NAMES.CATEGORIES, 1, categoryRows);
  wordsCache.invalidate();
  categoriesCache.invalidate();
}

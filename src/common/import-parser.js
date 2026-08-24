/**
 * Parses loosely-formatted vocab notes pasted from other resources (Markdown
 * exports, personal notes, etc.) into word/translation candidates for
 * WordsPage's import flow. Nothing here writes to the sheet — parseImportText
 * only extracts structured guesses; the caller decides what to keep.
 *
 * Recognized line shapes (bullet markers and Markdown **bold** are stripped
 * throughout):
 *   term - translation
 *   term = translation
 *   term: translation
 *   term (translation) - explanatory note      → note becomes the definition
 *   term = translation (note)                  → note becomes the definition
 */

const BULLET_RE = /^(?:[-*•]|\d+[.)])\s+/;
const SEPARATOR_RE = /\s[-–—=:]\s/;

function stripBold(text) {
  return text.replace(/\*\*/g, '').trim();
}

function splitTrailingParenthetical(text) {
  const match = text.match(/^(.*\S)\s*\(([^()]*)\)\s*\.?\s*$/);
  if (!match) return { main: text.trim(), note: '' };
  return { main: match[1].trim(), note: match[2].trim() };
}

/**
 * `**Term (translation) -** rest of the line` — the bold span covers the
 * term, its parenthetical translation, and the dash; everything after is a
 * plain-text explanatory note.
 */
function matchBoldTermWithParenTranslation(line) {
  const m = line.match(/^\*\*([^*(]+?)\s*\(([^)]+)\)\s*-\*\*\s*(.*)$/);
  if (!m) return null;
  return { word: m[1].trim(), translation: m[2].trim(), note: stripBold(m[3]) };
}

/** `**Term** = **translation** (optional note)` */
function matchBoldTermEqualsBoldTranslation(line) {
  const m = line.match(/^\*\*([^*]+)\*\*\s*=\s*\*\*([^*]+)\*\*\s*(?:\(([^)]*)\)\s*\.?)?\s*$/);
  if (!m) return null;
  return { word: m[1].trim(), translation: m[2].trim(), note: m[3] ? stripBold(m[3]) : '' };
}

function parseLine(rawLine) {
  const line = rawLine.replace(BULLET_RE, '').trim();
  if (!line) return null;

  const special = matchBoldTermWithParenTranslation(line) || matchBoldTermEqualsBoldTranslation(line);
  if (special) {
    return finalize(rawLine, special.word, special.translation, special.note);
  }

  const plain = stripBold(line);
  const sepMatch = plain.match(SEPARATOR_RE);
  if (!sepMatch) {
    return { raw: rawLine, word: plain, translation: '', definition: '', status: 'invalid', reason: 'No separator (-, =, :) found' };
  }

  const left = plain.slice(0, sepMatch.index).trim();
  const right = plain.slice(sepMatch.index + sepMatch[0].length).trim();
  const { main, note } = splitTrailingParenthetical(right);
  return finalize(rawLine, left, main, note);
}

function finalize(rawLine, word, translation, note) {
  const cleanWord = word.replace(/[:\-–—]\s*$/, '').trim();
  const cleanTranslation = translation.replace(/\.$/, '').trim();

  if (!cleanWord || !cleanTranslation) {
    return {
      raw: rawLine,
      word: cleanWord,
      translation: cleanTranslation,
      definition: note || '',
      status: 'invalid',
      reason: !cleanWord ? 'Missing the English word' : 'No translation found',
    };
  }

  return {
    raw: rawLine,
    word: cleanWord,
    translation: cleanTranslation,
    definition: note || '',
    status: 'valid',
    reason: '',
  };
}

/**
 * Parses every non-blank line of `text` independently. Returns one entry per
 * line (blank lines are dropped), each tagged `status: 'valid' | 'invalid'`
 * and, for invalid ones, a human-readable `reason`. Doesn't check against
 * existing words — see markDuplicates for that.
 */
export function parseImportText(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseLine);
}

/**
 * Flags rows whose word already exists (case-insensitive) — either already
 * in `existingWords` (the current sheet) or earlier in this same batch — by
 * overwriting their status to 'duplicate'. Mutates nothing; returns a new
 * array.
 */
export function markDuplicates(rows, existingWords) {
  const existingLower = new Set(existingWords.map((w) => w.word.trim().toLowerCase()));
  const seenInBatch = new Set();

  return rows.map((row) => {
    if (row.status !== 'valid') return row;
    const key = row.word.toLowerCase();
    if (existingLower.has(key)) {
      return { ...row, status: 'duplicate', reason: 'Already in your word list' };
    }
    if (seenInBatch.has(key)) {
      return { ...row, status: 'duplicate', reason: 'Repeated earlier in this paste' };
    }
    seenInBatch.add(key);
    return row;
  });
}

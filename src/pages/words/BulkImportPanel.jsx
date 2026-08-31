import { useRef, useState } from 'react';
import { Languages } from 'lucide-react';
import { getWords, addWords } from '../../common/storage.js';
import { parseImportText, markDuplicates } from '../../common/import-parser.js';
import { translateWord } from '../../common/translate.js';
import { Button } from '../../components/buttons/Button.jsx';
import { TextArea } from '../../components/inputs/TextArea.jsx';
import { Select } from '../../components/inputs/Select.jsx';
import { TagInput } from '../../components/inputs/TagInput.jsx';

const PLACEHOLDER = `Paste vocab notes copied from anywhere, one per line, e.g.:

math equation - równanie matematyczne
Bonds - obligacje
asset - aktywo
**Liabilities** = **zobowiązania** (czasem też pasywa)
**Bondholders (obligatariusze) -** mają zagwarantowane płatności.`;

function statusLabel(status) {
  if (status === 'invalid') return 'Incomplete';
  if (status === 'duplicate') return 'Duplicate';
  return 'Ready';
}

/**
 * Re-derives every row's status/reason from its current word/translation
 * text, given the set of words already on the sheet. Called after every
 * edit so fixing a missing translation (or an accidental duplicate word)
 * immediately flips a row from invalid/duplicate to valid, and vice versa.
 * `include` is only auto-adjusted on those transitions — everywhere else the
 * user's own checkbox choice is left alone.
 */
function recomputeStatuses(rows, existingWords) {
  const existingLower = new Set(existingWords.map((w) => w.word.trim().toLowerCase()));
  const seen = new Set();

  return rows.map((row) => {
    const word = row.word.trim();
    const translation = row.translation.trim();

    let status;
    let reason;
    if (!word || !translation) {
      status = 'invalid';
      reason = !word ? 'Missing the English word' : 'No translation yet';
    } else {
      const key = word.toLowerCase();
      if (existingLower.has(key)) {
        status = 'duplicate';
        reason = 'Already in your word list';
      } else if (seen.has(key)) {
        status = 'duplicate';
        reason = 'Repeated earlier in this paste';
      } else {
        seen.add(key);
        status = 'valid';
        reason = '';
      }
    }

    let include = row.include;
    if (status === 'invalid') include = false;
    else if (status === 'valid' && row.status === 'invalid') include = true;

    return { ...row, word, translation, status, reason, include };
  });
}

/**
 * Inline "bulk import" panel (no modal) — mounted only while active, so its
 * state naturally resets each time it's opened. A range-toggle at the top,
 * always visible (except on the final confirmation screen), switches between
 * two ways in: paste freeform text to be parsed, or add rows by hand. Both
 * land on the same review table — word, translation, and definition are all
 * editable there, so a line that failed to parse (e.g. no translation found)
 * can be filled in by hand instead of being skipped, and manually-added rows
 * are just blank ones filled in from scratch.
 */
export function BulkImportPanel({ categories, allTags, onClose, onSaved }) {
  const [step, setStep] = useState('input');
  const [mode, setMode] = useState('text'); // 'text' | 'manual'
  const [rawText, setRawText] = useState('');
  const [defaultCategory, setDefaultCategory] = useState('');
  const [defaultTags, setDefaultTags] = useState([]);
  const [rows, setRows] = useState([]);
  const [existingWords, setExistingWords] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [translatingIds, setTranslatingIds] = useState(() => new Set());
  const nextRowId = useRef(0);

  function blankRow() {
    return {
      id: nextRowId.current++,
      raw: '',
      word: '',
      translation: '',
      definition: '',
      example: '',
      include: false,
      category: defaultCategory,
      tags: defaultTags,
      status: 'invalid',
      reason: 'Missing the English word',
    };
  }

  async function handleParse() {
    setParsing(true);
    setMessage({ text: '', type: '' });
    try {
      const existing = await getWords();
      setExistingWords(existing);
      const parsed = markDuplicates(parseImportText(rawText), existing);
      nextRowId.current = parsed.length;
      setRows(parsed.map((row, i) => ({
        ...row,
        id: i,
        include: row.status === 'valid',
        category: defaultCategory,
        tags: defaultTags,
        example: '',
      })));
      setStep('preview');
    } catch (err) {
      setMessage({ text: `Couldn't reach Google Sheets: ${err.message}`, type: 'error' });
    } finally {
      setParsing(false);
    }
  }

  async function handleManualStart() {
    setParsing(true);
    setMessage({ text: '', type: '' });
    try {
      const existing = await getWords();
      setExistingWords(existing);
      nextRowId.current = 0;
      setRows([blankRow()]);
      setMode('manual');
      setStep('preview');
    } catch (err) {
      setMessage({ text: `Couldn't reach Google Sheets: ${err.message}`, type: 'error' });
    } finally {
      setParsing(false);
    }
  }

  function handleSwitchToText() {
    if (mode === 'text') return;
    setMode('text');
    setRows([]);
    setMessage({ text: '', type: '' });
    setStep('input');
  }

  function handleSwitchToManual() {
    if (mode === 'manual') return;
    handleManualStart();
  }

  function addRow() {
    setRows((rs) => [...rs, blankRow()]);
  }

  function removeRow(id) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  function updateRow(id, patch) {
    setRows((rs) => recomputeStatuses(rs.map((r) => (r.id === id ? { ...r, ...patch } : r)), existingWords));
  }

  async function handleTranslate(row) {
    setTranslatingIds((ids) => new Set(ids).add(row.id));
    setMessage({ text: '', type: '' });
    try {
      const translated = await translateWord(row.word);
      updateRow(row.id, { translation: translated });
    } catch (err) {
      setMessage({ text: `Couldn't fetch a translation: ${err.message}`, type: 'error' });
    } finally {
      setTranslatingIds((ids) => {
        const next = new Set(ids);
        next.delete(row.id);
        return next;
      });
    }
  }

  const includedCount = rows.filter((r) => r.include).length;
  const invalidCount = rows.filter((r) => r.status === 'invalid').length;
  const duplicateCount = rows.filter((r) => r.status === 'duplicate').length;

  async function handleImport() {
    const toImport = rows.filter((r) => r.include);
    setImporting(true);
    setMessage({ text: '', type: '' });
    try {
      await addWords(toImport.map((row) => ({
        word: row.word,
        translation: row.translation,
        definition: row.definition || '',
        example: row.example || '',
        partOfSpeech: '',
        category: row.category || '',
        tags: row.tags || [],
      })));
      setResult({ imported: toImport.length, failed: 0 });
      setStep('done');
      await onSaved();
    } catch (err) {
      setMessage({ text: `Couldn't save to Google Sheets: ${err.message}`, type: 'error' });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="add-word-panel">
      {step !== 'done' && (
        <div className="range-toggle">
          <button
            type="button"
            className="button range-btn"
            aria-pressed={mode === 'text'}
            disabled={parsing}
            onClick={handleSwitchToText}
          >
            Import from text
          </button>
          <button
            type="button"
            className="button range-btn"
            aria-pressed={mode === 'manual'}
            disabled={parsing}
            onClick={handleSwitchToManual}
          >
            Add rows manually
          </button>
        </div>
      )}

      {step === 'input' && (
        <>
          <h3>Import words from text</h3>
          <TextArea
            className="import-textarea"
            rows={10}
            placeholder={PLACEHOLDER}
            value={rawText}
            onChange={setRawText}
          />
          <div className="form-field">
            <label htmlFor="import-category-input">Category for all imported words (optional)</label>
            <Select
              id="import-category-input"
              placeholder="No category"
              options={categories.map((c) => c.name)}
              value={defaultCategory}
              onChange={setDefaultCategory}
            />
          </div>
          <div className="form-field">
            <label htmlFor="import-tags-input">Tags for all imported words (optional)</label>
            <TagInput
              id="import-tags-input"
              placeholder="Type a tag and press Enter"
              value={defaultTags}
              onChange={setDefaultTags}
              suggestions={allTags}
            />
          </div>
          {message.text && <p className={`message ${message.type}`.trim()} role="status">{message.text}</p>}
          <div className="app-modal-actions">
            <Button disabled={!rawText.trim() || parsing} onClick={handleParse}>Check words</Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </>
      )}

      {step === 'preview' && (
        <>
          <h3>Review before importing</h3>
          <p className="import-summary">
            <span>{includedCount} ready to import</span>
            {duplicateCount > 0 && <span>{duplicateCount} duplicate{duplicateCount === 1 ? '' : 's'}</span>}
            {invalidCount > 0 && <span>{invalidCount} couldn't be parsed</span>}
          </p>

          {mode === 'manual' && (
            <>
              <div className="form-field">
                <label htmlFor="import-category-input">Category for new rows (optional)</label>
                <Select
                  id="import-category-input"
                  placeholder="No category"
                  options={categories.map((c) => c.name)}
                  value={defaultCategory}
                  onChange={setDefaultCategory}
                />
              </div>
              <div className="form-field">
                <label htmlFor="import-tags-input">Tags for new rows (optional)</label>
                <TagInput
                  id="import-tags-input"
                  placeholder="Type a tag and press Enter"
                  value={defaultTags}
                  onChange={setDefaultTags}
                  suggestions={allTags}
                />
              </div>
            </>
          )}

          <div className="import-rows-wrap">
            {rows.map((row) => (
              <div
                key={row.id}
                className={`import-row-card${row.status === 'invalid' ? ' import-row-invalid' : ''}${row.status === 'duplicate' ? ' import-row-duplicate' : ''}`}
                title={row.raw}
              >
                <div className="import-row-top">
                  <input
                    type="checkbox"
                    checked={row.include}
                    disabled={row.status === 'invalid'}
                    onChange={(e) => updateRow(row.id, { include: e.target.checked })}
                  />
                  {row.status === 'invalid' && <span className="tag-pill tag-pill-muted">{row.reason}</span>}
                  {row.status === 'duplicate' && <span className="tag-pill" title={row.reason}>{statusLabel(row.status)}</span>}
                  {row.status === 'valid' && <span className="tag-pill tag-pill-good">{statusLabel(row.status)}</span>}
                  <Button
                    className="import-row-remove"
                    size="small"
                    variant="secondary"
                    type="button"
                    aria-label="Remove row"
                    title="Remove row"
                    onClick={() => removeRow(row.id)}
                  >
                    ✕
                  </Button>
                </div>
                <div className="import-row-primary">
                  <input
                    className="text-input import-cell-input"
                    placeholder="English word"
                    value={row.word}
                    onChange={(e) => updateRow(row.id, { word: e.target.value })}
                  />
                  <div className="import-translation-cell">
                    <input
                      className="text-input import-cell-input"
                      placeholder="Polish translation"
                      value={row.translation}
                      onChange={(e) => updateRow(row.id, { translation: e.target.value })}
                    />
                    {!row.translation.trim() && (
                      <Button
                        size="small"
                        variant="secondary"
                        type="button"
                        aria-label="Fetch translation"
                        title="Fetch translation from MyMemory"
                        disabled={!row.word.trim() || translatingIds.has(row.id)}
                        onClick={() => handleTranslate(row)}
                      >
                        <Languages size={14} />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="import-row-secondary">
                  <input
                    className="text-input import-cell-input"
                    placeholder="Definition (optional)"
                    value={row.definition}
                    onChange={(e) => updateRow(row.id, { definition: e.target.value })}
                  />
                  <input
                    className="text-input import-cell-input"
                    placeholder="Example (optional)"
                    value={row.example}
                    onChange={(e) => updateRow(row.id, { example: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>

          {message.text && <p className={`message ${message.type}`.trim()} role="status">{message.text}</p>}
          {importing && <p className="message" role="status">Importing {includedCount} word{includedCount === 1 ? '' : 's'}…</p>}

          <div className="app-modal-actions">
            <Button type="button" variant="secondary" disabled={importing} onClick={addRow}>+ Add row</Button>
            <Button disabled={includedCount === 0 || importing} onClick={handleImport}>
              Import {includedCount} word{includedCount === 1 ? '' : 's'}
            </Button>
            {mode === 'text' && (
              <Button type="button" variant="secondary" disabled={importing} onClick={() => setStep('input')}>
                Back
              </Button>
            )}
            {mode === 'manual' && (
              <Button type="button" variant="secondary" disabled={importing || parsing} onClick={handleManualStart}>
                Start over
              </Button>
            )}
          </div>
        </>
      )}

      {step === 'done' && result && (
        <>
          <h3>Import complete</h3>
          <p className="message success" role="status">
            Imported {result.imported} word{result.imported === 1 ? '' : 's'}.
            {result.failed > 0 && ` ${result.failed} failed to save — try again from the Words list.`}
          </p>
          <div className="app-modal-actions">
            <Button onClick={onClose}>Done</Button>
          </div>
        </>
      )}
    </div>
  );
}

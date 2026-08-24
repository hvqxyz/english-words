import { useState } from 'react';
import { getWords, addWords } from '../../common/storage.js';
import { parseImportText, markDuplicates } from '../../common/import-parser.js';
import { Modal } from '../../components/Modal.jsx';
import { Button } from '../../components/buttons/Button.jsx';
import { TextArea } from '../../components/inputs/TextArea.jsx';
import { Select } from '../../components/inputs/Select.jsx';

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
 * Paste-and-validate bulk import: step 1 takes freeform pasted text, step 2
 * shows what was parsed out of it — word, translation, and definition are
 * all editable there, so a line that failed to parse (e.g. no translation
 * found) can be filled in by hand instead of being skipped.
 */
export function ImportWordsModal({ open, categories, onClose, onSaved }) {
  const [step, setStep] = useState('paste');
  const [rawText, setRawText] = useState('');
  const [defaultCategory, setDefaultCategory] = useState('');
  const [rows, setRows] = useState([]);
  const [existingWords, setExistingWords] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  function reset() {
    setStep('paste');
    setRawText('');
    setRows([]);
    setExistingWords([]);
    setResult(null);
    setMessage({ text: '', type: '' });
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleParse() {
    setParsing(true);
    setMessage({ text: '', type: '' });
    try {
      const existing = await getWords();
      setExistingWords(existing);
      const parsed = markDuplicates(parseImportText(rawText), existing);
      setRows(parsed.map((row, i) => ({
        ...row,
        id: i,
        include: row.status === 'valid',
        category: defaultCategory,
        example: '',
      })));
      setStep('preview');
    } catch (err) {
      setMessage({ text: `Couldn't reach Google Sheets: ${err.message}`, type: 'error' });
    } finally {
      setParsing(false);
    }
  }

  function updateRow(id, patch) {
    setRows((rs) => recomputeStatuses(rs.map((r) => (r.id === id ? { ...r, ...patch } : r)), existingWords));
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
    <Modal open={open} onClose={handleClose} className="import-modal">
      {step === 'paste' && (
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
          {message.text && <p className={`message ${message.type}`.trim()} role="status">{message.text}</p>}
          <div className="app-modal-actions">
            <Button disabled={!rawText.trim() || parsing} onClick={handleParse}>Check words</Button>
            <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
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

          <div className="import-table-wrap table-wrap">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Word</th>
                  <th>Translation</th>
                  <th>Definition</th>
                  <th>Example</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={row.status === 'invalid' ? 'import-row-invalid' : ''} title={row.raw}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.include}
                        disabled={row.status === 'invalid'}
                        onChange={(e) => updateRow(row.id, { include: e.target.checked })}
                      />
                    </td>
                    <td>
                      <input
                        className="text-input import-cell-input"
                        placeholder="English word"
                        value={row.word}
                        onChange={(e) => updateRow(row.id, { word: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="text-input import-cell-input"
                        placeholder="Polish translation"
                        value={row.translation}
                        onChange={(e) => updateRow(row.id, { translation: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="text-input import-cell-input"
                        placeholder="Optional"
                        value={row.definition}
                        onChange={(e) => updateRow(row.id, { definition: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="text-input import-cell-input"
                        placeholder="Optional"
                        value={row.example}
                        onChange={(e) => updateRow(row.id, { example: e.target.value })}
                      />
                    </td>
                    <td>
                      {row.status === 'invalid' && <span className="tag-pill tag-pill-muted">{row.reason}</span>}
                      {row.status === 'duplicate' && <span className="tag-pill" title={row.reason}>{statusLabel(row.status)}</span>}
                      {row.status === 'valid' && <span className="tag-pill tag-pill-good">{statusLabel(row.status)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {message.text && <p className={`message ${message.type}`.trim()} role="status">{message.text}</p>}
          {importing && <p className="message" role="status">Importing {includedCount} word{includedCount === 1 ? '' : 's'}…</p>}

          <div className="app-modal-actions">
            <Button disabled={includedCount === 0 || importing} onClick={handleImport}>
              Import {includedCount} word{includedCount === 1 ? '' : 's'}
            </Button>
            <Button type="button" variant="secondary" disabled={importing} onClick={() => setStep('paste')}>Back</Button>
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
            <Button onClick={handleClose}>Done</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

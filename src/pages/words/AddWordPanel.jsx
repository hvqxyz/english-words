import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { addWord, getSpreadsheetUrl, SHEET_NAMES, PARTS_OF_SPEECH } from '../../common/storage.js';
import { Button } from '../../components/buttons/Button.jsx';
import { TextInput } from '../../components/inputs/TextInput.jsx';
import { TextArea } from '../../components/inputs/TextArea.jsx';
import { Select } from '../../components/inputs/Select.jsx';
import { TagInput } from '../../components/inputs/TagInput.jsx';

const EMPTY_DETAILS = { translation: '', partOfSpeech: '', category: '', definition: '', example: '', tags: [] };

/**
 * Inline "Add a word" panel (no modal) — mounted only while open, so its
 * state naturally resets each time it's shown. One search field up top
 * drives both lookup and the new-word form: typing an existing word shows
 * everything already saved for it (no accidental duplicate entries); typing
 * a new one reveals the rest of the fields right there so it can be saved
 * without leaving this screen. Bulk import stays one click away for pasting
 * many at once.
 */
export function AddWordPanel({ words, categories, allTags, onClose, onSaved, onEditExisting, onBulkImport }) {
  const [wordText, setWordText] = useState('');
  const [form, setForm] = useState(EMPTY_DETAILS);
  const [pending, setPending] = useState(false);
  const [sheetLinkPending, setSheetLinkPending] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const match = useMemo(() => {
    const key = wordText.trim().toLowerCase();
    if (!key) return null;
    return words.find((w) => w.word.trim().toLowerCase() === key) || null;
  }, [wordText, words]);

  function setField(key) {
    return (value) => setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmedWord = wordText.trim();
    const trimmedTranslation = form.translation.trim();
    if (!trimmedWord || !trimmedTranslation || match) return;

    setPending(true);
    try {
      await addWord({
        word: trimmedWord,
        translation: trimmedTranslation,
        partOfSpeech: form.partOfSpeech,
        category: form.category,
        definition: form.definition.trim(),
        example: form.example.trim(),
        tags: form.tags,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setMessage({ text: `Couldn't save to Google Sheets: ${err.message}`, type: 'error' });
    } finally {
      setPending(false);
    }
  }

  function handleEdit() {
    onEditExisting(match);
    onClose();
  }

  async function handleOpenSheet() {
    setSheetLinkPending(true);
    try {
      const url = await getSpreadsheetUrl(SHEET_NAMES.WORDS);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setMessage({ text: `Couldn't reach Google Sheets: ${err.message}`, type: 'error' });
    } finally {
      setSheetLinkPending(false);
    }
  }

  return (
    <div className="add-word-panel">
      <form className="entry-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="lookup-word-input">English word</label>
          <TextInput
            id="lookup-word-input"
            placeholder="Type a word to look it up or add it"
            value={wordText}
            onChange={setWordText}
            autoFocus
          />
        </div>

        {match ? (
          <>
            <p className="message" role="status">Already in your list — here's what's saved:</p>
            <dl className="app-modal-detail">
              <dt>Translation</dt><dd>{match.translation}</dd>
              {match.partOfSpeech && <><dt>Part of speech</dt><dd>{match.partOfSpeech}</dd></>}
              {match.category && <><dt>Category</dt><dd>{match.category}</dd></>}
              {match.tags && match.tags.length > 0 && <><dt>Tags</dt><dd>{match.tags.join(', ')}</dd></>}
              {match.definition && <><dt>Definition</dt><dd>{match.definition}</dd></>}
              {match.example && <><dt>Example</dt><dd>“{match.example}”</dd></>}
              <dt>Learned</dt><dd>{match.learned ? 'Yes' : 'No'}</dd>
              <dt>Reviewed</dt>
              <dd>{match.timesReviewed} time{match.timesReviewed === 1 ? '' : 's'} · streak {match.correctStreak}</dd>
            </dl>
          </>
        ) : (
          <div className="entry-grid">
            <div className="form-field">
              <label htmlFor="lookup-translation-input">Polish translation</label>
              <TextInput id="lookup-translation-input" placeholder="e.g. niechętny" required
                value={form.translation} onChange={setField('translation')} />
            </div>
            <div className="form-field">
              <label htmlFor="lookup-part-of-speech-input">Part of speech</label>
              <Select
                id="lookup-part-of-speech-input"
                placeholder="Not set"
                options={PARTS_OF_SPEECH.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))}
                value={form.partOfSpeech}
                onChange={setField('partOfSpeech')}
              />
            </div>
            <div className="form-field">
              <label htmlFor="lookup-category-input">Category</label>
              <Select
                id="lookup-category-input"
                placeholder="No category"
                options={categories.map((c) => c.name)}
                value={form.category}
                onChange={setField('category')}
              />
            </div>
            <div className="form-field entry-grid-full">
              <label htmlFor="lookup-tags-input">Tags</label>
              <TagInput
                id="lookup-tags-input"
                placeholder="Type a tag and press Enter"
                value={form.tags}
                onChange={setField('tags')}
                suggestions={allTags}
              />
            </div>
            <div className="form-field entry-grid-full">
              <label htmlFor="lookup-definition-input">Definition (English)</label>
              <TextArea id="lookup-definition-input" placeholder="What the word means, in English"
                value={form.definition} onChange={setField('definition')} />
            </div>
            <div className="form-field entry-grid-full">
              <label htmlFor="lookup-example-input">Example sentence</label>
              <TextArea id="lookup-example-input" placeholder="Used in a sentence"
                value={form.example} onChange={setField('example')} />
            </div>
          </div>
        )}

        {message.text && <p className={`message ${message.type}`.trim()} role="status">{message.text}</p>}

        <div className="app-modal-actions">
          {match ? (
            <Button type="button" onClick={handleEdit}>Edit this word</Button>
          ) : (
            <Button type="submit" disabled={!wordText.trim() || !form.translation.trim() || pending}>Add word</Button>
          )}
          <Button type="button" variant="secondary" onClick={onBulkImport}>Bulk import</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
          <Button
              size="small"
              variant="secondary"
              aria-label="Open in Google Sheets"
              title="Open in Google Sheets"
              disabled={sheetLinkPending}
              onClick={handleOpenSheet}
          >
            <ExternalLink size={16} />
          </Button>
        </div>
      </form>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Volume2, Ear } from 'lucide-react';
import { getWords, getCategories, deleteWord, isDue, getSpreadsheetUrl, SHEET_NAMES, getAllTags } from '../common/storage.js';
import { speakWord, youglishUrl, canSpeak } from '../common/pronunciation.js';
import { Card } from '../components/Card.jsx';
import { Button } from '../components/buttons/Button.jsx';
import { SearchInput } from '../components/inputs/SearchInput.jsx';
import { EntryList } from '../components/lists/EntryList.jsx';
import { WordFormModal } from './words/WordFormModal.jsx';
import { WordLookupModal } from './words/WordLookupModal.jsx';
import { ImportWordsModal } from './words/ImportWordsModal.jsx';

function openYouglish(word) {
  window.open(youglishUrl(word), '_blank', 'noopener');
}

function wordDetails(w) {
  const lines = [];
  if (w.partOfSpeech) lines.push(w.partOfSpeech[0].toUpperCase() + w.partOfSpeech.slice(1));
  if (w.category) lines.push(`Category: ${w.category}`);
  if (w.definition) lines.push(w.definition);
  if (w.example) lines.push(`e.g. “${w.example}”`);
  if (w.tags && w.tags.length > 0) lines.push(`Tags: ${w.tags.join(', ')}`);
  lines.push(
    w.timesReviewed > 0
      ? `Reviewed ${w.timesReviewed} time${w.timesReviewed === 1 ? '' : 's'} · streak ${w.correctStreak}`
      : 'Not practiced yet',
  );
  return lines.join('\n');
}

export function WordsPage() {
  const [words, setWords] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingWord, setEditingWord] = useState(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sheetLinkPending, setSheetLinkPending] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const refresh = useCallback(async () => {
    try {
      const [w, c] = await Promise.all([getWords(), getCategories()]);
      setWords(w);
      setCategories(c);
      setMessage({ text: '', type: '' });
    } catch (err) {
      setMessage({ text: `Couldn't reach Google Sheets: ${err.message}`, type: 'error' });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function openEditForm(word) {
    setEditingWord(word);
    setFormOpen(true);
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

  async function handleDelete(word) {
    if (!window.confirm(`Delete "${word.word}"? This can't be undone.`)) return;
    try {
      await deleteWord(word._row);
      await refresh();
    } catch (err) {
      setMessage({ text: `Couldn't save to Google Sheets: ${err.message}`, type: 'error' });
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words
      .filter((w) => !categoryFilter || w.category === categoryFilter)
      .filter((w) =>
        !q
        || w.word.toLowerCase().includes(q)
        || w.translation.toLowerCase().includes(q)
        || (w.category || '').toLowerCase().includes(q)
        || (w.tags || []).some((t) => t.toLowerCase().includes(q)));
  }, [words, query, categoryFilter]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => a.word.localeCompare(b.word)),
    [filtered],
  );

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const allTags = useMemo(() => getAllTags(words), [words]);

  return (
    <>
      <Card
        title="Your words"
        headerAction={(
          <div className="row" style={{ gap: 8 }}>
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
            <Button size="small" variant="secondary" onClick={() => setImportOpen(true)}>Import</Button>
            <Button size="small" onClick={() => setLookupOpen(true)}>+ Add word</Button>
          </div>
        )}
      >
        <SearchInput
          searchable={false}
          placeholder="Search words, translations, categories…"
          value={query}
          onChange={setQuery}
        />

        {categories.length > 0 && (
          <div className="range-toggle">
            <button
              type="button"
              className="button range-btn"
              aria-pressed={categoryFilter === ''}
              onClick={() => setCategoryFilter('')}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.name}
                type="button"
                className="button range-btn"
                aria-pressed={categoryFilter === c.name}
                onClick={() => setCategoryFilter(c.name)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {message.text && <p className={`message ${message.type}`.trim()} role="status">{message.text}</p>}

        {sorted.length === 0 ? (
          <p className="message" role="status">
            {words.length === 0 ? 'No words yet — add your first one above.' : 'No words match your search.'}
          </p>
        ) : (
          <EntryList
            itemLabel="word"
            items={sorted.map((w) => ({
              key: w._row,
              label: w.word,
              value: (
                <>
                  {w.translation}
                  {w.learned && <span className="tag-pill tag-pill-good" style={{ marginLeft: 6 }}>Learned</span>}
                  {!w.learned && isDue(w, today) && <span className="tag-pill" style={{ marginLeft: 6 }}>Due</span>}
                </>
              ),
              details: wordDetails(w),
              extraActions: [
                ...(canSpeak() ? [{ icon: Volume2, label: `Pronounce ${w.word}`, onClick: () => speakWord(w.word) }] : []),
                { icon: Ear, label: `Find "${w.word}" spoken in context on YouGlish`, onClick: () => openYouglish(w.word) },
              ],
              onEdit: () => openEditForm(w),
              editLabel: `Edit ${w.word}`,
              onRemove: () => handleDelete(w),
              removeLabel: `Delete ${w.word}`,
            }))}
          />
        )}
      </Card>

      <WordFormModal
        open={formOpen}
        word={editingWord}
        categories={categories}
        allTags={allTags}
        onClose={() => setFormOpen(false)}
        onSaved={refresh}
      />

      <WordLookupModal
        open={lookupOpen}
        words={words}
        categories={categories}
        allTags={allTags}
        onClose={() => setLookupOpen(false)}
        onSaved={refresh}
        onEditExisting={openEditForm}
        onBulkImport={() => {
          setLookupOpen(false);
          setImportOpen(true);
        }}
      />

      <ImportWordsModal
        open={importOpen}
        categories={categories}
        onClose={() => setImportOpen(false)}
        onSaved={refresh}
      />
    </>
  );
}

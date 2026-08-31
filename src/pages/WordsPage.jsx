import { useCallback, useEffect, useMemo, useState } from 'react';
import { getWords, getCategories, deleteWord, getAllTags } from '../common/storage.js';
import { Card } from '../components/Card.jsx';
import { WordFormModal } from './words/WordFormModal.jsx';
import { AddWordPanel } from './words/AddWordPanel.jsx';
import { BulkImportPanel } from './words/BulkImportPanel.jsx';
import { WordsListSection } from './words/WordsListSection.jsx';

export function WordsPage() {
  const [words, setWords] = useState([]);
  const [categories, setCategories] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingWord, setEditingWord] = useState(null);
  // Which inline panel is expanded below the toggle row — only one at a time.
  const [activePanel, setActivePanel] = useState(null); // null | 'add' | 'import'
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
    setActivePanel(null);
    setEditingWord(word);
    setFormOpen(true);
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

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const allTags = useMemo(() => getAllTags(words), [words]);

  return (
    <>
      <div className="range-toggle">
        <button
            type="button"
            className="button range-btn"
            aria-pressed={activePanel === 'add'}
            onClick={() => setActivePanel((p) => (p === 'add' ? null : 'add'))}
        >
          + Add word
        </button>
        <button
            type="button"
            className="button range-btn"
            aria-pressed={activePanel === 'import'}
            onClick={() => setActivePanel((p) => (p === 'import' ? null : 'import'))}
        >
          Bulk import
        </button>
      </div>

      <Card>
        {activePanel === 'add' ? (
          <AddWordPanel
              words={words}
              categories={categories}
              allTags={allTags}
              onClose={() => setActivePanel(null)}
              onSaved={refresh}
              onEditExisting={openEditForm}
              onBulkImport={() => setActivePanel('import')}
          />
        ) : (
          <BulkImportPanel
            categories={categories}
            allTags={allTags}
            onClose={() => setActivePanel(null)}
            onSaved={refresh}
          />
        )}
      </Card>

      <WordsListSection
        words={words}
        categories={categories}
        message={message}
        today={today}
        onEdit={openEditForm}
        onDelete={handleDelete}
      />

      <WordFormModal
        open={formOpen}
        word={editingWord}
        categories={categories}
        allTags={allTags}
        onClose={() => setFormOpen(false)}
        onSaved={refresh}
      />

    </>
  );
}

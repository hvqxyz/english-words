import { useMemo, useState } from 'react';
import { Volume2, Ear } from 'lucide-react';
import { isDue } from '../../common/storage.js';
import { speakWord, youglishUrl, canSpeak } from '../../common/pronunciation.js';
import { Card } from '../../components/Card.jsx';
import { SearchInput } from '../../components/inputs/SearchInput.jsx';
import { EntryList } from '../../components/lists/EntryList.jsx';

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

/**
 * Search/filter/browse card for the Words tab — owns its own search text and
 * category-filter state (pure UI concerns), and renders the word list off of
 * whatever `words`/`categories` the parent currently has loaded. Row actions
 * (edit/delete/pronounce) call back up to the parent, which owns the data.
 */
export function WordsListSection({ words, categories, message, today, onEdit, onDelete }) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

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

  const isFiltering = query.trim() !== '' || categoryFilter !== '';

  const sorted = useMemo(() => {
    if (isFiltering) {
      return [...filtered].sort((a, b) => a.word.localeCompare(b.word));
    }
    // No search/category filter active — show only the most recently added
    // words instead of loading the whole list.
    return [...filtered]
      .sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || '') || b._row - a._row)
      .slice(0, 10);
  }, [filtered, isFiltering]);

  return (
    <Card>
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

      {!isFiltering && words.length > 10 && (
        <p className="label">Showing your 10 most recently added words — search to see the rest.</p>
      )}

      {sorted.length === 0 ? (
        <p className="message" role="status">
          {words.length === 0 ? 'No words yet — add your first one above.' : 'No words match your search.'}
        </p>
      ) : (
        <EntryList
          itemLabel="word"
          expandable={false}
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
            onEdit: () => onEdit(w),
            editLabel: `Edit ${w.word}`,
            onRemove: () => onDelete(w),
            removeLabel: `Delete ${w.word}`,
          }))}
        />
      )}
    </Card>
  );
}

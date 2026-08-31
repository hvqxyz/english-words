import { useCallback, useEffect, useMemo, useState } from 'react';
import { Volume2, Ear } from 'lucide-react';
import { getWords, getCategories, getAllTags, practicePool, buildPracticeQueue, recordReview, recordSession } from '../common/storage.js';
import { speakWord, youglishUrl, canSpeak } from '../common/pronunciation.js';
import { Card } from '../components/Card.jsx';
import { Button } from '../components/buttons/Button.jsx';
import { Checkbox } from '../components/inputs/Checkbox.jsx';
import { Select } from '../components/inputs/Select.jsx';
import { SearchInput } from '../components/inputs/SearchInput.jsx';

function openYouglish(word) {
  window.open(youglishUrl(word), '_blank', 'noopener');
}

const SESSION_SIZE_OPTIONS = [
  { value: '10', label: '10 cards' },
  { value: '20', label: '20 cards' },
  { value: '50', label: '50 cards' },
  { value: '100', label: '100 cards' },
  { value: '0', label: 'All' },
];

export function PracticePage() {
  const [words, setWords] = useState(null);
  const [categories, setCategories] = useState([]);
  const [onlyDue, setOnlyDue] = useState(true);
  const [sessionSize, setSessionSize] = useState('20');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  const [phase, setPhase] = useState('setup'); // 'setup' | 'session' | 'summary'
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState({ correct: 0, total: 0 });
  const [pending, setPending] = useState(false);

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

  const tags = useMemo(() => (words ? getAllTags(words) : []), [words]);

  const dueCount = useMemo(() => (words ? practicePool(words, { onlyDue: true }).length : 0), [words]);

  const poolCount = useMemo(
    () => (words ? practicePool(words, { onlyDue, category: categoryFilter, tag: tagFilter }).length : 0),
    [words, onlyDue, categoryFilter, tagFilter],
  );

  function startSession() {
    const limit = parseInt(sessionSize, 10) || 0;
    const built = buildPracticeQueue(words, { onlyDue, category: categoryFilter, tag: tagFilter, limit });
    if (built.length === 0) return;
    setQueue(built);
    setIndex(0);
    setRevealed(false);
    setResults({ correct: 0, total: 0 });
    setPhase('session');
  }

  async function handleAnswer(correct) {
    setPending(true);
    try {
      await recordReview(queue[index], correct);
      setResults((r) => ({ correct: r.correct + (correct ? 1 : 0), total: r.total + 1 }));
      if (index + 1 < queue.length) {
        setIndex((i) => i + 1);
        setRevealed(false);
      } else {
        await recordSession({
          total: results.total + 1,
          correct: results.correct + (correct ? 1 : 0),
          onlyDue,
          category: categoryFilter,
          tag: tagFilter,
        });
        await refresh();
        setPhase('summary');
      }
    } catch (err) {
      setMessage({ text: `Couldn't save to Google Sheets: ${err.message}`, type: 'error' });
    } finally {
      setPending(false);
    }
  }

  function backToSetup() {
    setPhase('setup');
  }

  if (words === null) {
    return <p className="message" role="status">Loading…</p>;
  }

  if (phase === 'session') {
    const current = queue[index];
    return (
      <Card title="Practice">
        <p className="flashcard-progress">Card {index + 1} of {queue.length}</p>
        <div className="flashcard">
          <div className="flashcard-meta">
            {current.partOfSpeech && <span className="tag-pill">{current.partOfSpeech}</span>}
            {current.category && <span className="tag-pill tag-pill-muted">{current.category}</span>}
          </div>
          <div className="flashcard-word">{current.word}</div>
          <div className="flashcard-audio-actions">
            {canSpeak() && (
              <Button size="small" variant="secondary" aria-label={`Pronounce ${current.word}`} onClick={() => speakWord(current.word)}>
                <Volume2 size={16} />
              </Button>
            )}
            <Button size="small" variant="secondary" aria-label={`Find "${current.word}" spoken in context on YouGlish`} onClick={() => openYouglish(current.word)}>
              <Ear size={16} />
            </Button>
          </div>

          {revealed ? (
            <div className="flashcard-answer">
              <div className="flashcard-translation">{current.translation}</div>
              {current.definition && <div className="flashcard-definition">{current.definition}</div>}
              {current.example && <div className="flashcard-example">“{current.example}”</div>}
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setRevealed(true)}>Show answer</Button>
          )}
        </div>

        {revealed && (
          <div className="flashcard-actions">
            <Button variant="danger" disabled={pending} onClick={() => handleAnswer(false)}>Didn't know it</Button>
            <Button disabled={pending} onClick={() => handleAnswer(true)}>Knew it</Button>
          </div>
        )}
        {message.text && <p className={`message ${message.type}`.trim()} role="status">{message.text}</p>}
      </Card>
    );
  }

  if (phase === 'summary') {
    const { correct, total } = results;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <Card title="Session complete">
        <div className="session-summary">
          <div className="session-summary-score">{correct}/{total}</div>
          <p className="stat-sub">{pct}% correct this session</p>
          <Button onClick={backToSetup}>Practice again</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Practice">
      <section className="stat-grid">
        <div className="stat-tile">
          <div className="label">Total words</div>
          <div className="stat-value">{words.length}</div>
        </div>
        <div className="stat-tile">
          <div className="label">Due today</div>
          <div className="stat-value">{dueCount}</div>
        </div>
      </section>

      <div className="form-field">
        <label htmlFor="session-size-input">Session length</label>
        <Select
          id="session-size-input"
          options={SESSION_SIZE_OPTIONS}
          value={sessionSize}
          onChange={setSessionSize}
        />
      </div>

      {categories.length > 0 && (
        <div className="form-field">
          <label htmlFor="category-filter-input">Category</label>
          <Select
            id="category-filter-input"
            placeholder="All categories"
            options={categories.map((c) => c.name)}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
        </div>
      )}

      {tags.length > 0 && (
        <div className="form-field">
          <label htmlFor="tag-filter-input">Tag</label>
          <SearchInput
            id="tag-filter-input"
            items={tags}
            placeholder="All tags — search…"
            value={tagFilter}
            onChange={setTagFilter}
          />
        </div>
      )}

      <Checkbox checked={onlyDue} onChange={setOnlyDue} label="Only words due for review" />

      {message.text && <p className={`message ${message.type}`.trim()} role="status">{message.text}</p>}

      {words.length === 0 ? (
        <p className="message" role="status">Add some words on the Words tab first.</p>
      ) : poolCount === 0 ? (
        <p className="message" role="status">
          {onlyDue
            ? 'Nothing matches this filter and is due right now. Uncheck "Only due", or widen the category/tag filter.'
            : 'No words match this filter.'}
        </p>
      ) : (
        <Button onClick={startSession}>Start practice</Button>
      )}
    </Card>
  );
}

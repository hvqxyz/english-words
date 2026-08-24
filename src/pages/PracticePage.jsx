import { useCallback, useEffect, useMemo, useState } from 'react';
import { Volume2, Ear } from 'lucide-react';
import { getWords, dueWords, buildPracticeQueue, recordReview } from '../common/storage.js';
import { speakWord, youglishUrl, canSpeak } from '../common/pronunciation.js';
import { Card } from '../components/Card.jsx';
import { Button } from '../components/buttons/Button.jsx';
import { Checkbox } from '../components/inputs/Checkbox.jsx';
import { Select } from '../components/inputs/Select.jsx';

function openYouglish(word) {
  window.open(youglishUrl(word), '_blank', 'noopener');
}

const SESSION_SIZE_OPTIONS = [
  { value: '10', label: '10 cards' },
  { value: '20', label: '20 cards' },
  { value: '0', label: 'All' },
];

export function PracticePage() {
  const [words, setWords] = useState(null);
  const [onlyDue, setOnlyDue] = useState(true);
  const [sessionSize, setSessionSize] = useState('20');
  const [message, setMessage] = useState({ text: '', type: '' });

  const [phase, setPhase] = useState('setup'); // 'setup' | 'session' | 'summary'
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState({ correct: 0, total: 0 });
  const [pending, setPending] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setWords(await getWords());
      setMessage({ text: '', type: '' });
    } catch (err) {
      setMessage({ text: `Couldn't reach Google Sheets: ${err.message}`, type: 'error' });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const dueCount = useMemo(() => (words ? dueWords(words).length : 0), [words]);

  function startSession() {
    const limit = parseInt(sessionSize, 10) || 0;
    const built = buildPracticeQueue(words, { onlyDue, limit });
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

      <Checkbox checked={onlyDue} onChange={setOnlyDue} label="Only words due for review" />

      {message.text && <p className={`message ${message.type}`.trim()} role="status">{message.text}</p>}

      {words.length === 0 ? (
        <p className="message" role="status">Add some words on the Words tab first.</p>
      ) : onlyDue && dueCount === 0 ? (
        <p className="message" role="status">All caught up — nothing is due right now. Uncheck "Only due" to practice anyway.</p>
      ) : (
        <Button onClick={startSession}>Start practice</Button>
      )}
    </Card>
  );
}

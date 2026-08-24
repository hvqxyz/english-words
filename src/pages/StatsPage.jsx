import { useCallback, useEffect, useState } from 'react';
import { getWords, summarizeWords, categoryBreakdown, wordsAddedOverTimePoints } from '../common/storage.js';
import { Card } from '../components/Card.jsx';
import { LineChart } from '../components/charts/LineChart.jsx';

export function StatsPage() {
  const [words, setWords] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

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

  if (message.text) {
    return <p className="message error" role="status">{message.text}</p>;
  }
  if (words === null) {
    return <p className="message" role="status">Loading…</p>;
  }

  const summary = summarizeWords(words);
  const breakdown = categoryBreakdown(words);
  const maxCount = breakdown.length ? breakdown[0].count : 0;
  const points = wordsAddedOverTimePoints(words);

  return (
    <>
      <section className="stat-grid">
        <div className="stat-tile">
          <div className="label">Total words</div>
          <div className="stat-value">{summary.total}</div>
        </div>
        <div className="stat-tile">
          <div className="label">Learned</div>
          <div className="stat-value">{summary.learned}</div>
          <div className="stat-sub">{summary.total > 0 ? `${Math.round((summary.learned / summary.total) * 100)}% of all words` : ''}</div>
        </div>
        <div className="stat-tile">
          <div className="label">Due today</div>
          <div className="stat-value">{summary.due}</div>
        </div>
        <div className="stat-tile">
          <div className="label">Categories</div>
          <div className="stat-value">{summary.categories}</div>
        </div>
      </section>

      <Card title="Words added over time">
        {points.length < 2 ? (
          <p className="message" role="status">Add a few words to see this chart.</p>
        ) : (
          <LineChart
            labels={points.map((p) => p.x)}
            values={points.map((p) => p.y)}
            datasetLabel="Total words"
            showAverage={false}
          />
        )}
      </Card>

      <Card title="By category">
        {breakdown.length === 0 ? (
          <p className="message" role="status">No words yet.</p>
        ) : (
          <div className="card-wrapper">
            {breakdown.map(({ category, count }) => (
              <div className="category-bar-row" key={category}>
                <div className="category-bar-labels">
                  <span>{category}</span>
                  <span>{count}</span>
                </div>
                <div className="category-bar-track">
                  <div className="category-bar-fill" style={{ width: `${maxCount ? (count / maxCount) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

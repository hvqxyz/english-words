import { useCallback, useEffect, useState } from 'react';
import {
  getWords, getSessions, summarizeWords, categoryBreakdown, wordsAddedOverTimePoints,
  summarizeSessions, sessionsOverTimePoints,
} from '../common/storage.js';
import { Card } from '../components/Card.jsx';
import { LineChart } from '../components/charts/LineChart.jsx';

export function StatsPage() {
  const [words, setWords] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  const refresh = useCallback(async () => {
    try {
      const [w, s] = await Promise.all([getWords(), getSessions()]);
      setWords(w);
      setSessions(s);
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
  if (words === null || sessions === null) {
    return <p className="message" role="status">Loading…</p>;
  }

  const summary = summarizeWords(words);
  const breakdown = categoryBreakdown(words);
  const maxCount = breakdown.length ? breakdown[0].count : 0;
  const points = wordsAddedOverTimePoints(words);

  const sessionSummary = summarizeSessions(sessions);
  const sessionPoints = sessionsOverTimePoints(sessions);

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

      <section className="stat-grid">
        <div className="stat-tile">
          <div className="label">Sessions completed</div>
          <div className="stat-value">{sessionSummary.totalSessions}</div>
        </div>
        <div className="stat-tile">
          <div className="label">Cards reviewed</div>
          <div className="stat-value">{sessionSummary.totalReviews}</div>
        </div>
        <div className="stat-tile">
          <div className="label">Avg. accuracy</div>
          <div className="stat-value">{sessionSummary.totalReviews > 0 ? `${sessionSummary.avgAccuracy}%` : '—'}</div>
        </div>
        <div className="stat-tile">
          <div className="label">Day streak</div>
          <div className="stat-value">{sessionSummary.streak}</div>
        </div>
      </section>

      <Card title="Practice over time">
        {sessionPoints.length < 2 ? (
          <p className="message" role="status">Complete a few practice sessions to see this chart.</p>
        ) : (
          <LineChart
            labels={sessionPoints.map((p) => p.x)}
            values={sessionPoints.map((p) => p.reviews)}
            datasetLabel="Cards reviewed"
            showAverage={false}
            secondValues={sessionPoints.map((p) => p.accuracy)}
            secondDatasetLabel="Accuracy %"
          />
        )}
      </Card>

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

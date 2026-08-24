import { useEffect, useRef, useState } from 'react';
import { getUserProfile, signOut } from '../common/auth.js';
import {
  getSpreadsheetUrl,
  SHEET_NAMES,
  exportToFile,
  parseImportFile,
  applyImportedData,
} from '../common/storage.js';
import { Card } from '../components/Card.jsx';
import { Button } from '../components/buttons/Button.jsx';

export function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [sheetLinkPending, setSheetLinkPending] = useState(false);
  const [backupMessage, setBackupMessage] = useState({ text: '', type: '' });
  const fileInputRef = useRef(null);

  useEffect(() => {
    getUserProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  function handleSignOut() {
    if (!window.confirm('Sign out of Google?')) return;
    signOut();
    window.location.reload();
  }

  async function handleOpenSheet() {
    setSheetLinkPending(true);
    try {
      const url = await getSpreadsheetUrl(SHEET_NAMES.WORDS);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setBackupMessage({ text: `Couldn't reach Google Sheets: ${err.message}`, type: 'error' });
    } finally {
      setSheetLinkPending(false);
    }
  }

  async function handleExport() {
    try {
      await exportToFile();
      setBackupMessage({ text: 'Export downloaded.', type: 'success' });
    } catch (err) {
      setBackupMessage({ text: `Couldn't reach Google Sheets: ${err.message}`, type: 'error' });
    }
  }

  async function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = parseImportFile(text);
      if (!window.confirm('This will replace all current words and categories in your Google Sheet. Continue?')) {
        e.target.value = '';
        return;
      }
      await applyImportedData(data);
      setBackupMessage({ text: 'Import successful.', type: 'success' });
    } catch (err) {
      setBackupMessage({ text: `Import failed: ${err.message}`, type: 'error' });
    }
    e.target.value = '';
  }

  return (
    <>
      <Card title="Account">
        {profile ? (
          <div className="row" style={{ alignItems: 'center' }}>
            {profile.picture ? (
              <img src={profile.picture} alt="" width={40} height={40} style={{ borderRadius: '50%' }} referrerPolicy="no-referrer" />
            ) : (
              <span className="app-button profile-avatar-link" aria-hidden="true">
                {profile.name?.trim().charAt(0).toUpperCase() || '?'}
              </span>
            )}
            <div className="column" style={{ gap: 2 }}>
              <strong>{profile.name || 'Signed in'}</strong>
              {profile.email && <span className="stat-sub">{profile.email}</span>}
            </div>
          </div>
        ) : (
          <p className="message" role="status">Loading account…</p>
        )}
        <Button variant="secondary" onClick={handleSignOut}>Sign out</Button>
      </Card>

      <Card title="Google Sheet">
        <p className="label">Your words, definitions, and categories are stored in a spreadsheet in your Google Drive.</p>
        <Button variant="secondary" disabled={sheetLinkPending} onClick={handleOpenSheet}>
          Open in Google Sheets
        </Button>
      </Card>

      <Card title="Backup">
        <div className="inline-form">
          <Button onClick={handleExport}>Export data</Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Import data</Button>
          <input type="file" accept="application/json" hidden ref={fileInputRef} onChange={handleImportFile} />
        </div>
        {backupMessage.text && <p className={`message ${backupMessage.type}`.trim()} role="status">{backupMessage.text}</p>}
      </Card>
    </>
  );
}

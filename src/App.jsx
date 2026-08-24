import { useCallback, useState } from 'react';
import { getUserProfile } from './common/auth.js';
import { Button } from './components/buttons/Button.jsx';
import { SignInGate } from './components/SignInGate.jsx';
import { Tabs } from './components/nav/Tabs.jsx';
import { WordsPage } from './pages/WordsPage.jsx';
import { PracticePage } from './pages/PracticePage.jsx';
import { CategoriesPage } from './pages/CategoriesPage.jsx';
import { StatsPage } from './pages/StatsPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';

// Rendered as the main tab bar.
const TABS = [
  { value: 'words', label: 'Words' },
  { value: 'practice', label: 'Practice' },
  { value: 'categories', label: 'Categories' },
  { value: 'stats', label: 'Stats' },
];

// Profile isn't a main tab — like fitness-counter, it's reached via the
// header avatar icon instead.
const PAGES = {
  words: WordsPage,
  practice: PracticePage,
  categories: CategoriesPage,
  stats: StatsPage,
  profile: ProfilePage,
};

function App() {
  const [page, setPage] = useState('words');
  const [avatarInitial, setAvatarInitial] = useState(null);
  const Page = PAGES[page];

  const handleSignIn = useCallback(() => {
    getUserProfile()
      .then((profile) => setAvatarInitial(profile.name?.trim().charAt(0).toUpperCase() || null))
      .catch(() => setAvatarInitial(null));
  }, []);

  return (
    <>
      <header className="app-header">
        <h1>Vocab Builder</h1>
        <Button
          className="profile-avatar-link"
          aria-label="Profile"
          onClick={() => setPage('profile')}
        >
          {avatarInitial ? (
            <span className="profile-avatar-initial">{avatarInitial}</span>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"></circle>
              <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8"></path>
            </svg>
          )}
        </Button>
      </header>
      <Tabs value={page} onChange={setPage} tabs={TABS} />
      <main>
        <SignInGate onSignIn={handleSignIn}>
          <Page />
        </SignInGate>
      </main>
    </>
  );
}

export default App;

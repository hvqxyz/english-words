import { useEffect, useState } from 'react';
import { isSignedIn, getAccessToken } from '../common/auth.js';
import { Button } from './buttons/Button.jsx';
import { Card } from './Card.jsx';

/**
 * Shows a "Sign in with Google" card until a valid token exists, then
 * renders children. Calls onSignIn (if given) once a valid token is
 * confirmed, both on mount (already signed in from a prior session) and
 * right after a successful sign-in.
 */
export function SignInGate({ children, onSignIn }) {
  const [signedIn, setSignedIn] = useState(isSignedIn());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (signedIn) onSignIn?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  async function handleSignIn() {
    setPending(true);
    setError('');
    try {
      await getAccessToken();
      setSignedIn(true);
    } catch (err) {
      setError(`Sign-in failed: ${err.message}`);
    } finally {
      setPending(false);
    }
  }

  if (!signedIn) {
    return (
      <Card title="Sign in required">
        <p>Your words live in a Google Sheet. Sign in with Google to load them.</p>
        <Button disabled={pending} onClick={handleSignIn}>
          Sign in with Google
        </Button>
        {error && <p className="message error" role="status">{error}</p>}
      </Card>
    );
  }

  return children;
}

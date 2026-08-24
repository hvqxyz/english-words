import { GOOGLE_CLIENT_ID } from './config.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.file openid profile';
const SESSION_KEY = 'vocab-builder-google-token';

let tokenClient = null;
let accessToken = null;
let tokenExpiry = 0;
let userProfile = null;

function loadFromSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return;
  try {
    const { token, expiry } = JSON.parse(raw);
    if (token && expiry > Date.now()) {
      accessToken = token;
      tokenExpiry = expiry;
    }
  } catch {
    // ignore malformed session cache
  }
}

function saveToSession() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: accessToken, expiry: tokenExpiry }));
}

loadFromSession();

function ensureTokenClient() {
  if (tokenClient) return tokenClient;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPE,
    callback: () => {},
  });
  return tokenClient;
}

export function isSignedIn() {
  return !!accessToken && Date.now() < tokenExpiry;
}

/**
 * Resolves with a valid access token, prompting a Google sign-in popup if
 * needed. Must be called from a user-gesture handler (e.g. a button click)
 * the first time, since browsers block un-requested popups otherwise.
 */
export function getAccessToken() {
  if (isSignedIn()) return Promise.resolve(accessToken);

  return new Promise((resolve, reject) => {
    const client = ensureTokenClient();
    client.callback = (resp) => {
      if (resp.error) {
        reject(new Error(resp.error_description || resp.error));
        return;
      }
      accessToken = resp.access_token;
      tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
      saveToSession();
      resolve(accessToken);
    };
    client.requestAccessToken({ prompt: isSignedIn() ? 'none' : '' });
  });
}

export function signOut() {
  if (accessToken && window.google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  tokenExpiry = 0;
  userProfile = null;
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * The signed-in user's Google name/email/picture, via the OpenID userinfo
 * endpoint (needs the "openid profile" scope on top of the Drive scope).
 * Fetched once per session and cached in memory.
 */
export async function getUserProfile() {
  if (userProfile) return userProfile;

  const token = await getAccessToken();
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Couldn't load Google profile (${res.status})`);

  const { name, email, picture } = await res.json();
  userProfile = { name, email, picture };
  return userProfile;
}

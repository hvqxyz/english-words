/**
 * On-demand pronunciation for a word: an instant browser-spoken preview via
 * the Web Speech API, plus a link out to YouGlish (youglish.com), which
 * plays real YouTube clips of the word spoken in context — useful when the
 * built-in voice isn't enough and you want to hear how native speakers
 * actually use it.
 */

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Speaks `text` aloud in English, cancelling anything currently speaking first. */
export function speakWord(text) {
  if (!canSpeak() || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
}

/** youglish.com search URL for real spoken-in-context examples of `word`. */
export function youglishUrl(word) {
  return `https://youglish.com/pronounce/${encodeURIComponent(word)}/english`;
}

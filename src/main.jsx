// Entry point
import React from 'react';
import ReactDOM from 'react-dom/client';
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill';
import App from './App.jsx';

// Windows Chrome (and a few other desktop systems) ship without a
// regional-indicator flag font, so 🇺🇸 renders as "US". This polyfill
// detects that gap and loads a small flag webfont as a fallback —
// it's a no-op on Mac / iOS / Android (zero bytes downloaded).
// Elements that may show flags must opt into the fallback font with
// `font-family: "Twemoji Country Flags", system-ui, ...`.
polyfillCountryFlagEmojis();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initTheme } from './lib/theme'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

initTheme()

// Vite content-hashes every chunk filename, so a fresh deploy replaces
// old chunks entirely -- a tab left open from before that deploy still
// has the old filenames in memory and 404s the moment it tries to lazy-
// load one (e.g. the exceljs import/export chunk). Vite fires this event
// specifically for that case; reload once to pick up the new build
// instead of leaving the user stuck on a "failed to fetch module" error.
// The sessionStorage guard stops a reload loop if the failure is for a
// different, non-stale-deploy reason.
window.addEventListener('vite:preloadError', () => {
  const key = 'chunk-reload-attempted'
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, '1')
    window.location.reload()
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// This script itself loaded fine, so any earlier reload attempt (from a
// previous, possibly unrelated deploy) has served its purpose -- clear it
// so a future preload error still gets its one automatic reload instead
// of being silently swallowed by a stale flag from this same tab.
sessionStorage.removeItem('chunk-reload-attempted')

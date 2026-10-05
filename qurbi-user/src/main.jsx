import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from '@/App.jsx'
import '@/i18n'
import '@/index.css'

const rootElement = document.getElementById('root')
const app = (
  <HelmetProvider>
    <App />
  </HelmetProvider>
)

// Public pages are prerendered at build time and marked by the build script;
// those are hydrated. Every other route (private, listing details) is served
// the empty app shell and rendered normally.
if (rootElement.hasAttribute('data-prerendered')) {
  hydrateRoot(rootElement, app)
} else {
  createRoot(rootElement).render(app)
}

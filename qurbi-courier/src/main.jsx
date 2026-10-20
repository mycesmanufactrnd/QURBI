import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/i18n'
import { startProofQueueSync } from '@/lib/proofSubmission'

// Photos taken offline are retried as soon as there is signal again.
startProofQueueSync()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

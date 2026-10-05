import React from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { HelmetProvider } from 'react-helmet-async'
import App from '@/App.jsx'
import '@/i18n'

export { PUBLIC_PATHS } from '@/seo/routes'

/** Renders one URL to an HTML string plus its <head> tags. */
export function render(url) {
  const helmetContext = {}
  const html = renderToString(
    <HelmetProvider context={helmetContext}>
      <App Router={StaticRouter} routerProps={{ location: url }} />
    </HelmetProvider>,
  )
  return { html, helmet: helmetContext.helmet }
}

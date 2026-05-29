/**
 * App root - sets up routing and wraps the app in the error boundary.
 *
 * Routes:
 *   /                         → Landing page (marketing entry point)
 *   /app                      → URL intake (new ad from within the app)
 *   /crawl/:jobId             → Live crawl progress view
 *   /project/:id/preview      → Ad preview player
 *   /project/:id/editor       → Timeline editor
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import { Spinner } from '@shared/components';
import styles from './App.module.css';

// Route-level code splitting - each feature loads its own chunk
const LandingPage = lazy(() =>
  import('@features/landing/LandingPage').then((m) => ({ default: m.LandingPage }))
);
const UrlIntakePage = lazy(() =>
  import('@features/url-intake/UrlIntakePage').then((m) => ({ default: m.UrlIntakePage }))
);
const CrawlProgressPage = lazy(() =>
  import('@features/url-intake/CrawlProgressPage').then((m) => ({ default: m.CrawlProgressPage }))
);
const AdPreviewPage = lazy(() =>
  import('@features/ad-preview/AdPreviewPage').then((m) => ({ default: m.AdPreviewPage }))
);
const AdEditorPage = lazy(() =>
  import('@features/ad-editor/AdEditorPage').then((m) => ({ default: m.AdEditorPage }))
);

const PageSpinner: React.FC = () => (
  <div className={styles.pageSpinner}>
    <Spinner size="lg" color="primary" />
  </div>
);

export const App: React.FC = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/"              element={<LandingPage />} />
          <Route path="/app"           element={<Navigate to="/" replace />} />
          <Route path="/crawl/:jobId"  element={<CrawlProgressPage />} />
          <Route path="/project/:id/preview" element={<AdPreviewPage />} />
          <Route path="/project/:id/editor"  element={<AdEditorPage />} />
          {/* Redirect bare project URL to preview */}
          <Route path="/project/:id"   element={<Navigate to="preview" replace />} />
          {/* Catch-all → landing */}
          <Route path="*"              element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </ErrorBoundary>
);

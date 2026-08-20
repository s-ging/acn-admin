import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CompaniesListPage from './pages/companies/index'
import CompanyEditorPage from './pages/companies/CompanyEditorPage'
import ArticlesListPage from './pages/articles/index'
import ArticleEditorPage from './pages/articles/ArticleEditorPage'
import ModalPreview from './components/dev/ModalPreview'
import { ToastContainer } from './components/ui/Toast'

// The spreadsheet views carry Univer — a canvas engine, a formula engine and a
// render engine, ~1.5MB gzipped, several times the rest of the app put together.
// Both sheet routes import the same <SheetView>, so that weight lands in one
// shared chunk rather than being paid twice.
//
// It is split out so it does not block first paint, then deliberately pulled in
// on an idle callback right afterwards — front-loaded, in other words. Opening a
// sheet is then instant, and the cost is paid once while nobody is waiting on it
// rather than at the moment someone asks for the grid.
const CompanySheetPage = lazy(() => import('./pages/companies/CompanySheetPage'))
const ArticleSheetPage = lazy(() => import('./pages/articles/ArticleSheetPage'))

const sheetFallback = (
  <div className="sheet-loading">
    <div className="sheet-loading__spinner" />
    <span>Loading spreadsheet…</span>
  </div>
)

function usePreloadSheet() {
  useEffect(() => {
    const preload = () => { void import('./components/sheet/SheetView') }
    const idle = window.requestIdleCallback
    if (typeof idle === 'function') {
      const handle = idle(preload, { timeout: 4000 })
      return () => window.cancelIdleCallback?.(handle)
    }
    // Safari has no requestIdleCallback; a short delay is close enough, and the
    // point is only to stay out of the way of first paint.
    const timer = setTimeout(preload, 1500)
    return () => clearTimeout(timer)
  }, [])
}

export default function App() {
  usePreloadSheet()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/companies" replace />} />
        <Route path="/companies" element={<CompaniesListPage />} />
        {/* Static segment, so it outranks /companies/:id regardless of order. */}
        <Route
          path="/companies/sheet"
          element={<Suspense fallback={sheetFallback}><CompanySheetPage /></Suspense>}
        />
        <Route path="/companies/:id" element={<CompanyEditorPage />} />
        <Route path="/article" element={<ArticlesListPage />} />
        <Route
          path="/article/sheet"
          element={<Suspense fallback={sheetFallback}><ArticleSheetPage /></Suspense>}
        />
        {/* /article/new generates an id, writes a blank record and redirects */}
        <Route path="/article/:id" element={<ArticleEditorPage />} />
        <Route path="/dev" element={<ModalPreview />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  )
}

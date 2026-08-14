import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CompaniesListPage from './pages/companies/index'
import CompanyEditorPage from './pages/companies/CompanyEditorPage'
import ArticlesListPage from './pages/articles/index'
import ArticleEditorPage from './pages/articles/ArticleEditorPage'
import ModalPreview from './components/dev/ModalPreview'
import { ToastContainer } from './components/ui/Toast'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/companies" replace />} />
        <Route path="/companies" element={<CompaniesListPage />} />
        <Route path="/companies/:id" element={<CompanyEditorPage />} />
        <Route path="/article" element={<ArticlesListPage />} />
        {/* /article/new generates an id, writes a blank record and redirects */}
        <Route path="/article/:id" element={<ArticleEditorPage />} />
        <Route path="/dev" element={<ModalPreview />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  )
}

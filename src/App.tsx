import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CompaniesListPage from './pages/companies/index'
import CompanyEditorPage from './pages/companies/CompanyEditorPage'
import ModalPreview from './components/dev/ModalPreview'
import { ToastContainer } from './components/ui/Toast'
import { SeedButton } from './dev/SeedButton'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/companies" replace />} />
        <Route path="/companies" element={<CompaniesListPage />} />
        <Route path="/companies/:id" element={<CompanyEditorPage />} />
        <Route path="/dev" element={<ModalPreview />} />
      </Routes>
      <ToastContainer />
      <SeedButton />
    </BrowserRouter>
  )
}

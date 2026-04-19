import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '../index.css'
import './admin.css'
import { setupServerCallback } from '../rsc-client'
import AdminApp from './AdminApp'
setupServerCallback()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/admin">
      <AdminApp />
    </BrowserRouter>
  </StrictMode>
)

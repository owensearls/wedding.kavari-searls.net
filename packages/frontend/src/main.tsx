import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { App } from './App'
import { setupServerCallback } from 'rsc-utils/functions/browser'
import './index.css'

const backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8787'
setupServerCallback(`${backendUrl}/@rsc-public/`)

const router = createBrowserRouter([
  { path: '/', Component: App },
  {
    path: '/rsvp/:code',
    lazy: async () => ({
      Component: (await import('./routes/RsvpFull')).RsvpFull,
    }),
  },
  { path: '*', Component: App },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)

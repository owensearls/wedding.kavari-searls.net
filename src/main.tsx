import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { App } from './App.tsx'
import { setupServerCallback } from './rsc-client'

setupServerCallback()

const router = createBrowserRouter([
  { path: '/', Component: App },
  {
    path: '/rsvp/:code',
    lazy: async () => ({
      Component: (await import('./routes/RsvpFull')).RsvpFull,
    }),
  },
  {
    path: '/admin/*',
    lazy: async () => ({
      Component: (await import('./admin/AdminApp')).AdminApp,
    }),
  },
  { path: '*', Component: App },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)

import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { App } from './App.tsx'
import { setupServerCallback } from './rsc-client'

setupServerCallback('/@rsc-admin/')

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

async function bootstrap() {
  // Prerendered admin/rsvp pages already contain the matched route's output
  // in the server HTML. If we let React Router's `lazy` resolve after
  // `hydrateRoot` starts, the first client render suspends and the DOM is
  // wiped before the chunk arrives — visible as a flash plus a hydration
  // mismatch. Preloading here warms Vite's module cache so the same `lazy`
  // function below resolves synchronously from cache during hydration.
  const pathname = window.location.pathname
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    await import('./admin/AdminApp')
  } else if (pathname.startsWith('/rsvp/')) {
    await import('./routes/RsvpFull')
  }
  hydrateRoot(
    document.getElementById('root')!,
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )
}

bootstrap()

import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { setupServerCallback } from './rsc-client'
import './index.css'

setupServerCallback('/@rsc-admin/')

const router = createBrowserRouter([
  {
    path: '/admin/*',
    lazy: async () => ({
      Component: (await import('./admin/AdminApp')).AdminApp,
    }),
  },
])

async function bootstrap() {
  const pathname = window.location.pathname
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    await import('./admin/AdminApp')
  }
  hydrateRoot(
    document.getElementById('root')!,
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )
}

bootstrap()

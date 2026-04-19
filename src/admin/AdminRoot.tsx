'use client'

import { Route, Routes, StaticRouter } from 'react-router-dom'
import { AdminApp } from './AdminApp'

// Server-rendered admin entry: wraps AdminApp in a StaticRouter so the
// React Router tree (NavLink, Routes, Navigate) has a location to match
// against during SSG prerender and the hydration-time first render.
//
// The extra `<Route path="/admin/*">` parent mirrors the shape of the
// client router in main.tsx so AdminApp's inner relative `<Routes>` match
// the same way in both environments.
export function AdminRoot({ location }: { location: string }) {
  return (
    <StaticRouter location={location}>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
    </StaticRouter>
  )
}

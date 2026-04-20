import { setupServerCallback } from 'rsc-utils/functions/browser'
import { hydrateStaticPages } from 'rsc-utils/static-pages/client'

const backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8787'
setupServerCallback(`${backendUrl}/@rsc-public/`)

hydrateStaticPages()

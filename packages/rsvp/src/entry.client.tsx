import { setupNamespaceCallback } from 'rsc-utils/functions/namespace'
import { hydrateStaticPages } from 'rsc-utils/static-pages/client'

setupNamespaceCallback('admin')

hydrateStaticPages()

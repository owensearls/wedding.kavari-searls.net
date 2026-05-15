import { createFromReadableStream } from '@vitejs/plugin-rsc/browser'
import React, { type ReactNode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { rscStream } from 'rsc-html-stream/client'

type RscPayload = { root: ReactNode }

export function hydrateStaticPages(): void {
  const payload = createFromReadableStream<RscPayload>(rscStream)

  function Root() {
    return React.use(payload).root
  }

  hydrateRoot(document, React.createElement(Root))
}

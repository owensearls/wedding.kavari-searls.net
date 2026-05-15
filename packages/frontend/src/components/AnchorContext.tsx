import { createContext, useContext } from 'react'

export const AnchorContext = createContext<string>('')
export const useCurrentAnchor = () => useContext(AnchorContext)

import { configVirtualPlugin } from './config-virtual.js'
import { modulesVirtualPlugin } from './modules-virtual.js'
import type { Plugin } from 'vite'

export function rscFunctions(include: string[]): Plugin[] {
  return [configVirtualPlugin(), modulesVirtualPlugin(include)]
}

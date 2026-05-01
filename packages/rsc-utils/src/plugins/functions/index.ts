import { configVirtualPlugin } from './config-virtual.js'
import { modulesVirtualPlugin } from './modules-virtual.js'
import type { FunctionsConfig } from '../../types.js'
import type { Plugin } from 'vite'

export function rscFunctions(config: FunctionsConfig): Plugin[] {
  return [configVirtualPlugin(), modulesVirtualPlugin(config)]
}

import type { Plugin } from 'vite'
import type { FunctionsConfig } from '../../types.js'
import { modulesVirtualPlugin } from './modules-virtual.js'
import { stubGeneratorPlugin } from './stub-generator.js'

export function rscFunctions(config: FunctionsConfig): Plugin[] {
  return [modulesVirtualPlugin(config), stubGeneratorPlugin(config)]
}

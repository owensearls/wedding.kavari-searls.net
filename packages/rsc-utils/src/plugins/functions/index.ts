import { modulesVirtualPlugin } from './modules-virtual.js'
import { stubGeneratorPlugin } from './stub-generator.js'
import type { FunctionsConfig } from '../../types.js'
import type { Plugin } from 'vite'

export function rscFunctions(config: FunctionsConfig): Plugin[] {
  return [modulesVirtualPlugin(config), stubGeneratorPlugin(config)]
}

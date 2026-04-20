import type { Plugin } from 'vite'
import type { FunctionsConfig } from '../../types'
import { modulesVirtualPlugin } from './modules-virtual'
import { stubGeneratorPlugin } from './stub-generator'

export function rscFunctions(config: FunctionsConfig): Plugin[] {
  return [modulesVirtualPlugin(config), stubGeneratorPlugin(config)]
}

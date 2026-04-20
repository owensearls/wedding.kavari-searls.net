import { createSsgHandler } from 'rsc-utils/ssg'
import { Root } from './root'

export const { handleSsg } = createSsgHandler({ Root })

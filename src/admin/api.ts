import {
  listEvents,
  saveEvent,
  type AdminEventRecord,
} from '../server/admin/events'
import {
  listGroups,
  saveGroup,
  deleteGroup,
  getGroup,
} from '../server/admin/groups'
import { getGuest } from '../server/admin/guests'
import { importRows, type ImportResult } from '../server/admin/import'
import { listResponses } from '../server/admin/responses'

// Re-export under the names the existing admin UI expects.
export {
  listEvents,
  saveEvent,
  listGroups,
  saveGroup,
  deleteGroup,
  getGroup,
  getGuest,
  listResponses,
  importRows,
}
export type { AdminEventRecord, ImportResult }

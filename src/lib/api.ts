import { lookupGuests, getRsvpGroup, submitRsvp } from '../server/public/rsvp'
import type { RsvpSubmission } from '@shared/schemas/rsvp'

export function rsvpLookup(query: string) {
  return lookupGuests(query)
}

export function rsvpGroupGet(code: string) {
  return getRsvpGroup(code)
}

export function rsvpGroupSubmit(code: string, submission: RsvpSubmission) {
  return submitRsvp(code, submission)
}

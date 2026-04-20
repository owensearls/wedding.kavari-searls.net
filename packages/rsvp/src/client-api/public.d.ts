import type {
  LookupResponse,
  RsvpGroupResponse,
  RsvpSubmission,
} from 'schema/rsvp'

export declare function lookupGuests(query: string): Promise<LookupResponse>
export declare function getRsvpGroup(code: string): Promise<RsvpGroupResponse>
export declare function submitRsvp(
  code: string,
  submission: RsvpSubmission
): Promise<{ ok: true; respondedAt: string }>

export interface GuestTable {
  id: string
  party_leader_id: string | null
  first_name: string
  last_name: string | null
  display_name: string
  email: string | null
  phone: string | null
  invite_code: string | null
  group_label: string | null
  created_at: string
  updated_at: string
}

export interface EventTable {
  id: string
  name: string
  slug: string
  starts_at: string | null
  ends_at: string | null
  location_name: string | null
  address: string | null
  rsvp_deadline: string | null
  sort_order: number
  notes_schema: string | null
}

export interface InvitationTable {
  id: string
  guest_id: string
  event_id: string
}

export interface RsvpResponseTable {
  id: string
  guest_id: string
  event_id: string
  status: 'attending' | 'declined'
  notes_json: string | null
  responded_at: string
  responded_by_guest_id: string | null
}

export interface GuestResponseTable {
  id: string
  guest_id: string
  notes: string | null
  notes_json: string | null
  responded_at: string
  responded_by_guest_id: string | null
}

export interface Database {
  guest: GuestTable
  event: EventTable
  invitation: InvitationTable
  rsvp_response: RsvpResponseTable
  guest_response: GuestResponseTable
}

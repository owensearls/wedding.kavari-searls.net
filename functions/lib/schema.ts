// Kysely Database type — kept in sync by hand with migrations.
// Booleans and dates are stored as INTEGER (0/1) and TEXT (ISO strings) in
// SQLite, so we type them as `number` and `string` here.

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
  dietary_restrictions: string | null
  notes: string | null
  notes_json: string | null
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
  requires_meal_choice: number
  sort_order: number
}

export interface InvitationTable {
  id: string
  guest_id: string
  event_id: string
}

export interface MealOptionTable {
  id: string
  event_id: string
  label: string
  description: string | null
}

export interface RsvpTable {
  id: string
  guest_id: string
  event_id: string
  status: 'pending' | 'attending' | 'declined'
  meal_choice_id: string | null
  responded_at: string | null
  responded_by_guest_id: string | null
}

export interface Database {
  guest: GuestTable
  event: EventTable
  invitation: InvitationTable
  meal_option: MealOptionTable
  rsvp: RsvpTable
}

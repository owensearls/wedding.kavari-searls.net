// Kysely Database type — kept in sync by hand with migrations/0001_init.sql.
// Booleans and dates are stored as INTEGER (0/1) and TEXT (ISO strings) in
// SQLite, so we type them as `number` and `string` here.

export interface GuestGroupTable {
  id: string
  label: string
  invite_code: string
  primary_contact_guest_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface GuestTable {
  id: string
  guest_group_id: string
  first_name: string
  last_name: string | null
  display_name: string
  email: string | null
  phone: string | null
  age_group: 'adult' | 'child' | 'infant'
  is_plus_one: number
  dietary_restrictions: string | null
  notes: string | null
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
  guest_group_id: string
  event_id: string
}

export interface InvitationGuestTable {
  invitation_id: string
  guest_id: string
}

export interface MealOptionTable {
  id: string
  event_id: string
  label: string
  description: string | null
  is_child_meal: number
  is_vegetarian: number
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

export interface SongRequestTable {
  id: string
  guest_id: string
  title: string
  artist: string | null
  created_at: string
}

export interface Database {
  guest_group: GuestGroupTable
  guest: GuestTable
  event: EventTable
  invitation: InvitationTable
  invitation_guest: InvitationGuestTable
  meal_option: MealOptionTable
  rsvp: RsvpTable
  song_request: SongRequestTable
}

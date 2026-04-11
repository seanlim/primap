import type { Profile, WalkSlot, SlotMembership, Observation, Incident, SurveyRound, Sighting, Media } from './database'

// --- Compact relation refs used in Supabase join selects ---

export type ProfileRef = Pick<Profile, 'full_name' | 'email' | 'avatar_url'>
export type ProfileEmailRef = Pick<Profile, 'email'>
export type ProfileNameRef = Pick<Profile, 'full_name' | 'email'>

// --- Membership with nested profile (from user_id FK) ---

export type MembershipWithProfile = Pick<SlotMembership, 'id' | 'user_id' | 'status' | 'joined_at'> & {
  profiles: ProfileRef
}

// --- Walk with nested memberships and round ---

export type WalkWithMemberships = WalkSlot & {
  slot_memberships: MembershipWithProfile[]
  survey_rounds: Pick<SurveyRound, 'name' | 'status'>
}

// --- Membership with nested walk and round ---

export type WalkRef = Pick<WalkSlot, 'id' | 'location_name' | 'walk_date' | 'start_time' | 'end_time'> & {
  survey_rounds: Pick<SurveyRound, 'name'> | null
}

export type MembershipWithSlot = Pick<SlotMembership, 'id' | 'status'> & {
  walk_slots: WalkRef
}

// --- Observation with nested relations ---

export type SightingWithMedia = Omit<Sighting, 'observation_id' | 'created_at'> & {
  media: Pick<Media, 'id' | 'file_path' | 'file_name' | 'media_type'>[]
}

export type ObservationWithRelations = Observation & {
  profiles: ProfileNameRef
  sightings: SightingWithMedia[]
  media: Pick<Media, 'id' | 'file_path' | 'file_name' | 'media_type'>[]
}

// --- Incident with nested relations ---

export type IncidentWithRelations = Incident & {
  profiles: ProfileNameRef
  walk_slots: Pick<WalkSlot, 'location_name' | 'walk_date'>
}

// --- Walk with membership count (admin) ---

export type WalkWithCount = WalkSlot & {
  survey_rounds: Pick<SurveyRound, 'name' | 'status' | 'start_date' | 'end_date'>
  slot_memberships: { count: number }[]
}

// --- Round with slot count (admin) ---

export type RoundWithCount = SurveyRound & {
  walk_slots: { count: number }[]
}

// --- Profile page walk history observation ---

export type HistoryObservation = Pick<Observation, 'id' | 'slot_id' | 'status' | 'outcome'>

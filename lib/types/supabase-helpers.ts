import type { Profile, WalkSlot, SlotMembership, Observation, Incident, SurveyRound, Sighting, Media } from './database'

// --- Compact relation refs used in Supabase join selects ---

export type ProfileRef = Pick<Profile, 'full_name' | 'email' | 'avatar_url'>
export type ProfileEmailRef = Pick<Profile, 'email'>
export type ProfileNameRef = Pick<Profile, 'full_name' | 'email'>

// --- Membership with nested profile (from user_id FK) ---

export type MembershipWithProfile = Pick<SlotMembership, 'id' | 'user_id' | 'status' | 'joined_at'> & {
  profiles: ProfileRef
}

// --- Slot with nested memberships and round ---

export type SlotWithMemberships = WalkSlot & {
  slot_memberships: MembershipWithProfile[]
  survey_rounds: Pick<SurveyRound, 'name' | 'status'>
}

// --- Membership with nested slot and round ---

export type SlotRef = Pick<WalkSlot, 'id' | 'location_name' | 'walk_date' | 'start_time' | 'end_time'> & {
  survey_rounds: Pick<SurveyRound, 'name'> | null
}

export type MembershipWithSlot = Pick<SlotMembership, 'id' | 'status'> & {
  walk_slots: SlotRef
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

// --- Slot with membership count (admin) ---

export type SlotWithCount = WalkSlot & {
  survey_rounds: Pick<SurveyRound, 'name' | 'status'>
  slot_memberships: { count: number }[]
}

// --- Round with slot count (admin) ---

export type RoundWithCount = SurveyRound & {
  walk_slots: { count: number }[]
}

// --- Profile page walk history observation ---

export type HistoryObservation = Pick<Observation, 'slot_id' | 'status' | 'outcome'> & {
  sightings: { count: number }[]
}

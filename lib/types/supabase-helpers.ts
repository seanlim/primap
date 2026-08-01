import type { Profile, WalkSlot, SlotMembership, SlotInvitation, Observation, Incident, SurveyRound, Sighting, Media } from './database'

// --- Compact relation refs used in Supabase join selects ---

export type ProfileRef = Pick<Profile, 'full_name' | 'email' | 'avatar_url'>
export type ProfileEmailRef = Pick<Profile, 'email'>
export type ProfileNameRef = Pick<Profile, 'full_name' | 'email'>

// --- Membership with nested profile (from user_id FK) ---

export type MembershipWithProfile = Pick<SlotMembership, 'id' | 'user_id' | 'status' | 'joined_at'> & {
  profiles: ProfileRef
}

// --- Slot invitation with nested invitee/inviter profiles ---

export type SlotInvitationWithProfiles = Pick<
  SlotInvitation,
  'id' | 'slot_id' | 'invited_user_id' | 'invited_by' | 'status' | 'created_at' | 'responded_at'
> & {
  invitee: ProfileNameRef
  inviter: ProfileNameRef
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

// --- Walk with membership (admin) ---

export type WalkWithMembership = WalkSlot & {
  survey_rounds: Pick<SurveyRound, 'name' | 'status' | 'start_date' | 'end_date'>
  slot_memberships: {
    profiles: Pick<Profile, "id" | "full_name" | "email">;
    status: SlotMembership["status"];
    joined_at: string;
    cancelled_at: string | null;
  }[]
}

// --- Round with slot count (admin) ---

export type RoundWithCount = SurveyRound & {
  walk_slots: { count: number }[]
}

// --- Profile page walk history observation ---

export type HistoryObservation = Pick<Observation, 'id' | 'slot_id' | 'status' | 'outcome'>

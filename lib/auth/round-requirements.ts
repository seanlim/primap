import { requiresGuardianForRound } from './contact-profile'

export interface RoundRequirementProfileFields {
  birth_month: string | null
}

export interface RoundRequirementRoundFields {
  start_date: string
  end_date: string
  indemnity_form_url: string | null
}

export interface RoundRequirementFields {
  indemnity_acknowledged_at: string | null
  guardian_name: string | null
  guardian_email: string | null
  guardian_email_verified_at: string | null
  guardian_phone_number: string | null
  guardian_phone_verified_at: string | null
}

export type RoundRequirementMissingField =
  | 'indemnity_form_url'
  | 'indemnity_acknowledgement'
  | 'guardian_name'
  | 'guardian_email'
  | 'guardian_email_verified_at'
  | 'guardian_phone_number'
  | 'guardian_phone_verified_at'

export interface RoundRequirementStatus {
  requiresGuardian: boolean
  missingFields: RoundRequirementMissingField[]
  complete: boolean
}

export function getRoundRequirementMissingFields(
  profile: RoundRequirementProfileFields,
  round: RoundRequirementRoundFields,
  requirement: RoundRequirementFields | null
): RoundRequirementMissingField[] {
  const missing: RoundRequirementMissingField[] = []

  if (!round.indemnity_form_url && !requirement?.indemnity_acknowledged_at) {
    missing.push('indemnity_form_url')
  }
  if (!requirement?.indemnity_acknowledged_at) {
    missing.push('indemnity_acknowledgement')
  }

  if (requiresGuardianForRound(profile.birth_month, round)) {
    if (!requirement?.guardian_name) missing.push('guardian_name')
    if (!requirement?.guardian_email) missing.push('guardian_email')
    if (!requirement?.guardian_email_verified_at) missing.push('guardian_email_verified_at')
    if (!requirement?.guardian_phone_number) missing.push('guardian_phone_number')
    if (!requirement?.guardian_phone_verified_at) missing.push('guardian_phone_verified_at')
  }

  return missing
}

export function getRoundRequirementStatus(
  profile: RoundRequirementProfileFields,
  round: RoundRequirementRoundFields,
  requirement: RoundRequirementFields | null
): RoundRequirementStatus {
  const missingFields = getRoundRequirementMissingFields(profile, round, requirement)
  return {
    requiresGuardian: requiresGuardianForRound(profile.birth_month, round),
    missingFields,
    complete: missingFields.length === 0,
  }
}

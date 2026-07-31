
-- User roles
CREATE TYPE public.user_role AS ENUM ('ADMIN', 'VOLUNTEER');

-- User account status
CREATE TYPE public.user_status AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'DISABLED');

-- Survey round status
CREATE TYPE public.round_status AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- Slot membership status
CREATE TYPE public.membership_status AS ENUM ('ACTIVE', 'CANCELLED');

-- Observation report status
CREATE TYPE public.observation_status AS ENUM ('DRAFT', 'SUBMITTED');

-- Walk completion level
CREATE TYPE public.walk_completion AS ENUM ('COMPLETED', 'PARTIAL', 'ABORTED');

-- Observation outcome
CREATE TYPE public.observation_outcome AS ENUM ('SIGHTED', 'NOT_SIGHTED');

-- Species types tracked
CREATE TYPE public.species_type AS ENUM ('RBL', 'LTM', 'DUSKY');

-- Media file types
CREATE TYPE public.media_type AS ENUM ('PHOTO', 'VIDEO');

-- Incident types
CREATE TYPE public.incident_type AS ENUM ('INJURED_ANIMAL', 'DEAD_ANIMAL', 'HUMAN_WILDLIFE_CONFLICT', 'HABITAT_DAMAGE', 'OTHER');
;

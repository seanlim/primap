
-- Fix search_path for all functions to prevent search_path injection
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.enforce_slot_capacity() SET search_path = public;
ALTER FUNCTION public.enforce_observation_immutability() SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = public;
;

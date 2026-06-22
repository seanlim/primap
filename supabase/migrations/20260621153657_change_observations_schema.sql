DELETE FROM public.observations o1
WHERE o1.id NOT IN (
  SELECT DISTINCT ON (o2.slot_id) o2.id
  FROM public.observations o2
  ORDER BY o2.slot_id, o2.id
);

ALTER TABLE public.observations DROP COLUMN user_id;

ALTER TABLE public.observations
ADD CONSTRAINT observations_slot_id_unique UNIQUE (slot_id);


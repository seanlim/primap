DELETE FROM public.observations o1
WHERE o1.id NOT IN (
  SELECT MIN(o2.id)
  FROM public.observations o2
  GROUP BY o2.slot_id
);

ALTER TABLE public.observations DROP COLUMN 'user_id';
ALTER TABLE public.observations ADD COLUMN 'submitted_by';

ALTER TABLE public.observations
ADD CONSTRAINT observations_slot_id_unique UNIQUE (slot_id);


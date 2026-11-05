-- Attendance for a shared walk report.
--
-- The volunteer who submits the report (or any active member of the slot, or an
-- admin) marks who actually attended. Attendance is intentionally separate from
-- slot_memberships: membership records whether someone joined or cancelled, while
-- attendance records whether they showed up. A missing row means "not recorded",
-- which must stay distinct from an explicit ABSENT.

CREATE TYPE public.attendance_status AS ENUM ('PRESENT', 'ABSENT');

CREATE TABLE public.slot_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.walk_slots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL,
  marked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(slot_id, user_id)
);

CREATE INDEX slot_attendance_user_id_idx ON public.slot_attendance (user_id);

CREATE TRIGGER set_updated_at_slot_attendance
  BEFORE UPDATE ON public.slot_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.slot_attendance ENABLE ROW LEVEL SECURITY;

-- Viewers: the volunteer themself, any active member of the slot, or an admin.
CREATE POLICY "Users can view attendance for their slots"
  ON public.slot_attendance FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_active_slot_member(slot_id)
    OR public.is_admin()
  );

-- Active members of the slot can record attendance for any other active member.
-- Admins can always override. Cancelled volunteers are not markable.
CREATE POLICY "Slot members can record attendance"
  ON public.slot_attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    marked_by = auth.uid()
    AND (public.is_active_slot_member(slot_id) OR public.is_admin())
    AND EXISTS (
      SELECT 1
      FROM public.slot_memberships
      WHERE slot_memberships.slot_id = slot_attendance.slot_id
        AND slot_memberships.user_id = slot_attendance.user_id
        AND slot_memberships.status = 'ACTIVE'
    )
  );

CREATE POLICY "Slot members can update attendance"
  ON public.slot_attendance FOR UPDATE
  TO authenticated
  USING (public.is_active_slot_member(slot_id) OR public.is_admin())
  WITH CHECK (
    marked_by = auth.uid()
    AND (public.is_active_slot_member(slot_id) OR public.is_admin())
    AND EXISTS (
      SELECT 1
      FROM public.slot_memberships
      WHERE slot_memberships.slot_id = slot_attendance.slot_id
        AND slot_memberships.user_id = slot_attendance.user_id
        AND slot_memberships.status = 'ACTIVE'
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.slot_attendance TO authenticated;
GRANT ALL ON public.slot_attendance TO service_role;

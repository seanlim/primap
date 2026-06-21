
-- Drop the overly permissive self-update policy
DROP POLICY "Users can update own profile" ON profiles;

-- Recreate with column-level restriction via WITH CHECK
-- Users can only update their own row, and cannot change role or status
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())
    AND status = (SELECT p.status FROM profiles p WHERE p.id = auth.uid())
  );
;

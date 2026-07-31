
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('observation-media', 'observation-media', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']),
  ('incident-media', 'incident-media', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']);

-- Storage policies for observation-media
CREATE POLICY "Users can upload observation media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'observation-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view observation media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'observation-media');

CREATE POLICY "Users can delete own observation media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'observation-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policies for incident-media
CREATE POLICY "Users can upload incident media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'incident-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view incident media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'incident-media');

CREATE POLICY "Users can delete own incident media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'incident-media' AND (storage.foldername(name))[1] = auth.uid()::text);
;

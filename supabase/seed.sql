insert into public.app_settings (
  id,
  required_walks_per_round,
  late_cancel_hours,
  max_media_per_report,
  high_participation_threshold
)
values (
  '9b1fe76f-9b3b-42f0-acf9-a9e8e524f461',
  3,
  48,
  10,
  3
)
on conflict (id) do update
set required_walks_per_round = excluded.required_walks_per_round,
    late_cancel_hours = excluded.late_cancel_hours,
    max_media_per_report = excluded.max_media_per_report,
    high_participation_threshold = excluded.high_participation_threshold,
    updated_at = now();

insert into public.survey_rounds (
  id,
  name,
  description,
  start_date,
  end_date,
  status,
  created_by
)
values
  (
    '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3',
    'Round Alpha',
    'Open demo round for artifact evaluation.',
    current_date - 30,
    current_date + 90,
    'OPEN',
    null
  ),
  (
    'd2a7b401-b4ad-451f-9fcd-a09e6b89f267',
    'Round Beta',
    'Closed demo round with historical walk data.',
    current_date - 210,
    current_date - 120,
    'CLOSED',
    null
  )
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    status = excluded.status,
    created_by = excluded.created_by,
    updated_at = now();

insert into public.walk_slots (
  id,
  round_id,
  location_name,
  walk_date,
  start_time,
  end_time,
  max_volunteers
)
values
  (
    '66c5b9df-2d86-4b88-b0b8-41513c0fb5fa',
    '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3',
    'Lower Peirce Reservoir Park',
    current_date + 5,
    '07:00:00',
    '10:00:00',
    3
  ),
  (
    '3a78fc15-9661-42f7-82ad-44f61b3c64f9',
    '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3',
    'Thomson Nature Park',
    current_date + 2,
    '07:00:00',
    '10:00:00',
    3
  ),
  (
    'cd36b3b3-d954-44c5-8811-4e86f5a5eb36',
    '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3',
    'Upper Peirce Reservoir Park',
    current_date - 2,
    '07:00:00',
    '10:00:00',
    3
  ),
  (
    '709d6317-26f6-4a95-b410-9eda24ef1820',
    '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3',
    'Lower Peirce Reservoir Park',
    current_date - 14,
    '07:00:00',
    '10:00:00',
    3
  ),
  (
    '67900344-3562-4e0e-8abe-559355e9e3cb',
    '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3',
    'Thomson Nature Park',
    current_date - 21,
    '07:00:00',
    '10:00:00',
    3
  ),
  (
    '33104d62-71a1-4a28-ae5a-a98352fcf80d',
    'd2a7b401-b4ad-451f-9fcd-a09e6b89f267',
    'Rifle Range Nature Park',
    current_date - 140,
    '07:00:00',
    '10:00:00',
    3
  ),
  (
    '52ee3a01-2577-47bb-8136-8c8f4ccfde07',
    'd2a7b401-b4ad-451f-9fcd-a09e6b89f267',
    'Windsor Nature Park',
    current_date - 147,
    '07:00:00',
    '10:00:00',
    3
  )
on conflict (id) do update
set round_id = excluded.round_id,
    location_name = excluded.location_name,
    walk_date = excluded.walk_date,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    max_volunteers = excluded.max_volunteers,
    updated_at = now();

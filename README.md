# Primap

Primap is a web-based survey platform for the Raffles' Banded Langur Working Group (RBLWG). This README is written for the project artifact rubric: it focuses on how to install the submitted release, run it, and access the key user flows with minimal setup friction.

## Release Contents

This release includes:

- Source code via the tagged GitHub release
- This `README.md`
- Supabase schema and seed files in [`supabase/`](supabase)
- Supporting documents in [`documentation/`](documentation)
  - `Group 4 SRS.pdf`
  - `Group 4 SDS.pdf`
  - `Group 4 Test Report.pdf`
  - `Group 4 Intermediate Artifact.pdf`
  - `Group 4 Final Report.pdf`

## Prerequisites

- `Node.js 20+`
- `npm`
- `Supabase CLI`
- A `Mapbox` access token
- Optional: `Resend` API key for email delivery

## Setup

### 1. Install dependencies

```bash
git clone https://github.com/seanlim/primap.git
cd primap
npm install
```

### 2. Start Supabase locally

```bash
supabase start
supabase db reset
```

This applies the committed schema in [`supabase/migrations/`](supabase/migrations) and the base seed in [`supabase/seed.sql`](supabase/seed.sql).

### 3. Create demo auth users

Open Supabase Studio and create these users in `Authentication -> Users`:

- `admin@primap.demo`
- `alice@primap.demo`
- `bob@primap.demo`
- `emily@primap.demo`

Set simple passwords for local testing and mark the emails as confirmed.

### 4. Run the post-auth demo seed

After the demo auth users exist, open the SQL Editor in Supabase Studio and run the contents of [`supabase/seed.after_auth.sql`](supabase/seed.after_auth.sql).

This script:

- assigns `admin@primap.demo` the `ADMIN` role
- leaves `alice@primap.demo` and `bob@primap.demo` as active volunteers
- keeps `emily@primap.demo` as a `PENDING` volunteer for the approval flow
- inserts demo memberships, reports, sightings, and an incident

### 5. Create `.env.local`

Copy `.env.example` to `.env.local`.

For local Supabase, fill in the project URL and keys from the `supabase start` output, then add your Mapbox token.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_MAPBOX_TOKEN=
RESEND_API_KEY=
RESEND_FROM_EMAIL=Primap <no-reply@primap.org>
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=
```

### 6. Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

Optional checks:

```bash
npm run lint
npm test
npm run test:coverage
```

## Demo Accounts

Use the accounts you created in Supabase Auth:

- `admin@primap.demo` for admin flows
- `alice@primap.demo` for volunteer reporting flows
- `bob@primap.demo` for another volunteer account
- `emily@primap.demo` for pending-user approval flow

## Minimal User Flows

### Volunteer flow

1. Open `/login`.
2. Sign in as `alice@primap.demo`.
3. Open `/walk` and view the upcoming walk slots.
4. Open `/report` and select the seeded draft walk report.
5. Edit the draft report, then save or submit it.
6. Open the submitted group report to review existing sightings.
7. Optionally create a new incident from the walk report page.

### Admin flow

1. Sign in as `admin@primap.demo`.
2. Open `/admin`.
3. Open `/admin/users` and verify that `emily@primap.demo` appears as `PENDING`.
4. Open `/admin/reports` to review the seeded submitted reports.
5. Open `/admin/incidents` to review the seeded incident.
6. Open `/admin/rounds` and `/admin/walks` to inspect the seeded schedule data.
7. Open `/admin/data` to access export and import features.

### Pending-user flow

1. Sign in as `emily@primap.demo`.
2. Confirm that the app routes the user to the pending-access flow.
3. Approve the user from `/admin/users` while signed in as `admin@primap.demo`.
4. Sign in again as `emily@primap.demo` and verify access after approval.

## Key Routes

- `/login` for authentication
- `/walk` for volunteer walk sign-up
- `/report` for volunteer reporting
- `/admin` for admin features
- `/admin/users` for user approval and role management
- `/admin/rounds` for survey-round management
- `/admin/walks` for walk-slot management
- `/admin/reports` for report review
- `/admin/incidents` for incident review
- `/admin/data` for data export and import

## Verification

After setup, a mentor should be able to confirm the project is working with these quick checks:

- open `http://localhost:3000` and reach the login page
- sign in as `admin@primap.demo` and open `/admin`
- sign in as `alice@primap.demo` and see upcoming slots in `/walk`
- open `/report` as `alice@primap.demo` and access the seeded draft report
- open `/admin/reports` and view the seeded submitted reports
- open `/admin/incidents` and view the seeded incident
- open `/admin/users` and confirm `emily@primap.demo` is pending

## Notes for Evaluators

- The schema, RLS policies, Supabase functions, storage buckets, and base seed data are included in the repository.
- The only manual backend step is creating the demo auth users before running [`supabase/seed.after_auth.sql`](supabase/seed.after_auth.sql).
- Seeded report and incident data intentionally do not include fake storage objects, so media upload flows should be tested by uploading fresh files during evaluation.
- Map features require `NEXT_PUBLIC_MAPBOX_TOKEN`.
- Email features require `RESEND_API_KEY`.

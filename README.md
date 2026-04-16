# Primap

Primap is a web-based survey platform for the Raffles' Banded Langur Working Group (RBLWG).

## Release Contents

This release includes:

- Source code via the tagged GitHub release
- This `README.md`
- Supporting documents in [`documentation/`](documentation)
  - `Group 4 SRS.pdf`
  - `Group 4 SDS.pdf`
  - `Group 4 Test Report.pdf`
  - `Group 4 Intermediate Artifact.pdf`

## Environment

This project runs against a preconfigured shared Supabase backend.

Use the following Supabase values provided separately with the submission:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Demo account credentials are also provided separately.

## Prerequisites

- `Node.js 20+`
- `npm`
- A `Mapbox` access token
- Optional: `Resend` API key for email delivery

## Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/seanlim/primap.git
cd primap
npm install
```

### 2. Create `.env.local`

Copy `.env.example` to `.env.local`, then fill in the values below.

Use the Supabase values provided with the submission for:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Use your own Mapbox token unless one is also provided for evaluation.
If email delivery is not being tested, `RESEND_API_KEY` can be left blank.
Set `NEXT_PUBLIC_APP_URL` to `http://localhost:3000`.
`CRON_SECRET` can be any non-empty string unless the cron/reminder route is being tested.

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

### 3. Start the app

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

Use the provided demo credentials:

- `admin@primap.demo`
- `alice@primap.demo`
- `bob@primap.demo`
- `emily@primap.demo`

`admin@primap.demo` is the admin account.
`emily@primap.demo` is the pending-user account for the approval flow.

## Minimal User Flows

### Volunteer flow

1. Open `/login`.
2. Sign in as `alice@primap.demo`.
3. Open `/walk` and view available walk slots.
4. Open `/report` and access the existing seeded report data for the demo account.
5. Edit a draft report, then save or submit it.
6. Open the submitted group report and review the seeded sightings.
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

After setup, use these quick checks to confirm the project is working:

- open `http://localhost:3000` and reach the login page
- sign in as `admin@primap.demo` and open `/admin`
- sign in as `alice@primap.demo` and see walk slots in `/walk`
- open `/report` as `alice@primap.demo` and access seeded report data
- open `/admin/reports` and view the seeded submitted reports
- open `/admin/incidents` and view the seeded incident
- open `/admin/users` and confirm `emily@primap.demo` is pending

Optional additional checks:

- edit and save or submit a volunteer draft report
- upload fresh media to verify media upload flows
- approve `emily@primap.demo` from `/admin/users` and verify access after approval
- run `npm run lint`, `npm test`, or `npm run test:coverage`

## Notes

- This project is intended to run against a pre-seeded shared Supabase backend.
- The required Supabase environment values and demo credentials are provided separately in the handoff note.
- The shared backend already contains the required schema, data, and deployed backend functionality used by the app.
- The shared backend already includes report, incident, and media data. You may also upload fresh files during testing if you want to verify media upload flows directly.
- Map features require `NEXT_PUBLIC_MAPBOX_TOKEN`.
- Email features require `RESEND_API_KEY` only if email delivery itself is being evaluated.

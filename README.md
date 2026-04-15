# Primap

Primap is a web-based survey platform for the Raffles' Banded Langur Working Group (RBLWG). This README is written for the project artifact rubric: it focuses on how to set up the submitted release, run it, and access the main user flows quickly.

## Release Contents

This release includes:

- Source code via the tagged GitHub release
- This `README.md`
- Supporting documents in [`documentation/`](documentation)
  - `Group 4 SRS.pdf`
  - `Group 4 SDS.pdf`
  - `Group 4 Test Report.pdf`
  - `Group 4 Intermediate Artifact.pdf`
  - `Group 4 Final Report.pdf`

## Prerequisites

- `Node.js 20+`
- `npm`
- A prepared `Supabase` project
- A `Mapbox` access token
- Optional: `Resend` API key for email delivery

## Setup

### 1. Install dependencies

```bash
git clone <your-repository-url>
cd primap
npm install
```

### 2. Create `.env.local`

Copy `.env.example` to `.env.local` and provide values for:

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

### 3. Prepare Supabase

This project expects an existing Supabase setup with:

- the application schema already created
- storage buckets named `observation-media` and `incident-media`
- at least one `ADMIN` user
- at least one normal volunteer user
- at least one open survey round with walk slots, if you want to test the full volunteer and admin flows

Note: `supabase/config.toml` references `supabase/seed.sql`, but that file is not included in this repository. Because of that, this release is easiest to run against a prepared Supabase project instead of a fresh local bootstrap.

### 4. Minimum backend setup

Before testing the main flows, make sure the backend has at least:

- one user whose profile role is `ADMIN`
- one normal volunteer user
- one open survey round
- one walk slot inside that open round

Also create these Supabase Storage buckets:

- `observation-media`
- `incident-media`

Without this minimum data, the application can start, but the main volunteer and admin flows will not be fully testable.

## Running the Project

Start the app with:

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

## Minimal User Flows

### Volunteer flow

1. Open `/login`.
2. Sign in as a volunteer, or create an account.
3. If the new account is pending, approve it through an admin account first.
4. Open `/walk` and join an available walk slot.
5. Open `/report` and select the joined walk.
6. Create or edit an observation report.
7. Fill in the required location and species details.
8. Optionally upload media.
9. Submit the report.
10. Optionally submit an incident from the walk report page.

### Admin flow

1. Sign in as a user with role `ADMIN`.
2. Open `/admin`.
3. Open `/admin/users` to approve users or manage roles.
4. Open `/admin/rounds` and `/admin/walks` to manage survey scheduling data.
5. Open `/admin/reports` to review submitted reports.
6. Open `/admin/incidents` to review incident submissions.
7. Open `/admin/data` for export and import features.

### Offline reporting flow

1. Sign in using a Chromium-based browser.
2. Join a walk from `/walk`.
3. Open the reporting flow for that walk.
4. Disconnect from the network.
5. Save a draft observation.
6. Reconnect to the network.
7. Reopen the app and allow the pending draft to sync.

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
- sign in as an admin and open `/admin` successfully
- sign in as a volunteer and see available slots in `/walk`
- join a walk and see it appear in `/report`
- open the joined walk report, save or submit an observation, and return to the report view
- as an admin, open `/admin/reports` and view submitted reports

## Notes for Evaluators

- The fastest way to reproduce this project is with a prepared Supabase project rather than a blank local Supabase instance.
- If the database is empty, the app can still load, but the main grading flows will not be fully demonstrable.
- Map features require `NEXT_PUBLIC_MAPBOX_TOKEN`.
- Email features require `RESEND_API_KEY`.

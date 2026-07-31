# Primap

Primap is a web-based survey platform for the Raffles' Banded Langur Working Group (RBLWG).

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

### 1. Clone the repository and install dependencies

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

Additional setup notes:

- Use your own Mapbox token unless one is also provided for evaluation.
- If email delivery is not being tested, `RESEND_API_KEY` can be left blank.
- Set `NEXT_PUBLIC_APP_URL` to `http://localhost:3000`.
- `CRON_SECRET` can be any non-empty string unless the cron reminder route is being tested.

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

### 3. Start the application

```bash
npm run dev
```

Then open `http://localhost:3000`.

Optional checks:

```bash
npm run lint
npm test
npm run test:coverage
```

## Local Development

### Prerequisites

- Docker Desktop (must be running)

### 1. Link to remote Supabase

Link local Supabase CLI to Supabase account
```bash
npx supabase login
```

Link local Supabase project to remote Supabase project
```bash
npx supabase link
```

### 2. Start a local Supabase instance


```bash
npx supabase start
```

This starts the local Supabase stack in Docker, applies all migrations in `supabase/migrations`, and loads seeded data from `supabase/seed.sql`.

### 3. Modify `.env.local` to connect to local Supabase instance

`NEXT_PUBLIC_SUPABASE_URL`,  `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Go to [Studio](http://localhost:54323/project/default?showConnect=true) -> App Frameworks -> Next.js

`SUPABASE_SERVICE_ROLE_KEY`: In the output that appears after `npx supabase start`, copy the key under `Authentication Keys` -> `Secret`

### 4. Making DB changes

> For more details: [Local development with schema migrations | Supabase Docs](https://supabase.com/docs/guides/local-development/overview)

You can make changes to your local Supabase instance directly using the table editor, then run this to capture the changes in a new migration file

```bash
npx supabase db diff -f <migration_name>
```

### 5. Configuring Google sign-in provider for local Supabase instance

Go to [Google Auth Platform console](https://console.cloud.google.com/auth/overview). 

If you have not already created a project, click `Create project`. After creating project, click `Get started` and complete the configuration.

In the Auth Platform, go to `Clients` -> `Create client`.
- Under `Application type`, select `Web application`
- Change the name of the application
- Under `Authorized JavaScript origins`, include the following URIs:
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`
- Under `Authorized redirect URIs`, include the following URIs:
  - `http://localhost:54321/auth/v1/callback`
  - `http://127.0.0.1:54321/auth/v1/callback`

Upon client creation, you will receive a client ID and client secret. Use them to configure `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` in `.env.local` respectively.

## Demo Accounts

Use the provided demo credentials for the following accounts:

- `admin@primap.demo`
- `alice@primap.demo`
- `bob@primap.demo`
- `emily@primap.demo`

Account roles:

- `admin@primap.demo` is the administrator account
- `emily@primap.demo` is the pending-user account for the approval flow

## Minimal User Flows

These steps assume the shared backend and demo credentials provided with the submission.

### Volunteer flow

1. Open the login page (`/login`).
2. Sign in as `alice@primap.demo`.
3. Open the volunteer walk page (`/walk`) and view the available walk slots.
4. Open the reporting page (`/report`) and access the existing seeded report data for the demo account.
5. Edit a draft report, then save or submit it.
6. Open a submitted group report and review the seeded sightings.
7. Optionally create a new incident from the walk report page.

### Admin flow

1. Open the login page (`/login`) and sign in as `admin@primap.demo`.
2. Open the admin dashboard (`/admin`).
3. Open the admin users page (`/admin/users`) and verify that `emily@primap.demo` appears as `PENDING`.
4. Open the admin reports page (`/admin/reports`) to review the seeded submitted reports.
5. Open the admin incidents page (`/admin/incidents`) to review the seeded incident.
6. Open the survey rounds page (`/admin/rounds`) and walk management page and select round to inspect the seeded schedule data for the round.
7. Open the data management page (`/admin/data`) to access export and import features.

### Pending-user flow

1. Open the login page (`/login`) and sign in as `emily@primap.demo`.
2. Confirm that the application routes the user to the pending-access flow.
3. While signed in as `admin@primap.demo`, open the admin users page (`/admin/users`) and approve `emily@primap.demo`.
4. Sign in again as `emily@primap.demo` and verify that access is granted after approval.

## Key Routes

- `/login` for authentication
- `/walk` for volunteer walk sign-up
- `/report` for volunteer reporting
- `/admin` for admin features
- `/admin/users` for user approval and role management
- `/admin/rounds` for survey-round management and walk management
- `/admin/reports` for report review
- `/admin/incidents` for incident review
- `/admin/data` for data export and import

## Verification

After setup, use these quick checks to confirm that the project is working:

- Open `http://localhost:3000` and confirm that the login page loads.
- Sign in as `admin@primap.demo` and confirm that the admin dashboard (`/admin`) is accessible.
- Sign in as `alice@primap.demo` and confirm that walk slots are visible on the volunteer walk page (`/walk`).
- Open the reporting page (`/report`) as `alice@primap.demo` and confirm that seeded report data is available.
- Open the admin reports page (`/admin/reports`) and confirm that the seeded submitted reports are visible.
- Open the admin incidents page (`/admin/incidents`) and confirm that the seeded incident is visible.
- Open the admin users page (`/admin/users`) and confirm that `emily@primap.demo` appears as a pending user.

Optional additional checks:

- Edit and save or submit a volunteer draft report.
- Upload fresh media to verify media upload flows.
- Approve `emily@primap.demo` from `/admin/users` and verify access after approval.
- Run `npm run lint`, `npm test`, or `npm run test:coverage`.

## Notes

- This project is intended to run against a pre-seeded shared Supabase backend.
- The required Supabase environment values and demo credentials are provided separately in the handoff note.
- The shared backend already contains the required schema, seeded data, and deployed backend functionality used by the application.
- The shared backend already includes report, incident, and media data. Fresh uploads may also be performed during testing if media upload flows are being evaluated directly.
- Map features require `NEXT_PUBLIC_MAPBOX_TOKEN`.
- Email features require `RESEND_API_KEY` only if email delivery itself is being evaluated.

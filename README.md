# Primap

Primap is a web-based survey platform for the Raffles' Banded Langur Working Group (RBLWG). It replaces spreadsheet-heavy wildlife survey workflows with a mobile-friendly system for volunteer sign-ups, field reporting, incident submission, and admin-side coordination and export.

This repository was developed for `CS3213 Foundations of Software Engineering` at the National University of Singapore.

## Release Contents

This release contains:

- Source code for the submitted version, via the tagged GitHub release
- This `README.md`, which documents installation, configuration, running the project, and the shortest paths to the main user flows
- Supporting project documents in [`documentation/`](documentation)
  - `Group 4 SRS.pdf`
  - `Group 4 SDS.pdf`
  - `Group 4 Test Report.pdf`
  - `Group 4 Intermediate Artifact.pdf`
  - `Group 4 Final Report.pdf`

## Key Features

### Volunteer-facing

- Email/password and Google sign-in
- Walk discovery and sign-up for open survey rounds
- Observation reporting with mandatory location and species details
- Offline-capable draft reporting with later sync
- Media upload for observations
- Incident reporting during walks
- Personal profile and participation tracking

### Admin-facing

- Dashboard with participation and reporting analytics
- User approval and role management
- Round and walk-slot management
- Incident review
- Submitted report review and direct admin edits
- Data export and import, including legacy spreadsheet import
- Reminder email trigger endpoint

## Tech Stack

- `Next.js 16` with App Router
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `Supabase` for auth, database, storage, and edge functions
- `Vitest` and Testing Library for automated tests
- `Mapbox` for map-based location workflows
- `Resend` for email delivery

## Prerequisites

Install the following before setup:

- `Node.js 20+` recommended
- `npm`
- A `Supabase` project
- A `Mapbox` access token
- Optional: a `Resend` API key for email delivery

## Quick Start

### 1. Clone and install dependencies

```bash
git clone <your-repository-url>
cd primap
npm install
```

### 2. Create environment variables

Copy `.env.example` to `.env.local` and fill in the values.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=

# Resend Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=Primap <no-reply@primap.org>

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=
```

### 3. Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser-accessible Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser-accessible anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for admin APIs | Used by privileged server-side admin routes |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Yes for map workflows | Enables map rendering and location selection |
| `RESEND_API_KEY` | Optional | Enables outgoing emails |
| `RESEND_FROM_EMAIL` | Optional | Sender identity for email notifications |
| `NEXT_PUBLIC_APP_URL` | Yes | Base URL used in generated links and emails |
| `CRON_SECRET` | Optional but recommended | Protects the reminder cron endpoint |

## Running the Project

### Development server

```bash
npm run dev
```

### Production build

```bash
npm run build
npm run start
```

### Quality checks

```bash
npm run lint
npm test
npm run test:coverage
```

## Supabase Setup Notes

This project is wired to Supabase for:

- authentication
- relational data
- storage buckets
- admin-side privileged operations
- an edge function at `supabase/functions/bulk-create-walks`

The repository includes a `supabase/config.toml`, but it does not currently include committed migration files or a checked-in `supabase/seed.sql`, even though the config references one. Because of that, this release is easiest to run against a prepared Supabase project rather than as a fully self-contained local Supabase bootstrap.

For evaluators or mentors, the fastest path is:

1. Create a Supabase project.
2. Configure the environment variables in `.env.local`.
3. Ensure the expected database schema and storage buckets exist.
4. Ensure at least one admin user and one normal user are available for testing.

### Expected storage buckets

The app references these Supabase Storage buckets:

- `observation-media`
- `incident-media`

### Important operational assumption

Several admin features depend on the application having data already present:

- at least one open survey round
- walk slots inside that round
- users with statuses such as `PENDING` and `ACTIVE`
- at least one user with the `ADMIN` role

If your database is empty, the UI will still run, but some key grading flows will not be demonstrable until those records are created.

## Minimal Evaluator Guide

These are the shortest paths to the main flows a mentor or grader is likely to verify.

### Volunteer flow

1. Open `/login`.
2. Sign up with email/password or sign in with an existing volunteer account.
3. If using a newly created account, approve it from an admin account first if your setup enforces the pending approval flow.
4. Visit `/walk` to view available walk slots.
5. Open a walk detail page and join a slot.
6. Visit `/report` and open the joined walk.
7. Create or edit an observation report.
8. Add location and species information.
9. Optionally attach observation media.
10. Submit the report.
11. Optionally submit an incident from the walk report view.

### Admin flow

1. Sign in as a user whose profile role is `ADMIN`.
2. Open `/admin`.
3. Visit `/admin/users` to approve pending users, promote/demote roles, or disable users.
4. Visit `/admin/rounds` to manage survey rounds.
5. Visit `/admin/walks` to inspect or manage walk slots.
6. Visit `/admin/reports` to review submitted reports.
7. Visit `/admin/incidents` to review incident submissions.
8. Visit `/admin/data` to access export/import features.
9. Visit `/admin/settings` for system configuration.

### Offline reporting flow

1. Sign in on a Chromium-based browser.
2. Join a walk.
3. Open the reporting flow for that walk.
4. Disconnect the browser from the network.
5. Save a draft observation locally.
6. Reconnect to the network.
7. Reopen the app and allow pending data to sync.

## Entry Points

Useful routes for reviewers:

| Route | Purpose |
| --- | --- |
| `/login` | Authentication entry point |
| `/home` | Logged-in landing page |
| `/walk` | Volunteer walk discovery and sign-up |
| `/report` | Volunteer reporting overview |
| `/profile` | Volunteer profile |
| `/guidance` | Reporting and usage guidance |
| `/admin` | Admin dashboard |
| `/admin/users` | User approval and role management |
| `/admin/rounds` | Survey-round management |
| `/admin/walks` | Walk-slot management |
| `/admin/reports` | Report review |
| `/admin/incidents` | Incident review |
| `/admin/data` | Data import/export |
| `/admin/settings` | System settings |

## Testing

The project includes unit, component, and integration-style tests under [`tests/`](tests).

Run the full suite with:

```bash
npm test
```

Generate coverage with:

```bash
npm run test:coverage
```

## Project Structure

| Path | Purpose |
| --- | --- |
| [`app/`](app) | Next.js routes, pages, API routes, and layouts |
| [`components/`](components) | Shared UI and page-level components |
| [`lib/`](lib) | Business logic, Supabase clients, utilities, offline helpers, and actions |
| [`tests/`](tests) | Automated tests |
| [`scripts/`](scripts) | Utility scripts used during development and data preparation |
| [`supabase/`](supabase) | Supabase config and edge-function source |
| [`documentation/`](documentation) | Supporting project artifacts and reports |

## Known Limitations

- This release depends on an already prepared Supabase schema and data model.
- `supabase/config.toml` references `supabase/seed.sql`, but that file is not included in the repository.
- Email features require a valid `RESEND_API_KEY`.
- Map workflows require a valid `NEXT_PUBLIC_MAPBOX_TOKEN`.
- Offline behavior is best exercised in Chromium-based browsers.

## Contributors

- Nicholas Tang Boon Keat
- Lim Kai Xiang Sean
- Kim Jae Hyeok
- Ha Jiwoon

## Suggested GitHub Release Notes

Use the following as the body of the GitHub Release for the submitted version.

```md
## Primap Release

This release contains the submitted version of Primap, a web platform for coordinating primate survey walks, volunteer reporting, incident logging, and admin-side data management.

### Included in this release

- Source code via this tagged release
- Setup and run instructions in the repository README
- Supporting documentation in the `documentation/` folder:
  - Group 4 SRS.pdf
  - Group 4 SDS.pdf
  - Group 4 Test Report.pdf
  - Group 4 Intermediate Artifact.pdf

### Quick start

1. Clone the repository and run `npm install`
2. Create `.env.local` from `.env.example`
3. Configure Supabase, Mapbox, and optional Resend credentials
4. Run `npm run dev`
5. Open `http://localhost:3000`

### Key routes

- `/login` for authentication
- `/walk` for volunteer sign-up
- `/report` for volunteer reporting
- `/admin` for admin features

### Notes for evaluators

- The app expects a prepared Supabase project, including the required schema, storage buckets, and at least one admin user.
- The repository includes supporting PDFs in `documentation/`.
- See the README for installation, running instructions, and minimal user-flow steps.
```

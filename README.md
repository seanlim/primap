# Primap 🐒📍

**Primap** is a web-based citizen-science platform designed to streamline primate survey walks in Singapore. Built for the **Raffles’ Banded Langur Working Group (RBLWG)**, it replaces manual spreadsheet workflows with a mobile-first, offline-capable solution for reporting observations of critically endangered species.

---

## 🚀 Features

### For Volunteers

* **Account Management:** Self-registration and profile tracking.
* **Survey Sign-ups:** View available walk slots and join groups (max 3 per slot).
* **Offline Reporting:** Create and save observation drafts in the field without internet; sync later.
* **Smart Data Capture:** Mandatory GPS location, primate counts, and behavior notes.
* **Media Uploads:** Attach up to 10 photos/videos per observation.
* **Incident Reporting:** Flag urgent issues like traps, feeding, or roadkill for immediate admin attention.

### For Administrators

* **Dashboard:** Monitor volunteer participation and survey statistics.
* **Bulk Scheduling:** Create months of walk slots based on recurring rules in seconds.
* **Approval System:** Moderate and approve new volunteer accounts.
* **Data Portability:** Full export/import capabilities (CSV/Spreadsheet) for scientific analysis and legacy data migration.

---

## 🛠 Tech Stack

* **Framework:** [Next.js](https://nextjs.org/) (App Router)
* **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL + GoTrue)
* **Storage:** Supabase Storage (for primate media and incident photos)
* **Styling:** Tailwind CSS
* **Offline Support:** Service Workers / PWA capabilities (Chrome optimized)
* **Maps:** Leaflet / Mapbox (for GPS pinning and visualization)

---

## 📦 Getting Started

### Prerequisites

* Node.js (v18+)
* A Supabase account and project

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/your-username/primap.git
cd primap

```


2. **Install dependencies:**
```bash
npm install

```


3. **Environment Setup:**
Create a `.env.local` file in the root directory and add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

```


4. **Run the development server:**
```bash
npm run dev

```


Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) in **Google Chrome** to see the application.

---

## 🔐 Data & Privacy

Primap is designed with conservation in mind:

* **Location Masking:** Observation locations are hidden during active survey rounds to protect wildlife from disturbance.
* **PDPA Compliant:** Volunteer data is restricted to authorized administrators.
* **Immutable Records:** Once submitted, observations cannot be edited to ensure data integrity for research.

---

## 👥 Contributors (Group 4)

This project was developed for **CS3213 Foundations of Software Engineering** at the **National University of Singapore**.

* **Nicholas Tang Boon Keat**
* **Lim Kai Xiang Sean**
* **Kim Jae Hyeok**
* **Ha Jiwoon**

---

## 📄 References

* [Citizen Science Program for Critically Endangered Primates (Ang, A. et al. 2020)](https://www.google.com/search?q=http://static1.1.sqspcdn.com/static/f/1200343/28485746/1638300722537/PC35_Ang_et_al_Citizen_science.pdf)
* [Langur Survey Workshop Reference](https://www.youtube.com/watch?v=sl5x6ASDs0g)

---

*Note: This application is optimized for Google Chrome.*

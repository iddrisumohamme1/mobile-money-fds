# Mobile Money Fraud Operations Platform

A real-time, human-in-the-loop command center for risk analysts and compliance officers. This application translates machine learning inference outputs into intuitive, sub-second visual alerts and actionable triage workflows for mobile money transactions.

## Features

- **Zero-Polling Realtime Feed**: Live transaction streaming via Supabase WebSockets.
- **3-Tier Automated Triage**: Color-coded categorization for Approved (<30% risk), Review (30-75% risk), and Hard Block (≥75% risk).
- **Risk & Behavioral Feature Inspector**: Granular diagnostic drawer displaying a behavioral feature matrix, radial fraud probability gauges, and highlight triggers for velocity/balance anomalies.
- **Analyst Action Panel**: Role-gated controls (Risk Manager / Analyst) allowing one-click safe overrides, fraud confirmation, or step-up MFA challenge triggers, all securely audited with mandatory reason codes.
- **Compliance Analytics**: Recharts-powered interactive visualizations for fraud attempt trends, feature importance weights, and exportable CSV audit logs.
- **Premium Dark Mode UI**: Built with Tailwind CSS for extended analyst monitoring sessions, featuring micro-animations, shimmer loading, and glassmorphism.

## Tech Stack

- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS v3
- **Routing**: React Router v6
- **Icons**: Lucide React
- **Charting**: Recharts
- **Data & Auth**: Supabase JS Client
- **Dates**: date-fns
- **Backend inference**: FastAPI + scikit-learn (Random Forest)

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- NPM or Yarn
- Python 3.11+ (for the backend service)
- Supabase account (project credentials)

### Installation

1. Clone the repository or navigate to the project directory:
   ```bash
   cd mobile-money-fds
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the root directory with the following variables (`.env` is gitignored — never commit it):

   ```env
   # Supabase project settings -> API
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

   # FastAPI fraud engine (see backend/). Local default:
   VITE_FRAUD_API_URL=http://127.0.0.1:8000
   ```

   *(Note: If the Supabase credentials are missing or the connection drops, the app will gracefully fall back to a built-in Mock Simulation Engine that generates live, realistic transactions.)*

4. Install backend dependencies (optional, for local inference):
   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```

5. Start the frontend development server:
   ```bash
   npm run dev
   ```

6. Open your browser to `http://localhost:5173`.

## Roles & Access Control

Access is strictly managed via Supabase Auth. The interface dynamically adapts based on the logged-in user's role (`user_metadata.role`):

- **analyst** (Tier 1 — Fraud Analyst): Monitors real-time streams and reviews medium-risk triggers.
- **risk_manager** (Tier 2 — Risk Manager): Can issue manual overrides (Mark Safe / Confirm Fraud) and export compliance logs.
- **admin** (System Admin): Platform management and configuration (user lifecycle via the `admin-users` Edge Function).

If the Supabase env vars are missing (e.g. `.env` not configured), the app auto-signs in a mock `Risk Manager` session and runs the built-in simulation engine so the UI is fully explorable offline.

## Backend Service

`backend/` is a FastAPI fraud inference service that powers real-time risk scoring:

- **Trained model**: `backend/model/random_forest_smote_engineered_features.joblib` (scikit-learn 1.9.0, SMOTE + engineered features).
- **FeatureStore** (`app/services/feature_store.py`): per-sender in-memory sliding-window behavioral features (velocity, amount statistics, z-scores) — a drop-in path to Redis when scaling out.
- **Decision engine** (`app/decision_engine.py`): fuses a heuristic score with the model's probability and maps it to the 3-tier triage.
- **Endpoints**: `GET /health`, `POST /api/v1/predict`.

### Run the backend locally

```bash
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Optional backend env vars:

```env
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
FRAUD_MODEL_BLEND_WEIGHT=0.5
FRAUD_MODEL_PATH=model/random_forest_smote_engineered_features.joblib
```

### Example backend request

```bash
curl -X POST http://127.0.0.1:8000/api/v1/predict \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_reference": "TX-90482910",
    "sender_phone": "+233241234567",
    "recipient_phone": "+233509876543",
    "amount": 4500.00,
    "currency": "GHS"
  }'
```

## Supabase (data, auth & security)

- **Migrations** in `supabase/migrations/`: base schema, RLS policies, audit tables (`analyst_actions`, `admin_actions`), and a pg_cron retention purge of `transactions` older than 7 days. Apply pending ones with `supabase db push`.
- **Edge Functions** in `supabase/functions/` (Deno, use `SERVICE_ROLE_KEY` server-side):
  - `analyst-actions` — `override_safe` / `confirm_fraud` / `trigger_mfa`, restricted to `risk_manager` / `admin`; updates the transaction and writes an `analyst_actions` audit row.
  - `admin-users` — user lifecycle (list / create / invite / update_role / disable / enable / delete / reset_password), admin-only, every action logged to `admin_actions`.
- **RLS**: realtime feed reads/writes require an `authenticated` session; direct `analyst_actions` inserts are restricted to `risk_manager` / `admin`.

Deploy functions with:

```bash
supabase functions deploy analyst-actions
supabase functions deploy admin-users
supabase secrets set SERVICE_ROLE_KEY=<service_role_key>
```

## Deployment

### Backend → Render (FastAPI)

The repo includes a `render.yaml` Blueprint.

- **Blueprint (easiest):** Render dashboard → *New* → *Blueprint* → connect the GitHub repo → Render creates the web service automatically.
- **Manual:** *New Web Service* → connect the repo → **Root Directory** `backend` → **Runtime** Python → **Build** `pip install -r requirements.txt` → **Start** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

Required environment variables:

```env
PYTHON_VERSION=3.12.0
CORS_ORIGINS=https://<your-frontend-url>   # comma-separated, e.g. your Vercel/Netlify URL
FRAUD_MODEL_BLEND_WEIGHT=0.5
```

Notes:
- The trained model (`backend/model/*.joblib`, ~8 MB) is committed and loads lazily from its own path — no extra config.
- Verify with `GET https://<service>.onrender.com/health`.
- The free tier sleeps after ~15 min idle; the first request after a cold start is slow.

### Frontend → Vercel (recommended)

The repo includes `vercel.json` (SPA rewrites); Vite is auto-detected (build `npm run build`, output `dist`).

- **Dashboard:** *Add New Project* → import the GitHub repo → set the env vars below → Deploy.
- **CLI:** `npm i -g vercel && vercel --prod` from the repo root.

Build-time environment variables (Vite inlines `VITE_*` at build time, so they must be set in the project before deploying):

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_FRAUD_API_URL=https://<render-service>.onrender.com
```

### Frontend → Netlify (alternative)

`netlify.toml` provides the build command, publish directory (`dist`), and SPA redirects. Connect the repo and set the same three `VITE_*` variables.

### Backend alternatives: Railway / Fly.io

Same start command (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`), root directory `backend`, and the same env vars.

## Project Structure

```text
mobile-money-fds/
├── src/
│   ├── components/
│   │   ├── dashboard/   # Dashboard widgets and analyst interfaces
│   │   └── ui/          # Shared UI primitives and visual components
│   ├── context/         # React context providers
│   ├── hooks/           # Stream, KPI, and analyst action hooks
│   ├── lib/             # Shared constants, mock data, and Supabase setup
│   └── pages/           # Landing, login, and dashboard screens
├── backend/
│   ├── app/
│   │   ├── services/    # feature_store.py, model_service.py
│   │   ├── decision_engine.py
│   │   ├── main.py
│   │   └── schemas.py
│   ├── model/           # Trained Random Forest artifact
│   ├── requirements.txt
│   └── pyrightconfig.json
├── supabase/
│   ├── functions/       # analyst-actions, admin-users (Deno edge functions)
│   ├── migrations/      # SQL migrations + RLS policies
│   └── schema.sql       # Full schema reference
├── index.html           # HTML entry point
├── package.json         # Frontend dependencies and scripts
├── tailwind.config.js   # Tailwind CSS theme configuration
├── vite.config.js       # Vite configuration
└── README.md            # Project overview and setup instructions
```

## License
Proprietary / Enterprise Use Only

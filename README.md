# PhysioGuard

Smart Asset Reliability & Maintenance Suite — an AI-powered platform for managing physiotherapy equipment lifecycle, predictive maintenance, and operational efficiency.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, React Query, Recharts |
| Backend | Node.js, Express, Zod, Pino |
| Database | Supabase (PostgreSQL) |
| AI Engine | Google Gemini AI |
| Auth | JWT (access + refresh tokens) |

## Features

- **Asset Management** — Track equipment with health scores, criticality levels, and location mapping
- **AI-Powered Diagnostics** — Failure prediction, remaining useful life (RUL) estimation, anomaly detection, and defect recognition via image upload
- **Work Order System** — Create, assign, approve, and close maintenance work orders
- **Maintenance Planning** — Schedule preventive maintenance with calendar views
- **Reliability Analytics** — Visualize asset health trends, downtime events, and failure risk
- **AI Chat Assistant** — Conversational interface for maintenance queries
- **Reports & Export** — Generate and export maintenance and reliability reports
- **Real-time Notifications** — Alerts for work orders, AI findings, and maintenance schedules
- **Role-Based Access Control** — Four distinct roles with granular permissions
- **Audit Logging** — Full traceability of user actions

## User Roles

| Role | Access Level |
|------|-------------|
| **Maintenance Admin** | Full access — manage assets, users, AI, reports, settings, and audit logs |
| **Operations Manager** | Manage assets and work orders, run AI diagnostics, view audit logs |
| **Technician** | View assets, handle assigned work orders, log inspections |
| **Vendor** | View own assigned assets and work orders only |

## User Flow

```
Login
  │
  ├─► Dashboard
  │     ├── Asset overview (health scores, status distribution, category breakdown)
  │     ├── Grid/List view with filters (category, status, criticality, location, risk)
  │     ├── Search assets by name, serial number, or model
  │     └── Click asset ──► Asset Detail
  │                            ├── Equipment info, health score, specs
  │                            ├── Components & sub-assemblies
  │                            ├── Meter readings & warranty tracking
  │                            ├── Service history timeline
  │                            ├── AI diagnostics (predict failure, estimate RUL, detect anomalies)
  │                            └── Defect recognition (upload image)
  │
  ├─► Maintenance Calendar
  │     └── View and manage scheduled maintenance tasks
  │
  ├─► Maintenance Planning
  │     └── Create and assign preventive maintenance plans
  │
  ├─► Failure Risk
  │     └── View AI-generated failure probability rankings
  │
  ├─► Recommendations
  │     └── AI-suggested maintenance actions with confidence scores
  │
  ├─► Reliability
  │     └── Reliability metrics, downtime analysis, and trend charts
  │
  ├─► Reports
  │     └── Generate and export maintenance/reliability reports
  │
  ├─► Notifications
  │     └── View alerts for work orders, AI findings, and schedules
  │
  ├─► User Management (Admin only)
  │     └── Create, update, and deactivate user accounts
  │
  └─► Audit Logs (Admin & Ops Manager)
        └── Browse timestamped log of all user actions
```

## Project Structure

```
PhysioGuard/
├── backend/
│   ├── server.js                 # Entry point
│   └── src/
│       ├── config/               # Supabase, Gemini AI, constants
│       ├── controllers/          # Route handlers
│       ├── database/migrations/  # SQL schema
│       ├── jobs/                 # Scheduled jobs (health scoring, anomaly detection)
│       ├── middleware/           # Auth, RBAC, rate limiting, audit, validation
│       ├── routes/               # API route definitions
│       ├── services/             # Business logic (AI, health scores, notifications)
│       ├── utils/                # Helpers, error classes, pagination
│       └── validators/           # Zod request schemas
├── frontend/
│   └── src/
│       ├── components/           # Reusable UI (layout, common, AI, chat, notifications)
│       ├── context/              # Auth and notification providers
│       ├── hooks/                # Custom hooks (auth, permissions, notifications)
│       ├── pages/                # Route pages
│       ├── services/             # API client modules
│       └── utils/                # Constants, formatters, role permissions
```

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project with the schema applied
- Google Gemini API key

### Backend

```bash
cd backend
cp .env.example .env        # Fill in your credentials
npm install
npm run dev                  # Starts on http://localhost:5000
```

### Frontend

```bash
cd frontend
cp .env.example .env        # Set VITE_API_BASE_URL
npm install
npm run dev                  # Starts on http://localhost:5173
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `GEMINI_API_KEY` | Google Gemini AI API key |
| `CORS_ORIGIN` | Allowed frontend origin |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend API URL (e.g. `https://your-api.onrender.com/api/v1`) |

## Deployment

| Service | Platform | Root Directory |
|---------|----------|---------------|
| Backend API | Render | `backend/` |
| Frontend | Vercel | `frontend/` |

## API Endpoints

| Module | Base Path |
|--------|-----------|
| Auth | `/api/v1/auth` |
| Assets | `/api/v1/assets` |
| Work Orders | `/api/v1/work-orders` |
| Maintenance Plans | `/api/v1/maintenance-plans` |
| Inspections | `/api/v1/inspections` |
| Technicians | `/api/v1/technicians` |
| Spare Parts | `/api/v1/spare-parts` |
| AI Diagnostics | `/api/v1/ai` |
| Chat | `/api/v1/chat` |
| Reports | `/api/v1/reports` |
| Notifications | `/api/v1/notifications` |
| Users | `/api/v1/users` |
| Audit Logs | `/api/v1/audit-logs` |
| Locations | `/api/v1/locations` |

## License

MIT

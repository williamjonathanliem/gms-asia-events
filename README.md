# Event Registration & Management System

A full-stack event registration, payment verification, and QR check-in platform built for conference-scale events. Handles the complete attendee lifecycle — from public registration to on-site check-in — with a role-based staff dashboard and an installable mobile scanner app.

---

## Features

### Public-facing
- **Registration form** — fully customizable per event (field labels, input types, visibility, required status)
- **Payment proof upload** — attendees upload a bank transfer screenshot on registration
- **Status page** — registrants check payment status and download their QR code by email
- **Registration closed page** — graceful handling when an event is no longer accepting registrations

### Staff dashboard
- **Registrations table** — search, filter by event/status/package/church, paginate, export CSV
- **Registrant drawer** — view full registration details, payment screenshot, QR code, attendance logs; verify or reject with a reason; copy manual check-in token
- **Walk-in registration** — add registrants manually without going through the public form
- **Event management** — create and manage events with packages, early-bird pricing, multi-currency support, multiple active events
- **Custom form builder** — add unlimited custom fields (text, textarea, dropdown, checkbox) per event; reorder, edit, delete
- **Core field editor** — rename, show/hide, toggle required on built-in fields (name, email, phone, church, ID); change input types and dropdown options per event
- **Global settings** — manage shared dropdown options (e.g. branch list) that apply across all events as defaults
- **Announcement blasts** — compose rich-text emails, target by event/status/package/church or manual email list; full send history with batch delete
- **Staff management** — invite staff by email; assign roles; optionally scope to a single event
- **Danger zone** — reset event data or delete events, both gated behind typed name confirmation

### Scanner
- **QR scanner** — camera-based QR scanning with real-time result feedback, torch toggle, and manual token entry fallback
- **Dual scan modes** — Toolkit pickup and Event attendance tracked separately per scan
- **PWA** — installable on Android and iOS home screen; opens directly to the scanner; high-resolution rear camera

### Infrastructure
- Role-based access control (3 roles)
- Event-scoped staff permissions
- Server-side QR code generation, only revealed after payment verification
- Email notifications: confirmation on registration, QR on verification, rejection with reason
- Private storage for payment screenshots with signed URLs

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Styling | Tailwind CSS |
| Font | Geist |
| Email | Nodemailer (SMTP) |
| QR scanning | ZXing (`@zxing/browser`) |
| QR generation | `qrcode` |
| Rich text | Tiptap |
| PWA | `@ducanh2912/next-pwa` + Workbox |
| Deployment | Vercel |

---

## Project Structure

```
src/
├── app/
│   ├── auth/login/           # Sign-in page + server action
│   ├── dashboard/
│   │   ├── blast/            # Email announcements page + actions
│   │   ├── events/           # Event management page + actions
│   │   ├── registrations/    # Registrations page + actions
│   │   ├── settings/         # Global settings page + actions
│   │   └── staff/            # Staff management page + actions
│   ├── register/
│   │   └── [eventSlug]/      # Public registration form + actions
│   ├── scan/                 # QR scanner page
│   └── status/               # Public registration status page
├── components/
│   ├── dashboard/
│   │   ├── blast/            # Announcement composer + history
│   │   ├── events/           # Event drawer, package editor, form builders
│   │   ├── registrations/    # Registrations table, drawers, filters
│   │   ├── settings/         # Settings client
│   │   └── staff/            # Staff table + invite drawer
│   ├── pwa/                  # PWA install prompt button
│   ├── registration/         # Package price display components
│   ├── scanner/              # QR scanner component
│   ├── status/               # Status lookup form
│   └── ui/                   # Base components (Input, Label, Select, Button, Badge)
├── lib/
│   ├── email/                # Nodemailer transporter + HTML email templates
│   ├── supabase/             # Client, server, and service role Supabase clients
│   ├── constants.ts
│   ├── currencies.ts
│   ├── pricing.ts
│   ├── types/database.ts     # All shared TypeScript types
│   └── utils.ts
public/                       # PWA icons, manifest.json, logo assets
supabase/migrations/          # SQL migration files (run in order)
docs/                         # Staff flow guides (ENG + ID), printable as PDF
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- An SMTP email account (Gmail with App Password works)

### 1. Clone and install

```bash
git clone <repo-url>
cd <project-dir>
npm install
```

### 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password
EMAIL_FROM_NAME=Your Event Name

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Gmail App Password:** Google Account → Security → 2-Step Verification → App Passwords

### 3. Database setup

Run migration files in `supabase/migrations/` in filename order using the Supabase SQL editor.

Migrations create the following tables:

| Table | Purpose |
|---|---|
| `events` | Event records — config, packages, custom fields, pricing |
| `registrations` | Attendee records — payment status, QR tokens, custom answers |
| `packages` | Ticket tiers per event |
| `attendance_logs` | Check-in records (toolkit + event entry) |
| `staff_users` | Role and event-scope assignments |
| `settings` | Global key/value config |
| `email_blasts` | Sent announcement history |

RLS policies and security-definer helper functions are included in the initial migration.

### 4. Storage bucket

In Supabase Storage, create a **private** bucket named `payment-screenshots`.

### 5. First super admin

Create a user in Supabase Auth (Dashboard → Authentication → Users → Add user), then run:

```sql
INSERT INTO staff_users (id, email, role)
VALUES ('<auth-user-uuid>', 'your@email.com', 'super_admin');
```

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000/auth/login](http://localhost:3000/auth/login)

---

## Deployment

### Vercel

1. Push the repo to GitHub
2. Import it in [Vercel](https://vercel.com)
3. Add all environment variables under **Settings → Environment Variables**
4. Deploy — the PWA service worker is auto-generated at build time

The following files are generated at build and should not be committed:

```
public/sw.js
public/workbox-*.js
```

These are already in `.gitignore`.

---

## Roles & Permissions

| Role | Access |
|---|---|
| `super_admin` | Everything `admin` can do, plus: invite/remove staff, global settings, reset/delete events |
| `admin` | Full event operations — create & configure events, manage packages, verify payments, walk-in registration, announcements, CSV export, scanner |
| `scanner` | QR scanner only — no dashboard access |

Staff can be **event-scoped** — their view is limited to one assigned event. Scoping is available for `admin` accounts.

---

## Key Design Decisions

**Service role client** — `createServiceClient()` uses the raw `@supabase/supabase-js` client, not `@supabase/ssr`. The SSR wrapper injects the session cookie and overrides the service role with the user's RLS context, which breaks server-side admin writes. The raw client ensures the service role key is used as a Bearer token.

**QR tokens** — UUIDs generated at insert time. The QR image is rendered on-demand server-side and never persisted — only the token is stored. The QR is only surfaced to the registrant once payment is marked verified.

**Custom + core fields as JSONB** — Both custom fields (`custom_fields`) and core field overrides (`core_fields`) are stored as JSONB on the `events` row. Answers go into `custom_answers` on `registrations`. This avoids schema migrations when event organizers change their form.

**Non-fatal email sending** — Email failures are caught and logged but never block a registration or a payment verification. A failed SMTP send should not result in a failed user action.

**Anonymous registrations** — `email` and `full_name` are nullable. If an event is configured to hide these fields, registrations proceed without them. Email delivery and QR reveal are automatically skipped when no email address is present.

**Camera quality** — The scanner uses `decodeFromConstraints` with `{ width: { ideal: 3840 }, height: { ideal: 2160 }, facingMode: 'environment' }`. The browser negotiates down to the best resolution the hardware supports, typically 1080p on modern phones, rather than defaulting to the low-resolution stream ZXing picks otherwise.

---

## License

Private — all rights reserved.

---

Made by William Jonathan

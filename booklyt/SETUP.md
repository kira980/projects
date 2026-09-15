# BookFlow — Setup Guide

## Prerequisites
- Node.js 18+
- A Supabase project (free tier works great)

## 1. Clone & Install

```bash
cd saas
npm install
```

## 2. Environment Variables

Copy the example file:
```bash
cp .env.local.example .env.local
```

Fill in your Supabase credentials from the Supabase dashboard → Settings → API:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 3. Supabase Setup

### Run the SQL Schema

1. Open your Supabase project
2. Go to **SQL Editor** → **New query**
3. Paste the entire contents of `supabase/schema.sql`
4. Click **Run**

This creates:
- All tables (profiles, businesses, services, staff_members, working_hours, customers, appointments)
- RLS policies for each table
- Storage buckets (logos, avatars, services)
- Triggers (auto-create profile on signup, updated_at)

### Configure Auth

In Supabase Dashboard → **Authentication** → **URL Configuration**:
- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`

## 4. Start the Dev Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 5. First Steps

1. Click **Get started free** → Create an account
2. Complete the **onboarding** (business name, category, URL slug)
3. Go to **Services** → Add your first service
4. Go to **Staff** → Add team members
5. Go to **Working Hours** → Set your schedule
6. Share your public booking URL: `/book/your-slug`

---

## File Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── auth/
│   │   ├── login/page.tsx          # Login
│   │   ├── signup/page.tsx         # Signup
│   │   └── callback/route.ts       # OAuth callback
│   ├── onboarding/page.tsx         # Business setup wizard
│   ├── dashboard/
│   │   ├── layout.tsx              # Dashboard shell + sidebar
│   │   ├── page.tsx                # Overview
│   │   ├── appointments/page.tsx   # Appointment management
│   │   ├── services/page.tsx       # Services CRUD
│   │   ├── staff/page.tsx          # Staff CRUD
│   │   ├── hours/page.tsx          # Working hours editor
│   │   └── settings/page.tsx       # Business settings
│   ├── book/[businessSlug]/
│   │   └── page.tsx                # Public booking page
│   └── api/
│       ├── slots/route.ts          # GET available time slots
│       └── book/route.ts           # POST create appointment
├── components/
│   ├── ui/                         # shadcn/ui base components
│   ├── dashboard/sidebar.tsx       # Navigation sidebar
│   └── booking/booking-flow.tsx    # 5-step booking wizard
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client
│   │   └── server.ts               # Server Supabase client
│   ├── booking/slots.ts            # Slot generation algorithm
│   └── utils.ts                    # Helpers, constants
├── types/database.ts               # Full Supabase type definitions
└── middleware.ts                   # Auth route protection
```

## Booking Engine

The slot generation algorithm (`src/lib/booking/slots.ts`):

1. Fetches working hours for the selected day
2. Fetches existing non-cancelled appointments
3. Generates slots every 15 minutes from `open_time` to `close_time - duration`
4. Marks any slot that overlaps an existing appointment as unavailable
5. Server-side `/api/book` re-validates before inserting (prevents race conditions)

## Security

- All tenant tables have RLS enabled
- Owners can only read/write their own business data
- Public can view active services, staff, working hours, and create appointments
- The `/api/book` endpoint re-validates availability server-side before inserting
- Auth routes are protected by middleware

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS + CSS variables |
| Components | shadcn/ui (custom implementation) |
| Animations | Framer Motion |
| Icons | Lucide React |
| Backend | Supabase (Auth + PostgreSQL + Storage) |
| Forms | React Hook Form + Zod |
| Date | date-fns + react-day-picker |

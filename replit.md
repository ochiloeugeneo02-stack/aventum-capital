# Aventum Capital — Chama Platform

## Project Summary
Digital rotational savings (chama) platform. Members contribute on a rotating schedule and receive pool payouts. Multi-region/currency, Stripe payments, group management, admin panels.

**Demo accounts:** admin@aventum.co/Aventum2024!, grace@aventum.co/grace123, amina/david/fatuma/james@aventum.co/member123. The Wave account is seeded on startup if missing: thewave.grpevents@gmail.com (username alias: thewave), preserving its existing password hash.

## Architecture
- **Currency:** Groups store amounts in their native currency (set by admin's region at creation). `currency` column on `groups` table.
- **Invitations:** Token-based (`invitations` table). Admins enter any email — if user has an account they're added directly; if not, a shareable invite link is generated (and email sent if SMTP configured). Frontend invite accept page at `/invite/:token`.
- **Email:** `artifacts/api-server/src/lib/email.ts` — styled HTML template. Uses Resend when `RESEND_API_KEY` is set, otherwise SMTP (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`) if configured. Public email links use `getAppBaseUrl` (`APP_BASE_URL`, request host, then Replit/dev fallback); production custom domain is `https://aventumcapital.com`.
- **Region system:** `RegionContext.tsx` — 9 regions auto-detected from timezone/language. Stored in `localStorage("aventum_region")`. Signup flow: Step 1 = region picker, Step 2 = motivation, Step 3 = account details.
- **Forgot/Reset password:** `/forgot-password` and `/reset-password` pages. Backend endpoints `/auth/forgot-password` and `/auth/reset-password` with crypto token + 1hr expiry. Email sent via Resend if `RESEND_API_KEY` is set, otherwise token URL logged. "Forgot password?" link on Login page.
- **Change password:** Authenticated `/auth/change-password` endpoint. Form in Settings page.
- **Extended user profile:** `users` table has `username` (unique), `location`, `emailMarketing`, `passwordResetToken`, `passwordResetTokenExpiry` columns. Signup step 3 collects username, phone, location (geolocation), email marketing consent. Settings page has full profile editor + change password form.
- **Login normalization:** `/auth/login` trims/lowercases the submitted identifier and accepts either email or username. `thewave` is treated as an alias for `thewave.grpevents@gmail.com`.
- **Group popups:** Group invite, exit, and turn-swap dialogs use a single Radix modal shell with an image-backed community panel (`attached_assets/pexels-pixabay-461049_1776748558410.jpg` imported via `@assets`) to avoid nested/double-box rendering.

## Group Deletion Requests
- DB table: `group_delete_requests` (id, group_id, requested_by, reason, status, reviewed_by, review_note, disbursement_note, requested_at, reviewed_at)
- Group admins submit via `POST /api/groups/:groupId/delete-request`, fetch status via `GET /api/groups/:groupId/delete-request`
- Super admin: `GET /api/admin/delete-requests`, `POST /api/admin/delete-requests/:id/approve`, `POST /api/admin/delete-requests/:id/reject`
- UI: `GroupDeleteSection` component in `AdminGroup.tsx` (collapsible, shows form/status), Delete Requests section in SuperAdmin control panel

## Group Creation (Member side)
- Members can create groups from `Groups.tsx` via a "Create Group" button in the header
- Empty state also shows a CTA button for creating the first group
- Modal form: group name, currency, contribution amount, schedule, max members
- Creator automatically becomes group_admin; redirected to new group on success

## Super Admin Group Chat Monitoring
- Groups section in `/staff` panel has a "Monitor Chat" button per group row
- Opens a right-side panel showing full group chat history
- Super admin can read all messages and send messages to the group (visible to members)
- Backend (`groupChat.ts`) already treated `super_admin` role as a virtual member for this

## Super Admin Control Panel (`/admin`)
- Full-page layout with dark forest green sidebar navigation (no `DashboardLayout`)
- Sections: Overview (KPIs + quick actions), Users, Groups (with status filters + chat monitor), Contributions, Payouts, Delete Requests, Exit Requests, Swap Requests, Audit Log
- Pending request badges show on sidebar nav items for actionable items
- All approve/reject actions wired to existing API endpoints

## Key Zod schemas (api-zod/src/generated/api.ts)
- `CreateGroupBody` — includes `currency?: string`
- `ListGroupsResponseItem` / `GetGroupResponse` — include `currency: string`

---

# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

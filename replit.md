# Aventum Capital — Chama Platform
A platform for digital rotational savings groups (chamas), enabling members to contribute and receive payouts on a rotating schedule across multiple regions and currencies.

## Run & Operate
- **Run API server:** `pnpm --filter @workspace/api-server run dev`
- **Build all packages:** `pnpm run build`
- **Typecheck all packages:** `pnpm run typecheck`
- **Regenerate API hooks & Zod schemas:** `pnpm --filter @workspace/api-spec run codegen`
- **Push DB schema changes (dev only):** `pnpm --filter @workspace/db run push`
- **Required Env Vars:** `RESEND_API_KEY` (or `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`), `APP_BASE_URL`, `SESSION_SECRET`

## Stack
- **Monorepo:** pnpm workspaces
- **Node.js:** 24
- **TypeScript:** 5.9
- **API Framework:** Express 5
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Validation:** Zod (v4)
- **API Codegen:** Orval (from OpenAPI spec)
- **Build Tool:** esbuild

## Where things live
- **API Server:** `artifacts/api-server`
- **Frontend App:** `artifacts/chama`
- **Database Schema:** `artifacts/db/schema.ts`
- **API Specifications & Zod Schemas:** `artifacts/api-spec` (source-of-truth: `api-zod/src/generated/api.ts`)
- **Email Templates:** `artifacts/api-server/src/lib/email.ts`
- **UI Components:** `artifacts/chama/src/components`
- **Core Styles:** `artifacts/chama/src/index.css`
- **Admin Pages:** `artifacts/chama/src/pages/Admin`

## Architecture decisions
- **Global-first Currency:** Groups operate in their own currency; app defaults to USD, not KES.
- **Mandatory Email 2FA:** All logins require a 6-digit email OTP for enhanced security.
- **RBAC for Staff Portal:** Granular permission system implemented via `requirePermission` middleware and role-gated UI elements.
- **Cycle Approval Flow:** Groups transition to `awaiting_cycle_approval` after all payments, requiring admin approval to restart the next cycle.
- **User Identification:** Login accepts either email or username, normalized (trimmed/lowercased) for consistency.

## Product
- **Rotational Savings:** Members contribute to a pool and receive payouts on a schedule.
- **Group Management:** Creation, invitation, member removal, and administration of savings groups.
- **Payment Processing:** Stripe integration for contributions and payouts, including transaction fee handling.
- **User Authentication:** Email/password login, 2FA, password reset, and account lockout mechanisms.
- **Staff Portal:** Comprehensive admin interface with RBAC for managing users, groups, finance, and support.
- **Internal Messaging:** Private messaging between members and group chat monitoring for super admins.

## User preferences
_Populate as you build_

## Gotchas
- **Database Schema Push:** Remember to run `pnpm --filter @workspace/db run push` after any DB schema changes in development.
- **API Spec Codegen:** `pnpm --filter @workspace/api-spec run codegen` must be run whenever the OpenAPI spec changes to update hooks and Zod schemas.
- **Email Configuration:** Ensure `RESEND_API_KEY` or SMTP variables are set for email functionality.
- **Super Admin Chat:** Super admins can send messages in group chats, which are visible to members.

## Pointers
- **pnpm workspaces:** Refer to the `pnpm-workspace` skill for details on monorepo structure.
- **Drizzle ORM:** [https://orm.drizzle.team/](https://orm.drizzle.team/)
- **Zod:** [https://zod.dev/](https://zod.dev/)
- **Orval:** [https://orval.dev/](https://orval.dev/)
- **Stripe API:** [https://stripe.com/docs/api](https://stripe.com/docs/api)
- **Express.js:** [https://expressjs.com/](https://expressjs.com/)
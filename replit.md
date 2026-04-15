# Aventum Capital — Chama Platform

## Project Summary
Digital rotational savings (chama) platform. Members contribute on a rotating schedule and receive pool payouts. Multi-region/currency, Stripe payments, group management, admin panels.

**Demo accounts:** admin@aventum.co/admin123, grace@aventum.co/grace123, amina/david/fatuma/james@aventum.co/member123

## Architecture
- **Currency:** Groups store amounts in their native currency (set by admin's region at creation). `currency` column on `groups` table.
- **Invitations:** Token-based (`invitations` table). Admins enter any email — if user has an account they're added directly; if not, a shareable invite link is generated (and email sent if SMTP configured). Frontend invite accept page at `/invite/:token`.
- **Email:** `artifacts/api-server/src/lib/email.ts` — styled HTML template. Requires `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` env vars to send; otherwise returns invite URL.
- **Region system:** `RegionContext.tsx` — 9 regions auto-detected from timezone/language. Stored in `localStorage("aventum_region")`. Signup flow: Step 1 = region picker, Step 2 = account details.

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

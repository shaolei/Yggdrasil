# Coffee Shop

Example Next.js application demonstrating Yggdrasil semantic memory.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS 4
- **Database:** SQLite (Drizzle ORM)
- **Auth:** Credentials (email/password)
- **Payments:** Mock Stripe

## Roles

- **Customer** — menu, cart, checkout, order history
- **Barista** — order queue, status updates
- **Owner** — dashboard, menu management, analytics

## Quick Start

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

## Test Accounts

| Role    | Email               | Password   |
|---------|---------------------|------------|
| Owner   | `owner@coffee.local`   | owner123   |
| Barista | `barista@coffee.local` | barista123 |
| Customer| `customer@coffee.local`| customer123|

## Yggdrasil

This project uses Yggdrasil for semantic memory. Run `yg` commands from this directory:

```bash
yg status
yg validate
yg tree
```

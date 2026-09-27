# ClientFlow

ClientFlow is a SaaS workspace for creative professionals to manage clients, projects, creative delivery, approvals, revisions, invoices, and payments.

## Current status

This repository contains the ClientFlow MVP prototype. The production application is being built incrementally on the `build-foundation` branch while `main` remains the protected prototype baseline.

## Product workflow

Upload → Review → Revise → Approve → Invoice → Pay

## Planned production architecture

- Frontend: browser application
- Backend/API: Cloudflare Workers
- Database: Cloudflare D1 (SQLite)
- Object storage: Cloudflare R2
- Authentication: server-side sessions with hashed passwords
- Payments: gateway abstraction for eSewa and Khalti
- Deployment: Cloudflare

## Development principles

1. Never store authentication credentials or session secrets in browser localStorage.
2. Never proxy large video uploads through Worker request bodies when direct object-storage upload is possible.
3. Every tenant-owned record must be scoped to a workspace.
4. Payment callbacks/webhooks must be verified server-side before marking an invoice paid.
5. PAN/VAT fields are product data fields; regulatory invoicing requirements must be validated before production launch.

## Repository structure

```
/
├── index.html              # Current MVP prototype / landing + demo app
├── README.md
├── docs/
│   └── architecture.md
├── database/
│   └── schema.sql
└── worker/
    └── README.md
```

## Local prototype

The existing `index.html` can be opened directly in a browser for the current prototype experience.

## Production roadmap

1. Foundation and data model
2. Authentication and sessions
3. Clients and projects
4. R2 file/video uploads
5. Client review portals
6. Revisions and approvals
7. Invoices and tax profile
8. Payment gateway integration
9. ClientFlow subscriptions
10. Security, testing and production deployment

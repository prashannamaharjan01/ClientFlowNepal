# ClientFlow Production Architecture

## 1. Tenancy

A workspace is the primary tenant boundary.

`users` identify people. A user can belong to multiple workspaces through `workspace_members`. Business data such as clients, projects, invoices and files belongs to one workspace.

Application queries must always derive the workspace from the authenticated session and enforce `workspace_id` filtering server-side.

## 2. Authentication

The browser must never be treated as the source of truth for identity.

Target flow:

1. Sign up
2. Create user
3. Create workspace
4. Create owner membership
5. Create server-side session
6. Set secure, HttpOnly session cookie
7. Use session on subsequent API requests
8. Logout destroys the session

Passwords will be stored only as strong password hashes. Password reset tokens will be short-lived, single-use and stored hashed.

## 3. File and video delivery

Large creative files should use direct object storage.

Target flow:

1. Authenticated user requests an upload URL.
2. Worker validates workspace/project permissions and file metadata.
3. Worker issues a short-lived R2 upload authorization.
4. Browser uploads directly to R2.
5. Worker stores file metadata in D1.
6. Client portal requests a short-lived authorized download/stream URL.

The Worker should not receive the full video as its request body.

## 4. Review workflow

A project can have many versions.

Each version can have:
- file
- version number
- status
- creator/upload timestamp
- review comments
- revision requests
- approval

Approval and revision events should be persisted rather than represented only by UI state.

## 5. Invoicing

Invoice records should preserve the seller and buyer information used at issuance so later profile edits do not rewrite historical invoices.

Seller fields include:
- legal name
- address
- PAN
- VAT registration number where applicable

Invoice totals should be calculated server-side.

## 6. Payments

Payment providers are behind an adapter interface.

Conceptually:

`Invoice → Create payment → Gateway → Callback/Webhook → Verify → Record payment → Update invoice`

A browser redirect alone must never be treated as proof of payment.

## 7. Security baseline

Before production:
- secure cookies
- CSRF protection where applicable
- server-side authorization
- input validation
- rate limiting for authentication
- audit logging for sensitive actions
- signed/expiring file access
- webhook signature/transaction verification
- secret management
- backups and recovery plan

## 8. Planned Cloudflare components

- Cloudflare Workers: API and application backend
- Cloudflare D1: relational application data
- Cloudflare R2: creative file storage
- Cloudflare Pages/Workers deployment: application delivery

Exact limits and pricing should be checked against current Cloudflare documentation before launch.

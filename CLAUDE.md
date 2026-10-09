# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Physical Key Ledger is a browser-based ledger for physical keys, IC cards and card keys. It tracks loans, returns and anomalies (overdue keys, multi-holding, expiring cards) using IndexedDB for client-side persistence. Vanilla JavaScript, no build step, no dependencies. Part of the "100 Security Tools with GenAI" project (Day 087).

**Demo**: https://ipusiron.github.io/physical-key-ledger/

## Running and Testing

- **Run locally**: serve the directory over HTTP, for example `python -m http.server 8000`, then open `http://localhost:8000/`.
  **Opening `index.html` as `file://` does not work**: the scripts are ES modules and the browser blocks them as cross-origin.
- **Tests**: `npm test` (Node.js 22+, `node --test`). No dependencies, no devDependencies.
- **CI**: `.github/workflows/test.yml` runs `npm test` on push and pull request.
- **Deployment**: static files on GitHub Pages from `main` (`.nojekyll` is present).

## Architecture

### Pure modules (no DOM, no IndexedDB) — these are what the tests exercise

1. **js/display.js** — labels, relative time, `datetime-local` conversion, `escapeHtml`, threshold labels.
2. **js/anomaly.js** — `detectOverdue`, `detectMultiHolding`, `detectExpiredCards`, `detectLongMasterLoan`, `detectNoDueDate`, `detectInconsistent`, `kpi`. Every function takes the data and `now` explicitly.
3. **js/validate.js** — `validateDataset` (import), `validateKeyInput`, `validateLoanInput`, `isUuid`.

### Stateful layers

4. **js/db.js** — IndexedDB wrapper. Stores: `keys` (keyPath `uuid`), `loans` (keyPath `loanId`), `audit` (keyPath `seq`, autoIncrement, index `by_ts`), `meta` (settings).
   Every ledger change goes through a single readwrite transaction (`putKeyWithAudit`, `deleteKeyWithAudit`, `createLoanAtomic`, `returnLoanAtomic`, `importAllReplace`), so a key cannot end up marked as loaned without a matching loan record.
5. **js/logic.js** — domain operations on top of the pure modules: `upsertKey`, `deleteKey`, `createLoan`, `returnLoanByKeyUuid`, `exportJson`, `importJsonFile`, settings and theme.
6. **js/ui.js** — the only file that touches the DOM. Rendering, modals, QR codes, deep links.

### Database versions

- v1 to v2: added the `by_category`, `by_cardNumber` and `by_validUntil` indices on `keys`.
- v2 to v3: the audit store used to be keyed by the millisecond timestamp, so two entries written in the same millisecond overwrote each other. v3 rebuilds it with an auto-incrementing `seq` and keeps `ts` as an index. Existing entries are copied over in timestamp order.

### Data model

- **Key**: `{ uuid, id, name, category, type, status, location, notes, createdAt, updatedAt }`
  - `uuid`: internal identifier (UUID v4; survives changes to the printed tag)
  - `id`: the user-facing tag number, unique (`by_id` is a unique index)
  - `category`: `physical-key` | `ic-card` | `card-key`
  - `status`: `stored` | `loaned` | `retired`
  - cards also carry `cardNumber`, `accessLevel`, `validFrom`, `validUntil`
- **Loan**: `{ loanId, keyUuid, borrower, loanedAt, dueAt, returnedAt, outNotes, inNotes }`
- **Audit**: `{ seq, ts, actor, action, entityId, diff }` with actions `key.create`, `key.update`, `key.delete`, `loan.create`, `loan.return`, `import`

### Rules enforced in code

- Only a key with status `stored` can be lent out. Retired keys show no loan button and `validateLoanInput` rejects them.
- A key with an active loan cannot be deleted (checked inside the delete transaction).
- Import replaces the whole ledger, but only after `validateDataset` passes. A dataset that fails validation changes nothing.
- `uuid` values from an import must match the UUID format, and they are escaped again when written into the table markup.
- Borrower names are grouped with `borrowerKey` (NFKC, collapsed whitespace, lower case), so `T.Yamada` and `t.yamada ` count as one person.

## Security

- `index.html` carries a meta CSP: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; base-uri 'none'; form-action 'none'; object-src 'none'`.
  This means **no inline event handlers and no `style` attributes**. Use classes (`.hidden`) and `addEventListener`. Setting `element.style` from JavaScript is fine (CSSOM is not covered by CSP).
- No external origin is contacted. QRCode.js is self-hosted in `vendor/` (see `vendor/README.md` for the version, SHA-256 and SRI).
- QR links use the fragment (`#id=`, `#key=`) so that key identifiers are not sent to the server, and the fragment is removed with `history.replaceState` once it has been read. The older `?id=` form is still accepted.
- `X-Frame-Options` and `X-Content-Type-Options` are **not** written as meta tags: browsers ignore them there and log a console error instead.

## Conventions

- Timestamps are milliseconds (`Date.now()`).
- UUIDs come from `crypto.randomUUID()` (with a `crypto.getRandomValues` fallback). Loan IDs are `L-YYYYMMDD-HHMMSS-xxxx` with a random suffix from `crypto`.
- Japanese UI text; comments and identifiers in English.
- Form fields are read through `form.elements.namedItem(name)`, never `form.id`.
- When a change affects a number written in the README, update `test/readme.test.js` too: it recomputes them.

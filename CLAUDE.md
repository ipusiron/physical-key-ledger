# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Physical Key Ledger is a browser-based physical key management application built with vanilla JavaScript, HTML, and CSS. It tracks key loans, returns, and anomalies (overdue keys, multi-holding) using IndexedDB for client-side persistence. Part of the "100 Security Tools with GenAI" project (Day 087).

**Demo**: https://ipusiron.github.io/physical-key-ledger/

## Running and Testing

- **Development**: Open `index.html` directly in a browser (no build step required)
- **Live Preview**: Use a local server if needed (e.g., `python -m http.server` or VS Code Live Server)
- **Deployment**: Static files deployed to GitHub Pages (already configured via `.nojekyll`)

## Architecture

### Three-Layer Module Structure

1. **db.js** - IndexedDB persistence layer
   - Four object stores: `keys`, `loans`, `audit`, `meta`
   - Exports `openDB()` and `dbApi` with CRUD methods
   - Keys indexed by `uuid` (primary) and `id` (unique display ID)
   - Loans indexed by `loanId`, `keyUuid`, `borrower`, `dueAt`
   - Audit log stored in descending timestamp order

2. **logic.js** - Business logic and domain operations
   - Global `state` object holds DB handle, cache, and settings
   - Key workflows: `upsertKey()`, `deleteKey()`, `createLoan()`, `returnLoanByKeyUuid()`
   - Anomaly detection: `detectOverdue()`, `detectMultiHolding()`
   - All mutations trigger audit log entries and cache refresh
   - Export/Import operates on entire dataset (full replace, no merge)

3. **ui.js** - DOM bindings and rendering
   - Event listeners attached on DOMContentLoaded
   - Five modals: key edit, loan, return, audit log, settings
   - QR code generation uses QRCode.js CDN (ID-based or UUID-based URLs)
   - Table rendering includes search/filter by ID, name, location, borrower

### Data Model

- **Key**: `{ uuid, id, name, category, type, status, location, notes, createdAt, updatedAt }`
  - `uuid`: internal identifier (persistent across ID changes)
  - `id`: user-facing physical tag number (e.g., "KEY-001")
  - `category`: "physical-key" | "ic-card" | "card-key"
  - `status`: "stored" | "loaned" | "retired"
  - IC cards and card keys have additional fields: `cardNumber`, `accessLevel`, `validFrom`, `validUntil`

- **Loan**: `{ loanId, keyUuid, borrower, loanedAt, dueAt, returnedAt, outNotes, inNotes }`
  - Active loan: `returnedAt == null`
  - Overdue: `returnedAt == null && now > dueAt`

- **Audit**: `{ ts, actor, action, entityId, diff }`
  - Actions: "key.create", "key.update", "key.delete", "loan.create", "loan.return", "import"

### Category-Type Mapping

Types change dynamically based on selected category (ui.js:204-224):
- **physical-key**: master, original, spare
- **ic-card**: employee, visitor, contractor, temporary, other
- **card-key**: room-key, access-card, parking-card, locker-key, other

### Key Constraints

- Cannot delete a key with an active loan (must return first)
- Cannot create a loan if key status is already "loaned"
- Import replaces entire dataset (warns user before execution)
- QR scan feature not implemented (generation only)
- Data is browser-local (no sync across devices)

## Important Conventions

- All timestamps stored as milliseconds (`Date.now()`)
- UUID generation uses crypto.getRandomValues (logic.js:66-70)
- Loan IDs follow format: `L-YYYYMMDD-HHMMSS-xxxx` (logic.js:71-76)
- Japanese UI text; comments and code in English
- No build tools, no npm, no bundler - pure vanilla JS modules
- Theme stored in localStorage, other settings in IndexedDB `meta` store

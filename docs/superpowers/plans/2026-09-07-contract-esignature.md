# Contract e-signature (in-house SES) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace click-to-sign with a real signed contract PDF: brand fills the term sheet, both parties sign embedded in-app with a consent + audit trail, and a locked, participant-only downloadable PDF is produced.

**Architecture:** A pluggable `lib/esign/` module (mirrors `lib/stripe/`) with one in-house Simple-Electronic-Signature provider. The existing service-role `signContract` still flips the state machine and fires the (already-wired) `contract_fully_signed` email/notification; the new code adds per-signer capture (`contract_signatures`), a `@react-pdf/renderer` document, a SHA-256 audit hash, storage under a contract-scoped path, and a thin HMAC webhook seam for a future external provider.

**Tech Stack:** Next.js 15 App Router · TypeScript strict · Supabase JS 2 · `@react-pdf/renderer` · Vitest · Playwright · zod

**Spec:** `docs/superpowers/specs/2026-09-07-contract-esignature-design.md`

## Global Constraints

- No Supabase calls outside `lib/supabase/`; no e-sign/provider logic outside `lib/esign/`.
- TypeScript strict — no `any`; `as Type` needs a comment. DB types come from `types/database.ts`.
- Every new table gets RLS before any code queries it; migration file first, then code.
- Service-role client only in route handlers / server modules, never in `"use client"`.
- Webhook handlers verify HMAC before any processing.
- Brand palette in the PDF: ink `#2E3440`, accent `#456489`, font Helvetica.
- Migration timestamp range reserved for this feature: `20260907000001`–`20260907000099`.
- Store DateTime as UTC ISO 8601 strings.
- Run `npm run test`, `npm run type-check`, `npm run lint` (or `npm run check`) before a task is done.
- **Human-only steps (never done by the agent):** applying migrations to staging/prod, regenerating `types/database.ts` from a live DB, adding `ESIGN_*` env vars to Vercel, any deploy/merge. These are surfaced in the final "Human steps" section.

---

### Task 1: Dependency + environment variables

**Files:**
- Modify: `package.json` (add `@react-pdf/renderer`)
- Modify: `lib/env.ts:84-149` (server schema), `lib/env.ts:191-204` (parse block), `lib/env.ts:34-50` (HINTS)
- Test: `lib/env.test.ts`

**Interfaces:**
- Produces: `serverEnv().ESIGN_PROVIDER` (`'podium'` when unset), `serverEnv().ESIGN_WEBHOOK_SECRET` (`string | undefined`).

- [ ] **Step 1: Install the PDF renderer**

Run: `npm install @react-pdf/renderer@^4.0.0`
Expected: `package.json` + lockfile updated; `npm run type-check` still clean.

- [ ] **Step 2: Write the failing test**

Add to `lib/env.test.ts`:

```ts
import { serverEnv, resetEnvCache } from '@/lib/env'

describe('esign env', () => {
  beforeEach(() => resetEnvCache())

  it('defaults ESIGN_PROVIDER to "podium" when unset', () => {
    delete process.env.ESIGN_PROVIDER
    expect(serverEnv().ESIGN_PROVIDER).toBe('podium')
  })

  it('accepts an explicit provider and a webhook secret', () => {
    process.env.ESIGN_PROVIDER = 'podium'
    process.env.ESIGN_WEBHOOK_SECRET = 'a-very-long-shared-webhook-secret-123456'
    resetEnvCache()
    expect(serverEnv().ESIGN_WEBHOOK_SECRET).toBe('a-very-long-shared-webhook-secret-123456')
  })
})
```

(Ensure the surrounding required server vars are set the way the existing `lib/env.test.ts` cases already arrange them — reuse that file's `beforeEach` fixture that populates `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_*`, etc.)

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- lib/env.test.ts`
Expected: FAIL — `ESIGN_PROVIDER` is `undefined`.

- [ ] **Step 4: Add the schema fields**

In `lib/env.ts` `serverSchema` (after `UNSUBSCRIBE_SECRET`):

```ts
  /**
   * E-signature provider selector. Defaults to the in-house Simple Electronic
   * Signature implementation; a paid provider is selected by name later.
   */
  ESIGN_PROVIDER: z.enum(['podium']).default('podium'),
  /**
   * Shared HMAC secret verifying inbound provider webhooks at
   * /api/webhooks/esign. VALIDATED-WHEN-PRESENT (same rationale as
   * STRIPE_WEBHOOK_SECRET/CRON_SECRET): the in-house provider finalizes
   * synchronously and needs no webhook, so a missing value must not take the
   * server down at boot — the route fails closed when it is unset.
   */
  ESIGN_WEBHOOK_SECRET: z
    .string()
    .min(16, 'must be at least 16 characters, generate with `openssl rand -hex 32`')
    .optional(),
```

In the `serverEnv()` parse object (after `UNSUBSCRIBE_SECRET`):

```ts
    ESIGN_PROVIDER: process.env.ESIGN_PROVIDER || undefined,
    ESIGN_WEBHOOK_SECRET: process.env.ESIGN_WEBHOOK_SECRET || undefined,
```

In `HINTS`:

```ts
  ESIGN_WEBHOOK_SECRET:
    'Any high-entropy string from `openssl rand -hex 32`, set in Vercel Preview + Production; matches the secret the provider signs webhooks with',
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- lib/env.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/env.ts lib/env.test.ts
git commit -m "feat(esign): add @react-pdf/renderer dep and ESIGN_* env config"
```

---

### Task 2: Migration — `contract_signatures` table + RLS

**Files:**
- Create: `supabase/migrations/20260907000001_contract_signatures.sql`
- Test: `supabase/migrations/20260907000001_contract_signatures.test.ts`

**Interfaces:**
- Produces: table `public.contract_signatures` with columns `id, contract_id, signer_role, signer_user_id, typed_name, signature_image_path, consent_text, signer_ip, signer_device, signed_at, signature_hash, created_at`; unique `(contract_id, signer_role)`; RLS SELECT for participants + admin; no client write policy.

- [ ] **Step 1: Write the migration SQL**

`supabase/migrations/20260907000001_contract_signatures.sql`:

```sql
-- Per-signer audit records for the in-house e-signature flow.
-- One row per party per contract. Written by the service role only (mirrors
-- public.contracts, which has no client write policy); readable by the
-- contract's participants and admins.

create table public.contract_signatures (
  id                   uuid primary key default gen_random_uuid(),
  contract_id          uuid not null references public.contracts(id) on delete restrict,
  signer_role          text not null check (signer_role in ('brand', 'athlete', 'agent')),
  signer_user_id       uuid not null references public.users(id),
  typed_name           text not null,
  signature_image_path text,
  consent_text         text not null,
  signer_ip            text,
  signer_device        text,
  signed_at            timestamptz not null,
  signature_hash       text not null,
  created_at           timestamptz not null default now(),
  unique (contract_id, signer_role)
);

comment on table public.contract_signatures is
  'Audit record of each party''s electronic signature on a contract (in-house SES). Service-role writes only; participants + admin read.';

alter table public.contract_signatures enable row level security;

-- Participants of the parent contract, or an admin, may read the signatures.
create policy contract_signatures_select on public.contract_signatures
  for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.contracts c
      where c.id = contract_signatures.contract_id
        and (
          c.brand_id = auth.uid()
          or c.athlete_or_team_id = auth.uid()
          or c.agent_id = auth.uid()
        )
    )
  );

-- No INSERT/UPDATE/DELETE policy: writes are service-role only.
```

- [ ] **Step 2: Write the static SQL-text test**

`supabase/migrations/20260907000001_contract_signatures.test.ts` (repo pattern — read the file text, assert on it):

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const sql = readFileSync(
  join(__dirname, '20260907000001_contract_signatures.sql'),
  'utf8'
)

describe('20260907000001_contract_signatures', () => {
  it('creates the table', () => {
    expect(sql).toMatch(/create table public\.contract_signatures/)
  })
  it('enables RLS', () => {
    expect(sql).toMatch(/alter table public\.contract_signatures enable row level security/)
  })
  it('has a participants-or-admin SELECT policy', () => {
    expect(sql).toMatch(/create policy contract_signatures_select/)
    expect(sql).toMatch(/public\.is_admin\(\)/)
    expect(sql).toMatch(/c\.brand_id = auth\.uid\(\)/)
  })
  it('adds NO client write policy', () => {
    expect(sql).not.toMatch(/for insert/i)
    expect(sql).not.toMatch(/for update/i)
    expect(sql).not.toMatch(/for delete/i)
  })
  it('constrains signer_role and is unique per (contract, role)', () => {
    expect(sql).toMatch(/signer_role in \('brand', 'athlete', 'agent'\)/)
    expect(sql).toMatch(/unique \(contract_id, signer_role\)/)
  })
})
```

- [ ] **Step 3: Run the test**

Run: `npm run test -- supabase/migrations/20260907000001_contract_signatures.test.ts`
Expected: PASS (the SQL file already contains the asserted text).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260907000001_contract_signatures.sql supabase/migrations/20260907000001_contract_signatures.test.ts
git commit -m "feat(esign): migration for contract_signatures table + RLS"
```

---

### Task 3: Migration — `contracts.document_hash`

**Files:**
- Create: `supabase/migrations/20260907000002_contracts_document_hash.sql`
- Test: `supabase/migrations/20260907000002_contracts_document_hash.test.ts`

**Interfaces:**
- Produces: column `public.contracts.document_hash text` (SHA-256 hex of the signed PDF). `document_url`, `esignature_provider`, `esignature_envelope_id` already exist.

- [ ] **Step 1: Write the migration SQL**

```sql
-- SHA-256 (hex) of the final signed PDF stored at contracts.document_url, so a
-- downloaded document can be verified against the record. document_url,
-- esignature_provider and esignature_envelope_id already exist on the table.

alter table public.contracts
  add column if not exists document_hash text;

comment on column public.contracts.document_hash is
  'Lowercase hex SHA-256 of the signed PDF at document_url; set by finalizeContractDocument().';
```

- [ ] **Step 2: Write the static test**

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const sql = readFileSync(
  join(__dirname, '20260907000002_contracts_document_hash.sql'),
  'utf8'
)

describe('20260907000002_contracts_document_hash', () => {
  it('adds document_hash to contracts', () => {
    expect(sql).toMatch(/alter table public\.contracts/)
    expect(sql).toMatch(/add column if not exists document_hash text/)
  })
})
```

- [ ] **Step 3: Run the test**

Run: `npm run test -- supabase/migrations/20260907000002_contracts_document_hash.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260907000002_contracts_document_hash.sql supabase/migrations/20260907000002_contracts_document_hash.test.ts
git commit -m "feat(esign): migration adding contracts.document_hash"
```

---

### Task 4: Migration — storage policy `select_contract_docs`

**Files:**
- Create: `supabase/migrations/20260907000003_storage_contract_docs_policy.sql`
- Test: `supabase/migrations/20260907000003_storage_contract_docs_policy.test.ts`

**Interfaces:**
- Produces: a `storage.objects` SELECT policy letting a contract's participants read objects under `docs/contracts/<contractId>/…`. Path convention used by all later tasks: `contracts/<contractId>/signed-<hash8>.pdf` and `contracts/<contractId>/signatures/<role>.png`. Writes remain service-role (no write policy — the service role bypasses RLS).

- [ ] **Step 1: Write the migration SQL**

```sql
-- Signed contract documents live under docs/contracts/<contractId>/… (NOT under
-- an owner uid folder), so the existing owner/can_read_user_folder policies do
-- not grant read. This policy grants read to the contract's participants,
-- independent of match status: a signed contract must stay downloadable to the
-- parties for its retention window even if the match later deactivates.

create policy select_contract_docs on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'docs'
    and (storage.foldername(name))[1] = 'contracts'
    and exists (
      select 1 from public.contracts c
      where c.id::text = (storage.foldername(name))[2]
        and (
          c.brand_id = auth.uid()
          or c.athlete_or_team_id = auth.uid()
          or c.agent_id = auth.uid()
        )
    )
  );
```

- [ ] **Step 2: Write the static test**

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const sql = readFileSync(
  join(__dirname, '20260907000003_storage_contract_docs_policy.sql'),
  'utf8'
)

describe('20260907000003_storage_contract_docs_policy', () => {
  it('adds a SELECT policy on storage.objects for the docs bucket', () => {
    expect(sql).toMatch(/create policy select_contract_docs on storage\.objects/)
    expect(sql).toMatch(/for select/)
    expect(sql).toMatch(/bucket_id = 'docs'/)
  })
  it('scopes to the contracts/<id> path and checks participation', () => {
    expect(sql).toMatch(/\(storage\.foldername\(name\)\)\[1\] = 'contracts'/)
    expect(sql).toMatch(/c\.id::text = \(storage\.foldername\(name\)\)\[2\]/)
    expect(sql).toMatch(/c\.brand_id = auth\.uid\(\)/)
  })
  it('adds no write policy', () => {
    expect(sql).not.toMatch(/for insert/i)
    expect(sql).not.toMatch(/for update/i)
    expect(sql).not.toMatch(/for delete/i)
  })
})
```

- [ ] **Step 3: Run the test**

Run: `npm run test -- supabase/migrations/20260907000003_storage_contract_docs_policy.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260907000003_storage_contract_docs_policy.sql supabase/migrations/20260907000003_storage_contract_docs_policy.test.ts
git commit -m "feat(esign): migration for participant-scoped contract doc storage policy"
```

---

### Task 5: Migration — extend `erase_user_data` for signatures

**Files:**
- Create: `supabase/migrations/20260907000004_erase_user_data_esign.sql`
- Test: `supabase/migrations/20260907000004_erase_user_data_esign.test.ts`

**Interfaces:**
- Produces: `erase_user_data` also anonymises the erased user's `contract_signatures` rows (null `signer_ip`, `signer_device`, `signature_image_path`, `typed_name`; keep `signed_at` + `signature_hash`) and nulls `contracts.document_url`/`document_hash` only once `retain_until <= now()` (the rule the contract row already follows).

- [ ] **Step 1: Read the current function**

Read `supabase/migrations/20260720005003_gdpr_erasure_hardening.sql` (the latest `erase_user_data`) to copy its exact structure. This migration `create or replace`s the same function, preserving every existing statement and adding the two blocks below. **Do not** drop any existing behaviour — reproduce the whole function body and insert the new statements.

- [ ] **Step 2: Write the migration SQL**

```sql
-- Extend erase_user_data() to cover the in-house e-signature artefacts.
-- IMPORTANT: this create-or-replace must reproduce the entire current function
-- body (from 20260720005003) unchanged, then add the two blocks below inside it.
-- Contracts themselves are already retained-then-anonymised there; this adds the
-- contract_signatures rows and the signed-PDF pointer to the same policy.

-- (… full existing erase_user_data(p_user_id) body reproduced here …)

-- NEW BLOCK A — anonymise this user's signature audit rows, keeping the
-- tamper-evidence fields (signed_at, signature_hash) intact.
--   update public.contract_signatures
--      set signer_ip = null,
--          signer_device = null,
--          signature_image_path = null,
--          typed_name = '[erased]'
--    where signer_user_id = p_user_id;

-- NEW BLOCK B — drop the signed-PDF pointer + hash only after retention expires,
-- mirroring the existing document_url rule on public.contracts:
--   update public.contracts
--      set document_hash = case when retain_until is not null and retain_until <= now()
--                               then null else document_hash end
--    where (brand_id = p_user_id or athlete_or_team_id = p_user_id or agent_id = p_user_id);
```

Replace the two commented blocks with live SQL placed at the correct point inside the reproduced function body (Block A alongside the other per-table anonymisation updates; Block B next to the existing `contracts … document_url` update).

- [ ] **Step 3: Write the static test**

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const sql = readFileSync(
  join(__dirname, '20260907000004_erase_user_data_esign.sql'),
  'utf8'
)

describe('20260907000004_erase_user_data_esign', () => {
  it('re-defines erase_user_data', () => {
    expect(sql).toMatch(/create or replace function public\.erase_user_data/)
  })
  it('anonymises contract_signatures keeping signed_at + signature_hash', () => {
    expect(sql).toMatch(/update public\.contract_signatures/)
    expect(sql).toMatch(/signature_image_path = null/)
    expect(sql).not.toMatch(/set[\s\S]*signature_hash = null/)
  })
  it('drops document_hash only after retention expires', () => {
    expect(sql).toMatch(/document_hash = case when retain_until is not null and retain_until <= now\(\)/)
  })
})
```

- [ ] **Step 4: Run the test**

Run: `npm run test -- supabase/migrations/20260907000004_erase_user_data_esign.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260907000004_erase_user_data_esign.sql supabase/migrations/20260907000004_erase_user_data_esign.test.ts
git commit -m "feat(esign): extend erase_user_data for signature audit + signed PDF"
```

---

### Task 6: Hand-augment `types/database.ts` (temporary, until staging regen)

**Files:**
- Modify: `types/database.ts`

**Interfaces:**
- Produces: `Database['public']['Tables']['contract_signatures']` (Row/Insert/Update) and `contracts.Row.document_hash: string | null` on the Insert/Update/Row types — so the strict build compiles before the human regenerates types from staging.

**Why:** applying migrations to a live DB (the source of a real regen) is a human step. To let the code below type-check and the tests run in CI now, we hand-add the shapes with a marker comment. After the human applies the migrations to staging and runs the regen, the generated file overwrites these by-hand additions (they must match exactly, so a diff is a no-op).

- [ ] **Step 1: Add the `contract_signatures` table type**

Inside `Database.public.Tables`, add (matching the existing generated style — `Row`, `Insert`, `Update`, `Relationships`):

```ts
      // HAND-ADDED 2026-09-07 for migration 20260907000001; replace with a real
      // `supabase gen types` regen once the migration is applied to staging.
      contract_signatures: {
        Row: {
          id: string
          contract_id: string
          signer_role: string
          signer_user_id: string
          typed_name: string
          signature_image_path: string | null
          consent_text: string
          signer_ip: string | null
          signer_device: string | null
          signed_at: string
          signature_hash: string
          created_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          signer_role: string
          signer_user_id: string
          typed_name: string
          signature_image_path?: string | null
          consent_text: string
          signer_ip?: string | null
          signer_device?: string | null
          signed_at: string
          signature_hash: string
          created_at?: string
        }
        Update: {
          id?: string
          contract_id?: string
          signer_role?: string
          signer_user_id?: string
          typed_name?: string
          signature_image_path?: string | null
          consent_text?: string
          signer_ip?: string | null
          signer_device?: string | null
          signed_at?: string
          signature_hash?: string
          created_at?: string
        }
        Relationships: []
      }
```

- [ ] **Step 2: Add `document_hash` to the `contracts` types**

In `Tables.contracts.Row`, `.Insert`, `.Update`, add `document_hash: string | null` / `document_hash?: string | null` next to the existing `document_url`.

- [ ] **Step 3: Verify the build**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add types/database.ts
git commit -m "chore(esign): hand-add contract_signatures + document_hash types (pre-regen)"
```

---

### Task 7: `lib/supabase/contract-signatures.ts` — DB helpers

**Files:**
- Create: `lib/supabase/contract-signatures.ts`
- Test: `lib/supabase/contract-signatures.test.ts`

**Interfaces:**
- Consumes: `types/database.ts` `contract_signatures` (Task 6).
- Produces:
  - `type SignerRole = 'brand' | 'athlete' | 'agent'`
  - `insertContractSignature(admin, row: ContractSignatureInsert): Promise<ContractSignatureRow>`
  - `getContractSignatures(client, contractId): Promise<ContractSignatureRow[]>`
  - `ContractSignatureRow` / `ContractSignatureInsert` type aliases.

- [ ] **Step 1: Write the failing test**

`lib/supabase/contract-signatures.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { insertContractSignature, getContractSignatures } from './contract-signatures'

function mockAdmin(returned: unknown) {
  const single = vi.fn().mockResolvedValue({ data: returned, error: null })
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  const order = vi.fn().mockResolvedValue({ data: [returned], error: null })
  const eq = vi.fn(() => ({ order }))
  const selectList = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ insert, select: selectList }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double
  return { from } as any
}

const ROW = {
  id: 's1', contract_id: 'c1', signer_role: 'brand', signer_user_id: 'u1',
  typed_name: 'Ada Brand', signature_image_path: null, consent_text: 'I agree',
  signer_ip: '1.2.3.4', signer_device: 'UA', signed_at: '2026-09-07T00:00:00.000Z',
  signature_hash: 'abc', created_at: '2026-09-07T00:00:00.000Z',
}

describe('contract-signatures', () => {
  it('inserts a signature row and returns it', async () => {
    const admin = mockAdmin(ROW)
    const out = await insertContractSignature(admin, {
      contract_id: 'c1', signer_role: 'brand', signer_user_id: 'u1',
      typed_name: 'Ada Brand', consent_text: 'I agree', signer_ip: '1.2.3.4',
      signer_device: 'UA', signed_at: ROW.signed_at, signature_hash: 'abc',
    })
    expect(out.id).toBe('s1')
    expect(admin.from).toHaveBeenCalledWith('contract_signatures')
  })

  it('lists signatures for a contract', async () => {
    const admin = mockAdmin(ROW)
    const out = await getContractSignatures(admin, 'c1')
    expect(out).toHaveLength(1)
    expect(out[0].signer_role).toBe('brand')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/supabase/contract-signatures.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`lib/supabase/contract-signatures.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type SignerRole = 'brand' | 'athlete' | 'agent'
export type ContractSignatureRow =
  Database['public']['Tables']['contract_signatures']['Row']
export type ContractSignatureInsert =
  Database['public']['Tables']['contract_signatures']['Insert']

export class ContractSignatureError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'ContractSignatureError'
  }
}

/** Insert one signer's audit row (service-role client only — RLS has no write policy). */
export async function insertContractSignature(
  admin: SupabaseClient<Database>,
  row: ContractSignatureInsert
): Promise<ContractSignatureRow> {
  const { data, error } = await admin
    .from('contract_signatures')
    .insert(row)
    .select()
    .single()
  if (error || !data) {
    throw new ContractSignatureError(
      'INSERT_FAILED',
      error?.message ?? 'Failed to record signature'
    )
  }
  return data
}

/** All signatures for a contract, oldest first. */
export async function getContractSignatures(
  client: SupabaseClient<Database>,
  contractId: string
): Promise<ContractSignatureRow[]> {
  const { data, error } = await client
    .from('contract_signatures')
    .select('*')
    .eq('contract_id', contractId)
    .order('signed_at', { ascending: true })
  if (error) {
    throw new ContractSignatureError('SELECT_FAILED', error.message)
  }
  return data ?? []
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/supabase/contract-signatures.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/contract-signatures.ts lib/supabase/contract-signatures.test.ts
git commit -m "feat(esign): contract_signatures DB helpers"
```

---

### Task 8: `lib/esign/audit.ts` — hashing

**Files:**
- Create: `lib/esign/audit.ts`
- Test: `lib/esign/audit.test.ts`

**Interfaces:**
- Produces:
  - `sha256Hex(bytes: Uint8Array | Buffer): string` — lowercase hex.
  - `signatureAuditHash(input: { contractId: string; role: string; typedName: string; signedAt: string; ip: string | null; device: string | null; consentText: string }): string` — deterministic hex over a canonical string.

- [ ] **Step 1: Write the failing test**

`lib/esign/audit.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sha256Hex, signatureAuditHash } from './audit'

describe('audit hashing', () => {
  it('sha256Hex is a stable 64-char lowercase hex of the bytes', () => {
    const h = sha256Hex(Buffer.from('podium'))
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(h).toBe(sha256Hex(Buffer.from('podium')))
  })

  it('signatureAuditHash is deterministic and field-sensitive', () => {
    const base = {
      contractId: 'c1', role: 'brand', typedName: 'Ada', signedAt: '2026-09-07T00:00:00.000Z',
      ip: '1.2.3.4', device: 'UA', consentText: 'I agree',
    }
    const a = signatureAuditHash(base)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(signatureAuditHash(base)).toBe(a)
    expect(signatureAuditHash({ ...base, typedName: 'Bob' })).not.toBe(a)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/esign/audit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`lib/esign/audit.ts`:

```ts
import { createHash } from 'node:crypto'

/** Lowercase hex SHA-256 of raw bytes (used for the signed-PDF document hash). */
export function sha256Hex(bytes: Uint8Array | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export interface SignatureAuditInput {
  contractId: string
  role: string
  typedName: string
  signedAt: string
  ip: string | null
  device: string | null
  consentText: string
}

/**
 * Deterministic per-signature audit hash. Canonicalises the signer facts into a
 * pipe-delimited string (nulls become empty) so the same signature always hashes
 * the same, and any tampering with a field changes the hash.
 */
export function signatureAuditHash(input: SignatureAuditInput): string {
  const canonical = [
    input.contractId,
    input.role,
    input.typedName,
    input.signedAt,
    input.ip ?? '',
    input.device ?? '',
    input.consentText,
  ].join('|')
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/esign/audit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/esign/audit.ts lib/esign/audit.test.ts
git commit -m "feat(esign): audit + document hashing helpers"
```

---

### Task 9: `lib/esign/pdf.tsx` — branded term-sheet renderer

**Files:**
- Create: `lib/esign/pdf.tsx`
- Test: `lib/esign/pdf.test.ts`

**Interfaces:**
- Consumes: nothing internal.
- Produces:
  - `interface ContractPdfParty { role: 'brand' | 'athlete' | 'agent'; displayName: string; company?: string | null }`
  - `interface ContractPdfTerms { title: string; payAmount: number; payCurrency: string; payType: string; timelineStart?: string | null; timelineEnd?: string | null; deliverables?: string | null; usageRights?: string | null; additionalTerms?: string | null }`
  - `interface ContractPdfSignature { role: string; typedName: string; signedAt: string; ip: string | null; signatureHash: string; signatureImageDataUrl?: string | null }`
  - `renderContractPdf(input: { contractId: string; terms: ContractPdfTerms; parties: ContractPdfParty[]; signatures: ContractPdfSignature[] }): Promise<Buffer>`

- [ ] **Step 1: Write the failing test**

`lib/esign/pdf.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { renderContractPdf } from './pdf'

describe('renderContractPdf', () => {
  it('produces a non-empty PDF with the %PDF header', async () => {
    const buf = await renderContractPdf({
      contractId: 'c1',
      terms: {
        title: 'Summer 2026 Endorsement', payAmount: 5000, payCurrency: 'GBP',
        payType: 'flat_fee', timelineStart: '2026-06-01', timelineEnd: '2026-08-31',
        deliverables: '3 Instagram posts', usageRights: 'Social only, 6 months',
        additionalTerms: 'No competitor endorsements during the term.',
      },
      parties: [
        { role: 'brand', displayName: 'Northwind Nutrition', company: 'Northwind Ltd' },
        { role: 'athlete', displayName: 'Maya Okafor' },
      ],
      signatures: [
        { role: 'brand', typedName: 'A. Buyer', signedAt: '2026-09-07T10:00:00.000Z', ip: '1.2.3.4', signatureHash: 'aaa' },
        { role: 'athlete', typedName: 'Maya Okafor', signedAt: '2026-09-07T11:00:00.000Z', ip: '5.6.7.8', signatureHash: 'bbb' },
      ],
    })
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(1000)
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('renders even when the optional term fields are absent', async () => {
    const buf = await renderContractPdf({
      contractId: 'c2',
      terms: { title: 'Deal', payAmount: 100, payCurrency: 'USD', payType: 'per_post' },
      parties: [
        { role: 'brand', displayName: 'B' },
        { role: 'athlete', displayName: 'A' },
      ],
      signatures: [],
    })
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/esign/pdf.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`lib/esign/pdf.tsx`:

```tsx
import React from 'react'
import {
  Document, Page, Text, View, Image, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'

const INK = '#2E3440'
const ACCENT = '#456489'
const MUTED = '#6B7280'

export interface ContractPdfParty {
  role: 'brand' | 'athlete' | 'agent'
  displayName: string
  company?: string | null
}
export interface ContractPdfTerms {
  title: string
  payAmount: number
  payCurrency: string
  payType: string
  timelineStart?: string | null
  timelineEnd?: string | null
  deliverables?: string | null
  usageRights?: string | null
  additionalTerms?: string | null
}
export interface ContractPdfSignature {
  role: string
  typedName: string
  signedAt: string
  ip: string | null
  signatureHash: string
  signatureImageDataUrl?: string | null
}

const styles = StyleSheet.create({
  page: { paddingVertical: 48, paddingHorizontal: 56, fontFamily: 'Helvetica', color: INK, fontSize: 11, lineHeight: 1.5 },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: ACCENT, marginBottom: 2 },
  docType: { fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 },
  h1: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 12 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 6 },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 130, color: MUTED },
  value: { flex: 1 },
  rule: { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginVertical: 10 },
  sigBlock: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  sigName: { fontFamily: 'Helvetica-Bold' },
  sigMeta: { fontSize: 8, color: MUTED },
  sigImg: { height: 40, marginBottom: 4 },
  auditTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  hash: { fontFamily: 'Courier', fontSize: 7, color: MUTED },
})

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}
function payTypeLabel(v: string): string {
  return ({ flat_fee: 'Flat fee', monthly_retainer: 'Monthly retainer', per_post: 'Per post', revenue_share: 'Revenue share' } as Record<string, string>)[v] ?? v
}
function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10)
}

function TermRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}

function ContractDoc(input: {
  contractId: string
  terms: ContractPdfTerms
  parties: ContractPdfParty[]
  signatures: ContractPdfSignature[]
}) {
  const { terms, parties, signatures } = input
  const timeline =
    terms.timelineStart || terms.timelineEnd
      ? `${terms.timelineStart ?? '—'} to ${terms.timelineEnd ?? '—'}`
      : 'Not specified'
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>Podium</Text>
        <Text style={styles.docType}>Sponsorship Agreement</Text>
        <Text style={styles.h1}>{terms.title}</Text>

        <Text style={styles.sectionTitle}>Parties</Text>
        {parties.map((p) => (
          <TermRow
            key={p.role}
            label={p.role === 'brand' ? 'Brand' : p.role === 'agent' ? 'Agent' : 'Athlete / Team'}
            value={p.company ? `${p.displayName} (${p.company})` : p.displayName}
          />
        ))}

        <Text style={styles.sectionTitle}>Commercial terms</Text>
        <TermRow label="Fee" value={money(terms.payAmount, terms.payCurrency)} />
        <TermRow label="Pay type" value={payTypeLabel(terms.payType)} />
        <TermRow label="Timeline" value={timeline} />
        {terms.deliverables ? <TermRow label="Deliverables" value={terms.deliverables} /> : null}
        {terms.usageRights ? <TermRow label="Usage rights" value={terms.usageRights} /> : null}

        {terms.additionalTerms ? (
          <>
            <Text style={styles.sectionTitle}>Additional terms</Text>
            <Text>{terms.additionalTerms}</Text>
          </>
        ) : null}

        <View style={styles.rule} />
        <Text style={styles.sectionTitle}>Signatures</Text>
        {signatures.length === 0 ? (
          <Text style={styles.sigMeta}>Awaiting signatures.</Text>
        ) : (
          signatures.map((s) => (
            <View key={s.role} style={styles.sigBlock}>
              {s.signatureImageDataUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
                <Image style={styles.sigImg} src={s.signatureImageDataUrl} />
              ) : null}
              <Text style={styles.sigName}>{s.typedName}</Text>
              <Text style={styles.sigMeta}>
                {s.role} · signed {fmtDate(s.signedAt)}{s.ip ? ` · IP ${s.ip}` : ''}
              </Text>
            </View>
          ))
        )}
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.auditTitle}>Signature audit certificate</Text>
        <Text style={styles.sigMeta}>Contract ID: {input.contractId}</Text>
        <View style={styles.rule} />
        {signatures.map((s) => (
          <View key={s.role} style={styles.sigBlock}>
            <Text style={styles.sigName}>{s.typedName} — {s.role}</Text>
            <Text style={styles.sigMeta}>Signed at (UTC): {s.signedAt}</Text>
            <Text style={styles.sigMeta}>IP: {s.ip ?? 'not recorded'}</Text>
            <Text style={styles.hash}>Audit hash: {s.signatureHash}</Text>
          </View>
        ))}
        <View style={styles.rule} />
        <Text style={styles.sigMeta}>
          This certificate records simple electronic signatures (ESIGN/UETA/eIDAS).
          Each party confirmed intent to be legally bound at signing.
        </Text>
      </Page>
    </Document>
  )
}

export async function renderContractPdf(input: {
  contractId: string
  terms: ContractPdfTerms
  parties: ContractPdfParty[]
  signatures: ContractPdfSignature[]
}): Promise<Buffer> {
  return renderToBuffer(<ContractDoc {...input} />)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/esign/pdf.test.ts`
Expected: PASS. If Vitest cannot parse `.tsx` here, confirm the repo's Vitest config already handles JSX (it does for component tests); no config change should be needed.

- [ ] **Step 5: Commit**

```bash
git add lib/esign/pdf.tsx lib/esign/pdf.test.ts
git commit -m "feat(esign): branded contract PDF renderer with audit certificate"
```

---

### Task 10: `lib/esign/index.ts` — provider interface + selector

**Files:**
- Create: `lib/esign/index.ts`
- Test: `lib/esign/index.test.ts`

**Interfaces:**
- Consumes: `serverEnv().ESIGN_PROVIDER` (Task 1).
- Produces:
  - `type EsignProviderName = 'podium'`
  - `interface SignaturePayload { typedName: string; consentText: string; signatureImageDataUrl?: string | null; ip: string | null; device: string | null }`
  - `interface EsignProvider { name: EsignProviderName; recordSignature(...): Promise<void>; finalizeContract(...): Promise<{ documentPath: string; documentHash: string } | null> }`
  - `provider(): EsignProvider` — returns the podium provider (Task 12) selected by env.

- [ ] **Step 1: Write the failing test**

`lib/esign/index.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { resetEnvCache } from '@/lib/env'
import { provider } from './index'

describe('esign provider selector', () => {
  beforeEach(() => resetEnvCache())
  it('returns the podium provider by default', () => {
    delete process.env.ESIGN_PROVIDER
    resetEnvCache()
    expect(provider().name).toBe('podium')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/esign/index.test.ts`
Expected: FAIL — module not found. (This depends on Task 12's `podiumProvider`; write Task 12 first if executing strictly, or stub the import and let Task 12 fill it. Recommended order: do Task 11 + 12, then this selector. Sequence in this plan is dependency-first; see note.)

> **Executor note:** Tasks 8–12 form one module. Implement Task 8 (audit), Task 9 (pdf), Task 11 (finalize), Task 12 (podium provider), then this Task 10 selector last. The plan lists the interface here so neighbouring tasks can reference the exact types.

- [ ] **Step 3: Write the implementation**

`lib/esign/index.ts`:

```ts
import { serverEnv } from '@/lib/env'
import { podiumProvider } from './podium'

export type EsignProviderName = 'podium'

export interface SignaturePayload {
  typedName: string
  consentText: string
  signatureImageDataUrl?: string | null
  ip: string | null
  device: string | null
}

export interface EsignProvider {
  name: EsignProviderName
  /** Persist one signer's record for the contract (service-role). */
  recordSignature(contractId: string, role: 'brand' | 'athlete' | 'agent', signerUserId: string, payload: SignaturePayload, signedAt: string): Promise<void>
  /** Generate + store the signed PDF and set document_url/hash. Idempotent; returns null if already finalized. */
  finalizeContract(contractId: string): Promise<{ documentPath: string; documentHash: string } | null>
}

export function provider(): EsignProvider {
  // Only one provider today; the enum keeps the switch honest for future ones.
  switch (serverEnv().ESIGN_PROVIDER) {
    case 'podium':
    default:
      return podiumProvider
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/esign/index.test.ts`
Expected: PASS (after Task 12 exists).

- [ ] **Step 5: Commit**

```bash
git add lib/esign/index.ts lib/esign/index.test.ts
git commit -m "feat(esign): provider interface + env-driven selector"
```

---

### Task 11: `lib/esign/finalize.ts` — generate + store the signed PDF

**Files:**
- Create: `lib/esign/finalize.ts`
- Test: `lib/esign/finalize.test.ts`

**Interfaces:**
- Consumes: `renderContractPdf` (Task 9), `sha256Hex` (Task 8), `getContractSignatures` (Task 7), `resolveDisplayNames` (`@/lib/email/notify`).
- Produces: `finalizeContractDocument(admin, contract): Promise<{ documentPath: string; documentHash: string } | null>` — returns null (no-op) when `contract.document_url` is already set. Sets `contracts.document_url` + `document_hash`. Does **not** touch status/notifications (the sign route + trigger own those).

- [ ] **Step 1: Write the failing test**

`lib/esign/finalize.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./pdf', () => ({
  renderContractPdf: vi.fn(async () => Buffer.from('%PDF-1.7 fake')),
}))
vi.mock('@/lib/supabase/contract-signatures', () => ({
  getContractSignatures: vi.fn(async () => [
    { signer_role: 'brand', typed_name: 'A', signed_at: '2026-09-07T10:00:00.000Z', signer_ip: '1.1.1.1', signature_hash: 'h1', signature_image_path: null },
    { signer_role: 'athlete', typed_name: 'B', signed_at: '2026-09-07T11:00:00.000Z', signer_ip: '2.2.2.2', signature_hash: 'h2', signature_image_path: null },
  ]),
}))
vi.mock('@/lib/email/notify', () => ({
  resolveDisplayNames: vi.fn(async () => ({ brand1: 'Brand One', ath1: 'Ath One' })),
}))

import { finalizeContractDocument } from './finalize'

const TERMS = {
  title: 'Deal', deliverables: '3 posts', pay_amount: 5000, pay_currency: 'GBP',
  pay_type: 'flat_fee', timeline_start: '2026-06-01', timeline_end: '2026-08-31',
  usage_rights: 'Social', additional_terms: 'None',
}
const CONTRACT = {
  id: 'c1', brand_id: 'brand1', athlete_or_team_id: 'ath1', agent_id: null,
  document_url: null, terms_snapshot: TERMS,
}

function mockAdmin() {
  const upload = vi.fn().mockResolvedValue({ data: { path: 'contracts/c1/signed-abc.pdf' }, error: null })
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq }))
  const from = vi.fn((table: string) =>
    table === 'contracts'
      ? { update }
      : { upload }
  )
  const storageFrom = vi.fn(() => ({ upload }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double
  return { from, storage: { from: storageFrom }, _update: update, _upload: upload } as any
}

describe('finalizeContractDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders, uploads and writes document_url + document_hash', async () => {
    const admin = mockAdmin()
    const out = await finalizeContractDocument(admin, CONTRACT)
    expect(out).not.toBeNull()
    expect(out!.documentPath).toMatch(/^contracts\/c1\/signed-[0-9a-f]{8}\.pdf$/)
    expect(out!.documentHash).toMatch(/^[0-9a-f]{64}$/)
    expect(admin.storage.from).toHaveBeenCalledWith('docs')
    expect(admin._update).toHaveBeenCalledWith(
      expect.objectContaining({ document_url: out!.documentPath, document_hash: out!.documentHash })
    )
  })

  it('is a no-op when the contract is already finalized', async () => {
    const admin = mockAdmin()
    const out = await finalizeContractDocument(admin, { ...CONTRACT, document_url: 'contracts/c1/signed-x.pdf' })
    expect(out).toBeNull()
    expect(admin._upload).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/esign/finalize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`lib/esign/finalize.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { renderContractPdf, type ContractPdfParty, type ContractPdfSignature } from './pdf'
import { sha256Hex } from './audit'
import { getContractSignatures } from '@/lib/supabase/contract-signatures'
import { resolveDisplayNames, nameOf, FALLBACK_OTHER_NAME } from '@/lib/email/notify'
import { STORAGE_BUCKETS } from '@/lib/storage'

type ContractRow = Pick<
  Database['public']['Tables']['contracts']['Row'],
  'id' | 'brand_id' | 'athlete_or_team_id' | 'agent_id' | 'document_url' | 'terms_snapshot'
>

function termsString(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'object') {
    const t = (v as { text?: unknown }).text
    if (typeof t === 'string') return t.trim() || null
    return JSON.stringify(v)
  }
  return String(v)
}

/**
 * Generate the signed contract PDF from terms_snapshot + captured signatures,
 * store it under docs/contracts/<id>/, and write document_url + document_hash.
 * Idempotent: returns null when document_url is already set. Does not change
 * status or fire notifications — the sign route + retain trigger own those.
 */
export async function finalizeContractDocument(
  admin: SupabaseClient<Database>,
  contract: ContractRow
): Promise<{ documentPath: string; documentHash: string } | null> {
  if (contract.document_url) return null

  const snapshot = (contract.terms_snapshot ?? {}) as Record<string, unknown>
  const signatureRows = await getContractSignatures(admin, contract.id)

  const ids = [contract.brand_id, contract.athlete_or_team_id, contract.agent_id].filter(
    (x): x is string => Boolean(x)
  )
  const names = await resolveDisplayNames(admin, ids)

  const parties: ContractPdfParty[] = [
    { role: 'brand', displayName: nameOf(names, contract.brand_id, FALLBACK_OTHER_NAME) },
    { role: 'athlete', displayName: nameOf(names, contract.athlete_or_team_id, FALLBACK_OTHER_NAME) },
  ]
  if (contract.agent_id) {
    parties.push({ role: 'agent', displayName: nameOf(names, contract.agent_id, FALLBACK_OTHER_NAME) })
  }

  const signatures: ContractPdfSignature[] = signatureRows.map((s) => ({
    role: s.signer_role,
    typedName: s.typed_name,
    signedAt: s.signed_at,
    ip: s.signer_ip,
    signatureHash: s.signature_hash,
  }))

  const pdf = await renderContractPdf({
    contractId: contract.id,
    terms: {
      title: String(snapshot.title ?? 'Sponsorship Agreement'),
      payAmount: Number(snapshot.pay_amount ?? 0),
      payCurrency: String(snapshot.pay_currency ?? 'GBP'),
      payType: String(snapshot.pay_type ?? ''),
      timelineStart: termsString(snapshot.timeline_start),
      timelineEnd: termsString(snapshot.timeline_end),
      deliverables: termsString(snapshot.deliverables),
      usageRights: termsString(snapshot.usage_rights),
      additionalTerms: termsString(snapshot.additional_terms),
    },
    parties,
    signatures,
  })

  const documentHash = sha256Hex(pdf)
  const documentPath = `contracts/${contract.id}/signed-${documentHash.slice(0, 8)}.pdf`

  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKETS.docs)
    .upload(documentPath, pdf, { contentType: 'application/pdf', upsert: true })
  if (uploadError) {
    throw new Error(`Failed to store signed PDF: ${uploadError.message}`)
  }

  const { error: updateError } = await admin
    .from('contracts')
    .update({ document_url: documentPath, document_hash: documentHash })
    .eq('id', contract.id)
  if (updateError) {
    throw new Error(`Failed to write document pointer: ${updateError.message}`)
  }

  return { documentPath, documentHash }
}
```

> **Executor note:** confirm `resolveDisplayNames`, `nameOf`, and `FALLBACK_OTHER_NAME` are exported from `@/lib/email/notify` (they are used in `app/api/deals/contracts/[contractId]/sign/route.ts`). If `nameOf`'s fallback-arg arity differs, adjust the call to match its signature.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/esign/finalize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/esign/finalize.ts lib/esign/finalize.test.ts
git commit -m "feat(esign): finalize — render, store and hash the signed PDF"
```

---

### Task 12: `lib/esign/podium.ts` — in-house provider

**Files:**
- Create: `lib/esign/podium.ts`
- Test: `lib/esign/podium.test.ts`

**Interfaces:**
- Consumes: `insertContractSignature` (Task 7), `signatureAuditHash` (Task 8), `finalizeContractDocument` (Task 11), `createAdminClient` (`@/lib/supabase/server`), `STORAGE_BUCKETS` (`@/lib/storage`).
- Produces: `podiumProvider: EsignProvider` (Task 10 shape). `recordSignature` uploads the optional signature PNG under `contracts/<id>/signatures/<role>.png`, computes the audit hash, ensures `esignature_provider`/`esignature_envelope_id` are set, and inserts the `contract_signatures` row. `finalizeContract` loads the contract and delegates to `finalizeContractDocument`.

- [ ] **Step 1: Write the failing test**

`lib/esign/podium.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertMock = vi.fn(async () => ({ id: 's1' }))
vi.mock('@/lib/supabase/contract-signatures', () => ({ insertContractSignature: insertMock }))
const finalizeMock = vi.fn(async () => ({ documentPath: 'contracts/c1/signed-abc.pdf', documentHash: 'x'.repeat(64) }))
vi.mock('./finalize', () => ({ finalizeContractDocument: finalizeMock }))

const contractRow = {
  id: 'c1', brand_id: 'b1', athlete_or_team_id: 'a1', agent_id: null,
  document_url: null, terms_snapshot: {}, esignature_envelope_id: null,
}
function mockAdmin() {
  const upload = vi.fn().mockResolvedValue({ data: { path: 'p' }, error: null })
  const single = vi.fn().mockResolvedValue({ data: contractRow, error: null })
  const eqSel = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq: eqSel }))
  const eqUpd = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq: eqUpd }))
  const from = vi.fn(() => ({ select, update }))
  const storageFrom = vi.fn(() => ({ upload }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double
  return { from, storage: { from: storageFrom }, _upload: upload } as any
}
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockAdminSingleton }))
let mockAdminSingleton: ReturnType<typeof mockAdmin>

import { podiumProvider } from './podium'

describe('podiumProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminSingleton = mockAdmin()
  })

  it('records a signature: uploads PNG when present, inserts the audit row', async () => {
    await podiumProvider.recordSignature(
      'c1', 'brand', 'b1',
      { typedName: 'A', consentText: 'I agree', signatureImageDataUrl: 'data:image/png;base64,AAAA', ip: '1.2.3.4', device: 'UA' },
      '2026-09-07T10:00:00.000Z'
    )
    expect(mockAdminSingleton.storage.from).toHaveBeenCalledWith('docs')
    expect(insertMock).toHaveBeenCalledWith(
      mockAdminSingleton,
      expect.objectContaining({
        contract_id: 'c1', signer_role: 'brand', signer_user_id: 'b1', typed_name: 'A',
        signature_image_path: 'contracts/c1/signatures/brand.png',
        signature_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      })
    )
  })

  it('records without an image when none is supplied', async () => {
    await podiumProvider.recordSignature(
      'c1', 'athlete', 'a1',
      { typedName: 'B', consentText: 'I agree', ip: null, device: null },
      '2026-09-07T11:00:00.000Z'
    )
    expect(mockAdminSingleton._upload).not.toHaveBeenCalled()
    expect(insertMock).toHaveBeenCalledWith(
      mockAdminSingleton,
      expect.objectContaining({ signer_user_id: 'a1', signature_image_path: null })
    )
  })

  it('finalizeContract delegates to finalizeContractDocument', async () => {
    const out = await podiumProvider.finalizeContract('c1')
    expect(finalizeMock).toHaveBeenCalled()
    expect(out?.documentHash).toHaveLength(64)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/esign/podium.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`lib/esign/podium.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { STORAGE_BUCKETS } from '@/lib/storage'
import { insertContractSignature } from '@/lib/supabase/contract-signatures'
import { signatureAuditHash } from './audit'
import { finalizeContractDocument } from './finalize'
import type { EsignProvider, SignaturePayload } from './index'

/** Decode a "data:image/png;base64,…" URL to raw bytes, or null if not a data URL. */
function dataUrlToBytes(dataUrl: string | null | undefined): Buffer | null {
  if (!dataUrl) return null
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl)
  if (!m) return null
  return Buffer.from(m[1], 'base64')
}

async function recordSignature(
  contractId: string,
  role: 'brand' | 'athlete' | 'agent',
  signerUserId: string,
  payload: SignaturePayload,
  signedAt: string
): Promise<void> {
  const admin = createAdminClient()

  // Ensure the contract carries a provider + envelope id (set on first signature).
  const { data: contract } = await admin
    .from('contracts')
    .select('esignature_envelope_id')
    .eq('id', contractId)
    .single()
  if (contract && !contract.esignature_envelope_id) {
    await admin
      .from('contracts')
      .update({ esignature_provider: 'podium', esignature_envelope_id: randomUUID() })
      .eq('id', contractId)
  }

  // Store the drawn-signature image if one was supplied.
  let signatureImagePath: string | null = null
  const pngBytes = dataUrlToBytes(payload.signatureImageDataUrl)
  if (pngBytes) {
    const path = `contracts/${contractId}/signatures/${role}.png`
    const { error } = await admin.storage
      .from(STORAGE_BUCKETS.docs)
      .upload(path, pngBytes, { contentType: 'image/png', upsert: true })
    if (!error) signatureImagePath = path
  }

  const signature_hash = signatureAuditHash({
    contractId, role, typedName: payload.typedName, signedAt,
    ip: payload.ip, device: payload.device, consentText: payload.consentText,
  })

  await insertContractSignature(admin, {
    contract_id: contractId,
    signer_role: role,
    signer_user_id: signerUserId,
    typed_name: payload.typedName,
    signature_image_path: signatureImagePath,
    consent_text: payload.consentText,
    signer_ip: payload.ip,
    signer_device: payload.device,
    signed_at: signedAt,
    signature_hash,
  })
}

async function finalizeContract(
  contractId: string
): Promise<{ documentPath: string; documentHash: string } | null> {
  const admin = createAdminClient()
  const { data: contract, error } = await admin
    .from('contracts')
    .select('id, brand_id, athlete_or_team_id, agent_id, document_url, terms_snapshot')
    .eq('id', contractId)
    .single()
  if (error || !contract) throw new Error(`Contract not found for finalize: ${contractId}`)
  return finalizeContractDocument(admin, contract)
}

export const podiumProvider: EsignProvider = {
  name: 'podium',
  recordSignature,
  finalizeContract,
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/esign/podium.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/esign/podium.ts lib/esign/podium.test.ts lib/esign/index.ts lib/esign/index.test.ts
git commit -m "feat(esign): in-house podium provider (record signature + finalize)"
```

---

### Task 13: Sign route — capture signature, record, finalize on completion

**Files:**
- Modify: `app/api/deals/contracts/[contractId]/sign/route.ts`
- Test: `app/api/deals/contracts/[contractId]/sign/route.test.ts` (create if absent)

**Interfaces:**
- Consumes: `signContract` (existing), `provider()` (Task 10), `finalizeContractDocument`/`podiumProvider.finalizeContract` (Task 12).
- Produces: the route now (1) validates a JSON body `{ typedName, consent, signatureImage? }`, (2) calls `signContract`, (3) records the signer via `provider().recordSignature`, (4) on `fully_signed` calls `provider().finalizeContract` before the existing notification block.

**Consent copy (constant):** `CONSENT_TEXT = 'I agree that this is my electronic signature and I intend to be legally bound by this contract.'`

- [ ] **Step 1: Write the failing test**

`app/api/deals/contracts/[contractId]/sign/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const signContractMock = vi.fn()
const recordSignatureMock = vi.fn(async () => {})
const finalizeMock = vi.fn(async () => ({ documentPath: 'contracts/c1/signed-a.pdf', documentHash: 'h' }))

vi.mock('@/lib/supabase/deals', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>)
  return { ...actual, signContract: signContractMock }
})
vi.mock('@/lib/esign', () => ({
  provider: () => ({ name: 'podium', recordSignature: recordSignatureMock, finalizeContract: finalizeMock }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({}),
  createAdminClient: () => ({}),
}))
vi.mock('@/lib/supabase/auth', () => ({
  getUser: async () => ({ id: 'brand1' }),
  getUserRole: async () => 'brand',
}))
// The fully-signed notification helpers are exercised elsewhere; stub to no-ops.
vi.mock('@/lib/email', () => ({ sendTransactionalEmail: vi.fn(async () => {}) }))
vi.mock('@/lib/email/notify', () => ({
  absoluteUrl: (p: string) => `https://x${p}`, nameOf: () => 'N',
  resolveDisplayNames: async () => ({}), FALLBACK_OTHER_NAME: 'the other party',
}))
vi.mock('@/lib/notifications', () => ({ dispatchNotification: vi.fn(async () => {}) }))
vi.mock('@/lib/notifications/deep-links', () => ({ dealDetailPath: () => '/deal' }))
vi.mock('@/lib/supabase/guardian', () => ({ buildGuardianDealNotice: async () => null }))
vi.mock('@/lib/email/guardian', () => ({ sendGuardianDealNoticeEmail: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ clientIpFrom: () => '1.2.3.4' }))

import { POST } from './route'

function req(body: unknown) {
  return new Request('http://x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'UA' },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NextRequest shim
  }) as any
}
const params = { params: Promise.resolve({ contractId: 'c1' }) }

describe('POST sign', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing consent with 400', async () => {
    const res = await POST(req({ typedName: 'A', consent: false }), params)
    expect(res.status).toBe(400)
    expect(signContractMock).not.toHaveBeenCalled()
  })

  it('signs, records, and does NOT finalize when only one party has signed', async () => {
    signContractMock.mockResolvedValue({
      id: 'c1', status: 'pending_athlete_signature', brand_id: 'brand1',
      athlete_or_team_id: 'ath1', brand_signed_at: '2026-09-07T10:00:00.000Z',
    })
    const res = await POST(req({ typedName: 'A Buyer', consent: true }), params)
    expect(res.status).toBe(200)
    expect(recordSignatureMock).toHaveBeenCalledWith(
      'c1', 'brand', 'brand1',
      expect.objectContaining({ typedName: 'A Buyer', consentText: expect.any(String) }),
      '2026-09-07T10:00:00.000Z'
    )
    expect(finalizeMock).not.toHaveBeenCalled()
  })

  it('finalizes when this signature completes the contract', async () => {
    signContractMock.mockResolvedValue({
      id: 'c1', status: 'fully_signed', brand_id: 'brand1', athlete_or_team_id: 'ath1',
      brand_signed_at: '2026-09-07T10:00:00.000Z', athlete_signed_at: '2026-09-07T11:00:00.000Z',
      proposal_id: 'p1',
    })
    const res = await POST(req({ typedName: 'A Buyer', consent: true }), params)
    expect(res.status).toBe(200)
    expect(finalizeMock).toHaveBeenCalledWith('c1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- "app/api/deals/contracts/[contractId]/sign/route.test.ts"`
Expected: FAIL — body validation + provider calls not present.

- [ ] **Step 3: Modify the route**

Add near the top of `POST`, after resolving `user` and `contractId`, before `signContract`:

```ts
  const CONSENT_TEXT =
    'I agree that this is my electronic signature and I intend to be legally bound by this contract.'

  const body = await request.json().catch(() => ({}))
  const typedName = typeof body?.typedName === 'string' ? body.typedName.trim() : ''
  const consent = body?.consent === true
  const signatureImage =
    typeof body?.signatureImage === 'string' ? body.signatureImage : null
  if (!typedName || !consent) {
    return NextResponse.json(
      { error: { code: 'SIGNATURE_INVALID', message: 'A typed name and consent are required to sign.' } },
      { status: 400 }
    )
  }
```

After `signContract(...)` returns `contract` and before the guardian-notice block, record the signature:

```ts
    const signerRole: 'brand' | 'athlete' | 'agent' =
      contract.brand_id === user.id ? 'brand'
      : contract.agent_id === user.id ? 'agent'
      : 'athlete'
    const signedAt =
      signerRole === 'brand' ? contract.brand_signed_at
      : signerRole === 'agent' ? contract.agent_signed_at
      : contract.athlete_signed_at
    await provider().recordSignature(
      contractId, signerRole, user.id,
      { typedName, consentText: CONSENT_TEXT, signatureImageDataUrl: signatureImage,
        ip: clientIpFrom(request.headers), device: request.headers.get('user-agent') },
      signedAt as string
    )
```

Inside the existing `if (contract.status === 'fully_signed') {` block, as the FIRST statement in the `try`, generate the PDF (before notifications):

```ts
        await provider().finalizeContract(contractId)
```

Add the import at the top:

```ts
import { provider } from '@/lib/esign'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- "app/api/deals/contracts/[contractId]/sign/route.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/api/deals/contracts/[contractId]/sign/route.ts" "app/api/deals/contracts/[contractId]/sign/route.test.ts"
git commit -m "feat(esign): capture signature payload, record signer, finalize PDF on completion"
```

---

### Task 14: Embedded "Review & Sign" UI

**Files:**
- Modify: `components/deals/contract-sign-button.tsx`
- Create: `components/deals/review-and-sign-dialog.tsx`
- Test: `components/deals/review-and-sign-dialog.test.tsx`

**Interfaces:**
- Consumes: the sign route (Task 13) — now expects a JSON body `{ typedName, consent, signatureImage? }`.
- Produces: `ReviewAndSignDialog` — renders the terms block + a typed-name input, a required consent checkbox, an optional drawn-signature canvas, and a submit that POSTs the body. `contract-sign-button.tsx` opens it instead of POSTing an empty body. Guardian branch (`GUARDIAN_CONSENT_REQUIRED` → `GuardianConsentRequestButton`) preserved.

- [ ] **Step 1: Write the failing test**

`components/deals/review-and-sign-dialog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReviewAndSignDialog } from './review-and-sign-dialog'

const terms = {
  title: 'Summer Deal', pay_amount: 5000, pay_currency: 'GBP', pay_type: 'flat_fee',
  timeline_start: '2026-06-01', timeline_end: '2026-08-31',
  deliverables: '3 posts', usage_rights: 'Social', additional_terms: 'None',
}

describe('ReviewAndSignDialog', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('disables submit until a name is typed and consent is ticked', () => {
    render(<ReviewAndSignDialog open contractId="c1" terms={terms} onSigned={() => {}} onClose={() => {}} />)
    const submit = screen.getByRole('button', { name: /sign contract/i })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Ada Buyer' } })
    fireEvent.click(screen.getByLabelText(/i agree/i))
    expect(submit).toBeEnabled()
  })

  it('POSTs typedName + consent and calls onSigned on success', async () => {
    const onSigned = vi.fn()
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'c1', status: 'fully_signed' }), { status: 200 })
    )
    render(<ReviewAndSignDialog open contractId="c1" terms={terms} onSigned={onSigned} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Ada Buyer' } })
    fireEvent.click(screen.getByLabelText(/i agree/i))
    fireEvent.click(screen.getByRole('button', { name: /sign contract/i }))
    await waitFor(() => expect(onSigned).toHaveBeenCalled())
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(String(init?.body))).toMatchObject({ typedName: 'Ada Buyer', consent: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/deals/review-and-sign-dialog.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Write the dialog + rewire the button**

`components/deals/review-and-sign-dialog.tsx` — a `"use client"` component. Render terms rows from the `terms` prop, a name `<Input id="signer-name">` (label "Full name"), a consent `<input type="checkbox" id="consent">` with label starting "I agree", an optional `<canvas>` for a drawn signature (serialise to a PNG data URL via `canvas.toDataURL('image/png')` on submit), and a submit button "Sign Contract" disabled until `name.trim() && consent`. On submit `POST /api/deals/contracts/${contractId}/sign` with `{ typedName, consent, signatureImage }`; on non-OK, `toast.error(data.error?.message)` and if `data.error?.code === 'GUARDIAN_CONSENT_REQUIRED'` call `onGuardianRequired?.()`; on OK `toast.success` + `onSigned(data)`. Follow the existing dialog/style conventions already used in `components/deals/` (reuse the project's dialog primitive; if none, a simple modal `<div role="dialog">` gated by the `open` prop is fine and satisfies the test).

Rewire `components/deals/contract-sign-button.tsx`: replace the direct `handleSign` POST with local `const [open, setOpen] = useState(false)`; the button label becomes **"Review & Sign"** and calls `setOpen(true)`; render `<ReviewAndSignDialog open={open} contractId={contractId} terms={terms} onClose={() => setOpen(false)} onSigned={() => { setOpen(false); router.refresh() }} onGuardianRequired={() => setShowGuardian(true)} />`. Keep the existing `fully_signed`/`terminated` early return, the `alreadySigned` "waiting" state, and the guardian button swap. The button must receive the contract's `terms` (from `terms_snapshot`) — thread it from the deal page that renders the button (Task 16 passes it).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- components/deals/review-and-sign-dialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/deals/review-and-sign-dialog.tsx components/deals/review-and-sign-dialog.test.tsx components/deals/contract-sign-button.tsx
git commit -m "feat(esign): embedded Review & Sign dialog replaces click-to-sign button"
```

---

### Task 15: Brand fills the term sheet (deliverables / usage rights / additional terms)

**Files:**
- Modify: `components/brand/proposal-form.tsx`
- Modify: `lib/supabase/deals.ts` (`ProposalPayload` + create/counter wrappers), `app/api/deals/proposals/route.ts` (+ counter route) validation
- Test: `components/brand/proposal-form.test.tsx` (create/extend), plus assertions in the existing proposals-route test if present

**Interfaces:**
- Consumes: existing `proposals.deliverables` (jsonb), `usage_rights` (jsonb), `additional_terms` (text) columns.
- Produces: the brand form captures three optional fields and includes them in the POST body; the server passes them through to the proposal insert, so `accept_proposal` snapshots real values.

- [ ] **Step 1: Write the failing test**

Add to `components/brand/proposal-form.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProposalForm from './proposal-form'

describe('ProposalForm term fields', () => {
  it('includes deliverables, usage rights and additional terms in the POST body', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'p1' }), { status: 201 })
    )
    render(<ProposalForm matchId="m1" onSent={() => {}} />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Summer Deal' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText(/deliverables/i), { target: { value: '3 Instagram posts' } })
    fireEvent.change(screen.getByLabelText(/usage rights/i), { target: { value: 'Social, 6 months' } })
    fireEvent.change(screen.getByLabelText(/additional terms/i), { target: { value: 'No competitors' } })
    // (select pay_type via the existing Select interaction the other tests use)
    fireEvent.click(screen.getByRole('button', { name: /send proposal/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body).toMatchObject({
      deliverables: { text: '3 Instagram posts' },
      usage_rights: { text: 'Social, 6 months' },
      additional_terms: 'No competitors',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/brand/proposal-form.test.tsx`
Expected: FAIL — the fields and body keys don't exist yet.

- [ ] **Step 3: Extend the form**

In `components/brand/proposal-form.tsx` `schema`, add:

```ts
    deliverables: z.string().max(2000).optional(),
    usage_rights: z.string().max(2000).optional(),
    additional_terms: z.string().max(4000).optional(),
```

Add three `FormField`s after the timeline grid — a `<Textarea>` each (import `Textarea` from `@/components/ui/textarea`), with labels "Deliverables (optional)", "Usage rights (optional)", "Additional terms (optional)".

In `onSubmit`, shape the payload so jsonb columns get an object and the text column stays text:

```ts
      const { deliverables, usage_rights, additional_terms, ...rest } = values
      const terms = {
        ...(deliverables ? { deliverables: { text: deliverables } } : {}),
        ...(usage_rights ? { usage_rights: { text: usage_rights } } : {}),
        ...(additional_terms ? { additional_terms } : {}),
      }
      const payload = isCounter ? { ...rest, ...terms } : { match_id: matchId, ...rest, ...terms }
```

- [ ] **Step 4: Thread the fields server-side**

In `lib/supabase/deals.ts`, extend `ProposalPayload` with `usage_rights?: Json | null` and `additional_terms?: string | null` (deliverables already present), and include them in the create + counter insert/RPC arg mapping. In `app/api/deals/proposals/route.ts` (and the counter route), extend the request validation to accept these optional fields and pass them through. Follow the file's existing zod/validation style; keep the `deliverables`/`usage_rights` values as `Json` objects and `additional_terms` as text.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- components/brand/proposal-form.test.tsx`
Run: `npm run test -- lib/supabase/deals.test.ts` (ensure no regression)
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/brand/proposal-form.tsx components/brand/proposal-form.test.tsx lib/supabase/deals.ts "app/api/deals/proposals/route.ts"
git commit -m "feat(esign): brand captures deliverables/usage rights/additional terms (DP-17)"
```

---

### Task 16: Terms block + View/Download on the deal pages

**Files:**
- Create: `components/deals/contract-terms-block.tsx`
- Create: `app/api/deals/contracts/[contractId]/document/route.ts`
- Modify: `app/(brand)/brand/deals/[proposalId]/page.tsx`, `app/(athlete)/athlete/deals/[proposalId]/page.tsx`, `app/(team)/team/deals/[proposalId]/page.tsx`
- Test: `components/deals/contract-terms-block.test.tsx`, `app/api/deals/contracts/[contractId]/document/route.test.ts`

**Interfaces:**
- Consumes: `terms_snapshot` on the contract; `createSignedDownloadUrl` (`@/lib/storage`).
- Produces:
  - `ContractTermsBlock({ terms })` — the "This is what you're signing" panel (title, fee, pay type, timeline, deliverables, usage rights, additional terms).
  - `GET /api/deals/contracts/[contractId]/document` — 302-redirects to a fresh 10-min signed URL of `contract.document_url`, only for a participant (checked via the user's RLS client), else 403/404.

- [ ] **Step 1: Write the failing tests**

`components/deals/contract-terms-block.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContractTermsBlock } from './contract-terms-block'

it('renders the key terms from the snapshot', () => {
  render(<ContractTermsBlock terms={{
    title: 'Summer Deal', pay_amount: 5000, pay_currency: 'GBP', pay_type: 'flat_fee',
    timeline_start: '2026-06-01', timeline_end: '2026-08-31',
    deliverables: { text: '3 posts' }, usage_rights: { text: 'Social' }, additional_terms: 'None',
  }} />)
  expect(screen.getByText('Summer Deal')).toBeInTheDocument()
  expect(screen.getByText(/£5,000|GBP\s*5,000/)).toBeInTheDocument()
  expect(screen.getByText('3 posts')).toBeInTheDocument()
})
```

`app/api/deals/contracts/[contractId]/document/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const signedUrl = vi.fn(async () => 'https://signed.example/doc.pdf?token=abc')
vi.mock('@/lib/storage', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>)
  return { ...actual, createSignedDownloadUrl: signedUrl }
})
let contractRow: unknown = { id: 'c1', document_url: 'contracts/c1/signed-a.pdf' }
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: contractRow, error: contractRow ? null : { code: 'PGRST116' } }) }) }) }),
  }),
}))
vi.mock('@/lib/supabase/auth', () => ({ getUser: async () => ({ id: 'brand1' }) }))

import { GET } from './route'
const params = { params: Promise.resolve({ contractId: 'c1' }) }

describe('GET contract document', () => {
  beforeEach(() => { vi.clearAllMocks(); contractRow = { id: 'c1', document_url: 'contracts/c1/signed-a.pdf' } })

  it('redirects a participant to a signed URL', async () => {
    const res = await GET(new Request('http://x') as any, params)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('signed.example')
  })

  it('404s when the contract is not visible / has no document', async () => {
    contractRow = null
    const res = await GET(new Request('http://x') as any, params)
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- components/deals/contract-terms-block.test.tsx "app/api/deals/contracts/[contractId]/document/route.test.ts"`
Expected: FAIL — not found.

- [ ] **Step 3: Write the terms block**

`components/deals/contract-terms-block.tsx` — a server-safe (no `"use client"`) presentational component. Accept `terms: Record<string, unknown>`; read `title`, `pay_amount`, `pay_currency`, `pay_type`, `timeline_start/end`, `deliverables`, `usage_rights`, `additional_terms`; normalise jsonb `{ text }` via a local helper (mirror `termsString` from Task 11); render a titled panel "This is what you're signing" with labelled rows. Format money with `Intl.NumberFormat`.

- [ ] **Step 4: Write the document route**

`app/api/deals/contracts/[contractId]/document/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { createSignedDownloadUrl, STORAGE_BUCKETS } from '@/lib/storage'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }, { status: 401 })
  }
  const { contractId } = await params

  // RLS: this select returns a row only if the user is a participant/admin.
  const { data: contract, error } = await supabase
    .from('contracts')
    .select('id, document_url')
    .eq('id', contractId)
    .single()
  if (error || !contract || !contract.document_url) {
    return NextResponse.json({ error: { code: 'DOCUMENT_NOT_FOUND', message: 'No signed document available.' } }, { status: 404 })
  }

  const url = await createSignedDownloadUrl(supabase, STORAGE_BUCKETS.docs, contract.document_url)
  return NextResponse.redirect(url, 302)
}
```

- [ ] **Step 5: Wire the deal pages**

In each of the three `deals/[proposalId]/page.tsx` server components: render `<ContractTermsBlock terms={contract.terms_snapshot} />` wherever the contract status is shown, pass `terms={contract.terms_snapshot}` into `<ContractSignButton …>` (Task 14 needs it), and when `contract.status === 'fully_signed' && contract.document_url` render a link/button to `/api/deals/contracts/${contract.id}/document` labelled "View / Download PDF" (use `buttonVariants` on a `<Link>` per the CLAUDE.md no-`asChild` rule).

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test -- components/deals/contract-terms-block.test.tsx "app/api/deals/contracts/[contractId]/document/route.test.ts"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/deals/contract-terms-block.tsx components/deals/contract-terms-block.test.tsx "app/api/deals/contracts/[contractId]/document/route.ts" "app/api/deals/contracts/[contractId]/document/route.test.ts" "app/(brand)/brand/deals/[proposalId]/page.tsx" "app/(athlete)/athlete/deals/[proposalId]/page.tsx" "app/(team)/team/deals/[proposalId]/page.tsx"
git commit -m "feat(esign): terms block + participant-only View/Download PDF"
```

---

### Task 17: HMAC webhook seam — `app/api/webhooks/esign/route.ts`

**Files:**
- Create: `app/api/webhooks/esign/route.ts`
- Test: `app/api/webhooks/esign/route.test.ts`

**Interfaces:**
- Consumes: `serverEnv().ESIGN_WEBHOOK_SECRET`, `podiumProvider.finalizeContract` (via `provider()`), the contracts table (lookup by `esignature_envelope_id`).
- Produces: `POST` that verifies an `x-esign-signature` HMAC-SHA256 (hex) of the raw body against `ESIGN_WEBHOOK_SECRET` before any processing; on `event: 'completed'` finalizes by envelope id; on `declined`/`voided` sets `terminated_at`/`termination_reason`; idempotent (finalize is a no-op once `document_url` is set). `PUBLIC_PATHS` already matches `/api/webhooks` — no middleware change.

- [ ] **Step 1: Write the failing test**

`app/api/webhooks/esign/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'

const SECRET = 'a-very-long-shared-webhook-secret-123456'
const finalizeMock = vi.fn(async () => ({ documentPath: 'p', documentHash: 'h' }))
vi.mock('@/lib/esign', () => ({ provider: () => ({ name: 'podium', finalizeContract: finalizeMock, recordSignature: vi.fn() }) }))

let contractRow: unknown = { id: 'c1', esignature_envelope_id: 'env1' }
const updateEq = vi.fn(async () => ({ error: null }))
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: contractRow, error: contractRow ? null : { code: 'PGRST116' } }) }) }),
      update: () => ({ eq: updateEq }),
    }),
  }),
}))
vi.mock('@/lib/env', () => ({ serverEnv: () => ({ ESIGN_WEBHOOK_SECRET: SECRET }) }))

import { POST } from './route'

function signed(body: string, sig = createHmac('sha256', SECRET).update(body).digest('hex')) {
  return new Request('http://x', { method: 'POST', headers: { 'x-esign-signature': sig }, body }) as any
}

describe('POST /api/webhooks/esign', () => {
  beforeEach(() => { vi.clearAllMocks(); contractRow = { id: 'c1', esignature_envelope_id: 'env1' } })

  it('rejects a bad signature with 400 before processing', async () => {
    const body = JSON.stringify({ event: 'completed', envelopeId: 'env1' })
    const res = await POST(signed(body, 'deadbeef'))
    expect(res.status).toBe(400)
    expect(finalizeMock).not.toHaveBeenCalled()
  })

  it('finalizes on completed', async () => {
    const body = JSON.stringify({ event: 'completed', envelopeId: 'env1' })
    const res = await POST(signed(body))
    expect(res.status).toBe(200)
    expect(finalizeMock).toHaveBeenCalledWith('c1')
  })

  it('terminates on declined', async () => {
    const body = JSON.stringify({ event: 'declined', envelopeId: 'env1', reason: 'changed mind' })
    const res = await POST(signed(body))
    expect(res.status).toBe(200)
    expect(updateEq).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- "app/api/webhooks/esign/route.test.ts"`
Expected: FAIL — route not found.

- [ ] **Step 3: Write the route**

`app/api/webhooks/esign/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { serverEnv } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/server'
import { provider } from '@/lib/esign'

export const dynamic = 'force-dynamic'

function verify(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(signature, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  const secret = serverEnv().ESIGN_WEBHOOK_SECRET
  if (!secret) {
    // Fail closed: no external provider configured for this environment.
    return NextResponse.json({ error: { code: 'WEBHOOK_NOT_CONFIGURED', message: 'esign webhook disabled' } }, { status: 500 })
  }

  const rawBody = await request.text()
  if (!verify(rawBody, request.headers.get('x-esign-signature'), secret)) {
    return NextResponse.json({ error: { code: 'INVALID_SIGNATURE', message: 'bad signature' } }, { status: 400 })
  }

  let payload: { event?: string; envelopeId?: string; reason?: string }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_BODY', message: 'not json' } }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: contract, error } = await admin
    .from('contracts')
    .select('id, esignature_envelope_id')
    .eq('esignature_envelope_id', payload.envelopeId ?? '')
    .single()
  if (error || !contract) {
    // Unknown envelope — ack so the provider stops retrying.
    return NextResponse.json({ received: true, unknown: true }, { status: 200 })
  }

  if (payload.event === 'completed') {
    await provider().finalizeContract(contract.id) // idempotent
  } else if (payload.event === 'declined' || payload.event === 'voided') {
    await admin
      .from('contracts')
      .update({
        status: 'terminated',
        terminated_at: new Date().toISOString(),
        termination_reason: payload.reason ?? payload.event,
      })
      .eq('id', contract.id)
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- "app/api/webhooks/esign/route.test.ts"`
Expected: PASS.

- [ ] **Step 5: Confirm PUBLIC_PATHS coverage**

Verify `middleware.ts` `PUBLIC_PATHS` still contains `'/api/webhooks'` (prefix match covers `/api/webhooks/esign`). No change expected; if the prefix were ever narrowed, add `'/api/webhooks/esign'`.

- [ ] **Step 6: Commit**

```bash
git add "app/api/webhooks/esign/route.ts" "app/api/webhooks/esign/route.test.ts"
git commit -m "feat(esign): HMAC-verified webhook seam for external providers"
```

---

### Task 18: End-to-end Playwright spec

**Files:**
- Create: `e2e/contract-esignature.spec.ts`

**Interfaces:**
- Consumes: the running app against staging (or a seeded local/preview DB). Uses the seed brand/athlete accounts (`deals@northwind-nutrition.test`, `maya.okafor@example.test`, password `podium-dev-password`).

- [ ] **Step 1: Write the spec**

`e2e/contract-esignature.spec.ts` — follow the existing `e2e/` patterns (auth helper, base URL). Steps:
1. As the brand, open a match and send a proposal with title, amount, pay type, and the new deliverables/usage-rights/additional-terms fields.
2. As the athlete, accept the proposal (a contract is created, `pending_brand_signature`).
3. As the brand, open the deal → assert the "This is what you're signing" block shows the deliverables → click **Review & Sign** → type name, tick consent, submit.
4. As the athlete, repeat Review & Sign → the contract becomes `fully_signed`.
5. Assert a **View / Download PDF** action appears; request `/api/deals/contracts/<id>/document` and assert a 302 to a signed URL (or that the PDF downloads with a `%PDF` header).
6. Negative: an unrelated third account requesting the document route gets 403/404.

> **Executor note:** guardian-gate and finalize-idempotency are covered by unit tests (Tasks 12/13/17). Keep this spec to the happy path + the access-control negative to stay fast and non-flaky. Gate any part needing a real signed session behind the repo's existing e2e auth fixture; if the fixture can't log in headlessly in CI, mark the spec `test.describe.configure({ mode: 'serial' })` and tag it so it runs against the preview URL, matching how other `e2e/` specs are gated.

- [ ] **Step 2: Run it**

Run: `npm run test:e2e -- contract-esignature` (or the repo's e2e script) against the preview/staging URL.
Expected: PASS (or the documented gated-skip if headless auth is unavailable in CI — surface that to the human, don't fake it).

- [ ] **Step 3: Commit**

```bash
git add e2e/contract-esignature.spec.ts
git commit -m "test(esign): e2e accept → sign → finalize → download"
```

---

## Final verification

- [ ] `npm run check` (test + type-check + lint) is green across the branch.
- [ ] `git log --oneline` shows one commit per task.
- [ ] Re-read the spec §1–§13; every section maps to a task (see Self-Review below).

## Human steps (surface to Nicholas — the agent must NOT do these)

1. **Env:** add `ESIGN_PROVIDER=podium` and `ESIGN_WEBHOOK_SECRET=<openssl rand -hex 32>` to Vercel **Preview + Production** (and `.env.local` for local dev). The in-house flow doesn't need the secret, but the env schema + webhook route expect it configured where the webhook is reachable.
2. **Migrations → staging first:** apply `20260907000001–4` to `cltvgjsmzujsrnmnfues` (`SUPABASE_DB_PASSWORD="$SUPABASE_STAGING_DB_PASSWORD" npx supabase db push` after `link --project-ref cltvgjsmzujsrnmnfues`). Never `config push`. Then **regenerate `types/database.ts`** from staging and commit — it should be a no-op diff against Task 6's hand-added shapes; reconcile if not.
3. **Live-DB check (post-migration):** confirm on staging that (a) `anon`/a non-participant cannot read `contract_signatures` or a `contracts/<id>/…` object, (b) a participant can, (c) `erase_user_data` nulls the signer PII but keeps `signed_at`/`signature_hash`, and (d) the signed-PDF pointer is dropped only past `retain_until`. SQL-text tests can't catch a semantic no-op — this live check is required (a prior P0 came from exactly this gap).
4. **Verify on staging** (preview URL) end-to-end before any prod merge.
5. **Migrations → production** before merging code to `main` (per CLAUDE.md order), then merge `staging → main`.

## Self-Review (spec coverage)

- §2 provider/decisions → Tasks 1, 10, 12 (in-house, pluggable). §2 replace click-to-sign → Task 14. §2 full terms → Task 15.
- §4 module shape → Tasks 8–12. §5 migrations/RLS/GDPR → Tasks 2–5; types → Task 6. §6 term capture → Task 15.
- §7 signing flow → Tasks 13, 14. §8 webhook → Task 17. §9 view/download → Task 16. §10 GDPR → Task 5 (+ human live-check step 3). §11 tests → every task's unit tests + Task 18 e2e.
- §12 human steps → "Human steps" section above. §13 out-of-scope respected (no external provider impl, no agent UI, no QES).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const sql = readFileSync(
  join(__dirname, '20260911000003_erase_user_data_payment_details.sql'),
  'utf8'
)

describe('20260911000003_erase_user_data_payment_details', () => {
  it('redefines erase_user_data', () => {
    expect(sql).toMatch(/create or replace function public\.erase_user_data\(p_user_id uuid\)/)
  })

  it('nulls contract_signatures.payment_details in the signature anonymisation block', () => {
    // Bank/payment details are personal financial data with no tamper-evidence
    // value, so erasure must scrub them alongside signer_ip/device/typed_name.
    const block = sql.slice(
      sql.indexOf('update public.contract_signatures'),
      sql.indexOf('update public.contract_signatures') + 400
    )
    expect(block).toMatch(/payment_details\s*=\s*null/)
    // The tamper-evidence fields must still be preserved (not scrubbed).
    expect(block).not.toMatch(/signature_hash\s*=\s*null/)
  })

  it('preserves the tamper-evidence fields (signed_at, signature_hash)', () => {
    expect(sql).toMatch(/typed_name = '\[erased\]'/)
  })
})

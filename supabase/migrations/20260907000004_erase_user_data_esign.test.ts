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
  it('deletes the underlying signed-PDF/signature storage objects once retention expires', () => {
    expect(sql).toMatch(/delete from storage\.objects/)
    expect(sql).toMatch(/bucket_id = 'docs'/)
    expect(sql).toMatch(/'contracts'/)
    expect(sql).toMatch(/retain_until is not null and c\.retain_until <= now\(\)/)
  })
})

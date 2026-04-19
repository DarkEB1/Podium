# /new-migration

1. Read ALL existing files in `supabase/migrations/` — never assume current schema state
2. Read `docs/claude/architecture.md` for the current data model
3. Write the migration SQL
4. Create the migration file with a timestamp prefix:
   `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
5. Write the corresponding RLS policy in the same file or a companion policy file
6. Run `supabase db push` to apply to local Supabase instance
7. Run `npm run supabase:types` to regenerate `types/database.ts`
8. Update `docs/claude/architecture.md` if the schema change affects the documented data model
9. Apply Bayesian confidence protocol (≥95%)
10. Commit the migration file BEFORE committing any code that depends on it:
    `feat(db): add <description> migration`

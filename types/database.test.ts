// B7 — Types regen guard.
// Asserts types/database.ts (regenerated from the full B1–B6 migration set)
// exposes every new table, enum, and key column. This is a compile-time +
// runtime guard: the type assertions below fail `tsc` if a table/column is
// missing, and the string check fails vitest if the file was never regenerated.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Database } from "./database";

// --- Compile-time guard: this type only resolves if every listed table Row
// and enum exists in the regenerated Database type. A missing table/enum is a
// tsc error (caught by `npm run type-check`), so the regen is verified at the
// type level in addition to the runtime string assertions below.
type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];

// Tuple references force structural use of each new B1–B6 type. `void` keeps
// it side-effect free; `RegenGuard` resolving at all is the assertion.
type RegenGuard = [
  // B3
  Tables["profile_settings"]["Row"],
  // B4
  Tables["auth_2fa"]["Row"],
  Tables["active_sessions"]["Row"],
  Tables["login_history"]["Row"],
  Tables["data_export_requests"]["Row"],
  // B5
  Tables["payment_methods"]["Row"],
  // B6
  Tables["team_admins"]["Row"],
  // Enums (B1 + B3 + B4 + B5 + B6)
  Enums["seeking_type"],
  Enums["athlete_level"],
  Enums["email_digest"],
  Enums["data_export_status"],
  Enums["payout_method"],
  Enums["agent_verification_status"],
  Enums["team_admin_role"],
];
const _regenGuard = (g: RegenGuard): void => void g;
void _regenGuard;

describe("types/database.ts (B7 regen)", () => {
  const file = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "database.ts"),
    "utf8",
  );

  it.each([
    "profile_settings",
    "auth_2fa",
    "active_sessions",
    "login_history",
    "data_export_requests",
    "payment_methods",
    "team_admins",
  ])("includes new table %s", (table) => {
    expect(file).toContain(`${table}: {`);
  });

  it.each([
    "seeking_type",
    "email_digest",
    "location_precision",
    "display_currency",
    "data_export_status",
    "payout_method",
    "stripe_connect_status",
    "agent_verification_status",
    "team_admin_role",
  ])("includes new enum %s", (enumName) => {
    expect(file).toContain(`${enumName}:`);
  });

  it("extends athlete_level enum with the new B1 values", () => {
    expect(file).toContain("university_bucs");
    expect(file).toContain("academy");
    expect(file).toContain("national");
  });

  it("adds B1 athlete_profiles level-detail columns", () => {
    expect(file).toContain("university_team");
    expect(file).toContain("highest_level");
    expect(file).toContain("academy_club");
    expect(file).toContain("national_programme");
  });
});

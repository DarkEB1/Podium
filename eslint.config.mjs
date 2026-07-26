import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * SB-11 — mechanical enforcement of the CLAUDE.md rule
 * "No Supabase calls outside `lib/supabase/`".
 *
 * The rule had been violated repeatedly (page components querying tables
 * directly) because nothing checked it. Two complementary rules:
 *
 *   1. `no-restricted-syntax` — UI code and route handlers may not issue a
 *      PostgREST query (`.from()`, `.rpc()`, `.storage.from()`) on a client,
 *      however they got hold of one. This is the rule that catches the actual
 *      historical violations, because they imported a *sanctioned* helper
 *      (`lib/supabase/server`) and then queried through it.
 *   2. `no-restricted-imports` — UI code may not reach for a raw Supabase SDK,
 *      and `components/**` may not construct a server client at all.
 *
 * Deliberately NOT banned: `@/lib/supabase/server` in `app/**`. Roughly 45
 * Server Components and route handlers correctly do
 * `const supabase = await createClient()` and hand that client to a named
 * `lib/supabase/` helper — that IS the architecture, and banning it would flag
 * the entire app. Rule 1 is what stops those files querying directly.
 *
 * `lib/**`, `middleware.ts` and tests are unconstrained: `lib/supabase/**` is
 * the allowed layer, and middleware must build an edge client to refresh
 * sessions.
 */

/** Identifiers that, outside lib/, denote a Supabase client. */
const CLIENT_IDENT =
  "/^(supabase|sb|client|db|admin|adminSupabase|adminClient|browserClient|serverClient)$/";

const QUERY_MESSAGE =
  "No Supabase queries outside lib/supabase/ (CLAUDE.md). Move this .from()/.rpc() into a named helper in lib/supabase/ and call that instead.";

const SUPABASE_QUERY_SYNTAX = [
  {
    // supabase.from(...) / supabase.rpc(...)
    selector: `CallExpression[callee.type='MemberExpression'][callee.property.name=/^(from|rpc)$/][callee.object.name=${CLIENT_IDENT}]`,
    message: QUERY_MESSAGE,
  },
  {
    // (await createClient()).from(...)
    selector:
      "CallExpression[callee.type='MemberExpression'][callee.property.name=/^(from|rpc)$/][callee.object.type='AwaitExpression'][callee.object.argument.callee.name='createClient']",
    message: QUERY_MESSAGE,
  },
  {
    // supabase.storage.from(...)
    selector: `CallExpression[callee.type='MemberExpression'][callee.property.name='from'][callee.object.type='MemberExpression'][callee.object.property.name='storage'][callee.object.object.name=${CLIENT_IDENT}]`,
    message:
      "No Supabase Storage calls outside lib/storage/ (CLAUDE.md). Large uploads go through a presigned URL from app/api/upload/.",
  },
];

/** Raw SDK entry points — never imported outside lib/ and middleware.ts. */
const RESTRICTED_SDK_IMPORTS = [
  {
    name: "@supabase/supabase-js",
    message:
      "Import a helper from lib/supabase/ instead. Raw SDK clients are constructed only in lib/supabase/{server,client}.ts.",
  },
  {
    name: "@supabase/ssr",
    message:
      "Import a helper from lib/supabase/ instead. The SSR client is constructed only in lib/supabase/server.ts and middleware.ts.",
  },
];

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },

  // ── SB-11: no direct queries anywhere outside lib/ ────────────────────────
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...SUPABASE_QUERY_SYNTAX],
      "no-restricted-imports": ["error", { paths: RESTRICTED_SDK_IMPORTS }],
    },
  },

  // ── SB-11: components/ is stricter than app/ ──────────────────────────────
  // A Server Component may create the server client and pass it to a helper; a
  // component under components/ should receive data as props.
  {
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...RESTRICTED_SDK_IMPORTS,
            {
              name: "@/lib/supabase/server",
              message:
                "components/ must not create a server client. Fetch in the Server Component that renders this and pass the data down as props.",
            },
          ],
        },
      ],
      // Warning, not error, and deliberately so: six client components today
      // (agent/agent-settings-form, athlete/settings-form,
      // legal/cookie-consent-store, messaging/chat-window,
      // team/team-profile-form, ui/image-upload) construct a browser client
      // purely to hand it to a lib/supabase or lib/realtime helper. That is the
      // only pattern available to an interactive client component, so erroring
      // would fail the build on correct code. Expressed through the
      // typescript-eslint extension rule so it can carry a different severity
      // from the base rule above, which ESLint would otherwise overwrite.
      "@typescript-eslint/no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@/lib/supabase/client",
              message:
                "Prefer fetching in a Server Component and passing data down. If this component must talk to Supabase interactively, keep every query inside a lib/supabase/ helper and pass the client to it.",
            },
          ],
        },
      ],
    },
  },

  // Tests may import and stub anything.
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "e2e/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": "off",
      "no-restricted-syntax": "off",
    },
  },
];

export default eslintConfig;

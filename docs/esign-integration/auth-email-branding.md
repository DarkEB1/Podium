# Branded Supabase Auth Emails

## What changed and why

Podium's transactional emails (connection requests, proposals, contracts, payments, subscriptions) are already branded through `lib/email/render.ts` and `lib/email/templates.ts`. The Supabase Auth emails (signup confirmation, password reset, magic link, email change, invite) were still the plain Supabase defaults, so a user's first touch with Podium looked unbranded and off-brand.

This change adds five branded HTML templates that mirror the transactional email shell (same off-white background, white card, Podium wordmark, ink body text, accent button, muted footer). They are static HTML with Go-template variables that Supabase substitutes at send time. They do not use the app's `html`/`raw` escaping helpers, because Supabase renders them directly.

Files added under `supabase/templates/`:

- `confirmation.html`: signup email confirmation
- `recovery.html`: password reset
- `magic_link.html`: passwordless sign-in
- `email_change.html`: email change confirmation
- `invite.html`: team/user invite

A matching (commented-out) config block was added to `supabase/config.toml` next to the existing auth email template region.

## How to apply (human step, not the agent)

These templates are PREPARED, not applied. Nothing was pushed to any hosted Supabase project.

- Production: apply via the Supabase dashboard (Authentication -> Emails). In the dashboard the `content_path` mechanism is not used. Paste the HTML below directly into each template's body field, and put the subject line into the subject field.
- Staging: apply either via the dashboard, or via a carefully reviewed `supabase config push` that Nicholas runs himself. The agent must never run `config push` on this machine: the local CLI ignores `[remotes.X]` and pushes base local-dev auth to the linked project, which has clobbered prod auth before (see memory `podium-supabase-config-push-hazard`).

The config block in `supabase/config.toml` is left fully commented out on purpose so a local `supabase start` does not change behaviour and no accidental push activates it.

## Subject lines

| Template | Subject |
|---|---|
| confirmation | Confirm your Podium email |
| recovery | Reset your Podium password |
| magic_link | Your Podium sign-in link |
| email_change | Confirm your new Podium email |
| invite | You have been invited to Podium |

## Supabase variables used

Only Supabase-supported Go-template variables are used:

- `{{ .ConfirmationURL }}`: the action link (used as the primary button href in every template)
- `{{ .Token }}`: the numeric/one-time code shown as a paste-in fallback (all except invite)
- `{{ .Email }}`: the current account email (email_change only)
- `{{ .NewEmail }}`: the new account email (email_change only)

Not used but available if needed: `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .RedirectTo }}`.

## Full template HTML (paste into the dashboard)

### confirmation.html (subject: Confirm your Podium email)

```html
<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#F4F6FA;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">Confirm your email to finish setting up your Podium account.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FA;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;">
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#2E3440;">Podium</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px 32px;color:#2E3440;font-size:15px;line-height:1.55;">
              <p style="margin:0 0 12px;">Welcome to Podium.</p>
              <p style="margin:0 0 12px;">You signed up with this email address. Confirm it to activate your account and get started.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                <tr>
                  <td style="border-radius:8px;background:#456489;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:11px 22px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Confirm your email</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;color:#434C5E;font-size:13px;">Or paste this code: <strong style="color:#2E3440;">{{ .Token }}</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px 32px;border-top:1px solid #E5E9F0;color:#434C5E;font-size:12px;line-height:1.6;">
              You are receiving this because someone used this email address to sign up for Podium. If this was not you, you can ignore this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### recovery.html (subject: Reset your Podium password)

```html
<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#F4F6FA;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">Reset the password for your Podium account.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FA;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;">
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#2E3440;">Podium</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px 32px;color:#2E3440;font-size:15px;line-height:1.55;">
              <p style="margin:0 0 12px;">We received a request to reset the password for your Podium account.</p>
              <p style="margin:0 0 12px;">Click the button below to choose a new password. This link expires after a short time, so use it soon.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                <tr>
                  <td style="border-radius:8px;background:#456489;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:11px 22px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Reset your password</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;color:#434C5E;font-size:13px;">Or paste this code: <strong style="color:#2E3440;">{{ .Token }}</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px 32px;border-top:1px solid #E5E9F0;color:#434C5E;font-size:12px;line-height:1.6;">
              You are receiving this because someone asked to reset the password for this email address on Podium. If this was not you, you can ignore this email and your password will stay the same.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### magic_link.html (subject: Your Podium sign-in link)

```html
<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#F4F6FA;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">Your sign-in link for Podium.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FA;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;">
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#2E3440;">Podium</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px 32px;color:#2E3440;font-size:15px;line-height:1.55;">
              <p style="margin:0 0 12px;">Here is your sign-in link for Podium.</p>
              <p style="margin:0 0 12px;">Click the button below to sign in. No password needed. This link expires after a short time, so use it soon.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                <tr>
                  <td style="border-radius:8px;background:#456489;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:11px 22px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Sign in to Podium</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;color:#434C5E;font-size:13px;">Or paste this code: <strong style="color:#2E3440;">{{ .Token }}</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px 32px;border-top:1px solid #E5E9F0;color:#434C5E;font-size:12px;line-height:1.6;">
              You are receiving this because someone used this email address to sign in to Podium. If this was not you, you can ignore this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### email_change.html (subject: Confirm your new Podium email)

```html
<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#F4F6FA;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">Confirm the new email address for your Podium account.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FA;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;">
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#2E3440;">Podium</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px 32px;color:#2E3440;font-size:15px;line-height:1.55;">
              <p style="margin:0 0 12px;">You asked to change the email address on your Podium account.</p>
              <p style="margin:0 0 12px;">The account email is changing from <strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong>. Confirm the change to keep it.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                <tr>
                  <td style="border-radius:8px;background:#456489;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:11px 22px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Confirm email change</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;color:#434C5E;font-size:13px;">Or paste this code: <strong style="color:#2E3440;">{{ .Token }}</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px 32px;border-top:1px solid #E5E9F0;color:#434C5E;font-size:12px;line-height:1.6;">
              You are receiving this because someone asked to change the email address on a Podium account. If this was not you, you can ignore this email and no change will be made.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### invite.html (subject: You have been invited to Podium)

```html
<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#F4F6FA;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">You have been invited to join Podium.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FA;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;">
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#2E3440;">Podium</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px 32px;color:#2E3440;font-size:15px;line-height:1.55;">
              <p style="margin:0 0 12px;">You have been invited to join Podium.</p>
              <p style="margin:0 0 12px;">Accept the invite below to set up your account and get started.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                <tr>
                  <td style="border-radius:8px;background:#456489;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:11px 22px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Accept your invite</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px 32px;border-top:1px solid #E5E9F0;color:#434C5E;font-size:12px;line-height:1.6;">
              You are receiving this because someone invited this email address to Podium. If you were not expecting this, you can ignore this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

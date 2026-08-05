# DNS setup for podiumsponsorship.com

Everything on this page happens in the Turbify control panel (your DNS host, formerly Yahoo Small Business): log in at turbify.com, open Domains, select podiumsponsorship.com, and go to the DNS / Advanced DNS editor. These are the only manual steps left in the launch setup; everything else is already configured.

Add the records exactly as written. Where Turbify asks for a TTL, use the default.

## 1. Point the site at Vercel

| Type | Host / Name | Value |
|------|-------------|-------|
| A | @ (or leave blank, meaning the root domain) | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |

Notes:

- Prerequisite: the domain must be added to the Vercel project first (Vercel dashboard, podium project, Settings, Domains, add `podiumsponsorship.com` and `www.podiumsponsorship.com` with www redirecting to the apex). If you have not done that yet, do it before pasting these records.
- After adding the domain, the Vercel Domains page shows the values it expects. They should match the table above; if Vercel shows a different A record IP or an extra TXT record starting with `_vercel` (ownership verification), use what Vercel shows. That TXT record, if requested, looks like: Type TXT, Host `_vercel`, Value `vc-domain-verify=...`.
- If Turbify has an existing A record or "website forwarding" entry for the root domain, remove it first. Two conflicting A records will make the site load intermittently.

## 2. Email sending (Resend)

These three records let Resend send transactional email (signup confirmations, guardian consent links, deal notifications) as podiumsponsorship.com. Without them, no email leaves the platform.

Two TXT records. TXT records never have a priority, so Turbify's TXT form has no such field; just host and value:

| Type | Host / Name | Value |
|------|-------------|-------|
| TXT | resend._domainkey | p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDtFSUim9KdBXwvEMSXS6zrRQv3sYCVhk7tUditYSf6jLwRxqtGjacQsZ/+3ABt/BvtUimYmQHIfA6AInRzGBm0OxlmBU7pHB3X85Lwcj/dAMk4J7i6NAdTtfrZwtt4FPXw+7TGRL49XQAPp8N47UECkGjb1wyq2Em8uRX6Ci11awIDAQAB |
| TXT | send | v=spf1 include:amazonses.com ~all |

One MX record, and this is the awkward one at Turbify. The record must live on the host `send`, but Turbify's MX form is a single all-in-one **Mail Server Host Name** field with no host/name column, which can only write MX records for the root domain. That form cannot create this record, and putting the value in it anyway would wrongly reroute mail for the root domain itself.

| Type | Host / Name | Mail server (the "value") | Priority |
|------|-------------|----------------------------|----------|
| MX | send | feedback-smtp.eu-west-1.amazonses.com | 10 |

Order of attack for this record:

1. Look for an **Advanced DNS Editor** in the Turbify Domain Control Panel (distinct from Mail/Email settings, which are always root-only). If its MX form has a host/name box, create the record there with host `send`.
2. If the advanced editor has the same all-in-one form, Turbify cannot host this record; use the Cloudflare fallback in the note below. Resend will not verify the domain (and email will not send) until all three records exist.

Notes:

- The DKIM value (first TXT record) is one long unbroken string. Paste it whole; some DNS editors silently truncate, so after saving, reopen the record and check the ending is `...awIDAQAB`.
- The MX record is on the host `send`, not the root domain. It does not affect any mailbox you have on the root domain and does not receive mail.
- **Cloudflare fallback** (if Turbify cannot host the `send` MX record): move DNS management, not the domain itself, to Cloudflare's free tier. Add the domain at cloudflare.com and let it import the existing records; Cloudflare then shows two nameservers; at Turbify, replace `ns1/ns2.turbify.com` with that pair. Turbify remains the registrar, only record management moves, and a nameserver change can take up to a day to propagate. Then add every record in this document at Cloudflare (its forms have proper host fields for all record types). Alternatively, create a Cloudflare API token (My Profile, API Tokens, "Edit zone DNS" template scoped to this domain), put it in `.env.local` as `CLOUDFLARE_API_TOKEN=...`, and Claude can create and verify all the records via the API.

## 3. Recommended: DMARC

Not required by Resend, but it improves deliverability and stops others spoofing the domain:

| Type | Host / Name | Value |
|------|-------------|-------|
| TXT | _dmarc | v=DMARC1; p=none; |

You can tighten `p=none` to `p=quarantine` later, once you have seen a few weeks of legitimate mail flowing.

## 4. Verify it worked

DNS changes at Turbify usually propagate in minutes but can take a few hours.

1. **Site**: Vercel dashboard, podium project, Settings, Domains. Both entries should show "Valid Configuration". Then https://podiumsponsorship.com should load the live site.
2. **Email**: Resend dashboard, Domains, podiumsponsorship.com, press Verify. All three records should turn green and the domain status becomes "Verified". Transactional email starts working the moment this is green.
3. If either stays unverified after a few hours, the usual culprit is a Turbify quirk: it sometimes appends the domain to the host field, creating `send.podiumsponsorship.com.podiumsponsorship.com`. Check the saved records read exactly `send`, `resend._domainkey`, `_dmarc`, and `_vercel` (if used) as the host.

## What this unlocks

- Records in section 1: the site is live at https://podiumsponsorship.com (until then it is only reachable at https://podium-lyart.vercel.app).
- Records in section 2: signup, password reset, guardian consent, and deal emails actually send.
- Nothing else in the stack is waiting on DNS.

import type { Metadata } from 'next'
import Link from 'next/link'
import Footer from '@/components/layout/footer'
import { LegalPage, LegalSection } from '@/components/legal/legal-page'
import {
  CONTROLLER,
  POLICY_EFFECTIVE_DATE,
  PRIVACY_VERSION,
} from '@/lib/legal/versions'

export const metadata: Metadata = {
  title: 'Privacy Policy · Podium',
  description:
    'How Podium collects, uses, shares and retains personal data under UK GDPR, and how to exercise your data protection rights.',
}

export default function PrivacyPage() {
  return (
    <>
      <LegalPage
        title="Privacy Policy"
        version={PRIVACY_VERSION}
        effectiveDate={POLICY_EFFECTIVE_DATE}
        intro="This policy explains what personal data Podium collects, why, on what lawful basis, who we share it with, how long we keep it, and the rights you have under the UK GDPR and the Data Protection Act 2018."
      >
        <LegalSection id="controller" heading="1. Who is responsible for your data">
          <p>
            {CONTROLLER.legalEntity} is the <strong>controller</strong> of the
            personal data described in this policy. We are based in the{' '}
            {CONTROLLER.country}.
          </p>
          <p>
            Data protection enquiries and rights requests:{' '}
            <a href={`mailto:${CONTROLLER.privacyEmail}`}>
              {CONTROLLER.privacyEmail}
            </a>
            . Our registration with the Information Commissioner&apos;s Office
            (ICO), and the identity of our data protection contact, will be
            confirmed here before launch.
          </p>
          <p>
            Where a brand and an athlete conclude a deal, each party remains a
            controller of the personal data they hold about the other for their
            own purposes. We are not responsible for what a counterparty does
            with data you choose to share with them.
          </p>
        </LegalSection>

        <LegalSection id="what-we-collect" heading="2. What personal data we collect">
          <p>
            <strong>Account data (all users).</strong> Email address, hashed
            password (held by our authentication provider — we never see your
            password), account role, email verification state, the version and
            timestamp of the Terms and Privacy Policy you accepted, your cookie
            preferences, and account lifecycle timestamps including deactivation
            and deletion requests.
          </p>
          <p>
            <strong>Athlete profile data.</strong> Display name, full legal
            name, date of birth and the derived flag recording whether you are
            under 18, height and weight, telephone number, profile and action
            photographs and highlight videos, sport, position, competitive
            level, university, academy or national programme, years active,
            achievements, performance statistics, social media account handles
            and audience figures, home city and country, travel radius,
            availability, and the deal categories you are seeking.
          </p>
          <p>
            <strong>Guardian data (athletes under 18).</strong> Where the
            athlete is under 18 we collect the guardian&apos;s name,
            relationship to the athlete, email address, telephone number and the
            timestamp at which the guardian gave consent.
          </p>
          <p>
            <strong>Team and agent profile data.</strong> Team or agency name,
            sports, competition level, venue, attendance and fan-reach figures,
            social accounts, sponsorship targets and brief documents, plus named
            contacts — commercial manager and primary controller name, role,
            email and telephone — and, for agents, specialisms, regions,
            services and verification status. Team accounts may also list
            additional administrators by name and email address.
          </p>
          <p>
            <strong>Brand data.</strong> Company and trading name, industry,
            description, website and LinkedIn, logo and imagery, headquarters
            location, company registration and VAT numbers, and approval status.
          </p>
          <p>
            <strong>Marketplace activity.</strong> Listings, connection requests
            and the message that accompanies them, matches, shortlists, blocks,
            reports you file or that are filed about you, and the contents of
            messages you send — including attachments and their file metadata.
          </p>
          <p>
            <strong>Deal, contract and payment data.</strong> Proposals and
            their terms, concluded contracts and the associated e-signature
            evidence (signing timestamp, signer IP address and device
            description, e-signature provider and envelope reference), payment
            records including amount, currency, status, fees, receipt links and
            Stripe payment identifiers, saved card metadata (brand, last four
            digits, expiry — never the full card number), payout preferences
            including bank name, account holder and the last four digits of the
            account and sort code, and brand subscription records.
          </p>
          <p>
            <strong>Security and device data.</strong> Login history (success or
            failure, IP address, user agent, coarse location), active sessions
            (session identifier, IP address, user agent, device label, last
            activity), and two-factor authentication state where enabled.
          </p>
          <p>
            <strong>Notification and settings data.</strong> Your notification
            matrix and quiet hours, email digest and marketing preferences,
            visibility and discoverability settings, location precision,
            currency, and a log of the notifications we have generated for you.
          </p>
          <p>
            <strong>Administrative records.</strong> Audit log entries recording
            significant actions taken on the platform, including by our staff,
            together with the IP address from which they were taken.
          </p>
          <p>
            <strong>Special category data.</strong> We do not ask for health,
            racial or ethnic origin, religious, political or sexual-life data.
            Please do not put such information in free-text fields. Note that a
            photograph or a stated sport may indirectly reveal such
            characteristics; we do not use it for that purpose.
          </p>
        </LegalSection>

        <LegalSection id="lawful-basis" heading="3. Why we use it, and our lawful basis">
          <ul className="list-disc space-y-3 pl-6">
            <li>
              <strong>To provide the platform</strong> — creating your account,
              publishing your profile, running discovery and matching, carrying
              messages, generating proposals and contracts, and taking payment.{' '}
              <em>Basis: performance of a contract</em> (Art. 6(1)(b)).
            </li>
            <li>
              <strong>To take payment and administer subscriptions.</strong>{' '}
              <em>Basis: performance of a contract</em>, and{' '}
              <em>legal obligation</em> for the accounting records we must keep
              (Art. 6(1)(c)).
            </li>
            <li>
              <strong>
                To keep the platform safe — fraud prevention, moderation,
                reports, blocking, login history, session management and audit
                logging.
              </strong>{' '}
              <em>
                Basis: legitimate interests in protecting users and the service
              </em>{' '}
              (Art. 6(1)(f)), and legal obligation where we must act.
            </li>
            <li>
              <strong>Safeguarding minors</strong> — recording guardian consent,
              flagging under-18 accounts, and acting on underage concerns.{' '}
              <em>
                Basis: legitimate interests in child protection, and legal
                obligation
              </em>
              .
            </li>
            <li>
              <strong>Service and transactional messages</strong> — verification
              emails, security alerts, deal and payment notifications.{' '}
              <em>Basis: performance of a contract and legitimate interests</em>
              . You cannot opt out of essential security and transactional
              messages while you hold an account.
            </li>
            <li>
              <strong>Marketing emails and optional analytics.</strong>{' '}
              <em>Basis: your consent</em> (Art. 6(1)(a)), which you may
              withdraw at any time in your settings or via the{' '}
              <Link href="/cookies">cookie preferences</Link> control in the
              footer. Withdrawal does not affect processing carried out before
              you withdrew.
            </li>
            <li>
              <strong>
                Retaining contracts and financial records after account closure.
              </strong>{' '}
              <em>Basis: legal obligation and legitimate interests</em> in
              establishing, exercising or defending legal claims.
            </li>
            <li>
              <strong>Improving the product</strong> using aggregated and
              anonymised usage information.{' '}
              <em>Basis: legitimate interests</em>.
            </li>
          </ul>
          <p>
            Where we rely on legitimate interests we have carried out a
            balancing assessment; you may ask us for a summary of it and you
            have the right to object (see section 8).
          </p>
        </LegalSection>

        <LegalSection id="sharing" heading="4. Who we share it with">
          <p>
            <strong>Other users.</strong> Your public profile is visible to
            other Podium users according to your visibility and discoverability
            settings. When you connect with someone, they see the information in
            your profile and anything you send them. Only share contact and
            financial details with counterparties you trust.
          </p>
          <p>
            <strong>Our processors.</strong> We use a small number of suppliers
            who process personal data on our documented instructions under
            Article 28 contracts:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Supabase</strong> — database, authentication and file
              storage. Holds essentially all platform data.
            </li>
            <li>
              <strong>Vercel</strong> — application hosting, edge network and
              request logging. Processes IP addresses and request metadata.
            </li>
            <li>
              <strong>Stripe</strong> — card payments, subscription billing and
              payouts. Stripe is an independent controller for its own
              anti-fraud and regulatory purposes; see Stripe&apos;s own privacy
              policy.
            </li>
          </ul>
          <p>
            A current list of sub-processors will be maintained here. We will
            give notice before adding a new one that materially changes how your
            data is handled.
          </p>
          <p>
            <strong>Others.</strong> Professional advisers under duties of
            confidentiality; law enforcement, regulators or a court where we are
            legally required or where it is necessary to protect someone&apos;s
            safety — in particular a child&apos;s; and an acquirer if the
            business is sold, subject to this policy continuing to apply.
          </p>
          <p>We do not sell your personal data.</p>
        </LegalSection>

        <LegalSection id="transfers" heading="5. International transfers">
          <p>
            We aim to host data in the UK or the European Economic Area. Some of
            our processors — including Stripe and Vercel — operate globally, so
            personal data may be processed outside the UK, including in the
            United States.
          </p>
          <p>
            Where that happens we rely on one of: an adequacy decision (or UK
            adequacy regulations) covering the destination; the UK
            International Data Transfer Agreement, or the EU Standard
            Contractual Clauses together with the UK Addendum; supported by a
            transfer risk assessment and, where appropriate, additional
            technical measures such as encryption in transit and at rest. You
            may request details of the safeguards applying to a particular
            transfer.
          </p>
        </LegalSection>

        <LegalSection id="retention" heading="6. How long we keep it">
          <ul className="list-disc space-y-3 pl-6">
            <li>
              <strong>Active accounts</strong> — for as long as your account is
              open.
            </li>
            <li>
              <strong>After you request deletion</strong> — we hold the request
              for a 14-day grace period, during which you can cancel it simply
              by signing back in and cancelling. After that a scheduled job
              erases your data as described in section 7.
            </li>
            <li>
              <strong>Concluded contracts</strong> — retained until{' '}
              <strong>seven years after the contract was finalised</strong>{' '}
              (recorded on each contract as its retention date), to meet
              accounting and limitation-period requirements. After erasure of
              your account the retained contract record is stripped of personal
              identifiers.
            </li>
            <li>
              <strong>Payment and subscription records</strong> — retained for
              at least six full financial years, as required by tax and
              accounting law, in anonymised form once your account is erased.
            </li>
            <li>
              <strong>Login history and active sessions</strong> — deleted with
              your account; in normal operation, login history is kept for a
              limited security window.
            </li>
            <li>
              <strong>Data export files</strong> — download links expire 72
              hours after the export is ready, and the file is purged.
            </li>
            <li>
              <strong>Moderation reports and audit logs</strong> — retained
              after account erasure, because they are the record of safety
              decisions and cannot be reconstructed. The free-text description
              and any internal notes are deleted once the report is closed, and
              IP addresses recorded against your actions are cleared.
            </li>
            <li>
              <strong>Backups</strong> — deleted data persists in encrypted
              backups for a short rolling window before those backups expire.
            </li>
          </ul>
        </LegalSection>

        <LegalSection id="erasure" heading="7. What happens when you delete your account">
          <p>
            You can request erasure from your settings. We record the request
            and schedule the erasure 14 days later. Signing back in and
            cancelling the request during that window stops it.
          </p>
          <p>When the erasure runs, an automated job:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>permanently deletes</strong> your profile (including
              photographs, videos, date of birth, guardian details, contact
              details and social accounts), your settings, your shortlists,
              blocks and connection requests, your matches, your message content
              and attachments, your notification history, your sessions and
              login history, your saved payment method metadata, your payout
              details, and your two-factor and data-export records;
            </li>
            <li>
              <strong>anonymises</strong> — rather than deletes — contracts,
              proposals, payments and subscriptions. Names, email addresses,
              addresses, IP addresses and device descriptions are removed or
              replaced; amounts, dates and record identifiers are kept, because
              we are legally required to retain the financial and contractual
              record; and
            </li>
            <li>
              <strong>replaces your user record with a tombstone</strong> — your
              email address is replaced with a non-routable placeholder and the
              account is permanently disabled. The empty record remains only so
              that the retained financial records stay internally consistent; it
              contains no information that identifies you.
            </li>
          </ul>
          <p>
            We write an audit entry recording that an erasure took place, the
            date, and which categories were deleted or anonymised. That entry
            does not contain your personal data beyond the internal account
            identifier.
          </p>
          <p>
            Content you sent to another user may remain visible to them where it
            forms part of a concluded deal record they are entitled to keep.
          </p>
        </LegalSection>

        <LegalSection id="rights" heading="8. Your rights">
          <p>Under the UK GDPR you have the right to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Access</strong> a copy of your personal data. You can
              generate a machine-readable export from your settings.
            </li>
            <li>
              <strong>Rectify</strong> inaccurate or incomplete data — most of
              which you can correct directly in your profile.
            </li>
            <li>
              <strong>Erase</strong> your data (&ldquo;right to be
              forgotten&rdquo;), subject to the retention obligations in section
              6.
            </li>
            <li>
              <strong>Restrict</strong> processing while a dispute about
              accuracy or legitimate interests is resolved.
            </li>
            <li>
              <strong>Object</strong> to processing based on legitimate
              interests, and to object to direct marketing at any time —
              absolutely and free of charge.
            </li>
            <li>
              <strong>Data portability</strong> — receive data you gave us in a
              structured, commonly used, machine-readable format.
            </li>
            <li>
              <strong>Withdraw consent</strong> at any time where we rely on it,
              without affecting prior processing.
            </li>
            <li>
              <strong>
                Not be subject to a solely automated decision with legal or
                similarly significant effects.
              </strong>{' '}
              Our match scoring is a ranking aid only; it does not decide
              anything about you on its own, and a human is always in the loop
              on account suspension and brand approval decisions.
            </li>
          </ul>
          <p>
            To exercise a right, use your settings or email{' '}
            <a href={`mailto:${CONTROLLER.privacyEmail}`}>
              {CONTROLLER.privacyEmail}
            </a>
            . We respond within one month, extendable by two further months for
            complex requests, and we will tell you if we need the extension. We
            may need to verify your identity first. There is no charge unless a
            request is manifestly unfounded or excessive.
          </p>
          <p>
            You can complain to the{' '}
            <a
              href="https://ico.org.uk/make-a-complaint/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Information Commissioner&apos;s Office
            </a>{' '}
            (ico.org.uk, helpline 0303 123 1113). We would appreciate the chance
            to resolve it with you first.
          </p>
        </LegalSection>

        <LegalSection id="children" heading="9. Children's data">
          <p>
            Podium is not for anyone under 16. Athletes aged 16 and 17 may use
            Podium only with the involvement of a parent or guardian, whose name
            and contact details we hold for that purpose.
          </p>
          <p>
            We take extra care with minors&apos; data: an under-18 flag is
            derived automatically from the date of birth; guardian consent is
            recorded with a timestamp; and reports raising an underage or
            safeguarding concern are prioritised. We do not use a minor&apos;s
            data for marketing or behavioural profiling, and we do not run
            marketing cookies against accounts flagged as under 18.
          </p>
          <p>
            A guardian may ask to see, correct or erase the data we hold about a
            minor athlete in their care by emailing{' '}
            <a href={`mailto:${CONTROLLER.privacyEmail}`}>
              {CONTROLLER.privacyEmail}
            </a>
            . If we learn we hold data about someone under 16, we delete it.
          </p>
        </LegalSection>

        <LegalSection id="security" heading="10. Security">
          <p>
            We use encryption in transit and at rest, row-level authorisation
            rules in the database so users can only read their own records,
            hashed passwords held by our authentication provider, optional
            two-factor authentication, session management with the ability to
            revoke a device, and audit logging of significant actions. No system
            is perfectly secure; if a breach is likely to result in a risk to
            your rights we will notify the ICO within 72 hours and tell you
            where the risk is high.
          </p>
        </LegalSection>

        <LegalSection id="cookies" heading="11. Cookies">
          <p>
            We set strictly necessary cookies to run the site, and optional
            analytics and marketing cookies only with your consent. See the{' '}
            <Link href="/cookies">Cookie Policy</Link> for the detail and to
            change your choice at any time.
          </p>
        </LegalSection>

        <LegalSection id="changes" heading="12. Changes to this policy">
          <p>
            This is version {PRIVACY_VERSION}. We will post any update here with
            a new version date, and where the change is significant we will
            notify you and, where required, ask for your consent again.
          </p>
        </LegalSection>
      </LegalPage>
      <Footer />
    </>
  )
}

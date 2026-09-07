import type { Metadata } from 'next'
import Link from 'next/link'
import Footer from '@/components/layout/footer'
import { LegalPage, LegalSection } from '@/components/legal/legal-page'
import {
  CONTROLLER,
  POLICY_EFFECTIVE_DATE,
  TERMS_VERSION,
} from '@/lib/legal/versions'

export const metadata: Metadata = {
  title: 'Terms of Service · Podium',
  description:
    'The terms on which Podium provides its sports sponsorship marketplace to athletes, teams, agents and brands in the UK.',
  // WS-INFRA P2: one canonical URL, resolved against metadataBase in app/layout.tsx.
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <>
      <LegalPage
        title="Terms of Service"
        version={TERMS_VERSION}
        effectiveDate={POLICY_EFFECTIVE_DATE}
        intro="These terms govern your use of Podium, a marketplace that introduces athletes, teams and their agents to brands looking for sponsorship and endorsement partners. By creating an account you agree to them."
      >
        <LegalSection id="who-we-are" heading="1. Who we are and what Podium is">
          <p>
            Podium is operated by {CONTROLLER.legalEntity}, based in the{' '}
            {CONTROLLER.country}. In these terms &ldquo;Podium&rdquo;,
            &ldquo;we&rdquo; and &ldquo;us&rdquo; mean that company;
            &ldquo;you&rdquo; means the person or organisation using the
            platform.
          </p>
          <p>
            <strong>
              Podium is an introduction and administration platform. It is not a
              party to any sponsorship, endorsement or services agreement made
              between a brand and an athlete, team or agent.
            </strong>{' '}
            We provide discovery, messaging, proposal and contracting tooling.
            The commercial deal itself is made directly between the parties to
            it. We are not an employment agency or employment business, we do
            not act as an agent for any user, and we do not give legal,
            financial, tax or regulatory advice.
          </p>
          <p>
            Questions about these terms:{' '}
            <a href={`mailto:${CONTROLLER.legalEmail}`}>
              {CONTROLLER.legalEmail}
            </a>
            .
          </p>
        </LegalSection>

        <LegalSection id="eligibility" heading="2. Eligibility">
          <p>
            You may use Podium only if you can form a binding contract with us,
            you are not barred from doing so under any applicable law, and every
            statement you make when registering is true.
          </p>
          <p>
            <strong>Minimum age.</strong> You must be at least 16 years old to
            hold a Podium account. We ask every athlete for a date of birth and
            we record whether that athlete is under 18.
          </p>
          <p>
            <strong>Athletes aged 16 or 17 (&ldquo;minor athletes&rdquo;).</strong>{' '}
            A minor athlete may hold a profile only where:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              a parent, legal guardian or another adult with parental
              responsibility (a &ldquo;guardian&rdquo;) is named on the profile
              and has confirmed their consent to the athlete&apos;s use of
              Podium;
            </li>
            <li>
              the guardian&apos;s name, relationship, email address and
              telephone number are provided and kept up to date;
            </li>
            <li>
              the guardian reviews and countersigns, or otherwise expressly
              approves, <strong>every</strong> proposal and contract before the
              minor athlete accepts it, because a minor cannot be bound by a commercial
              contract without that adult approval, and we will not treat an
              acceptance by a minor alone as a valid signature; and
            </li>
            <li>
              any payment arrangements are made to an account the guardian
              controls or supervises.
            </li>
          </ul>
          <p>
            Guardians who provide that consent accept these terms on behalf of
            the minor athlete, and accept responsibility for supervising the
            athlete&apos;s use of the platform. A guardian may withdraw consent
            at any time by contacting{' '}
            <a href={`mailto:${CONTROLLER.supportEmail}`}>
              {CONTROLLER.supportEmail}
            </a>
            , which will suspend the athlete&apos;s profile.
          </p>
          <p>
            <strong>
              We do not knowingly permit accounts for anyone under 16.
            </strong>{' '}
            If we learn that an account belongs to someone under 16 we will
            close it and erase the associated personal data. Report a suspected
            underage account using the in-app report tool or by emailing us.
          </p>
          <p>
            <strong>Amateur, collegiate and governing-body rules.</strong> Some
            athletes are subject to eligibility rules set by their school,
            university, club, league or national governing body, including
            rules about name, image and likeness (NIL) deals and about
            advertising certain product categories. You are responsible for
            checking and complying with those rules before you accept a deal.
            Podium does not verify them for you.
          </p>
          <p>
            Brand accounts must be registered by someone authorised to bind the
            organisation, and are subject to approval by us before they become
            active.
          </p>
        </LegalSection>

        <LegalSection id="accounts" heading="3. Your account">
          <p>
            You must give accurate registration information, keep it current,
            and keep your credentials confidential. You are responsible for
            everything that happens under your account. Tell us immediately if
            you suspect unauthorised access.
          </p>
          <p>
            One person or organisation, one account. Your account role (athlete,
            team, brand or agent) is fixed once set, because it determines how
            you appear in the marketplace and how the platform treats your data.
            You may not sell, rent or transfer your account.
          </p>
          <p>
            Verification badges, where offered, indicate that we have carried
            out a stated check. They are not a guarantee of a user&apos;s
            identity, quality, solvency or conduct.
          </p>
        </LegalSection>

        <LegalSection
          id="marketplace"
          heading="4. The marketplace, proposals and contracts"
        >
          <p>
            Brands may publish listings; athletes, teams and agents may publish
            profiles; either may send a connection request. Once a connection is
            accepted, the parties may exchange proposals and messages.
          </p>
          <p>
            A proposal becomes a contract between the brand and the athlete or
            team when both parties (and, for a minor athlete, the guardian, and
            where applicable the athlete&apos;s agent) accept and sign it
            through the platform. That contract is{' '}
            <strong>between those parties only</strong>. Podium is not a party
            to it, does not guarantee its performance, and does not act as
            escrow agent, arbiter or guarantor.
          </p>
          <p>You are solely responsible for:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>the terms you agree, and for taking your own legal advice;</li>
            <li>
              delivering what you promised, and for the accuracy and legality of
              any content you publish under a deal;
            </li>
            <li>
              complying with advertising law and the CAP Code, including
              clearly disclosing paid partnerships (for example
              &ldquo;#ad&rdquo;) in accordance with ASA and Competition and
              Markets Authority guidance;
            </li>
            <li>
              your own tax, National Insurance and, where relevant, VAT. Podium
              does not withhold or account for tax on your behalf.
            </li>
          </ul>
          <p>
            We retain a copy of contracts concluded through the platform, and of
            the associated signature metadata, as described in our{' '}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </LegalSection>

        <LegalSection id="fees" heading="5. Fees, subscriptions and payments">
          <p>
            Athlete, team and agent accounts are free to create and use for
            discovery, messaging and contracting. Where we charge, the charges
            are shown to you before you commit.
          </p>
          <p>
            <strong>Brand subscriptions.</strong> Brand access is sold as a
            recurring subscription. Unless stated otherwise at the point of
            sale, subscriptions renew automatically at the end of each billing
            period at the then-current price, and are billed in advance. You may
            cancel at any time from your subscription settings; cancellation
            takes effect at the end of the current billing period and you keep
            access until then. We will give reasonable advance notice of a price
            change and you may cancel before it takes effect.
          </p>
          <p>
            <strong>Payment processing.</strong> Card payments, subscriptions
            and deal payouts are processed by Stripe. Your use of those payment
            services is also subject to Stripe&apos;s own terms. We do not store
            full card numbers or bank account numbers; we store only the limited
            metadata Stripe returns to us (such as card brand and last four
            digits).
          </p>
          <p>
            <strong>Consumer cancellation rights.</strong> If you are a consumer
            in the UK you may have a 14-day right to cancel a subscription under
            the Consumer Contracts (Information, Cancellation and Additional
            Charges) Regulations 2013. Where you ask us to start the service
            immediately, you may be charged for what you have used before you
            cancel. Nothing in these terms affects your statutory rights.
          </p>
          <p>
            Refunds outside those rights are at our discretion. Failed or
            reversed payments may result in suspension of access.
          </p>
        </LegalSection>

        <LegalSection id="acceptable-use" heading="6. Acceptable use">
          <p>You must not:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              impersonate anyone, misrepresent your sport, level, audience,
              results or affiliation, or use a false identity;
            </li>
            <li>
              harass, bully, threaten, defame or discriminate against anyone, or
              post content that is obscene, hateful or unlawful;
            </li>
            <li>
              contact, or attempt to contact, a minor athlete other than through
              the platform and with their guardian&apos;s knowledge;
            </li>
            <li>
              use Podium to promote anything you may not lawfully promote to the
              relevant audience, including tobacco and vaping products, and
              gambling or alcohol promotion to under-18s;
            </li>
            <li>
              scrape, crawl, bulk-download or otherwise systematically extract
              profile data, or use the platform to build a competing database;
            </li>
            <li>
              circumvent the platform to avoid fees, or solicit users off
              platform in breach of an agreed exclusivity;
            </li>
            <li>
              upload malware, probe or attack our infrastructure, bypass rate
              limits or access another user&apos;s account or data;
            </li>
            <li>
              send spam or unsolicited marketing through the messaging system.
            </li>
          </ul>
          <p>
            We operate reporting and blocking tools and we review reports. We
            may remove content, restrict features, suspend or close accounts
            where we reasonably believe these rules have been broken, and we may
            report unlawful conduct, in particular any safeguarding concern
            involving a minor, to the police or another competent authority.
          </p>
        </LegalSection>

        <LegalSection id="content" heading="7. Your content and our licence">
          <p>
            You keep ownership of everything you upload: your photographs,
            videos, statistics, logos and profile copy (&ldquo;your
            content&rdquo;). You must have the right to upload it, including any
            third-party rights in photographs and footage taken by others.
          </p>
          <p>
            You grant Podium a worldwide, non-exclusive, royalty-free,
            sub-licensable licence to host, store, reproduce, adapt for
            formatting purposes and display your content{' '}
            <strong>
              for the purpose of operating, securing and promoting the
              marketplace to other Podium users
            </strong>
            . We will not use your name, image or likeness in external
            advertising without your separate, specific permission. The licence
            ends when you delete the content or close your account, except for
            copies we must keep for the legal and accounting reasons described
            in the <Link href="/privacy">Privacy Policy</Link>, and except for
            copies already shared with a counterparty under a concluded deal.
          </p>
          <p>
            The Podium platform, brand, software and design are ours (or our
            licensors&apos;). We grant you a limited, revocable, non-exclusive,
            non-transferable licence to use the platform for its intended
            purpose. All other rights are reserved.
          </p>
          <p>
            If you believe content on Podium infringes your rights, contact{' '}
            <a href={`mailto:${CONTROLLER.legalEmail}`}>
              {CONTROLLER.legalEmail}
            </a>{' '}
            with enough detail to identify the content and your right.
          </p>
        </LegalSection>

        <LegalSection id="availability" heading="8. Availability of the service">
          <p>
            We aim to keep Podium available but we do not promise uninterrupted
            or error-free service. We may change, suspend or withdraw features,
            and we may carry out maintenance. Where a change is material and
            adverse to a paying subscriber we will give reasonable notice.
          </p>
        </LegalSection>

        <LegalSection id="liability" heading="9. Liability">
          <p>
            <strong>Nothing in these terms limits or excludes</strong> our
            liability for death or personal injury caused by our negligence, for
            fraud or fraudulent misrepresentation, or for any other liability
            that cannot lawfully be limited or excluded. If you are a consumer,
            your statutory rights are unaffected.
          </p>
          <p>Subject to that:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              we are not liable for the acts, omissions, solvency, conduct or
              content of any other user, or for any deal you enter into through
              the platform;
            </li>
            <li>
              we are not liable for business losses (loss of profit, revenue,
              contracts, sponsorship opportunity, goodwill, anticipated savings
              or data) or for any indirect or consequential loss;
            </li>
            <li>
              our total liability to you arising out of or in connection with
              the service in any 12-month period is limited to the greater of
              the fees you paid us in that period and £100.
            </li>
          </ul>
          <p>
            You agree to indemnify us against claims and costs arising from your
            breach of these terms, from your content, or from a deal you entered
            into through the platform, other than to the extent the claim arises
            from our own breach.
          </p>
        </LegalSection>

        <LegalSection id="termination" heading="10. Suspension and termination">
          <p>
            You may close your account at any time from your settings. Closing
            your account does not by itself terminate a live deal you have
            already agreed with another user, and it does not refund fees
            already paid.
          </p>
          <p>
            We may suspend or close your account, with notice where practicable
            and immediately where not, if you materially breach these terms, if
            we are required to by law, if there is a safeguarding, fraud or
            security concern, or if your account is inactive for a prolonged
            period after notice.
          </p>
          <p>
            On closure, we delete or anonymise your personal data in line with
            our <Link href="/privacy">Privacy Policy</Link>. Financial records
            and concluded contracts are retained in anonymised form for the
            statutory retention period.
          </p>
        </LegalSection>

        <LegalSection id="changes" heading="11. Changes to these terms">
          <p>
            We may update these terms. Each version carries a dated version
            number (this one is {TERMS_VERSION}). Where a change materially
            affects your rights or obligations we will notify you and ask you to
            accept the new version before you continue to use Podium. Your
            recorded acceptance, meaning which version and when, is stored against
            your account.
          </p>
        </LegalSection>

        <LegalSection id="general" heading="12. General">
          <p>
            These terms, together with the{' '}
            <Link href="/privacy">Privacy Policy</Link> and the{' '}
            <Link href="/cookies">Cookie Policy</Link>, are the whole agreement
            between us. If any provision is unenforceable, the rest continues to
            apply. Our failure to enforce a right is not a waiver of it. You may
            not assign your rights without our consent; we may assign ours on
            notice to you as part of a reorganisation or sale of the business.
            No one other than you and us has any right to enforce these terms.
          </p>
          <p>
            <strong>Governing law and jurisdiction.</strong> These terms and any
            dispute arising out of them are governed by the law of{' '}
            {CONTROLLER.governingLaw}, and the courts of{' '}
            {CONTROLLER.governingLaw} have exclusive jurisdiction. If you are a
            consumer resident elsewhere in the UK, you may also bring
            proceedings in your local courts and you keep the benefit of any
            mandatory consumer protections of your home nation.
          </p>
          <p>
            Complaints:{' '}
            <a href={`mailto:${CONTROLLER.supportEmail}`}>
              {CONTROLLER.supportEmail}
            </a>
            . We aim to acknowledge within five working days.
          </p>
        </LegalSection>
      </LegalPage>
      <Footer />
    </>
  )
}

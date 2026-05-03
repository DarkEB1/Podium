PODIUM
Full Product Specification v2.0
Marketplace-First Platform · Dual UI Modes · Flows · Data Model · Algorithm · Legal & Payments
Athletes & Teams Free  ·  Brands & Sponsors Pay  ·  Airbnb-Style Marketplace as Default
🏟️  Core model: Podium is a marketplace — like Airbnb for sports sponsorship. Athletes and teams list themselves; brands search, filter, and request contact. A secondary Swipe Mode (Tinder-style) is available as an optional UI toggle in Settings. Both modes use the same data, matching algorithm, and deal flow.
SECTION 1 — GLOBAL FLOWS (ALL USERS)
Flow 1 — Landing Page
When a user first opens Podium they land on the public marketing page. No login required. The page clearly communicates the marketplace model: athletes and teams list for free; brands search and contact via subscription.
What the Landing Page displays:
Hero section: "The Sports Sponsorship Marketplace" — value proposition headline with dual CTAs: List Your Profile (athletes/teams) and Find Talent (brands)
How It Works: three-step visual — Create Profile → Get Discovered → Close Deals
Browse preview: a live-looking sample grid of athlete and team cards (non-functional, for illustration)
Who It's For: three distinct panels for Athletes, Teams, and Brands/Sponsors with role-specific copy
Social proof: testimonials, deal count, active athlete count, featured brand logos
Scrolling sections: About, Trust & Safety, FAQs, Contact, Terms of Service, Privacy Policy
Flow 2 — Sign-Up
User clicks a CTA from the landing page. A sign-up form is presented with Email Address and Password fields. Password requirements shown inline: minimum 8 characters, one uppercase, one number, one special character. Strength indicator shown in real time.
Flow 3 — Email Verification
Verification link in email expires after 24 hours.
Flow 4 — Log-In
Flow 5 — Password Reset
User clicks Forgot Password → enters email → system always displays "If this email exists, you will receive a reset link" (prevents user enumeration) → reset link sent (expires 1 hour) → user sets new password → logged in and taken to dashboard.
Flow 6 — Role Selection
Triggered only on first login after email verification. Role is permanently locked after confirmation. Cannot be changed.
SECTION 2 — PLATFORM DISCOVERY MODEL (Marketplace-First)
🏠  Podium operates as a marketplace by default — modelled on Airbnb. Athletes and teams are listings. Brands are searchers. Discovery is browse-based: search, filter, view profile, request connection. A secondary Swipe Mode is available as an opt-in UI setting. Both modes use the same matching algorithm and deal flow.
2.1 — Marketplace Mode (Default)
Marketplace Mode is the default experience for all users. It provides a searchable, filterable grid of profiles and listings — identical in principle to how guests browse properties on Airbnb.
2.2 — Swipe Mode (Optional — Settings Toggle)
Swipe Mode is a secondary UI layer available as an opt-in setting. It presents the same algorithm-ranked pool of profiles as a swipeable card stack (Tinder-style). The underlying data, matching logic, and deal flow are identical — only the UI changes.
2.3 — Connection Request System (Marketplace Logic)
Podium uses a connection request system as its primary matching mechanic — equivalent to Airbnb's "Request to Book". Either party can initiate; the other party must accept before messaging unlocks.
SECTION 3 — ATHLETE FLOWS  (100% Free — No Subscription, No Limits)
ℹ️  Athletes never encounter a paywall. Every feature — listing, searching, messaging, deal proposals, e-signatures, payment receipt — is free and unlimited. Athletes are the supply side of the marketplace; removing all barriers maximises supply quality and quantity.
Flow 7 — Athlete Profile Creation (Multi-Step)
The profile builder is a multi-step wizard. Progress is auto-saved after each step. The athlete can exit and return without losing data. An incomplete profile is held in Draft state and is not visible in the marketplace.
Step 1 — Personal Details
Full legal name and display name (display name shown publicly)
Date of birth (used to verify age; auto-calculates age; triggers under-18 flow if applicable)
Height (cm or ft/in — user selects unit) and weight (optional)
Phone number (private — not shown on public profile)
Email address (pre-filled from sign-up; editable)
Profile photo (minimum 500×500px; JPEG or PNG; required before profile goes live)
Step 2 — Sport & Performance Details
Primary sport (dropdown — comprehensive list) and optional secondary sport
Position or discipline within the sport
Level of play: Recreational / Amateur / Semi-Professional / Professional / International
Years active in sport
Notable achievements (free text, optional — e.g. county champion, national squad)
Performance stats (sport-specific JSONB fields — e.g. for football: goals, assists, matches played; for track: sprint PB; for golf: handicap)
Step 3 — Social Media & Media Uploads
Connect social accounts via OAuth: Instagram, TikTok, X (Twitter), YouTube, LinkedIn
For any account not connected via OAuth: manually enter handle and follower count (subject to admin verification)
Upload action photos — minimum 1 required (max 10); must show athlete in sport context
Upload commercial / modelling photos — optional (max 10); headshots, lifestyle imagery
Upload highlight video reel — optional (max 2 videos; max 200MB each; MP4 or MOV)
All media reviewed against community guidelines before appearing publicly in the marketplace
Step 4 — Location & Availability
Home town / city and country
Travel radius: how far the athlete is willing to travel for work (slider: 0 / 25 / 50 / 100 / 200km / Nationwide / International)
Availability: Available Now / Available from [date] / Not Currently Available
Availability calendar (optional — mark specific unavailable dates for brand planning)
Step 5 — Representation & Account Control
Does the athlete have an agent? → If Yes: agent name, agency, email, phone (agent receives a connection request via email)
Is the athlete under 18? → (auto-detected from DOB — see Flow 18 for full under-18 flow)
ℹ️  Under-18 rule: if the athlete is under 18, a parent or legal guardian MUST be assigned as account controller before the profile can go live. Guardian's full name, email, and phone required. Guardian receives a confirmation email and must accept responsibility. All deal proposals involving under-18 athletes are flagged for additional review.
Step 6 — Discovery Preferences & UI Settings
What is the athlete looking for? Brand deals / Agent representation / Both
Preferred discovery UI: Marketplace Mode (default) or Swipe Mode
Display theme preference: Light Mode (default) or Dark Mode
Notification preferences: push, email, SMS — configurable per event type
Chat retention preference: Manual only / 1 week / 30 days / 6 months / 1 year
Flow 8 — Athlete Marketplace Listing & Public Visibility
Before the profile goes live, the athlete is shown a formatted preview of exactly what brands and agents will see in the marketplace. This includes all photos, social stats, performance data, location (city-level only — never street address), and travel radius.
Flow 9 — Athlete Marketplace Discovery
The athlete's primary discovery view is the marketplace browse grid. Athlete sees brand campaigns and job listings from brands/sponsors. In Swipe Mode this same pool is shown as a card stack.
Marketplace Browse — Default:
Search bar at top: search brand names, industries, campaign types
Filter controls: sport, budget range, campaign type, location, duration
Sort: Most Relevant / Newest / Highest Budget / Best Match
Cards displayed in grid: brand/campaign name, logo, campaign title, sport, pay range, location
Tap any card → opens full campaign/brand profile. Save to shortlist via bookmark icon.
Send a connection request from the full profile view — includes a short personalised message
Swipe Mode — Optional:
Same algorithm-ranked pool presented as a swipeable card stack
Swipe right = send connection request / Swipe left = skip
Unlimited undos for athletes
When queue exhausted: loops with progressively loosened filters, athlete notified
Flow 10 — Athlete Saved & Requests
Athletes have two distinct panels in their navigation:
Flow 11 — Athlete Match Notification & View
A match (connection) occurs when a connection request is accepted by either party.
Flow 12 — Athlete Messaging
Messaging unlocks as soon as a connection is accepted. There is no message limit for athletes.
Message content types allowed:
Text messages (no character limit)
Image attachments (JPEG, PNG — max 25MB per file)
Video attachments (MP4, MOV — max 200MB per file)
Document attachments (PDF — max 50MB; used for contracts, briefs, rate cards)
Proposal cards (sent by brand — structured deal card appearing inline in chat)
E-signature requests (embedded in chat)
Payment confirmation cards (auto-generated when payment completes)
Chat retention: configurable per athlete. Both parties receive 48-hour warning before auto-clear. Chats containing signed contracts are never auto-cleared.
Flow 13 — Athlete Deal Proposal Receipt & Negotiation
Once messaging is open, a brand sends a formal deal proposal. The proposal appears as a structured card within the chat.
Flow 14 — Athlete E-Signature
Brand sends a contract (generated from accepted proposal, or uploaded PDF)
Athlete receives notification: "You have a contract to review and sign"
Athlete can review the full contract in the embedded PDF viewer, or download for external review
Athlete signs using finger/stylus on mobile or mouse on desktop (typed name signature also accepted)
Once signed by athlete: returned to brand for countersignature
Once both parties have signed: contract locked, immutable, stored in both dashboards
ℹ️  E-signature powered by DocuSign or HelloSign. Full audit trail (IP address, device, timestamp) stored per signature event.
Flow 15 — Athlete Payment Receipt
Once contract is signed and work delivered, brand initiates payment via Stripe
Athlete receives push notification: "Payment received from [Brand Name]"
Receipt auto-generated and stored in athlete's Payment History dashboard
Receipt includes: brand name, job title, amount, currency, date, transaction ID
ℹ️  Podium does not act as employer or payroll agent. Athletes are responsible for their own tax obligations. Disclaimer shown on first payment receipt.
Flow 16 — Athlete Notifications
Flow 17 — Athlete Settings
Accessible from the profile avatar. All changes take effect immediately unless stated otherwise.
Flow 18 — Athlete Under-18 Guardian Flow
System detects age < 18 from DOB entered in Step 1
Mandatory Guardian Assignment screen presented before profile creation can proceed
Required: guardian full name, relationship, email address, phone number
Guardian consent email sent. Guardian must click Accept before account activates.
Guardian's email/phone stored and flagged on the account permanently
For every deal proposal: guardian receives a copy before athlete can accept or sign
On athlete's 18th birthday: system emails both athlete and guardian confirming full independent control transfers
ℹ️  If guardian consent is not received within 7 days, profile creation is paused and athlete is emailed a reminder. After 30 days of inactivity the partial profile is purged.
Flow 19 — Athlete Account Deactivation & Deletion
Temporary Deactivation:
Profile immediately hidden from all marketplace discovery and search results
Existing connections and chats preserved
On next login: "Would you like to reactivate?" — one tap restores full visibility
Permanent Deletion:
Shown confirmation screen listing what will be deleted: profile, photos, videos, matches, chats, payment history
Must type "DELETE" to confirm
14-day grace period — athlete can log in and cancel deletion during this window
After 14 days: all personal data permanently deleted per GDPR
Unsigned contracts cancelled; completed contracts and payment records retained 7 years (anonymised)
SECTION 4 — TEAM FLOWS  (100% Free — No Subscription, No Limits)
ℹ️  Teams use Podium to find sponsors. All features are free. Teams appear as marketplace listings that brands can search, filter, and request contact with. Swipe Mode is also available. Teams can be grassroots clubs, college squads, semi-pro sides, or professional teams.
Flow 20 — Team Profile Creation (Multi-Step)
Step 1 — Team Identity:
Team/club name, nickname, sport(s), competition level (Grassroots → International), year founded
Team logo (min 300×300px), cover photo (action shot, min 1200×600px), short bio (max 500 characters)
Step 2 — Location & Audience:
Home city/country, home venue, estimated match-day attendance
Geographic reach of fan base: Local / Regional / National / International
Social media accounts (OAuth or manual entry); total social following auto-calculated
Press/media coverage mentions (optional)
Step 3 — Sponsorship Needs:
What the team is seeking: kit & equipment / travel & accommodation / event/match day / facility / general brand partnership
Estimated total sponsorship value sought (annual — optional but recommended)
Sponsorship brief upload (PDF — optional pre-written pitch document)
Step 4 — What the Team Offers Sponsors:
Logo placement (front/back/sleeve), pitch-side/venue signage, social media posts, match day programme
Player appearances, event naming rights, video content, email newsletter inclusion, other (free text)
Step 5 — Representation & Account Control:
Commercial manager or agent assigned? (If yes: name, email, phone)
Primary account controller: name, role within team, email, phone
Up to 3 additional team administrators (receive invite emails)
Step 6 — Discovery Preferences & UI Settings:
Preferred discovery UI: Marketplace Mode (default) or Swipe Mode
Display theme preference: Light Mode (default) or Dark Mode
Notification preferences per event type
Flow 21 — Team Visibility Confirmation
Identical in structure to Flow 8. Team administrator reviews full public-facing profile, confirms accuracy, accepts Terms & Privacy Policy. Profile goes live or enters media review queue.
Flow 22 — Team Discovery & Search
Teams browse a marketplace of Brand Profiles and Sponsor Campaigns. Default view is the searchable grid. Swipe Mode available via settings. Teams can filter by: industry type, sponsorship budget, geographic preference, sponsorship type.
Connection request flow is identical to athlete flow. Team sends or receives a request with a short message. On acceptance: messaging unlocks, brand sends formal proposal.
Flow 23 — Team Match, Messaging & Deal
Identical flow to athlete matching and messaging (Flows 11–14). On connection acceptance: brand initiates conversation with a formal sponsorship proposal. Team reviews — Accept / Counter / Decline. Counter-proposal loop. On acceptance: contract e-signed by both parties. Brand initiates payment. Team receives receipt.
Flow 24 — Team Settings
Covers: profile editing, administrator management, sponsorship needs/offer updates, media uploads, visibility toggle, discovery UI mode (Marketplace / Swipe), display theme (Light / Dark), notification preferences, and account management (deactivate / delete / download data).
SECTION 5 — BRAND & SPONSOR FLOWS  (Paid — Primary Revenue Source)
ℹ️  Brands and sponsors are the sole commercial engine of Podium. They pay a monthly subscription to search and contact the talent pool. Higher tiers unlock broader search reach, more active listings, and dedicated support.
Flow 25 — Brand Account Creation & Profile
User selects Brand/Sponsor at role selection. Profile creation form:
Official company/brand name, trading name if different
Industry/sector (Sport, Fashion, Nutrition & Supplements, Technology, Financial Services, Travel, Entertainment, FMCG, Other)
Company description (max 600 characters — public facing)
Headquarters location (city and country), website URL
Company social media accounts (LinkedIn required; others optional)
Brand logo (min 300×300px), cover image (optional)
What the brand is looking for: Athlete endorsement / Social content / Event appearance / Team kit sponsorship / Team event sponsorship / Long-term ambassador
Target sports (up to 5), target athlete/team level, geographic preference
ℹ️  Profile held in Pending Approval state after submission. Admin reviews for legitimacy before account and any listings go live. Brands emailed within 48 hours.
Flow 26 — Brand Subscription Selection & Payment
After profile creation (and while awaiting approval) the brand selects a subscription tier. Payment required before account goes live. 7-day free trial on all tiers — card details required upfront, no charge during trial.
Flow 27 — Brand Listing & Campaign Creation
Once the account is live, the brand creates one or more listings. A listing is the unit that appears in the athlete/team marketplace search results.
Athlete Job / Endorsement Listing:
Listing title, full description, sport required, athlete level required, location (or Remote)
Pay: amount, currency, and type (flat fee / monthly retainer / per post / revenue share)
Deliverables: number of posts, video content, event appearances
Contract duration, usage rights (geographic scope, exclusivity, platforms covered)
Application deadline (optional), multiple hires allowed (Yes/No; if Yes: how many)
Team Sponsorship Campaign Listing:
Campaign title, description, sport(s) targeted, team level required
Geographic preference, total sponsorship budget (or range), sponsorship structure
What the brand expects in return: logo placement, venue signage, social posts, content, events
Duration, exclusivity required, number of teams sought
Flow 28 — Brand Marketplace Search & Discovery
Brands search the athlete and team marketplace using the same browse-and-filter interface available to all users. The brand's subscription tier determines the breadth of their search results.
Marketplace Search — Default:
Search bar: search athlete names, sports, skills, universities, locations
Filters: sport, level, location radius, social following size, engagement rate, availability, verification status
Sort: Most Relevant / Most Followed / Highest Engagement / Recently Active
Cards show: athlete/team name, photo, sport, level, key stat, verified badge
Tap card → full profile page with all stats, media, past partnerships, availability
Send connection request from profile page — includes mandatory personalised message (max 300 characters)
Shortlist profiles (bookmark) for later review without committing
Swipe Mode — Optional (enabled in Settings):
Same algorithm-ranked pool presented as a swipeable card stack
Swipe right = send connection request. Swipe left = skip.
Undo limits: Tier 1: 5/day, Tier 2: 20/day, Tier 3: unlimited
When queue exhausted: loops and filters loosen. Brand notified.
Flow 29 — Brand Connection Request & Mandatory Proposal
The brand sends a connection request from an athlete or team's profile page, including a short personalised message explaining their interest. The athlete or team reviews the request and can Accept or Decline.
On Acceptance — Mandatory Proposal Mechanic:
ℹ️  On connection acceptance, the brand MUST send a formal structured proposal before free-text messaging is fully unlocked. This protects athletes and teams by ensuring every conversation starts with transparent intent — the brand's offer is on the table before any relationship develops.
Flow 30 — Brand Messaging, Negotiation & Contracts
After proposal sent: full two-way messaging with text, images, videos, and documents. Counter-proposals can be received and responded to. On final acceptance: contract generated → e-signature → payment. All deal history timestamped and stored in both dashboards.
Flow 31 — Brand Payment & Invoice
Flow 32 — Brand Settings
Flow 33 — Brand Subscription Cancellation
Brand navigates to Settings → Subscription → Cancel Subscription
Shown confirmation screen: what will be lost (listings paused, search disabled, messaging disabled for new connections)
Subscription remains active until end of current billing cycle
At billing cycle end: all listings paused; search disabled; existing connections accessible read-only for 30 days
SECTION 6 — AGENT FLOWS  (Always Free — Commission-Based)
ℹ️  Agents are free. Income is commission from deals facilitated, not platform subscriptions. Commission rates are disclosed on profile. Podium records but does not enforce commission arrangements.
Flow 34 — Agent Profile Creation
Step 1 — Agency Details:
Agency/firm name, agent's full name, years in industry, sports specialisms (up to 5), geographic regions covered, bio (max 500 characters), logo, website, LinkedIn
Step 2 — Services Offered:
Athlete representation, team commercial management, brand partnership brokerage, contract negotiation, media & PR management, financial management (if qualified)
Step 3 — Commission Disclosure:
Standard commission rate displayed on profile (informational only — e.g. 10–15%). Profile note: "Commission is negotiated privately between agent and client. Podium is not party to these arrangements."
Step 4 — Verification:
Agents encouraged to apply for verification badge (see Flow 40). Unverified agents can operate but verified agents are prioritised in athlete marketplace search results.
Step 5 — Discovery Preferences:
Preferred UI: Marketplace Mode (default) or Swipe Mode. Display theme: Light or Dark Mode.
Flow 35 — Agent Athlete & Team Representation Requests
Agent discovers an athlete or team in the marketplace (or is approached by one). On accepted connection, agent sends a Representation Request (a structured card in the chat, similar to a proposal).
Representation Request contains:
Agent name and agency, services being offered, commission rate, proposed contract duration, any specific terms
Agent Permissions Once Linked:
Edit athlete/team profile fields (if profile editing permission granted)
View and respond to messages on behalf of the client (if messaging permission granted)
Review and respond to deal proposals on behalf of the client
Oversee contract signing and payment
All agent actions within a client's account logged and visible to the client
Flow 36 — Agent Discovery & Matching
Agents browse all three marketplace views: Athletes (to find talent to represent), Teams (to find commercial clients), Brands (to find opportunities for their clients). Full marketplace search with filters. Swipe Mode available in settings. Full undos, unlimited connection requests.
Flow 37 — Agent Deal Oversight & Commission
Brand sends a proposal to athlete/team represented by the agent
Agent receives the proposal (alongside or instead of the client, based on permissions)
Agent reviews and responds: Accept / Counter / Decline on behalf of client
Counter-proposal loop as needed — unlimited rounds
On acceptance: contract generated, e-signature requests sent to brand, athlete/team, and agent (if signatory)
On payment: agent's commission disclosed in deal record. Brand-to-athlete/team payment via Stripe. Agent invoices client separately.
ℹ️  Future phase: Optional commission escrow — platform holds total payment, splits athlete/team share and agent commission automatically on deal completion.
Flow 38 — Agent Settings
Covers: agency profile editing, client management (view all represented athletes/teams, manage permissions per client), deal and contract history across all clients, discovery UI mode (Marketplace / Swipe), display theme (Light / Dark), notification preferences, data download, and account deactivation/deletion.
ℹ️  On agent account deletion: all representation links severed; clients notified and regain direct control of their accounts.
SECTION 7 — SYSTEM-WIDE FLOWS
Flow 39 — UI Mode & Theme Settings (Platform-Wide)
Both settings are available to all user roles from their Settings page. Changes take effect immediately and sync across devices (stored server-side against the user account).
Flow 40 — Verification Badge
Available to athletes, teams, brands, and agents. Verification adds a blue badge to the profile, boosting trust and search ranking.
Flow 41 — Reporting & Blocking
Reporting: user taps three-dot menu on any profile or message → selects Report → chooses reason (Fake profile / Inappropriate content / Harassment / Spam / Underage concern / Other) → optional detail text → submitted to Admin Review Queue. Reporter receives: "Thank you. We'll review this within 48 hours."
Blocking: user taps Block on any profile. Blocked user disappears from blocker's marketplace search and cannot find blocker. Existing connection/chat disabled (not deleted — admin can still review). Blocked user NOT notified. Reversible in Settings → Privacy → Blocked Users.
Flow 42 — Notification Engine (Platform-Wide)
Three delivery channels: push (iOS/Android), in-app badge/dot, and email. Configurable per channel per event type in Settings.
Flow 43 — Chat Retention & Auto-Clear Engine
48 hours before auto-clear: both parties receive warning notification
Cleared chats soft-deleted: invisible to users but recoverable by admin for 90 days, then permanently purged
Chat containing a signed contract is NEVER auto-cleared
Flow 44 — Account Deletion & GDPR Data Rights
Right to Deletion:
User submits deletion request via Settings → Account → Delete Account
Shown summary: what deleted vs what retained (contract records retained 7 years, anonymised)
Must type "DELETE" to confirm
14-day grace period — user can log in and cancel
After 14 days: all personal data deleted; profile removed; all connections/chats deleted; media purged
Right to Access / Data Portability:
User requests "Download My Data" in Settings
ZIP file generated: profile data, messages, deal history, payment records, uploaded media
ZIP emailed to verified email within 72 hours
ℹ️  Podium must respond to all GDPR data requests within 30 days per UK/EU GDPR obligations.
SECTION 8 — ADMIN FLOWS  (Admin Only)
Flow 45 — Admin Authentication
Admin panel at separate URL — not publicly accessible or linked from main app
Email + password authentication (admin accounts only — no OAuth)
Mandatory 2FA via authenticator app (no SMS 2FA permitted for admins)
Session idle > 30 minutes: automatic logout; must re-authenticate including 2FA
Flow 46 — Admin Dashboard
Flow 47 — Admin User Management
Admin can search, filter, and view any user account across all roles. Search by: name, email, user ID. Filter by: role, account status, verification status, subscription tier, date range.
User Record View includes:
Full profile data (all fields including private fields)
Account status (active / suspended / terminated / pending verification)
Subscription tier and billing history
All connections — read-only
All chats — read-only with legal access logged
Deal and contract history
Payment history
Report history (submitted and received)
Admin action history on this account
Flow 48 — Admin Account Actions
Flow 49 — Admin Permanent Termination
Flow 50–58 — Full Admin Module Summary
SECTION 9 — FULL DATA MODEL (MVP → SCALE SAFE)
Users
AthleteProfiles
TeamProfiles
BrandProfiles
AgentProfiles
RepresentationLinks
JobListings
ConnectionRequests
Matches
Shortlists
Messages
Proposals
Contracts
Payments
Subscriptions
Reports
AuditLogs
SECTION 10 — MATCHING ALGORITHM SPECIFICATION
10.1 — Algorithm Inputs
10.2 — Hard Filters (Exclusions — Applied First)
10.3 — Scoring Stage (Soft Ranking)
Applied to remaining pool after hard filters. Highest scores appear first in marketplace search results and at top of swipe queue.
ℹ️  Athletes and teams receive no score penalty for not having a subscription. Their base scores are calculated identically regardless.
10.4 — Subscription Tier Filter Matching Thresholds
10.5 — Filter Loosening Sequence (Anti-Dead-End)
When a user's discovery queue is exhausted in Swipe Mode, or search returns zero results in Marketplace Mode, filters loosen progressively.
Loosening is per-session — on next app open the full filtered feed resets.
10.6 — Connection / Match Creation Logic
SECTION 11 — LEGAL & PAYMENTS CHECKLIST
11.1 — Platform-Wide Legal Obligations
Terms & Conditions acceptance logged: user ID, timestamp, IP, T&C version
Privacy Policy acceptance logged identically. Both required before profile published — cannot be bypassed.
T&C and Privacy Policy versioned — on material update, all users must re-accept before next login
GDPR: right to access (72hr delivery), deletion (14-day grace then purge), portability, object
UK GDPR and EU GDPR both observed. DPA available for Enterprise brands on request.
Neutral marketplace disclaimer: Podium does not employ athletes/teams, does not act as agent, does not mediate disputes
All contracts are between brand and athlete/team. Podium is not a party to any deal.
11.2 — Athlete & Team Legal Protections
Under-18 athletes require guardian consent before account activation
Under-18: all proposals flagged for guardian review; guardian receives a copy of every proposal and must co-sign contracts
Public vs private data clearly disclosed before profile goes live
Athletes and teams can request data deletion at any time
Tax disclaimer on first payment receipt
Payment receipts retained minimum 7 years (anonymised after account deletion) for legal compliance
11.3 — Brand & Sponsor Legal Obligations
Business identity confirmed before account approval (Companies House, website, LinkedIn)
Brands certify all listings are genuine and comply with advertising standards (ASA)
Brands acknowledge sole obligation to pay per contract terms
Brands must comply with ASA influencer disclosure rules
Contract ownership: once executed, contract is between brand and athlete/team; Podium stores a copy only
GDPR: brands are data controllers for athlete/team data processed outside the platform
11.4 — Agent Legal Requirements
Agents must disclose commission rate on profile (informational)
Agents must confirm authorisation by each athlete/team they represent
Podium does not enforce commission arrangements
Agents acting on behalf of under-18 athletes must have guardian consent logged
11.5 — Payments Infrastructure
11.6 — E-Signature
Provider: DocuSign or HelloSign (Dropbox Sign)
Full audit trail per signature event: signer ID, IP, device fingerprint, timestamp, geolocation
Once both parties have signed: contract locked, immutable, unmodifiable via platform
Signed contracts stored in AWS S3 with 7-year minimum retention
Accessible by: both parties, admin, relevant agent (if signatory or granted access)
Terminated contracts marked "terminated by platform" — document itself retained
SECTION 12 — FULL USER JOURNEY MAPS
Athlete Journey Map (Marketplace-First)
Brand / Sponsor Journey Map (Marketplace-First)
Team Journey Map
Agent Journey Map
PODIUM — BUSINESS MODEL IN ONE SENTENCE
Make it completely free for athletes, teams, and agents to list and be discovered — and charge brands and sponsors a premium to search, contact, and close deals.
Podium — Full Product Specification v2.0 — Confidential & Proprietary. Last updated April 2026.

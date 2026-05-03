PODIUM
Product Flows, Data Model & Algorithm Specification
Version 2.0  —  Marketplace-First  ·  Dual UI Modes  ·  Athletes Free  |  Revenue from Brands
Default: Airbnb-style marketplace browse  ·  Optional: Swipe Mode  ·  Light & Dark theme
🏟️  Core mechanic: Podium is a marketplace. Athletes and teams create searchable listings. Brands search, filter, shortlist, and send connection requests with a personalised message. The recipient accepts or declines. On acceptance, messaging unlocks and the brand must send a formal proposal before free-form chat is enabled. A Swipe Mode UI (Tinder-style) is available as an optional toggle in Settings — it uses the same data and deal flow.
SECTION 1 — GLOBAL FLOWS (ALL USERS)
Flow 1 — Landing Page
All users arrive at the Podium website or open the app and see a public marketing page designed to convert both supply (athletes/teams) and demand (brands).
The page displays:
Hero with dual CTAs: "List Your Profile" (athletes/teams) and "Find Talent" (brands)
Live-looking marketplace preview grid showing sample athlete and team cards
How It Works: Create Profile → Get Discovered → Close Deals
Role-specific panels: Athletes (free listing), Teams (free listing), Brands (paid search)
Social proof, trust signals, FAQs, Terms, Privacy Policy
Flow 2 — Sign-Up
User enters email and password (min 8 chars, 1 uppercase, 1 number, 1 symbol). Real-time strength indicator. Rate-limited to 3 resend attempts per hour.
Flow 3 — Email Verification
Verification link expires after 24 hours.
Flow 4 — Log-In
Flow 5 — Password Reset
User clicks Forgot Password → enters email → system always shows "If this email exists, you will receive a link" (prevents user enumeration) → reset link sent (expires 1 hour) → user sets new password → logged in → dashboard.
Flow 6 — Role Selection
First login only. Role permanently locked after confirmation. Cannot be changed.
SECTION 2 — PLATFORM DISCOVERY MODEL
2.1 — Marketplace Mode (Default for All Users)
Marketplace Mode is the default discovery experience. It provides a searchable, filterable grid of profiles — modelled on Airbnb. Athletes and teams are listings; brands are searchers.
2.2 — Swipe Mode (Optional — Toggle in Settings)
Swipe Mode is an optional secondary UI layer. It presents the same algorithm-ranked pool of profiles as a swipeable card stack. Same data, same matching logic, same deal flow — only the interface changes.
2.3 — Connection Request System
The primary matching mechanic for Marketplace Mode — equivalent to "Request to Book" on Airbnb.
2.4 — UI Mode & Display Theme Settings
SECTION 3 — ATHLETE FLOWS  (Always Free)
ℹ️  Athletes never pay. All features are free and unlimited — listing, searching, messaging, deal proposals, e-signatures, payment receipt. Athletes are the supply side of the marketplace; removing all barriers maximises supply quality.
Flow 7 — Athlete Profile Creation
Multi-step wizard with auto-save. Athlete can exit and return. Incomplete profiles held in Draft state.
Flow 8 — Athlete Marketplace Listing & Visibility Confirmation
Before going live, athlete sees a formatted preview of exactly what brands and agents will see. Profile includes all photos, social stats, performance data, city-level location, and travel radius.
Must tick: "I confirm this information is accurate"
Must accept Terms & Privacy Policy (logged: user ID, timestamp, IP, T&C version)
On acceptance: profile status → active; appears in marketplace search results
If media pending moderation: status → Pending Review; goes live within 24 hours
Flow 9 — Athlete Marketplace Discovery
Athlete browses brand campaigns and agent profiles. Default: Marketplace grid. Optional: Swipe Mode.
Filter loosening sequence when results exhausted:
Step 1: Travel radius expanded by +25km
Step 2: Adjacent sports included
Step 3: Level tolerance ±1 step
Step 4: Geographic filter removed — national pool
Step 5: International profiles included
Step 6: All non-blocked profiles of matching role shown
Flow 10 — Athlete Saved, Requests & Connections
Flow 11 — Athlete Match Notification & View
Match = accepted connection request (either direction) or mutual right-swipe in Swipe Mode.
Flow 12 — Athlete Messaging
Unlocks when connection accepted. No message limit for athletes.
Allowed content:
Text (no character limit), image (JPEG/PNG, max 25MB), video (MP4/MOV, max 200MB)
Documents (PDF, max 50MB — for contracts, briefs, rate cards)
Proposal cards (sent by brand — structured deal card appearing inline)
E-signature requests (embedded in chat), payment confirmation cards (auto-generated)
Chat retention: configurable. 48hr warning before any auto-clear. Chats with signed contracts never auto-cleared.
Flow 13 — Athlete Deal Proposal
Brand sends formal proposal card in chat (required before free-text messaging fully unlocks). Proposal contains: title, deliverables, payment, timeline, usage rights, additional terms.
Flow 14 — Athlete E-Signature
Brand sends contract (from accepted proposal or uploaded PDF)
Athlete notified: "You have a contract to review and sign"
Review in embedded PDF viewer or download for external review
Sign via finger/stylus (mobile) or mouse/typed name (desktop)
Once athlete signs: returned to brand for countersignature
Both signed: contract locked, immutable, stored in both dashboards
ℹ️  E-signature via DocuSign or HelloSign. Full audit trail: IP address, device, timestamp per signature event.
Flow 15 — Athlete Payment Receipt
Brand initiates payment after contract signed and work delivered
Stripe processes. Athlete push notification: "Payment received from [Brand Name]"
Receipt auto-generated and stored in Payment History dashboard
ℹ️  Podium is not employer or payroll agent. Athletes responsible for own tax. Disclaimer on first payment receipt.
Flow 16 — Athlete Settings
Flow 17 — Athlete Notifications
Flow 18 — Athlete Under-18 Guardian Flow
DOB entered in Step 1; system auto-detects age < 18
Mandatory Guardian Assignment screen before profile creation proceeds
Required: guardian full name, relationship, email, phone
Guardian consent email sent; must click Accept before account activates
Guardian receives copy of every deal proposal; must co-sign all contracts
On 18th birthday: email to both athlete and guardian confirming full independent control
ℹ️  If guardian consent not received within 7 days: profile creation paused. After 30 days of inactivity: partial profile purged.
Flow 19 — Athlete Account Deactivation & Deletion
SECTION 4 — TEAM FLOWS  (Always Free)
ℹ️  Teams use Podium to find sponsors. All features are free. Teams appear as searchable marketplace listings.
Flow 20 — Team Profile Creation
Flow 21 — Team Visibility Confirmation
Team administrator reviews public-facing profile preview, confirms accuracy, accepts Terms & Privacy Policy. Profile goes live or enters media review queue.
Flow 22 — Team Discovery & Search
Teams browse marketplace of Brand Profiles and Sponsor Campaigns. Default: Marketplace grid. Optional: Swipe Mode. Filters: industry, budget, location, sponsorship type. Connection request system identical to athlete flow.
Flow 23 — Team Match, Messaging & Deal
On connection acceptance: brand initiates conversation with a formal sponsorship proposal. Team reviews — Accept / Counter / Decline. Counter-proposal loop as needed. Acceptance → e-signature → payment → receipt. Identical to athlete deal flow.
Flow 24 — Team Settings
Covers: profile editing, administrator management, sponsorship offer/need updates, media uploads, visibility toggle, discovery UI mode (Marketplace/Swipe), display theme (Light/Dark), notification preferences, and account management.
SECTION 5 — BRAND & SPONSOR FLOWS  (Paid — Primary Revenue Source)
ℹ️  Brands and sponsors are the sole commercial engine of Podium. They pay a monthly subscription to search the talent pool and send connection requests.
Flow 25 — Brand Account Creation & Profile
Company name, trading name, industry/sector, description (max 600 chars), headquarters, website, LinkedIn (required)
Brand logo, cover image (optional), what seeking, target sports (up to 5), target level, geographic preference
Business verification required: company registration number or VAT number
ℹ️  Profile held in Pending Approval state. Admin reviews for legitimacy within 48 hours before account and listings go live.
Flow 26 — Brand Subscription & Payment
Flow 27 — Brand Listing & Campaign Creation
Athlete Job / Endorsement Listing:
Title, description, sport required, level required, location (or Remote), pay amount/type, deliverables, duration, usage rights, deadline, multiple hires (Y/N)
Team Sponsorship Campaign:
Title, description, sport(s), team level, geographic preference, budget, structure, what expected in return, duration, exclusivity, number of teams
Flow 28 — Brand Marketplace Search & Discovery
Marketplace Search (default):
Search by name, sport, location, university. Filters: sport, level, location, following, engagement, availability, verification
Sort: Most Relevant / Most Followed / Highest Engagement / Recently Active
Tap card → full profile. Shortlist profiles. Send connection request with personalised message from profile.
Swipe Mode (optional):
Same pool as card stack. Swipe right = connection request. Tier-limited undos.
When queue exhausted: loops and filters loosen. Brand notified.
Flow 29 — Brand Connection Request & Mandatory Proposal
ℹ️  On connection acceptance, the brand MUST send a formal structured proposal before free-text messaging unlocks. This ensures athletes and teams always know what is being offered before any relationship develops.
Flow 30 — Brand Messaging, Negotiation & Contracts
After proposal sent: full two-way messaging (text, images, videos, documents). Counter-proposals received and responded to. On acceptance: contract → e-signature → payment. All deal history stored in both dashboards.
Flow 31 — Brand Settings
SECTION 6 — AGENT FLOWS  (Always Free)
ℹ️  Agents are free. Income is commission from deals facilitated. Commission rates disclosed on profile. Podium records but does not enforce commission arrangements.
Flow 32 — Agent Profile Creation
Flow 33 — Agent Athlete & Team Management
Agent sends connection request to athlete/team (or receives one). On acceptance, agent sends a Representation Request card in chat.
All agent actions within a client's account are logged and visible to the client.
Flow 34 — Agent Discovery & Matching
Agents browse all three marketplace views: Athletes (talent to represent), Teams (commercial clients), Brands (opportunities for clients). Full search and filters. Swipe Mode available. Unlimited connection requests.
Flow 35 — Agent Deal Oversight
Brand proposal sent to athlete/team; agent receives alongside or instead of client (per permissions)
Agent reviews and responds: Accept / Counter / Decline on behalf of client
Counter-proposal loop — unlimited rounds
On acceptance: contract generated; e-signature to brand, athlete/team, agent (if signatory)
Payment via Stripe to athlete/team. Agent invoices client separately for commission.
Flow 36 — Agent Settings
Agency profile, client management (view all clients, manage permissions per client), deal and contract history, discovery UI mode (Marketplace/Swipe), display theme (Light/Dark), notification preferences, data download, account management.
ℹ️  On agent account deletion: all representation links severed; all clients notified and regain direct account control.
SECTION 7 — SYSTEM-WIDE FLOWS
Flow 37 — UI Mode & Display Theme (System-Wide)
Flow 38 — Verification Badge
Flow 39 — Reporting & Blocking
Reporting: three-dot menu on any profile or message → Report → reason (Fake profile / Inappropriate / Harassment / Spam / Underage / Other) → optional detail → submitted to Admin Review Queue. Reporter receives: "Thank you. We'll review within 48 hours."
Blocking: tap Block on profile. Blocked user vanishes from blocker's search and cannot find blocker. Existing chat disabled (not deleted). Blocked user NOT notified. Reversible in Settings → Privacy → Blocked Users.
Flow 40 — Notification Engine
Three delivery channels: push (iOS/Android), in-app badge/dot, and email. Configurable per channel per event in Settings.
Flow 41 — Chat Retention & Auto-Clear Engine
48-hour warning notification before any auto-clear
Cleared chats soft-deleted: invisible to users, recoverable by admin for 90 days, then permanently purged
Chat containing a signed contract is NEVER auto-cleared
Flow 42 — Account Deletion & GDPR Data Rights
Right to Deletion:
Settings → Account → Delete Account → type "DELETE" → 14-day grace period → all personal data purged
Completed contracts and payment records retained 7 years (anonymised) for legal compliance
Right to Access / Data Portability:
"Download My Data" in Settings → ZIP of profile, messages, deal history, payment records, media → emailed within 72 hours
ℹ️  Podium must respond to all GDPR data requests within 30 days per UK/EU GDPR obligations.
SECTION 8 — ADMIN FLOWS  (Admin Only)
Flow 43 — Admin Authentication
Separate URL; not linked from main app; access denied for non-admins
Email + password + mandatory 2FA (authenticator app — no SMS permitted)
Session idle > 30 min: auto-logout; full re-authentication required
Flow 44 — Admin Dashboard
Flow 45 — Admin User Management & Account Actions
Admin can search, filter, and view any user account. Full record includes private fields, billing history, all connections (read-only), all chats (read-only — with legal access log), deal and contract history, payment history, report history, admin action history.
Flow 46 — Admin Permanent Termination
Flow 47–55 — Full Admin Suite Overview
SECTION 9 — FULL DATA MODEL (SELECTED KEY TABLES)
All tables use UUID primary keys. Timestamps stored UTC. Sensitive fields never stored in plaintext. Full schema in Product Spec v2.0.
Users
ConnectionRequests
Matches
Shortlists
Proposals
SECTION 10 — MATCHING ALGORITHM SPECIFICATION
10.1 — Algorithm Role
The matching algorithm powers both Marketplace Mode and Swipe Mode. In Marketplace Mode it determines the ranked order of search results. In Swipe Mode it determines the order of the card stack. Same algorithm, same inputs, same scores — only the presentation layer differs.
10.2 — Hard Filters (Applied First)
10.3 — Scoring (Soft Ranking)
10.4 — Tier Search Thresholds
10.5 — Filter Loosening (Anti-Dead-End)
Applied when search returns zero results (Marketplace Mode) or queue exhausted (Swipe Mode):
10.6 — Connection / Match Creation Logic
SECTION 11 — LEGAL & PAYMENTS CHECKLIST
11.1 — Platform-Wide
T&C and Privacy Policy acceptance logged: user ID, timestamp, IP, version. Both required before profile published.
Versioned T&C — on material update, all users must re-accept on next login
GDPR: right to access (72hr), deletion (14-day grace), portability, object
UK GDPR and EU GDPR both observed. DPA available for Enterprise brands.
Neutral marketplace disclaimer: Podium is not employer, agent, or dispute mediator
11.2 — Athletes & Teams
Under-18: guardian consent required; co-signs all deals; receives all proposals
Public vs private data confirmed before profile goes live
Tax disclaimer on first payment receipt
Receipts retained 7 years minimum (anonymised after account deletion)
11.3 — Brands
Business identity verified before approval
All listings must be genuine and comply with ASA advertising standards
Brands hold sole payment obligation per contract
GDPR: brands are data controllers for athlete/team data processed outside the platform
11.4 — Agents
Commission rate disclosed on profile (informational only)
Explicit authorisation required per client
Guardian consent required for under-18 client representation
11.5 — Payments Infrastructure
11.6 — E-Signature
Provider: DocuSign or HelloSign (Dropbox Sign)
Audit trail per signature: signer ID, IP, device fingerprint, timestamp, geolocation
Contract immutable once both parties signed
Stored in AWS S3; 7-year minimum retention
Accessible by both parties, admin, and relevant agent (if signatory)
PODIUM — BUSINESS MODEL SUMMARY
WHO IS FREE: Athletes  •  Teams  •  Agents
WHO PAYS: Brands & Sponsors (Tier 1, Tier 2, or Tier 3 subscription)
WHY IT WORKS: Maximum free supply = maximum value for paying brands = maximum Podium revenue
Podium — Product Flows v2.0 — Confidential & Proprietary. Last updated April 2026.

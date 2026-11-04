# 4. Competitor feature matrix

*Research note, 3 November 2026. Shipmater compared with the eight direct competitors from document 1. Shipmater's column comes from the codebase. The competitors' columns come from their YC pages, launch posts, press coverage and third-party profiles. These are small, young companies (most have 2 to 20 people), so much of what they do isn't public, and their marketing claims aren't independently verified. Treat a competitor's ✅ as "says it does this", not "proven".*

**Key:** ✅ has it · ◐ partly · ❌ doesn't have it · — not applicable to their model · ? not stated publicly

---

## Who they are, in one line each

| | Shipmater | FleetWorks | Peer | Lanesurf | Manifold Freight | Cartage | GETASAP | TrueMile | chrt |
|---|---|---|---|---|---|---|---|---|---|
| **Model** | Two-sided shipper–carrier marketplace (software) | AI dispatcher for carriers plus AI carrier rep for brokers | AI-native freight brokerage | Voice AI tool sold to brokers | Spot load aggregator for carriers | AI freight coordinator ("Wilson") for manufacturers | Produce distributor with its own delivery | AI-run trucking company (own fleet) | TMS for same-day, time-critical freight |
| **Sells to** | Shippers and carriers | Carriers (free) and brokers (paid) | Shippers | Mid-sized brokers | Mid-to-large asset carriers | Manufacturers and distributors | Food retailers | Shippers and brokers (as a carrier) | Shippers, couriers, forwarders |
| **Batch / size** | — | S2023, ~20 | S2026, 2 | S2025, ~14 | W2024, ~5 | S2024, ~12 | S2025, 17–30 | F2026, 2 | Spring 2025, ~5 |
| **Money raised** | — | $17M Series A (Oct 2025) | Not disclosed | ~$0.5M pre-seed | $1.9M–2.4M seed | $3.3M seed (Oct 2024) | Not disclosed | ~$125k (Dealroom) | Not disclosed |
| **Takes freight liability?** | No (platform) | No | Yes (broker) | No | No | Coordinates; replaces broker | Yes (own goods) | Yes (carrier) | No (software) |

---

## The matrix

### A. Getting a load booked

| Feature | Shipmater | FleetWorks | Peer | Lanesurf | Manifold Freight | Cartage | GETASAP | TrueMile | chrt |
|---|---|---|---|---|---|---|---|---|---|
| Shipper posts loads on the web | ✅ | — | ✅ | — | ◐ | ✅ | — | — | ✅ |
| Load created from email, PDF, Slack, Teams or ERP | ❌ | ? | ? | — | ✅ (reads spot emails) | ✅ | — | ? | ? |
| Carrier offers and bidding | ✅ | ✅ | ✅ | ✅ (by phone) | ✅ (automated spot bids) | ✅ | — | — | ? |
| Instant quote or market rate guidance | ❌ | ? | ✅ | ✅ (negotiates) | ◐ (sales insights) | ✅ | — | ? | ? |
| Loads pulled in from many shippers and brokers | ❌ | ✅ (40+ brokers) | — | — | ✅ (core product) | — | — | ✅ | — |
| AI calls, texts or emails carriers to cover loads | ❌ | ✅ | ✅ | ✅ (parallel calls) | ❌ | ✅ (email) | — | — | ❌ |
| AI dispatcher that finds a carrier its next load | ❌ | ✅ (core product) | — | — | ◐ (fit against fleet) | — | — | ✅ | ❌ |
| Equipment stated on jobs and matched to trucks | ◐ (vehicles listed, no matching) | ✅ | ✅ (dry van, reefer, flatbed, hazmat, drayage) | ? | ✅ | ? | — | ✅ | ? |
| Preferred carriers and contracted lanes | ✅ | ? | ? | ? | ? | ✅ (lane coverage) | — | — | ? |
| Tender waterfall (offer to carriers in order) | ❌ | ? | ? | ? | ? | ? | — | — | ? |

### B. Running the load

| Feature | Shipmater | FleetWorks | Peer | Lanesurf | Manifold Freight | Cartage | GETASAP | TrueMile | chrt |
|---|---|---|---|---|---|---|---|---|---|
| Live GPS tracking | ◐ (endpoint exists, nothing feeds it) | ? | ✅ | ◐ | ◐ | ✅ | ✅ (own delivery) | ? | ✅ |
| Driver mobile app | ❌ | ❌ (phone, text, email) | ? | — | ◐ (one source) | ? | ? | ? | ✅ |
| Automatic exception handling (late, stuck, missed appointment) | ❌ | ? | ✅ | ? | ? | ✅ | ? | ✅ | ? |
| Status updates to shipper or customer | ◐ (receiver tracking page) | — | ✅ | ? | — | ✅ | ? | ? | ✅ |
| Event notifications (email, SMS, push) | ❌ (invites only) | ✅ | ? | ? | ? | ✅ | ? | ? | ? |
| Multi-stop routes and route optimisation | ✅ | ? | ? | ? | ? | ? | ✅ (own) | ? | ✅ (dispatch) |
| BOL, POD with signature and photos, rate confirmations | ✅ | ? | ✅ (paperwork) | ? | ? | ? | ? | ? | ◐ |
| Connects to the customer's TMS or ERP | ❌ | ✅ | ? | ✅ (claims <10 days) | ✅ | ✅ | — | ? | — (is a TMS) |
| Works inside email, Slack and Teams | ❌ | ✅ (email, text) | ? | ❌ | ◐ (email) | ✅ | — | ? | ❌ |
| Air or courier hand-offs for time-critical freight | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### C. Trust and compliance

| Feature | Shipmater | FleetWorks | Peer | Lanesurf | Manifold Freight | Cartage | GETASAP | TrueMile | chrt |
|---|---|---|---|---|---|---|---|---|---|
| Carrier authority and insurance check (FMCSA) | ✅ | ✅ (via Highway) | ✅ | ✅ (during the call) | ? | ✅ | — | — | ? |
| Identity verification of the person | ✅ (Stripe Identity) | ? | ? | ? | ? | ? | — | — | ? |
| Driver background check (Checkr) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | — | ? (own drivers) | ❌ |
| Drug and Alcohol Clearinghouse query | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | — | ? (own drivers) | ❌ |
| Ongoing re-checks after onboarding | ❌ | ◐ (Highway) | ? | ◐ (each call) | ? | ? | — | — | ? |
| Carriers can see that a broker or shipper is verified | ◐ (shippers verified, not shown) | ✅ (brokers pre-vetted) | — | — | ? | — | — | — | — |
| Companies and people with roles and invitations | ✅ | ? | ? | ? | ? | ? | — | — | ✅ (fleets) |

### D. Money

| Feature | Shipmater | FleetWorks | Peer | Lanesurf | Manifold Freight | Cartage | GETASAP | TrueMile | chrt |
|---|---|---|---|---|---|---|---|---|---|
| Payments collected in the platform | ✅ (Stripe, Plaid) | — | ✅ (broker bills) | — | ? | ? | ✅ | ✅ | ✅ (card and wire) |
| Carrier payouts, with pay-early | ✅ | — | ? | — | ? | ? | — | — | ✅ (same-day driver pay) |
| Factoring network with NOAs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | — | — | ❌ |
| Invoices | ✅ | — | ✅ | — | ? | ? | ✅ | ✅ | ✅ |
| Accessorials measured with evidence (detention, lumper) | ◐ (in quotes, not measured) | ? | ? | ? | ? | ? | — | ? | ? |
| Accounting sync (QuickBooks, Xero) | ❌ | ❌ | ? | ❌ | ? | ✅ (ERP) | ? | ? | ? |

### E. Platform

| Feature | Shipmater | FleetWorks | Peer | Lanesurf | Manifold Freight | Cartage | GETASAP | TrueMile | chrt |
|---|---|---|---|---|---|---|---|---|---|
| White-label tenants with branding | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ? |
| Shipper subscriptions | ✅ | — | ❌ | ✅ (SaaS) | ✅ (SaaS) | ✅ | — | — | ✅ (SaaS) |
| Ratings and reviews | ✅ | ? | ? | ? | ? | ? | — | — | ? |
| Measured performance scorecards | ❌ | ? | ? | ? | ◐ (insights) | ✅ (visibility) | — | ? | ? |
| Public API and webhooks | ❌ | ✅ | ? | ✅ | ✅ | ✅ | — | ? | ? |
| Any AI in the product | ❌ | ✅ | ✅ | ✅ | ◐ | ✅ | ✅ (Ozai order agent) | ✅ | ? |

---

## What the matrix says

**Shipmater leads on trust and money.** No competitor here combines carrier verification, personal identity checks, Checkr background checks, the Clearinghouse query, a factoring network, in-platform payments with pay-early, and white-label tenants. The verification rows are nearly empty for everyone else: they check authority and insurance, usually through a partner such as Highway, and stop there. That's Shipmater's best story for shippers who are worried about fraud and negligent-selection lawsuits.

**Shipmater trails on automation and live operations.** Every competitor except GETASAP sells the idea that software does the work. FleetWorks, Lanesurf and Peer talk to carriers for you, Cartage takes loads from wherever the shipper already works, and Manifold brings loads to the carrier instead of making them search. Shipmater has none of this, and its tracking isn't live.

**Two of the eight aren't really software competitors.** GETASAP sells produce and runs its own delivery; nothing public shows it offers freight services to others (document 1 said it did, based on the YC directory text, but searches since found no evidence). TrueMile is a carrier, and its YC listing is the only source for the YC link. Both matter as signs of where investors are going (companies that own the outcome), not as feature rivals. The real feature rivals are FleetWorks, Peer, Cartage, Lanesurf and Manifold, and chrt in its niche.

---

## Revenue models

### How each company makes money

| Company | Who pays | How | Known prices | Confidence |
|---|---|---|---|---|
| Shipmater | Carrier (load fees, onboarding); shipper (subscription) | Fee per load taken from the payment before it reaches the carrier; $99 carrier onboarding; monthly shipper subscription; white-label tenant subscriptions | 10% per load, 7.5% when the shipper pays at booking, 10% on factored loads; shipper subscription $35, $75 or $199 a month by yearly load value (draft) | From the code and the fees document |
| FleetWorks | Brokers; carriers use it free | Usage fee per covered load, or custom contracts | One profile reports a free first month, then $6 per load | Low: one third-party profile |
| Peer | Shipper | Broker spread: the shipper's price minus what the carrier is paid | Not public. Truckload brokers' gross margins run about 12–14% (J.B. Hunt 12.5% in Q2 2026, RXO 14.2% in Q1 2026) | Industry benchmark, not Peer's own number |
| Lanesurf | Brokers | Software sold to brokers, quoted per customer | Not public. Pitches about $50 more margin per load for the broker | Low |
| Manifold Freight | Carriers | Subscription, possibly plus a commission on booked loads | Not public | Low: one investor-data profile |
| Cartage | Shippers | "Cost-plus": the carrier's rate plus a disclosed markup, quoted per customer | Not public. Claims 25–40% savings against broker markups | Low: vendor marketing |
| GETASAP | Food retailers | Margin on the produce it sells, with delivery included | — | Not a freight fee |
| TrueMile | Shippers and brokers | Freight revenue as a carrier (paid per load or per mile) | Not public | Low: sources disagree on whether it's a carrier or software |
| chrt | Couriers, forwarders, shippers | Monthly software subscription | Solo $100 a month; Courier Ops $2,500 a month | Medium: chrt's pricing page |

**Market reference points:** load boards charge carriers a flat monthly fee (DAT about $49–$59 a month entry tier, Truckstop about $42), and the broker's spread still comes out of each load found there. Factoring costs carriers about 1–5% of the invoice, typically 2–3.5%. Broker quick pay costs about 1.5–3%, and Uber Freight offers it free on some loads.

### Is Shipmater competitive?

**On total cost, yes.** Take a $2,000 load. Through a broker taking a 13% spread, the carrier receives about $1,740. Through Shipmater at 10%, the carrier receives $1,800, and the shipper pays the same $2,000 plus a small subscription. Shipmater's total take is below a broker's, which is the point of a marketplace.

**On how it looks to carriers, no.** Three things work against it:
- **The whole fee lands on the carrier, and it's visible.** A broker's 13% is hidden in the rate it offers; Shipmater's 10% is shown as a deduction from the carrier's pay. Carriers compare it with FleetWorks (free, or about $6 a load) and load boards ($50 a month), and 10% looks expensive even though they keep more.
- **The carrier pays twice on factored loads.** Shipmater's 10% plus the factor's 2–3.5% means 12–14% gone, about the same as using a broker.
- **Carriers pay $99 to join.** None of the eight charge carriers to sign up. Carriers are the scarce side as capacity leaves the market, so this works against supply.

**The shipper side is cheap, possibly too cheap.** $35–$199 a month with no per-load fee costs shippers far less than a broker's spread or chrt's $100–$2,500 a month. That makes Shipmater an easy sell to shippers, but leaves money on the table from the side that is easier to charge.

### Suggested revenue model for Shipmater

This changes some decisions in the fees document of 30 October ("every load fee is paid by the carrier", "no factor fees"), so it's a proposal for you to decide on, not a settled plan.

| Revenue line | Today | Suggested | Why |
|---|---|---|---|
| Per-load fee | 10% from the carrier (7.5% if the shipper pays at booking) | About 8% in total, split: about 5% added to the shipper's price and 3% from the carrier (2% if the shipper pays at booking). Better still, carriers bid the amount they'll receive, and the shipper sees that plus Shipmater's fee as one price with the breakdown. | Carriers see "you keep 97%", which beats quick pay and factoring. The shipper still pays well under a broker's 12–14%. |
| Factored loads | 10% from the carrier | The carrier's normal 3%, plus a small fee from the factor per funded load (about 0.25–0.5%) | Factors get verified invoices with guaranteed payment; that's worth paying for. The carrier no longer pays twice. |
| Carrier onboarding | $99 up front | Free to join. The background check cost is recovered from the carrier's first load fees, or charged only if the carrier leaves before hauling a load. | Removes the only sign-up charge in this market. |
| Shipper subscription | $35 / $75 / $199 a month, required to post | Keep the tiers, with the first 3 loads free before a plan is needed | Lets a shipper try the platform with one real load. |
| AI add-on for shippers ("Shipmater Copilot", document 3) | — | Monthly add-on, roughly $99–$299 by size | New revenue that rides on the AI features as they ship. |
| Optional carrier plan | — | About $29–$49 a month for the AI dispatcher, priority alerts on matching loads and the owner-operator business view. The per-load fee stays the same. | Priced like a load board, the tool carriers already pay for. |
| White-label tenants | Subscription | Subscription plus a share of the load fees on the tenant's loads | Scales with the tenant's volume. |

**What it does to revenue:** on $1M of loads, today's model earns about $100,000 in load fees. The suggested split earns about $80,000 from load fees, plus factor fees, Copilot and carrier plans. The bet is that the lower, better-presented carrier fee brings enough extra carriers and loads to cover the 2-point gap. If you'd rather not lower the total, keep 10% overall but split it 6% shipper and 4% carrier. That alone fixes most of the perception problem.

---

## The features Shipmater can implement, in detail

Each gap below says who does it, what Shipmater has now, how it would be built in Shipmater's stack (Laravel API, Next.js, Postgres, Reverb, Stripe), how big the job is, and what it depends on. Sizes are rough: **S** is about a week, **M** two to four weeks, **L** one to three months, for one experienced developer.

### 1. Equipment on jobs, and matching (S–M, do first)

**Who does it:** FleetWorks learns each carrier's equipment and lanes; Manifold compares every load to the fleet; Peer advertises dry van, reefer, flatbed, hazmat and drayage.
**Shipmater today:** carriers can list vehicles, but a job doesn't say what equipment it needs, and offers carry equipment only as free text.
**How to build it:** add a required equipment type (and optional trailer length, temperature range, hazmat flag) to jobs; give vehicles the same fields; filter the carrier's job feed to loads they can haul; warn a shipper when an offer comes from a carrier without the equipment; let the carrier pick which truck will run the job. This is steps 1–2 of the fleet plan already discussed.
**Why first:** nearly every other matching feature (the AI dispatcher, notifications for "a load that fits you", the tender waterfall) needs it.

### 2. Notifications (M)

**Who does it:** FleetWorks works entirely over phone, text and email; Cartage sends updates into email, Slack and Teams.
**Shipmater today:** invitation and email-verification emails only; Twilio is used just for phone codes.
**How to build it:** a Laravel notification for each business event (new matching load, offer received, offer accepted, driver assigned, arrived, picked up, delayed, delivered, POD ready, paid, document expiring), sent through mail, Twilio SMS, web push and the existing Reverb channel. Add a settings page where each user chooses channels per event. Record SMS consent and handle STOP replies (TCPA).
**Depends on:** nothing new. Equipment matching makes "a load that fits you" possible.

### 3. Driver app and live tracking (M for a PWA, L for native)

**Who does it:** chrt has a driver app with live tracking; Peer and Cartage promise tracking to shippers.
**Shipmater today:** a `shipments/ping` endpoint stores GPS points, but nothing sends them.
**How to build it:** first, a mobile web view of the driver's job (stops, status buttons, POD capture with photos and signature, which exists already) that sends location while open. Then wrap it in Capacitor for iOS and Android so location keeps sending in the background and documents can be captured offline. Shipper and receiver tracking pages then show a live map through Reverb.
**Depends on:** notifications, so status changes reach people.

### 4. Telematics and ELD connection (M)

**Who does it:** no one in this list says so publicly, but Highway (which FleetWorks uses) now requires an ELD connection for identity checks, and Terminal sells one API into 300+ providers.
**Shipmater today:** none.
**How to build it:** the carrier connects their ELD once through Terminal's hosted flow; Shipmater stores the connection, pulls the assigned truck's position into the same ping table the driver app uses, and records which truck is really running the load. Hours of service can later feed matching.
**Depends on:** equipment and truck assignment (item 1).

### 5. Instant quote and rate guidance (M, plus a data licence)

**Who does it:** Peer and Cartage quote shippers; Lanesurf negotiates on price.
**Shipmater today:** route distance and a cost breakdown, but no market rate.
**How to build it:** license lane benchmarks (DAT RateView, Greenscreens or similar) through their API; show a "fair range" when a shipper posts, and "above or below market" on each offer. Blend in Shipmater's own completed loads as volume grows.
**Depends on:** equipment on jobs (rates differ by equipment).

### 6. Load from anything: email, PDF or spreadsheet (M, AI)

**Who does it:** Cartage's whole product starts here; Manifold reads spot-load emails for carriers.
**Shipmater today:** loads are typed into a form.
**How to build it:** give each shipper company an inbound address (for example `loads+company@`) and an upload box. Claude reads the email, PDF or spreadsheet and fills a draft job, marking any field it's unsure of; the shipper reviews and posts. Later, Slack and Teams apps send into the same entry point.
**Depends on:** equipment fields (so it can fill them).

### 7. AI dispatcher for carriers (L, AI)

**Who does it:** FleetWorks's core product; TrueMile runs its own trucks this way; Manifold does a simpler version.
**Shipmater today:** carriers browse and bid by hand.
**How to build it:** for each carrier, learn trucks, home base, preferred lanes and minimum rate per mile from their profile and history. When a load is posted, rank carriers and notify the best fits. Offer a backhaul when a carrier accepts a load, and let carriers turn on auto-offer within limits they set (for example, "dry van, over $2.40 a mile, within 300 miles of Dallas"). Every automatic offer is logged and can be withdrawn.
**Depends on:** equipment matching, notifications, and ideally rate data.

### 8. AI carrier outreach by text and phone (L, AI)

**Who does it:** Lanesurf calls dozens of carriers at once; FleetWorks and Peer do the same over phone, text and email.
**Shipmater today:** carriers must log in to see a load.
**How to build it:** when a load is still uncovered after a set time, send matching carriers a text with the load and a one-tap link to offer. An AI voice agent that calls and negotiates comes later, because voice needs recorded consent and careful TCPA handling. Shipmater's advantage here is that every carrier it contacts is already verified, so there's no compliance check to run on the call.
**Depends on:** notifications, matching, consent records.

### 9. Exception watcher (M, AI)

**Who does it:** Peer, Cartage and TrueMile promise it.
**Shipmater today:** none.
**How to build it:** a scheduled job checks each active load's last ping against its next stop and appointment: not moving toward pickup, ETA now late, at a stop longer than free time. It notifies the shipper and receiver with a new ETA and starts the detention clock with timestamps.
**Depends on:** live tracking (item 3 or 4), geofences around stops.

### 10. Tender waterfall (S–M)

**Who does it:** standard in broker TMSs; none of the eight advertise it.
**Shipmater today:** preferred carriers exist, but a job goes to everyone at once.
**How to build it:** the shipper orders preferred carriers for a lane; the job is offered to each in turn with a time limit (for example 30 minutes), then opens to the marketplace. A queued job advances the waterfall.
**Depends on:** notifications.

### 11. Ongoing monitoring and a visible "Verified" status (M)

**Who does it:** FleetWorks partly, through Highway; Lanesurf checks during each call.
**Shipmater today:** checks happen once at onboarding.
**How to build it:** a nightly job re-checks every active carrier's authority and insurance against FMCSA, pauses booking when either lapses, and re-checks at the moment a job is awarded. Show shippers a "Shipmater Verified" badge explaining which checks passed and when. Show carriers that a shipper is verified too.
**Depends on:** nothing new. This turns Shipmater's strongest column into something buyers can see.

### 12. API, webhooks and TMS connections (M, then L for EDI)

**Who does it:** FleetWorks, Lanesurf, Manifold and Cartage all connect to customers' existing systems.
**Shipmater today:** the API serves only Shipmater's own front end.
**How to build it:** publish a documented subset of the API with company API keys (create job, get status, get documents), and send webhooks for the same events as notifications. Add EDI 204, 990, 214 and 210 through a provider only when a large shipper requires it.
**Depends on:** notifications (shares the event list), audit log.

### 13. Accessorials with evidence (M)

**Who does it:** none of the eight say so publicly; it's a common payment dispute in trucking.
**Shipmater today:** detention and fuel surcharge are in quote requirements but not measured.
**How to build it:** geofence arrival and departure times give detention automatically against free time; add lumper (with receipt upload), TONU and layover as invoice lines with evidence attached.
**Depends on:** live tracking and geofences.

### 14. Accounting sync (M)

**Who does it:** Cartage connects to ERPs.
**Shipmater today:** none.
**How to build it:** QuickBooks Online and Xero connections that send shipper invoices and payments, and carrier earnings and fees, to the customer's books.
**Depends on:** nothing new.

### 15. Load aggregation from outside sources (L, and partly a business question)

**Who does it:** Manifold's core product; FleetWorks shows loads from 40+ brokers.
**Shipmater today:** only loads posted by Shipmater's own shippers.
**How to build it:** post unmatched loads out to DAT and Truckstop through their APIs, with replies coming back into Shipmater. Pulling outside loads in for carriers is the bigger move, but it changes Shipmater's model from a closed marketplace to an aggregator, so it's a business decision before it's a build.
**Depends on:** equipment matching and the legal question about broker authority from document 2.

### Not worth copying

- **Owning the freight (Peer, TrueMile, GETASAP).** Becoming a broker or a carrier takes on cargo liability, needs broker authority and a bond, and competes with Shipmater's own customers.
- **Air and courier hand-offs (chrt).** A separate niche with different customers and operations.

---

## Suggested build order

| Step | Build | Size | Closes the gap with |
|---|---|---|---|
| 1 | Equipment on jobs and matching | S–M | FleetWorks, Manifold, Peer |
| 2 | Notifications and SMS | M | FleetWorks, Cartage |
| 3 | Ongoing monitoring and "Verified" badge | M | Turns Shipmater's lead into something visible |
| 4 | Driver app (web, then Capacitor) and live tracking | M → L | chrt, Peer, Cartage |
| 5 | Tender waterfall | S–M | Broker TMSs |
| 6 | Load from email or PDF (AI) | M | Cartage, Manifold |
| 7 | Rate guidance | M + licence | Peer, Cartage, Lanesurf |
| 8 | AI dispatcher and text outreach | L | FleetWorks, Lanesurf |
| 9 | ELD connection, exception watcher, accessorials | M each | Peer, Cartage, TrueMile |
| 10 | API and webhooks, accounting sync | M each | FleetWorks, Lanesurf, Manifold, Cartage |

Steps 1–3 need nothing new from outside Shipmater and together take roughly six to ten weeks. After them, Shipmater matches the basics every competitor has, and its verification lead is visible to buyers.

---

## Sources

- FleetWorks: [TechCrunch, Oct 2025](https://techcrunch.com/2025/10/14/fleetworks-raises-17m-to-match-truckers-with-cargo-faster), [FreightWaves on the AI carrier rep](https://www.freightwaves.com/news/fleetworks-ai-powered-carrier-rep-stands-out-from-the-pack), [FreightWaves on the funding](https://www.freightwaves.com/news/how-fleetworks-17m-funding-fuels-ai-dispatcher-innovation), [TruckSmarter comparison](https://www.trucksmarter.com/blog/best-ai-dispatch-software-trucking)
- Peer: [Dealroom](https://app.dealroom.co/companies/peer_11), [Extruct](https://www.extruct.ai/hub/peer-freight-com/)
- Lanesurf: [YC profile](https://www.ycombinator.com/companies/lanesurf), [Voice AI Space](https://www.voiceaispace.com/tool/lanesurf), [Extruct](https://www.extruct.ai/hub/lanesurf-com/), [Carly alternatives guide](https://www.usecarly.com/blog/lanesurf-alternatives/)
- Manifold Freight: [YC profile](https://www.ycombinator.com/companies/manifold-freight), [YC launch](https://www.ycombinator.com/launches/Kce-manifold-we-get-carriers-better-spot-freight-increase-margins-up-to-30), [GeekWire on the founding](https://www.geekwire.com/2024/former-convoy-engineers-take-another-swing-at-trucking-tech-with-new-seattle-startup/), [GeekWire on the seed round](https://www.geekwire.com/2024/yc-grad-manifold-freight-raises-1-9m-for-trucking-logistics-software/), [MarketScale](https://marketscale.com/industries/hammer-down/inside-the-spot-freight-shift-how-manifold-is-simplifying-a-fragmented-logistics-market/)
- Cartage: [YC launch](https://www.ycombinator.com/launches/Lgg-cartage-autonomous-freight-operations), [FreightWaves on the $3.3M round](https://www.freightwaves.com/news/cartage-secures-3-3m-to-support-shippers-and-carriers-with-automation), [Extruct](https://www.extruct.ai/hub/cartage-ai/), [Wordware case study](https://wordware.ai/blog/how-cartage-automated-customer-reporting)
- GETASAP: [YC profile](https://www.ycombinator.com/companies/getasap)
- TrueMile: [Dealroom](https://app.dealroom.co/companies/truemile_ai), [G2](https://www.g2.com/products/truemile/reviews), [YC logistics directory](https://www.ycombinator.com/companies/industry/logistics/)
- chrt: [YC profile](https://www.ycombinator.com/companies/chrt), [chrt.com](https://www.chrt.com), [chrt pricing](https://chrt.com/pricing)
- Revenue models: [Preqin on FleetWorks](https://www.preqin.com/data/profile/asset/fleetworks/773231), [FreightWaves on Lanesurf margins](https://www.freightwaves.com/news/how-lanesurf-has-offers-waiting-on-62-of-loads-before-the-office-opens), [Caplight on Manifold Freight](https://www.caplight.com/company/manifoldfreight), [Toolmage on Cartage pricing](https://www.toolmage.com/en/tool/cartage/), [Arktms on broker margins in 2026](https://arktms.com/blog/freight-broker-margin-compression-purchased-transportation-costs-2026), [Tabi index on spot margins](https://www.supplychain247.com/article/tabi-index-broker-margins-rise-even-as-spot-demand-slows/fleet_management), [PricingSaaS on DAT plan prices](https://pricingsaas.com/companies/dat/diffs/2026W32), [TrustRadius on Truckstop pricing](https://trustradius.com/products/truckstop-com-load-board/pricing), [otrucking on factoring rates](https://otrucking.com/resources/guides/freight-factoring-rates-2026/), [otrucking on quick pay by broker](https://otrucking.com/resources/guides/quickpay-rates-by-broker/)
- Terminal and Highway: see document 1.

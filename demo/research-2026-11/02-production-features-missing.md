# 2. Production features Shipmater is missing (non-AI)

*Research note, 2 November 2026. Based on a review of the Shipmater codebase (all dashboard pages and API routes) against what shippers and carriers now expect from a digital freight platform and what the YC companies in document 1 offer. Each item says what exists today, what is missing, and why it matters.*

---

## How to read this

These are ordinary software features, not AI. They come first for a reason: an AI layer sits on top of data, and most of the data an AI agent would need (where the truck is, what equipment it has, what a lane costs) does not exist in Shipmater yet. Building these is what makes document 3 possible.

Priority is in three bands:
- **P1, blocks production use.** A serious shipper or carrier would hit this gap in the first week.
- **P2, needed to compete.** Competitors have it, and buyers compare.
- **P3, differentiators and polish.**

---

## What Shipmater already does well

So the gaps are read in proportion: Shipmater already has the full job lifecycle (open freight jobs, offers and bids, contracted jobs, multi-stop routes with optimisation), rate confirmations, BOLs, PODs with signatures and photo evidence, invoices, Stripe payments with commission and pay-early, a factoring network with NOAs, Plaid for shippers, carrier and driver verification (identity, Checkr, Clearinghouse, FMCSA lookup), company and people models with roles and invitations, preferred carriers, ratings, receiver tracking pages, shipper subscriptions and white-label tenants with branding. Many YC companies on the list have far less.

---

## P1: blocks production use

### 1. A driver app with real live tracking
**Today:** a `shipments/ping` endpoint stores GPS points, but nothing in the web app sends them (there is no use of the browser's location API, no installable app and no service worker). Tracking pages therefore have no live data.
**Missing:** an installable driver app, at minimum a progressive web app and ideally native iOS and Android, that sends location in the background, works offline at docks with no signal, captures POD photos and signatures, and receives push notifications. Browsers stop sending location when the screen locks, so true background tracking needs a native shell (Capacitor or React Native around the existing pages is the fast route).
**Why it matters:** live tracking is the most basic shipper expectation in 2026. Without it, every "where's my truck?" becomes a phone call.

### 2. Telematics and ELD connections
**Today:** none.
**Missing:** connect a carrier's ELD (Samsara, Motive, Geotab and others) once, and get truck location, hours of service and truck identity automatically. An aggregator such as Terminal (one API, 300+ providers) avoids building each integration.
**Why it matters:** it gives tracking without relying on a driver's phone, shows real available hours for matching, and is now the strongest carrier identity signal. Highway made an ELD connection mandatory for its identity checks.

### 3. Notifications
**Today:** only invitation and email-verification emails. Twilio is used only for phone codes.
**Missing:** email, SMS and push for the events that drive the business: a new load that matches a carrier, an offer received, offer accepted, driver assigned, arrived, picked up, delayed, delivered, POD ready, invoice paid, document expiring. Each user should be able to choose channels.
**Why it matters:** a marketplace lives on response time. Nobody watches a dashboard all day.

### 4. Equipment, fleet and matching
**Today:** carriers can list vehicles, but jobs do not state required equipment and nothing matches the two. Equipment appears only as free text on offers.
**Missing:** the fleet plan discussed earlier: trucks and trailers, owned, leased, rented or leased-on, documents with expiry, VIN decode, required equipment on every job, matching, and assigning a specific unit to a job.
**Why it matters:** without it, shippers get bids from carriers who cannot haul the load, and matching cannot be automated.

### 5. Ongoing carrier monitoring
**Today:** verification happens once at onboarding.
**Missing:** daily re-checks of operating authority and insurance against FMCSA, automatic pause when either lapses, re-check at booking, and readiness for FMCSA's new Motus identity status. Possibly ongoing driving-record monitoring through Checkr.
**Why it matters:** this is now the industry standard for fraud prevention, and coverage of a recent Supreme Court decision says brokers can be held liable for negligent carrier selection.

### 6. Legal operating basis
**Today:** commission on matched loads.
**Missing:** a lawyer's ruling on whether Shipmater needs FMCSA broker authority and a $75,000 BMC-84 bond. Not a feature, but it blocks going live at scale and affects how contracts, rate confirmations and liability are written.

### 7. Account security and audit
**Today:** password login; no two-factor authentication; no audit log of who changed what.
**Missing:** two-factor login (at least for owners, admins and anyone who can change payout details), an audit log for money, bank, verification and role changes, and admin "view as user" for support with every view logged.
**Why it matters:** payout redirection (changing the bank account) is a common freight fraud. Enterprise shippers will ask for these in security reviews.

---

## P2: needed to compete

### 8. Instant pricing and rate guidance
Shippers expect an instant truckload quote (Uber Freight and Loadsmart both lead with it). Shipmater has route distance and a cost breakdown but no market rate. Options: license lane benchmarks (DAT RateView, Greenscreens and similar), then add Shipmater's own history as it grows. Show shippers a "fair price" range before posting and show carriers whether an offer is above or below market.

### 9. Reach beyond Shipmater's own carriers
A new marketplace has few carriers, so loads sit unbooked. Post unmatched loads to the big load boards (DAT, Truckstop) through their APIs, with replies flowing back into Shipmater, and let carriers search Shipmater loads from those boards. Also: a "tender waterfall" that offers a load to preferred carriers in order, with a time limit each, before opening it to everyone.

### 10. Recurring lanes and templates
Most shipper freight repeats. Add lane templates (same pickup, delivery, equipment, rate), scheduled recurring jobs, and bulk upload from a spreadsheet. Contracts exist, but creating each job by hand does not scale.

### 11. Accessorials done properly
Detention and fuel surcharge appear in quote requirements, but there is no lumper, truck-ordered-not-used (TONU) or layover handling, and detention is not measured. With geofences (item 12), arrival and departure times are recorded automatically, detention is calculated against free time, and the charge is added to the invoice with evidence. This is one of the most common payment disputes in trucking.

### 12. Geofences, automatic status and ETA
Draw an area around each stop so arrival, loading and departure update themselves from the driver app or ELD. Compute a live ETA from the truck's position and remaining hours, and warn the shipper and receiver early when a load will be late.

### 13. Shipper integrations
Larger shippers will not type loads into a website. They need an API with webhooks, and the biggest ones need EDI: 204 (load tender), 990 (tender response), 214 (status updates) and 210 (invoice). Start with a documented REST API and webhooks; add EDI through a provider when a shipper requires it.

### 14. Accounting sync
QuickBooks Online and Xero sync for both sides: invoices and payments for shippers, earnings and fees for carriers. Small fleets live in QuickBooks. This was among Hemut's core features.

### 15. Claims and disputes
Already noted as deferred. Production needs an OS&D (over, short and damaged) report at delivery with photos, a cargo claim workflow with deadlines, and payment disputes for accessorials. Indemni's insurance shows where this is heading: verified evidence decides claims.

### 16. Carrier scorecards
Ratings exist. Add measured performance: on-time pickup and delivery (from geofences), tender acceptance, document turnaround, claims rate. Shippers filter by it; good carriers earn more work.

---

## P3: differentiators and polish

### 17. Proof at pickup
A photo of the plate, trailer and seal at pickup, matched against the assigned unit. A different truck turning up is a common sign of cargo theft. Few platforms check it.

### 18. Owner-operator business view
Earnings, fuel, lease or rental payments and maintenance per truck, giving cost per mile and profit per load. A reason for small carriers to open Shipmater every day.

### 19. Carrier-side broker and shipper verification
Highway now sells verification to carriers so they can check brokers. Shipmater can show carriers that a shipper is verified and pays on time (it already verifies shippers' businesses), which helps attract carriers.

### 20. Fuel card and quick-pay partnerships
Carriers choose platforms that get them paid fast and cheaply. Shipmater has pay-early; a fuel card or fuel-discount partnership is a common addition.

### 21. Multi-language driver experience
Spanish at minimum, for the driver app and documents. A large share of US drivers prefer it.

---

## Suggested order

1. **Foundations for live operations:** driver app (PWA first, then native shell), notifications, geofences, ETA.
2. **Trust:** ongoing monitoring, two-factor login, audit log, ELD connection through an aggregator.
3. **Matching:** fleet and equipment, instant pricing, tender waterfall, load-board reach.
4. **Scale for shippers:** lane templates, bulk upload, API and webhooks, accounting sync.
5. **Money and evidence:** accessorials, claims and disputes, scorecards, proof at pickup.

The legal question in item 6 should run in parallel from day one.

---

## Sources

- [Loadsmart ShipperGuide Marketplace (instant pricing and TMS API)](https://shipperguide-marketplace.loadsmart.com/)
- [Overdrive: Highway requires ELD connections for carrier identity](https://www.overdriveonline.com/business/article/15830147/highway-doubles-down-on-eld-connections-for-carrier-id-checks)
- [Highway for Carriers announcement](https://highway.com/press-releases/highway-unveils-highway-for-carriers---empowering-carriers-to-verify-brokers-and-combat-fraud)
- [Terminal telematics API](https://www.withterminal.com/)
- [Hemut YC launch (carrier back office features)](https://www.ycombinator.com/launches/NXf-hemut-ai-powered-truck-management-software)
- [FMCSA Motus coverage, DAT](https://www.dat.com/blog/fmcsa-registration-modernization-what-to-know-about-the-new-motus-system)
- [Insurance Business: Indemni Lloyd's cargo program](https://www.insurancebusinessmag.com/us/news/breaking-news/chaucer-backs-lloyds-cargo-program-targeting-strategic-theft-592392.aspx)

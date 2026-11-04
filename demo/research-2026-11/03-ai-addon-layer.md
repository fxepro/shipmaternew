# 3. AI features as an add-on layer

*Research note, 2 November 2026. These are the AI capabilities the YC companies in document 1 are built around, translated into features that sit on top of Shipmater's existing platform. "Add-on layer" means the marketplace, payments and verification stay as they are; the AI reads the same data and acts through the same API, with people approving what matters.*

---

## The idea in one paragraph

Every competitor funded in the last two years sells the same promise: the software does the work, not just records it. In freight that work is mostly reading documents, answering and making calls, watching shipments for problems, and deciding which truck takes which load. Shipmater already holds the records those tasks need (jobs, offers, stops, documents, verification, payments). An AI layer turns them into a team of assistants: one that turns a shipper's email into a posted load, one that finds a carrier its next load, one that reads every uploaded document, one that spots a late truck before the receiver does, and one that flags a suspicious carrier before it is booked. Each works through Shipmater's existing API, each action is logged, and anything involving money, rejection or a commitment waits for a person's approval.

---

## The features, by who they serve

### For shippers

**1. Post a load from anything.** The shipper forwards an email, pastes text, uploads a PDF tender or a spreadsheet, and the AI fills in the job: stops, dates and appointment windows, weight, commodity, equipment and special instructions, flagging anything it is unsure of. The shipper reviews and posts. This is the fastest way to remove the "typing loads into a website" objection without building EDI first.

**2. Pricing and offer assistant.** Suggests a target rate with a plain explanation ("similar loads on this lane paid $X–$Y in the last 30 days; reefer adds about Z"), ranks incoming offers on price, carrier score, equipment fit and on-time history, and, if the shipper allows it, counter-offers within limits the shipper sets. It needs the rate data from document 2, item 8.

**3. Exception watcher.** Watches every active load (driver app, ELD, geofences) and acts when something drifts: the truck is not moving toward pickup, the ETA now misses the appointment, a stop is taking longer than free time. It warns the shipper and receiver with a new ETA, proposes a new appointment, and starts the detention clock with evidence. Reactive tracking becomes proactive.

**4. Ask your freight anything.** A chat box over the shipper's own data: "which loads were late in October and why", "what did we spend on Texas lanes this quarter", "which carriers have the best on-time record on reefer". It answers from Shipmater's database, with links to the records.

**5. Status by phone, text or email.** A receiver or shipper texts "where is load 4412" and gets an answer from live data. Later, a voice agent can answer the phone for the same questions and make check calls to drivers who have no app running.

### For carriers and owner-operators

**6. AI dispatcher (load finder).** Learns each carrier's trucks, home base, preferred lanes, hours left and home time, then recommends loads, suggests a backhaul so the truck does not return empty, and, if the carrier allows it, places offers automatically within their minimum rate. This is FleetWorks's core product. In a young marketplace it does double duty: it is how loads get covered quickly.

**7. Paperwork assistant.** Reads every document a carrier uploads (insurance certificate, CDL, medical card, registration, inspection report, W-9, rate confirmation, lumper receipt) and extracts the fields, expiry dates and policy limits, checks them against what the profile says, and fills in the profile. It also checks that an insurance certificate names the right company and has enough coverage. This uses uploads Shipmater already collects, so it is the cheapest high-value place to start.

**8. Paid-faster billing.** After delivery, reads the POD and receipts, builds the invoice with every accessorial backed by evidence (detention from geofence times, lumper from the receipt), and, for factored loads, assembles the factoring packet automatically. Lighthouz reports brokers invoicing 36% faster with this kind of automation.

**9. Hands-free driver assistant.** Voice commands while driving: "accept that load", "I've arrived", "running 30 minutes late". It must be designed around distracted-driving rules: voice only, no reading while moving.

**10. Translation.** Spanish (and other languages) for the driver app, messages and documents, translated both ways between driver and shipper.

### For Shipmater (trust and operations)

**11. Fraud risk score.** Scores every new carrier and every booking for signs of fraud: new authority, phone, email, address, bank account or device shared with a revoked or flagged carrier, a free-mail address on an old authority, a recent change of bank details, a truck location far from the claimed base, a booking pattern that does not fit the carrier's history. High scores pause the booking for review. It also checks uploaded insurance certificates for signs of editing. This is the Indemni and Highway category, and it builds on the verification Shipmater already has.

**12. Admin review assistant.** Summarises a carrier's file for an admin: verification results, document problems, risk signals and history in one paragraph with links. **It recommends; it never decides.** Background check outcomes in particular must stay with a person: the FCRA requires adverse-action notices before anyone is rejected based on a report, and an automated rejection would undermine that process.

**13. Support agent.** Answers carrier and shipper questions from the Resources manual and the user's own account ("why is my payout not set up", "what's missing from my profile"), and hands over to a person with a summary when it cannot help.

**14. Audit and dispute triage.** Reviews invoices against rate confirmations and evidence, flags mismatches, and drafts dispute replies for an admin to send.

---

## How the layer is built

**One agent service, many skills.** A single back-end service hosts the assistants. Each assistant is a set of instructions plus "tools", which are thin wrappers around Shipmater's existing API: read a job, list offers, attach a document, propose an offer, send a notification. The assistants cannot do anything a user could not do through the API, and they act with the permissions of the person or company they work for.

**Events wake it up.** Laravel already has events and real-time broadcasting (Reverb). New load posted, document uploaded, GPS update, offer received: each event can trigger an assistant.

**People approve what matters.** Anything that spends money, commits a carrier, rejects someone or messages a customer for the first time goes to an approval queue unless the user has turned on automatic mode for that action with limits (for example "auto-bid on dry van loads over $2.40 a mile within 300 miles of Dallas").

**Everything is logged.** Every assistant action, with the input it saw and the reason it gave, goes in the audit log from document 2, item 7. This matters for disputes, insurance claims and regulators.

**Models.** Claude is the natural fit: Haiku 5.5 for high-volume, low-cost work such as document extraction and classification, Sonnet 5.5 for most agent work (load entry, dispatcher, exception handling, support), and Opus 5.5 for the hardest reasoning such as multi-load planning and negotiation strategy. Costs are controlled per company with monthly limits.

**Guardrails that are legal requirements, not just good practice:**
- **FCRA:** no automated adverse decisions on background checks.
- **Calls and texts (TCPA):** the FCC has treated AI-generated voices as "artificial voice", which needs prior consent for many calls. Voice and SMS agents need consent records and opt-outs.
- **Driver safety:** hands-free only while moving.
- **Privacy:** SSNs, bank numbers and background reports never go to the model. The assistants see what they need and nothing more.

---

## What to build first

| Order | Feature | Why first | Depends on |
|---|---|---|---|
| 1 | Paperwork assistant (7) | Uses uploads Shipmater already has, cuts onboarding time, strengthens verification. Low risk, visible value. | Nothing new |
| 2 | Post a load from anything (1) | Removes the biggest shipper friction without EDI. | Nothing new |
| 3 | Fraud risk score (11) | Differentiator for shippers; builds on existing verification. | Audit log; ongoing monitoring helps |
| 4 | AI dispatcher (6) | Covers loads fast; the marketplace's liquidity engine. | Fleet and equipment, notifications |
| 5 | Exception watcher (3) and paid-faster billing (8) | The operational payoff. | Driver app or ELD, geofences |
| 6 | Pricing assistant (2), ask-your-freight (4) | Value grows with data volume. | Rate data, history |
| 7 | Voice agents (5, 9) | Highest complexity and legal care. | Consent handling, everything above |

---

## How to package it

- **Free for carriers:** the dispatcher, paperwork assistant and paid-faster billing. They bring carriers onto the platform and keep them active, which is what makes the marketplace work.
- **Paid add-on for shippers ("Shipmater Copilot"):** load entry from email, pricing assistant, exception watcher, ask-your-freight. Priced per month or per load, on top of the existing subscription.
- **Built into every load:** the fraud risk score, shown to shippers as part of "Shipmater Verified".

---

## Sources

- [HappyRobot (AI workers for brokers): FreightWaves](https://www.freightwaves.com/news/happyrobots-15-6m-raise-will-focus-on-product-development)
- [FleetWorks two-sided AI dispatcher: TechCrunch](https://techcrunch.com/2025/10/14/fleetworks-raises-17m-to-match-truckers-with-cargo-faster)
- [Lanesurf parallel voice booking: YC profile](https://www.ycombinator.com/companies/lanesurf)
- [Lighthouz AI back-office claims: YC directory](https://www.ycombinator.com/companies/lighthouz-ai)
- [Hemut carrier AI features: YC launch](https://www.ycombinator.com/launches/NXf-hemut-ai-powered-truck-management-software)
- [Indemni fraud and insurance: Insurance Business](https://www.insurancebusinessmag.com/us/news/breaking-news/chaucer-backs-lloyds-cargo-program-targeting-strategic-theft-592392.aspx)
- [Highway ELD identity checks: Overdrive](https://www.overdriveonline.com/business/article/15830147/highway-doubles-down-on-eld-connections-for-carrier-id-checks)

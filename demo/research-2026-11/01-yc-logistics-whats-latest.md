# 1. What's latest on the YC logistics list

*Research note, 2 November 2026. Source list: the Y Combinator logistics directory (113 companies). The page loads its 50 newest and most featured entries; those 50 run from the 2023 batches through Fall 2026 and are saved in `yc-logistics-companies.csv` with a relevance rating for Shipmater. Funding figures below come from press and data aggregators and often disagree with each other; treat them as indicative, not audited.*

---

## The one-paragraph version

Almost every logistics company YC funded in 2025 and 2026 is "AI-native". They are not building better forms or dashboards. They are replacing the phone calls, emails and spreadsheets that freight still runs on with software agents that do the work: call carriers, negotiate rates, book trucks, plan loads, chase paperwork and audit invoices. The money has followed. HappyRobot, which sells AI agents to freight brokers, is reported to have raised a Series C of about $150M in August 2026 at a valuation around $1.2B, with eight of the ten largest US brokers as customers. FleetWorks raised $17M in October 2025 for an AI dispatcher that matches trucks and loads. Terminal raised $20M in July 2026 to be the single API into more than 300 truck telematics systems. In the same period, freight fraud has turned into its own product category: Indemni launched a Lloyd's-backed cargo insurance program in October 2026 that only pays out if the broker used its verification. For Shipmater, the message is that a clean marketplace with good compliance is now the floor, not the differentiator. The companies winning attention either take work off a human's plate or make fraud measurably less likely.

---

## Who on the list matters to Shipmater

Of the 50 newest companies, about 20 touch Shipmater's market (US truckload freight between shippers and carriers). The rest are warehouse robotics, procurement, e-commerce fulfilment or international trade, which do not compete with us.

### Direct competitors: matching shippers, brokers and trucks

| Company | Batch | What they do | Latest |
|---|---|---|---|
| **FleetWorks** | S2023 | AI freight marketplace. One agent works for carriers (learns equipment, lanes, availability), another for brokers (finds the best truck). | $17M Series A, Oct 2025, led by First Round. Says 10,000+ carriers onboarded and 15+ of the top 100 US brokers as partners. |
| **Peer** | S2026 | AI-native freight brokerage: quotes, finds carriers, tracks, handles exceptions for shippers. | Brand new, two people. Same pitch as Shipmater but with agents doing the broker's job. |
| **Lanesurf** | S2025 | Voice AI that calls dozens of nearby empty trucks in parallel, negotiates and books. Demo shows 96 trucks called and a load booked in 10 minutes. | Early stage (pre-seed or seed); claims tens of thousands of carrier calls a month for mid-sized brokers. |
| **Manifold Freight** | W2024 | Aggregates spot loads from many shippers and brokers into one place for carriers. | Small team; the "one place to find all loads" angle. |
| **Cartage** | S2024 | Freight coordination with no human coordinators. | 12 people. |
| **GETASAP** | S2025 | Produce distribution plus its own AI-native carrier and brokerage. | 30 people; vertical play (fresh food). *Correction, 3 Nov: later searches found no evidence it offers freight services to others; see document 4.* |
| **TrueMile** | F2026 | An AI-run trucking company with its own fleet; agents find freight and coordinate drivers. | Newest batch; shows investors now back AI-operated carriers, not just software. |
| **chrt** | Spring 2025 | Same-day, time-critical freight (healthcare, manufacturing). | Niche, premium segment. |

### Platforms that sell AI to brokers and carriers (they could power a competitor, or power us)

| Company | Batch | What they do | Latest |
|---|---|---|---|
| **HappyRobot** | S2023 | AI "workers" (voice, email, text) that run broker operations: carrier sales calls, check calls, appointment scheduling. Now positioning as an "operating system for the real economy". | Reported $150M Series C, Aug 2026, ~$1.2B valuation; 150+ customers. Earlier rounds: $15.6M Series A (a16z), $44M Series B (Base10). |
| **Hemut** | Spring 2025 | Truck management software for carriers with AI phone agents, document upload that fills in data, load sourcing and automated accounting. | Founder ran a trucking company; reported close to $1M booked revenue in its first year. |
| **Lunavo** | F2025 | AI assistant that runs a carrier's back office inside its existing tools. | Munich-based, Europe first. |
| **Flott HQ** | Spring 2025 | One AI control centre for planning, live tracking, invoicing and payments for transport companies. | Paris-based. |
| **Maximal** / **Fleetline** | S2025 | Algorithmic load planning for truckload fleets: which truck takes which load to maximise revenue per mile. | Fleetline has 11 people; both target mid-to-large fleets. |
| **Lighthouz AI** | S2024 | Back-office AI for brokers: freight bill audit, disputes, invoicing, collections. Says 70–85% of emails need no human. | 8 people. |

### Trust, data and money infrastructure

| Company | Batch | What they do | Latest |
|---|---|---|---|
| **Indemni** | W2024 | Cargo theft and freight fraud prevention: driver and carrier verification, tracking, pickup controls. | Oct 2026: launched a US cargo insurance program backed by Chaucer at Lloyd's for "strategic theft" (criminals posing as real carriers). Coverage requires using Indemni's checks. Reported $4M seed. |
| **Terminal** | S2023 | One API across 300+ telematics and ELD providers: GPS, safety events, diagnostics, fuel, dash-cam. | $20M Series A, Jul 2026, led by Battery Ventures, with Penske and Intact as strategic investors. |
| **Supadock** | W2021 | AI gate and yard access control, visitor verification, against cargo theft. | Small. |
| **Conduit** | W2023 | Software for the loading dock and yard at shipping and receiving sites. | 100+ customers, 172% net revenue retention, zero churn (company claims). |
| **Tank Payments** | S2022 | Payables automation for companies paying many carriers, and banking for trucking businesses. | 10 people. |
| **Rally** | W2025 | Fleet finance: fuel, maintenance, driver payroll, credit. | Europe first. |

---

## Five patterns worth understanding

**1. Agents are replacing the broker's phone.** The single biggest theme. A US truckload is still booked through calls and emails between a broker and a dispatcher. HappyRobot, Lanesurf, FleetWorks and Peer all automate that conversation, and the valuations say the market believes it. The implication for a marketplace like Shipmater is uncomfortable: if a broker's AI can call 96 carriers in ten minutes, a marketplace that waits for carriers to log in and bid looks slow. Our answer has to be that Shipmater's carriers are reachable instantly, pre-verified and priced, so there is nothing to call around for.

**2. Carriers are finally being sold to.** Hemut, Lunavo, Flott, Maximal and Fleetline all build for the carrier, not the broker. Carriers, especially small fleets and owner-operators, have been the least-served side of freight software. This is the side Shipmater already serves with payout setup, factoring, verification and documents. Back-office relief (paperwork, invoicing, getting paid, planning the next load) is what earns daily use.

**3. Fraud has become a product and an insurance requirement.** Cargo theft is reported as less frequent but much more costly (Verisk CargoNet counted 677 incidents in the US and Canada in Q2 2026, down 26% year over year, while losses rose). Highway, the leading carrier-vetting service, now requires an ELD connection to verify a carrier's identity and re-checks at booking, not just onboarding. Indemni goes further and ties insurance coverage to its checks. Coverage of Highway also says brokers can now face negligence claims in state courts for choosing a bad carrier. Verification is moving from "a badge" to "a liability shield".

**4. Data plumbing is being commoditised.** Terminal sells one API into hundreds of telematics systems. That means a small platform no longer needs to build dozens of ELD integrations to get live truck location, hours, and identity signals. This removes the main excuse for not having real tracking.

**5. Investors are backing vertical, operated businesses.** TrueMile runs its own trucks; GETASAP runs produce distribution plus a carrier; Donkey and Forge take full responsibility for shipments. Pure "software in the middle" is getting less funding than software that owns an outcome.

---

## Market backdrop (late 2026)

The freight market has been in a long downturn and is turning slowly. Over 80% of brokers in a Truckstop and Bloomberg Intelligence survey saw spot rates rise year over year in the first half of 2026, but carriers report thin margins and cash-flow strain. Analysts attribute the turn mainly to capacity leaving the market, not stronger demand; one estimate said regulatory enforcement alone could remove 10–15% of capacity in 2026, though others doubt it. Load-board truck postings were reported at a ten-year low, and spot rates have been outpacing contract rates, which pulls trucks toward the spot market. Executives expected tighter-than-normal capacity for this late-fall peak.

On the regulatory side, FMCSA launched **Motus**, its new registration system, in May 2026. MC numbers survive for now (FMCSA may phase them out later), and carriers are expected to verify their identity in Motus during 2026. Any carrier onboarding Shipmater builds should be ready to use the Motus identity status and the USDOT number as the primary identifier.

---

## Where Shipmater stands against this list

Shipmater's strengths are real and not common among these companies: a complete shipper–carrier marketplace with contracts and spot jobs, Stripe-based payments with commission, a factoring network with NOAs, deep carrier and driver verification (identity, Checkr, Clearinghouse), documents from rate confirmation to invoice, route optimisation, and white-label tenants.

The gaps are in three places. First, **live operations**: there is no driver app, no telematics, and the GPS ping endpoint has nothing feeding it, so tracking is not truly live. Second, **liquidity and speed**: no instant pricing, no reach beyond carriers who log in, and no notifications to pull people back. Third, **AI**: there is none, while every new competitor leads with it. Documents 2 and 3 in this folder turn those gaps into feature lists.

---

## Sources

- [YC logistics directory](https://www.ycombinator.com/companies/industry/logistics/)
- HappyRobot: [FreightWaves on the $15.6M round](https://www.freightwaves.com/news/happyrobots-15-6m-raise-will-focus-on-product-development), [Reuters via TradingView on the $44M round](https://de.tradingview.com/news/reuters.com%2C2025%3Anewsml_L4N3UQ01L%3A0-happyrobot-raises-44-million-to-expand-ai-agents-for-freight-operators), [StockAnalysis profile](https://stockanalysis.com/private/happyrobot/), [AI2Work on the $1.2B valuation](https://ai2.work/blog/happyrobot-hits-1-2b-valuation-as-voice-agents-outgrow-freight)
- FleetWorks: [TechCrunch, Oct 2025](https://techcrunch.com/2025/10/14/fleetworks-raises-17m-to-match-truckers-with-cargo-faster)
- Lanesurf: [YC profile](https://www.ycombinator.com/companies/lanesurf)
- Indemni: [Insurance Business, Lloyd's cargo program](https://www.insurancebusinessmag.com/us/news/breaking-news/chaucer-backs-lloyds-cargo-program-targeting-strategic-theft-592392.aspx), [Dealroom on the seed round](https://dealroom.co/news/160197-indemni-raises-4m-seed-to-fight-freight-fraud-with-data)
- Terminal: [FreightWaves](https://www.freightwaves.com/news/terminal-fleet-telematics-data-funding), [BetaKit](https://betakit.com/y-combinator-grad-terminal-raises-20-million-usd-series-a-round/)
- Hemut: [YC launch](https://www.ycombinator.com/launches/NXf-hemut-ai-powered-truck-management-software), [Confluent case study](https://www.confluent.io/blog/hemut-building-the-internet-of-freight-on-real-time-data/)
- Highway: [Overdrive on ELD-based identity checks](https://www.overdriveonline.com/business/article/15830147/highway-doubles-down-on-eld-connections-for-carrier-id-checks), [Transfix and Highway partnership](https://lasvegassun.com/news/2026/jun/23/transfix-and-highway-partner-to-give-freight-broke/)
- Market: [Truckstop and Bloomberg Intelligence survey](https://www.ajot.com/news/truckstop.com-bloomberg-intelligence-release-h1-freight-broker-q2-carrier-surveys), [CCJ on spot rates](https://www.ccjdigital.com/economic-trends/freight-demand/article/15832749/truckload-spot-rates-drop-in-midaugust-after-historic-run), [FreightWaves State of the Industry, June 2026](https://freightwaves.com/news/white-paper-state-of-the-industry-june-2026), [Ankura shipper guide](https://ankura.com/insights/tighter-trucking-capacity-wider-risk-a-shippers-guide-to-2026/)
- Motus: [FreightWaves](https://www.freightwaves.com/news/fmcsa-delivers-on-30-year-promise-with-motus-registration-system), [DAT](https://www.dat.com/blog/fmcsa-registration-modernization-what-to-know-about-the-new-motus-system), [J.J. Keller](https://jjkellercompliancenetwork.com/news/fmcsa-launches-motus-a-modernized-registration-system-for-motor-carriers)

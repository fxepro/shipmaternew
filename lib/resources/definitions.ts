/**
 * Definitions: the words Shipmater uses, what each means on the platform, and the industry term it maps to.
 * Shown as a top-level Resources page in every portal (components/resources/Definitions.tsx).
 * Keep these in step with the product: when a page or status is renamed, change it here the same day.
 */

export type Portal = 'shipper' | 'carrier' | 'admin';

export interface Definition {
  term: string;
  /** One sentence, plain words */
  short: string;
  /** How it works on Shipmater */
  detail?: string;
  /** What the rest of the industry calls it */
  industry?: string;
  /** Older or other Shipmater names it replaces */
  replaces?: string;
  /** Where to find it, by portal */
  where?: Partial<Record<Portal, string>>;
  /** Built, or decided and still to come */
  status?: 'planned';
}

export interface DefinitionGroup {
  id: string;
  title: string;
  intro: string;
  terms: Definition[];
}

export const DEFINITIONS: DefinitionGroup[] = [
  {
    id: 'load',
    title: 'The load',
    intro: 'Everything on Shipmater hangs off one record: the load. It is the same record from the first draft to the signed delivery receipt (POD), whoever is looking at it.',
    terms: [
      {
        term: 'Load',
        short: 'One movement of freight from its pickups to its drop-offs.',
        detail: 'A load holds its stops, the freight on it, the equipment it needs, its rate, the carrier and driver, live GPS and every document (BOL, rate confirmation, POD, invoice). It moves through one set of statuses from Draft to Delivered.',
        industry: 'Load, shipment',
        replaces: 'Job, freight job',
        where: { shipper: '/shipper/shipments', carrier: '/carrier/my-jobs', admin: '/admin/shipments' },
      },
      {
        term: 'Shipments',
        short: 'A shipper’s or broker’s list of all its loads, at every status.',
        detail: 'One page with tabs for Draft, Posted, Booked, In transit and Delivered. Brokers see the same page under the name Loads.',
        where: { shipper: '/shipper/shipments' },
      },
      {
        term: 'Loads (carrier)',
        short: 'The loads a carrier is booked on: Booked, In transit and Delivered.',
        detail: 'Each load is badged Marketplace or Contract freight, so the carrier can see how it was won.',
        where: { carrier: '/carrier/my-jobs' },
      },
      {
        term: 'Trip',
        short: 'A driver’s view of a load they are driving.',
        detail: 'Drivers see Trips where dispatchers and owners see Loads. A trip is live: GPS from the driver’s phone, arrival at each stop, photos, signatures and the POD.',
        industry: 'Run, dispatch',
        where: { carrier: '/carrier/my-jobs' },
      },
      {
        term: 'Stop',
        short: 'A pickup or a drop-off on a load.',
        detail: 'A load can have several of each. Stops come from saved locations, and each stop lists the freight picked up or delivered there.',
      },
      {
        term: 'Lane',
        short: 'An origin and a destination, such as Dallas, TX to Atlanta, GA.',
        detail: 'Rate check prices by lane. Completed loads on the same state-to-state lane are blended into the estimate.',
        industry: 'Lane',
      },
      {
        term: 'Equipment',
        short: 'The trailer or vehicle a load needs: dry van, reefer, flatbed, step deck and so on.',
        detail: 'Loads are matched to carriers that have that equipment, the endorsements it needs and the right insurance.',
      },
    ],
  },
  {
    id: 'freight',
    title: 'How a load finds a truck',
    intro: 'There are two ways to move a load, and the platform keeps them apart: sell it on the open market, or send it to a carrier you already have a contract with.',
    terms: [
      {
        term: 'Marketplace',
        short: 'Shipmater’s open market: loads any approved, matching carrier can see and make an offer on.',
        detail: 'A shipper or broker posts a load with terms and, optionally, a posted rate. Carriers make offers and the shipper accepts one. Unapproved carriers don’t see the Marketplace.',
        industry: 'Spot market, load board',
        replaces: 'Load board, Available jobs',
        where: { carrier: '/carrier/jobs', admin: '/admin/shipments' },
      },
      {
        term: 'Spot load',
        short: 'A one-off load priced at today’s market rather than at a contract rate.',
        detail: 'Every load posted to the Marketplace is a spot load.',
        industry: 'Spot freight',
      },
      {
        term: 'Contract freight',
        short: 'Loads sent straight to a carrier the shipper has a contract with, at the contract’s rate.',
        detail: 'Contract freight never appears on the Marketplace. The load goes to the contracted carrier, priced from the contract.',
        industry: 'Contract freight, dedicated or committed capacity',
        replaces: 'Contracted jobs',
        where: { shipper: '/shipper/jobs/contracted', admin: '/admin/ops/jobs/contracted' },
      },
      {
        term: 'Tender',
        short: 'Sending a contract load to the contracted carrier, who accepts or rejects it.',
        detail: 'Today the load is assigned to the contracted carrier when it is posted. Accept and reject, with the load falling back to the Marketplace on a reject, is planned.',
        industry: 'Tender, load tender (EDI 204)',
        status: 'planned',
      },
      {
        term: 'Contract',
        short: 'An agreement between a shipper or broker and a carrier on rates and terms.',
        detail: 'It sets the rate (per mile, flat or hourly), the fuel surcharge and the term. Contract freight is priced from it.',
        industry: 'Rate agreement, carrier contract',
        where: { shipper: '/shipper/contracts', admin: '/admin/ops/contracts' },
      },
      {
        term: 'Offer',
        short: 'A carrier’s price for a Marketplace load.',
        detail: 'The shipper accepts or declines it, and accepting books the load. Each offer shows how far it is above or below the market estimate.',
        industry: 'Bid, quote',
        replaces: 'Bid',
        where: { shipper: '/shipper/jobs/offers', carrier: '/carrier/offers', admin: '/admin/ops/jobs/offers' },
      },
      {
        term: 'Posted rate',
        short: 'The all-in price a shipper posts a Marketplace load at.',
        detail: 'Carriers see it on the Marketplace and can offer more or less. Leave it empty to ask for offers only.',
        industry: 'Posted rate, all-in rate',
      },
      {
        term: 'Rate check',
        short: 'Shipmater’s market range for a lane: low, typical and high.',
        detail: 'Road miles times the per-mile rate for the equipment, plus fuel above the base price and extras such as hazmat, temperature control and extra stops. Completed loads on the lane are blended in once there are enough of them. Shippers and brokers see it; carriers see only the posted rate.',
        industry: 'Rate guidance, instant quote, market rate',
        where: { shipper: '/shipper/rate-check', admin: '/admin/ops/rate-check' },
      },
    ],
  },
  {
    id: 'status',
    title: 'Load status',
    intro: 'One set of statuses, shown the same way on every page and in every portal.',
    terms: [
      { term: 'Draft', short: 'Being written; nobody else can see it.' },
      { term: 'Posted', short: 'On the Marketplace and taking offers.', detail: 'Contract freight skips this and goes straight to Booked.' },
      { term: 'Booked', short: 'A carrier is on the load and pickup hasn’t happened yet.', industry: 'Covered, dispatched' },
      { term: 'In transit', short: 'Picked up and on the road, with live GPS.' },
      { term: 'Delivered', short: 'Every drop-off done and the POD signed.' },
      { term: 'Disputed', short: 'The shipper or carrier has raised a problem that is being worked out.' },
    ],
  },
  {
    id: 'parties',
    title: 'Who is on a load',
    intro: 'Every record belongs to a company, and the person who did the work is recorded too. A person’s role comes from their company, never from the record.',
    terms: [
      { term: 'Shipper', short: 'The company whose freight it is. It posts loads and pays for them.', industry: 'Shipper, beneficial cargo owner' },
      { term: 'Broker', short: 'A licensed freight broker. It posts loads for its customers, books the carrier and pays it.', detail: 'Needs FMCSA broker authority and a $75,000 bond or trust on file.', industry: 'Freight broker, 3PL' },
      { term: 'Customer', short: 'The shipper a broker is moving freight for.', detail: 'It can see its loads but not change them.' },
      { term: 'Carrier', short: 'The trucking company that hauls the load, under its own USDOT number and authority.', industry: 'Motor carrier' },
      { term: 'Owner-operator', short: 'A driver who owns the truck and runs it as their own carrier.' },
      { term: 'Dispatcher', short: 'A person at a carrier who books loads and assigns drivers.' },
      { term: 'Driver', short: 'The person driving the truck. Sees the load as a Trip.' },
      { term: 'Receiver', short: 'The company at the drop-off. It sees inbound loads and signs for them.', industry: 'Consignee' },
      { term: 'Factor', short: 'A company that buys a carrier’s invoice and pays the carrier early.', industry: 'Freight factoring company' },
    ],
  },
  {
    id: 'trust',
    title: 'Approval and verification',
    intro: 'Both sides of a load are checked: the carrier and its drivers, and the shipper, broker or factor paying for it.',
    terms: [
      { term: 'Approved', short: 'Every required check has passed. The company can post, make and accept offers, and see the Marketplace.' },
      { term: 'Restricted', short: 'Can finish the loads it already has, but take on nothing new.' },
      { term: 'Not approved', short: 'Can set up its profile and team, but can’t post, offer or book until it is approved.' },
      { term: 'Business verification', short: 'Checks a shipper, broker or factor: registration, tax ID, address, sanctions lists and officers.', detail: 'US: Middesk, with an IRS EIN match. Canada and Mexico: Didit, against the national company register.', industry: 'KYB (know your business)' },
      { term: 'Background check', short: 'Basic for the carrier owner and every driver. Complete adds county records, the driving record (MVR) and the Clearinghouse query.', industry: 'Driver screening' },
      { term: 'Operating authority', short: 'A carrier’s USDOT number and, where needed, its MC number, checked with FMCSA along with its insurance filing.', industry: 'Authority, MC number' },
      { term: 'Test / Live mode', short: 'One switch for every outside check. In Test nothing real is checked or charged.', where: { admin: '/admin/settings' } },
    ],
  },
  {
    id: 'money',
    title: 'Money',
    intro: 'How a load gets paid for, and what Shipmater takes.',
    terms: [
      { term: 'Platform fee', short: 'Shipmater’s fee on each load, taken off the carrier’s payment.' },
      { term: 'Early-payment fee', short: 'A lower fee when the shipper pays before pickup.' },
      { term: 'Card hold', short: 'A card payment is held the day before pickup and charged at delivery.' },
      { term: 'Payment routing', short: 'Where a load payment lands: straight into the carrier’s Stripe account, or through Shipmater’s account first.', where: { admin: '/admin/settings' } },
      { term: 'Factoring', short: 'A carrier sells a delivered load’s invoice to a factor and gets paid early.' },
      { term: 'NOA', short: 'Notice of assignment: tells the shipper to pay the factor instead of the carrier.', industry: 'Notice of assignment' },
      { term: 'TONU', short: 'Truck ordered, not used: a fee paid to the carrier when a booked load is cancelled at the last minute.', industry: 'TONU', status: 'planned' },
    ],
  },
];

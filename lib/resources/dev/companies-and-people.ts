import { Building2 } from 'lucide-react';
import type { AdminManualTopic } from '../admin-manual';

/**
 * Training material: how companies and people are connected in the database.
 * Written as prose for new developers and operators. No secrets or live identifiers belong here.
 */
export const COMPANIES_AND_PEOPLE_TOPIC: AdminManualTopic = {
  slug: 'companies-and-people',
  category: 'Contents',
  title: 'Companies and people',
  icon: Building2,
  summary:
    'How every record in Shipmater is tied to a company and to the person who did the work. One naming rule covers every table, so anything about a company or a person can be found by a single column, which is what reporting and analytics depend on.',
  bullets: [],
  sections: [
    {
      id: 'rule',
      title: 'The rule',
      paragraphs: [
        'Shipmater is organised as company, then person, then role. A company is a row in the organizations table, with a type of shipper, carrier or factor. A person is a row in the users table. A person belongs to a company through org_members, which also holds their role there: owner, staff, dispatcher, driver or viewer. The company a person is working in right now is users.current_org_id, which the company switcher changes.',
        'Every column that points to a company is named after the part the company plays: org_id when a record simply belongs to one company, and shipper_id, carrier_id, factor_id, payee_id, payer_id, rater_id or ratee_id when two companies meet on the same record. All of them hold an organizations id. The person is always user_id and holds a users id. A role is never part of a column name, so there is no driver column or dispatcher column; a person’s role comes from org_members.',
        'Before this change, shipper_id and carrier_id on loads, bids, transactions, contracts, preferred carriers and locations held a person, and a second set of columns ending in _org_id held the company. That left two columns with nearly the same name and different meanings, which made reports easy to get wrong. The migration 2026_11_04_000001_company_and_person_columns.php switched each of those columns to the company, moved the person to user_id where the table records work, removed the duplicates, and renamed the remaining _org_id columns.',
      ],
    },
    {
      id: 'tables',
      title: 'What each table holds',
      paragraphs: [
        'Shipments and freight jobs hold shipper_id and carrier_id, the two companies on the load. Bids and freight job offers hold carrier_id, the bidding company, and user_id, the person who placed it, and a carrier company can have only one bid or open offer on a load, so two people at the same carrier cannot bid against each other. Transactions hold both companies and user_id for the carrier’s person who did the work. Contracts and preferred carriers are agreements between companies, so they hold shipper_id and carrier_id and no person at all. Locations belong to a company through org_id and are shared by everyone in it.',
        'Ratings are one company rating another: rater_id and ratee_id are companies, user_id is the person who wrote it, and a company can rate a job only once. Load payments hold the shipper, carrier and payee companies, and user_id for the shipper’s person who last acted on the payment, such as paying early. NOAs, factored loads and fee charges hold carrier_id and factor_id. Carrier vehicles and documents hold carrier_id, shipper documents hold shipper_id, and carrier checks hold carrier_id for checks on the company, such as the DOT and MC lookups, and user_id for checks on a person, such as identity, background and Clearinghouse. The person tables, which are identity, verification and credentials, are keyed by user_id alone.',
      ],
    },
    {
      id: 'load-people',
      title: 'People on a load',
      paragraphs: [
        'A load usually involves people from two companies, for example the shipper’s dispatcher and one or more of the carrier’s drivers. Each of them is a row in load_people with the load, their company in org_id and the person in user_id, plus who added them. The shipper’s person is recorded when they post the load or accept a bid or offer, and the carrier’s person when their bid or offer is accepted, when they accept a contracted job, or when they update a stop.',
        'Drivers are the carrier company’s load_people rows for people whose role in org_members is driver. Assigning a driver from the driver picker replaces the carrier’s current driver rows with the chosen person, and only drivers Shipmater has approved, with current credentials, can be chosen. A driver signing in sees only the loads they are on, while everyone else at the carrier sees all of the company’s loads.',
      ],
    },
    {
      id: 'signup',
      title: 'Signing up creates the company',
      paragraphs: [
        'A shipper, carrier or factoring company signs up as the owner of its company. The sign-up form asks for the legal business name and will not continue without it. That name becomes the company’s name and legal name in organizations. The name the person signs up with is split into legal first and last name on their identity record. The person signing up is recorded in org_members as the owner. Everyone else joins later through an invitation from the company’s Team tab, signs up with the invited email address, and is added to the same company with the role on the invitation. They are not asked for a company name and no second company is created. Receivers do not have a company and are not asked for one.',
        'The legal business name has one home. When the owner changes it on the Business tab of their profile, the company’s name changes with it. Companies created before this rule were named after their owner, such as “Alex Morgan’s Shipper”; the migration 2026_11_05_000001_name_companies_by_legal_name.php renamed every one whose owner had entered a legal business name.',
      ],
    },
    {
      id: 'profile-data',
      title: 'Where profile details are kept',
      paragraphs: [
        'There are no shipper or carrier profile tables any more. Before this change each owner had a shipper_profiles or carrier_profiles row that mixed the company’s details with their own, such as the DOT number next to their date of birth. The migration 2026_11_05_000004_move_profile_data_to_companies_and_people.php copied every value to where it belongs, and 2026_11_05_000005_drop_shipper_and_carrier_profiles.php then dropped the old tables and the columns that pointed at them.',
        'Company details are columns on organizations. Details every company has, such as legal name, tax id, address, phone, business type, industry, rating and the Stripe payout account, have no prefix. Details only one kind of company has start with shipper_ or carrier_, for example shipper_coi_url and shipper_notif_email for a shipper, and carrier_dot_number, carrier_mc_number and the carrier_auto_ and carrier_cargo_ insurance columns for a carrier. A shipper’s carrier_ columns are always empty, and a carrier’s shipper_ columns are always empty. DOT and MC numbers are stored as digits only. A carrier’s payout account is stripe_connect_id and stripe_connect_status, the same columns a factoring company uses. The Plaid access token is encrypted and never sent to a page.',
        'Every login is a person, owners included, so anything about the person is kept against their user_id and never on users itself. Legal name, date of birth, home address, phone, WhatsApp, ID document and the last four digits of the SSN are on person_identities, and the SSN digits and national ID number are encrypted. Licences and tests, such as the CDL, DOT medical card, drug test and endorsements, are rows in person_credentials. Approval, the background check and the Clearinghouse query are on person_verifications.',
        'The profile pages still send and receive the same field names, so nothing on them changed. When a person saves, each field goes to its home: company fields to the company and personal fields to the person. Only the company’s owner or staff can change company fields; for anyone else those fields are left as they are, and the response says so in can_edit_company so a page can show them read only.',
      ],
    },
    {
      id: 'admin-tabs',
      title: 'The company page in the Admin Console',
      paragraphs: [
        'Admin Console, Companies, then a company opens a page with the same tabs the company sees on its own profile. A shipper has Overview, Business, Services, Compliance, Payment, Subscription, Notifications, Team and Loads. A carrier has Overview, Business, Services, Insurance and authority, Vehicles, Payouts, Team and Loads. Overview holds company approval, the company background check and activity counts. Team lists the members with their roles and person approval, and the invitations that have not been accepted. Loads lists recent shipments, contracts, preferred carriers and, for shippers, saved locations.',
        'Approval needs a clear company background check, and for a carrier the owner must also be approved as a person. The Overview tab says which of these is missing before the Approve button can be used. Payment details show only bank and card names, last four digits and statuses. Plaid, Stripe and bank tokens are never sent to the page.',
      ],
    },
    {
      id: 'access',
      title: 'How access follows the company',
      paragraphs: [
        'Because loads point at companies, anyone in the shipper company can see and manage that company’s loads, not only the person who created them, and the same holds on the carrier side. The checks compare the load’s shipper_id or carrier_id with the person’s current company. What each role may do within the company is a separate layer, the permissions matrix.',
        'Records that go to the other company show only its public columns: id, name, type, email, phone, city, state, logo, rating, and for a carrier its DOT and MC numbers, whether they are verified, whether its insurance is verified and how many deliveries it has made. Bank, tax and Stripe details on organizations never leave through a load. The shipper’s view of a carrier’s background checks now takes the carrier company’s id rather than a person’s.',
      ],
    },
    {
      id: 'reporting',
      title: 'Searching for reports',
      paragraphs: [
        'Everything about one company is found by its id in org_id, shipper_id, carrier_id or factor_id, depending on the table, and every load it was on by shipper_id or carrier_id. Everything one person did is found by user_id, including every load they worked through load_people. Because the names match across tables, a reporting view over all of them needs no translation between person ids and company ids.',
      ],
    },
    {
      id: 'testing',
      title: 'How it was tested',
      paragraphs: [
        'The local database was backed up before the migration ran, and the migration runs inside a single transaction, so a failure leaves nothing half changed. Afterwards every shipment, transaction, contract, preferred carrier and location was checked to point at the right company, and load_people held the shipper and carrier person for every existing load.',
        'Moving the profile details was tested the same way. The database was backed up before each of the two migrations. A script inside a rolled-back transaction checked 39 things: reading and saving the carrier and shipper profile pages and that each value landed on the company or the person, the CDL becoming a credential, adding a vehicle to the company, the carrier directory, a shipment showing the carrier’s public details and no personal ones, preferred carriers, the admin company list, company pages and user pages, an admin shipment, and signing up a new carrier. It passed before and after the old tables were dropped, and again on a brand new database migrated and seeded from nothing. The carrier profile, shipper profile and admin company pages were then opened in the browser with no errors.',
        'The endpoints were tested in a script that signs in as each demo person and runs inside a database transaction that is rolled back. It covers a shipper and a member of its staff both seeing the company’s loads, a carrier seeing only its own, a bid recording the company and the person, a second person at the same carrier being refused a second bid, accepting a bid and recording both people, a driver being refused unless they belong to the carrier, a driver seeing only their own loads, removing a driver, contracts, preferred carriers, transactions and locations by company, a freight job offer and its acceptance, a rating between companies, payments, factoring, the shipper’s view of background checks, the carrier directory and the admin pages. All 42 checks passed, and the earlier background check test still passed all 26 of its checks. A brand new database was also migrated and seeded to confirm a fresh install creates the companies first and records the people on every demo load.',
      ],
    },
    {
      id: 'files',
      title: 'Where the code lives',
      paragraphs: [
        'The migration is api/database/migrations/2026_11_04_000001_company_and_person_columns.php. It cannot be rolled back automatically, because it changes what existing columns mean, so restoring means restoring the database backup taken before it ran. The LoadPerson model is the load_people table, and the HasLoadPeople trait gives shipments and freight jobs their shipper and carrier companies, their people, their drivers and the forOrg and forPerson searches. On the User model, isShipperOf and isCarrierOf compare a record with the person’s current company, and Organization::PUBLIC lists the columns safe to show another company.',
        'Company helpers are on the Organization model: digits for DOT and MC numbers, setLegalName, and the vehicles, carrierDocuments, shipperDocuments and certifications relations. Person helpers are in PersonChecks: credential and setCredential for a person’s licences, splitName, companyOf, and recordClearinghouse. CarrierController and ShipperProfileController build the profile pages from these, and AdminCompanyController builds the admin company page.',
        'Columns that record who took an action, such as decided_by, uploaded_by, funded_by and background_checks.payer_user_id, were left as they are. The receiver on a shipment is still a person in receiver_id until receiving companies are added with the facilities work.',
      ],
    },
  ],
};

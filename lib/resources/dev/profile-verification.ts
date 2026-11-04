import { UserCheck } from 'lucide-react';
import type { AdminManualTopic } from '../admin-manual';

/**
 * Training material: how payout account setup (Profile / Verification) was designed and built.
 * Written as prose for new developers and operators. No secrets or live identifiers belong here.
 */
export const PROFILE_VERIFICATION_TOPIC: AdminManualTopic = {
  slug: 'profile-verification',
  category: 'Contents',
  title: 'Profile / Verification',
  icon: UserCheck,
  summary:
    'How carriers and factors set up the account they get paid into. Shipmater collects every detail Stripe needs in its own profile tabs, sends it to Stripe in one go, and translates Stripe’s answer back into the field that fixes it. This document explains the reasoning behind each part so the design can be maintained and extended without re-learning it.',
  bullets: [],
  sections: [
    {
      id: 'problem',
      title: 'The problem this solves',
      paragraphs: [
        'Shipmater never holds money. When a shipper pays for a load, the payment lands directly in the carrier’s (or the factor’s) own Stripe account, and Shipmater’s commission is taken out on the way. For that to work, every carrier and factor needs a Stripe connected account that has passed Stripe’s identity and business checks. Stripe calls this onboarding.',
        'The first version sent people straight to Stripe’s hosted onboarding pages with an empty account. In testing this was slow and frustrating: Stripe asked again for names, dates of birth, addresses and business details that the carrier had already typed into Shipmater, the flow ran in a popup that some browsers handled badly, and if the person stopped halfway nothing told them what was left. The goal of this build was to make Shipmater the single place where the information is entered, and to make Stripe’s part as short as Stripe allows.',
      ],
    },
    {
      id: 'constraint',
      title: 'What Stripe allows, and the one step it keeps',
      paragraphs: [
        'Shipmater uses Stripe Connect Express accounts on the Accounts v1 API. Stripe’s documentation for Express says the platform may prefill any account information before onboarding, including personal details, business details, people on the account and the bank account, and that onboarding then skips what was prefilled and only asks the account holder to confirm it. The one thing a platform cannot do on an Express account is accept Stripe’s terms of service on the user’s behalf, so Stripe always shows a final page to review the details and accept. That page is the minimum, and the design treats it as the only Stripe step.',
        'Stripe also documents an important rule: once an onboarding link has been created for an Express account, the platform can no longer read or update that account’s identity details. This rule drives a lot of the design. It means the data has to be complete and correct before the first link is created, and it means that if someone changes their details after a link exists but before they finish, the old account cannot be corrected and must be replaced. Both points are handled in the service described below.',
        'New Stripe platforms are steered towards the newer Accounts v2 API. Using v1 requires the setting called Accounts v1 support to be switched on in the Stripe dashboard, separately for the sandbox and for live mode. Stripe’s PHP library also turns Stripe’s informational notice about v2 into a PHP warning, and Laravel treats warnings as errors, which made account creation fail even though Stripe had already created the account. The small helper StripeNotice runs the account-creation call with that one warning logged instead of thrown. Moving to Accounts v2 is a separate future piece of work.',
      ],
    },
    {
      id: 'requirements',
      title: 'Working out exactly what Stripe needs',
      paragraphs: [
        'Rather than guessing, the required fields were taken from Stripe’s published requirements lookup on its Required verification information page, queried for a US platform, US accounts, the Express dashboard, the full service agreement, and the card payments and transfers capabilities, once for each business structure a trucking business might have.',
        'For an individual the account needs the person’s legal name, email, phone, date of birth, home address and the last four digits of their Social Security number, plus account-level items: an industry code, a website or a description of the business, the name shown on customers’ card statements, a bank account and the terms acceptance. A sole proprietorship or single-member LLC needs the same person details for the representative, plus the legal business name, EIN and business address. A multi-member LLC, corporation or partnership additionally needs the business phone, the representative’s job title, and the name and email of every owner holding 25 percent or more, with a confirmation that all of them have been listed.',
        'Stripe marks some of these as due immediately and others as due later, once volume builds up. Shipmater asks for all of them up front and makes them required, so the account opens complete and nobody is interrupted later. Stripe can still ask for more in rare cases, such as a full Social Security number or a photo of an ID when it cannot verify what it was sent; those can only be collected on Stripe’s own page and are shown to the user that way.',
      ],
    },
    {
      id: 'tabs',
      title: 'Where the information is collected',
      paragraphs: [
        'For carriers the first three profile tabs are Personal, Business and Financial, in that order, because together they hold everything that goes to Stripe. Personal holds the owner’s own details. The last four of the SSN was added there as a required field. It is stored encrypted and never sent back to the browser; the API only reports whether one is saved, and leaving the field blank keeps the saved value.',
        'The Business tab starts with one question: how is the business set up? The six choices mirror Stripe’s business structures in plain language, each with a one-line explanation. The fields below appear according to the choice, the way Stripe’s own forms behave, so an owner-operator working under their own name sees almost nothing extra while a multi-member LLC sees business details, an ownership section and an owners list. Every field Stripe needs is marked with a red asterisk. The card statement name is suggested from the legal or business name, because Stripe rejects statement names that do not resemble the account’s name; a real sandbox run returned exactly that rejection, which is why the hint now explains the rule.',
        'The Financial tab holds the bank account at the top and the payout section at the bottom. The one-time fee is not here. It pays for the background check, so it sits as the last section of the Background tab, styled like the other sections there. Two reasons put it there. By the time a carrier reaches the end of the profile they have already filled in everything else, so they are more willing to pay. And once the fee is paid, the same section shows the check’s progress, so it stays useful instead of turning into a finished box nobody needs. Paying starts the check through Stripe’s payment webhook. The button to start the check by hand only appears after payment, for the case where the check failed to start or has to be run again. Factors have no personal profile, so their representative, meaning the owner or officer opening the account, is entered in a section of the Company tab alongside the same business form, and their bank account and payout section live on the Finance tab.',
      ],
    },
    {
      id: 'bank',
      title: 'Handling bank details without holding them',
      paragraphs: [
        'Bank account and routing numbers never reach Shipmater’s servers. The bank form in the browser hands them to Stripe.js, Stripe’s own script, which sends them straight to Stripe and returns a single-use token. Shipmater stores that token together with the bank name, routing number and last four digits for display. When the account is created, the token is attached to it and then cleared, because a token can only be used once.',
        'Once an account has been finished at Stripe, changes to the bank account are made in Stripe’s own payouts dashboard, and the form says so instead of offering an edit that would have nowhere to go.',
      ],
    },
    {
      id: 'data',
      title: 'Data model',
      paragraphs: [
        'Business details belong to the company, so they are stored on the organizations table: the business structure, legal name, EIN, business address and phone, website, card statement name, the representative’s title and ownership share, the bank token and display fields, and a JSON copy of Stripe’s latest requirements. People other than a carrier’s owner are stored in a new business_people table, which holds a factor’s representative and the owners with 25 percent or more for either kind of company, with the SSN digits encrypted.',
        'Where the Stripe account id lives was left unchanged on purpose, because the load payment engine already looks it up in those places: a carrier’s account id stays on its owner’s carrier profile, and a factor’s stays on its organization. Changing that would have meant touching the payment engine for no benefit.',
      ],
    },
    {
      id: 'service',
      title: 'The service that sends it once',
      paragraphs: [
        'All of the logic sits in one service, StripeOnboarding, so carriers and factors share it. It has three jobs. The first is to list what is missing: it checks every required field across the profile and returns each gap with the area that fixes it, which the payout checklist shows with a link to the right tab. The button to set up payouts stays disabled until that list is empty, and the API refuses to submit if anything is still missing, so the browser is never the only guard.',
        'The second job is the submission. It builds one set of account details from the person, the business and the bank token and creates the account with all of it in a single call. For business structures it then adds the representative, with their title and ownership, and each listed owner, and marks the owners as provided. If any of those later calls fail, the half-made account is deleted so the next attempt starts clean, and Stripe’s error is translated into the name of the Shipmater field that caused it. Finally it creates the onboarding link and returns it, and the page moves to Stripe in the same window, which avoids popup problems.',
        'Because identity details lock once a link exists, the service records a fingerprint of everything it sent. If the user returns to an unfinished account without having changed anything, it simply creates a fresh link to the same account. If they have changed something, it deletes the unfinished account and sends the new details to a new one, asking for the bank account again first since the old token was used. Finished accounts are never deleted.',
      ],
    },
    {
      id: 'feedback',
      title: 'Turning Stripe’s answer into something actionable',
      paragraphs: [
        'Stripe describes what an account still needs as a list of technical requirement keys. The service reads the account when the user returns from Stripe and whenever Stripe sends an account update webhook, stores the outstanding, pending and errored requirements, and works out one of five plain statuses: not set up, action needed, Stripe reviewing, payouts on, or rejected.',
        'Each requirement key is mapped back to the Shipmater field that fixes it. A problem with the person’s date of birth points to the Personal tab, a problem with the EIN or statement name points to the Business tab, a problem with the bank points to Financial, and anything only Stripe can collect, such as accepting its terms, is shown as a step to finish on Stripe. Stripe’s own explanation is shown next to the item when it gives one. The aim is that a user never has to interpret a Stripe code.',
      ],
    },
    {
      id: 'ux',
      title: 'Design choices in the interface',
      paragraphs: [
        'The previous Financial tab used large coloured panels, bold headings and prominent buttons for the fee and for Stripe. Feedback was that this felt stressful and added nothing, so the new layout uses the same quiet section style as the rest of the profile: small headings, short explanatory notes, a simple checklist with ticks, and one normal-sized outlined button at the very bottom that only becomes active when everything is ready. Status messages are written as plain sentences describing what is happening and what, if anything, the person needs to do.',
      ],
    },
    {
      id: 'background',
      title: 'Background checks: levels, payers and providers',
      paragraphs: [
        'Every carrier owner and every driver is background checked before the company can work on Shipmater. The aim is to keep out people who sign up from outside the country under false identities to steal loads or payments. The same checks apply to everyone in the same way. Nothing in the rules looks at nationality, and nothing ever should, because that would be unlawful discrimination as well as a poor fraud signal: the checks work by proving who a person is and what their record says.',
        'There are two levels. Basic costs $39 per person, the lowest price the screening company offers, and is what carriers pay. It covers the national criminal search, the sex offender registry and global watchlists, and Shipmater’s own identity verification. Complete costs $99 and covers everything: the Basic check, county court records and the driving record, the FMCSA Clearinghouse query for anyone who drives, and, for US companies, the carrier’s DOT verification. A person counts as Complete only while their full check is less than twelve months old, after which they fall back to Basic. A carrier company’s level is the lowest level among its owner and drivers, so one unchecked driver keeps the whole company below Basic. Both prices are set by an admin in Settings, under Background check prices, and the Complete price cannot be lower than the Basic one.',
        'A shipper can pay for the Complete check on a carrier they choose. Once a person has passed Basic, the shipper pays only the difference, $60 at the default prices, and the screening company runs an upgrade check that adds the missing searches. Someone who has never been checked costs the full $99. Shippers can only see a carrier’s check results, or order a check, when they have an active contract with that carrier. A pending or ended contract is not enough. Shippers see outcomes only, meaning each person’s level and whether a check is in progress, and never the report itself. The carrier sees on their own Background tab which checks were paid for by a shipper. Whether sharing these outcomes needs extra wording in the consent should be confirmed with a lawyer before going live.',
        'The screening company is chosen in Admin, Settings, Background checks, not in Integrations, which is kept for email, text messages and other messaging services. Two providers are built in, Checkr and Foley, plus a test provider that only exists on a developer’s computer. The admin picks the provider, picks test or live mode, and enters that provider’s package names for Basic, Complete and the upgrade; if no upgrade package is entered, the Complete package is used. The page also shows the webhook address to paste into the provider’s dashboard and has a button to test the connection. Live mode cannot be turned on from a developer’s computer, or for a provider that has no live key on the server. Keys are set in the server’s environment file only and are never shown on the page. Switching provider affects new checks only; checks already sent finish where they started.',
        'Carriers and shippers never see the provider’s name. Every page they can open says background check, Basic or Complete, and screening company. The provider’s name appears only on admin pages and in this developer documentation.',
        'Paying is a Stripe payment on Shipmater’s own account. Its details say who the checks are for, which level, and whether the carrier or a shipper paid, so one payment can cover several people, for example an owner and two drivers. When Stripe confirms the payment, the server creates one check per person, records the payment in the ledger, and starts each check. The same payment arriving twice creates no extra checks. Starting a check creates the person as a candidate with the screening company, using their legal name and date of birth from identity verification, and asks for a secure form link. The person types their Social Security number on that form, together with the disclosure and consent the screening company presents, so Shipmater never sees or stores the full number. Every check is billed to Shipmater’s account with the screening company, because the person has already paid Shipmater.',
        'The screening company reports back through a webhook. Checkr signs it with the API key using HMAC-SHA256 in the X-Checkr-Signature header, and the server tries the test key and then the live key, which also tells it which mode the event came from. A forged or unsigned webhook is rejected. A finished report is either clear or consider. Consider is never a rejection on its own: it sends the person to admin review, because the Fair Credit Reporting Act requires a pre-adverse action notice, a waiting period and a final adverse action notice before anyone is turned down on the basis of a report. Those notices are sent from the screening company’s dashboard, and the person is marked as not passed only when the final adverse action event arrives. An expired form link lets the person start again without paying twice. A clear result for an owner also updates the carrier profile, which then goes to admin review as before, since approval happens for both the company and the person.',
        'Foley documents its screening API only to account holders, so the Foley adapter is written as far as possible without guessing. Its keys, account ID, webhook secret and server addresses are already settings, but the calls that create a candidate, send the form and read the webhook are not filled in. Until they are, choosing Foley pauses new checks with a plain message to the carrier that names no provider, and Test connection explains what is missing. Checkr test keys work only against Checkr’s staging server, so each provider has a test address and a live address, and the mode decides which key and address are used. The package names differ between accounts, so they are set in Admin rather than in code.',
      ],
    },
    {
      id: 'security',
      title: 'Security and privacy decisions',
      paragraphs: [
        'Three principles guided the sensitive data. Collect only what Stripe actually requires. Never store what does not need to be stored, which is why full bank numbers never touch Shipmater and the full SSN is never asked for. Encrypt what must be stored, which is why the SSN digits are encrypted at rest with Laravel’s encrypted cast; a migration converted existing values. Because encryption uses the application key, that key must never change on a deployment that holds data, or the stored values become unreadable. The bank token is hidden from API responses, and only the company owner or staff can view or change payout details.',
      ],
    },
    {
      id: 'testing',
      title: 'How it was tested',
      paragraphs: [
        'All testing ran against the Stripe sandbox with sandbox keys, and every test script first confirmed that the configured secret key was a test key before making any call. The full flow was exercised through the API for an individual and for a multi-member LLC with a second owner, using Stripe’s documented test values and test bank token. In both cases Stripe accepted the data, and the only remaining item was the terms acceptance on Stripe’s page. The created sandbox account was then inspected to confirm it held the right business type, structure, industry code, statement name, bank and people with their roles and ownership. The pages were checked in the browser for layout and console errors, and the factor endpoints were checked to confirm the representative and ownership rules apply. The background checks were tested in a script that runs inside a database transaction and rolls everything back, using the test provider so no screening company is called. It covers the prices and the upgrade difference, an owner paying for Basic, the same payment arriving twice, a consider result followed by adverse action, a driver checked again after failing, contract gating with no contract, a pending contract and an active one, a shipper paying upgrades for two people, the Clearinghouse requirement for drivers, the company level, the twelve-month expiry of Complete, a forged webhook, and the Foley message naming no provider. All 26 checks passed.',
      ],
    },
    {
      id: 'files',
      title: 'Where the code lives',
      paragraphs: [
        'The service is api/app/Services/Payments/StripeOnboarding.php and the endpoints are in api/app/Http/Controllers/Api/PayoutSetupController.php, under the /payouts routes. The schema is in the migration 2026_10_31_000001_create_payout_onboarding.php, with the BusinessPerson model for the people table. The background checks live in api/app/Services/Background: Provider.php is the contract every screening company adapter follows, CheckrProvider.php, FoleyProvider.php and FakeProvider.php are the adapters, and BackgroundChecks.php holds the settings, prices, payment handling, webhook handling and levels. The endpoints for carriers, shippers, admins and webhooks are in BackgroundCheckController, the BackgroundCheck model holds one row per check, and the migration 2026_11_03_000001_create_background_checks.php created that table, added the level columns to person_verifications and renamed the provider-specific columns on carrier profiles. The older migration 2026_10_31_000002_widen_carrier_background_check_status.php widened the status column. The old CheckrService was removed. The account update webhook in StripeConnectController hands Stripe’s account to the service, and the older Connect endpoints now delegate to it so nothing can create an empty account. On the frontend, the shared form, bank form and payout checklist are in components/payouts/PayoutSetup.tsx, the carrier tabs are in app/(dashboard)/carrier/profile, the background check payment and progress panel is components/background/BackgroundCheckPanel.tsx with the card form in CardPayment.tsx, the shipper’s view of a contracted carrier is components/background/ShipperCarrierChecks.tsx, the admin provider settings are in app/(dashboard)/admin/settings/page.tsx, and the factor tabs are in app/(dashboard)/factor/profile/page.tsx.',
        'Open items for later are confirming the factor industry code, which is currently a placeholder for business services, adding a way to open Stripe’s payouts dashboard from Shipmater for bank changes after setup, and the eventual move to Accounts v2.',
      ],
    },
  ],
};

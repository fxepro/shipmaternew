import { SlidersHorizontal } from 'lucide-react';
import type { AdminManualTopic } from '../admin-manual';

/**
 * Admin → Platform: what each tab controls and the decisions behind it.
 * No secrets or live identifiers belong here; keys are named, never shown.
 */
export const PLATFORM_SETTINGS_TOPIC: AdminManualTopic = {
  slug: 'platform-settings',
  title: 'Platform settings and decisions',
  icon: SlidersHorizontal,
  summary:
    'Admin → Platform holds the switches that change how the whole platform behaves: one Test / Live mode, then tabs for Fees, Background checks, Verification and the Rate card. This page records what each one does and why it was built that way.',
  bullets: [
    'One Test / Live switch for every outside check',
    'Countries: where companies can be verified, through Didit outside the US',
    'Rate card: Shipmater’s own market estimate, set by admins',
    'Fees and payment routing',
  ],
  sections: [
    {
      id: 'mode',
      title: 'Test / Live mode',
      paragraphs: [
        'There is one mode for the platform, at the top of the Platform page. It turns business verification (KYB) and background checks to test or live at the same time, so the two can never be in different modes by mistake. It is stored in platform_settings under the key mode and read by App\\Support\\PlatformMode. Kyb::mode() and BackgroundChecks::mode() both return it.',
        'Live can only be turned on when every provider in use has its live key on the server. It is always off on a developer’s computer (APP_ENV local or testing), whatever is saved, so local testing can never run a real, paid check.',
        'Stripe is not on the switch. Its mode comes from the secret key on the server: sk_live_ is live and sk_test_ is test. The switch only shows which key is there.',
      ],
    },
    {
      id: 'countries',
      title: 'Countries (Verification tab)',
      paragraphs: [
        'Admins choose the countries where shippers, brokers and factors can register and be verified. The US is always on, and Canada and Mexico are on by default. The list is Didit’s supported countries (App\\Support\\KybCountries), with uninhabited territories left out. Countries marked “no ownership records” have no shareholder or UBO data in their register. Afghanistan, Iran, North Korea, Syria, Russia and Myanmar are Didit’s default auto-decline countries and can’t be turned on.',
        'A US company goes to the provider chosen on the Verification tab (Middesk, or Didit as the backup). Any other country always goes to Didit, because Middesk covers the US only. Didit is sent the ISO country code and searches that country’s national register. The company’s registration or tax number is matched against the register record, and the name is screened against sanctions lists.',
        'Outside the US there is no IRS EIN match and no W-9, so the W-9 is not required and the EIN item is labelled “Registration or tax number”. State and postcode are optional. Carriers still need FMCSA authority (USDOT, and MC where required) to haul in the US, whatever their country.',
        'A company can only save a registered-address country that is turned on; the profile’s country list shows only those countries.',
      ],
    },
    {
      id: 'rates',
      title: 'Rate card',
      paragraphs: [
        'Rate check gives shippers and brokers a low, typical and high price for a lane before they post a load. It is Shipmater’s own estimate. Linehaul is road miles (OSRM) times the admin’s per-mile rate for the equipment. The fuel surcharge uses the EIA weekly diesel price above the fuel price already in the rates. Hazmat, temperature control and extra stops add their set amounts. Once a lane has 5 completed loads in 120 days, their rates are blended in.',
        'No figure is made up by the code. Equipment with no per-mile rate gets no estimate. The fuel surcharge needs EIA_API_KEY on the server.',
        'Carriers see the posted rate on the Marketplace, not the market range. Offers show how far they are above or below the market estimate kept on the load.',
      ],
    },
    {
      id: 'fees',
      title: 'Fees and payment routing',
      paragraphs: [
        'The Fees tab sets the carrier’s load fee, the early-payment fee and the shipper subscription tiers. They apply to new loads and subscriptions from the moment they are saved.',
        'Payment routing decides where a shipper’s load payment lands. By default it goes straight into the carrier’s (or factor’s) Stripe account with Shipmater’s fee taken off. The other option sends it through Shipmater’s own account first, and Shipmater then pays the carrier.',
      ],
    },
    {
      id: 'related',
      title: 'Related platform rules',
      paragraphs: [
        'Approval: an unapproved shipper, broker, carrier or factor can’t post, make or accept offers, or file NOAs (App\\Support\\Approval, middleware company.approved). A restricted company can finish work it already has but take on nothing new.',
        'Scheduler: the API container runs php artisan schedule:run every minute. It charges load payments, refreshes outside checks and enforces compliance deadlines. Only one API container may run it.',
      ],
    },
  ],
};

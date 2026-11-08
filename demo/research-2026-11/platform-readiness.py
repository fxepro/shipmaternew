# Source for platform-readiness.html. Edit the data tables below (status, text, DATES), then run: python demo/research-2026-11/platform-readiness.py
import html, re

SRC = r'C:/AIProjects/ShipmaterNew/demo/research-2026-11/competitor-matrix.html'
OUT = r'C:/AIProjects/ShipmaterNew/demo/research-2026-11/platform-readiness.html'

css = open(SRC, encoding='utf-8').read()
css = css[css.index('<style>') + 7: css.index('</style>')]
css = css.split('/* Full-width matrix')[0]  # drop the competitor-specific table widths

css += """
/* readiness tables */
.wide { width: min(calc(100vw - 64px), 1900px); margin-inline: calc((100% - min(calc(100vw - 64px), 1900px)) / 2); }
.wide .scroller { max-height: none; overflow: visible; }
.wide table { table-layout: fixed; }
.wide thead th { white-space: normal; font-size: 1rem; }
.wide th, .wide td { padding: 9px 10px; }
.wide th.feat, .wide td.feat { width: 190px; min-width: 0; max-width: none; }
.wide td.cell { min-width: 0; }
.cell p { font-size: 0.86rem; line-height: 1.35; color: var(--ink); overflow-wrap: anywhere; }
.st { display: inline-flex; align-items: center; gap: 5px; margin-top: 6px; font: 600 0.72rem/1 var(--f-body); text-transform: uppercase; letter-spacing: 0.07em; padding: 4px 7px; border-radius: 4px; }
.st.yes { background: var(--yes-bg); color: var(--yes); }
.st.part { background: var(--part-bg); color: var(--part); }
.st.no { background: var(--no-bg); color: var(--no); }
.st.na { background: var(--na-bg); color: var(--na); }
.when { display: block; margin-top: 5px; font-size: 0.74rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.when code { font-size: 0.72rem; padding: 0 4px; }
.when.open { color: var(--no); }
.hist td:first-child { font-family: var(--f-mono); font-size: 0.85rem; white-space: nowrap; width: 120px; }
.hist td:nth-child(2) { width: 90px; }

td.na-cell p { color: var(--na); }
.feat small { display: block; font-weight: 400; color: var(--muted); font-size: 0.8rem; line-height: 1.3; margin-top: 3px; }
td.status-col { font: 600 0.85rem/1.3 var(--f-body); color: var(--accent); }
@media (max-width: 1000px) {
  .wide { width: auto; margin-inline: 0; }
  .wide .scroller { overflow-x: auto; }
  .wide table { min-width: 1100px; }
}
"""

LABEL = {'yes': 'Built', 'part': 'Partial', 'no': 'Missing', 'na': 'Not needed'}
MARK = {'yes': '✓', 'part': '◐', 'no': '✕', 'na': '–'}

def cell(c, date=None):
    if c is None:
        return '<td class="cell na-cell"></td>'
    st, text = c
    if st == 'who':
        return f'<td class="cell"><p style="color:var(--muted)">{html.escape(text)}</p></td>'
    cls = 'cell na-cell' if st == 'na' else 'cell'
    when = ''
    if st in ('yes', 'part') and date:
        word = 'Done' if st == 'yes' else 'Last work'
        when = f'<span class="when">{word} {fmt_date(date[0])} · <code>{date[1]}</code></span>'
    elif st == 'no':
        when = '<span class="when open">Open · target —</span>'
    return f'<td class="{cls}"><p>{html.escape(text)}</p><span class="st {st}">{MARK[st]} {LABEL[st]}</span>{when}</td>'

# ── Part 1: onboarding ─────────────────────────────────────────────────────
ON_COLS = ['Sign-up', 'Profile', 'Verification', 'Approval', 'Payments / payouts', 'Team', 'Access until approved']
ONBOARDING = [
    ('Shipper', 'Company and its owner', [
        ('yes', 'Shipper option on sign-up; company created; email verified before anything else.'),
        ('yes', 'Business, services, compliance, payment, subscription and team tabs.'),
        ('part', 'Business documents and company background check ($39 Basic / $99 Complete) work. Phone code step needs an SMS provider, none configured.'),
        ('yes', 'Admin approves or rejects; approval needs a passed company background check.'),
        ('yes', 'Card or bank (Stripe, Plaid) and subscription. Stripe in test mode.'),
        ('yes', 'Owner, staff, viewer; invitations.'),
        ('part', 'Posting a load only checks the subscription. An unapproved shipper can post.'),
    ]),
    ('Carrier', 'Company', [
        ('yes', 'Carrier option on sign-up; company created; email verified first.'),
        ('yes', 'Business, insurance and authority, vehicles, documents.'),
        ('part', 'Live FMCSA DOT/MC lookup, documents, company background check. Checkr key not set, so checks use the fake provider.'),
        ('yes', 'Admin approves; needs passed background check and an approved owner.'),
        ('yes', 'Stripe Connect payouts, remittance, factoring. Test mode.'),
        ('yes', 'Owner, staff, dispatcher, driver, viewer.'),
        ('part', 'Dashboard, trips, drivers and earnings are locked. The load board and making offers are not locked in the API.'),
    ]),
    ('Carrier owner', 'Person', [
        ('na', 'Same login as the company sign-up.'),
        ('yes', 'Identity details on the profile.'),
        ('yes', 'Identity, background check, age 18+.'),
        ('yes', 'Admin approves the person in People.'),
        ('na', ''), ('na', ''),
        ('yes', 'Owner is blocked until approved.'),
    ]),
    ('Driver', 'Person', [
        ('yes', 'Joins by invitation from the carrier.'),
        ('yes', 'Identity and credentials.'),
        ('yes', 'Identity, background, 21+, CDL, DOT medical, Clearinghouse, MVR; re-checked daily.'),
        ('yes', 'Each driver approved as a person; only approved drivers can be assigned.'),
        ('na', ''), ('na', ''),
        ('yes', 'Sees only loads assigned to them.'),
    ]),
    ('Dispatcher / staff', 'Person', [
        ('yes', 'Joins by invitation.'),
        ('yes', 'Identity details.'),
        ('na', 'Certifications recorded, none required.'),
        ('na', 'No approval for these roles.'),
        ('na', ''), ('na', ''),
        ('yes', 'Follows the role matrix.'),
    ]),
    ('Factor', 'Company', [
        ('yes', 'Factoring company option on sign-up.'),
        ('yes', 'Company profile.'),
        ('yes', 'Owner identity, age 18+.'),
        ('yes', 'Approved automatically, no Shipmater review (by design).'),
        ('yes', 'Stripe Connect payouts. Test mode.'),
        ('yes', 'Owner, staff, viewer.'),
        ('yes', 'NOA and load funding pages.'),
    ]),
    ('Receiver', 'Company', [
        ('yes', '"Receive freight" on sign-up, or claim a listing a shipper created.'),
        ('yes', 'Locations (docks, hours, appointments) and contacts.'),
        ('na', 'No checks needed.'),
        ('yes', 'Claims: automatic when the email is a listed contact, otherwise admin decides.'),
        ('na', 'No fees.'),
        ('yes', 'Owner, staff, viewer.'),
        ('yes', 'Sees loads with a stop at its locations.'),
    ]),
    ('Broker', 'Company', [
        ('no', 'No broker option on sign-up.'),
        ('part', 'Can exist only as a directory listing added by a shipper.'),
        ('no', 'Broker authority (MC) and BMC-84 bond not checked.'),
        ('no', 'None.'),
        ('no', 'None.'),
        ('no', 'None.'),
        ('no', 'No broker pages or load rights.'),
    ]),
]

# ── Part 2: shipment lifecycle ─────────────────────────────────────────────
SH_COLS = ['Shipper', 'Carrier (dispatch)', 'Driver', 'Receiver', 'Factor', 'Platform']
N = None
SHIPMENT = [
    ('grp', 'Book the load'),
    ('Create the load', 'Draft', [
        ('yes', 'Wizard: details, several pickups and drop-offs from directory locations, manifest, route order, offer terms, billing.'),
        N, N, N, N,
        ('yes', 'Needs a subscription; refuses another company’s private location.'),
    ]),
    ('Post or dispatch', 'Open / Assigned', [
        ('yes', 'Open market (no carrier) or contracted (carrier preset).'),
        ('part', 'A contracted load lands as assigned. No accept or decline step for the carrier.'),
        N, N, N,
        ('yes', 'Payment scheduled for a contracted load.'),
    ]),
    ('Offers', 'Open', [
        ('yes', 'Sees all offers; accepts or declines.'),
        ('part', 'Load board, make an offer, withdraw it. No counter-offers.'),
        N, N, N, N,
    ]),
    ('Booked', 'Assigned', [
        ('yes', 'Accepting sets the carrier on the load.'),
        ('yes', 'Load appears in My Jobs; rate confirmation PDF.'),
        N, N, N,
        ('yes', 'Payment scheduled with the agreed amount.'),
    ]),
    ('Assign a driver', 'Assigned', [
        N,
        ('yes', 'Dispatcher picks an approved driver.'),
        ('yes', 'Load shows in the driver’s My Jobs.'),
        N, N, N,
    ]),
    ('Card hold before pickup', 'Assigned', [
        ('yes', 'Default card or bank on file.'),
        N, N, N, N,
        ('part', 'Hold placed the day before pickup by the hourly payments job. Needs the scheduler running in production.'),
    ]),
    ('grp', 'Run the load'),
    ('Start the trip, live GPS', 'In Transit', [
        N, N,
        ('no', 'No screen sends the driver’s location. The ping endpoint exists but nothing calls it.'),
        N, N,
        ('no', 'The load moves to In Transit only on the first GPS ping, so loads skip In Transit today.'),
    ]),
    ('Pickup', 'Assigned', [
        ('yes', 'Sees each stop’s progress and evidence.'),
        N,
        ('yes', 'Stop on the way / arrived / done, photos, signature, BOL PDF.'),
        N, N, N,
    ]),
    ('Tracking', 'In Transit', [
        ('part', 'Live tracking page. No live position without GPS.'),
        ('part', 'Same.'),
        N,
        ('part', 'Tracking page and public tracking link; same gap.'),
        N,
        ('part', 'Realtime map updates; pings are saved even if the realtime server is down.'),
    ]),
    ('Delivery and POD', 'Delivered', [
        ('yes', 'Sees POD and signatures.'),
        N,
        ('yes', 'Completes the last stop, signature, POD PDF.'),
        ('yes', 'Confirms delivery on the public tracking link.'),
        N,
        ('yes', 'Delivered when the last stop is done or the receiver confirms.'),
    ]),
    ('grp', 'Get paid'),
    ('Charge and payout', 'Delivered', [
        ('yes', 'Pay early at a lower rate; retry a failed payment.'),
        ('yes', 'Earnings and payout request.'),
        N, N, N,
        ('yes', 'Hold charged at delivery straight to the carrier’s (or factor’s) Stripe account, fee taken off. Bank payments charged at delivery. Test mode.'),
    ]),
    ('Factoring', 'Delivered', [
        ('yes', 'Acknowledges the NOA; pays the factor.'),
        ('yes', 'Files the NOA, submits loads, asks for release.'),
        N, N,
        ('yes', 'Approves NOAs, funds loads, releases.'),
        ('yes', 'Payment re-pointed to the factor; carrier fee charged when funded.'),
    ]),
    ('Invoice and documents', 'Delivered', [
        ('yes', 'Invoice, BOL, rate confirmation, POD downloads.'),
        ('yes', 'Same documents.'),
        N, N, N, N,
    ]),
    ('Ratings', 'Delivered', [
        ('yes', 'Rates the carrier.'),
        ('yes', 'Rates the shipper.'),
        N, N, N, N,
    ]),
    ('grp', 'When something goes wrong'),
    ('Edit a posted load', '', [('no', 'Not possible after posting.'), N, N, N, N, N]),
    ('Cancel a load', 'Cancelled', [
        ('no', 'No cancel action.'),
        ('no', 'Carrier can’t drop a booked load.'),
        N, N, N,
        ('no', 'Releasing the card hold exists in code but nothing calls it.'),
    ]),
    ('Reassign or TONU', '', [
        ('no', 'Can’t replace the carrier.'),
        ('no', 'No truck-ordered-not-used charge.'),
        N, N, N, N,
    ]),
    ('Extra charges', '', [
        ('no', 'No detention, layover, lumper or extra-stop charges on top of the rate.'),
        ('no', 'Can’t request them.'),
        ('no', 'Can’t record wait time.'),
        N, N, N,
    ]),
    ('Disputes', 'Disputed', [
        ('no', 'Can’t open a dispute.'),
        ('no', 'Can’t open a dispute.'),
        N, N, N,
        ('part', 'Admin sees a list of disputed loads; no way in, no resolution, payout not held.'),
    ]),
    ('Damage and shortage claims', '', [
        ('no', 'No OS&D claim.'),
        N, N,
        ('no', 'Can’t note damage or shortage at delivery.'),
        N, N,
    ]),
]

# ── Running the platform ───────────────────────────────────────────────────
OPS = [
    ('part', 'Scheduler', 'Card holds, charges before holds expire, and the daily re-check of driver credentials run from the Laravel scheduler (payments:run hourly, people:refresh-checks daily). Production needs it running, plus a queue worker.'),
    ('part', 'Stripe', 'Test key and both webhook secrets are set locally. Live keys and live webhooks are needed in production.'),
    ('part', 'Background checks', 'Checkr and Foley providers are written; no Checkr key is set, so local checks use the fake provider.'),
    ('yes', 'FMCSA', 'DOT and MC numbers are looked up live against SAFER.'),
    ('part', 'Realtime', 'Live map updates need the Reverb server running. Pings are saved without it.'),
]

BUILD = [
    ('Driver GPS and trip start', 'Send the driver’s location from My Jobs while a trip is running, and set the load to In Transit when the driver starts the first stop. Unblocks live tracking for shipper, receiver and the public link.'),
    ('Cancel and edit', 'Cancel a load before pickup (release the card hold), edit a posted load, carrier drops a booked load with a reason.'),
    ('Lock unapproved companies in the API', 'Block posting for unapproved shippers, and the load board and offers for unapproved carriers. Today only the screens hide them.'),
    ('Disputes', 'Shipper or carrier opens a dispute on a load with evidence, payout is held, admin resolves with a split.'),
    ('Extra charges and TONU', 'Detention, layover, lumper, extra stops and truck-ordered-not-used, requested by the carrier and approved by the shipper, added to the charge.'),
    ('Contracted load accept, counter-offers', 'Carrier accepts or declines a contracted load; shipper and carrier counter an offer.'),
    ('Brokers', 'Sign-up, MC and bond check, and what a broker may do on a load. Needs your decision first.'),
    ('Damage and shortage claims', 'Note OS&D at delivery and open a claim against the load.'),
    ('Payments: corrections', 'Refunds and credits from the admin console, real payout request (or remove the button), monthly statements, Plaid secret for bank payments.'),
    ('Mobile app, driver first', 'Expo app: sign-in, invitation, credentials by camera, loads and stops, background GPS, photos, signature, POD, offline queue. Then push notifications with device tokens.'),
    ('Mobile app, everyone else', 'Sign-up for every type, carrier dispatch and fleet map, shipper tracking and offers, receiver delivery confirmation, store listings.'),
]

# ── Part 3: payments ───────────────────────────────────────────────────────
PAY_COLS = ['Shipper', 'Carrier', 'Factor', 'Admin / platform']
PAYMENTS = [
    ('grp', 'Set up'),
    ('Payment methods', 'Paying in', [
        ('part', 'Card through Stripe (works, test mode). Bank through Plaid is written but no Plaid secret is set.'),
        ('part', 'Card on file for Shipmater’s fees.'),
        N, N,
    ]),
    ('Payout accounts', 'Getting paid', [
        N,
        ('yes', 'Stripe Connect onboarding in the app: business, bank, submit, status refresh; remittance details.'),
        ('yes', 'Same, through Stripe Connect.'),
        ('yes', 'Status shown on the admin company page.'),
    ]),
    ('Fees and flow', 'Settings', [
        ('yes', 'Fees shown on pricing and in the job wizard.'),
        N, N,
        ('yes', 'Admin sets fees and picks the flow: money straight to the carrier, or through Shipmater’s account.'),
    ]),
    ('grp', 'Charges'),
    ('Subscription', 'Shipper plan', [
        ('yes', 'Subscribe, cancel, resume; needed to post loads.'),
        N, N,
        ('yes', 'Admin list, cancel, resume.'),
    ]),
    ('Background checks', 'Per check', [
        ('yes', 'Pays $39 Basic or $99 Complete, or upgrades a carrier’s check.'),
        ('yes', 'Pays for its own checks by card.'),
        N,
        ('yes', 'Payment recorded against the check; provider picked in settings.'),
    ]),
    ('Load payment', 'Per load', [
        ('yes', 'Card held the day before pickup, charged at delivery; bank charged at delivery; pay early at a lower rate; retry a failure.'),
        ('yes', 'Paid straight into its Stripe account, Shipmater’s fee taken off.'),
        ('yes', 'Paid instead of the carrier once the load is factored.'),
        ('part', 'Runs from the hourly payments job; the scheduler must run in production.'),
    ]),
    ('Shipmater’s fee', 'Revenue', [
        N,
        ('yes', 'Taken off each payment; on factored loads charged to the carrier when funded; retry a failed fee. Carriers owing fees can’t factor.'),
        N,
        ('yes', 'Ledger, receivables, financial report and CSV export.'),
    ]),
    ('grp', 'Money out and corrections'),
    ('Carrier payout', 'Bank deposit', [
        N,
        ('part', 'Stripe pays out automatically. The "Request payout" button only returns a message and does nothing.'),
        ('yes', 'Stripe pays out automatically.'),
        N,
    ]),
    ('Refunds', '', [
        ('no', 'Can’t ask for one.'),
        N, N,
        ('part', 'Refunds made in Stripe are recorded from the webhook. No refund action in the admin console.'),
    ]),
    ('Adjustments', 'Cancel, dispute, extra charges', [
        ('no', 'No partial charge, credit or added charge on a load.'),
        ('no', 'Can’t bill detention, TONU or other extras.'),
        N,
        ('no', 'Can’t hold a payout or split it after a dispute.'),
    ]),
    ('Invoices and statements', '', [
        ('part', 'Invoice PDF per load. No monthly statement.'),
        ('part', 'Invoice PDF per load. No settlement statement.'),
        ('part', 'Sees funded loads; no statement.'),
        N,
    ]),
    ('Tax forms', '1099', [
        N,
        ('no', 'No 1099 for carrier earnings.'),
        N,
        ('no', 'No tax reporting set up in Stripe Connect.'),
    ]),
]

# ── Part 4: mobile apps ────────────────────────────────────────────────────
MOB_COLS = ['Who', 'In the app (iOS and Android)', 'Platform behind it today']
def m(who, app_text, api):
    return [('who', who), ('no', app_text), api]
MOBILE = [
    ('grp', 'Account'),
    ('Sign-up', 'All types', m('Shipper, carrier, receiver, factor', 'Native sign-up with type picker and claim search.', ('yes', 'Sign-up API, claims.'))),
    ('Email verification', 'Step 2', m('Everyone', 'Code entry, or open the link straight into the app.', ('part', 'Verify API works; app links (universal / app links) not set up.'))),
    ('Sign in, stay signed in', '', m('Everyone', 'Token kept in the secure keystore; Face ID / fingerprint unlock.', ('yes', 'Bearer tokens (Sanctum).'))),
    ('Join by invitation', 'Drivers, staff', m('Invited people', 'Invitation link opens the app at sign-up.', ('yes', 'Invitation API.'))),
    ('grp', 'Onboarding'),
    ('Credentials and documents', 'Drivers, owners', m('Driver, carrier owner', 'Camera scan of CDL, medical card, insurance; upload.', ('yes', 'Credentials and documents API.'))),
    ('Identity and background check', '', m('Driver, carrier owner', 'Identity details, consent, check status.', ('yes', 'Verification checklist and checks API.'))),
    ('grp', 'Driver on the road'),
    ('My loads and stops', '', m('Driver', 'Today’s loads, stop list, on the way / arrived / done.', ('yes', 'Loads and stop status API.'))),
    ('Background GPS', 'Status', m('Driver', 'Location while a trip runs, also with the screen off (Android foreground service, iOS background location).', ('part', 'Ping API exists; trip start and In Transit status still to build.'))),
    ('Arrive automatically', 'Geofence', m('Driver', 'Mark arrived and left when the truck enters or leaves a stop.', ('no', 'Stops have coordinates; no geofence logic.'))),
    ('Navigation', '', m('Driver', 'Hand off to Google Maps, Apple Maps or a truck GPS app.', ('yes', 'Stop addresses and coordinates.'))),
    ('Photos, signature, POD', '', m('Driver, receiver', 'Camera, signature pad, document scanner for BOL; POD.', ('yes', 'Evidence, signature and POD API.'))),
    ('Works offline', 'Dead zones', m('Driver', 'Queue stop updates, photos and pings; send when back online.', ('part', 'API takes each call; no duplicate protection for replays.'))),
    ('grp', 'Notifications'),
    ('Push notifications', '', m('Everyone', 'Booked, assigned, offer received, on the way, arrived, delivered, paid.', ('no', 'No device tokens and no push sending (FCM / APNs).'))),
    ('In-app inbox', '', m('Everyone', 'List of recent updates.', ('no', 'No notifications API; the bell icon is empty.'))),
    ('Messages', '', m('Driver, dispatch, shipper', 'Chat on a load.', ('no', 'Not on the platform.'))),
    ('grp', 'Status and the rest of the platform'),
    ('Live status and tracking', '', m('Shipper, carrier, receiver', 'Load status and live map that update on their own.', ('part', 'Realtime channel per load exists; needs GPS to have positions.'))),
    ('Carrier dispatch', '', m('Owner, dispatcher', 'Load board, offers, assign drivers, fleet map.', ('yes', 'Board, offers and assignment API; fleet map needs GPS.'))),
    ('Shipper on the go', '', m('Shipper', 'Load list, offers to accept, tracking. Creating loads can stay on the web.', ('yes', 'Same API as the web.'))),
    ('Receiver', '', m('Receiver', 'Incoming deliveries, confirm and sign for delivery.', ('yes', 'Receiver loads and delivery confirm API.'))),
    ('Money', '', m('Shipper, carrier', 'Payments, earnings, add a card with the Stripe mobile SDK.', ('yes', 'Payments and setup-intent API.'))),
    ('grp', 'Shipping the apps'),
    ('Store accounts and review', '', m('—', 'Apple developer and Google Play accounts, listings, background-location justification and prominent disclosure, privacy labels.', ('no', 'Not started.'))),
    ('Updates and crashes', '', m('—', 'Crash reporting, minimum-version check, over-the-air updates.', ('no', 'No app version endpoint.'))),
]

# ── Dates: when each built or partial cell reached its current state (git history on main) ──
# Row default first; {col_index: (date, commit)} overrides. Missing cells stay open.
D = lambda d, h: (d, h)
DATES = {
    'on': {
        'Shipper':  [D('2026-11-07', 'af19614'), {1: D('2026-11-05', '7e91433'), 2: D('2026-11-03', '780178a'), 3: D('2026-10-29', '0d1981e'), 4: D('2026-10-30', '75ef46f'), 5: D('2026-10-29', 'ba4f217'), 6: D('2026-10-30', '75ef46f')}],
        'Carrier':  [D('2026-11-07', 'af19614'), {1: D('2026-11-05', '285582f'), 2: D('2026-11-03', '780178a'), 3: D('2026-10-29', '0d1981e'), 4: D('2026-11-03', '780178a'), 5: D('2026-10-29', 'ba4f217'), 6: D('2026-06-07', '1246368')}],
        'Carrier owner': [D('2026-07-08', '4d5defe'), {2: D('2026-07-08', '453e822'), 3: D('2026-10-29', '0d1981e'), 6: D('2026-10-29', '0d1981e')}],
        'Driver':   [D('2026-10-29', 'ba4f217'), {1: D('2026-11-05', '285582f'), 2: D('2026-11-03', '780178a')}],
        'Dispatcher / staff': [D('2026-10-29', 'ba4f217'), {1: D('2026-11-05', '285582f'), 6: D('2026-11-05', '9a7015b')}],
        'Factor':   [D('2026-10-30', '75ef46f'), {4: D('2026-10-31', '7cb5b10')}],
        'Receiver': [D('2026-11-07', 'af19614'), {}],
        'Broker':   [D('2026-11-07', 'af19614'), {}],
    },
    'sh': {
        'Create the load':  [D('2026-11-07', 'af19614'), {}],
        'Post or dispatch': [D('2026-11-07', 'af19614'), {5: D('2026-10-30', '75ef46f')}],
        'Offers':           [D('2026-06-12', '617f539'), {}],
        'Booked':           [D('2026-06-12', '617f539'), {1: D('2026-07-08', 'fe16cf9'), 5: D('2026-10-30', '75ef46f')}],
        'Assign a driver':  [D('2026-10-29', 'ba4f217'), {}],
        'Card hold before pickup': [D('2026-10-30', '75ef46f'), {}],
        'Pickup':           [D('2026-07-08', '66b02cc'), {}],
        'Tracking':         [D('2026-07-10', '323c2b0'), {}],
        'Delivery and POD': [D('2026-07-08', '66b02cc'), {3: D('2026-06-05', '442fb4f'), 5: D('2026-11-07', 'af19614')}],
        'Charge and payout': [D('2026-10-30', '75ef46f'), {}],
        'Factoring':        [D('2026-10-30', '75ef46f'), {}],
        'Invoice and documents': [D('2026-07-08', 'fed5f73'), {}],
        'Ratings':          [D('2026-07-08', '1b6fbd2'), {}],
        'Disputes':         [D('2026-10-28', '0850413'), {}],
    },
    'pay': {
        'Payment methods':  [D('2026-10-30', '75ef46f'), {}],
        'Payout accounts':  [D('2026-11-03', '780178a'), {2: D('2026-10-31', '7cb5b10'), 3: D('2026-11-05', '7e91433')}],
        'Fees and flow':    [D('2026-10-30', '75ef46f'), {}],
        'Subscription':     [D('2026-10-30', '75ef46f'), {3: D('2026-11-05', '7e91433')}],
        'Background checks': [D('2026-11-03', '780178a'), {}],
        'Load payment':     [D('2026-10-30', '75ef46f'), {}],
        'Shipmater’s fee':  [D('2026-10-30', '75ef46f'), {}],
        'Carrier payout':   [D('2026-06-07', 'f38302a'), {2: D('2026-10-31', '7cb5b10')}],
        'Refunds':          [D('2026-10-30', '75ef46f'), {}],
        'Invoices and statements': [D('2026-07-08', 'fed5f73'), {2: D('2026-10-30', '75ef46f')}],
    },
    'mob': {
        'Sign-up': [D('2026-11-07', 'af19614'), {}], 'Email verification': [D('2026-11-07', 'af19614'), {}],
        'Sign in, stay signed in': [D('2026-06-02', '9b8454d'), {}], 'Join by invitation': [D('2026-10-29', 'ba4f217'), {}],
        'Credentials and documents': [D('2026-11-05', '285582f'), {}], 'Identity and background check': [D('2026-11-03', '780178a'), {}],
        'My loads and stops': [D('2026-11-07', 'af19614'), {}], 'Background GPS': [D('2026-11-07', 'af19614'), {}],
        'Navigation': [D('2026-06-07', 'eabd7be'), {}], 'Photos, signature, POD': [D('2026-07-08', '66b02cc'), {}],
        'Works offline': [D('2026-11-07', 'af19614'), {}], 'Live status and tracking': [D('2026-07-10', '323c2b0'), {}],
        'Carrier dispatch': [D('2026-10-29', 'ba4f217'), {}], 'Shipper on the go': [D('2026-11-07', 'af19614'), {}],
        'Receiver': [D('2026-11-07', 'af19614'), {}], 'Money': [D('2026-10-30', '75ef46f'), {}],
    },
}
OPS_DATES = {'Scheduler': D('2026-10-30', '75ef46f'), 'Stripe': D('2026-10-31', '7cb5b10'), 'Background checks': D('2026-11-03', '780178a'),
             'FMCSA': D('2026-06-06', '9542313'), 'Realtime': D('2026-06-05', '442fb4f')}

# Milestones from git history on main
HISTORY = [
    ('2026-06-01', 'fd3ed2a', 'First commit: Shipmater freight app, Laravel API and Next.js.'),
    ('2026-06-02', '9b8454d', 'Sign-in with bearer tokens; Netlify and Railway deploys.'),
    ('2026-06-04', '32d0e52', 'Carrier verification, vehicles, documents, Stripe Connect.'),
    ('2026-06-05', '442fb4f', 'Full load cycle: delivery confirmation, real-time tracking, receiver on the load. Multi-company accounts.'),
    ('2026-06-06', '9542313', 'Live FMCSA DOT and MC lookups; Stripe Identity.'),
    ('2026-06-07', 'f38302a', 'Checkr checks, carrier approval gate, Clearinghouse, R2 documents, road routing, Stripe escrow, Plaid, payouts.'),
    ('2026-06-08', '2b859f5', 'Contracted jobs: locations, multi-stop manifest, route optimisation, billing step.'),
    ('2026-06-12', '617f539', 'Open market offers.'),
    ('2026-07-02', '9903351', 'White-label tenants: admin, branding, tenant sign-in pages.'),
    ('2026-07-08', '66b02cc', 'Rate confirmation, BOL, POD with photos and signature, invoices, identity and age checks, ratings, financial reports.'),
    ('2026-07-09', '9186b05', 'Shipper verification: email, SMS code, EIN review.'),
    ('2026-07-10', '323c2b0', 'Contracted loads in live tracking; Resources manual.'),
    ('2026-10-27', 'a9312d7', 'Trucking only: gig and courier content removed.'),
    ('2026-10-29', 'ba4f217', 'Admin console rebuilt; companies and people approved separately; driver checks, invitations, assignment rules.'),
    ('2026-10-30', '75ef46f', 'Factoring companies, NOAs, fees, subscriptions, load payments.'),
    ('2026-11-03', '780178a', 'Background check levels and providers; payout onboarding in the app.'),
    ('2026-11-05', '9a7015b', 'Company and person data split; profile tables dropped; role matrix enforced in the API.'),
    ('2026-11-07', 'af19614', 'Organizations directory and receivers; shipments merged into freight jobs; view as company; email verification at sign-up.'),
]

def fmt_date(d):
    import datetime
    return datetime.date.fromisoformat(d).strftime('%-d %b %Y') if False else datetime.date.fromisoformat(d).strftime('%d %b %Y').lstrip('0')

def tally(cells):
    c = {'yes': 0, 'part': 0, 'no': 0}
    for x in cells:
        if x and x[0] in c: c[x[0]] += 1
    return c

on_cells = [c for _, _, row in ONBOARDING for c in row]
sh_cells = [c for r in SHIPMENT if r[0] != 'grp' for c in r[2]]
t_on, t_sh, t_ops = tally(on_cells), tally(sh_cells), tally([(s, '') for s, _, _ in OPS])
t_pay = tally([c for r in PAYMENTS if r[0] != 'grp' for c in r[2]])
t_mob_api = tally([r[2][2] for r in MOBILE if r[0] != 'grp'])
t_mob_app = tally([r[2][1] for r in MOBILE if r[0] != 'grp'])

def trow(name, t):
    tot = sum(t.values()) or 1
    y, p = 100 * t['yes'] / tot, 100 * t['part'] / tot
    return (f'<div class="trow"><span class="nm">{name}</span>'
            f'<div class="bar"><i class="y" style="width:{y:.1f}%"></i><i class="p" style="width:{p:.1f}%"></i></div>'
            f'<span class="ct"><span><i class="ky"></i><b>{t["yes"]}</b> built</span><span><i class="kp"></i><b>{t["part"]}</b> partial</span><span><b>{t["no"]}</b> missing</span></span></div>')

out = []
w = out.append
w('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">')
w('<title>Shipmater Platform Readiness</title>')
w('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>')
w('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&family=JetBrains+Mono:wght@500&display=swap">')
w(f'<style>{css}</style></head><body><div class="wrap">')

w('<header><p class="eyebrow">Shipmater · Platform readiness · PM tracker · updated 7 Nov 2026</p><h1>What each company needs to get on, and to move a load</h1>')
w('<p class="lede">Part one is onboarding for every type of company and person. Part two is every step of a load and what each party does at it. Part three is payments. Part four is what native iOS and Android apps need and how much of the platform is ready behind them. Read from the code and the API test scripts on main (af19614). Notifications appear only in the mobile part.</p>')
w('<div class="legend">' + ''.join(f'<span><span class="mk {k}">{MARK[k]}</span>{LABEL[k]}</span>' for k in ['yes', 'part', 'no', 'na']) + '</div></header>')

w('<section><div class="sec-head"><h2>Where it stands</h2></div><div class="tally">')
w(trow('Onboarding', t_on) + trow('Shipments', t_sh) + trow('Payments', t_pay) + trow('Mobile app', t_mob_app) + trow('Mobile: API ready', t_mob_api) + trow('Running it', t_ops))
w('<p class="tnote">Counts are table cells, not features. Partial means it works but with a gap named in the cell.</p></div>')
w('<div class="says"><div><h3>Solid</h3><p>Sign-up and email verification for every type, carrier and driver vetting, admin approval, booking through offers or contracts, stop evidence and documents, payment straight to the carrier, factoring and ratings.</p></div>'
  '<div><h3>Holes</h3><p>No live GPS, so loads never show In Transit. Nothing for when a load goes wrong: no cancel, edit, disputes, extra charges or claims. Approval isn’t enforced in the API for posting or offers. Brokers don’t exist yet.</p></div></div></section>')

def table(cols, rows, first_head, status_col=False, key=None):
    h = ['<div class="scroller"><table><thead><tr>', f'<th class="feat">{first_head}</th>']
    h += [f'<th>{html.escape(c)}</th>' for c in cols]
    if status_col: h.append('<th style="width:120px">Load status</th>')
    h.append('</tr></thead><tbody>')
    span = len(cols) + 1 + (1 if status_col else 0)
    for r in rows:
        if r[0] == 'grp':
            h.append(f'<tr class="grp"><td colspan="{span}"><span>{html.escape(r[1])}</span></td></tr>'); continue
        name, sub, cells = r
        h.append('<tr>')
        if status_col:
            h.append(f'<td class="feat">{html.escape(name)}</td>')
        else:
            h.append(f'<td class="feat">{html.escape(name)}<small>{html.escape(sub)}</small></td>')
        default, over = DATES.get(key, {}).get(name, [None, {}])
        h += [cell(c, over.get(i, default)) for i, c in enumerate(cells)]
        if status_col: h.append(f'<td class="status-col">{html.escape(sub)}</td>')
        h.append('</tr>')
    h.append('</tbody></table></div>')
    return ''.join(h)

w('<section class="wide"><div class="sec-head"><p class="eyebrow">Part one</p><h2>Onboarding</h2>'
  '<p>One row per type of company or person. Each cell says what happens and its status underneath.</p></div>')
w(table(ON_COLS, ONBOARDING, 'Who', key='on'))
w('</section>')

w('<section class="wide"><div class="sec-head"><p class="eyebrow">Part two</p><h2>Shipments, start to finish</h2>'
  '<p>Every step of a load, what each party does at it, and the status the load shows afterwards. Empty cells mean that party has no part in the step.</p></div>')
w(table(SH_COLS, SHIPMENT, 'Step', status_col=True, key='sh'))
w('</section>')

w('<section class="wide"><div class="sec-head"><p class="eyebrow">Part three</p><h2>Payments</h2>'
  '<p>Every way money moves: setting up, what gets charged, paying out and putting things right. Stripe has only run in test mode.</p></div>')
w(table(PAY_COLS, PAYMENTS, 'Money flow', key='pay'))
w('</section>')

w('<section class="wide"><div class="sec-head"><p class="eyebrow">Part four</p><h2>Mobile apps: native iOS and Android</h2>'
  '<p>No mobile app exists yet, so every app cell is missing. The last column is what matters for effort: how much of the platform is already there for the app to use. '
  'Recommended build: one React Native (Expo) codebase that compiles to native iOS and Android apps and shares the web app’s TypeScript types and API client, instead of two separate Swift and Kotlin apps. '
  'Drivers first: loads, stops, GPS, photos and POD.</p></div>')
w(table(MOB_COLS, MOBILE, 'Feature', key='mob'))
w('</section>')

w('<section><div class="sec-head"><h2>Running it for real</h2><p>What has to be in place outside the code.</p></div><div class="builds">')
for st, name, text in OPS:
    w(f'<div class="b"><div class="bh"><span class="mk {st}">{MARK[st]}</span><h3>{html.escape(name)}</h3><span class="st {st}" style="margin:0">{LABEL[st]}</span>' + (f'<span class="when" style="margin:0">Last work {fmt_date(OPS_DATES[name][0])} · <code>{OPS_DATES[name][1]}</code></span>' if name in OPS_DATES else '') + f'</div><p>{html.escape(text)}</p></div>')
w('</div></section>')

w('<section><div class="sec-head"><h2>Build order</h2><p>Highest impact on running real loads first.</p></div><div class="scroller free"><table class="order"><thead><tr><th>#</th><th>Build</th><th>What it covers</th></tr></thead><tbody>')
for i, (name, text) in enumerate(BUILD, 1):
    w(f'<tr><td>{i:02d}</td><td>{html.escape(name)}</td><td style="font-family:var(--f-body);white-space:normal">{html.escape(text)}</td></tr>')
w('</tbody></table></div></section>')

w('<section><div class="sec-head"><h2>History</h2><p>Milestones from the 129 commits on main, 1 Jun to 7 Nov 2026. The dates in the tables point at these commits.</p></div>'
  '<div class="scroller free"><table class="hist"><thead><tr><th>Date</th><th>Commit</th><th>What landed</th></tr></thead><tbody>')
for d, h, text in HISTORY:
    w(f'<tr><td>{fmt_date(d)}</td><td><code>{h}</code></td><td>{html.escape(text)}</td></tr>')
w('</tbody></table></div></section>')

w('<section><div class="sec-head"><h2>Keeping this current</h2><p>When a piece of work lands, change the cell to Built or Partial and put the commit date and hash on it. Missing cells say Open until a target date is set. '
  'Dates show when a cell reached its current state, taken from git history; work before 1 Jun 2026 and anything not committed has no date.</p></div></section>')

w('<p class="foot">Source: routes, controllers, middleware and services in api/, the Next.js pages, and the API test scripts (enforcement 114, directory 45, loads 18 and others, all passing). Payments and background checks were exercised with test keys and fake providers only.</p>')
w('</div></body></html>')

open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(out))
print('wrote', OUT, t_on, t_sh, t_ops)

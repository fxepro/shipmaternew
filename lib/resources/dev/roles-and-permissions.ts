import { UserCog } from 'lucide-react';
import type { AdminManualTopic } from '../admin-manual';

/**
 * Training material: the company role matrix (Admin Console, Settings, Roles & Permissions).
 * Written as prose for new developers and operators. No secrets or live identifiers belong here.
 */
export const ROLES_AND_PERMISSIONS_TOPIC: AdminManualTopic = {
  slug: 'roles-and-permissions',
  category: 'Contents',
  title: 'Roles and permissions',
  icon: UserCog,
  summary:
    'What each role in a shipper, carrier or factoring company may do, and how a Shipmater admin changes it. One matrix per company type applies to every company of that type.',
  bullets: [],
  sections: [
    {
      id: 'where',
      title: 'Where to find it',
      paragraphs: [
        'Admin Console, Settings, Roles & Permissions. The page has two tabs. Company roles holds the matrix for carriers, shippers and factoring companies. Admin roles is for Shipmater’s own staff and is not built yet.',
        'It sits under Settings rather than Organizations because it is a rule for the whole platform, not a record of one company. A change to the carrier matrix applies to every carrier at once.',
      ],
    },
    {
      id: 'matrix',
      title: 'Reading the matrix',
      paragraphs: [
        'Each row is something a person can do, grouped into Company, Loads, Trips, Contracts, Fleet, Money and Other for carriers, with similar groups for shippers and factoring companies. Each column is a role from the company’s Team tab: carriers have owner, staff, dispatcher, driver and viewer, and shippers and factoring companies have owner, staff and viewer.',
        'Each cell holds a level. Full means the person can do it. View means they can see it but not change it. Assigned means only the loads they are on, which is how drivers see their own loads and nobody else’s. Self means their own record only. None means no access. Not every level makes sense for every row: placing a bid is either allowed or not, so its cells only offer Full and None.',
        'The owner column is locked at full access so a company can never be locked out of its own account, and everyone always manages their own identity and checks. Those cells are shown faded with no way to change them.',
      ],
    },
    {
      id: 'editing',
      title: 'Changing a level',
      paragraphs: [
        'Click a cell to move it to the next level the row allows. Edited cells are shaded and a bar appears at the bottom with the number of unsaved changes, a Save button and a Discard button. Nothing changes until Save is pressed. A small dot marks every cell that differs from the default, and the line beside the type switcher counts them.',
        'The Pages switch beside the type shows the same rules the other way round: every page in that type’s sidebar and every button the matrix hides, the action that controls each one, and whether each role sees it. Pages with no rule, such as Dashboard, Profile and Resources, are always shown. It follows unsaved edits, so the effect of a change can be checked before saving. The page rules are in lib/permissions.ts, next to the list of hidden buttons, and the sidebar reads the same rules.',
        'Reset to defaults puts every role of the chosen type back to the starting values. Every change, including a reset, is recorded with the old level, the new level, the admin who made it and when, and the latest ones are listed under Recent changes.',
      ],
    },
    {
      id: 'defaults',
      title: 'The starting values',
      paragraphs: [
        'The defaults come from the company hierarchy plan. Only the owner signs contracts. Carrier staff handle the office, the team and the money but do not start trips or deliver, which is for the owner, dispatchers and the assigned driver. Dispatchers find loads, bid, assign drivers and run trips, and do not see money pages. Drivers see and work only the loads they are assigned to. Shipper staff post loads, accept bids and can pay with the company’s saved card, while only the owner adds or removes payment methods. Viewers can look but not change anything.',
      ],
    },
    {
      id: 'how',
      title: 'How it is stored',
      paragraphs: [
        'The list of actions, their allowed levels and their defaults are in code, in api/app/Support/Permissions.php, because each action needs a matching check in the API. An admin changes levels but cannot add an action. The role_permissions table holds only the levels an admin has changed, so a role with no rows is on its defaults and a reset simply removes the rows. role_permission_changes keeps the history. The matrix is cached and the cache is cleared whenever an admin saves.',
        'Permissions::level gives the level a role has for an action, and Permissions::forRole gives every level for one role. The signed-in person’s details from /user include that list as permissions.',
      ],
    },
    {
      id: 'enforcement',
      title: 'How the API enforces it',
      paragraphs: [
        'Every company route names the action it needs with the perm middleware, for example perm:carrier:loads.bid on placing a bid, or perm:carrier:loads.view=view,shipper:loads.view=view on the loads list, which any level other than none may open. A rule names a company type, so a route that shippers and carriers share lists one rule for each, and people from another kind of company pass through to the controller’s own checks. Platform admins and receivers have no company and are not affected. A refusal is a 403 with the code not_permitted and the action’s name.',
        'Assigned is handled in two places. When a route names a load, the middleware checks that the person is on that load in load_people and refuses with not_assigned if not. Lists of loads show only the person’s own loads when their loads.view level is assigned. Inside controllers, the old owner-or-staff and dispatcher checks were replaced by User::canDo and User::canSee with the matching action, for example canDo with company.profile decides whether a save may change the company’s details.',
        'The carrier approval gate still applies on top of the matrix: until a carrier company and its owner are approved, the load board, trips and earnings are closed to everyone at that carrier, whatever their role allows.',
      ],
    },
    {
      id: 'pages',
      title: 'What people see',
      paragraphs: [
        'The sidebar and the phone tab bar hide pages the person’s role can’t open, using lib/permissions.ts. Buttons for actions the role can’t take are hidden too: New Shipment and New job for people who can’t post loads, Place Bid on the load board, Accept and Decline on offers and bids, and Invite, role changes and removal on the Team page. Pages read the permissions through the useCan hook. If an action is refused anyway, for example after an admin changes the matrix while someone has a page open, a message says the role can’t do it; refused page loads are left to the page itself.',
      ],
    },
    {
      id: 'view-as',
      title: 'Viewing a company as an admin',
      paragraphs: [
        'The Admin Console sidebar has a Carrier View and a Shipper View, each listing every page of that sidebar. An admin isn’t part of any company, so these pages need to know which company to show. On any carrier or shipper page a dark bar sits above the top bar with a search box. Typing two or more letters searches companies of that type by name, MC, DOT or EIN and lists the first ten; picking one opens the page as that company, and the bar then reads Viewing, the company name, read-only, with Change and Exit. Until a company is picked the page shows a prompt instead of calling the API. The choice is kept in the browser, one for Carrier View and one for Shipper View, and is cleared on sign-out.',
        'The frontend sends the chosen company’s id in the X-View-As-Org header on carrier and shipper pages. The ViewAsCompany middleware honours it only for platform admins and only for that request: the company becomes the admin’s current company in memory, never saved, and every action reads as view. The role matrix lets every read through, the carrier approval gate is skipped so an unapproved carrier’s pages can still be seen, and anything other than a read is refused with the code read_only. Action buttons are hidden because the viewed company’s permissions are all view. The header is ignored for everyone else, so a company user can’t use it to see another company.',
        'Personal tabs, such as the Personal tab of the carrier profile, still show the signed-in admin’s own details, because those belong to the person and not the company. Each time an admin opens a company this way a row is written to admin_company_views with the admin, the company, the page and the time, at most once per admin and company every half hour.',
        'A rolled-back script checked it: the admin read every carrier page as Reyes Transport and every shipper page as Morgan Freight with no refusals, each profile showed the right company, five kinds of change were refused, an unknown company gave a 404, a carrier user sending the header saw only their own company, the admin’s saved company never changed, the view was logged once per company, and search found a carrier by its MC number. Every Carrier View and Shipper View page was then opened in the browser with no failed calls.',
      ],
    },
    {
      id: 'demo',
      title: 'Demo logins for each role',
      paragraphs: [
        'RoleDemoSeeder adds one login for each role. At Reyes Transport, the demo carrier, they are reyes.staff, reyes.dispatcher, reyes.driver and reyes.viewer. At Morgan Freight, the demo broker, they are morgan.staff, morgan.agent (from BrokerDemoSeeder) and morgan.viewer. Front Range Foods, the demo shipper, is riley@demo.com. At Summit Freight Capital, the demo factoring company, they are summit.staff and summit.viewer. All are at demo.com and use the demo password from the main seeder. The driver is on demo load DEMO0001, so they have one assigned load. The seeder runs with the main seeder and can be run on its own with php artisan db:seed --class=RoleDemoSeeder.',
      ],
    },
    {
      id: 'testing',
      title: 'How it was tested',
      paragraphs: [
        'Enforcement was tested by a second rolled-back script that signs in as every role at all three companies and makes 117 checks. Calls that should be allowed send empty bodies, so they stop at validation and change nothing. It covers the load board, bidding, earnings, invitations, vehicles, assigning a driver, starting a trip, factoring and payouts for each carrier role; posting loads and freight jobs, the subscription, preferred carriers, contracts, payments, payment methods, the bank connection and locations for each shipper role; NOAs and payouts for each factor role; a driver seeing only their assigned load and being refused another; a dispatcher’s company change being ignored; and an admin granting a level and it applying at once. The carrier was approved inside the test only. The earlier profile and matrix tests still pass, and the pages were checked in the browser as the shipper viewer and the carrier driver.',
        'A script inside a rolled-back transaction checked 22 things: the admin reading all three matrices, a non-admin being refused, saving changes and the new level taking effect at once, the change being logged, owner and own-record cells being refused, a level the row does not allow being refused, a role that does not belong to the type being refused, setting a cell back to its default removing the stored row, a reset, and the default levels for drivers, factor viewers and shipper staff. The page was then opened in the browser, a cell edited and the change discarded.',
      ],
    },
  ],
};

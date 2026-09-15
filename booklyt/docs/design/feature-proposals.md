# Booklyt: design review and feature proposals

Status: design changes implemented locally; features below are proposals awaiting approval.

## Design changes

- Replaced the dark, animated marketing homepage with a warm, editorial design, a locally hosted salon photo, clear product explanations, mobile navigation, selectable business examples and accessible FAQ disclosures.
- Aligned the homepage and root metadata with the Booklyt name used in the project README. Authentication and dashboard branding were outside this design pass.
- Removed unsupported usage counters, availability guarantees, pricing and capability claims from the homepage. Prices in the website examples are explicitly labelled as sample data.
- Added branded navigation and a discreet footer to published customer templates. Preserved native navigation and the existing booking flow.
- Reworked tenant heroes and services with clearer typography, compact layouts, service photos when supplied, and the business's configured currency.
- Replaced the empty map placeholder with useful contact links and opening hours. Kept business-owned content and photo positioning controls.
- Removed public fallback reviews and discount offers. Editor examples remain labelled; published pages only display supplied content. Removed automatic review/offer rotation so people can read at their own pace.
- Improved primary-button contrast for light brand colours. New default copy and muted text colours apply to newly selected templates; published configurations are not rewritten.

## Proposed features — choose by number

These priorities are product recommendations based on the existing builder, booking flow and project documentation. Effort is relative, not a delivery estimate. The current project already includes reminders, a waitlist, QR sharing, rescheduling and Arabic booking; those are not proposed as new features.

| # | Feature | First version to approve | Business value | Relative effort |
|---|---|---|---|---|
| 1 | Google Calendar sync | Connect a staff calendar, block busy periods, and add/update/cancel booking events. Include disconnect and sync-failure status. Start with Google; add Outlook separately. | Avoid conflicts with appointments kept outside Booklyt. | Large |
| 2 | Deposits and cancellation policies | Optional fixed or percentage deposit per service, clear cancellation terms before confirmation, payment status and owner-managed refunds. Requires choosing a payment provider and supported market. | Help businesses protect time reserved for an appointment. | Large |
| 3 | Custom domains | Connect a business-owned domain with DNS instructions, verification status, HTTPS and a canonical website URL. | Make each customer's website feel like an independent business. | Medium–large |
| 4 | Packages and memberships | Start with prepaid session packs, a remaining-visit balance, expiry dates and cancellation credit rules. Recurring memberships can follow. | Support repeat visits and prepaid services for trainers, spas and salons. | Large |
| 5 | Post-visit review requests | Send an opt-in request after a completed appointment, link to the business's review page, and let the owner display approved customer feedback. | Collect real social proof to replace template placeholders. | Medium |
| 6 | Booking funnel analytics | Track website visits, service selection, booking starts and confirmed appointments, with source tags for shared links. Avoid collecting form contents in analytics. | Show owners where customers stop and which sharing channels work. | Medium |

Suggested order: **1 → 2 → 3** for a booking-first product; **3 → 1 → 2** if branded websites are the main reason customers buy. Packages and review requests follow after the core commercial flow is settled.

Calendar conflict checking is an established scheduling workflow in [Calendly's calendar connection documentation](https://calendly.com/help/connect-your-calendar-to-calendly). [Wix's cancellation policy workflow](https://support.wix.com/en/article/wix-bookings-charging-a-cancellation-or-no-show-fee) and [membership/package documentation](https://support.wix.com/en/article/wix-bookings-about-memberships-and-packages) provide references for the payment and repeat-visit proposals. These references support the feature patterns; the priority order above is specific product judgment for Booklyt.

## Validation

- Full lint, TypeScript checks and production build passed.
- Browser checks passed at 320, 390, 768 and 1440 px: homepage overflow, menu navigation, example/service switching and FAQs.
- All five tenant themes checked with isolated fixture data: service currency, contact links, removal of public placeholder reviews/offers, mobile overflow, Arabic direction, photo CTA visibility and native/header separation.
- Browser tests created no appointments. They do not verify live payment, messaging or availability integrations.
- The temporary fixture route was removed after testing.
- Final checks confirmed that selecting a service advances to date selection, empty team links are omitted, and image-only heroes retain an accessible page heading.

Desktop and mobile captures: [desktop](homepage-desktop.png), [mobile](homepage-mobile.png).

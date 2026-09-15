# Customer website refresh

The builder and published booking page now share `TenantWebsite`. Both receive the same business, active services, active staff, opening hours, branding, images, and content. The builder loads tenant-scoped data through the existing authenticated owner/admin config endpoints; credentials are excluded. Failed loads show a retry screen instead of editable defaults.

## Five website styles

- **Editorial:** asymmetric portrait cover, oversized serif heading, numbered service menu.
- **Atelier:** centred masthead and introduction, panoramic photography, visual service cards.
- **Modern Practice:** compact split introduction, clear service rows, practical appointment section.
- **Performance:** immersive photographic cover, large uppercase headings, structured service grid.
- **Quiet Luxury:** arched portrait, centred copy, generous spacing and treatment cards.

Select a style under Website Builder → Templates. Switching styles preserves the business's text, uploaded photos, image positioning, gallery, and branding metadata. Existing template slugs remain compatible. A style changes typography, composition, service presentation, spacing, and colours. Images are optional; missing services, staff, and gallery photos are not replaced with fictitious business data.

## Preview behavior

Desktop and mobile previews render in an iframe with the website's actual styles and responsive breakpoints. Normal preview matches the published page; “Edit on page” enables inline text editing. Business data comes from saved records, while unsaved design and content changes appear immediately. Real appointment availability can be read, but preview booking, OTP, waitlist, and push writes are disabled.

The onboarding preview uses the services, contact information, and working hours entered in the form. It shows no invented staff or appointments. Availability starts after launch.

## Validation

- Production build, TypeScript checks, ESLint, and `git diff --check` passed.

- Chromium: all five desktop and mobile styles, real service names/photos, preserved content in draft saves, and no horizontal mobile overflow.
- Completed a preview booking without OTP, appointment, waitlist, or push writes.
- Compared the published `WebsiteShell` with the builder at the same mobile width: identical tenant text and hero image dimensions.
- Arabic mobile layout direction and overflow checked.
- Walked through onboarding: entered service and updated hours appear in preview and survive a style change.
- Data helper checks: tenant scoping, active filters, credential exclusion, error propagation, and legacy style compatibility.
- Screenshots: `website-editorial.png`, `website-atelier.png`, `website-practice.png`, `website-performance.png`, `website-retreat.png`.

Browser tests used isolated local fixtures and intercepted API responses. No production tenant was changed or published.

## Service category behavior

With no categories, booking shows the normal service list directly. When categories exist, the customer chooses a category before seeing its services; a back control returns to categories. Unassigned services remain available under Other services. Empty categories cannot be selected for booking. A new booking resets category selection.

Services settings defaults to a flat All list, including unassigned services. Creating categories adds optional filters. Category selection narrows the list, and empty categories give guidance to add or assign services.

Verified with React component interaction tests covering the default list, single/multiple categories, switching and back navigation, unassigned services, removed categories, Arabic labels, and settings filters. Chromium timed out during startup, so these changes did not receive a browser visual review.

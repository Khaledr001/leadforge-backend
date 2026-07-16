# LeadForge website templates (Astro)

Five standalone Astro static-site templates, one per business vertical. The
backend's site generator (Phase 7) copies a template to a temp directory,
overwrites `src/data.json` with AI-generated copy + lead info, runs
`astro build`, and deploys the static output to Cloudflare Pages.

| Template          | Verticals                                | Palette                | Font    |
| ----------------- | ---------------------------------------- | ---------------------- | ------- |
| `template-trades` | plumber, electrician, HVAC, handyman     | navy + amber           | Inter   |
| `template-beauty` | salon, barber, spa, nails                | rose + soft gold       | DM Sans |
| `template-food`   | restaurant, cafe, bakery, catering       | terracotta + warm gold | Inter   |
| `template-auto`   | auto repair, car wash, detailing, towing | charcoal + red         | Inter   |
| `template-home`   | landscaping, cleaning, pest control, roofing | forest green + earth | Inter   |

All five share an **identical, fully data-driven** `src/pages/index.astro`.
Colors and font come from `src/data.json` (`primaryColor`, `accentColor`,
`fontFamily`), so each template differs from the others only by its sample data.

## `data.json` shape

```
businessName, phone, address, city, state, zip,
heroHeadline, heroSubheadline,
aboutSection            (paragraphs separated by \n\n),
services      [{ name, description }],
testimonials  [{ text, author }],
ctaText, metaTitle, metaDescription,
googleMapsEmbedUrl,
hours         [{ label, value }],   (optional)
primaryColor, accentColor, fontFamily
```

## Preview one locally

```bash
cd template-trades
pnpm install --ignore-workspace   # standalone; do not join the backend workspace
pnpm dev                          # http://localhost:4321
```

Every template includes: mobile-first responsive layout, a sticky click-to-call
bar on mobile, hero → `tel:` CTA, about, services grid, testimonials grid,
contact with Google Maps embed + hours, Schema.org `LocalBusiness` JSON-LD, and
Open Graph tags. No JS frameworks — the pages ship as static HTML with inlined
CSS to hit the Lighthouse 95+ target.

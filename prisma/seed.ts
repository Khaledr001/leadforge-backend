/**
 * Seeds the database with demo data: 50 leads in Austin TX across 5 categories
 * (30 without websites, 20 with), spread across the funnel statuses, plus a
 * few generated sites, outreach sequences, clients, and analytics events so
 * every dashboard page has something to show.
 *
 * Run: pnpm db:seed
 */
import {
  ClientPlan,
  LeadStatus,
  OutreachChannel,
  OutreachStepStatus,
  PrismaClient,
  ServiceType,
} from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES = ['plumber', 'salon', 'restaurant', 'auto repair', 'landscaping'] as const;

const NAMES: Record<(typeof CATEGORIES)[number], string[]> = {
  plumber: ['Hill Country Plumbing', 'Rapid Rooter', 'BlueLine Plumbing', 'Austin Pipe Pros', 'Lone Star Leak Fix', 'Capital City Plumbing', 'Violet Crown Plumbing', 'Barton Springs Plumbing', 'Tex Plumb Co', 'MoPac Plumbing'],
  salon: ['Luxe Locks Salon', 'The Fade Room', 'Cactus Rose Beauty', 'South Congress Salon', 'Shear Bliss', 'Golden Hour Hair', 'The Polished Nail', 'Zilker Cuts', 'Crown & Comb', 'Radiant Skin Studio'],
  restaurant: ['Pecan Street Bistro', 'El Camino Tacos', 'Smoke & Oak BBQ', 'Lady Bird Cafe', 'The Brisket Barn', 'Rainey Street Kitchen', 'Verde Bowl', 'Congress Ave Diner', 'Casa de Mole', 'Hilltop Pizza Co'],
  'auto repair': ['TexTune Auto', 'Armadillo Auto Care', 'Speedway Garage', 'Lakeline Motors', 'Reliable Rides Repair', 'Burnet Road Auto', 'Longhorn Lube & Tire', 'Precision Auto Works', 'Sixth Street Garage', 'Cedar Park Car Care'],
  landscaping: ['Greenbelt Lawns', 'Bluebonnet Landscapes', 'Oak Shade Tree Care', 'Sunset Valley Turf', 'Cactus & Stone Design', 'Travis County Mowing', 'Wildflower Yards', 'Limestone Landscaping', 'Pedernales Pest Control', 'Clear Creek Cleanups'],
};

// Funnel spread over 50 leads.
const STATUSES: LeadStatus[] = [
  ...Array<LeadStatus>(14).fill(LeadStatus.NEW),
  ...Array<LeadStatus>(10).fill(LeadStatus.ENRICHED),
  ...Array<LeadStatus>(9).fill(LeadStatus.SITE_BUILT),
  ...Array<LeadStatus>(8).fill(LeadStatus.CONTACTED),
  ...Array<LeadStatus>(4).fill(LeadStatus.REPLIED),
  ...Array<LeadStatus>(2).fill(LeadStatus.DEMO_BOOKED),
  ...Array<LeadStatus>(2).fill(LeadStatus.CLOSED_WON),
  LeadStatus.CLOSED_LOST,
  LeadStatus.UNSUBSCRIBED,
];

const PLANS: ClientPlan[] = [ClientPlan.WEBSITE_ONLY, ClientPlan.FULL_PACKAGE];
const PLAN_MRR: Record<ClientPlan, number> = {
  WEBSITE_ONLY: 9900,
  WEBSITE_PLUS_VOICE: 29900,
  FULL_PACKAGE: 49900,
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function main(): Promise<void> {
  console.log('Seeding leadforge...');

  let leadIndex = 0;
  for (const category of CATEGORIES) {
    for (const [i, businessName] of NAMES[category].entries()) {
      const status = STATUSES[leadIndex % STATUSES.length];
      const hasWebsite = leadIndex % 5 < 2; // 20 of 50 with websites
      const createdAt = daysAgo(60 - leadIndex);

      const lead = await prisma.lead.create({
        data: {
          businessName,
          category,
          city: 'Austin',
          state: 'TX',
          zip: `787${String(10 + (leadIndex % 40)).padStart(2, '0')}`,
          address: `${100 + leadIndex * 7} ${['Congress Ave', 'S Lamar Blvd', 'Burnet Rd', 'E 6th St', 'Manor Rd'][leadIndex % 5]}`,
          phone: `+1 (512) 555-0${String(100 + leadIndex).slice(-3)}`,
          email: status === LeadStatus.NEW ? null : `contact@${slug(businessName)}.com`,
          websiteUrl: hasWebsite ? `https://www.${slug(businessName)}.com` : null,
          googlePlaceId: `seed-place-${leadIndex}`,
          googleRating: 3.5 + (leadIndex % 15) / 10,
          googleReviewCount: 12 + leadIndex * 3,
          status,
          createdAt,
        },
      });

      // Generated site for leads at SITE_BUILT or beyond.
      const built: LeadStatus[] = [
        LeadStatus.SITE_BUILT, LeadStatus.CONTACTED, LeadStatus.REPLIED,
        LeadStatus.DEMO_BOOKED, LeadStatus.CLOSED_WON,
      ];
      if (built.includes(status)) {
        await prisma.generatedSite.create({
          data: {
            leadId: lead.id,
            templateId: `template-${{ plumber: 'trades', salon: 'beauty', restaurant: 'food', 'auto repair': 'auto', landscaping: 'home' }[category]}`,
            subdomain: slug(businessName),
            deployUrl: `https://${slug(businessName)}.yourbrand.site`,
            isClaimed: status === LeadStatus.CLOSED_WON,
            claimedAt: status === LeadStatus.CLOSED_WON ? daysAgo(5) : null,
            visitCount: leadIndex % 9,
            lastVisitedAt: leadIndex % 9 > 0 ? daysAgo(leadIndex % 7) : null,
            createdAt,
          },
        });
        await prisma.analyticsEvent.create({
          data: { leadId: lead.id, eventType: 'site_generated', metadata: { seed: true }, createdAt },
        });
      }

      // Outreach steps for contacted-and-beyond leads.
      const contacted: LeadStatus[] = [
        LeadStatus.CONTACTED, LeadStatus.REPLIED, LeadStatus.DEMO_BOOKED, LeadStatus.CLOSED_WON,
      ];
      if (contacted.includes(status)) {
        const opened = leadIndex % 2 === 0;
        const replied = status !== LeadStatus.CONTACTED;
        for (const [n, delay] of [[1, 0], [2, 3], [3, 7], [4, 14]] as const) {
          const sent = n === 1 || (n === 2 && opened);
          await prisma.outreachSequence.create({
            data: {
              leadId: lead.id,
              channel: OutreachChannel.EMAIL,
              stepNumber: n,
              scheduledAt: daysAgo(20 - delay),
              sentAt: sent ? daysAgo(20 - delay) : null,
              openedAt: sent && opened ? daysAgo(19 - delay) : null,
              clickedAt: sent && opened && n === 1 ? daysAgo(19 - delay) : null,
              repliedAt: sent && replied && n === 1 ? daysAgo(18) : null,
              subject: n === 1 ? `I built a website for ${businessName}` : undefined,
              body: sent && replied && n === 1 ? 'Looks great — can we talk this week?' : undefined,
              status: sent
                ? OutreachStepStatus.SENT
                : replied
                  ? OutreachStepStatus.CANCELLED
                  : OutreachStepStatus.SCHEDULED,
            },
          });
        }
        await prisma.analyticsEvent.create({
          data: { leadId: lead.id, eventType: 'email_sent', metadata: { stepNumber: 1 }, createdAt: daysAgo(20) },
        });
        if (opened) {
          await prisma.analyticsEvent.create({
            data: { leadId: lead.id, eventType: 'email_open', metadata: {}, createdAt: daysAgo(19) },
          });
        }
      }

      // Clients for CLOSED_WON leads.
      if (status === LeadStatus.CLOSED_WON) {
        const plan = PLANS[leadIndex % PLANS.length];
        const client = await prisma.client.create({
          data: {
            leadId: lead.id,
            plan,
            mrr: PLAN_MRR[plan],
            stripeCustomerId: `cus_seed_${leadIndex}`,
            startedAt: daysAgo(30 + leadIndex),
          },
        });
        if (plan === ClientPlan.FULL_PACKAGE) {
          await prisma.aiService.create({
            data: {
              clientId: client.id,
              serviceType: ServiceType.AI_RECEPTIONIST,
              isActive: true,
              monthlyCost: 5000,
              monthlyPrice: 20000,
            },
          });
        }
        await prisma.analyticsEvent.create({
          data: { leadId: lead.id, eventType: 'checkout_completed', metadata: { plan }, createdAt: daysAgo(5) },
        });
      }

      leadIndex += 1;
    }
  }

  const [leads, sites, steps, clients, events] = await Promise.all([
    prisma.lead.count(),
    prisma.generatedSite.count(),
    prisma.outreachSequence.count(),
    prisma.client.count(),
    prisma.analyticsEvent.count(),
  ]);
  console.log(`Seeded: ${leads} leads, ${sites} sites, ${steps} outreach steps, ${clients} clients, ${events} events`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

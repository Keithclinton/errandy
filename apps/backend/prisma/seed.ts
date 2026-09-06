import { PrismaClient, KycStatus } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const DEMO_OWNERS = [
  { email: "seed.amina@errandspot.demo", name: "Amina Wanjiru" },
  { email: "seed.brian@errandspot.demo", name: "Brian Otieno" },
  { email: "seed.faith@errandspot.demo", name: "Faith Mwikali" },
];

const LISTINGS: Array<{
  title: string;
  description: string;
  category: string;
  location: string;
  budget: number | null;
}> = [
  {
    title: "Pick up dry cleaning from Westlands",
    description: "Need someone to collect 4 shirts and a suit from a dry cleaner in Westlands and drop them at my office in Upper Hill by Friday.",
    category: "Errands",
    location: "Westlands",
    budget: 600,
  },
  {
    title: "Assemble a flat-pack wardrobe",
    description: "Bought a 3-door wardrobe that needs assembly. Comes with instructions, just need someone with basic tools and patience.",
    category: "Home & Repairs",
    location: "Kilimani",
    budget: 2500,
  },
  {
    title: "Help moving a 2-bedroom apartment",
    description: "Moving from Kileleshwa to South B this weekend. Need 2 people to help load/unload a pickup truck (truck already booked).",
    category: "Moving & Help",
    location: "Kileleshwa",
    budget: 4000,
  },
  {
    title: "Deep clean a 3-bedroom house",
    description: "Move-in cleaning needed for a 3-bedroom house — kitchen, bathrooms, and windows especially. Cleaning supplies available on site.",
    category: "Cleaning",
    location: "Karen",
    budget: 3500,
  },
  {
    title: "Grocery shopping and delivery",
    description: "Weekly grocery list from Naivas, delivered to Lavington. Will share the exact list and budget for items separately.",
    category: "Shopping & Delivery",
    location: "Lavington",
    budget: 1200,
  },
  {
    title: "Basic bookkeeping for a small shop",
    description: "Small retail shop needs someone to organize a month of receipts and set up a simple expense tracker in a spreadsheet.",
    category: "Business Help",
    location: "CBD",
    budget: 3000,
  },
  {
    title: "Fix a leaking kitchen tap",
    description: "Kitchen tap has been dripping for a week. Just needs a new washer or cartridge, parts can be provided if you tell me what to buy.",
    category: "Home & Repairs",
    location: "Ngong Road",
    budget: 1500,
  },
  {
    title: "Queue and collect documents from Huduma Centre",
    description: "Need someone to queue at Huduma Centre GPO to collect a processed ID. I'll share the collection slip and ID details.",
    category: "Errands",
    location: "GPO, CBD",
    budget: 800,
  },
  {
    title: "Help set up for a birthday party",
    description: "Need 2 hours of help blowing up balloons, setting up tables and decorations before a birthday party on Saturday afternoon.",
    category: "Other",
    location: "Runda",
    budget: 2000,
  },
  {
    title: "Walk and feed my dog for a week",
    description: "Traveling for work and need someone reliable to walk and feed my Labrador twice a day for 7 days. Food already at home.",
    category: "Other",
    location: "Kileleshwa",
    budget: 3500,
  },
  {
    title: "Paint a small bedroom",
    description: "One bedroom, roughly 3x4m, needs a fresh coat of paint. Paint and brushes will be provided, just need the labour.",
    category: "Home & Repairs",
    location: "South B",
    budget: 4500,
  },
  {
    title: "Deliver a parcel across town",
    description: "Need a small, sealed parcel delivered from Hurlingham to Thika Road by end of day. Nothing fragile, fits in a backpack.",
    category: "Shopping & Delivery",
    location: "Hurlingham",
    budget: 700,
  },
];

const KENYAN_PHONE_PREFIX = "2547";

async function main() {
  const owners = [];
  for (const [i, demo] of DEMO_OWNERS.entries()) {
    const passwordHash = await argon2.hash(`seed-${demo.email}-${Date.now()}`);
    const owner = await prisma.user.upsert({
      where: { email: demo.email },
      update: {},
      create: {
        email: demo.email,
        name: demo.name,
        passwordHash,
        phone: `${KENYAN_PHONE_PREFIX}${(10000000 + i).toString()}`,
        kycStatus: KycStatus.verified,
        acceptedTermsAt: new Date(),
        termsVersion: "v1",
      },
    });
    owners.push(owner);
  }

  let created = 0;
  for (const [i, listing] of LISTINGS.entries()) {
    const owner = owners[i % owners.length];
    const existing = await prisma.listing.findFirst({
      where: { title: listing.title, ownerId: owner.id },
    });
    if (existing) continue;
    await prisma.listing.create({
      data: {
        ownerId: owner.id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        location: listing.location,
        budget: listing.budget,
        imageUrls: [],
      },
    });
    created++;
  }

  console.log(`Seed owners ready: ${owners.length}. New listings created: ${created} (skipped duplicates).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

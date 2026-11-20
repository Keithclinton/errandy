// Test data for a load test. Run on the server, from the app folder so its packages and .env load:
//   cd ~/errandspot && node ~/loadtest-data.js seed      40 open listings by a "Load test" user
//   cd ~/errandspot && node ~/loadtest-data.js cleanup   removes them and the accounts the test made
// Everything here uses an @errandspot.invalid email address (a domain that can't exist), and
// cleanup removes only such accounts. It deletes them directly rather than as the app does, so no
// "recently deleted" block is left on the made-up phone numbers.
const fromApp = (name) => require(require.resolve(name, { paths: [process.cwd()] }));
fromApp("dotenv").config({ path: ".env" });
const { PrismaClient } = fromApp("@prisma/client");

const prisma = new PrismaClient();
const TEST_EMAILS = { endsWith: "@errandspot.invalid" };
const CATEGORIES = ["Errands", "Cleaning", "Delivery", "Moving", "Repairs", "Shopping"];
const PLACES = ["Westlands", "Kilimani", "CBD", "Karen", "Kasarani", "Embakasi"];

async function seed() {
  const owner = await prisma.user.upsert({
    where: { email: "loadtest-seed@errandspot.invalid" },
    update: {},
    create: { email: "loadtest-seed@errandspot.invalid", name: "Load test", acceptedTermsAt: new Date(), termsVersion: "v2" },
  });
  await prisma.listing.deleteMany({ where: { ownerId: owner.id } });
  const { count } = await prisma.listing.createMany({
    data: Array.from({ length: 40 }, (_, i) => ({
      ownerId: owner.id,
      title: `[Load test] Task ${i + 1}`,
      description: "A listing made for a load test. It is removed when the test ends. ".repeat(4),
      category: CATEGORIES[i % CATEGORIES.length],
      location: PLACES[i % PLACES.length],
      budget: 500 + i * 50,
    })),
  });
  console.log(`seeded ${count} listings`);
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: TEST_EMAILS }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (!ids.length) return console.log("nothing to remove");
  const listingIds = (await prisma.listing.findMany({ where: { ownerId: { in: ids } }, select: { id: true } })).map((l) => l.id);
  await prisma.$transaction([
    prisma.bid.deleteMany({ where: { OR: [{ listingId: { in: listingIds } }, { bidderId: { in: ids } }] } }),
    prisma.listing.deleteMany({ where: { id: { in: listingIds } } }),
    prisma.notification.deleteMany({ where: { userId: { in: ids } } }),
    prisma.analyticsEvent.deleteMany({ where: { userId: { in: ids } } }),
    prisma.kycVerification.deleteMany({ where: { userId: { in: ids } } }),
    prisma.phoneOtp.deleteMany({ where: { userId: { in: ids } } }),
    prisma.tokenTransaction.deleteMany({ where: { userId: { in: ids } } }),
    prisma.tokenPurchase.deleteMany({ where: { userId: { in: ids } } }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
  ]);
  console.log(`removed ${ids.length} test accounts and ${listingIds.length} listings`);
}

const action = { seed, cleanup }[process.argv[2]];
if (!action) {
  console.error("usage: node loadtest-data.js seed | cleanup");
  process.exit(2);
}
action()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

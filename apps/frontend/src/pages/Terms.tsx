export default function Terms() {
  return (
    <article className="prose prose-sm mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">
        Placeholder text — version v1. This must be reviewed by a lawyer familiar with Kenyan
        data-protection and consumer-protection law before real users onboard.
      </p>

      <h2 className="text-lg font-medium">1. The service</h2>
      <p className="text-sm">
        Errandy is a marketplace where users post errands and bid on each other's. Errandy is not a party to
        any agreement between an errand poster and a bidder, and does not process payment for completed
        errands — those arrangements are made directly between users.
      </p>

      <h2 className="text-lg font-medium">2. Identity verification</h2>
      <p className="text-sm">
        Before posting or bidding, you must complete a one-time identity check (government ID + selfie)
        through our verification partner. You must provide accurate information and consent separately
        before that check begins.
      </p>

      <h2 className="text-lg font-medium">3. Conduct</h2>
      <p className="text-sm">
        Users must not post fraudulent listings, harass other users, or attempt to circumvent safety
        features such as ratings and reports. Accounts found in violation may be suspended.
      </p>

      <h2 className="text-lg font-medium">4. Ratings and reports</h2>
      <p className="text-sm">
        After a completed errand, both parties may rate each other. Ratings are hidden until both parties
        submit theirs, or seven days pass. Any user may report another user, listing, or message for review.
      </p>

      <h2 className="text-lg font-medium">5. Liability</h2>
      <p className="text-sm">
        Errandy provides the platform "as is" and is not responsible for the quality, safety, or legality of
        errands arranged through it.
      </p>
    </article>
  );
}

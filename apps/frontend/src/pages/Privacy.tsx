export default function Privacy() {
  return (
    <article className="prose prose-sm mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">
        Placeholder text — version v1. This must be reviewed by a lawyer familiar with the Kenya
        Data Protection Act 2019 before real users onboard.
      </p>

      <h2 className="text-lg font-medium">1. What we collect</h2>
      <p className="text-sm">
        Account details (name, email, phone), task and offer content, chat messages, and — during
        one-time identity verification — an SMS-delivered verification code. The code itself is
        never stored in readable form and expires shortly after it's sent.
      </p>

      <h2 className="text-lg font-medium">2. How we use it</h2>
      <p className="text-sm">
        To operate the marketplace: matching tasks and offers, enabling chat, computing ratings,
        reviewing reports, and sending notifications about your account activity.
      </p>

      <h2 className="text-lg font-medium">3. Storage and retention</h2>
      <p className="text-sm">
        Data is stored in a managed database with access restricted behind authentication. We retain
        account data for as long as your account is active, and apply a defined retention policy to
        verification records.
      </p>

      <h2 className="text-lg font-medium">4. Your rights</h2>
      <p className="text-sm">
        You may request access to, correction of, or deletion of your personal data, subject to
        applicable law. Contact us to exercise these rights.
      </p>

      <h2 className="text-lg font-medium">5. Breach notification</h2>
      <p className="text-sm">
        In the event of a data breach affecting your personal data, we will notify affected users and
        the relevant authority as required by law.
      </p>
    </article>
  );
}

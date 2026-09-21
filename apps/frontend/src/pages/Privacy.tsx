export default function Privacy() {
  return (
    <article className="prose prose-sm mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: September 21, 2026</p>

      <p className="text-sm">
        This policy explains what personal data Errandspot collects, why, and what rights you have over it under
        the Data Protection Act, 2019, and the Data Protection (General) Regulations, 2021 (Kenya). Errandspot is
        the data controller for the personal data described below, and registers with the Office of the Data
        Protection Commissioner (ODPC) where the Act requires it to.
      </p>

      <h2 className="text-lg font-medium">1. What we collect</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>Account details: name, email address, and phone number.</li>
        <li>
          Verification data: the phone number you verify, and a one-time SMS code sent to it. The code itself is
          never stored in readable form and expires shortly after it's sent.
        </li>
        <li>
          Task and offer content: anything you post when creating a task or making an offer, including
          descriptions, location, budget, and category.
        </li>
        <li>Messages: chat messages exchanged with other users through the Service.</li>
        <li>Ratings and reports: ratings you give or receive, and reports you file or that are filed about you.</li>
        <li>
          Usage data: basic technical data such as device and log information, used to keep the Service secure
          and working correctly.
        </li>
        <li>
          Platform fee payment data: when you pay Errandspot's fee to post or accept a task, our payment provider
          processes your payment method (for example, mobile money or card). We receive confirmation that the
          fee was paid and a reference for it; we don't receive or store your full card number or mobile money
          PIN.
        </li>
      </ul>
      <p className="text-sm">
        Errandspot doesn't process, and never receives, any payment made between a task poster and a provider for
        the task itself; see our Terms of Service for how that payment works.
      </p>

      <h2 className="text-lg font-medium">2. How we use it</h2>
      <p className="text-sm">
        We use this data to operate the marketplace: matching tasks with providers, enabling chat between users,
        verifying identity, charging and reconciling Errandspot's own platform fees, computing and displaying
        ratings, reviewing reports, sending you notifications about activity on your account, keeping the
        Service secure, and meeting our legal obligations.
      </p>

      <h2 className="text-lg font-medium">3. Who we share it with</h2>
      <p className="text-sm">
        Other users see what's needed to use the Service as intended: for example, a provider sees the task
        poster's name and rating, and vice versa, once they're in contact. We share data with service providers
        who help us run Errandspot, such as our hosting provider, our SMS-delivery provider, and the licensed
        payment provider that processes Errandspot's platform fees, only to the extent needed for them to
        provide that service to us, and under terms that require them to protect it. We don't sell your personal
        data, and we don't share it with advertisers.
      </p>

      <h2 className="text-lg font-medium">4. Storage and security</h2>
      <p className="text-sm">
        Data is stored in a managed database with access restricted to authenticated systems and personnel who
        need it to operate the Service. We apply reasonable technical and organizational measures to protect it
        against unauthorized access, loss, or misuse.
      </p>

      <h2 className="text-lg font-medium">5. Retention</h2>
      <p className="text-sm">
        We retain your account data for as long as your account is active. If you close your account, we retain
        data only as long as needed for legitimate purposes such as resolving disputes, enforcing our Terms, or
        meeting legal obligations, after which it's deleted or anonymized. Verification codes are retained only
        briefly, per Section 1.
      </p>

      <h2 className="text-lg font-medium">6. Your rights</h2>
      <p className="text-sm">Under the Data Protection Act, 2019, you have:</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>the right to be informed of the uses your personal data is put to (Section 26);</li>
        <li>the right of access to the personal data we hold about you (Section 27);</li>
        <li>the right to object to processing of your data, on certain grounds (Section 28);</li>
        <li>the right to have inaccurate or misleading data corrected (Section 31);</li>
        <li>
          the right to request deletion of data that's excessive, unlawfully obtained, or no longer needed for
          the purpose it was collected for (Section 33); and
        </li>
        <li>the right to receive your data in a usable format and have it transmitted to another controller (Section 38).</li>
      </ul>
      <p className="text-sm">
        To exercise any of these rights, contact us at support@errandspot.com; we respond within a reasonable
        time as required by law. You also have the right to lodge a complaint directly with the Office of the
        Data Protection Commissioner (ODPC) at complaint@odpc.go.ke or www.odpc.go.ke if you believe your data
        has been mishandled.
      </p>

      <h2 className="text-lg font-medium">7. Data breaches</h2>
      <p className="text-sm">
        If a breach of your personal data occurs that's likely to affect your rights, we will notify the Office
        of the Data Protection Commissioner within seventy-two hours of becoming aware of it, and notify you
        directly without undue delay where you're identifiable and likely to be affected.
      </p>

      <h2 className="text-lg font-medium">8. Children</h2>
      <p className="text-sm">
        Errandspot is not intended for anyone under 18, and we don't knowingly collect personal data from anyone
        under that age. If you believe a child has created an account, contact us and we'll remove it.
      </p>

      <h2 className="text-lg font-medium">9. International transfers</h2>
      <p className="text-sm">
        If any service provider we use stores or processes data outside Kenya, we take steps to ensure that data
        continues to receive a level of protection consistent with the Data Protection Act, 2019, wherever it's
        processed.
      </p>

      <h2 className="text-lg font-medium">10. Cookies and similar technology</h2>
      <p className="text-sm">
        We use only the cookies or similar technology needed to keep you signed in and the Service working
        correctly. We don't use them for third-party advertising.
      </p>

      <h2 className="text-lg font-medium">11. Changes to this policy</h2>
      <p className="text-sm">
        We may update this policy as the Service changes. We'll post the updated version here with a new "last
        updated" date, and where a change is material, we'll make reasonable efforts to notify active users
        before it takes effect.
      </p>

      <h2 className="text-lg font-medium">12. Contact</h2>
      <p className="text-sm">
        Questions about this policy, or requests relating to your personal data, can be sent to
        support@errandspot.com. Our data protection point of contact can be reached at the same address.
      </p>
    </article>
  );
}

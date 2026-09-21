export default function Safety() {
  return (
    <article className="prose prose-sm mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Safety</h1>

      <p className="text-sm">
        Errandspot is built on people trusting people they haven't met before, so safety isn't a page we bolted
        on, it's the thing the product has to get right. Here's what's in place today, and how to use it well.
      </p>

      <h2 className="text-lg font-medium">Identity verification</h2>
      <p className="text-sm">
        Before anyone can post a task or make an offer, they verify a real phone number with a one-time SMS
        code. That code is never stored in readable form and expires shortly after it's sent. It's a simple
        check, not a background check: it confirms you're dealing with a real, reachable person, not proof of
        anyone's character or skill. Treat every new contact accordingly.
      </p>

      <h2 className="text-lg font-medium">Ratings and reports</h2>
      <p className="text-sm">
        After a task is marked complete, both sides rate each other. To keep ratings honest, they're hidden from
        both parties until either both have submitted theirs, or seven days have passed, so no one can see the
        other's score before deciding what to leave. Any user, task, or message can be reported for review at
        any time, whether or not a task was completed.
      </p>

      <h2 className="text-lg font-medium">Before you agree to a task</h2>
      <p className="text-sm">
        Read the other person's profile and rating history, and use Errandspot's chat to confirm the details
        that matter (scope, timing, location, and price) before you commit. A task description that's vague
        on purpose, or a counterpart who pushes to move the conversation off-platform immediately, is worth a
        second look.
      </p>

      <h2 className="text-lg font-medium">Meeting in person</h2>
      <p className="text-sm">
        For a first meeting with someone new, prefer a public, well-lit location where one's reasonably
        available for the task, and let someone else know where you're going and when you expect to be done.
        Trust your own read of a situation: it's fine to reschedule, ask for a video call first, or walk away
        from a task that feels off, no explanation required.
      </p>

      <h2 className="text-lg font-medium">Payments</h2>
      <p className="text-sm">
        Errandspot doesn't process payments. You and the other person arrange payment directly, on terms you
        both agree to. Be cautious about paying the full amount upfront for a task you can't yet verify was
        done, and just as cautious about starting significant work before agreeing on price. If a payment
        request feels rushed or doesn't match what you discussed, pause and re-confirm before sending anything.
      </p>

      <h2 className="text-lg font-medium">After the task</h2>
      <p className="text-sm">
        Rate promptly and honestly: it's what makes the next person's decision easier, the same way someone
        else's rating helped you. If something went wrong, report it right away rather than letting it go;
        reports are how we catch repeat problems early.
      </p>

      <h2 className="text-lg font-medium">If something feels wrong</h2>
      <p className="text-sm">
        Report the user, task, or message directly from Errandspot, and email support@errandspot.com if it's
        urgent or you're not sure a report captures it. We review every report.
      </p>
    </article>
  );
}

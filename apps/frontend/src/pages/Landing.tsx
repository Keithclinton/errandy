import { Navigate, Link } from "react-router-dom";
import {
  ClipboardList,
  Handshake,
  MessageCircle,
  Star,
  ShieldCheck,
  Flag,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    icon: ClipboardList,
    title: "Post a task",
    body: "Describe what you need done, from quick everyday errands to skilled work.",
  },
  {
    icon: Handshake,
    title: "Get offers",
    body: "People nearby send offers with a price and a quick note on how they'll help.",
  },
  {
    icon: MessageCircle,
    title: "Chat & agree",
    body: "Message the provider directly, agree on the details, and share contact info when you're ready.",
  },
  {
    icon: Star,
    title: "Complete & rate",
    body: "Mark the task done, then both of you rate each other. Ratings stay hidden until both are in.",
  },
];

const features = [
  {
    icon: ShieldCheck,
    title: "Verified users",
    body: "A one-time government ID + selfie check before anyone can post a task or make an offer, so you know who you're dealing with.",
  },
  {
    icon: MapPin,
    title: "Built for local",
    body: "Filter by category and location to find tasks nearby.",
  },
  {
    icon: Flag,
    title: "Report anytime",
    body: "Every task, profile, and message has a report button, reviewed by our moderation team.",
  },
];

export default function Landing() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (user) return <Navigate to="/browse" replace />;

  return (
    <div className="space-y-20 pb-12">
      {/* Hero */}
      <section className="-mx-4 -mt-6 bg-secondary px-4 pb-16 pt-16 sm:-mx-6 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Need something done? <span className="text-primary">Post it.</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            From everyday errands to skilled work, post what you need done and get offers from
            verified providers.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">Post a task</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/browse">Find work</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </section>

      {/* How it works */}
      <section>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <p className="mt-2 text-muted-foreground">Four steps from posted to done.</p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <Card key={step.title}>
              <CardContent className="p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </div>
                <step.icon className="mt-4 h-6 w-6 text-primary" />
                <h3 className="mt-3 font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Why Errandspot */}
      <section>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold">Why Errandspot</h2>
          <p className="mt-2 text-muted-foreground">Safety and simplicity, built in from the start.</p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardContent className="flex gap-4 p-5">
                <feature.icon className="h-6 w-6 shrink-0 text-primary" />
                <div>
                  <h3 className="font-medium">{feature.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-xl bg-secondary px-6 py-12 text-center">
        <h2 className="text-2xl font-semibold">Ready to get something done?</h2>
        <p className="mt-2 text-muted-foreground">
          Sign up in under a minute. Verification only happens once you're ready to post a task or
          make an offer.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/register">Create your account</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/browse">See what's posted</Link>
          </Button>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
        <Link to="/terms" className="hover:text-foreground hover:underline">
          Terms of Service
        </Link>
        <span>·</span>
        <Link to="/privacy" className="hover:text-foreground hover:underline">
          Privacy Policy
        </Link>
      </footer>
    </div>
  );
}

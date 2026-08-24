import { Fragment, useEffect } from "react";
import { Navigate, Link, useLocation } from "react-router-dom";
import {
  ClipboardPlus,
  UsersRound,
  MessagesSquare,
  ShieldCheck,
  Star,
  MapPin,
  Clock,
  Tag,
  Wallet,
  LayoutGrid,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import heroIllustration from "@/assets/hero-illustration.jpg";

const valueProps = [
  { icon: Clock, title: "Save Time", body: "Let someone else handle it." },
  { icon: Tag, title: "Choose Your Price", body: "Get offers and pick what works for you." },
  { icon: Wallet, title: "Earn Flexibly", body: "Choose tasks and work on your terms." },
  { icon: ShieldCheck, title: "Trust Who You Hire", body: "Verified people and real ratings." },
];

const steps = [
  {
    icon: ClipboardPlus,
    title: "Post a task",
    body: "Describe what you need done, from quick everyday errands to skilled work.",
  },
  {
    icon: UsersRound,
    title: "Get offers",
    body: "People nearby send offers with a price and a quick note on how they'll help.",
  },
  {
    icon: MessagesSquare,
    title: "Chat & agree",
    body: "Message the provider directly, agree on the details, and share contact info when you're ready.",
  },
  {
    icon: ShieldCheck,
    title: "Complete & rate",
    body: "Mark the task done, then both of you rate each other. Ratings stay hidden until both are in.",
  },
];

const trustItems = [
  { icon: ShieldCheck, title: "Verified Users", body: "Real people, verified for safety.", highlight: false },
  { icon: MapPin, title: "Built for Local", body: "People nearby. Faster help.", highlight: true },
  { icon: Star, title: "Rated & Reviewed", body: "Real ratings. Make better choices.", highlight: false },
  { icon: LayoutGrid, title: "Variety of Tasks", body: "Errands, labour, skills & more.", highlight: false },
];

const footerLinks = [
  { to: "/about", label: "About us" },
  { to: "/safety", label: "Safety" },
  { to: "/help", label: "Help Center" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
];

export default function Landing() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (location.hash === "#how-it-works") {
      document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [location]);

  if (isLoading) return null;
  if (user) return <Navigate to="/browse" replace />;

  return (
    <div className="space-y-20 pb-12">
      {/* Hero */}
      <section className="rounded-xl bg-secondary px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Need something done? <span className="text-highlight">Post it.</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              From everyday errands to skilled work, post what you need done and get offers from
              verified providers.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
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
            <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:justify-center lg:justify-start">
              <div className="flex -space-x-2">
                {["JM", "AK", "TN"].map((label) => (
                  <Avatar key={label} className="h-8 w-8 border-2 border-background">
                    <AvatarFallback className="text-xs">{label}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <div className="flex items-center gap-1 text-highlight">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-highlight" />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">Trusted by people in your community</span>
            </div>
          </div>

          <img
            src={heroIllustration}
            alt="Person browsing tasks on their phone, surrounded by example task offers"
            className="mx-auto w-full max-w-lg"
          />
        </div>
      </section>

      {/* Value props */}
      <section>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {valueProps.map((prop) => (
            <div key={prop.title} className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary text-primary">
                <prop.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-3 font-medium">{prop.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{prop.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <p className="mt-2 text-muted-foreground">Four steps from posted to done.</p>
        </div>
        <div className="mt-10 flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-between">
          {steps.map((step, i) => (
            <Fragment key={step.title}>
              <div className="flex max-w-[12rem] flex-1 flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary">
                  <step.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-3 font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="hidden h-6 w-6 shrink-0 text-muted-foreground/50 lg:mt-5 lg:block" />
              )}
            </Fragment>
          ))}
        </div>
      </section>

      {/* Trust banner */}
      <section className="rounded-xl bg-primary px-6 py-10 text-primary-foreground">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <item.icon className={cn("h-6 w-6 shrink-0", item.highlight ? "text-highlight" : "text-primary-foreground")} />
              <div>
                <h3 className="font-medium">{item.title}</h3>
                <p className="mt-1 text-sm text-primary-foreground/70">{item.body}</p>
              </div>
            </div>
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
          <Button asChild size="lg" variant="highlight">
            <Link to="/register">Create your account</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/browse">See what's posted</Link>
          </Button>
        </div>
      </section>

      <footer className="rounded-xl space-y-6 bg-primary px-6 py-10 text-center text-sm text-primary-foreground/70">
        <Link to="/" className="inline-flex items-center gap-2 text-base font-semibold text-primary-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-highlight text-sm text-highlight-foreground">
            E
          </span>
          Errandspot
        </Link>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {footerLinks.map((link) => (
            <Link key={link.to} to={link.to} className="hover:text-primary-foreground hover:underline">
              {link.label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}

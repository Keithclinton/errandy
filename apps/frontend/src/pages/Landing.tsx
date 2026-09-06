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
  { icon: ClipboardPlus, title: "Post a task" },
  { icon: UsersRound, title: "Get offers" },
  { icon: MessagesSquare, title: "Chat & agree" },
  { icon: ShieldCheck, title: "Complete & rate" },
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
    <div className="space-y-12 pb-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-secondary via-secondary to-primary/10 px-6 py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-highlight/20 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.25fr] lg:items-center">
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
            className="mx-auto hidden w-full max-w-2xl drop-shadow-xl sm:block"
          />
        </div>
      </section>

      {/* Value props */}
      <section>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {valueProps.map((prop, i) => (
            <div
              key={prop.title}
              className="group flex animate-fade-up flex-col items-center text-center"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary text-primary shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-highlight group-hover:text-highlight group-hover:shadow-md">
                <prop.icon className="h-9 w-9" />
              </div>
              <h3 className="mt-3 font-medium">{prop.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{prop.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 rounded-xl bg-gradient-to-b from-secondary/70 to-transparent px-6 py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <p className="mt-2 text-muted-foreground">Four steps from posted to done.</p>
        </div>
        <div className="relative mt-10 flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div
            aria-hidden
            className="absolute left-0 right-0 top-10 hidden h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent lg:block"
          />
          {steps.map((step, i) => (
            <Fragment key={step.title}>
              <div className="relative flex flex-1 flex-col items-center text-center">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-card text-primary shadow-md ring-4 ring-secondary">
                  <step.icon className="h-9 w-9" />
                  <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-highlight text-xs font-semibold text-highlight-foreground">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-3 font-medium">{step.title}</h3>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="hidden h-6 w-6 shrink-0 text-primary/40 lg:mt-6 lg:block" />
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
              <item.icon className={cn("h-8 w-8 shrink-0", item.highlight ? "text-highlight" : "text-primary-foreground")} />
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

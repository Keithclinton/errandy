import { NavLink } from "react-router-dom";
import { PlusCircle, Search, ListChecks, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/browse", label: "Browse Tasks", icon: Search },
  { to: "/my-activity", label: "My Tasks", icon: ListChecks },
  { to: "/chat", label: "Messages", icon: MessageCircle },
  { to: "/verify", label: "Verification", icon: ShieldCheck },
];

export function BrowseSidebar() {
  return (
    <aside className="hidden w-56 shrink-0 space-y-4 lg:block">
      <Button asChild className="w-full" variant="highlight">
        <NavLink to="/listings/new">
          <PlusCircle className="mr-2 h-4 w-4" /> Post a Task
        </NavLink>
      </Button>
      <nav className="space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/browse"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-accent",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

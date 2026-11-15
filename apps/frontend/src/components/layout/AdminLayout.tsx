import { NavLink, Outlet } from "react-router-dom";
import { useAdminIdChecks } from "@/hooks/use-admin";
import { cn } from "@/lib/utils";

export function AdminLayout() {
  const { data: waitingIdChecks } = useAdminIdChecks("pending");
  const waiting = waitingIdChecks?.length ?? 0;

  const tabs = [
    { to: "/admin/users", label: "Users" },
    { to: "/admin/id-checks", label: "ID checks", count: waiting },
    { to: "/admin/reports", label: "Reports" },
    { to: "/admin/analytics", label: "Analytics" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
        <nav className="mt-2 flex gap-1 overflow-x-auto border-b">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground",
                  isActive && "border-primary text-primary",
                )
              }
            >
              {tab.label}
              {!!tab.count && (
                <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  {tab.count}
                  <span className="sr-only"> waiting</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}

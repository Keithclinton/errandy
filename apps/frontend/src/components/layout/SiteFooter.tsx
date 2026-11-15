import { Link } from "react-router-dom";
import logoIcon from "@/assets/logo-icon.png";

const footerLinks = [
  { to: "/about", label: "About us" },
  { to: "/safety", label: "Safety" },
  { to: "/help", label: "Help Center" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
];

export function SiteFooter() {
  return (
    <footer className="space-y-6 rounded-xl bg-primary px-6 py-10 text-center text-sm text-primary-foreground/70">
      <Link to="/" className="inline-flex items-center gap-2 text-base font-semibold text-primary-foreground">
        <img src={logoIcon} alt="" className="h-7 w-7" />
        Errandspot
      </Link>
      <nav aria-label="Footer">
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {footerLinks.map((link) => (
            <li key={link.to}>
              <Link to={link.to} className="hover:text-primary-foreground hover:underline">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className="text-xs">© {new Date().getFullYear()} Errandspot</p>
    </footer>
  );
}

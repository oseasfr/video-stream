import { Link, useLocation } from "react-router-dom";
import { Upload, Tv } from "lucide-react";

const navItems = [
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/tv", label: "TV Stream", icon: Tv },
];

const NavBar = () => {
  const location = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group select-none">
          <img
            src="https://www.cafecomcyber.com.br/lovable-uploads/icone-home.png"
            alt="OPEN"
            className="w-6 h-6 object-contain opacity-90 group-hover:opacity-100 transition-opacity"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span className="font-black text-sm tracking-wide text-foreground">Stream - Café com Cyber</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location.pathname.startsWith(href);
            return (
              <Link
                key={href}
                to={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

export default NavBar;

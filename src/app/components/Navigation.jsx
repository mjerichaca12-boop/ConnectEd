import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";

function Navigation() {
  const navigate = useNavigate();
  const navRef = useRef(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id) => {
    const target = document.getElementById(id);
    if (!target) return;

    const navHeight = navRef.current?.offsetHeight ?? 0;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - navHeight - 8;

    window.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: "smooth",
    });

    setMobileOpen(false);
  };

  const navLinks = [
    { label: "Home", id: "hero" },
    { label: "Features", id: "features" },
    { label: "Roles", id: "roles" },
    { label: "About", id: "about" },
  ];

  return (
    <nav ref={navRef} className={`fixed top-0 inset-x-0 z-50 w-full transition-all duration-300 ${isScrolled ? "bg-gray-950/70 backdrop-blur-md shadow-md border-b border-white/10" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <span className="relative text-2xl font-extrabold tracking-tight text-emerald-600">
          Connect<span className="text-white">Ed</span>
        </span>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <button key={l.id} onClick={() => scrollTo(l.id)} className="text-gray-600 hover:text-emerald-600 font-medium text-sm transition-colors cursor-pointer">
              {l.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm">Login</Link>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3 shadow-lg">
          {navLinks.map((l) => (
            <button key={l.id} onClick={() => scrollTo(l.id)} className="block w-full text-left text-gray-700 font-medium py-2 text-sm">{l.label}</button>
          ))}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <Link to="/login" className="flex-1 text-center py-2 text-sm text-white bg-emerald-600 rounded-lg font-semibold">Login</Link>
          </div>
        </div>
      )}
    </nav>
  );
}

export { Navigation };

import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Shield, Menu, X } from "lucide-react";

function Navigation() {
  const navigate = useNavigate();
  const [clickCount, setClickCount] = useState(0);
  const [showAdminButton, setShowAdminButton] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        e.preventDefault();
        navigate("/admin");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  const handleLogoClick = () => {
    const n = clickCount + 1;
    setClickCount(n);
    if (n === 5) {
      setShowAdminButton(true);
      setTimeout(() => { setShowAdminButton(false); setClickCount(0); }, 10000);
    } else if (n > 5) setClickCount(0);
  };

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileOpen(false);
  };

  const navLinks = [
    { label: "Home", id: "hero" },
    { label: "Features", id: "features" },
    { label: "Roles", id: "roles" },
    { label: "About", id: "about" },
  ];

  return (
    <nav className={`w-full sticky top-0 z-50 transition-all duration-300 ${isScrolled ? "bg-white/95 backdrop-blur-md shadow-md border-b border-gray-100" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <button onClick={handleLogoClick} className="relative text-2xl font-extrabold tracking-tight text-emerald-600 select-none cursor-pointer">
          Connect<span className="text-gray-900">Ed</span>
          {clickCount > 0 && clickCount < 5 && (
            <span className="absolute -top-1 -right-3 w-4 h-4 bg-emerald-500 text-white text-[10px] rounded-full flex items-center justify-center">{clickCount}</span>
          )}
        </button>

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
          {showAdminButton && (
            <button onClick={() => navigate("/admin")} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black transition-colors">
              <Shield className="w-4 h-4" /> Admin
            </button>
          )}
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

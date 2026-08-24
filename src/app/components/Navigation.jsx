import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";

function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      setTimeout(() => {
        const target = document.getElementById(id);
        if (target) {
          const navHeight = navRef.current?.offsetHeight ?? 0;
          const targetTop = target.getBoundingClientRect().top + window.scrollY - navHeight - 8;
          window.scrollTo({ top: Math.max(targetTop, 0), behavior: "smooth" });
        }
      }, 100);
    }
  }, [location]);

  const handleNavClick = (id) => {
    setMobileOpen(false);
    if (location.pathname !== "/" && location.pathname !== "/landing") {
      navigate(`/#${id}`);
      return;
    }
    const target = document.getElementById(id);
    if (!target) return;
    const navHeight = navRef.current?.offsetHeight ?? 0;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - navHeight - 8;
    window.scrollTo({ top: Math.max(targetTop, 0), behavior: "smooth" });
  };

  const [user, setUser] = useState(null);

  useEffect(() => {
    const rawUser = localStorage.getItem("currentUser");
    if (rawUser) {
      try {
        setUser(JSON.parse(rawUser));
      } catch {
        setUser(null);
      }
    } else {
      setUser(null);
    }
  }, [location]);

  const handleAuthClick = () => {
    setMobileOpen(false);
    if (user?.role === "admin") {
      navigate("/admin/dashboard");
    } else if (user?.role === "teacher") {
      navigate("/teacher/dashboard");
    } else {
      navigate("/login");
    }
  };

  const navLinks = [
    { label: "Platform", id: "features" },
    { label: "Solutions", id: "roles" },
    { label: "About ConnectEd", id: "about" },
  ];

  return (
    <nav ref={navRef} className={`fixed top-0 inset-x-0 z-50 w-full transition-all duration-300 ${isScrolled ? "bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-200" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <button onClick={() => handleNavClick("hero")} className="relative text-2xl font-extrabold tracking-tight cursor-pointer">
          <span className="text-gray-900">Connect</span>
          <span className="text-green-600">Ed</span>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <button key={l.id} onClick={() => handleNavClick(l.id)} className="text-gray-600 hover:text-green-600 font-medium text-sm transition-all duration-200 cursor-pointer">
              {l.label}
            </button>
          ))}
          <button
            onClick={handleAuthClick}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-all shadow-sm cursor-pointer"
          >
            {user ? "Go to Dashboard" : "Sign In"}
          </button>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-all duration-200">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3 shadow-lg">
          {navLinks.map((l) => (
            <button key={l.id} onClick={() => handleNavClick(l.id)} className="block w-full text-left text-gray-700 font-medium py-2 text-sm hover:text-green-600 transition-colors">{l.label}</button>
          ))}
          <button
            onClick={handleAuthClick}
            className="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors mt-2"
          >
            {user ? "Go to Dashboard" : "Sign In"}
          </button>
        </div>
      )}
    </nav>
  );
}

export { Navigation };

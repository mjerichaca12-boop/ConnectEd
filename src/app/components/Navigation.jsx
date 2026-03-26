import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Shield } from "lucide-react";
function Navigation() {
  const navigate = useNavigate();
  const [clickCount, setClickCount] = useState(0);
  const [showAdminButton, setShowAdminButton] = useState(false);
  const [keySequence, setKeySequence] = useState([]);
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
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
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount === 5) {
      setShowAdminButton(true);
      setTimeout(() => {
        setShowAdminButton(false);
        setClickCount(0);
      }, 1e4);
    } else if (newCount > 5) {
      setClickCount(0);
    }
  };
  return <nav className={`w-full bg-white border-b sticky top-0 z-50 transition-all duration-300 ${isScrolled ? "border-gray-300 shadow-lg" : "border-gray-200 shadow-sm"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {
    /* Logo - Secret Admin Access (click 5 times) */
  }
          <div className="flex items-center relative group">
            <button
    onClick={handleLogoClick}
    className="text-2xl font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer select-none"
  >
              ConnectEd
            </button>
            {
    /* Click counter indicator (only visible when clicking) */
  }
            {clickCount > 0 && clickCount < 5 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 text-white text-xs rounded-full flex items-center justify-center animate-ping">
                {clickCount}
              </span>}
          </div>

          {
    /* Navigation Links */
  }
          <div className="hidden md:flex items-center gap-8">
            <button
    onClick={() => scrollToSection("hero")}
    className="text-gray-700 hover:text-emerald-600 transition-colors cursor-pointer"
  >
              Home
            </button>
            <button
    onClick={() => scrollToSection("features")}
    className="text-gray-700 hover:text-emerald-600 transition-colors cursor-pointer"
  >
              Features
            </button>
            <button
    onClick={() => scrollToSection("roles")}
    className="text-gray-700 hover:text-emerald-600 transition-colors cursor-pointer"
  >
              Roles
            </button>
            <button
    onClick={() => scrollToSection("about")}
    className="text-gray-700 hover:text-emerald-600 transition-colors cursor-pointer"
  >
              About
            </button>
          </div>

          {
    /* Action Buttons */
  }
          <div className="flex items-center gap-3">
            {
    /* Secret Admin Button - appears after 5 clicks on logo */
  }
            {showAdminButton && <button
    onClick={() => navigate("/admin")}
    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg hover:from-gray-900 hover:to-black transition-all shadow-lg animate-in fade-in slide-in-from-top-2 duration-300"
    title="Administrator Portal"
  >
                <Shield className="w-4 h-4" />
                Admin Portal
              </button>}
            
<Link
    to="/login"
    className="text-gray-700 hover:text-emerald-600 transition-colors px-4 py-2 cursor-pointer"
  >
              Login
            </Link>
            <Link
    to="/signup"
    className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
  >
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </nav>;
}
export {
  Navigation
};

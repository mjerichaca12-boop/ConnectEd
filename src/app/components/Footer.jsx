import { Link } from "react-router-dom";

function Footer() {
  const links = [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms of Service", href: "/terms-of-service" },
    { label: "Contact Us", href: "/contact" },
    { label: "Support", href: "/support" },
  ];

  return (
    <footer className="w-full bg-gray-50 border-t border-gray-200 py-8 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div>
          <p className="text-gray-900 font-extrabold text-xl tracking-tight">
            Connect<span className="text-green-600">Ed</span>
          </p>
          <p className="text-gray-500 text-sm mt-0.5">Connecting Education, One Portal at a Time</p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
          {links.map((l) => (
            <Link key={l.label} to={l.href} className="hover:text-green-600 transition-all duration-200">{l.label}</Link>
          ))}
        </div>

        {/* Copyright */}
        <p className="text-gray-500 text-sm">© {new Date().getFullYear()} ConnectEd. All rights reserved.</p>
      </div>
    </footer>
  );
}

export { Footer };

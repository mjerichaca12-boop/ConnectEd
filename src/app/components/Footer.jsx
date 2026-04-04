function Footer() {
  const links = [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Contact Us", href: "#" },
    { label: "Support", href: "#" },
  ];

  return (
    <footer className="w-full bg-gray-950 border-t border-white/8 py-10 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand */}
        <div>
          <p className="text-white font-extrabold text-xl tracking-tight">
            Connect<span className="text-emerald-400">Ed</span>
          </p>
          <p className="text-gray-500 text-sm mt-0.5">Connecting Education, One Portal at a Time</p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
          {links.map((l) => (
            <a key={l.label} href={l.href} className="hover:text-white transition-colors">{l.label}</a>
          ))}
        </div>

        {/* Copyright */}
        <p className="text-gray-600 text-sm">© {new Date().getFullYear()} ConnectEd. All rights reserved.</p>
      </div>
    </footer>
  );
}

export { Footer };

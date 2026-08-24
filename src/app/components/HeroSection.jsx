import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Shield, Smartphone, Lock, Eye } from "lucide-react";

function HeroSection() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  useEffect(() => {
    const rawUser = localStorage.getItem("currentUser");
    if (rawUser) {
      try {
        setUser(JSON.parse(rawUser));
      } catch {
        setUser(null);
      }
    }
  }, []);

  const handleAuthClick = () => {
    if (user?.role === "admin") {
      navigate("/admin/dashboard");
    } else if (user?.role === "teacher") {
      navigate("/teacher/dashboard");
    } else {
      navigate("/login");
    }
  };

  const scrollToFeatures = () => {
    const target = document.getElementById("features");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const trustItems = [
    { icon: Shield, label: "Secure Platform" },
    { icon: Smartphone, label: "Mobile-Ready" },
    { icon: Lock, label: "Data Privacy Compliant" },
    { icon: Eye, label: "Accessible Design" },
  ];

  return (
    <section id="hero" className="relative w-full bg-white min-h-screen flex flex-col justify-center items-center overflow-hidden pt-16">

      {/* Grid bg */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000006_1px,transparent_1px),linear-gradient(to_bottom,#00000006_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      {/* Green gradient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-green-100/60 rounded-full blur-[150px] pointer-events-none" />

      {/* Content */}
      <div className="relative max-w-4xl mx-auto px-6 py-6 text-center">

        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 border border-green-200 bg-green-50 text-green-700 text-xs font-semibold px-4 py-2 rounded-full mb-8 tracking-wide"
          style={{ animation: "fadeSlideDown 0.8s ease-out both" }}
        >
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          Now available for public schools in Cavite
        </div>

        {/* Headline */}
        <h1
          className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-gray-900 leading-[1.08] tracking-tight mb-5"
          style={{ animation: "fadeSlideUp 0.9s ease-out 0.15s both" }}
        >
          An Integrated Learning<br />
          Management Platform for<br />
          <span className="text-green-600">
            Modern Education
          </span>
        </h1>

        {/* Subtext */}
        <p
          className="text-gray-600 text-lg md:text-xl leading-relaxed mb-8 max-w-2xl mx-auto"
          style={{ animation: "fadeSlideUp 0.9s ease-out 0.3s both" }}
        >
          ConnectEd unifies classroom management, grading, announcements,
          and messaging — built specifically for DepEd public schools in Dasmariñas, Cavite.
        </p>

        {/* CTAs — 2 buttons only */}
        <div
          className="flex flex-col sm:flex-row gap-3 justify-center mb-8"
          style={{ animation: "fadeSlideUp 0.9s ease-out 0.45s both" }}
        >
          <button
            onClick={handleAuthClick}
            className="group relative flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-green-600/20 text-sm cursor-pointer"
          >
            {user ? "Go to Dashboard" : "Sign In"}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={scrollToFeatures}
            className="flex items-center justify-center gap-2 border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 font-medium px-8 py-3.5 rounded-xl transition-all duration-200 text-sm"
          >
            Learn More
          </button>
        </div>

        {/* Trust bar */}
        <div style={{ animation: "fadeSlideUp 0.9s ease-out 0.6s both" }}>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-widest mb-4">Trusted by public schools in Cavite</p>
          <div className="flex flex-wrap justify-center gap-6">
            {trustItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-2 text-gray-600">
                  <div className="w-8 h-8 bg-green-50 border border-green-100 rounded-lg flex items-center justify-center">
                    <Icon className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}

export { HeroSection };

import { useNavigate } from "react-router-dom";
import { GraduationCap, BookOpen, Shield, ArrowRight, CheckCircle } from "lucide-react";
import { useScrollReveal } from "@/app/hooks/useAnimations";

const roles = [
  {
    icon: GraduationCap,
    title: "Student",
    subtitle: "Access your school on mobile.",
    platform: "mobile",
    platformLabel: "📱 Mobile App Only",
    features: [
      "View grades and academic records",
      "Submit assignments & activities",
      "Read class announcements",
      "Message teachers directly",
      "Track attendance history",
    ],
    cta: null,
    ctaLabel: "Download the Mobile App",
  },
  {
    icon: BookOpen,
    title: "Teacher",
    subtitle: "Manage your classes on the web.",
    platform: "web",
    platformLabel: "🌐 Web Portal",
    features: [
      "Create & manage class sections",
      "Upload materials & assignments",
      "Record grades and attendance",
      "Post class announcements",
      "Message students directly",
    ],
    cta: "/login",
    ctaLabel: "Login as Teacher",
    highlighted: true,
  },
  {
    icon: Shield,
    title: "Administrator",
    subtitle: "Full control over school operations.",
    platform: "web",
    platformLabel: "🌐 Web Portal",
    features: [
      "Manage teacher & student accounts",
      "Monitor all class activities",
      "Generate school-wide reports",
      "Broadcast announcements",
      "System access control",
    ],
    cta: "/admin",
    ctaLabel: "Go to Admin Portal",
  },
];

function UserRoles() {
  const navigate = useNavigate();
  const [headerRef, headerVisible] = useScrollReveal();

  const cardRefs = [useScrollReveal(), useScrollReveal(), useScrollReveal()];

  return (
    <section id="roles" className="relative w-full bg-gray-950 py-24 px-6 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

      {/* Subtle glow */}
      <div className="absolute top-1/2 right-1/4 w-[500px] h-[500px] bg-emerald-500/4 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div
          ref={headerRef}
          className="text-center mb-16"
          style={{
            transition: "opacity 0.7s ease, transform 0.7s ease",
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? "translateY(0)" : "translateY(24px)",
          }}
        >
          <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-3">Who It's For</p>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Designed for Every Role
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Each portal is tailored to the real daily needs of that person — not a generic dashboard.
          </p>
        </div>

        {/* Role cards */}
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {roles.map((role, i) => {
            const Icon = role.icon;
            const [ref, visible] = cardRefs[i];
            return (
              <div
                key={role.title}
                ref={ref}
                style={{
                  transition: `opacity 0.65s ease ${i * 0.12}s, transform 0.65s ease ${i * 0.12}s`,
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(36px)",
                }}
              >
                <div
                  className={`relative flex flex-col rounded-3xl border transition-all duration-300 overflow-hidden h-full
                    ${role.highlighted
                      ? "bg-gray-900 border-emerald-500/40 shadow-2xl shadow-emerald-500/10 scale-[1.02]"
                      : "bg-gray-900/50 border-white/8 hover:border-emerald-500/20 hover:shadow-xl hover:shadow-emerald-900/10"
                    }`}
                >
                  {role.highlighted && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-emerald-300" />
                  )}

                  <div className="p-8 flex flex-col flex-1">
                    {/* Icon + badges */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-12 h-12 bg-emerald-500/15 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Icon className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {role.highlighted && (
                          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Most Used
                          </span>
                        )}
                        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-gray-800 text-gray-400 border border-white/8">
                          {role.platformLabel}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-1">{role.title}</h3>
                    <p className="text-gray-400 text-sm mb-6">{role.subtitle}</p>

                    <ul className="space-y-3 flex-1 mb-8">
                      {role.features.map((f) => (
                        <li key={f} className="flex items-start gap-3 text-sm text-gray-300">
                          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {role.cta ? (
                      <button
                        onClick={() => navigate(role.cta)}
                        className={`group w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm transition-all
                          ${role.highlighted
                            ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20"
                            : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                          }`}
                      >
                        {role.ctaLabel}
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ) : (
                      <div className="w-full text-center py-3 px-6 rounded-xl text-sm font-medium text-gray-500 bg-gray-800/60 border border-white/8">
                        📱 Available on the Mobile App
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export { UserRoles };

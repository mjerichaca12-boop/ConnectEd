import { BookCheck, MessageSquare, BarChart2, Calendar, Bell, Shield } from "lucide-react";
import { useScrollReveal } from "@/app/hooks/useAnimations";

const features = [
  { icon: BookCheck,    title: "Class & Grade Management",        desc: "Teachers create classes, upload materials, post assignments, and record grades — all in a single organized space.",        tag: "Teachers" },
  { icon: BarChart2,    title: "Academic Performance Tracking",    desc: "Students and parents see up-to-date grades, submission status, and learning progress at a glance.",                      tag: "Students" },
  { icon: Calendar,     title: "Attendance Management",            desc: "Mark and monitor daily attendance per class. Automatically flags absences and generates reports for administrators.",    tag: "All Roles" },
  { icon: Bell,         title: "Announcements & Notifications",    desc: "Post class-specific or school-wide announcements. Students receive real-time updates, no more missed information.",      tag: "All Roles" },
  { icon: MessageSquare,title: "Direct Messaging",                 desc: "Teachers message individual students. Students reach their teachers. Secure, in-platform communication for everyone.",  tag: "Teachers · Students" },
  { icon: Shield,       title: "Admin Control Panel",              desc: "Administrators manage users, monitor school-wide data, and control system access from a single dashboard.",             tag: "Admin" },
];

function RevealCard({ children, delay = 0 }) {
  const [ref, visible] = useScrollReveal();
  return (
    <div
      ref={ref}
      style={{
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
      }}
    >
      {children}
    </div>
  );
}

function CoreModules() {
  const [headerRef, headerVisible] = useScrollReveal();

  return (
    <section id="features" className="relative w-full bg-gray-950 py-24 px-6 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

      {/* Subtle glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-emerald-500/4 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto">
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
          <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-3">Platform Features</p>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Everything a school needs.<br />
            <span className="text-gray-500">Nothing it doesn't.</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Built from the ground up for public school workflows — not adapted from corporate tools.
          </p>
        </div>

        {/* Feature grid — staggered reveal */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <RevealCard key={f.title} delay={i * 0.08}>
                <div className="group relative bg-gray-900/60 border border-white/5 hover:border-emerald-500/30 rounded-2xl p-7 transition-all duration-300 hover:bg-gray-900 hover:shadow-xl hover:shadow-emerald-900/20 cursor-default h-full">
                  {/* Hover glow sweep */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-emerald-500/4 to-transparent pointer-events-none" />

                  <div className="w-11 h-11 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-emerald-500/20 group-hover:scale-110 transition-all duration-300">
                    <Icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
                    {f.tag}
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </RevealCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export { CoreModules };

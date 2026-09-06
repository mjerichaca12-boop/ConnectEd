import { BookOpen, BarChart2, MessageSquare, Shield, Lock, Clock } from "lucide-react";
import { useScrollReveal } from "@/app/hooks/useAnimations";

const overviewItems = [
  { icon: Clock, title: "Fixed Weekly Schedules", desc: "Classes follow a consistent weekly structure so teachers and students always know what's next." },
  { icon: MessageSquare, title: "Separate Announcements & Events", desc: "School-wide announcements and class events are organized into distinct channels for clarity." },
  { icon: Shield, title: "Role-Based Workflows", desc: "Admins, teachers, and students each get a purpose-built experience that matches their daily needs." },
];

const features = [
  { icon: BookOpen, title: "Course & Academic Management", desc: "Create classes, upload materials, post assignments, and organize your entire curriculum in one place.", tag: "Core" },
  { icon: BarChart2, title: "Performance Insights", desc: "Track grades, submissions, and academic progress with real-time analytics and visualizations.", tag: "Analytics" },
  { icon: MessageSquare, title: "Communication Center", desc: "Post class-specific or school-wide announcements. Students receive real-time updates instantly.", tag: "Comms" },
  { icon: Lock, title: "Secure Messaging", desc: "Teachers message individual students. Secure, in-platform communication with full privacy.", tag: "Security" },
  { icon: Shield, title: "Administrative Dashboard", desc: "Manage users, monitor school-wide data, and control system access from a single command center.", tag: "Admin" },
];

function RevealCard({ children, delay = 0 }) {
  const [ref, visible] = useScrollReveal();
  return (
    <div ref={ref} style={{ transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`, opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)" }}>
      {children}
    </div>
  );
}

function CoreModules() {
  const [overviewRef, overviewVisible] = useScrollReveal();
  const [headerRef, headerVisible] = useScrollReveal();

  return (
    <>
      {/* OVERVIEW SECTION */}
      <section className="relative w-full bg-gray-50 py-8 px-6 overflow-hidden border-t border-gray-200">
        <div className="relative max-w-7xl mx-auto">
          <div ref={overviewRef} className="text-center mb-10" style={{ transition: "opacity 0.7s ease, transform 0.7s ease", opacity: overviewVisible ? 1 : 0, transform: overviewVisible ? "translateY(0)" : "translateY(24px)" }}>
            <p className="text-green-600 text-xs font-bold uppercase tracking-widest mb-3">Overview</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
              One LMS platform,{" "}<span className="text-gray-600">structured by design</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {overviewItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <RevealCard key={item.title} delay={i * 0.08}>
                  <div className="group bg-white border border-gray-200 hover:border-green-300 rounded-2xl p-6 transition-all duration-200 hover:shadow-lg hover:shadow-green-100 cursor-default h-full">
                    <div className="w-12 h-12 bg-green-50 border border-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-all duration-200">
                      <Icon className="w-5 h-5 text-green-600" />
                    </div>
                    <h3 className="text-gray-900 font-semibold text-lg mb-2">{item.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </RevealCard>
              );
            })}
          </div>
        </div>
      </section>

      {/* PLATFORM FEATURES SECTION */}
      <section id="features" className="relative w-full bg-white py-8 px-6 overflow-hidden border-t border-gray-200">
        <div className="relative max-w-7xl mx-auto">
          <div ref={headerRef} className="text-center mb-10" style={{ transition: "opacity 0.7s ease, transform 0.7s ease", opacity: headerVisible ? 1 : 0, transform: headerVisible ? "translateY(0)" : "translateY(24px)" }}>
            <p className="text-green-600 text-xs font-bold uppercase tracking-widest mb-3">Platform Features</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3 tracking-tight">
              Everything education requires,{" "}<span className="text-gray-600">unified</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-base">
              Built from the ground up for school workflows — not adapted from corporate tools.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <RevealCard key={f.title} delay={i * 0.06}>
                  <div className="group relative bg-white border border-gray-200 hover:border-green-300 rounded-2xl p-6 transition-all duration-200 hover:shadow-lg hover:shadow-green-100 cursor-default h-full">
                    <div className="w-12 h-12 bg-green-50 border border-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-all duration-200">
                      <Icon className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 mb-2">{f.tag}</div>
                    <h3 className="text-gray-900 font-semibold text-lg mb-1">{f.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </RevealCard>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

export { CoreModules };

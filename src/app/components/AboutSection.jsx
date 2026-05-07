import { Target, Lightbulb, Shield, Calendar, Bell } from "lucide-react";
import { useScrollReveal } from "@/app/hooks/useAnimations";

function RevealItem({ children, delay = 0 }) {
  const [ref, visible] = useScrollReveal();
  return (
    <div ref={ref} style={{ transition: `opacity 0.65s ease ${delay}s, transform 0.65s ease ${delay}s`, opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)" }}>
      {children}
    </div>
  );
}

function AboutSection() {
  const [headerRef, headerVisible] = useScrollReveal();

  return (
    <section id="about" className="relative w-full bg-white py-8 px-6 overflow-hidden border-t border-gray-200">
      <div className="relative max-w-7xl mx-auto">
        <div ref={headerRef} className="text-center mb-10" style={{ transition: "opacity 0.7s ease, transform 0.7s ease", opacity: headerVisible ? 1 : 0, transform: headerVisible ? "translateY(0)" : "translateY(24px)" }}>
          <p className="text-green-600 text-xs font-bold uppercase tracking-widest mb-3">About ConnectEd</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3 tracking-tight">
            Built for Philippine{" "}<span className="text-gray-600">public education</span>
          </h2>
          <p className="text-gray-600 text-base max-w-2xl mx-auto">
            ConnectEd was created to bridge the technology gap in public education — giving students and teachers access to tools previously available only in private institutions.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-4">
          {/* Mission + Vision */}
          <div className="lg:col-span-3 grid md:grid-cols-2 gap-4">
            <RevealItem delay={0}>
              <div className="bg-green-50 border border-green-100 rounded-2xl p-6 h-full group hover:border-green-200 transition-all duration-200 shadow-sm">
                <div className="w-12 h-12 bg-white border border-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                  <Target className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Our Mission</h3>
                <p className="text-gray-600 leading-relaxed text-sm">
                  To bridge the gap between traditional education and modern technology in public schools across Dasmariñas, Cavite — making essential academic tools accessible to every student and teacher.
                </p>
              </div>
            </RevealItem>
            <RevealItem delay={0.12}>
              <div className="bg-white border border-gray-200 rounded-2xl p-6 h-full group hover:border-green-300 transition-all duration-200 shadow-sm">
                <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform group-hover:bg-green-50 group-hover:border-green-100">
                  <Lightbulb className="w-5 h-5 text-gray-500 group-hover:text-green-600 transition-colors" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Our Vision</h3>
                <p className="text-gray-600 leading-relaxed text-sm">
                  To become the leading educational platform for public schools in the Philippines — fostering a connected community where learning thrives through innovation, collaboration, and digital equity.
                </p>
              </div>
            </RevealItem>
          </div>

          {/* App preview widget */}
          <div className="lg:col-span-2">
            <RevealItem delay={0.2}>
              <div className="bg-white border border-gray-200 rounded-2xl p-5 text-gray-900 h-full shadow-xl">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-xs text-gray-500 ml-2 font-medium">ConnectEd Preview</span>
                </div>
                <div className="space-y-2.5">
                  {[
                    { icon: Shield, label: "Governance & Access", desc: "Role-based system control", color: "bg-green-50 text-green-600 border border-green-100" },
                    { icon: Calendar, label: "Scheduling", desc: "Weekly class structure", color: "bg-blue-50 text-blue-600 border border-blue-100" },
                    { icon: Bell, label: "Updates & Alerts", desc: "Real-time notifications", color: "bg-amber-50 text-amber-600 border border-amber-100" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{item.label}</p>
                          <p className="text-xs text-gray-600">{item.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-medium">ConnectEd v2.0</span>
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    </div>
                  </div>
                </div>
              </div>
            </RevealItem>
          </div>
        </div>
      </div>
    </section>
  );
}

export { AboutSection };

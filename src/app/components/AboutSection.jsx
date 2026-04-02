import { Target, Lightbulb, Globe, Users2, Award, Heart } from "lucide-react";
import { useScrollReveal } from "@/app/hooks/useAnimations";

const values = [
  { icon: Globe,  title: "Accessibility", desc: "Free for all public schools. No expensive licensing or hardware required." },
  { icon: Users2, title: "Collaboration",  desc: "Every role — students, teachers, admins — works in the same connected system." },
  { icon: Award,  title: "Excellence",    desc: "Reliable, secure, and thoughtfully designed for real classroom workflows." },
  { icon: Heart,  title: "Community",     desc: "Built with and for Dasmariñas public schools. Locally grounded, globally inspired." },
];

function RevealItem({ children, delay = 0, direction = "up" }) {
  const [ref, visible] = useScrollReveal();
  const fromY = direction === "up" ? "28px" : "-28px";
  return (
    <div
      ref={ref}
      style={{
        transition: `opacity 0.65s ease ${delay}s, transform 0.65s ease ${delay}s`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : `translateY(${fromY})`,
      }}
    >
      {children}
    </div>
  );
}

function AboutSection() {
  const [headerRef, headerVisible] = useScrollReveal();

  return (
    <section id="about" className="relative w-full bg-gray-950 py-24 px-6 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

      {/* Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

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
          <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-3">About ConnectEd</p>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Built for Filipino<br />
            <span className="text-gray-500">Public Schools</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            ConnectEd was created to bridge the technology gap in public education — giving students and teachers access to tools previously available only in private institutions.
          </p>
        </div>

        {/* Mission / Vision */}
        <div className="grid md:grid-cols-2 gap-5 mb-16">
          <RevealItem delay={0}>
            <div className="bg-gray-900/60 border border-white/8 rounded-3xl p-8 hover:border-emerald-500/25 transition-colors group h-full">
              <div className="w-11 h-11 bg-emerald-500/15 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-emerald-500/25 group-hover:scale-110 transition-all duration-300">
                <Target className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Our Mission</h3>
              <p className="text-gray-400 leading-relaxed">
                To bridge the gap between traditional education and modern technology in public schools across Dasmariñas, Cavite — making essential academic tools accessible to every student and teacher.
              </p>
            </div>
          </RevealItem>
          <RevealItem delay={0.12}>
            <div className="bg-gray-900/60 border border-white/8 rounded-3xl p-8 hover:border-emerald-500/25 transition-colors group h-full">
              <div className="w-11 h-11 bg-emerald-500/15 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-emerald-500/25 group-hover:scale-110 transition-all duration-300">
                <Lightbulb className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Our Vision</h3>
              <p className="text-gray-400 leading-relaxed">
                To become the leading educational platform for public schools in the Philippines — fostering a connected community where learning thrives through innovation, collaboration, and digital equity.
              </p>
            </div>
          </RevealItem>
        </div>

        {/* Core Values */}
        <div>
          <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-8 text-center">Core Values</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {values.map((v, i) => {
              const Icon = v.icon;
              return (
                <RevealItem key={v.title} delay={i * 0.1}>
                  <div className="bg-gray-900/50 border border-white/8 rounded-2xl p-6 hover:border-emerald-500/25 transition-all duration-300 group hover:shadow-lg hover:shadow-emerald-900/20 h-full">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 group-hover:scale-110 transition-all duration-300">
                      <Icon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h4 className="text-white font-bold mb-2">{v.title}</h4>
                    <p className="text-gray-400 text-sm leading-relaxed">{v.desc}</p>
                  </div>
                </RevealItem>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export { AboutSection };

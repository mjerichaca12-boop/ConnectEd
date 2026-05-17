import { Settings, BookOpen, GraduationCap } from "lucide-react";
import { useScrollReveal } from "@/app/hooks/useAnimations";

const steps = [
  { number: "01", icon: Settings, title: "Administrators configure", desc: "Set up school accounts, manage teacher access, configure subjects, and define the academic calendar." },
  { number: "02", icon: BookOpen, title: "Teachers manage", desc: "Create class sections, upload materials, record grades and attendance, and communicate with students." },
  { number: "03", icon: GraduationCap, title: "Students engage", desc: "Access assignments, view grades, read announcements, message teachers, and track their academic progress." },
];

function HowItWorks() {
  const [headerRef, headerVisible] = useScrollReveal();

  return (
    <section id="how-it-works" className="relative w-full bg-gray-50 py-8 px-6 overflow-hidden border-t border-gray-200">
      <div className="relative max-w-7xl mx-auto">
        <div ref={headerRef} className="text-center mb-10" style={{ transition: "opacity 0.7s ease, transform 0.7s ease", opacity: headerVisible ? 1 : 0, transform: headerVisible ? "translateY(0)" : "translateY(24px)" }}>
          <p className="text-green-600 text-xs font-bold uppercase tracking-widest mb-3">How It Works</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
            A structured workflow for{" "}<span className="text-gray-600">every stakeholder</span>
          </h2>
        </div>
        <div className="max-w-3xl mx-auto">
          {/* Steps */}
          <div className="space-y-4">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.number} className="group flex gap-4 bg-white border border-gray-200 hover:border-green-300 rounded-2xl p-5 transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-green-100/50">
                  <div className="flex flex-col items-center">
                    <div className="w-11 h-11 bg-green-600 rounded-xl flex items-center justify-center shadow-md shadow-green-600/20">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    {i < steps.length - 1 && <div className="w-px h-6 bg-green-200 mt-2" />}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">{step.number}</span>
                      <h3 className="text-base font-bold text-gray-900">{step.title}</h3>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export { HowItWorks };

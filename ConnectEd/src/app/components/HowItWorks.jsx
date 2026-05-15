import { Settings, BookOpen, GraduationCap, Calendar, Clock } from "lucide-react";
import { useScrollReveal } from "@/app/hooks/useAnimations";

const steps = [
  { number: "01", icon: Settings, title: "Administrators configure", desc: "Set up school accounts, manage teacher access, configure subjects, and define the academic calendar." },
  { number: "02", icon: BookOpen, title: "Teachers manage", desc: "Create class sections, upload materials, record grades and attendance, and communicate with students." },
  { number: "03", icon: GraduationCap, title: "Students engage", desc: "Access assignments, view grades, read announcements, message teachers, and track their academic progress." },
];

const scheduleMockup = [
  { time: "7:00 AM", subject: "Mathematics", color: "bg-green-50 border-green-200 text-green-700" },
  { time: "8:00 AM", subject: "Science", color: "bg-blue-50 border-blue-200 text-blue-700" },
  { time: "9:00 AM", subject: "English", color: "bg-amber-50 border-amber-200 text-amber-700" },
  { time: "10:00 AM", subject: "Filipino", color: "bg-purple-50 border-purple-200 text-purple-700" },
  { time: "11:00 AM", subject: "Social Studies", color: "bg-rose-50 border-rose-200 text-rose-700" },
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
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          {/* Steps */}
          <div className="space-y-4">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.number} className="group flex gap-4 bg-white border border-gray-200 hover:border-green-300 rounded-2xl p-5 transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-green-100/50">
                  <div className="flex flex-col items-center">
                    <div className="w-11 h-11 bg-green-600 rounded-xl flex items-center justify-center shadow-md shadow-green-600/20">
                      <Icon className="w-5 h-5 text-gray-900" />
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
          {/* Schedule mockup */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-5 h-5 text-green-600" />
              <h4 className="text-base font-bold text-gray-900">Weekly Class Schedule</h4>
            </div>
            <p className="text-xs text-gray-500 mb-4">Monday · Grade 7 — Section A</p>
            <div className="space-y-2">
              {scheduleMockup.map((slot) => (
                <div key={slot.time} className={`flex items-center gap-4 px-4 py-2.5 rounded-xl border ${slot.color}`}>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 opacity-60" />
                    <span className="text-xs font-semibold min-w-[70px]">{slot.time}</span>
                  </div>
                  <span className="text-sm font-medium">{slot.subject}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
              <span className="text-xs text-gray-500">5 subjects · 5 hours</span>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <div className="w-2 h-2 rounded-full bg-amber-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export { HowItWorks };

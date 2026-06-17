import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, BookOpen, Shield, ArrowRight, CheckCircle, Settings, Users, BarChart2, Calendar, MessageSquare, ClipboardCheck } from "lucide-react";
import { useScrollReveal } from "@/app/hooks/useAnimations";

const roles = [
  {
    key: "administrator",
    icon: Shield,
    title: "Administrator",
    subtitle: "Full control over school operations from a unified command center.",
    features: ["Manage teacher & student accounts", "Monitor all class activities and reports", "Generate school-wide analytics", "Broadcast announcements", "System access control & settings"],
    mockupFeatures: [{ icon: Users, label: "User Management" }, { icon: BarChart2, label: "Analytics Dashboard" }, { icon: Settings, label: "System Settings" }],
  },
  {
    key: "teacher",
    icon: BookOpen,
    title: "Teacher",
    subtitle: "Manage your classes, grades, and student interactions on the web.",
    features: ["Create & manage class sections", "Upload materials & assignments", "Record grades & track work", "Post class announcements", "Message students directly"],
    mockupFeatures: [{ icon: BookOpen, label: "Class Management" }, { icon: ClipboardCheck, label: "Grade Recording" }, { icon: ClipboardCheck, label: "Assignments" }],
  },
  {
    key: "student",
    icon: GraduationCap,
    title: "Student",
    subtitle: "Access your school on mobile — grades, assignments, and more.",
    features: ["View grades and academic records", "Submit assignments & activities", "Read class announcements", "Message teachers directly", "Track academic progress"],
    mockupFeatures: [{ icon: GraduationCap, label: "Academic Records" }, { icon: MessageSquare, label: "Teacher Chat" }, { icon: BookOpen, label: "Subjects" }],
  },
];

function UserRoles() {
  const navigate = useNavigate();
  const [headerRef, headerVisible] = useScrollReveal();
  const [activeTab, setActiveTab] = useState("administrator");
  const activeRole = roles.find((r) => r.key === activeTab);

  return (
    <section id="roles" className="relative w-full bg-white py-8 px-6 overflow-hidden border-t border-gray-200">
      <div className="max-w-7xl mx-auto">
        <div ref={headerRef} className="text-center mb-8" style={{ transition: "opacity 0.7s ease, transform 0.7s ease", opacity: headerVisible ? 1 : 0, transform: headerVisible ? "translateY(0)" : "translateY(24px)" }}>
          <p className="text-green-600 text-xs font-bold uppercase tracking-widest mb-3">Role-Based Solutions</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
            Built for every member of{" "}<span className="text-gray-600">your institution</span>
          </h2>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            {roles.map((role) => {
              const Icon = role.icon;
              return (
                <button key={role.key} onClick={() => setActiveTab(role.key)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer
                    ${activeTab === role.key ? "bg-green-600 text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`}>
                  <Icon className="w-4 h-4" />
                  {role.title}
                </button>
              );
            })}
          </div>
        </div>

        {activeRole && (
          <div className="grid md:grid-cols-2 gap-6 items-start">
            {/* Features */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center">
                  <activeRole.icon className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{activeRole.title}</h3>
                  <p className="text-gray-600 text-sm">{activeRole.subtitle}</p>
                </div>
              </div>
              <ul className="space-y-2.5 mb-6">
                {activeRole.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              {activeRole.cta ? (
                <button onClick={() => navigate(activeRole.cta)} className="group w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm bg-green-600 hover:bg-green-700 text-gray-900 transition-all duration-200 shadow-md shadow-green-600/20">
                  {activeRole.ctaLabel}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : activeRole.key === "student" ? (
                <div className="w-full text-center py-3 px-6 rounded-xl text-sm font-medium text-gray-500 bg-gray-50 border border-gray-200">📱 Available on the Mobile App</div>
              ) : null}
            </div>

            {/* Mockup */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-xs text-gray-500 ml-2 font-medium">ConnectEd — {activeRole.title} Portal</span>
                </div>
                <div className="space-y-3">
                  {activeRole.mockupFeatures.map((mf) => {
                    const MfIcon = mf.icon;
                    return (
                      <div key={mf.label} className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 border border-gray-200 shadow-sm">
                        <div className="w-8 h-8 bg-green-50 border border-green-100 rounded-lg flex items-center justify-center">
                          <MfIcon className="w-4 h-4 text-green-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">{mf.label}</span>
                        <div className="ml-auto w-16 h-2 bg-green-100 rounded-full" />
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export { UserRoles };

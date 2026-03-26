import { BookCheck, Settings, MessageSquare } from "lucide-react";
function CoreModules() {
  const modules = [
    {
      title: "Academic Hub",
      description: "Access grades, track attendance, and manage assignments all in one place",
      features: ["Grade Tracking", "Attendance Records", "Assignment Submission"],
      Icon: BookCheck,
      color: "blue"
      // DepEd blue
    },
    {
      title: "Admin Console",
      description: "Streamline administrative tasks with powerful tools for enrollment, records, and school-wide communications",
      features: ["Student Enrollment", "Academic Records", "School Announcements", "Report Generation"],
      Icon: Settings,
      color: "red"
      // DepEd red
    },
    {
      title: "Connect Hub",
      description: "Stay connected with secure messaging, real-time notifications, and a community bulletin board",
      features: ["Secure Messaging", "Push Notifications", "Bulletin Board", "Event Calendar"],
      Icon: MessageSquare,
      color: "emerald"
      // Main green
    }
  ];
  const getAccentColor = (color) => {
    switch (color) {
      case "blue":
        return {
          iconBg: "bg-blue-100",
          iconInner: "bg-blue-600",
          dot: "bg-blue-600",
          gradient: "from-blue-500/10 to-transparent",
          border: "border-blue-200",
          hoverShadow: "hover:shadow-blue-200/50"
        };
      case "red":
        return {
          iconBg: "bg-red-100",
          iconInner: "bg-red-600",
          dot: "bg-red-600",
          gradient: "from-red-500/10 to-transparent",
          border: "border-red-200",
          hoverShadow: "hover:shadow-red-200/50"
        };
      default:
        return {
          iconBg: "bg-emerald-100",
          iconInner: "bg-emerald-600",
          dot: "bg-emerald-600",
          gradient: "from-emerald-500/10 to-transparent",
          border: "border-emerald-200",
          hoverShadow: "hover:shadow-emerald-200/50"
        };
    }
  };
  return <section id="features" className="relative w-full max-w-full bg-gradient-to-b from-gray-50 to-white py-20 px-4 sm:px-6 overflow-hidden">
      {
    /* Background Decoration */
  }
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-100/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-100/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full mb-6 border border-emerald-200">
            <span className="text-sm font-medium">Comprehensive Tools</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Core System Modules
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Comprehensive tools designed to support every aspect of school life
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {modules.map((module, index) => {
    const colors = getAccentColor(module.color);
    const Icon = module.Icon;
    return <div
      key={index}
      className={`group relative bg-white rounded-2xl shadow-lg p-8 hover:shadow-2xl ${colors.hoverShadow} transition-all duration-300 border-2 ${colors.border} transform hover:-translate-y-2`}
    >
                {
      /* Background gradient decoration */
    }
                <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity`} />
                
                <div className="relative">
                  {
      /* Icon with pulse effect */
    }
                  <div className={`w-16 h-16 ${colors.iconBg} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-md`}>
                    <Icon className={`w-8 h-8 ${colors.iconInner.replace("bg-", "text-")}`} />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    {module.title}
                  </h3>
                  
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    {module.description}
                  </p>
                  
                  <ul className="space-y-3">
                    {module.features.map((feature, idx) => <li key={idx} className="flex items-center gap-3 text-gray-700">
                        <div className={`w-2 h-2 ${colors.dot} rounded-full group-hover:scale-150 transition-transform`} />
                        <span className="text-sm">{feature}</span>
                      </li>)}
                  </ul>
                </div>

                {
      /* Corner decoration */
    }
                <div className={`absolute top-4 right-4 w-20 h-20 bg-gradient-to-br ${colors.gradient} rounded-full opacity-0 group-hover:opacity-30 transition-opacity blur-2xl`} />
              </div>;
  })}
        </div>

        {
    /* Bottom CTA Banner */
  }
        <div className="mt-16 bg-gradient-to-r from-emerald-600 via-emerald-500 to-blue-600 rounded-2xl p-8 md:p-12 text-center relative overflow-hidden">
          {
    /* Background Pattern */
  }
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff14_1px,transparent_1px),linear-gradient(to_bottom,#ffffff14_1px,transparent_1px)] bg-[size:3rem_3rem]" />
          
          <div className="relative">
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Transform Your School?
            </h3>
            <p className="text-emerald-50 text-lg mb-8 max-w-2xl mx-auto">
              Join the growing community of schools using ConnectEd to enhance learning experiences
            </p>
            <button
    onClick={() => window.location.href = "/signup"}
    className="bg-white text-emerald-600 px-8 py-4 rounded-lg font-medium hover:bg-gray-50 transition-all shadow-lg hover:shadow-xl hover:scale-105 text-lg"
  >
              Start Your Journey
            </button>
          </div>
        </div>
      </div>
    </section>;
}
export {
  CoreModules
};

import { GraduationCap, BookOpen, Shield, CheckCircle } from "lucide-react";
function UserRoles() {
  const roles = [
    {
      title: "Student",
      description: "Access your grades, attendance, assignments, and communicate with teachers. Stay organized with your personalized academic dashboard.",
      Icon: GraduationCap,
      color: "blue",
      // DepEd blue
      features: ["Grade Tracking", "Assignment Submission", "Real-time Notifications"]
    },
    {
      title: "Teacher",
      description: "Manage classes, submit grades, track attendance, and communicate with students and parents. Streamline your teaching workflow.",
      Icon: BookOpen,
      color: "emerald",
      // Main green
      features: ["Class Management", "Grade Recording", "Student Analytics"]
    },
    {
      title: "Administrator",
      description: "Oversee school operations, manage enrollments, generate reports, and broadcast announcements. Complete administrative control.",
      Icon: Shield,
      color: "red",
      // DepEd red
      features: ["Enrollment Management", "Report Generation", "System-wide Control"]
    }
  ];
  const getColorClasses = (color) => {
    switch (color) {
      case "blue":
        return {
          bg: "bg-gradient-to-br from-blue-50 via-white to-blue-50/30",
          border: "border-blue-200",
          iconBg: "bg-gradient-to-br from-blue-100 to-blue-200",
          iconColor: "text-blue-600",
          hoverBorder: "hover:border-blue-400",
          accentDot: "bg-blue-600",
          glow: "group-hover:shadow-blue-200/30"
        };
      case "red":
        return {
          bg: "bg-gradient-to-br from-red-50 via-white to-red-50/30",
          border: "border-red-200",
          iconBg: "bg-gradient-to-br from-red-100 to-red-200",
          iconColor: "text-red-600",
          hoverBorder: "hover:border-red-400",
          accentDot: "bg-red-600",
          glow: "group-hover:shadow-red-200/30"
        };
      default:
        return {
          bg: "bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30",
          border: "border-emerald-200",
          iconBg: "bg-gradient-to-br from-emerald-100 to-emerald-200",
          iconColor: "text-emerald-600",
          hoverBorder: "hover:border-emerald-400",
          accentDot: "bg-emerald-600",
          glow: "group-hover:shadow-emerald-200/30"
        };
    }
  };
  return <section id="roles" className="relative w-full max-w-full bg-gradient-to-b from-gray-50 to-white py-20 px-4 sm:px-6 overflow-hidden">
      {
    /* Background decoration */
  }
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 right-1/4 w-80 h-80 bg-red-100/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/4 w-80 h-80 bg-emerald-100/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-full mb-6 border border-red-200">
            <span className="text-sm font-medium">Role-Based Access</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Designed for Every Role
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Tailored experiences for students, teachers, and administrators
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {roles.map((role, index) => {
    const colors = getColorClasses(role.color);
    const Icon = role.Icon;
    return <div
      key={index}
      className={`group relative ${colors.bg} border-2 ${colors.border} ${colors.hoverBorder} rounded-2xl p-8 hover:shadow-2xl ${colors.glow} transition-all duration-300 transform hover:-translate-y-2 overflow-hidden`}
    >
                {
      /* Decorative corner element */
    }
                <div className="absolute -top-12 -right-12 w-40 h-40 bg-gradient-to-br from-white/50 to-transparent rounded-full" />
                
                <div className="relative">
                  {
      /* Icon with animated shadow */
    }
                  <div className={`w-20 h-20 ${colors.iconBg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg`}>
                    <Icon className={`w-10 h-10 ${colors.iconColor}`} />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    {role.title}
                  </h3>
                  
                  <p className="text-gray-600 leading-relaxed mb-6">
                    {role.description}
                  </p>

                  {
      /* Feature list */
    }
                  <div className="space-y-2">
                    {role.features.map((feature, idx) => <div key={idx} className="flex items-center gap-2">
                        <CheckCircle className={`w-4 h-4 ${colors.iconColor}`} />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </div>)}
                  </div>
                </div>

                {
      /* Bottom accent line */
    }
                <div className={`absolute bottom-0 left-0 right-0 h-1 ${colors.accentDot} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300`} />
              </div>;
  })}
        </div>
      </div>
    </section>;
}
export {
  UserRoles
};

import { BookOpen, Users, TrendingUp, Shield, School, GraduationCap, UserCheck, Zap } from 'lucide-react';

export function HowItWorks() {
  const features = [
    {
      icon: BookOpen,
      title: 'Comprehensive Academic Management',
      description: 'Track grades, attendance, and assignments in real-time. Access all academic information from a single, unified platform.',
      color: 'blue'
    },
    {
      icon: Users,
      title: 'Seamless Communication',
      description: 'Connect students, teachers, and administrators through secure messaging, announcements, and instant notifications.',
      color: 'emerald'
    },
    {
      icon: TrendingUp,
      title: 'Data-Driven Insights',
      description: 'Generate detailed reports and analytics to monitor performance, identify trends, and make informed decisions.',
      color: 'blue'
    },
    {
      icon: Shield,
      title: 'Secure & Reliable',
      description: 'Built with enterprise-grade security to protect sensitive educational data and ensure privacy compliance.',
      color: 'red'
    }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-50',
          iconBg: 'bg-gradient-to-br from-blue-100 to-blue-200',
          iconColor: 'text-blue-600',
          border: 'hover:border-blue-500',
          glow: 'group-hover:shadow-blue-200/50'
        };
      case 'red':
        return {
          bg: 'bg-red-50',
          iconBg: 'bg-gradient-to-br from-red-100 to-red-200',
          iconColor: 'text-red-600',
          border: 'hover:border-red-500',
          glow: 'group-hover:shadow-red-200/50'
        };
      default:
        return {
          bg: 'bg-emerald-50',
          iconBg: 'bg-gradient-to-br from-emerald-100 to-emerald-200',
          iconColor: 'text-emerald-600',
          border: 'hover:border-emerald-500',
          glow: 'group-hover:shadow-emerald-200/50'
        };
    }
  };

  return (
    <section id="how-it-works" className="relative w-full max-w-full bg-white py-20 px-4 sm:px-6 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.05),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.05),transparent_50%)]"></div>
      
      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full mb-6 border border-blue-200">
            <span className="text-sm font-medium">Why Choose Us</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Why Choose ConnectEd?
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            A complete educational ecosystem designed for modern schools in Dasmariñas, Cavite
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {features.map((feature, index) => {
            const colors = getColorClasses(feature.color);
            const Icon = feature.icon;
            
            return (
              <div 
                key={index}
                className={`group bg-white border-2 border-gray-200 rounded-2xl p-8 ${colors.border} ${colors.glow} hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden`}
              >
                {/* Background gradient on hover */}
                <div className={`absolute inset-0 ${colors.bg} opacity-0 group-hover:opacity-30 transition-opacity rounded-2xl`}></div>
                
                <div className="relative">
                  <div className={`w-16 h-16 ${colors.iconBg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg`}>
                    <Icon className={`w-8 h-8 ${colors.iconColor}`} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                {/* Corner accent */}
                <div className={`absolute -top-10 -right-10 w-40 h-40 ${colors.bg} rounded-full opacity-0 group-hover:opacity-50 transition-opacity blur-2xl`}></div>
              </div>
            );
          })}
        </div>

        {/* Enhanced Stats Section with visual cards */}
        <div className="relative">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-50 via-blue-50 to-red-50 rounded-3xl transform -rotate-1"></div>
          
          <div className="relative bg-white rounded-3xl shadow-xl p-8 md:p-12 border-2 border-gray-100">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-8">
              Trusted by Schools Across Dasmariñas
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { value: '5+', label: 'Partner Schools', color: 'emerald', icon: School },
                { value: '1000+', label: 'Active Students', color: 'blue', icon: GraduationCap },
                { value: '50+', label: 'Teachers', color: 'blue', icon: UserCheck },
                { value: '99.9%', label: 'Uptime', color: 'red', icon: Zap }
              ].map((stat, index) => {
                const Icon = stat.icon;
                const iconBgClass = stat.color === 'emerald' ? 'bg-emerald-100' :
                                   stat.color === 'blue' ? 'bg-blue-100' :
                                   'bg-red-100';
                const iconColorClass = stat.color === 'emerald' ? 'text-emerald-600' :
                                      stat.color === 'blue' ? 'text-blue-600' :
                                      'text-red-600';
                
                return (
                  <div 
                    key={index}
                    className="group text-center p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-white border-2 border-gray-100 hover:border-gray-300 hover:shadow-lg transition-all transform hover:-translate-y-1"
                  >
                    <div className={`w-16 h-16 ${iconBgClass} rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform shadow-md`}>
                      <Icon className={`w-8 h-8 ${iconColorClass}`} />
                    </div>
                    <div className={`text-3xl md:text-4xl font-bold mb-2 ${
                      stat.color === 'emerald' ? 'text-emerald-600' :
                      stat.color === 'blue' ? 'text-blue-600' :
                      'text-red-600'
                    }`}>
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-600 font-medium">{stat.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Bottom testimonial-style text */}
            <div className="mt-10 text-center">
              <p className="text-gray-600 italic max-w-2xl mx-auto">
                "ConnectEd has streamlined our school operations and improved communication between teachers, students, and parents significantly."
              </p>
              <p className="text-sm text-gray-500 mt-2">— School Administrator, Dasmariñas National High School</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
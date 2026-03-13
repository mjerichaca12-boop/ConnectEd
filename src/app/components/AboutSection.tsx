import { Target, Heart, Lightbulb, Globe, Award, Users2, School, GraduationCap, BookOpen, Zap } from 'lucide-react';

export function AboutSection() {
  return (
    <section id="about" className="relative w-full max-w-full bg-white py-20 px-4 sm:px-6 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_30%,rgba(16,185,129,0.03),transparent_50%),radial-gradient(circle_at_80%_70%,rgba(59,130,246,0.03),transparent_50%)]"></div>
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-emerald-100/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-1/4 w-96 h-96 bg-blue-100/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full mb-6 border border-emerald-200">
            <Heart className="w-4 h-4" />
            <span className="text-sm font-medium">Our Mission & Vision</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            About ConnectEd
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Empowering education through innovative technology and seamless connectivity
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          {/* Left: Story */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-8 border-2 border-emerald-100 shadow-lg">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <Target className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                ConnectEd was born from a simple yet powerful vision: to bridge the gap between traditional education and modern technology in public schools across Dasmariñas, Cavite.
              </p>
              <p className="text-gray-600 leading-relaxed">
                We believe that every student, teacher, and administrator deserves access to tools that make learning, teaching, and managing educational processes easier, more efficient, and more engaging.
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-8 border-2 border-blue-100 shadow-lg">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4">
                <Lightbulb className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Our Vision</h3>
              <p className="text-gray-600 leading-relaxed">
                To become the leading educational technology platform for public schools in the Philippines, fostering a connected community where education thrives through innovation, collaboration, and accessibility.
              </p>
            </div>
          </div>

          {/* Right: Values */}
          <div>
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 border-2 border-gray-200 shadow-lg h-full">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Our Core Values</h3>
              
              <div className="space-y-5">
                {[
                  {
                    icon: Globe,
                    title: 'Accessibility',
                    description: 'Making quality educational tools available to all public schools, regardless of resources.',
                    color: 'emerald'
                  },
                  {
                    icon: Users2,
                    title: 'Collaboration',
                    description: 'Fostering meaningful connections between students, teachers, and administrators.',
                    color: 'blue'
                  },
                  {
                    icon: Award,
                    title: 'Excellence',
                    description: 'Delivering reliable, secure, and high-quality solutions for educational success.',
                    color: 'red'
                  },
                  {
                    icon: Heart,
                    title: 'Community',
                    description: 'Building a supportive ecosystem where every voice matters and everyone grows together.',
                    color: 'emerald'
                  }
                ].map((value, index) => {
                  const Icon = value.icon;
                  const iconColorClass = value.color === 'blue' ? 'text-blue-600 bg-blue-100' : 
                                        value.color === 'red' ? 'text-red-600 bg-red-100' : 
                                        'text-emerald-600 bg-emerald-100';
                  
                  return (
                    <div key={index} className="flex gap-4 group">
                      <div className={`flex-shrink-0 w-12 h-12 ${iconColorClass} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 mb-1">{value.title}</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">{value.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Impact Stats */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-blue-600 to-red-600 rounded-3xl transform rotate-1"></div>
          <div className="relative bg-white rounded-3xl shadow-2xl p-8 md:p-12 border-2 border-gray-100">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-8">
              Our Impact on Education
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { 
                  value: '5+', 
                  label: 'Partner Schools', 
                  sublabel: 'Across Dasmariñas',
                  icon: School,
                  color: 'emerald'
                },
                { 
                  value: '1000+', 
                  label: 'Active Students', 
                  sublabel: 'Learning Daily',
                  icon: GraduationCap,
                  color: 'blue'
                },
                { 
                  value: '50+', 
                  label: 'Educators', 
                  sublabel: 'Teaching Excellence',
                  icon: BookOpen,
                  color: 'blue'
                },
                { 
                  value: '10K+', 
                  label: 'Tasks Completed', 
                  sublabel: 'This School Year',
                  icon: Zap,
                  color: 'red'
                }
              ].map((stat, index) => {
                const Icon = stat.icon;
                const bgColorClass = stat.color === 'blue' ? 'bg-blue-100' : 
                                    stat.color === 'red' ? 'bg-red-100' : 
                                    'bg-emerald-100';
                const textColorClass = stat.color === 'blue' ? 'text-blue-600' : 
                                      stat.color === 'red' ? 'text-red-600' : 
                                      'text-emerald-600';
                
                return (
                  <div key={index} className="text-center group">
                    <div className={`w-16 h-16 ${bgColorClass} rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-md`}>
                      <Icon className={`w-8 h-8 ${textColorClass}`} />
                    </div>
                    <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent group-hover:scale-110 transition-transform inline-block mb-2">
                      {stat.value}
                    </div>
                    <div className="font-semibold text-gray-900 mb-1">{stat.label}</div>
                    <div className="text-sm text-gray-500">{stat.sublabel}</div>
                  </div>
                );
              })}
            </div>

            {/* Quote */}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <blockquote className="text-center">
                <p className="text-lg text-gray-700 italic mb-4 max-w-3xl mx-auto">
                  "ConnectEd is more than just a platform—it's a movement towards modernizing public education, making it more accessible, efficient, and connected for everyone in our community."
                </p>
                <footer className="text-sm text-gray-600 font-medium">
                  — The ConnectEd Team
                </footer>
              </blockquote>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
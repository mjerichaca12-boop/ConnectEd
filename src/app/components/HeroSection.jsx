import { useNavigate } from "react-router-dom";
import { GraduationCap, Users, BookOpen, Award, TrendingUp, Sparkles } from "lucide-react";
function HeroSection() {
  const navigate = useNavigate();
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const handleCreateAccount = () => {
    navigate("/signup");
  };
  return <section id="hero" className="relative w-full max-w-full bg-gradient-to-br from-emerald-50 via-white to-blue-50 py-20 sm:py-32 px-4 sm:px-6 overflow-hidden">
      {
    /* Decorative Background Elements */
  }
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {
    /* Floating Circles */
  }
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-200/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-emerald-100/10 to-blue-100/10 rounded-full blur-3xl" />
        
        {
    /* Grid Pattern */
  }
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b98114_1px,transparent_1px),linear-gradient(to_bottom,#10b98114_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          {
    /* Left Content */
  }
          <div className="flex-1 text-center lg:text-left">
            {
    /* Badge */
  }
            <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full mb-6 border border-emerald-200">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Empowering Education in Dasmariñas</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              One Portal.<br />
              One School.<br />
              <span className="text-emerald-600">Connected Education.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-600 mb-10 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              A unified academic and communication platform designed specifically for public schools. 
              Connect students, teachers, and administrators in one seamless, accessible portal.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
              <button
    onClick={handleCreateAccount}
    className="bg-emerald-600 text-white px-8 py-4 rounded-lg font-medium hover:bg-emerald-700 transition-all hover:scale-105 shadow-lg hover:shadow-xl text-lg flex items-center justify-center gap-2 cursor-pointer"
  >
                <GraduationCap className="w-5 h-5" />
                Get Started Free
              </button>
              <button
    onClick={() => scrollToSection("how-it-works")}
    className="bg-white text-emerald-600 border-2 border-emerald-600 px-8 py-4 rounded-lg font-medium hover:bg-emerald-50 transition-all text-lg cursor-pointer"
  >
                Learn More
              </button>
            </div>

            {
    /* Quick Stats */
  }
            <div className="flex flex-wrap justify-center lg:justify-start gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-600 rounded-full" />
                <span>5+ Schools</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full" />
                <span>1000+ Students</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-600 rounded-full" />
                <span>99.9% Uptime</span>
              </div>
            </div>
          </div>

          {
    /* Right Visual Element */
  }
          <div className="flex-1 relative">
            <div className="relative max-w-lg mx-auto">
              {
    /* Main Card with floating effect */
  }
              <div className="relative bg-white rounded-2xl shadow-2xl p-8 border-2 border-emerald-100">
                {
    /* Header */
  }
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-lg">ConnectEd Portal</div>
                    <div className="text-sm text-gray-500">All-in-One Platform</div>
                  </div>
                </div>

                {
    /* Feature Cards */
  }
                <div className="space-y-3">
                  {[
    { icon: BookOpen, label: "Academic Management", color: "blue" },
    { icon: Users, label: "Real-time Communication", color: "emerald" },
    { icon: TrendingUp, label: "Performance Tracking", color: "blue" },
    { icon: Award, label: "Smart Analytics", color: "red" }
  ].map((item, index) => {
    const Icon = item.icon;
    return <div
      key={index}
      className={`flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r ${item.color === "blue" ? "from-blue-50 to-blue-50/50 border border-blue-100" : item.color === "red" ? "from-red-50 to-red-50/50 border border-red-100" : "from-emerald-50 to-emerald-50/50 border border-emerald-100"} hover:shadow-md transition-all cursor-pointer transform hover:-translate-y-0.5`}
      style={{
        animation: `float ${3 + index * 0.5}s ease-in-out infinite`,
        animationDelay: `${index * 0.2}s`
      }}
    >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.color === "blue" ? "bg-blue-100" : item.color === "red" ? "bg-red-100" : "bg-emerald-100"}`}>
                          <Icon className={`w-5 h-5 ${item.color === "blue" ? "text-blue-600" : item.color === "red" ? "text-red-600" : "text-emerald-600"}`} />
                        </div>
                        <span className="font-medium text-gray-700 text-sm">{item.label}</span>
                      </div>;
  })}
                </div>

                {
    /* Bottom Badge */
  }
                <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Trusted by public schools</span>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-600" />)}
                  </div>
                </div>
              </div>

              {
    /* Floating Elements */
  }
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl opacity-20 blur-xl animate-pulse" />
              <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl opacity-20 blur-xl animate-pulse delay-1000" />
            </div>
          </div>
        </div>
      </div>

      {
    /* CSS for animations */
  }
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .delay-1000 {
          animation-delay: 1s;
        }
      `}</style>
    </section>;
}
export {
  HeroSection
};

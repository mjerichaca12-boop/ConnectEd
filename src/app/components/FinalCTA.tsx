import { useNavigate } from 'react-router-dom';
import { ArrowRight, Star, Users, CheckCircle2 } from 'lucide-react';

export function FinalCTA() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/signup');
  };

  return (
    <section className="relative w-full max-w-full bg-gradient-to-br from-emerald-600 via-emerald-500 to-blue-600 py-20 px-4 sm:px-6 overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff14_1px,transparent_1px),linear-gradient(to_bottom,#ffffff14_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
      
      {/* Floating orbs */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

      <div className="relative max-w-6xl mx-auto">
        <div className="text-center mb-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full mb-6 border border-white/30">
            <Star className="w-4 h-4 fill-current" />
            <span className="text-sm font-medium">Join Our Growing Community</span>
          </div>

          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Ready to Transform Your<br />School Experience?
          </h2>
          
          <p className="text-xl text-white/90 mb-10 leading-relaxed max-w-3xl mx-auto">
            Join thousands of students, teachers, and administrators already using ConnectEd to enhance education
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button 
              onClick={handleGetStarted}
              className="group bg-white text-emerald-600 px-10 py-5 rounded-xl font-bold text-lg hover:bg-gray-50 transition-all shadow-2xl hover:shadow-3xl hover:scale-105 flex items-center justify-center gap-2"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={() => window.location.href = '/login'}
              className="bg-white/10 backdrop-blur-sm text-white border-2 border-white/30 px-10 py-5 rounded-xl font-bold text-lg hover:bg-white/20 transition-all"
            >
              Sign In
            </button>
          </div>

          {/* Trust indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { icon: Users, label: 'Used by 1000+ Students' },
              { icon: CheckCircle2, label: '99.9% Uptime Guarantee' },
              { icon: Star, label: 'Trusted by 5+ Schools' }
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div 
                  key={index}
                  className="flex items-center justify-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4 border border-white/20"
                >
                  <Icon className="w-5 h-5 text-white" />
                  <span className="text-sm text-white font-medium">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom section with schools */}
        <div className="mt-16 pt-8 border-t border-white/20 text-center">
          <p className="text-white/80 text-sm mb-4">Proudly serving public schools in Dasmariñas, Cavite</p>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-white/60">
            <span>Dasmariñas National High School</span>
            <span>•</span>
            <span>Salitran NHS</span>
            <span>•</span>
            <span>Emmanuel Bergado NHS</span>
            <span>•</span>
            <span>And more...</span>
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        .delay-1000 {
          animation-delay: 1s;
        }
      `}</style>
    </section>
  );
}
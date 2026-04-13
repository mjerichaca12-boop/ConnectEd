import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

function FinalCTA() {
  const navigate = useNavigate();

  return (
    <section className="relative w-full bg-gray-950 py-24 px-6 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[300px] bg-emerald-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto text-center">
        <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-4">Get Started Today</p>

        <h2 className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-6 tracking-tight">
          Ready to modernize<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
            your school?
          </span>
        </h2>

        <p className="text-gray-400 text-xl mb-10 max-w-2xl mx-auto">
          Join the public schools in Dasmariñas already using ConnectEd. Free to use, simple to set up.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <button
            onClick={() => navigate("/login")}
            className="group flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-10 py-4 rounded-xl transition-all shadow-xl shadow-emerald-500/20 text-base"
          >
            Login to Portal
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </section>
  );
}

export { FinalCTA };

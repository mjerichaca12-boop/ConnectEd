import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

function FinalCTA() {
  const navigate = useNavigate();

  return (
    <section className="relative w-full bg-white py-8 px-6 overflow-hidden border-t border-gray-200">
      {/* Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[250px] bg-green-100/60 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-4xl mx-auto text-center">
        <p className="text-green-600 text-xs font-bold uppercase tracking-widest mb-4">Get Started Today</p>

        <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-4 tracking-tight">
          Ready to modernize<br />
          <span className="text-green-600">your school?</span>
        </h2>

        <p className="text-gray-600 text-lg mb-8 max-w-2xl mx-auto">
          Join the public schools in Dasmariñas already using ConnectEd. Free to use, simple to set up.
        </p>

        <button
          onClick={() => navigate("/login")}
          className="group inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-gray-900 font-semibold px-8 py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-green-600/20 text-sm"
        >
          Login to Portal
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </section>
  );
}

export { FinalCTA };

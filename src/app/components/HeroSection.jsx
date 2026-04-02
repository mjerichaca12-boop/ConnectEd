import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useTypewriter } from "@/app/hooks/useAnimations";

/* Seeded particles so they don't re-randomize on each render */
const PARTICLES = [
  { id:0,  size:2.1, x:8,  y:15, delay:0,   dur:14, op:0.18 },
  { id:1,  size:1.6, x:18, y:72, delay:2,   dur:11, op:0.12 },
  { id:2,  size:2.8, x:28, y:38, delay:4,   dur:16, op:0.20 },
  { id:3,  size:1.4, x:42, y:88, delay:1.5, dur:13, op:0.10 },
  { id:4,  size:2.3, x:55, y:22, delay:3,   dur:15, op:0.15 },
  { id:5,  size:1.8, x:63, y:62, delay:0.8, dur:12, op:0.14 },
  { id:6,  size:3.0, x:74, y:45, delay:5,   dur:17, op:0.22 },
  { id:7,  size:1.5, x:82, y:80, delay:2.5, dur:10, op:0.11 },
  { id:8,  size:2.5, x:90, y:10, delay:1,   dur:18, op:0.17 },
  { id:9,  size:1.9, x:96, y:55, delay:3.7, dur:13, op:0.13 },
  { id:10, size:2.2, x:5,  y:90, delay:6,   dur:11, op:0.16 },
  { id:11, size:1.3, x:35, y:6,  delay:0.5, dur:14, op:0.09 },
  { id:12, size:2.7, x:50, y:50, delay:4.2, dur:16, op:0.19 },
  { id:13, size:1.7, x:70, y:95, delay:2.8, dur:12, op:0.12 },
  { id:14, size:2.0, x:88, y:30, delay:1.3, dur:15, op:0.14 },
];

function HeroSection() {
  const navigate = useNavigate();
  const typed = useTypewriter(
    ["Fully Connected.", "Built for DepEd.", "Built for Teachers.", "Free to Use."],
    { speed: 75, deleteSpeed: 42, pause: 2200 }
  );

  return (
    <section id="hero" className="relative w-full bg-gray-950 min-h-screen flex flex-col justify-center items-center overflow-hidden">

      {/* Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />

      {/* Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {PARTICLES.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full bg-emerald-400"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              left: `${p.x}%`,
              top: `${p.y}%`,
              opacity: p.op,
              animation: `particleDrift ${p.dur}s ease-in-out ${p.delay}s infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* Glow blobs */}
      <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-emerald-600/8 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-400/6 rounded-full blur-[120px] pointer-events-none" />

      {/* Content — centered */}
      <div className="relative max-w-4xl mx-auto px-6 py-24 text-center">

        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-10 tracking-wide uppercase relative overflow-hidden group"
          style={{ animation: "fadeSlideDown 0.8s ease-out both" }}
        >
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          Designed for Public Schools · Dasmariñas, Cavite
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* Headline */}
        <h1
          className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-white leading-[1.05] tracking-tight mb-6"
          style={{ animation: "fadeSlideUp 0.9s ease-out 0.15s both" }}
        >
          One Portal.<br />
          Every Role.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-300">
            {typed}
            <span className="inline-block w-[4px] h-[0.82em] bg-emerald-400 ml-1 align-middle animate-[blink_0.9s_step-end_infinite]" />
          </span>
        </h1>

        {/* Subtext */}
        <p
          className="text-gray-400 text-lg md:text-xl leading-relaxed mb-12 max-w-2xl mx-auto"
          style={{ animation: "fadeSlideUp 0.9s ease-out 0.3s both" }}
        >
          ConnectEd unifies classroom management, grading, attendance, announcements,
          and messaging — built specifically for DepEd public schools.
        </p>

        {/* CTAs */}
        <div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          style={{ animation: "fadeSlideUp 0.9s ease-out 0.45s both" }}
        >
          <button
            onClick={() => navigate("/login")}
            className="group relative flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-10 py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/25 text-base overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              Sign In to Portal
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
            <span className="absolute inset-0 bg-white/10 scale-0 group-hover:scale-100 rounded-xl transition-transform duration-500 origin-center" />
          </button>
        </div>

        {/* Scroll hint */}
        <div
          className="mt-20 flex flex-col items-center gap-2 text-gray-600 text-xs"
          style={{ animation: "fadeSlideUp 1s ease-out 0.8s both" }}
        >
          <div className="w-5 h-9 border-2 border-gray-700 rounded-full flex justify-center pt-1.5">
            <div className="w-1 h-2.5 bg-emerald-400/60 rounded-full animate-[scrollDot_1.8s_ease-in-out_infinite]" />
          </div>
          <span>Scroll to explore</span>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none" />

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes particleDrift {
          0%   { transform: translate(0, 0); }
          100% { transform: translate(18px, -24px); }
        }
        @keyframes scrollDot {
          0%, 100% { transform: translateY(0); opacity: 1; }
          80%       { transform: translateY(10px); opacity: 0; }
        }
      `}</style>
    </section>
  );
}

export { HeroSection };

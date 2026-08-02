import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Navigation } from "@/app/components/Navigation";
import { HeroSection } from "@/app/components/HeroSection";
import { AboutSection } from "@/app/components/AboutSection";
import { HowItWorks } from "@/app/components/HowItWorks";
import { CoreModules } from "@/app/components/CoreModules";
import { UserRoles } from "@/app/components/UserRoles";
import { FinalCTA } from "@/app/components/FinalCTA";
import { Footer } from "@/app/components/Footer";

function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      if (params.get("error")) {
        const errorDesc = params.get("error_description")?.replace(/\+/g, " ");
        if (errorDesc) {
          toast.error("Verification failed: " + errorDesc, { duration: 10000 });
        }
      } else if (params.get("type") === "email_change") {
        toast.success("Email verified successfully! You can now log in with your new password.", { duration: 8000 });
        navigate("/login");
      }
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div className="w-screen max-w-full overflow-x-hidden">
        <HeroSection />
        <CoreModules />
        <HowItWorks />
        <UserRoles />
        <AboutSection />
        <FinalCTA />
        <Footer />
      </div>
    </div>
  );
}

export { LandingPage };

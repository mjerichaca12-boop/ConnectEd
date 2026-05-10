import { Navigation } from "@/app/components/Navigation";
import { HeroSection } from "@/app/components/HeroSection";
import { AboutSection } from "@/app/components/AboutSection";
import { HowItWorks } from "@/app/components/HowItWorks";
import { CoreModules } from "@/app/components/CoreModules";
import { UserRoles } from "@/app/components/UserRoles";
import { FinalCTA } from "@/app/components/FinalCTA";
import { Footer } from "@/app/components/Footer";

function LandingPage() {
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

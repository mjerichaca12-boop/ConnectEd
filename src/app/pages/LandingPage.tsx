import { Navigation } from '@/app/components/Navigation';
import { HeroSection } from '@/app/components/HeroSection';
import { AboutSection } from '@/app/components/AboutSection';
import { HowItWorks } from '@/app/components/HowItWorks';
import { CoreModules } from '@/app/components/CoreModules';
import { UserRoles } from '@/app/components/UserRoles';
import { FinalCTA } from '@/app/components/FinalCTA';
import { Footer } from '@/app/components/Footer';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="w-screen max-w-full overflow-x-hidden">
        <HeroSection />
        <AboutSection />
        <HowItWorks />
        <CoreModules />
        <UserRoles />
        <FinalCTA />
        <Footer />
      </div>
    </div>
  );
}
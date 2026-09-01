import { Link } from "react-router-dom";
import { Navigation } from "../components/Navigation";
import { Footer } from "../components/Footer";

function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      <div className="flex-grow flex items-center justify-center px-6 py-24 md:py-32">
        <div className="w-full max-w-4xl rounded-3xl border border-gray-200 bg-white p-8 md:p-12 shadow-xl">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Terms of Service</h1>
          
          <div className="space-y-8 text-gray-700 leading-relaxed text-sm md:text-base">
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">1. Acceptance of Terms</h2>
              <p>By accessing or using the ConnectEd platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">2. User Accounts</h2>
              <p>Users must maintain the confidentiality of their login credentials. You are responsible for all activities that occur under your account. ConnectEd administrators have the right to suspend or terminate accounts that violate our policies.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">3. User Responsibilities</h2>
              <p className="mb-2">As a user of ConnectEd, you agree to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Provide accurate and complete information</li>
                <li>Respect the privacy and rights of other users</li>
                <li>Report any security vulnerabilities or unauthorized access</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">4. Acceptable Use</h2>
              <p className="mb-2">The platform must be used solely for educational and administrative purposes. The following actions are strictly prohibited:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Harassment, bullying, or abusive behavior</li>
                <li>Attempting to manipulate grades, records, or platform systems</li>
                <li>Sharing inappropriate or non-educational content</li>
                <li>Using the platform for commercial purposes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">5. Intellectual Property</h2>
              <p>All content, branding, features, and functionality of the ConnectEd platform are owned by the school or platform providers. Users may not copy, modify, or distribute the platform's proprietary materials without explicit permission.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">6. Limitation of Liability</h2>
              <p>ConnectEd provides educational tools "as is." We are not liable for any disruptions, data loss, or indirect damages arising from the use or inability to use the platform, except as required by law.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">7. Termination</h2>
              <p>We reserve the right to suspend or terminate access to the platform immediately, without prior notice, for any violation of these Terms of Service or school policies.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">8. Changes to the Terms</h2>
              <p>We may modify these terms at any time. Continued use of the platform after any such changes constitutes your acceptance of the new Terms of Service.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">9. Contact Information</h2>
              <p>If you have any questions or concerns regarding these Terms of Service, please reach out to your system administrator or use our Contact Us page.</p>
            </section>
          </div>

          <div className="mt-12 flex items-center justify-between border-t border-gray-100 pt-6">
            <Link to="/" className="text-sm font-medium text-green-600 hover:text-green-700 transition-colors">Back to Home</Link>
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Go to Login</Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export { TermsOfService };

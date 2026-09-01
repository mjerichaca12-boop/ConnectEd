import { Link } from "react-router-dom";
import { Navigation } from "../components/Navigation";
import { Footer } from "../components/Footer";

function SitePolicy() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      <div className="flex-grow flex items-center justify-center px-6 py-24 md:py-32">
        <div className="w-full max-w-4xl rounded-3xl border border-gray-200 bg-white p-8 md:p-12 shadow-xl">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
          
          <div className="space-y-8 text-gray-700 leading-relaxed text-sm md:text-base">
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">1. Introduction</h2>
              <p>Welcome to ConnectEd. We are committed to protecting the privacy of our students, teachers, and administrators. This Privacy Policy explains how we collect, use, and safeguard your personal information when you use our educational platform.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">2. Information We Collect</h2>
              <p className="mb-2">We collect information necessary to provide educational services, including:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Personal identification information (Name, Email, Student LRN, etc.)</li>
                <li>Academic records and grades</li>
                <li>Communications sent through our messaging platform</li>
                <li>Usage data and system logs</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">3. How We Use Your Information</h2>
              <p className="mb-2">Your data is strictly used for educational and administrative purposes:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>To manage school accounts and access levels</li>
                <li>To record and display academic performance and grades</li>
                <li>To facilitate communication between teachers and students</li>
                <li>To send important school announcements</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">4. Data Security</h2>
              <p>We implement robust, industry-standard security measures, including encryption and secure authentication, to protect your data from unauthorized access, alteration, or disclosure.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">5. User Rights</h2>
              <p>Users have the right to access, correct, or request the deletion of their personal data. However, certain academic records must be retained in compliance with institutional and legal requirements.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">6. Data Retention</h2>
              <p>We retain your personal information for as long as your account is active or as needed to provide you services, comply with our legal obligations, resolve disputes, and enforce our agreements.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">7. Third-Party Services</h2>
              <p>ConnectEd does not sell your data to third parties. We may use trusted third-party service providers (such as cloud hosting) solely for operating our platform, and they are bound by strict confidentiality agreements.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">8. Changes to this Privacy Policy</h2>
              <p>We may update this policy periodically to reflect changes in our practices. Users will be notified of significant changes via email or platform announcements.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">9. Contact Information</h2>
              <p>If you have questions about this Privacy Policy, please contact your school administrator or reach out via our Contact Us page.</p>
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

export { SitePolicy };

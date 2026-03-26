import { Link } from "react-router-dom";
import { ArrowLeft, Shield, FileText } from "lucide-react";
function TermsAndPrivacy() {
  return <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        {
    /* Header */
  }
        <div className="mb-8">
          <Link
    to="/signup"
    className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium mb-6 transition-colors"
  >
            <ArrowLeft className="w-5 h-5" />
            Back to Sign Up
          </Link>
          
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-emerald-600 mb-2">
              ConnectEd
            </h1>
            <div className="w-16 h-1 bg-emerald-600 mx-auto rounded-full" />
          </div>
        </div>

        {
    /* Terms of Service */
  }
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Terms of Service</h2>
          </div>

          <div className="prose prose-emerald max-w-none space-y-6 text-gray-700">
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h3>
              <p>
                By accessing and using ConnectEd ("the System"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, please do not use the System.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">2. Description of Service</h3>
              <p>
                ConnectEd is an academic portal designed to facilitate communication and information management between students, teachers, and administrators within educational institutions. The System provides features including but not limited to:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Academic record management</li>
                <li>Attendance tracking</li>
                <li>Assignment submission and grading</li>
                <li>Announcements and messaging</li>
                <li>Grade viewing and reporting</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">3. User Accounts</h3>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Provide accurate and complete information during registration</li>
                <li>Keep your password secure and confidential</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
                <li>Use the System only for lawful purposes</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">4. User Conduct</h3>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Use the System for any illegal or unauthorized purpose</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Upload or transmit viruses or malicious code</li>
                <li>Attempt to gain unauthorized access to the System</li>
                <li>Impersonate any person or entity</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">5. Intellectual Property</h3>
              <p>
                All content, features, and functionality of ConnectEd are owned by the System administrators and are protected by copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">6. Limitation of Liability</h3>
              <p>
                ConnectEd is provided "as is" without warranties of any kind. We shall not be liable for any damages arising from the use or inability to use the System.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">7. Changes to Terms</h3>
              <p>
                We reserve the right to modify these terms at any time. Continued use of the System after changes constitutes acceptance of the modified terms.
              </p>
            </section>
          </div>
        </div>

        {
    /* Privacy Policy */
  }
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Privacy Policy</h2>
          </div>

          <div className="prose prose-emerald max-w-none space-y-6 text-gray-700">
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">1. Information We Collect</h3>
              <p>We collect the following types of information:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Personal Information:</strong> Name, email address, contact number, school ID</li>
                <li><strong>Academic Information:</strong> Grades, attendance records, assignments, subjects</li>
                <li><strong>Usage Information:</strong> Login times, pages viewed, actions performed</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">2. How We Use Your Information</h3>
              <p>We use your information to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Provide and maintain the System services</li>
                <li>Manage academic records and communications</li>
                <li>Send important notifications and announcements</li>
                <li>Improve and personalize your experience</li>
                <li>Ensure security and prevent fraud</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">3. Information Sharing</h3>
              <p>
                We do not sell your personal information. We may share your information with:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Teachers and administrators within your school for academic purposes</li>
                <li>Parents/guardians (for student accounts)</li>
                <li>Service providers who assist in operating the System</li>
                <li>Law enforcement when required by law</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">4. Data Security</h3>
              <p>
                We implement appropriate security measures to protect your information from unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet is 100% secure.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">5. Your Rights</h3>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Access and review your personal information</li>
                <li>Request corrections to inaccurate data</li>
                <li>Request deletion of your account (subject to legal requirements)</li>
                <li>Opt-out of non-essential communications</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">6. Data Retention</h3>
              <p>
                We retain your information for as long as your account is active or as needed to provide services. Academic records may be retained longer as required by educational regulations.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">7. Children's Privacy</h3>
              <p>
                Our System is designed for use by educational institutions. For users under 18, we require parental consent and limit data collection to what is necessary for educational purposes.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">8. Contact Us</h3>
              <p>
                If you have questions about this Privacy Policy or how we handle your data, please contact your school administrator or the ConnectEd support team.
              </p>
            </section>

            <section className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <strong>Last Updated:</strong> February 15, 2026
              </p>
            </section>
          </div>
        </div>

        {
    /* Footer */
  }
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            By using ConnectEd, you acknowledge that you have read and understood these terms and policies.
          </p>
        </div>
      </div>
    </div>;
}
export {
  TermsAndPrivacy
};

import { Link } from "react-router-dom";

function TermsAndPrivacy() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-3xl rounded-3xl border border-gray-200 bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-gray-900">Terms and Privacy</h1>
        <p className="mt-4 text-sm text-gray-600">
          This page provides a short summary of ConnectEd&apos;s terms of service and privacy expectations.
        </p>
        <div className="mt-8 space-y-4 text-sm text-gray-700 leading-7">
          <p>ConnectEd is intended for school use only. Users must keep their accounts secure and follow school policies.</p>
          <p>Personal data is used to provide educational services, messaging, announcements, grades, and account management.</p>
          <p>Administrators may review and manage accounts to maintain the security and integrity of the platform.</p>
        </div>
        <div className="mt-8 flex items-center justify-between">
          <Link to="/" className="text-sm font-medium text-green-600 hover:text-green-700">Back home</Link>
          <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">Go to login</Link>
        </div>
      </div>
    </div>
  );
}

export { TermsAndPrivacy };

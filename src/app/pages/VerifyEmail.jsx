import { Link, useSearchParams } from "react-router-dom";

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "your account";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-gray-900">Verify Email</h1>
        <p className="mt-4 text-sm text-gray-600">
          Check the inbox for <span className="font-semibold text-gray-900">{email}</span> and follow the verification link.
        </p>
        <div className="mt-8 flex items-center justify-between">
          <Link to="/login" className="text-sm font-medium text-green-600 hover:text-green-700">Back to login</Link>
          <Link to="/request-access" className="text-sm font-medium text-gray-600 hover:text-gray-900">Request access</Link>
        </div>
      </div>
    </div>
  );
}

export { VerifyEmail };

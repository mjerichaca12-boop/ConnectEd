import { Link } from "react-router-dom";

function NotificationsPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <p className="mt-4 text-sm text-gray-600">
          This notifications view is available for admin and teacher routes in the current build.
        </p>
        <div className="mt-8 flex items-center justify-between">
          <Link to="/login" className="text-sm font-medium text-green-600 hover:text-green-700">Back to login</Link>
          <Link to="/" className="text-sm font-medium text-gray-600 hover:text-gray-900">Home</Link>
        </div>
      </div>
    </div>
  );
}

export { NotificationsPage };

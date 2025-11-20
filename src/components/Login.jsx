import React, { useState } from 'react';
import { Lock, Mail, AlertCircle, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Messaging Matrix Logo Component
const MessagingMatrixLogo = ({ className = "", color = "#2870ed" }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 800 800"
  >
    <g>
      <polygon fill={color} points="297.22773 561.72334 213.69075 561.7234 280.36225 238.27666 363.89923 238.2766 297.22773 561.72334"/>
      <polygon fill={color} points="372.33197 238.27666 288.79499 238.27661 355.46653 561.72334 439.00351 561.72339 372.33197 238.27666"/>
      <polygon fill={color} points="514.8137 238.27666 431.27672 238.27661 497.94825 561.72334 581.48524 561.72339 514.8137 238.27666"/>
      <polygon fill={color} points="530.95895 238.27666 447.42197 238.27661 514.0935 561.72334 597.63048 561.72339 530.95895 238.27666"/>
      <rect fill={color} x="88.60344" y="87.13551" width="27.34135" height="610.59038"/>
      <rect fill={color} x="124.98303" y="50.75592" width="30.27721" height="103.03638" transform="translate(242.39574 -37.84752) rotate(90)"/>
      <rect fill={color} x="124.98303" y="646.20769" width="30.27721" height="103.03638" transform="translate(837.84752 557.60426) rotate(90)"/>
      <rect fill={color} x="684.05521" y="87.13551" width="27.34135" height="610.59038" transform="translate(1395.45177 784.8614) rotate(-180)"/>
      <rect fill={color} x="644.73977" y="50.75592" width="30.27721" height="103.03638" transform="translate(762.15248 -557.60426) rotate(90)"/>
      <rect fill={color} x="644.73977" y="646.20769" width="30.27721" height="103.03638" transform="translate(1357.60426 37.84752) rotate(90)"/>
    </g>
    <g>
      <rect fill="none" stroke={`${color}40`} strokeMiterlimit="10" x="87.13551" y="87.13551" width="625.72898" height="625.72898"/>
      <line fill="none" stroke={`${color}40`} strokeMiterlimit="10" x1="87.13551" y1="608.57633" x2="712.86449" y2="608.57633"/>
      <line fill="none" stroke={`${color}40`} strokeMiterlimit="10" x1="87.13551" y1="504.28816" x2="712.86449" y2="504.28816"/>
      <line fill="none" stroke={`${color}40`} strokeMiterlimit="10" x1="87.13551" y1="400" x2="712.86449" y2="400"/>
      <line fill="none" stroke={`${color}40`} strokeMiterlimit="10" x1="87.13551" y1="295.71184" x2="712.86449" y2="295.71184"/>
      <line fill="none" stroke={`${color}40`} strokeMiterlimit="10" x1="87.13551" y1="191.42367" x2="712.86449" y2="191.42367"/>
      <line fill="none" stroke={`${color}40`} strokeMiterlimit="10" x1="608.57633" y1="87.13551" x2="608.57633" y2="712.86449"/>
      <line fill="none" stroke={`${color}40`} strokeMiterlimit="10" x1="504.28816" y1="87.13551" x2="504.28816" y2="712.86449"/>
      <line fill="none" stroke={`${color}40`} strokeMiterlimit="10" x1="400" y1="87.13551" x2="400" y2="712.86449"/>
      <line fill="none" stroke={`${color}40`} strokeMiterlimit="10" x1="295.71184" y1="87.13551" x2="295.71184" y2="712.86449"/>
      <line fill="none" stroke={`${color}40`} strokeMiterlimit="10" x1="191.42367" y1="87.13551" x2="191.42367" y2="712.86449"/>
    </g>
  </svg>
);

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (!result.success) {
      setError(result.error);
      setLoading(false);
    }
    // If successful, the AuthContext will update and App will re-render
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
            <MessagingMatrixLogo className="w-full h-full" color="#2870ed" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Messaging Matrix</h1>
          <p className="text-gray-600">Sign in to continue</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={20} className="text-gray-400" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="your.email@example.com"
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={20} className="text-gray-400" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader size={20} className="animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t text-center">
          <p className="text-sm text-gray-500">
            Secure authentication powered by Web Crypto API
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

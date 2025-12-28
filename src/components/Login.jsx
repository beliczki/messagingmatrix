import React, { useState, useEffect } from 'react';
import { Lock, Mail, AlertCircle, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

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

// Animated gradient blob component
const GradientBlob = ({ color, size, top, left, delay = 0 }) => (
  <div
    className="absolute rounded-full blur-3xl opacity-60 animate-pulse"
    style={{
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      width: size,
      height: size,
      top,
      left,
      animationDelay: `${delay}s`,
      animationDuration: '4s',
    }}
  />
);

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookAndFeel, setLookAndFeel] = useState(null);
  const { login } = useAuth();

  // Fetch public config for design colors
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await api.get('/api/config-basic');
        if (response.data?.lookAndFeel) {
          setLookAndFeel(response.data.lookAndFeel);
        }
      } catch (err) {
        console.log('Could not fetch design config, using defaults');
      }
    };
    fetchConfig();
  }, []);

  const headerColor = lookAndFeel?.headerColor || '#2870ed';
  const buttonColor = lookAndFeel?.buttonColor || '#ff6130';
  const secondaryColor1 = lookAndFeel?.secondaryColor1 || '#eb4c79';
  const secondaryColor2 = lookAndFeel?.secondaryColor2 || '#02a3a4';
  const secondaryColor3 = lookAndFeel?.secondaryColor3 || '#711c7a';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (!result.success) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated gradient blobs */}
      <GradientBlob color={secondaryColor1} size="500px" top="-150px" left="-100px" delay={0} />
      <GradientBlob color={secondaryColor3} size="400px" top="10%" left="20%" delay={1} />
      <GradientBlob color={secondaryColor2} size="450px" top="50%" left="60%" delay={0.5} />
      <GradientBlob color={headerColor} size="350px" top="70%" left="-50px" delay={1.5} />
      <GradientBlob color={buttonColor} size="300px" top="-50px" left="70%" delay={2} />

      {/* Glassmorphism card */}
      <div
        className="relative z-10 w-full max-w-md p-8 rounded-3xl"
        style={{
          background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
            {lookAndFeel?.logo ? (
              <img src={lookAndFeel.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
            ) : (
              <MessagingMatrixLogo className="w-full h-full" color={headerColor} />
            )}
          </div>
          <h1 className="text-3xl font-bold mb-2 text-gray-800">Messaging Matrix</h1>
          <p className="text-gray-600">Sign in to continue</p>
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="mb-6 p-4 rounded-xl flex items-start gap-3"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail size={18} className="text-gray-400" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 rounded-xl focus:outline-none transition-all"
                style={{
                  background: 'rgba(255, 255, 255, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.5)',
                }}
                onFocus={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.8)';
                  e.target.style.boxShadow = `0 0 0 3px ${headerColor}40`;
                }}
                onBlur={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.5)';
                  e.target.style.boxShadow = 'none';
                }}
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
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 rounded-xl focus:outline-none transition-all"
                style={{
                  background: 'rgba(255, 255, 255, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.5)',
                }}
                onFocus={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.8)';
                  e.target.style.boxShadow = `0 0 0 3px ${headerColor}40`;
                }}
                onBlur={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.5)';
                  e.target.style.boxShadow = 'none';
                }}
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
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{
              background: `linear-gradient(135deg, ${buttonColor} 0%, ${secondaryColor1} 100%)`,
              boxShadow: `0 4px 15px ${buttonColor}50`,
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = `0 6px 20px ${buttonColor}60`;
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = `0 4px 15px ${buttonColor}50`;
            }}
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
        <div className="mt-8 pt-6 border-t border-white/30 text-center">
          <p className="text-sm text-gray-600">
            Secure authentication powered by Web Crypto API
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

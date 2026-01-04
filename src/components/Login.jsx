import React, { useState, useEffect } from 'react';
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

// Generate random bezier blob path
const generateBlobPath = () => {
  const points = 6; // number of points around the blob
  const angleStep = (Math.PI * 2) / points;
  const radius = 42; // base radius as percentage of viewBox
  const variance = 12; // how much the radius can vary

  let path = '';
  const controlPoints = [];

  // Generate points around the circle with random radius variation
  for (let i = 0; i < points; i++) {
    const angle = i * angleStep - Math.PI / 2;
    const r = radius + (Math.random() - 0.5) * variance * 2;
    const x = 50 + Math.cos(angle) * r;
    const y = 50 + Math.sin(angle) * r;
    controlPoints.push({ x, y, angle });
  }

  // Create smooth bezier path through points
  path = `M ${controlPoints[0].x} ${controlPoints[0].y}`;

  for (let i = 0; i < points; i++) {
    const curr = controlPoints[i];
    const next = controlPoints[(i + 1) % points];

    // Calculate control points for smooth curve
    const tension = 0.3 + Math.random() * 0.3;
    const dist = Math.sqrt(Math.pow(next.x - curr.x, 2) + Math.pow(next.y - curr.y, 2));

    const cp1x = curr.x + Math.cos(curr.angle + Math.PI / 2) * dist * tension;
    const cp1y = curr.y + Math.sin(curr.angle + Math.PI / 2) * dist * tension;
    const cp2x = next.x - Math.cos(next.angle + Math.PI / 2) * dist * tension;
    const cp2y = next.y - Math.sin(next.angle + Math.PI / 2) * dist * tension;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }

  return path + ' Z';
};

// SVG Blob component with bezier curves
const GradientBlob = ({ color, size, top, left, opacity = 0.6, blendMode = null }) => {
  const [path] = React.useState(() => generateBlobPath());
  return (
    <svg
      className="absolute"
      style={{
        width: size,
        height: size,
        top,
        left,
        opacity,
        mixBlendMode: blendMode,
        overflow: 'visible',
      }}
      viewBox="0 0 100 100"
    >
      <path d={path} fill={color} />
    </svg>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  // Get colors directly from config API (no auth required)
  const [colors, setColors] = useState({
    mainColor: '#2870ed',  // Fallback blue
    secondaryColor1: '#1e5bb8',
    secondaryColor2: '#4a90e2',
    secondaryColor3: '#6ba3eb'
  });

  // Cobranding state
  const [cobranding, setCobranding] = useState({ enabled: false, logoUrl: '' });

  useEffect(() => {
    // Fetch config directly - don't rely on CSS variables which may not be set yet
    const loadConfig = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3003' : '');
        const response = await fetch(`${API_URL}/api/config-basic`);
        if (response.ok) {
          const data = await response.json();
          const lf = data.lookAndFeel || {};

          // Set colors
          setColors({
            mainColor: lf.headerColor || '#2870ed',
            secondaryColor1: lf.secondaryColor1 || lf.headerColor || '#1e5bb8',
            secondaryColor2: lf.secondaryColor2 || lf.headerColor || '#4a90e2',
            secondaryColor3: lf.secondaryColor3 || lf.headerColor || '#6ba3eb'
          });

          // Set page title
          if (lf.pageTitle) {
            document.title = lf.pageTitle;
          }

          // Set font family
          const fontFamily = lf.fontFamily || 'Inter';
          const fontMap = {
            'Inter': "'Inter', system-ui, sans-serif",
            'Poppins': "'Poppins', system-ui, sans-serif",
            'Novatica': "'BC Novatica', system-ui, sans-serif",
            'TeleNeo': "'TeleNeo', system-ui, sans-serif"
          };
          document.documentElement.style.setProperty('--font-family', fontMap[fontFamily] || fontMap['Inter']);

          // Set cobranding
          if (lf.cobranding) {
            setCobranding({
              enabled: lf.cobranding.enabled || false,
              logoUrl: lf.cobranding.logoUrl || ''
            });
          }
        }
      } catch (error) {
        console.error('Error loading login config:', error);
        // Keep fallback colors on error
      }
    };
    loadConfig();
  }, []);

  const mainColor = colors.mainColor;
  const secondaryColor1 = colors.secondaryColor1;
  const secondaryColor2 = colors.secondaryColor2;
  const secondaryColor3 = colors.secondaryColor3;

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
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative" style={{ backgroundColor: mainColor }}>
      {/* Overlapping solid color blobs - clustered around login card */}
      <GradientBlob color={secondaryColor1} size="450px" top="20%" left="calc(50% - 400px)" opacity={0.8} />
      <GradientBlob color={secondaryColor3} size="400px" top="15%" left="calc(50% - 100px)" opacity={0.75} />
      <GradientBlob color={mainColor} size="420px" top="25%" left="calc(50% + 150px)" opacity={0.7} />
      <GradientBlob color={secondaryColor2} size="380px" top="45%" left="calc(50% - 300px)" opacity={0.8} />
      <GradientBlob color={mainColor} size="350px" top="45%" left="calc(50% - 50px)" opacity={0.75} />

      {/* Additional blue blobs */}
      <GradientBlob color={mainColor} size="380px" top="10%" left="calc(50% - 250px)" opacity={0.7} />
      <GradientBlob color={mainColor} size="320px" top="50%" left="calc(50% + 100px)" opacity={0.65} />
      <GradientBlob color={mainColor} size="280px" top="35%" left="calc(50% - 50px)" opacity={0.6} />

      {/* Blue accent blobs with blend modes */}
      <GradientBlob color={mainColor} size="320px" top="30%" left="calc(50% - 160px)" opacity={0.6} blendMode="color-dodge" />
      <GradientBlob color={mainColor} size="280px" top="40%" left="calc(50% + 50px)" opacity={0.5} blendMode="color-dodge" />
      <GradientBlob color={mainColor} size="260px" top="20%" left="calc(50% - 250px)" opacity={0.55} blendMode="color-burn" />

      {/* Glassmorphism card */}
      <div
        className="relative z-10 w-full max-w-md p-8 rounded-3xl"
        style={{
          background: 'rgba(255, 255, 255, 0.3)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Top-left corner border */}
        <div
          className="absolute top-0 left-0 pointer-events-none"
          style={{
            width: '40px',
            height: '40px',
            borderTop: '3px solid rgba(255, 255, 255, 0.8)',
            borderLeft: '3px solid rgba(255, 255, 255, 0.8)',
            borderTopLeftRadius: '24px',
            filter: 'blur(5px)',
          }}
        />
        {/* Bottom-right corner border */}
        <div
          className="absolute bottom-0 right-0 pointer-events-none"
          style={{
            width: '40px',
            height: '40px',
            borderBottom: '3px solid rgba(255, 255, 255, 0.8)',
            borderRight: '3px solid rgba(255, 255, 255, 0.8)',
            borderBottomRightRadius: '24px',
            filter: 'blur(5px)',
          }}
        />
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <div className="w-20 h-20">
              <MessagingMatrixLogo className="w-full h-full" color="#ffffff" />
            </div>
            {/* Cobranding Logo */}
            {cobranding.enabled && cobranding.logoUrl && (
              <>
                <span className="text-white/60 text-3xl font-light">×</span>
                <img
                  src={cobranding.logoUrl}
                  alt="Cobranding"
                  className="h-16 w-auto object-contain"
                  style={{ filter: 'brightness(0) invert(1)' }}
                />
              </>
            )}
          </div>
          <h1 className="text-5xl font-bold text-white leading-tight">Messaging<br/>Matrix</h1>
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
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail size={18} className="text-white/70" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 rounded-xl focus:outline-none transition-all text-white placeholder-white/50 autofill:bg-transparent autofill:shadow-none"
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                }}
                onFocus={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.25)';
                  e.target.style.boxShadow = `0 0 0 3px ${mainColor}40`;
                }}
                onBlur={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.15)';
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
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock size={18} className="text-white/70" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 rounded-xl focus:outline-none transition-all text-white placeholder-white/50"
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                }}
                onFocus={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.25)';
                  e.target.style.boxShadow = `0 0 0 3px ${mainColor}40`;
                }}
                onBlur={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.15)';
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
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            style={{
              background: mainColor,
              color: '#ffffff',
              boxShadow: `0 4px 15px ${mainColor}50`,
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#ffffff';
              e.target.style.color = mainColor;
              e.target.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = mainColor;
              e.target.style.color = '#ffffff';
              e.target.style.boxShadow = `0 4px 15px ${mainColor}50`;
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
          <p className="text-xs text-white/60">
            Secure authentication powered by Web Crypto API
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

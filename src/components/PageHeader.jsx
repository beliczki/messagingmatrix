import React from 'react';
import { Menu } from 'lucide-react';

// Helper function to parse CSS string into style object
const parseCSSString = (cssString) => {
  if (!cssString) return {};

  const styleObject = {};
  const declarations = cssString.split(';').filter(d => d.trim());

  declarations.forEach(declaration => {
    const [property, value] = declaration.split(':').map(s => s.trim());
    if (property && value) {
      // Convert kebab-case to camelCase
      const camelProperty = property.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      styleObject[camelProperty] = value;
    }
  });

  return styleObject;
};

// Helper function to get button styles from lookAndFeel
export const getButtonStyle = (lookAndFeel) => {
  const buttonColor = lookAndFeel?.buttonColor || '#ff6130';
  const buttonStyle = parseCSSString(lookAndFeel?.buttonStyle || '');

  return {
    backgroundColor: buttonColor,
    ...buttonStyle
  };
};

const PageHeader = ({ onMenuToggle, title, children, lookAndFeel }) => {
  const headerColor = lookAndFeel?.headerColor || '#2870ed';
  const logo = lookAndFeel?.logo;
  const logoStyle = parseCSSString(lookAndFeel?.logoStyle || '');

  return (
    <div className="sticky top-0 z-10" style={{ backgroundColor: headerColor, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
      <div className="px-4 py-3 flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded transition-colors"
          style={{ color: 'white' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Menu size={24} />
        </button>
        {logo && (
          <img src={logo} alt="Logo" style={logoStyle} />
        )}
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
      </div>
    </div>
  );
};

export default PageHeader;

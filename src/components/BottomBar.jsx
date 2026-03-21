import React, { useState, Children } from 'react';
import { ChevronRight, ChevronLeft, ChevronsLeftRight } from 'lucide-react';

/**
 * BottomBar - Wrapper for bottom bar with animated centered/sides layout toggle.
 * DOM structure stays identical in both modes — CSS transitions handle the animation.
 * [panel] [>] [spacer+center-toggle] [<] [panel]
 */
const BottomBar = ({ children }) => {
  const [layout, setLayout] = useState(() => {
    try {
      return localStorage.getItem('bottom_bar_layout') || 'center';
    } catch { return 'center'; }
  });

  const toggleLayout = () => {
    const next = layout === 'center' ? 'sides' : 'center';
    setLayout(next);
    localStorage.setItem('bottom_bar_layout', next);
  };

  const childArray = Children.toArray(children);
  const isSides = layout === 'sides';

  return (
    <div className={`bottom-bar bottom-bar--animated ${isSides ? 'bottom-bar--sides' : ''}`}>
      <div className="bottom-bar-group">
        {childArray[0]}
        <button className="bottom-bar-toggle bottom-bar-toggle--side" onClick={toggleLayout} title="Center buttons">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="bottom-bar-spacer">
        <button className="bottom-bar-toggle bottom-bar-toggle--center" onClick={toggleLayout} title="Move to sides">
          <ChevronsLeftRight size={16} />
        </button>
      </div>
      <div className="bottom-bar-group">
        <button className="bottom-bar-toggle bottom-bar-toggle--side" onClick={toggleLayout} title="Center buttons">
          <ChevronLeft size={16} />
        </button>
        {childArray.slice(1)}
      </div>
    </div>
  );
};

export default BottomBar;

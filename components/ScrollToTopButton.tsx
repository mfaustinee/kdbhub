import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface ScrollToTopButtonProps {
  threshold?: number;
  className?: string;
  showLabel?: boolean;
}

export const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({
  threshold = 160,
  className = '',
  showLabel = true
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      setIsVisible(scrollPos > threshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Check initial state
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [threshold]);

  const scrollToTop = () => {
    try {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth'
      });
      document.documentElement.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth'
      });
      document.body.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth'
      });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top of page"
      title="Scroll to top"
      id="global-scroll-to-top-btn"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-slate-900/90 hover:bg-slate-900 text-white font-bold text-xs shadow-xl hover:shadow-2xl border border-slate-700/60 backdrop-blur-md transition-all duration-200 hover:-translate-y-1 active:translate-y-0 active:scale-95 cursor-pointer group ${className}`}
    >
      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
        <ArrowUp className="w-3.5 h-3.5 text-white transition-transform group-hover:-translate-y-0.5" />
      </div>
      {showLabel && (
        <span className="tracking-wider uppercase text-[10px] font-black text-slate-100 pr-1">
          Top
        </span>
      )}
    </button>
  );
};

export default ScrollToTopButton;

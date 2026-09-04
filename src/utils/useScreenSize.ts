import { useState, useEffect } from 'react';

export interface ScreenSize {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  orientation: 'portrait' | 'landscape';
}

export function useScreenSize(): ScreenSize {
  const [screenSize, setScreenSize] = useState<ScreenSize>(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    return {
      width: w,
      height: h,
      isMobile: w < 768,
      isTablet: w >= 768 && w < 1024,
      isDesktop: w >= 1024,
      isTouch: typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
      orientation: w >= h ? 'landscape' : 'portrait'
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: any = null;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const mobile = w < 768;
        const tablet = w >= 768 && w < 1024;
        const desktop = w >= 1024;
        const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const orient = w >= h ? 'landscape' : 'portrait';

        setScreenSize({
          width: w,
          height: h,
          isMobile: mobile,
          isTablet: tablet,
          isDesktop: desktop,
          isTouch: touch,
          orientation: orient
        });

        // Set responsive helper attributes on document root to keep all layouts strictly bounded
        document.documentElement.setAttribute('data-screen-device', mobile ? 'mobile' : tablet ? 'tablet' : 'desktop');
        document.documentElement.style.setProperty('--screen-w', `${w}px`);
        document.documentElement.style.setProperty('--screen-h', `${h}px`);
      }, 50);
    };

    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return screenSize;
}

/*
 * ANIMATION: Page Transition Wrapper
 * Smooth fade-in + subtle upward slide on page mount.
 * Uses CSS animations — no framer-motion dependency needed.
 * Staggered children support via CSS custom property.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className = '' }: PageTransitionProps) {
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Trigger on next frame for CSS transition to work
    requestAnimationFrame(() => setMounted(true));
  }, []);

  return (
    <div
      ref={ref}
      className={`page-transition ${mounted ? 'page-transition-enter' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

/*
 * ANIMATION: Stagger Container
 * Wraps children and applies staggered entrance delays.
 * Each direct child gets an increasing --stagger-index CSS variable.
 */
interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number; // ms between each child, default 50
}

export function StaggerContainer({ children, className = '', staggerDelay = 50 }: StaggerContainerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  return (
    <div
      className={`stagger-container ${mounted ? 'stagger-enter' : ''} ${className}`}
      style={{ '--stagger-delay': `${staggerDelay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/*
 * ANIMATION: Fade In Section
 * Individual section that fades in when it enters the viewport.
 * Uses IntersectionObserver for scroll-triggered animations.
 */
interface FadeInProps {
  children: ReactNode;
  className?: string;
  delay?: number; // ms
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
}

export function FadeIn({ children, className = '', delay = 0, direction = 'up' }: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const directionClass = {
    up: 'fade-in-up',
    down: 'fade-in-down',
    left: 'fade-in-left',
    right: 'fade-in-right',
    none: 'fade-in',
  }[direction];

  return (
    <div
      ref={ref}
      className={`${directionClass} ${visible ? 'fade-in-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

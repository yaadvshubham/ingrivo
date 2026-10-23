"use client";

import React, { useRef, useState, useEffect } from "react";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  blur?: number; // Blur in px, default 14
  yOffset?: number; // Slide up distance in px, default 24
  scale?: number; // Initial scale, default 0.98
  delay?: number; // Delay in ms, default 0
  duration?: number; // Duration in ms, default 750
  threshold?: number; // Intersection threshold (0 - 1), default 0.12
  once?: boolean; // Only trigger once, default true
}

/**
 * Modern Apple / Linear style Scroll Reveal with Blur-to-Clear effect.
 * Smoothly transitions elements from soft optical blur + slight offset
 * into razor-sharp clarity as they scroll into the viewport.
 */
export function ScrollReveal({
  children,
  className = "",
  as: Component = "div",
  blur = 12,
  yOffset = 24,
  scale = 0.98,
  delay = 0,
  duration = 750,
  threshold = 0.12,
  once = true,
}: ScrollRevealProps) {
  const domRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Respect user's motion preferences
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setIsVisible(true);
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (once && domRef.current) {
              observer.unobserve(domRef.current);
            }
          } else if (!once) {
            setIsVisible(false);
          }
        });
      },
      {
        threshold,
        rootMargin: "0px 0px -40px 0px", // Trigger slightly before element reaches bottom of viewport
      }
    );

    const currentElem = domRef.current;
    if (currentElem) {
      observer.observe(currentElem);
    }

    return () => {
      if (currentElem) {
        observer.unobserve(currentElem);
      }
    };
  }, [threshold, once]);

  return (
    <Component
      ref={domRef}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        filter: isVisible ? "blur(0px)" : `blur(${blur}px)`,
        transform: isVisible ? "translate3d(0, 0, 0) scale(1)" : `translate3d(0, ${yOffset}px, 0) scale(${scale})`,
        transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1), filter ${duration}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        transitionDelay: `${delay}ms`,
        willChange: isVisible ? "auto" : "opacity, filter, transform",
      }}
    >
      {children}
    </Component>
  );
}

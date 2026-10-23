"use client";

import React, { useState, useEffect } from "react";

interface TypewriterTaglineProps {
  className?: string;
}

const LINE_1 = "Know what you eat.";
const LINE_2 = "Understand what you buy.";

/**
 * Animated Tagline Component
 * Streams out smoothly character-by-character:
 * Line 1: "Know what you eat."
 * Line 2: "Understand what you buy."
 *
 * Designed with responsive typography: compact on mobile screens (<640px)
 * to avoid consuming the majority of viewport space, and bold on tablet/desktop.
 */
export function TypewriterTagline({ className = "" }: TypewriterTaglineProps) {
  const [text1, setText1] = useState("");
  const [text2, setText2] = useState("");
  const [isTyping1, setIsTyping1] = useState(true);
  const [isTyping2, setIsTyping2] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Check if user prefers reduced motion safely (handles jsdom/test environments)
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setText1(LINE_1);
      setText2(LINE_2);
      setIsTyping1(false);
      setIsTyping2(false);
      setIsComplete(true);
      return;
    }

    let timeout: NodeJS.Timeout;

    // Stream Line 1 character-by-character (~38ms per char for a fluid stream)
    if (isTyping1) {
      if (text1.length < LINE_1.length) {
        timeout = setTimeout(() => {
          setText1(LINE_1.slice(0, text1.length + 1));
        }, 36);
        return () => clearTimeout(timeout);
      } else {
        // Line 1 finished, slight pause before Line 2 starts
        timeout = setTimeout(() => {
          setIsTyping1(false);
          setIsTyping2(true);
        }, 280);
        return () => clearTimeout(timeout);
      }
    }

    // Stream Line 2 character-by-character
    if (isTyping2) {
      if (text2.length < LINE_2.length) {
        timeout = setTimeout(() => {
          setText2(LINE_2.slice(0, text2.length + 1));
        }, 36);
        return () => clearTimeout(timeout);
      } else {
        // Line 2 finished, finish typing
        timeout = setTimeout(() => {
          setIsTyping2(false);
          setIsComplete(true);
        }, 400);
        return () => clearTimeout(timeout);
      }
    }
  }, [text1, text2, isTyping1, isTyping2]);

  return (
    <h1
      className={`text-[26px] xs:text-[28px] sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#1B2A22] max-w-4xl mx-auto leading-[1.16] sm:leading-[1.18] select-none ${className}`}
      aria-label="Know what you eat. Understand what you buy."
    >
      {/* Line 1: Know what you eat. */}
      <span className="inline">
        {text1}
      </span>

      {/* Caret during Line 1 */}
      {isTyping1 && (
        <span
          className="inline-block w-[2.5px] sm:w-[3.5px] h-5 sm:h-8 md:h-10 bg-[#1E5B45] align-middle ml-1 rounded-full animate-pulse"
          aria-hidden="true"
        />
      )}

      {/* Responsive line break between phrases */}
      <br className="hidden sm:inline" />
      <span className="sm:hidden inline"> </span>

      {/* Line 2: Understand what you buy. */}
      <span className="inline gradient-text-emerald">
        {text2}
      </span>

      {/* Caret during Line 2 or briefly after before fading */}
      {(isTyping2 || (!isComplete && text2.length > 0)) && (
        <span
          className="inline-block w-[2.5px] sm:w-[3.5px] h-5 sm:h-8 md:h-10 bg-[#2E8B63] align-middle ml-1 rounded-full animate-pulse shadow-xs shadow-[#2E8B63]/40"
          aria-hidden="true"
        />
      )}
    </h1>
  );
}

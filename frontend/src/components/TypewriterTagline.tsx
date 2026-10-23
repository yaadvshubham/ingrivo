"use client";

import React, { useState, useEffect } from "react";

interface TypewriterTaglineProps {
  className?: string;
}

const PHRASE_1_WORDS = ["Know", "what", "you", "eat."];
const PHRASE_2_WORDS = ["Understand", "what", "you", "buy."];

/**
 * Animated Tagline Component
 * Types out:
 * Line 1: "Know what you eat."
 * Line 2: "Understand what you buy."
 * word-by-word with smooth character & word reveal, glowing cursor, and elegant pacing.
 */
export function TypewriterTagline({ className = "" }: TypewriterTaglineProps) {
  // Number of words revealed for line 1 and line 2
  const [line1WordCount, setLine1WordCount] = useState(0);
  const [line2WordCount, setLine2WordCount] = useState(0);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    // Step 1: Reveal line 1 words one by one (pacing ~160ms per word)
    if (line1WordCount < PHRASE_1_WORDS.length) {
      timer = setTimeout(() => {
        setLine1WordCount((prev) => prev + 1);
      }, 160);
      return () => clearTimeout(timer);
    }

    // Step 2: Brief pause before starting line 2
    if (line1WordCount === PHRASE_1_WORDS.length && line2WordCount === 0) {
      timer = setTimeout(() => {
        setLine2WordCount(1);
      }, 240);
      return () => clearTimeout(timer);
    }

    // Step 3: Reveal line 2 words one by one
    if (line2WordCount > 0 && line2WordCount < PHRASE_2_WORDS.length) {
      timer = setTimeout(() => {
        setLine2WordCount((prev) => prev + 1);
      }, 180);
      return () => clearTimeout(timer);
    }

    // Step 4: Finished
    if (line2WordCount === PHRASE_2_WORDS.length && !isDone) {
      timer = setTimeout(() => {
        setIsDone(true);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [line1WordCount, line2WordCount, isDone]);

  return (
    <h1
      className={`text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#1B2A22] max-w-4xl mx-auto leading-[1.18] select-none ${className}`}
      aria-label="Know what you eat. Understand what you buy."
    >
      {/* Line 1: Know what you eat. */}
      <span className="inline-block">
        {PHRASE_1_WORDS.slice(0, line1WordCount).map((word, idx) => (
          <span
            key={idx}
            className="inline-block mr-2.5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
          >
            {word}
          </span>
        ))}
      </span>

      {/* Cursor after line 1 if line 2 hasn't started */}
      {line1WordCount > 0 && line2WordCount === 0 && (
        <span
          className="inline-block w-1 h-9 sm:h-11 md:h-13 bg-[#1E5B45] align-middle ml-1 rounded-full animate-pulse"
          aria-hidden="true"
        />
      )}

      {/* Line break between phrases */}
      <br className="hidden sm:inline" />

      {/* Line 2: Understand what you buy. */}
      <span className="inline-block mt-1 sm:mt-0">
        {PHRASE_2_WORDS.slice(0, line2WordCount).map((word, idx) => (
          <span
            key={idx}
            className="inline-block mr-2.5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 gradient-text-emerald"
          >
            {word}
          </span>
        ))}
      </span>

      {/* Trailing cursor while typing line 2 */}
      {!isDone && line2WordCount > 0 && (
        <span
          className="inline-block w-1.5 h-9 sm:h-11 md:h-13 bg-[#2E8B63] align-middle ml-1 rounded-full animate-pulse shadow-sm shadow-[#2E8B63]/40"
          aria-hidden="true"
        />
      )}

      {/* Subtle celebratory shimmer glow once typing is complete */}
      {isDone && (
        <span
          className="inline-block ml-2 text-2xl sm:text-3xl animate-in zoom-in spin-in-12 duration-500 text-[#E3A02B]"
          title="Evidence-Based Food Intelligence"
        >
          ✦
        </span>
      )}
    </h1>
  );
}

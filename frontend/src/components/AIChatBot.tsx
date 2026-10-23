"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  X,
  Send,
  MessageCircle,
  Sparkles,
  Bot,
  RotateCcw,
  Globe,
  Tag,
  Search,
  ExternalLink,
} from "lucide-react";

/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */
export type ChatLanguage = "english" | "hinglish" | "hindi";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ActiveProductSummary {
  name?: string;
  brand?: string;
  ingredients?: string;
  nutrition?: Record<string, any>;
  basis?: string;
  allergens?: string[];
}

const GREETINGS: Record<ChatLanguage, string> = {
  english:
    "Hi! I'm **Nutri** 🌿 — your Pinfo AI food guide. Ask me anything about any food brand (new or established), ingredients, additives, or the product you're currently viewing!",
  hinglish:
    "Hi! Main hoon **Nutri** 🌿 — aapka Pinfo AI food guide! Kisi bhi food brand, naye clean-label startups, ingredients, ya is product ke baare mein kuch bhi poochiye.",
  hindi:
    "नमस्ते! मैं **नूट्री** 🌿 हूँ — आपका इनग्रिवो AI फ़ूड साथी! किसी भी ब्रांड, नई फ़ूड कंपनियों, सामग्री या इस उत्पाद के बारे में कुछ भी पूछें।",
};

const SUGGESTIONS_HOME: Record<ChatLanguage, string[]> = {
  english: [
    "Tell me about The Whole Truth brand",
    "What is maltodextrin and why is it used?",
    "Compare Slurrp Farm vs Nestle Cerelac",
    "How to detect hidden palm oil on labels?",
  ],
  hinglish: [
    "The Whole Truth brand ke baare mein batao",
    "Maltodextrin kya hai aur kya yeh safe hai?",
    "Slurrp Farm aur Nestle Cerelac mein kya difference hai?",
    "Package par palm oil kaise pehchanein?",
  ],
  hindi: [
    "द होल ट्रुथ (The Whole Truth) ब्रांड के बारे में बताएं",
    "माल्टोडेक्सट्रिन क्या है और क्यों डाला जाता है?",
    "स्लर्प फार्म (Slurrp Farm) के उत्पाद कैसे हैं?",
    "पैकेट पर छिपे हुए पाम ऑयल की पहचान कैसे करें?",
  ],
};

/* ─────────────────────────────────────────
   Inline CSS for animations
───────────────────────────────────────── */
const styles = `
@keyframes nutri-walk {
  0%   { transform: translateX(0) scaleX(1); }
  48%  { transform: translateX(60px) scaleX(1); }
  50%  { transform: translateX(60px) scaleX(-1); }
  98%  { transform: translateX(0) scaleX(-1); }
  100% { transform: translateX(0) scaleX(1); }
}
@keyframes nutri-bob {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-6px); }
}
@keyframes nutri-arm-l {
  0%, 100% { transform: rotate(-20deg); }
  50%       { transform: rotate(20deg); }
}
@keyframes nutri-arm-r {
  0%, 100% { transform: rotate(20deg); }
  50%       { transform: rotate(-20deg); }
}
@keyframes nutri-leg-l {
  0%, 100% { transform: rotate(-25deg); }
  50%       { transform: rotate(20deg); }
}
@keyframes nutri-leg-r {
  0%, 100% { transform: rotate(20deg); }
  50%       { transform: rotate(-25deg); }
}
@keyframes nutri-blink {
  0%, 90%, 100% { transform: scaleY(1); }
  95%            { transform: scaleY(0.1); }
}
@keyframes nutri-float {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50%       { transform: translateY(-8px) rotate(2deg); }
}
@keyframes chat-slide-up {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes bubble-pop {
  from { opacity: 0; transform: scale(0.8) translateY(6px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes typing-dot {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40%            { transform: scale(1); opacity: 1; }
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(30,91,69,0.4); }
  50%       { box-shadow: 0 0 0 8px rgba(30,91,69,0); }
}

.nutri-character-wrap {
  animation: nutri-walk 6s linear infinite;
}
.nutri-body-bob {
  animation: nutri-bob 0.5s ease-in-out infinite;
}
.nutri-arm-l { animation: nutri-arm-l 0.5s ease-in-out infinite; }
.nutri-arm-r { animation: nutri-arm-r 0.5s ease-in-out infinite; }
.nutri-leg-l { animation: nutri-leg-l 0.5s ease-in-out infinite; }
.nutri-leg-r { animation: nutri-leg-r 0.5s ease-in-out infinite; }
.nutri-eye   { animation: nutri-blink 4s ease-in-out infinite; }

.nutri-float  { animation: nutri-float 3s ease-in-out infinite; }
.chat-slide-up { animation: chat-slide-up 0.3s cubic-bezier(0.16,1,0.3,1) forwards; }
.bubble-pop   { animation: bubble-pop 0.25s ease-out forwards; }
.pulse-glow   { animation: pulse-glow 2s ease-in-out infinite; }

.typing-dot { animation: typing-dot 1.4s ease-in-out infinite; }
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
`;

/* ─────────────────────────────────────────
   SVG Walking Nutri Character
───────────────────────────────────────── */
function NutriCharacter({ size = 80 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Nutri AI assistant"
    >
      <ellipse cx="40" cy="52" rx="14" ry="17" fill="#1E5B45" />
      <ellipse cx="36" cy="46" rx="5" ry="3" fill="white" fillOpacity="0.15" />
      <g className="nutri-arm-l" style={{ transformOrigin: "27px 50px" }}>
        <rect x="23" y="47" width="6" height="16" rx="3" fill="#164634" />
        <circle cx="26" cy="64" r="3.5" fill="#2E8B63" />
      </g>
      <g className="nutri-arm-r" style={{ transformOrigin: "53px 50px" }}>
        <rect x="51" y="47" width="6" height="16" rx="3" fill="#164634" />
        <circle cx="54" cy="64" r="3.5" fill="#2E8B63" />
      </g>
      <g className="nutri-leg-l" style={{ transformOrigin: "35px 69px" }}>
        <rect x="32" y="66" width="7" height="18" rx="3.5" fill="#164634" />
        <ellipse cx="35.5" cy="85" rx="6" ry="3" fill="#0f2e22" />
      </g>
      <g className="nutri-leg-r" style={{ transformOrigin: "45px 69px" }}>
        <rect x="41" y="66" width="7" height="18" rx="3.5" fill="#164634" />
        <ellipse cx="44.5" cy="85" rx="6" ry="3" fill="#0f2e22" />
      </g>
      <circle cx="40" cy="30" r="18" fill="#2E8B63" />
      <ellipse cx="35" cy="22" rx="7" ry="4" fill="white" fillOpacity="0.18" />
      <path d="M40 12 C38 6, 30 8, 32 14 C34 8, 40 12, 40 12Z" fill="#1E5B45" />
      <path d="M40 12 C42 6, 50 8, 48 14 C46 8, 40 12, 40 12Z" fill="#164634" />
      <g className="nutri-eye" style={{ transformOrigin: "35px 29px" }}>
        <ellipse cx="35" cy="29" rx="3.5" ry="4" fill="white" />
        <circle cx="35" cy="30" r="2" fill="#0f2e22" />
        <circle cx="36" cy="29" r="0.7" fill="white" />
      </g>
      <g className="nutri-eye" style={{ transformOrigin: "45px 29px" }}>
        <ellipse cx="45" cy="29" rx="3.5" ry="4" fill="white" />
        <circle cx="45" cy="30" r="2" fill="#0f2e22" />
        <circle cx="46" cy="29" r="0.7" fill="white" />
      </g>
      <path d="M34 37 Q40 42 46 37" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="29" cy="34" r="3" fill="#ff8a65" fillOpacity="0.4" />
      <circle cx="51" cy="34" r="3" fill="#ff8a65" fillOpacity="0.4" />
      <text x="56" y="18" fontSize="10" fill="#E3A02B">&#10022;</text>
    </svg>
  );
}

/* ─────────────────────────────────────────
   Typing indicator
───────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="typing-dot"
          style={{
            display: "inline-block",
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "#1E5B45",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   Main Unified AIChatBot Component
───────────────────────────────────────── */
export function AIChatBot() {
  const pathname = usePathname();
  const isProductPage = Boolean(pathname?.startsWith("/product/"));

  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState<ChatLanguage>("english");
  const [activeProduct, setActiveProduct] = useState<ActiveProductSummary | null>(null);

  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      content: GREETINGS.english,
      timestamp: 0,
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync active product from window or custom event
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).__INGRIVO_CURRENT_PRODUCT__) {
      setActiveProduct((window as any).__INGRIVO_CURRENT_PRODUCT__);
    }

    const handleProductChange = (e: any) => {
      setActiveProduct(e.detail || null);
    };

    window.addEventListener("ingrivo-current-product", handleProductChange);
    return () => {
      window.removeEventListener("ingrivo-current-product", handleProductChange);
    };
  }, [pathname]);

  // Switch greeting when language changes if no user messages sent yet
  const handleLanguageChange = (newLang: ChatLanguage) => {
    setLanguage(newLang);
    setMessages((prev) => {
      const hasUserMessage = prev.some((m) => m.role === "user");
      if (!hasUserMessage) {
        return [
          {
            id: "welcome",
            role: "assistant",
            content: GREETINGS[newLang],
            timestamp: 0,
          },
        ];
      }
      return prev;
    });
  };

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride !== undefined ? textOverride : input).trim();
      if (!text || isLoading) return;

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);
      setError(null);

      try {
        const historyMessages = [...messages, userMsg]
          .filter((m) => m.id !== "welcome")
          .map((m) => ({ role: m.role, content: m.content }));

        const pageContext = isProductPage
          ? `User is currently viewing a product detail page: ${pathname}`
          : "User is on the Pinfo homepage/app";

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: historyMessages,
            language,
            context: pageContext,
            productContext: activeProduct || undefined,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error((errData as { error?: string }).error || `HTTP ${res.status}`);
        }

        const data = (await res.json()) as { text: string };
        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.text,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Something went wrong.";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages, language, isProductPage, pathname, activeProduct]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: GREETINGS[language],
        timestamp: Date.now(),
      },
    ]);
    setError(null);
    setInput("");
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-emerald-950">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Dynamic contextual suggestions based on active product or homepage
  const activeSuggestions =
    activeProduct && activeProduct.name
      ? [
          `How clean are the ingredients in this ${activeProduct.brand || "product"}?`,
          "What do the preservatives and E-numbers do here?",
          "Compare this to clean health brands like The Whole Truth",
          "Is this suitable for regular/daily consumption?",
        ]
      : SUGGESTIONS_HOME[language];

  return (
    <>
      <style>{styles}</style>

      <div
        id="ingrivo-unified-ai-chatbot"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "24px",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "12px",
        }}
      >
        {/* Chat Window */}
        {isOpen && (
          <div
            className="chat-slide-up"
            style={{
              width: "min(400px, calc(100vw - 36px))",
              height: "540px",
              background: "rgba(255,255,255,0.98)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: "24px",
              border: "1.5px solid rgba(30,91,69,0.18)",
              boxShadow:
                "0 24px 64px -12px rgba(27,42,34,0.22), 0 4px 16px -4px rgba(30,91,69,0.12)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                background: "linear-gradient(135deg, #1E5B45 0%, #2E8B63 100%)",
                padding: "12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.18)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Bot size={17} color="white" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <p style={{ color: "white", fontWeight: 700, fontSize: "14px", margin: 0, lineHeight: 1.2 }}>
                      Nutri AI
                    </p>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        background: "rgba(255,255,255,0.2)",
                        color: "#E2FBE8",
                        padding: "1px 6px",
                        borderRadius: "8px",
                      }}
                    >
                      {activeProduct ? "Product & Brand AI" : "Food Intelligence"}
                    </span>
                  </div>
                  <p
                    style={{
                      color: "rgba(255,255,255,0.8)",
                      fontSize: "11px",
                      margin: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "#6EE7B7",
                        display: "inline-block",
                      }}
                    />
                    Pinfo AI · Food Intelligence Guide
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <button
                    onClick={resetChat}
                    title="Reset conversation"
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.15)",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
                  >
                    <RotateCcw size={12} />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    title="Close chat"
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.15)",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Language Switcher Tabs */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "rgba(0,0,0,0.15)",
                  padding: "2px",
                  borderRadius: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                    paddingLeft: "6px",
                    color: "rgba(255,255,255,0.7)",
                    fontSize: "10px",
                  }}
                >
                  <Globe size={11} />
                </div>
                {(
                  [
                    { key: "english", label: "English" },
                    { key: "hinglish", label: "Hinglish" },
                    { key: "hindi", label: "हिंदी" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => handleLanguageChange(item.key)}
                    style={{
                      flex: 1,
                      padding: "3px 8px",
                      borderRadius: "8px",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: 600,
                      transition: "all 0.15s ease",
                      background: language === item.key ? "white" : "transparent",
                      color: language === item.key ? "#1E5B45" : "rgba(255,255,255,0.85)",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Product Context Banner */}
            {activeProduct && activeProduct.name && (
              <div
                style={{
                  background: "#F0FDF4",
                  borderBottom: "1px solid #DCFCE7",
                  padding: "6px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "11px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                  <Tag size={12} color="#15803D" />
                  <span
                    style={{
                      fontWeight: 600,
                      color: "#166534",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {activeProduct.name} {activeProduct.brand ? `· ${activeProduct.brand}` : ""}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "9.5px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "#15803D",
                    background: "white",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "1px solid #BBF7D0",
                    flexShrink: 0,
                    marginLeft: "8px",
                  }}
                >
                  Active Product
                </span>
              </div>
            )}

            {/* Messages Area */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(30,91,69,0.2) transparent",
              }}
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="bubble-pop"
                  style={{
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                    gap: "8px",
                    alignItems: "flex-end",
                  }}
                >
                  {msg.role === "assistant" && (
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #1E5B45, #2E8B63)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginBottom: "2px",
                      }}
                    >
                      <Sparkles size={13} color="white" />
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: "82%",
                      padding: "10px 14px",
                      borderRadius:
                        msg.role === "user"
                          ? "18px 18px 4px 18px"
                          : "18px 18px 18px 4px",
                      background:
                        msg.role === "user"
                          ? "linear-gradient(135deg, #1E5B45, #2E8B63)"
                          : "#F3F7F5",
                      color: msg.role === "user" ? "white" : "#1B2A22",
                      fontSize: "13px",
                      lineHeight: 1.55,
                      boxShadow:
                        msg.role === "user"
                          ? "0 2px 8px rgba(30,91,69,0.25)"
                          : "0 1px 4px rgba(0,0,0,0.06)",
                      border:
                        msg.role === "assistant"
                          ? "1px solid rgba(30,91,69,0.1)"
                          : "none",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {renderContent(msg.content)}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div
                  className="bubble-pop"
                  style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #1E5B45, #2E8B63)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Sparkles size={13} color="white" />
                  </div>
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "18px 18px 18px 4px",
                      background: "#F3F7F5",
                      border: "1px solid rgba(30,91,69,0.1)",
                    }}
                  >
                    <TypingIndicator />
                  </div>
                </div>
              )}

              {error && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "12px",
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#DC2626",
                    fontSize: "12px",
                    textAlign: "center",
                  }}
                >
                  ⚠️ {error}
                  <button
                    onClick={() => setError(null)}
                    style={{
                      display: "block",
                      margin: "6px auto 0",
                      padding: "3px 10px",
                      borderRadius: "8px",
                      background: "#DC2626",
                      color: "white",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Context-aware suggestions */}
            {messages.length <= 2 && (
              <div
                style={{
                  padding: "0 12px 8px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  maxHeight: "84px",
                  overflowY: "auto",
                }}
              >
                {activeSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "100px",
                      background: "rgba(30,91,69,0.07)",
                      border: "1px solid rgba(30,91,69,0.18)",
                      color: "#1E5B45",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "rgba(30,91,69,0.14)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "rgba(30,91,69,0.07)")
                    }
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <div
              style={{
                padding: "12px 14px",
                borderTop: "1px solid rgba(228,222,195,0.8)",
                background: "rgba(255,255,255,0.95)",
                display: "flex",
                gap: "8px",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeProduct
                    ? `Ask about ${activeProduct.name || "this product"} or any brand...`
                    : language === "hindi"
                    ? "किसी भी ब्रांड या सामग्री के बारे में पूछें..."
                    : language === "hinglish"
                    ? "Kisi bhi brand ya food ke baare mein poochiye..."
                    : "Ask about any food brand, ingredient, or product..."
                }
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "14px",
                  border: "1.5px solid rgba(30,91,69,0.2)",
                  background: "#F9FBF9",
                  color: "#1B2A22",
                  fontSize: "13px",
                  outline: "none",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#1E5B45";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(30,91,69,0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(30,91,69,0.2)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={isLoading || !input.trim()}
                title="Send message"
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "12px",
                  background:
                    isLoading || !input.trim()
                      ? "rgba(30,91,69,0.3)"
                      : "linear-gradient(135deg, #1E5B45, #2E8B63)",
                  border: "none",
                  cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.2s",
                  boxShadow:
                    isLoading || !input.trim()
                      ? "none"
                      : "0 4px 12px rgba(30,91,69,0.3)",
                }}
              >
                <Send size={15} color="white" />
              </button>
            </div>
          </div>
        )}

        {/* Character Button */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0px",
            cursor: "pointer",
            userSelect: "none",
          }}
          onClick={() => setIsOpen((prev) => !prev)}
          role="button"
          aria-label={isOpen ? "Close Nutri AI chat" : "Open Nutri AI chat"}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setIsOpen((prev) => !prev);
          }}
        >
          {!isOpen && (
            <div
              style={{
                background: "linear-gradient(135deg, #1E5B45, #2E8B63)",
                color: "white",
                fontSize: "11px",
                fontWeight: 700,
                padding: "5px 12px",
                borderRadius: "12px",
                marginBottom: "6px",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 16px rgba(30,91,69,0.35)",
                position: "relative",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <MessageCircle size={12} />
                Ask Nutri AI
              </span>
              <span
                style={{
                  position: "absolute",
                  bottom: "-6px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 0,
                  height: 0,
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderTop: "6px solid #2E8B63",
                }}
              />
            </div>
          )}

          <div
            className={isOpen ? "nutri-float" : "nutri-character-wrap"}
            style={{ position: "relative" }}
          >
            {isOpen && (
              <div
                className="pulse-glow"
                style={{
                  position: "absolute",
                  inset: "-6px",
                  borderRadius: "50%",
                  background: "rgba(30,91,69,0.08)",
                  zIndex: -1,
                }}
              />
            )}
            <div className={isOpen ? "" : "nutri-body-bob"}>
              <NutriCharacter size={72} />
            </div>
            {isOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-4px",
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  background: "#E3A02B",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 6px rgba(227,160,43,0.4)",
                }}
              >
                <X size={10} color="white" />
              </div>
            )}
          </div>

          <div
            style={{
              width: "40px",
              height: "6px",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.1)",
              marginTop: "-4px",
              filter: "blur(2px)",
            }}
          />
        </div>
      </div>
    </>
  );
}

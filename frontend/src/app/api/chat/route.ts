import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";

const SYSTEM_CONTEXT = `You are Nutri 🌿, the friendly, highly knowledgeable AI food intelligence assistant for Ingrivo — a food intelligence app that helps users decode packaged food labels, ingredient lists, and nutrition facts.

You are an expert in:
1. Indian and Global Packaged Food Brands:
   - Modern D2C clean-label & health food brands (e.g., The Whole Truth, Slurrp Farm, Open Secret, Yoga Bar, Epigamia, Farmley, True Elements, Supertails, Habbit, etc.)
   - Legacy FMCG food corporations (e.g., Nestlé, Britannia, Parle, ITC, PepsiCo, Coca-Cola, Kellogg's, Haldiram's, Amul, Mother Dairy, Dabur, Marico)
   - International brands (e.g., Oatly, Liquid Death, Chobani, Beyond Meat, KIND, Clif Bar, etc.)
   - Brand origin, founders, stated mission vs real ingredient reality, and marketing claims (e.g., "100% natural", "zero sugar", "high protein", "no preservatives").
2. Ingredient Intelligence:
   - What ingredients actually are (e.g., maltodextrin, INS/E-numbers like INS 551, INS 407 carrageenan, INS 150d caramel color, palm oil, invert sugar syrup, artificial vs natural sweeteners).
   - Why manufacturers use them (preservation, shelf life, cost reduction, texture, flavor).
   - How to spot deceptive labelling or hidden sugars.
3. Nutrition Facts Analysis:
   - Energy (kcal), total sugars, added sugars, saturated fats, trans fats, sodium, dietary fiber, and protein.
   - Per 100g vs Per Serving distinctions.
4. Active Product Analysis & Comparison:
   - When the user is currently viewing a specific product on Ingrivo, its full name, brand, ingredients, and nutrition details will be provided in the context.
   - Use this real data to answer queries specifically about that product, explain its specific ingredients, compare it against benchmark brands the user asks about, and assess how clean or processed it is.

Guidelines:
- Tone: Friendly, approachable, sharp, objective, and educational.
- Communication: Clear and easy to read. Use bullet points and **bold highlights** for readability.
- Multi-language: Adapt fluently to the requested language (English, Hinglish, or Hindi).
- Balance & Objectivity: Never give medical or clinical dietary advice. Do not label foods as "poison" or "evil"; use factual statements (e.g., "contains refined palm olein", "contains 24g added sugars per 100g, which is high compared to typical WHO recommendations").`;

/**
 * Lightweight helper to fetch sample brand products from Open Food Facts if helpful
 */
async function searchBrandFromOFF(query: string): Promise<string | null> {
  try {
    const clean = query.replace(/[^\w\s]/gi, "").trim();
    if (clean.length < 3) return null;
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      clean
    )}&search_simple=1&action=process&json=1&page_size=3`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Ingrivo/0.1.0 (yaadv@example.com)" },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.products || data.products.length === 0) return null;

    const items = data.products.slice(0, 3).map((p: any) => {
      const name = p.product_name || "Unknown Product";
      const brand = p.brands || "";
      const ing = p.ingredients_text ? ` (Ingredients: ${p.ingredients_text.slice(0, 100)}...)` : "";
      return `- ${name}${brand ? ` by ${brand}` : ""}${ing}`;
    });

    return items.join("\n");
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Gemini API key not configured on this server." },
      { status: 500 }
    );
  }

  let body: {
    messages?: Array<{ role: string; content: string }>;
    language?: "english" | "hinglish" | "hindi";
    context?: string;
    productContext?: {
      name?: string;
      brand?: string;
      ingredients?: string;
      nutrition?: Record<string, any>;
      allergens?: string[];
      basis?: string;
    };
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { messages, language = "english", context, productContext } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No messages provided." }, { status: 400 });
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";

  // Check if query is asking about a brand or product search
  let offEvidence = "";
  const isBrandQuery =
    /(brand|company|products|who makes|founder|made by|tell me about|what is)/i.test(
      lastUserMessage
    );
  if (isBrandQuery && lastUserMessage.length > 5) {
    const offResults = await searchBrandFromOFF(lastUserMessage);
    if (offResults) {
      offEvidence = `\n\nOpen Food Facts Database Reference for this query:\n${offResults}`;
    }
  }

  let languageInstruction = "Respond in clear, engaging English.";
  if (language === "hinglish") {
    languageInstruction =
      "Respond in friendly conversational Hinglish (Hindi written in Roman/English alphabet, mixed with simple English food terms, e.g., 'Is brand ne 2019 mein start kiya tha. Isme sugar thodi zyada hai lekin fiber achha hai!').";
  } else if (language === "hindi") {
    languageInstruction =
      "Respond in fluent, clear Hindi (हिन्दी) using Devanagari script with simple, easy-to-understand food & nutrition terms.";
  }

  let productDetailsText = "";
  if (productContext && productContext.name) {
    productDetailsText = `\n\nActive Product on User's Screen:
- Product Name: ${productContext.name || "N/A"}
- Brand: ${productContext.brand || "N/A"}
- Ingredients: ${productContext.ingredients || "Not provided / Unknown"}
- Nutrition Basis: ${productContext.basis || "per 100g"}
- Nutrition Values: ${
      productContext.nutrition
        ? Object.entries(productContext.nutrition)
            .filter(([_, v]) => v !== null && v !== undefined)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : "N/A"
    }
- Declared Allergens: ${
      productContext.allergens && productContext.allergens.length > 0
        ? productContext.allergens.join(", ")
        : "None declared"
    }
(When the user asks questions referring to "this product", "these ingredients", or asks to compare it to another brand, use the above exact data.)`;
  }

  const effectiveSystemContext = `${SYSTEM_CONTEXT}\n\nLanguage Instruction:\n${languageInstruction}${
    context ? `\n\nNavigation Context:\n${context}` : ""
  }${productDetailsText}${offEvidence}`;

  // Build Gemini contents array (system as first user turn, then alternating)
  const contents = [
    {
      role: "user",
      parts: [{ text: effectiveSystemContext }],
    },
    {
      role: "model",
      parts: [
        {
          text:
            language === "hindi"
              ? "नमस्ते! मैं नूट्री (Nutri) हूँ, आपका इनग्रिवो फ़ूड असिस्टेंट। आप किसी भी ब्रांड, उत्पाद या पोषण के बारे में क्या जानना चाहते हैं?"
              : language === "hinglish"
              ? "Hi! Main hoon Nutri 🌿 — aapka Ingrivo food assistant! Kisi bhi brand, product ya nutrition label ke baare mein poochiye."
              : "Hi! I'm Nutri, your Ingrivo food assistant. I'm here to help you understand packaged food brands, ingredients, and nutrition facts. What would you like to know?",
        },
      ],
    },
    ...messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
  ];

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      return NextResponse.json(
        { error: "Failed to get response from Gemini." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I'm sorry, I couldn't generate a response right now. Please try again!";

    return NextResponse.json({ text });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { X, Check, ShieldAlert, Sparkles, Heart } from "lucide-react";

interface DietaryProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DIETARY_OPTIONS = [
  { id: "vegetarian", label: "Vegetarian", icon: "🌱" },
  { id: "vegan", label: "Vegan", icon: "🌿" },
  { id: "gluten_free", label: "Gluten-Free", icon: "🌾" },
  { id: "halal", label: "Halal", icon: "☪️" },
  { id: "jain", label: "Jain", icon: "🕉️" },
  { id: "keto", label: "Keto / Low Carb", icon: "🥑" },
  { id: "low_sugar", label: "Low Sugar", icon: "🍬" },
  { id: "low_sodium", label: "Low Sodium", icon: "🧂" },
  { id: "high_protein", label: "High Protein", icon: "💪" },
];

const ALLERGEN_OPTIONS = [
  { id: "peanuts", label: "Peanuts", icon: "🥜" },
  { id: "tree_nuts", label: "Tree Nuts (Almond, Cashew, Walnut)", icon: "🌰" },
  { id: "milk", label: "Milk & Dairy", icon: "🥛" },
  { id: "soy", label: "Soy & Soybeans", icon: "🫘" },
  { id: "wheat", label: "Wheat & Gluten", icon: "🍞" },
  { id: "eggs", label: "Eggs", icon: "🥚" },
  { id: "fish", label: "Fish", icon: "🐟" },
  { id: "shellfish", label: "Crustaceans / Shellfish", icon: "🦐" },
];

export function DietaryProfileModal({ isOpen, onClose }: DietaryProfileModalProps) {
  const { preferences, updatePreferences } = useAuth();

  const [dietary, setDietary] = useState<string[]>(preferences?.dietary_preferences || []);
  const [allergens, setAllergens] = useState<string[]>(preferences?.allergens || []);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const toggleDietary = (id: string) => {
    setDietary((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleAllergen = (id: string) => {
    setAllergens((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePreferences({
        dietary_preferences: dietary,
        allergens: allergens,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-[#FBF8F2] border border-[#E4DEC3] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-[#EFEAE0] border-b border-[#E4DEC3] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1E5B45] text-white flex items-center justify-center">
              <Heart className="w-4 h-4 fill-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1B2A22]">Dietary & Allergen Profile</h3>
              <p className="text-[11px] text-[#64748B]">Personalize your ingredient warnings & suitability tags</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1B2A22] hover:bg-black/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Section 1: Dietary Preferences */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Sparkles className="w-4 h-4 text-[#1E5B45]" />
              <h4 className="text-xs font-bold text-[#1B2A22] uppercase tracking-wider">Dietary Preferences</h4>
            </div>
            <p className="text-xs text-[#64748B] mb-3">
              Pinfo will flag foods that conflict with your chosen diets.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DIETARY_OPTIONS.map((opt) => {
                const isSelected = dietary.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleDietary(opt.id)}
                    className={`flex items-center gap-2 p-2.5 text-xs font-medium rounded-xl border transition-all text-left ${
                      isSelected
                        ? "bg-[#1E5B45]/10 border-[#1E5B45] text-[#1E5B45] shadow-xs font-semibold"
                        : "bg-white border-[#E4DEC3] text-[#1B2A22] hover:border-[#1E5B45]/50"
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span className="flex-1 truncate">{opt.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[#1E5B45]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Allergen Alerts */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <h4 className="text-xs font-bold text-[#1B2A22] uppercase tracking-wider">Allergen Safety Alerts</h4>
            </div>
            <p className="text-xs text-[#64748B] mb-3">
              Get high-priority alerts on product pages when any of these ingredients or traces appear.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALLERGEN_OPTIONS.map((opt) => {
                const isSelected = allergens.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleAllergen(opt.id)}
                    className={`flex items-center gap-2.5 p-2.5 text-xs font-medium rounded-xl border transition-all text-left ${
                      isSelected
                        ? "bg-red-50 border-red-400 text-red-800 shadow-xs font-semibold"
                        : "bg-white border-[#E4DEC3] text-[#1B2A22] hover:border-red-300"
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span className="flex-1 truncate">{opt.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-red-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#EFEAE0] border-t border-[#E4DEC3] flex items-center justify-between">
          <span className="text-xs text-[#64748B]">
            {dietary.length + allergens.length} preferences selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-[#64748B] hover:text-[#1B2A22] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 text-xs font-bold text-white bg-[#1E5B45] hover:bg-[#164634] rounded-lg shadow-xs transition-all disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

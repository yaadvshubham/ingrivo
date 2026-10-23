"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { DietaryProfileModal } from "@/components/auth/DietaryProfileModal";
import {
  User,
  LogOut,
  Sliders,
  History,
  Bookmark,
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
  Crown,
  LayoutDashboard,
} from "lucide-react";

export function UserNavButton() {
  const { user, isAdmin, openAuthModal, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!mounted || !user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-white border border-[#D5CEB8] text-[#1B2A22] hover:bg-[#F2EFE8] hover:border-[#1E5B45] shadow-xs hover:shadow-md transition-all active:scale-95"
      >
        <User className="h-3.5 w-3.5 text-[#1E5B45]" />
        <span>Sign In</span>
      </Link>
    );
  }

  const initial = (user.name || user.email || "U")[0].toUpperCase();

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="inline-flex items-center gap-2 px-2.5 py-1 text-xs font-semibold rounded-xl bg-white/90 border border-[#D5CEB8] text-[#1B2A22] hover:border-[#1E5B45] shadow-xs transition-all hover:shadow-md"
          aria-expanded={dropdownOpen}
          aria-haspopup="true"
        >
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.name || "User"}
              className="w-5 h-5 rounded-full object-cover border border-[#1E5B45]"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-[#1E5B45] text-white flex items-center justify-center text-[10px] font-bold">
              {initial}
            </div>
          )}
          <span className="max-w-[100px] truncate text-left">{user.name || user.email.split("@")[0]}</span>
          <ChevronDown className="w-3 h-3 text-[#64748B]" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-60 bg-[#FBF8F2] border border-[#E4DEC3] rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* User Info Header */}
            <div className="px-3.5 py-2.5 border-b border-[#E4DEC3]/60">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#1B2A22] truncate">{user.name || "Member"}</span>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[#1E5B45] text-white">
                    <Crown className="w-2.5 h-2.5 text-amber-300" />
                    Super Admin
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#64748B] truncate mt-0.5">{user.email}</div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-[#1E5B45] font-medium">
                <ShieldCheck className="w-3 h-3" />
                <span>Verified Account</span>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#1E5B45] to-[#164634] hover:from-[#164634] hover:to-[#0f3024] transition-all rounded-lg mx-1.5 my-1 shadow-sm"
                >
                  <LayoutDashboard className="w-4 h-4 text-amber-300" />
                  <span>Admin Control Panel</span>
                </Link>
              )}

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  setProfileModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#1B2A22] hover:bg-[#EFEAE0] transition-colors text-left"
              >
                <Sliders className="w-3.5 h-3.5 text-[#1E5B45]" />
                <span>Dietary & Allergen Profile</span>
              </button>

              <Link
                href="/history"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#1B2A22] hover:bg-[#EFEAE0] transition-colors"
              >
                <History className="w-3.5 h-3.5 text-[#1E5B45]" />
                <span>Scan History</span>
              </Link>

              <Link
                href="/history"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#1B2A22] hover:bg-[#EFEAE0] transition-colors"
              >
                <Bookmark className="w-3.5 h-3.5 text-[#1E5B45]" />
                <span>Saved Products</span>
              </Link>
            </div>

            {/* Sign Out */}
            <div className="border-t border-[#E4DEC3]/60 pt-1">
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors text-left"
              >
                <LogOut className="w-3.5 h-3.5 text-red-600" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <DietaryProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </>
  );
}

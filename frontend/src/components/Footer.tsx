import React from "react";
import Link from "next/link";
import { Disclaimer } from "@/components/Disclaimer";

export function Footer() {
  return (
    <footer className="w-full border-t border-[#E4DEC3] bg-[#EFECE4]/40 mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#1E5B45]">Ingrivo</p>
            <p className="text-xs text-[#5E6B63]">
              Know what you eat. Understand what you buy.
            </p>
          </div>
          <div className="flex gap-4 text-xs text-[#5E6B63]">
            <Link href="/about" className="hover:text-[#1E5B45] underline underline-offset-4">
              About & Methodology
            </Link>
          </div>
        </div>

        <div className="border-t border-[#E4DEC3]/60 pt-4 space-y-2">
          <Disclaimer />
          <p className="text-xs text-[#5E6B63] leading-relaxed">
            Product data, when shown, comes from Open Food Facts (community-contributed, ODbL).
          </p>
        </div>
      </div>
    </footer>
  );
}

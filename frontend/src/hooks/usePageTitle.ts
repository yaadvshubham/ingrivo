"use client";

import { useEffect } from "react";

export function usePageTitle(title: string): void {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = `${title} | Ingrivo`;
    }
  }, [title]);
}

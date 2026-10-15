"use client";

import { useEffect, useState } from "react";
import { loadStaticJson } from "@/lib/use-static-json";

/**
 * The official explanations behind hero notes, keyed "heroId:relation".
 * Loaded once, and only when a page has notes to explain.
 */
export function useNoteTexts(needed: boolean): Record<string, string> | null {
  const [texts, setTexts] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (!needed || texts) return;
    let current = true;
    loadStaticJson<Record<string, string>>("/data/v1/hero-notes").then(
      (data) => current && setTexts(data),
      // Without the texts the notes still show, just unexplained.
      () => {},
    );
    return () => {
      current = false;
    };
  }, [needed, texts]);
  return texts;
}

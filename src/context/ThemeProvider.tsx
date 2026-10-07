"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface DesignTokens {
  bgPrimary: string;
  bgSurface: string;
  bgSurfaceHover: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  btnBg: string;
  btnText: string;
  borderColor: string;
  borderRadius: string;
  typographyFont: string;
  shadows: string;
}

const defaultTokens: DesignTokens = {
  bgPrimary: "#08080A",
  bgSurface: "#121215",
  bgSurfaceHover: "#1B1B20",
  textPrimary: "#F4F4F5",
  textMuted: "#9CA3AF",
  accent: "#E2E8F0",
  btnBg: "#FFFFFF",
  btnText: "#000000",
  borderColor: "rgba(255, 255, 255, 0.12)",
  borderRadius: "0px",
  typographyFont: "inter",
  shadows: "none",
};

interface ThemeContextType {
  tokens: DesignTokens;
  updateTokens: (newTokens: Partial<DesignTokens>) => void;
  saveTokens: (tokensToSave: DesignTokens) => Promise<boolean>;
  resetTokens: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  tokens: defaultTokens,
  updateTokens: () => {},
  saveTokens: async () => false,
  resetTokens: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] = useState<DesignTokens>(defaultTokens);

  useEffect(() => {
    async function loadDesignSystem() {
      try {
        const res = await fetch("/api/settings/design");
        if (res.ok) {
          const data = await res.json();
          if (data?.theme) {
            setTokens((prev) => ({ ...prev, ...data.theme }));
          }
        }
      } catch (err) {
        console.error("Failed loading theme settings", err);
      }
    }
    loadDesignSystem();
  }, []);

  // Apply CSS variables to root element
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--bg-primary", tokens.bgPrimary);
    root.style.setProperty("--bg-surface", tokens.bgSurface);
    root.style.setProperty("--bg-surface-hover", tokens.bgSurfaceHover);
    root.style.setProperty("--text-primary", tokens.textPrimary);
    root.style.setProperty("--text-muted", tokens.textMuted);
    root.style.setProperty("--color-accent", tokens.accent);
    root.style.setProperty("--btn-bg", tokens.btnBg);
    root.style.setProperty("--btn-text", tokens.btnText);
    root.style.setProperty("--border-color", tokens.borderColor);
    root.style.setProperty("--radius", tokens.borderRadius);
  }, [tokens]);

  const updateTokens = (newTokens: Partial<DesignTokens>) => {
    setTokens((prev) => ({ ...prev, ...newTokens }));
  };

  const saveTokens = async (tokensToSave: DesignTokens) => {
    try {
      const res = await fetch("/api/settings/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: tokensToSave }),
      });
      if (res.ok) {
        setTokens(tokensToSave);
        return true;
      }
    } catch (err) {
      console.error("Failed saving design settings", err);
    }
    return false;
  };

  const resetTokens = () => {
    setTokens(defaultTokens);
  };

  return (
    <ThemeContext.Provider value={{ tokens, updateTokens, saveTokens, resetTokens }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

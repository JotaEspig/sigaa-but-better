import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Scheme = "light" | "dark";

/**
 * Extra palettes, on top of the default light/dark themes. Colors live in
 * index.css under `[data-palette="<id>"]`; here is only what the UI needs.
 */
export const PALETTES = [
  { id: "lavender-dusk", label: "Lavender Dusk", scheme: "dark", hint: "Lavanda ao entardecer" },
  { id: "dusk-ember", label: "Dusk Ember", scheme: "dark", hint: "Brasa no crepúsculo" },
  { id: "everforest", label: "Everforest", scheme: "dark", hint: "Floresta aconchegante" },
  { id: "kanagawa-wave", label: "Kanagawa Wave", scheme: "dark", hint: "A grande onda em azul e areia" },
  { id: "neon-vibes", label: "Neon Vibes", scheme: "dark", hint: "Ciano e rosa neon" },
  { id: "oxo-carbon", label: "Oxo Carbon", scheme: "dark", hint: "Preto e rosa elétrico" },
  { id: "pixel-dream", label: "Pixel Dream", scheme: "dark", hint: "Dourado e pixels retrô" },
  { id: "gruvbox-dark", label: "Gruvbox Dark", scheme: "dark", hint: "Retrô e quentinho" },
  { id: "catppuccin-mocha", label: "Catppuccin Mocha", scheme: "dark", hint: "Pastel suave" },
  { id: "dracula", label: "Dracula", scheme: "dark", hint: "Roxo clássico" },
  { id: "tokyo-night", label: "Tokyo Night", scheme: "dark", hint: "Luzes de Tóquio à noite" },
  { id: "one-dark-pro", label: "One Dark Pro", scheme: "dark", hint: "O clássico do Atom" },
  { id: "synthwave-84", label: "SynthWave ’84", scheme: "dark", hint: "Neon dos anos 80" },
  { id: "cyberpunk-2077", label: "2077", scheme: "dark", hint: "Amarelo e ciano de Night City" },
  { id: "nord", label: "Nord", scheme: "dark", hint: "Ártico e azulado" },
  { id: "rose-pine", label: "Rosé Pine", scheme: "dark", hint: "Rosé, pinho e lua" },
  { id: "solarized-dark", label: "Solarized Dark", scheme: "dark", hint: "Cores calibradas" },
  { id: "high-contrast", label: "Alto contraste", scheme: "dark", hint: "Máxima legibilidade" },
  { id: "gruvbox-light", label: "Gruvbox Light", scheme: "light", hint: "Papel envelhecido" },
  { id: "catppuccin-latte", label: "Catppuccin Latte", scheme: "light", hint: "Pastel claro" },
  { id: "solarized-light", label: "Solarized Light", scheme: "light", hint: "Creme calibrado" },
  { id: "bolsonaro", label: "Bolsonaro", scheme: "light", hint: "Verde e amarelo" },
  { id: "lula", label: "Lula", scheme: "light", hint: "Vermelho e branco" },
] as const satisfies readonly { id: string; label: string; scheme: Scheme; hint: string }[];

export type Palette = (typeof PALETTES)[number];
export type PaletteId = Palette["id"];
export type ThemeChoice = "system" | Scheme | PaletteId;

// Keep in sync with public/theme-init.js, which applies the theme before paint.
const STORAGE_KEY = "sbb-theme";
const SCHEME_KEY = "sbb-theme-scheme";

function findPalette(id: string | null): Palette | undefined {
  return PALETTES.find((p) => p.id === id);
}

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
    const p = findPalette(v);
    if (p) return p.id;
  } catch {
    // Storage may be blocked (private mode); fall back to system.
  }
  return "system";
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

interface ThemeCtx {
  choice: ThemeChoice;
  /** Light or dark: drives `data-theme`, the `dark:` variant and per-class chip colors. */
  resolved: Scheme;
  /** The extra palette in use, if any. */
  palette: Palette | undefined;
  setChoice: (c: ThemeChoice) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

/**
 * Always writes the *resolved* scheme to <html data-theme> (and the extra
 * palette, if any, to <html data-palette>), so CSS only needs attribute
 * selectors. public/theme-init.js does the same before paint.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const palette = findPalette(choice);
  const resolved: Scheme = palette ? palette.scheme : choice === "system" ? (systemDark ? "dark" : "light") : (choice as Scheme);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    if (palette) root.setAttribute("data-palette", palette.id);
    else root.removeAttribute("data-palette");
    const color = palette ? getComputedStyle(root).getPropertyValue("--bar").trim() : resolved === "dark" ? "#0b0b0d" : "#2f9e41";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
  }, [resolved, palette]);

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c);
    try {
      const p = findPalette(c);
      if (c === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, c);
      if (p) localStorage.setItem(SCHEME_KEY, p.scheme);
      else localStorage.removeItem(SCHEME_KEY);
    } catch {
      // Ignore: the choice still applies for this visit.
    }
  }, []);

  const value = useMemo(() => ({ choice, resolved, palette, setChoice }), [choice, resolved, palette, setChoice]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used inside ThemeProvider");
  return v;
}

// Branding label rendering. Bot Embed/text MUST go through renderLabel so
// the user can rename "Signals" / "EXP" via BrandingConfig at any time.

export interface Branding {
  signalsLabel: string;
  xpLabel: string;
  currencyEmoji: string;
  accentColor: string;
}

export const DEFAULT_BRANDING: Branding = {
  signalsLabel: "Signals",
  xpLabel: "EXP",
  currencyEmoji: "✨",
  accentColor: "#c77dff",
};

const PLACEHOLDERS = ["{signals}", "{xp}", "{emoji}", "{accent}"] as const;
type Placeholder = (typeof PLACEHOLDERS)[number];

const PLACEHOLDER_RE = /\{(signals|xp|emoji|accent)\}/g;

/**
 * Replace `{signals}`, `{xp}`, `{emoji}`, `{accent}` in `template` using
 * the given branding. Unknown placeholders are left intact.
 */
export function renderLabel(template: string, branding: Branding): string {
  return template.replace(PLACEHOLDER_RE, (_, key: string) => {
    switch (key) {
      case "signals":
        return branding.signalsLabel;
      case "xp":
        return branding.xpLabel;
      case "emoji":
        return branding.currencyEmoji;
      case "accent":
        return branding.accentColor;
      default:
        return _;
    }
  });
}

export function parseAccentColor(hex: string): number {
  const cleaned = hex.replace(/^#/, "");
  const n = parseInt(cleaned, 16);
  return Number.isFinite(n) ? n : 0xc77dff;
}

export type { Placeholder };

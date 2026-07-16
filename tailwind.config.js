/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      // ── Standphill design-system colours ────────────────────────────────
      colors: {
        "surface":                    "#fcf9f8",
        "surface-dim":                "#dcd9d9",
        "surface-bright":             "#fcf9f8",
        "surface-container-lowest":   "#ffffff",
        "surface-container-low":      "#f6f3f2",
        "surface-container":          "#f0edec",
        "surface-container-high":     "#eae7e7",
        "surface-container-highest":  "#e5e2e1",
        "on-surface":                 "#1c1b1b",
        "on-surface-variant":         "#424656",
        "inverse-surface":            "#313030",
        "inverse-on-surface":         "#f3f0ef",
        "outline":                    "#737687",
        "outline-variant":            "#c3c6d8",
        "surface-tint":               "#0052dd",
        "surface-variant":            "#e5e2e1",
        "background":                 "#fcf9f8",
        "on-background":              "#1c1b1b",

        // Primary – Professional Blue
        "primary":                    "#004ccd",
        "on-primary":                 "#ffffff",
        "primary-container":          "#0f62fe",
        "on-primary-container":       "#f3f3ff",
        "inverse-primary":            "#b4c5ff",
        "primary-fixed":              "#dbe1ff",
        "primary-fixed-dim":          "#b4c5ff",
        "on-primary-fixed":           "#00174c",
        "on-primary-fixed-variant":   "#003da9",

        // Secondary – Neutral slate
        "secondary":                  "#585f66",
        "on-secondary":               "#ffffff",
        "secondary-container":        "#dce3eb",
        "on-secondary-container":     "#5e656c",
        "secondary-fixed":            "#dce3eb",
        "secondary-fixed-dim":        "#c0c7cf",
        "on-secondary-fixed":         "#151c22",
        "on-secondary-fixed-variant": "#41484e",

        // Tertiary – Deep navy-blue
        "tertiary":                   "#304db9",
        "on-tertiary":                "#ffffff",
        "tertiary-container":         "#4b67d3",
        "on-tertiary-container":      "#f3f3ff",
        "tertiary-fixed":             "#dde1ff",
        "tertiary-fixed-dim":         "#b8c4ff",
        "on-tertiary-fixed":          "#001453",
        "on-tertiary-fixed-variant":  "#1a3ca8",

        // Error
        "error":                      "#ba1a1a",
        "on-error":                   "#ffffff",
        "error-container":            "#ffdad6",
        "on-error-container":         "#93000a",
      },

      // ── Border radius (design-system scale) ─────────────────────────────
      borderRadius: {
        DEFAULT: "0.25rem",   // 4 px – buttons & inputs
        lg:      "0.5rem",    // 8 px – cards & widgets
        xl:      "0.75rem",   // 12 px – floating / FAB
        full:    "9999px",
      },

      // ── Spacing additions (4-px grid extras) ────────────────────────────
      spacing: {
        "gutter":           "16px",
        "unit":             "4px",
        "margin-mobile":    "16px",
        "margin-desktop":   "32px",
        "container-max":    "1440px",
      },

      // ── Typography ──────────────────────────────────────────────────────
      fontFamily: {
        sans:         ["Inter", "system-ui", "sans-serif"],
        mono:         ["JetBrains Mono", "monospace"],
        "display":    ["Inter"],
        "headline-lg":["Inter"],
        "headline-md":["Inter"],
        "body-lg":    ["Inter"],
        "body-md":    ["Inter"],
        "body-sm":    ["Inter"],
        "label-caps": ["Inter"],
        "data-mono":  ["JetBrains Mono"],
      },

      fontSize: {
        "display":    ["36px", { lineHeight: "44px",  letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg":["28px", { lineHeight: "36px",  letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-md":["20px", { lineHeight: "28px",  fontWeight: "600" }],
        "body-lg":    ["16px", { lineHeight: "24px",  fontWeight: "400" }],
        "body-md":    ["14px", { lineHeight: "20px",  fontWeight: "400" }],
        "body-sm":    ["12px", { lineHeight: "16px",  fontWeight: "400" }],
        "label-caps": ["11px", { lineHeight: "16px",  letterSpacing: "0.05em", fontWeight: "600" }],
        "data-mono":  ["13px", { lineHeight: "18px",  fontWeight: "400" }],
      },
    },
  },
  plugins: [],
};

import {
  createTheme,
  Tooltip,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from "@mantine/core";

/**
 * Loctary Design System theme. The warm palette, type, radii and shadows live
 * as CSS custom properties in `styles/loctary-tokens.css`; this file maps
 * Mantine onto them so every stock component adopts the brand. Amber is the
 * single primary; moss is the secondary/success green.
 */
const amber: MantineColorsTuple = [
  "#FFF7EC",
  "#FEEACF",
  "#FBD6A4",
  "#F8C176",
  "#F5AC4B",
  "#F39A29",
  "#F08C00",
  "#D2780A",
  "#A8600E",
  "#824B0C",
];

const moss: MantineColorsTuple = [
  "#F4FBE8",
  "#E5F5CA",
  "#D0ED9F",
  "#B7E371",
  "#9FD74A",
  "#88CA27",
  "#74B816",
  "#5E9512",
  "#487211",
  "#36540E",
];

export const theme = createTheme({
  primaryColor: "amber",
  primaryShade: { light: 6, dark: 5 },
  colors: { amber, moss },
  // Switches/checkboxes/radios show a pointer cursor like buttons do.
  cursorType: "pointer",
  defaultRadius: "md",
  radius: { xs: "6px", sm: "8px", md: "12px", lg: "16px", xl: "24px" },
  shadows: {
    xs: "var(--shadow-xs)",
    sm: "var(--shadow-sm)",
    md: "var(--shadow-md)",
    lg: "var(--shadow-lg)",
    xl: "var(--shadow-xl)",
  },
  fontFamily:
    '"Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif',
  fontFamilyMonospace:
    '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  headings: {
    fontFamily:
      '"Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    fontWeight: "700",
  },
  components: {
    // Global tooltip style: no arrow, "pop" transition.
    Tooltip: Tooltip.extend({
      defaultProps: {
        withArrow: false,
        transitionProps: { transition: "pop" },
      },
    }),
  },
});

/**
 * Point Mantine's surface/text/border variables at the warm tokens. The token
 * vars themselves switch light↔dark via `[data-mantine-color-scheme]`, but the
 * mappings must live in the `light`/`dark` tiers (not `variables`) so they
 * outrank Mantine's own scheme-specific defaults.
 */
const mapped = {
  "--mantine-color-body": "var(--color-bg)",
  "--mantine-color-text": "var(--text-primary)",
  "--mantine-color-dimmed": "var(--text-secondary)",
  "--mantine-color-default": "var(--color-surface)",
  "--mantine-color-default-hover": "var(--color-surface-hover)",
  "--mantine-color-default-border": "var(--color-border)",
  "--mantine-color-anchor": "var(--text-link)",
};

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: mapped,
  dark: mapped,
});

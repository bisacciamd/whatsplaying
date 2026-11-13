import { createTheme } from "@mui/material/styles";

/**
 * Dark, art-forward theme tuned for a large TV viewed from across the room.
 * White/translucent-white accents so MUI controls (icons, sliders, toggles) sit
 * quietly on top of album art instead of fighting it with the default blue/purple,
 * and a larger type scale for glanceable legibility at 2–4 m.
 */
export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#ffffff" },
    secondary: { main: "rgba(255,255,255,0.75)" },
    background: { default: "#000000", paper: "#0b0b0d" },
    text: { primary: "#ffffff", secondary: "rgba(255,255,255,0.7)" },
  },
  typography: {
    h1: { fontSize: "4.5rem", fontWeight: 600, letterSpacing: "-0.02em" },
    h2: { fontSize: "3.25rem", fontWeight: 600, letterSpacing: "-0.02em" },
    h3: { fontSize: "2.5rem", fontWeight: 600, letterSpacing: "-0.01em" },
    h4: { fontSize: "2rem", fontWeight: 500 },
    h5: { fontSize: "1.6rem", fontWeight: 500 },
    subtitle1: { fontSize: "1.35rem" },
  },
});

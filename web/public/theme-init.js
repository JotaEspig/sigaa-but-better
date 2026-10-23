// Applies the theme before first paint. Lives in a file (not inline) because
// the BFF's CSP forbids inline scripts. Mirrors src/lib/theme.tsx.
(function () {
  var t = null;
  var s = null;
  try {
    t = localStorage.getItem("sbb-theme");
    s = localStorage.getItem("sbb-theme-scheme");
  } catch (e) {}
  var root = document.documentElement;
  if (t && t !== "light" && t !== "dark" && (s === "light" || s === "dark")) {
    // An extra palette: its id plus the light/dark scheme it is built on.
    root.setAttribute("data-palette", t);
    t = s;
  }
  if (t !== "light" && t !== "dark") {
    t = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  root.setAttribute("data-theme", t);
})();

// Applies the theme before first paint. Lives in a file (not inline) because
// the BFF's CSP forbids inline scripts. Mirrors src/lib/theme.tsx.
(function () {
  var t = null;
  try {
    t = localStorage.getItem("sbb-theme");
  } catch (e) {}
  if (t !== "light" && t !== "dark") {
    t = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", t);
})();

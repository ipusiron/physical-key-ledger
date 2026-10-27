// theme-init: decide the theme before the first paint. Loaded synchronously in <head>
// as a classic script (not a module), right after the stylesheet.
//
// The default palette in css/style.css is dark; the light one is selected by
// data-theme="light" on <body> (and <html> for the background). When this was
// decided in ui.js, which is a module and waits for IndexedDB, the page was
// painted dark first and then switched to light.
//
// The saved choice (localStorage "theme") wins; otherwise the OS setting is
// followed (dark only when the OS prefers dark). Blocked storage does not stop it.
(function (global) {
  "use strict";

  var doc = global.document;
  var saved = null;
  try {
    saved = global.localStorage.getItem("theme");
  } catch (e) {
    saved = null;
  }

  var prefersDark = !!(global.matchMedia && global.matchMedia("(prefers-color-scheme: dark)").matches);
  var theme = (saved === "light" || saved === "dark") ? saved : (prefersDark ? "dark" : "light");

  var root = doc.documentElement;
  root.setAttribute("data-theme", theme);

  // <body> does not exist yet while <head> runs. Set the attribute as soon as the
  // parser inserts it: mutation observers run as a microtask, before the browser paints.
  function markBody() {
    if (!doc.body) return false;
    doc.body.setAttribute("data-theme", theme);
    return true;
  }
  if (!markBody() && typeof global.MutationObserver === "function") {
    var observer = new global.MutationObserver(function () {
      if (markBody()) observer.disconnect();
    });
    observer.observe(root, { childList: true });
  }
})(typeof window !== "undefined" ? window : globalThis);

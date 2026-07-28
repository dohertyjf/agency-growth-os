/*
 * Agency Growth OS — embed loader (works for any of the public tools).
 *
 * Lead Goal tool (hmldin.com):
 *   <div data-jd-embed data-path="/lead-goal"></div>
 *   <script src="https://YOUR-APP-DOMAIN/embed.js" async></script>
 *
 * Capacity tool (legacy, still supported):
 *   <div id="jd-capacity-calculator"></div>
 *   <script src="https://YOUR-APP-DOMAIN/embed.js" async></script>
 *
 * The script runs in the host page's context. It auto-resizes the iframe to
 * its content, forwards ?name/?email/?agency from the host URL for prefill,
 * takes the iframe full-screen while a booking modal is open (so it centers on
 * the real viewport), and navigates the whole tab on a post-submit redirect.
 */
(function () {
  "use strict";

  var self =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();
  var origin = new URL(self.src).origin;

  // Find (or create) the mount point.
  var mount =
    document.querySelector("[data-jd-embed]") ||
    document.getElementById("jd-lead-goal-calculator") ||
    document.getElementById("jd-capacity-calculator");
  if (!mount) {
    mount = document.createElement("div");
    self.parentNode.insertBefore(mount, self.nextSibling);
  }
  var path = mount.getAttribute("data-path") || "/calculator";

  // Forward known contact params from the host page URL for prefill.
  var hostParams = new URLSearchParams(window.location.search);
  var params = new URLSearchParams();
  ["name", "email", "agency"].forEach(function (k) {
    var v = hostParams.get(k);
    if (v) params.set(k, v);
  });
  params.set("embed", "1");

  var iframe = document.createElement("iframe");
  iframe.src = origin + path + "?" + params.toString();
  iframe.title = "Agency Growth OS";
  iframe.setAttribute("scrolling", "no");
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.display = "block";
  iframe.style.minHeight = "480px";
  mount.appendChild(iframe);

  var lastHeight = null;
  var modalOpen = false;

  function applyInline() {
    iframe.style.position = "";
    iframe.style.top = iframe.style.left = iframe.style.right = iframe.style.bottom = "";
    iframe.style.zIndex = "";
    iframe.style.height = (lastHeight || 480) + "px";
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  function applyFullscreen() {
    iframe.style.position = "fixed";
    iframe.style.top = iframe.style.left = iframe.style.right = iframe.style.bottom = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.zIndex = "2147483647";
    // Stop the host page scrolling behind the modal.
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  // Only trust messages from our own app origin.
  window.addEventListener("message", function (e) {
    if (e.origin !== origin || !e.data || typeof e.data !== "object") return;

    if (e.data.type === "jd-calc:height" && typeof e.data.height === "number") {
      lastHeight = e.data.height;
      if (!modalOpen) iframe.style.height = e.data.height + "px";
    }

    if (e.data.type === "jd-calc:modal") {
      modalOpen = !!e.data.open;
      if (modalOpen) applyFullscreen();
      else applyInline();
    }

    if (e.data.type === "jd-calc:redirect" && typeof e.data.url === "string") {
      window.location.href = e.data.url;
    }
  });
})();

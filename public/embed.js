/*
 * Agency Capacity Calculator — embed loader.
 *
 * Install on any page (e.g. johnfdoherty.com) with:
 *   <div id="jd-capacity-calculator"></div>
 *   <script src="https://YOUR-APP-DOMAIN/embed.js" async></script>
 *
 * If the mount div is omitted, the calculator is inserted where the script tag sits.
 * The script runs in the host page's context, so the post-submit redirect to the
 * scheduling page navigates the whole tab (not just the iframe).
 */
(function () {
  "use strict";

  // Derive the app origin from this script's own URL.
  var self =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();
  var origin = new URL(self.src).origin;

  // Find (or create) the mount point.
  var mount = document.getElementById("jd-capacity-calculator");
  if (!mount) {
    mount = document.createElement("div");
    self.parentNode.insertBefore(mount, self.nextSibling);
  }

  // Build the iframe.
  var iframe = document.createElement("iframe");
  iframe.src = origin + "/calculator?embed=1";
  iframe.title = "Agency Capacity Calculator";
  iframe.setAttribute("scrolling", "no");
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.display = "block";
  iframe.style.minHeight = "700px";
  mount.appendChild(iframe);

  // Only trust messages from our own app origin.
  window.addEventListener("message", function (e) {
    if (e.origin !== origin || !e.data || typeof e.data !== "object") return;

    if (e.data.type === "jd-calc:height" && typeof e.data.height === "number") {
      iframe.style.height = e.data.height + "px";
    }

    if (e.data.type === "jd-calc:redirect" && typeof e.data.url === "string") {
      window.location.href = e.data.url;
    }
  });
})();

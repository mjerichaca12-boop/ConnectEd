import { createRoot } from "react-dom/client";
import App from "./app/App.jsx";
import "./styles/index.css";

// Auto-recover from stale deployment chunk hash mismatches
window.addEventListener("error", (event) => {
  const msg = String(event?.message || "");
  if (/failed to fetch dynamically imported module/i.test(msg) || /expected a javascript-or-wasm module script/i.test(msg)) {
    const hasReloaded = sessionStorage.getItem("chunk_reload_retry");
    if (!hasReloaded) {
      sessionStorage.setItem("chunk_reload_retry", "true");
      window.location.reload();
    }
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const msg = String(event?.reason?.message || event?.reason || "");
  if (/failed to fetch dynamically imported module/i.test(msg) || /expected a javascript-or-wasm module script/i.test(msg)) {
    const hasReloaded = sessionStorage.getItem("chunk_reload_retry");
    if (!hasReloaded) {
      sessionStorage.setItem("chunk_reload_retry", "true");
      window.location.reload();
    }
  }
});

createRoot(document.getElementById("root")).render(<App />);

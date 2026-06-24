import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./ui.css";
import "./index.css";

// Stellar SDK reaches for `Buffer` in a few code paths — polyfill it on the
// global once at startup so the rest of the app doesn't have to.
if (typeof window !== "undefined" && !(window as unknown as { Buffer?: typeof Buffer }).Buffer) {
  (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

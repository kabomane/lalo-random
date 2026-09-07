import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

import LaloRandom from "@/app/lalo-random";
import "@/app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Application root element not found.");
}

createRoot(root).render(
  <StrictMode>
    <LaloRandom />
    <Toaster position="bottom-center" richColors theme="dark" />
  </StrictMode>,
);

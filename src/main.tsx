import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./ui/App";
import { bootstrapDevHero } from "./dev/devHeroBridge";

if (import.meta.env.MODE === "development") bootstrapDevHero();

const root = document.getElementById("root");
if (!root) throw new Error("Élément #root introuvable.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

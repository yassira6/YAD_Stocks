import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { LanguageProvider } from "./i18n/LanguageContext";
import { CompaniesProvider } from "./lib/CompaniesContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <CompaniesProvider>
        <App />
      </CompaniesProvider>
    </LanguageProvider>
  </StrictMode>
);

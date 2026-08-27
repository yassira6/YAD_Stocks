import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { LanguageProvider } from "./i18n/LanguageContext";
import { CompaniesProvider } from "./lib/CompaniesContext";
import { AuthProvider } from "./lib/AuthContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <CompaniesProvider>
          <App />
        </CompaniesProvider>
      </AuthProvider>
    </LanguageProvider>
  </StrictMode>
);

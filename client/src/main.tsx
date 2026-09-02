import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { LanguageProvider } from "./i18n/LanguageContext";
import { ThemeProvider } from "./lib/ThemeContext";
import { CompaniesProvider } from "./lib/CompaniesContext";
import { AuthProvider } from "./lib/AuthContext";
import { WatchlistProvider } from "./lib/WatchlistContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <WatchlistProvider>
            <CompaniesProvider>
              <App />
            </CompaniesProvider>
          </WatchlistProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>
);

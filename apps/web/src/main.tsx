import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter } from "react-router";
import { App } from "./App";
import { AppProvider } from "./app/AppContext";
import { applyTelegramTheme, initTelegram, tg } from "./lib/telegram";

import "./ds/tokens/fonts.css";
import "./ds/tokens/colors.css";
import "./ds/tokens/typography.css";
import "./ds/tokens/spacing.css";
import "./ds/tokens/radius.css";
import "./ds/tokens/shadows.css";
import "./ds/tokens/motion.css";
import "./ds/tokens/theme-dark.css";
import "./ds/tokens/base.css";
import "./ds/components.css";
import "./ds/app.css";

initTelegram();
applyTelegramTheme();
tg?.onEvent("themeChanged", applyTelegramTheme);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, refetchOnWindowFocus: true, retry: 1 },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
);

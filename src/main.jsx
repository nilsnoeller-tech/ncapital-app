import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import TradingJournal from "./TradingJournal";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <TradingJournal />
  </StrictMode>
);

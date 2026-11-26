import { Component, type ErrorInfo, type ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/syne/600.css";
import "@fontsource/syne/700.css";
import "@fontsource/syne/800.css";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import App from "./App";
import "./index.css";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erreur UI AUBM PCheck :", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            fontFamily: "system-ui, sans-serif",
            background: "#e8eee9",
            color: "#143029",
          }}
        >
          <div
            style={{
              maxWidth: 480,
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              border: "1px solid #d5ddd7",
            }}
          >
            <h1 style={{ margin: 0, fontSize: 22 }}>Erreur d’affichage</h1>
            <p style={{ marginTop: 12, color: "#5c6b63" }}>
              L’interface a rencontré une erreur. Rechargez la page. Si le
              problème continue, videz le cache du navigateur (Ctrl+F5).
            </p>
            <pre
              style={{
                marginTop: 12,
                padding: 12,
                background: "#f4f7fb",
                borderRadius: 8,
                fontSize: 12,
                overflow: "auto",
              }}
            >
              {this.state.error.message}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: 16,
                padding: "10px 16px",
                borderRadius: 10,
                border: 0,
                background: "#1f5346",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Recharger
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.textContent = "Erreur : élément #root introuvable.";
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

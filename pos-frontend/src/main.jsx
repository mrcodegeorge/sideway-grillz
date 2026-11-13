import { Component, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { Provider } from "react-redux";
import store from "./redux/store.js";
import { SnackbarProvider } from "notistack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
    }
  }
})

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#121212] text-[#f5f5f5] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#1a1a1a] border border-red-500/40 rounded-2xl p-6 space-y-3">
            <h1 className="text-lg font-bold text-red-400">Something went wrong</h1>
            <p className="text-xs text-[#ccc] break-words">
              {this.state.error?.message || "Unexpected application error."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-yellow-400 text-black text-xs font-bold cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppErrorBoundary>
      <Provider store={store}>
        <SnackbarProvider autoHideDuration={3000}>
          <QueryClientProvider client={queryClient} >
            <App />
          </QueryClientProvider>
        </SnackbarProvider>
      </Provider>
    </AppErrorBoundary>
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}

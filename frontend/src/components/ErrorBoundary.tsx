import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    // Log to backend API
    fetch("/api/errors/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: error.message || "React rendering error",
        details: `${error.stack || ""}\nComponent Stack:\n${errorInfo.componentStack || ""}`,
      }),
    }).catch((err) => {
      console.error("Failed to report error to backend:", err);
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-950/20 border border-red-500/30 rounded-xl text-center max-w-xl mx-auto my-12">
          <span className="text-4xl mb-4">⚠️</span>
          <h2 className="text-lg font-bold text-red-400 mb-2">Something went wrong</h2>
          <p className="text-sm text-zinc-400 mb-4">
            An unexpected error occurred in the user interface. It has been automatically logged.
          </p>
          <pre className="text-xs bg-zinc-900 border border-zinc-800 rounded p-4 overflow-x-auto w-full text-left text-red-300 font-mono">
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition"
          >
            Reload Client Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

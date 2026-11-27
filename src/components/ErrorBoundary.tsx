import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  title?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Terjadi kesalahan yang tidak terduga.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-card" role="alert">
          <h3>{this.props.title ?? "Gagal memuat tampilan"}</h3>
          <p>{this.state.message}</p>
          <button
            type="button"
            className="button-primary"
            onClick={() => window.location.reload()}
          >
            Muat ulang
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

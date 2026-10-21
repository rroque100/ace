"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="emptyState" style={{ display: "grid", gap: 8, padding: 24, textAlign: "center" }}>
          <div style={{ margin: "0 auto" }}>
            <AlertTriangle size={24} />
          </div>
          <strong>Algo sali&oacute; mal</strong>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            {this.state.error?.message ?? "Error inesperado al cargar la p&aacute;gina."}
          </p>
          <button
            className="secondaryButton"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ justifySelf: "center" }}
            type="button"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

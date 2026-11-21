
import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("PracTrack interface error:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="error-screen">
          <div className="error-card">
            <AlertTriangle size={38} />
            <h1>Something went wrong</h1>
            <p>
              PracTrack encountered an unexpected error.
              Reload the application to continue.
            </p>
            <button
              className="primary-button"
              onClick={this.handleReset}
            >
              <RefreshCw size={16} />
              Reload application
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

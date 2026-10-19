import { Component, type ReactNode } from "react";

// Last safety net: if a page crashes, show a Reload button instead of a black screen
// (the installed app has no browser reload button).
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    console.error("Page crashed:", err);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black px-8 text-center">
        <img src="/img/white_logo.png" alt="Gutargoo+" className="mb-4 h-9 w-[140px] object-contain" />
        <p className="text-base font-bold">Something went wrong</p>
        <p className="text-sm text-white/60">Please reload the app.</p>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/";
          }}
          className="mt-2 rounded-xl bg-orange px-8 py-3 text-sm font-bold"
        >
          Reload
        </button>
      </div>
    );
  }
}

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[CareNet] Unhandled error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <CrashPage onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

function CrashPage({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: "hsl(210, 20%, 98%)", fontFamily: "'Cabinet Grotesk', sans-serif" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <svg
          aria-label="Care Net Portal"
          width="40"
          height="40"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="32" height="32" rx="8" fill="hsl(175, 55%, 28%)" />
          <path d="M16 8a5 5 0 0 1 5 5c0 4-5 11-5 11S11 17 11 13a5 5 0 0 1 5-5z" fill="white" />
          <circle cx="16" cy="13" r="2" fill="hsl(175, 55%, 28%)" />
        </svg>
        <div>
          <div className="font-bold text-base leading-tight" style={{ color: "hsl(220, 25%, 14%)" }}>
            Care Net
          </div>
          <div className="text-xs" style={{ color: "hsl(220, 10%, 50%)" }}>
            Portal
          </div>
        </div>
      </div>

      {/* Open Toolbox Illustration */}
      <div className="mb-8">
        <svg
          width="180"
          height="140"
          viewBox="0 0 180 140"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Shadow */}
          <ellipse cx="90" cy="132" rx="58" ry="6" fill="hsl(175, 55%, 28%)" opacity="0.08" />

          {/* Toolbox body */}
          <rect x="24" y="72" width="132" height="56" rx="7" fill="hsl(175, 40%, 88%)" />
          <rect x="24" y="72" width="132" height="56" rx="7" stroke="hsl(175, 55%, 28%)" strokeWidth="2.5" />

          {/* Toolbox divider stripe */}
          <rect x="24" y="88" width="132" height="4" fill="hsl(175, 55%, 28%)" opacity="0.18" />

          {/* Toolbox lid (open — angled up-right) */}
          <path
            d="M24 74 Q56 20 156 38 L156 74 Z"
            fill="hsl(175, 50%, 80%)"
            stroke="hsl(175, 55%, 28%)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Lid inner shadow */}
          <path
            d="M28 72 Q60 24 152 40 L152 72 Z"
            fill="hsl(175, 55%, 28%)"
            opacity="0.07"
          />

          {/* Handle on lid */}
          <path
            d="M78 48 Q90 36 102 48"
            stroke="hsl(175, 55%, 28%)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
          />

          {/* Wrench inside box */}
          <g transform="translate(38, 96)">
            <rect x="0" y="5" width="44" height="7" rx="3.5" fill="hsl(175, 55%, 28%)" opacity="0.55" />
            <circle cx="4" cy="8.5" r="5" fill="none" stroke="hsl(175, 55%, 28%)" strokeWidth="2.5" opacity="0.7" />
            <circle cx="40" cy="8.5" r="5" fill="none" stroke="hsl(175, 55%, 28%)" strokeWidth="2.5" opacity="0.7" />
          </g>

          {/* Screwdriver inside box */}
          <g transform="translate(94, 94)">
            <rect x="14" y="0" width="5" height="26" rx="2.5" fill="hsl(175, 55%, 28%)" opacity="0.45" />
            <polygon points="14,26 19,26 16.5,34" fill="hsl(175, 55%, 28%)" opacity="0.55" />
            <rect x="10" y="0" width="13" height="8" rx="3" fill="hsl(175, 45%, 65%)" opacity="0.6" />
          </g>

          {/* Small gear peeking over lid edge */}
          <g transform="translate(118, 28)">
            <circle cx="12" cy="12" r="7" fill="none" stroke="hsl(175, 55%, 28%)" strokeWidth="2.2" opacity="0.5" />
            <circle cx="12" cy="12" r="3" fill="hsl(175, 55%, 28%)" opacity="0.35" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
              const rad = (deg * Math.PI) / 180;
              const x1 = 12 + 7 * Math.cos(rad);
              const y1 = 12 + 7 * Math.sin(rad);
              const x2 = 12 + 10 * Math.cos(rad);
              const y2 = 12 + 10 * Math.sin(rad);
              return (
                <line
                  key={i}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="hsl(175, 55%, 28%)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity="0.5"
                />
              );
            })}
          </g>

          {/* Latch on box front */}
          <rect x="83" y="95" width="14" height="10" rx="3" fill="hsl(175, 55%, 28%)" opacity="0.3" />
          <rect x="87" y="98" width="6" height="4" rx="1.5" fill="hsl(175, 55%, 28%)" opacity="0.5" />
        </svg>
      </div>

      {/* Message */}
      <div className="text-center max-w-sm">
        <h1
          className="text-xl font-bold mb-3 leading-snug"
          style={{ color: "hsl(220, 25%, 14%)" }}
        >
          Sorry for the momentary inconvenience.
        </h1>
        <p
          className="text-sm leading-relaxed mb-8"
          style={{ color: "hsl(220, 10%, 45%)" }}
        >
          Sometimes caregivers need care as well.
          <br />
          We'll be back up soon.
        </p>

        <button
          type="button"
          onClick={onRetry}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{
            background: "hsl(175, 55%, 28%)",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "hsl(175, 55%, 23%)")}
          onMouseLeave={e => (e.currentTarget.style.background = "hsl(175, 55%, 28%)")}
        >
          Try again
        </button>
      </div>

      {/* Footer note */}
      <p className="mt-10 text-xs" style={{ color: "hsl(220, 10%, 60%)" }}>
        If this keeps happening, reach us at{" "}
        <a
          href="mailto:portal@carenetportal.com"
          className="underline"
          style={{ color: "hsl(175, 55%, 28%)" }}
        >
          portal@carenetportal.com
        </a>
      </p>
    </div>
  );
}

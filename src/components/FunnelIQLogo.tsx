interface FunnelIQLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export default function FunnelIQLogo({ size = 32, showText = false, className = "" }: FunnelIQLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="fiq-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00D4FF" />
            <stop offset="50%" stopColor="#4F7CFF" />
            <stop offset="100%" stopColor="#7C4DFF" />
          </linearGradient>
          <linearGradient id="fiq-grad2" x1="10" y1="10" x2="54" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00D4FF" />
            <stop offset="100%" stopColor="#7C4DFF" />
          </linearGradient>
        </defs>
        {/* Triangle / Funnel shape */}
        <path
          d="M32 4L58 56H6L32 4Z"
          fill="url(#fiq-grad)"
          opacity="0.9"
        />
        {/* Inner swoosh / wave */}
        <path
          d="M20 44C26 38 34 36 42 40C44 41 46 43 47 46L50 52H14L20 44Z"
          fill="url(#fiq-grad2)"
          opacity="0.6"
        />
        {/* Bar chart lines inside funnel */}
        <rect x="24" y="28" width="3" height="16" rx="1.5" fill="white" opacity="0.85" />
        <rect x="30" y="22" width="3" height="22" rx="1.5" fill="white" opacity="0.85" />
        <rect x="36" y="32" width="3" height="12" rx="1.5" fill="white" opacity="0.85" />
        {/* Small accent dot */}
        <circle cx="31.5" cy="18" r="2" fill="white" opacity="0.7" />
      </svg>
      {showText && (
        <span className="text-lg font-bold tracking-tight text-foreground">
          Funnel<span className="text-primary">IQ</span>
        </span>
      )}
    </div>
  );
}

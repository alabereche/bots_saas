// "The bot wakes up" — brand loading animation.
// Pure SVG + CSS: the chat bubble draws itself, typing dots come alive,
// the AuraBot wordmark assembles letter by letter. No JS timing involved.
export default function BotLoader({ fullscreen = false, label = 'جاري تجهيز منصتك...' }) {
  return (
    <div className={`bloader${fullscreen ? ' bloader--fullscreen' : ''}`} role="status" aria-label={label}>
      <div className="bloader-glow" />
      <div className="bloader-stage">
        <svg className="bloader-svg" viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="bloader-grad" x1="25" y1="30" x2="95" y2="85" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#34d399" />
              <stop offset="1" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <path
            className="bloader-bubble"
            d="M39 72 L32 85 L48 72 H81 Q95 72 95 58 V44 Q95 30 81 30 H39 Q25 30 25 44 V58 Q25 72 39 72 Z"
            stroke="url(#bloader-grad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle className="bloader-dot bloader-dot--1" cx="45" cy="51" r="4.5" fill="#34d399" />
          <circle className="bloader-dot bloader-dot--2" cx="60" cy="51" r="4.5" fill="#10b981" />
          <circle className="bloader-dot bloader-dot--3" cx="75" cy="51" r="4.5" fill="#22d3ee" />
        </svg>

        <div className="bloader-word" aria-hidden="true">
          <span>A</span><span>u</span><span>r</span><span>a</span><span className="bloader-word--bot">B</span><span className="bloader-word--bot">o</span><span className="bloader-word--bot">t</span>
        </div>

        <div className="bloader-bar"><div className="bloader-bar-fill" /></div>
        <div className="bloader-label">{label}</div>
      </div>
    </div>
  );
}

import React, { useRef, useState, useEffect } from 'react';

/**
 * 3D Simulation Video Showcase Card
 * Google DeepMind / Antigravity style:
 * - Crystal-clear presentation: NO dark overlays, NO blur over video
 * - Seamless infinite loop
 * - Floating glass Audio Mute / Unmute toggle button
 * - Live synchronization badge
 * - Responsive 16:9 aspect ratio across mobile and PC
 */
export const ShowcaseVideoCard = () => {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Autoplay policy: start muted so browser plays immediately
    video.muted = true;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }
  }, []);

  const toggleSound = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);

    if (!nextMuted && video.paused) {
      video.play().catch(() => {});
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  return (
    <div className="lp2-showcase-wrap" dir="rtl">
      {/* Outer Emerald Glow behind the card */}
      <div className="lp2-showcase-glow" />

      {/* Floating Showcase Card */}
      <div
        className="lp2-showcase-card"
        onClick={togglePlay}
        role="region"
        aria-label="عرض المحاكاة الحية"
      >
        {/* Top Live Status Badge */}
        <div className="lp2-showcase-badge">
          <span className="lp2-showcase-pulse-dot">
            <span className="lp2-showcase-pulse-ring" />
          </span>
          <span>محاكاة حية للطلب والمزامنة</span>
        </div>

        {/* Video Element - Completely Clean & Bright without any dark overlays */}
        <video
          ref={videoRef}
          src="/simulation.mp4"
          loop
          autoPlay
          muted
          playsInline
          preload="auto"
          className="lp2-showcase-video"
        />

        {/* Floating Google-Style Audio Button */}
        <button
          type="button"
          onClick={toggleSound}
          className={`lp2-showcase-sound-btn ${!isMuted ? 'is-active' : ''}`}
          aria-label={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
          title={isMuted ? 'تشغيل الصوت والمؤثرات' : 'كتم الصوت'}
        >
          {isMuted ? (
            /* Muted Speaker Icon */
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            /* Playing Sound Waves Equalizer */
            <>
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              <span className="lp2-eq-bars">
                <span className="lp2-eq-bar lp2-eq-bar-1" />
                <span className="lp2-eq-bar lp2-eq-bar-2" />
                <span className="lp2-eq-bar lp2-eq-bar-3" />
              </span>
            </>
          )}

          <span>{isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}</span>
        </button>
      </div>
    </div>
  );
};

import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView, useReducedMotion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import '../landing-v2.css';

const DEMO_BOT_URL = 'https://t.me/Zcodybot';
// فيديو الهيرو — بث HLS من Mux. سفاري/آيفون تشغّله أصلاً، وبقية المتصفحات
// عبر hls.js الذي يُحمَّل ديناميكياً مع هذا القسم فقط
const HERO_VIDEO = 'https://stream.mux.com/tLkHO1qZoaaQOUeVWo8hEBeGQfySP02EPS02BmnNFyXys.m3u8';

const EASE = [0.16, 1, 0.3, 1];

/* ─── Hero background video: HLS with native-Safari fast path ─── */
function HeroVideo({ src }) {
  const ref = useRef(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return undefined;

    // React's `muted` prop is unreliable (react#10389) — keep it forced
    const tryPlay = () => {
      video.muted = true;
      const p = video.play();
      if (p) p.catch(() => { /* retried below until it sticks */ });
    };

    // Show the first frame even if autoplay is blocked by the browser,
    // and retry on the user's first interaction (strict autoplay setups)
    const show = () => video.classList.add('is-playing');
    video.addEventListener('loadeddata', show);
    video.addEventListener('playing', show);
    const interact = () => tryPlay();
    ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(ev =>
      window.addEventListener(ev, interact, { once: true, passive: true })
    );

    // iOS / Safari play HLS natively
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadeddata', tryPlay, { once: true });
      tryPlay();
      return () => {
        video.removeEventListener('loadeddata', show);
        video.removeEventListener('playing', show);
        ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(ev =>
          window.removeEventListener(ev, interact)
        );
      };
    }

    let hls = null;
    let cancelled = false;
    const retry = setInterval(() => {
      if (cancelled) return;
      if (!video.paused) { clearInterval(retry); return; }
      if (video.readyState >= 2) tryPlay();
    }, 600);
    const giveUp = setTimeout(() => clearInterval(retry), 20000);

    import('hls.js')
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (Hls.isSupported()) {
          hls = new Hls({ enableWorker: true, lowLatencyMode: false });
          hls.loadSource(src);
          hls.attachMedia(video);
        } else {
          video.src = src; // last resort
        }
      })
      .catch(() => { /* fallback background stays visible behind */ });

    return () => {
      cancelled = true;
      clearInterval(retry);
      clearTimeout(giveUp);
      video.removeEventListener('loadeddata', show);
      video.removeEventListener('playing', show);
      ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(ev =>
        window.removeEventListener(ev, interact)
      );
      if (hls) hls.destroy();
    };
  }, [src]);

  return (
    <video
      ref={ref}
      className="lp2-hero-video"
      autoPlay loop muted playsInline
    />
  );
}

/* ─── Icons (inline, tree-shakeable) ─── */
const IconTelegram = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M21.94 3.37a1.5 1.5 0 0 0-1.53-.26L3.4 9.79c-.72.28-1.17.94-1.15 1.66.02.72.5 1.35 1.23 1.59l4.24 1.4 1.62 4.98c.22.68.82 1.15 1.53 1.19h.14c.66 0 1.27-.34 1.62-.92l2.2-3.63 4.03 3.02c.35.26.77.4 1.2.4.26 0 .52-.05.77-.15.65-.27 1.1-.84 1.2-1.54l1.5-12.36a1.5 1.5 0 0 0-.59-1.06zM10.1 13.91a.9.9 0 0 0-.55.62l-.4 1.77-1.02-3.13 7.42-4.68-5.45 5.42z" />
  </svg>
);
const IconWhatsApp = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.28-.2-.57-.34m-5.42 7.4h-.004a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.44-9.88 9.89-9.88a9.82 9.82 0 0 1 6.99 2.9 9.82 9.82 0 0 1 2.89 6.99c-.003 5.45-4.44 9.88-9.885 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.157 11.89c0 2.1.55 4.14 1.59 5.95L.057 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.005c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.16-3.48-8.41z" />
  </svg>
);
const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const ArrowLeft = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

/* ─── Motion: staggered word pull-up ─── */
function WordsPullUp({ text, className = '', delay = 0, as: Tag = 'span' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const reduce = useReducedMotion();
  const words = text.split(' ');
  return (
    <Tag ref={ref} className={`lp2-pullup ${className}`} aria-label={text}>
      {words.map((w, i) => (
        <span key={i}>
          <span className="lp2-pullup-word-mask">
            <motion.span
              className="lp2-pullup-word"
              initial={reduce ? false : { y: '0.9em', opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.7, delay: reduce ? 0 : delay + i * 0.07, ease: EASE }}
            >{w}</motion.span>
          </span>
          {i < words.length - 1 ? '\u00A0' : ''}
        </span>
      ))}
    </Tag>
  );
}

/* ─── Motion: scroll-linked word reveal (word-level keeps Arabic shaping) ─── */
function ScrollRevealWords({ text, className = '' }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.35'] });
  const words = text.split(' ');
  return (
    <p ref={ref} className={`lp2-scrollreveal ${className}`} aria-label={text}>
      {words.map((w, i) => {
        const start = i / words.length;
        return (
          <ScrollWord key={i} progress={scrollYProgress} range={[start, Math.min(1, start + 2.5 / words.length)]}>
            {w}
          </ScrollWord>
        );
      })}
    </p>
  );
}
function ScrollWord({ progress, range, children }) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  return (
    <motion.span style={{ opacity }} className="lp2-sr-word">{children}{'\u00A0'}</motion.span>
  );
}

/* ─── Motion: soft fade-up wrapper ─── */
function Reveal({ children, delay = 0, className = '', y = 22 }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.75, delay: reduce ? 0 : delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

const FEATURES = [
  {
    num: '01',
    title: 'يرد فوراً بالدارجة',
    items: ['رد في أقل من ثانية', 'يفهم اللهجة الجزائرية', 'يعمل 24/7 بلا توقف'],
  },
  {
    num: '02',
    title: 'يعرض منتجاتك بالصور',
    items: ['كتالوج بصور مضغوطة وسريعة', 'صور المنتج داخل المحادثة', 'أسعار وخصومات واضحة'],
  },
  {
    num: '03',
    title: 'يسجّل ويتبع الطلبيات',
    items: ['تأكيد آلي بكود تتبع', 'الزبون يُشعَر بكل مرحلة', 'سجل عملاء وطلبيات كامل'],
  },
  {
    num: '04',
    title: 'لوحة تحكم حية',
    items: ['محادثات وطلبيات لحظياً', 'إشعارات فورية للطلبات', 'أرقام واضحة بلا تعقيد'],
  },
];

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="lp2-root" dir="rtl">

      {/* ─── Nav pill ─── */}
      <div className="lp2-nav-wrap">
        <motion.nav
          className="lp2-nav"
          initial={{ y: -64, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <a href="#how" className="lp2-nav-link">كيف يعمل</a>
          <a href="#features" className="lp2-nav-link">المميزات</a>
          <a href={DEMO_BOT_URL} target="_blank" rel="noopener noreferrer" className="lp2-nav-link">تجربة حية</a>
          <Link to="/login" className="lp2-nav-link is-strong">دخول</Link>
        </motion.nav>
      </div>

      {/* ═══ Scene 1 — cinematic hero ═══ */}
      <section className="lp2-hero-frame">
        <div className="lp2-hero-media" aria-hidden="true">
          {/* The emerald abyss stays BEHIND the video always — so the hero is
              never void-black while the stream buffers or if it ever fails */}
          <div className="lp2-hero-fallback" />
          {HERO_VIDEO && <HeroVideo src={HERO_VIDEO} />}
          <div className="lp2-noise" />
          <div className="lp2-hero-scrim" />
        </div>

        <div className="lp2-hero-content">
          <div className="lp2-hero-wordmark-side">
            <span className="lp2-wordmark-box">
              <WordsPullUp text="AuraBot" className="lp2-wordmark" delay={0.15} />
              <motion.span
                className="lp2-wordmark-star"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.75, ease: EASE }}
                aria-hidden="true"
              >✦</motion.span>
            </span>
          </div>

          <div className="lp2-hero-cta-side">
            <WordsPullUp
              text="متجرك يبيع ويرد على زبائنه حتى وأنت نايم."
              className="lp2-hero-line"
              delay={0.45}
            />
            <Reveal delay={0.75}>
              <p className="lp2-hero-sub">
                مساعد مبيعات ذكي على واتساب وتيليغرام — يرد بالدارجة، يعرض منتجاتك
                بالصور، ويؤكد الطلبيات وحده.
              </p>
            </Reveal>
            <Reveal delay={0.9}>
              <div className="lp2-cta-row">
                <Link to={isAuthenticated ? '/dashboard' : '/login'} className="lp2-btn-primary">
                  <span>ابدأ مجاناً الآن</span>
                  <span className="lp2-btn-orb"><ArrowLeft /></span>
                </Link>
                <a href={DEMO_BOT_URL} target="_blank" rel="noopener noreferrer" className="lp2-btn-ghost">
                  <IconTelegram size={15} />
                  <span>جرّب البوت الحي</span>
                </a>
              </div>
            </Reveal>
            <Reveal delay={1.02}>
              <div className="lp2-channels">
                <span className="lp2-chip"><IconWhatsApp size={13} /> WhatsApp</span>
                <span className="lp2-chip"><IconTelegram size={13} /> Telegram</span>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ Scene 2 — one sentence, revealed by scroll ═══ */}
      <section className="lp2-section" id="how">
        <div className="lp2-about-card">
          <span className="lp2-label">آلية العمل</span>
          <WordsPullUp
            text="أنت تُدخل منتجاتك مرة واحدة."
            className="lp2-about-title"
            as="h2"
          />
          <ScrollRevealWords
            text="البوت يتكفل بالباقي — يرد على الزبون بالدارجة، يقنعه، يعرض صور منتجاتك، يؤكد الطلبية ويسجّلها في لوحتك. أنت تدير المبيعات فقط."
            className="lp2-about-body"
          />
        </div>
      </section>

      {/* ═══ Scene 3 — four quiet cards ═══ */}
      <section className="lp2-section" id="features">
        <div className="lp2-features-head">
          <WordsPullUp text="مصمّم ليبيع نيابة عنك." className="lp2-features-title is-cream" as="h2" />
          <WordsPullUp text="خفيف عليك. ثقيل على المبيعات." className="lp2-features-title is-dim" delay={0.2} />
        </div>

        <div className="lp2-cards">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.num} f={f} index={i} />
          ))}
        </div>
      </section>

      {/* ══ Footer — the last door ══ */}
      <footer className="lp2-footer">
        <Reveal>
          <div className="lp2-footer-inner">
            <span className="lp2-footer-mark">AuraBot<span className="lp2-footer-star">✦</span></span>
            <p className="lp2-footer-line">جاهز تشوف بوتك يبيع؟</p>
            <div className="lp2-cta-row is-center">
              <Link to={isAuthenticated ? '/dashboard' : '/login'} className="lp2-btn-primary">
                <span>ابدأ مجاناً الآن</span>
                <span className="lp2-btn-orb"><ArrowLeft /></span>
              </Link>
              <a href={DEMO_BOT_URL} target="_blank" rel="noopener noreferrer" className="lp2-btn-ghost">
                <IconTelegram size={15} />
                <span>تجربة حية</span>
              </a>
            </div>
            <div className="lp2-footer-legal">
              <Link to="/privacy">سياسة الخصوصية</Link>
              <span aria-hidden="true">·</span>
              <Link to="/terms">شروط الاستخدام</Link>
              <span aria-hidden="true">·</span>
              <span>© 2026 AuraBot</span>
            </div>
          </div>
        </Reveal>
      </footer>
    </div>
  );
}

function FeatureCard({ f, index }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduce = useReducedMotion();
  return (
    <motion.article
      ref={ref}
      className="lp2-card"
      initial={reduce ? false : { opacity: 0, scale: 0.96, y: 18 }}
      animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay: reduce ? 0 : index * 0.13, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="lp2-card-num">{f.num}</span>
      <h3 className="lp2-card-title">{f.title}</h3>
      <ul className="lp2-card-list">
        {f.items.map(item => (
          <li key={item}>
            <span className="lp2-card-check"><Check /></span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </motion.article>
  );
}

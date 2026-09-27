import React from 'react';
import {
  Gem,
  Headphones,
  Gamepad2,
  Zap,
  CreditCard,
  Wallet,
  ShoppingBag,
  Store,
  Package,
  Megaphone,
  Key,
  Globe,
  Rocket,
  Star,
  Flame,
  FileText,
  MessageSquare,
  Bot,
  Film,
  Smartphone,
  ShieldCheck,
  Tag,
  Coins,
  Sparkles,
  Award,
  Tv,
  Music,
  CheckCircle2,
  Lock,
  Layers,
  HelpCircle,
} from 'lucide-react';

// ═════════════════════════════════════════════════════════════════
// 1. Official Vector Brand SVGs (Simple Icons & Brand Standards)
// ═════════════════════════════════════════════════════════════════
export const BRAND_ICONS = {
  // ── AI Brands ──
  gemini: {
    name: 'Google Gemini',
    color: '#8E75C2',
    category: 'ai',
    emoji: '⚡',
    viewBox: '0 0 24 24',
    path: 'M12.002 0c-.394 0-.756.242-.907.606C9.405 5.58 5.58 9.405.606 11.095a1 1 0 0 0 0 1.81c4.974 1.69 8.799 5.515 10.489 10.489.151.364.513.606.907.606s.756-.242.907-.606c1.69-4.974 5.515-8.799 10.489-10.489a1 1 0 0 0 0-1.81C17.517 9.405 13.692 5.58 12.909.606A1 1 0 0 0 12.002 0z',
  },
  chatgpt: {
    name: 'ChatGPT / OpenAI',
    color: '#10A37F',
    category: 'ai',
    emoji: '🤖',
    viewBox: '0 0 24 24',
    path: 'M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.779 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.607 1.5-2.602-1.5z',
  },
  claude: {
    name: 'Anthropic Claude',
    color: '#D97757',
    category: 'ai',
    emoji: '🟣',
    viewBox: '0 0 24 24',
    path: 'M13.887 2.774h3.766L24 21.226h-3.766l-1.954-5.066H9.72l-1.954 5.066H4L10.747 2.774h3.14zm1.905 10.457L12.57 4.792l-3.222 8.439h6.444z',
  },
  midjourney: {
    name: 'Midjourney',
    color: '#38BDF8',
    category: 'ai',
    emoji: '🎨',
    viewBox: '0 0 24 24',
    path: 'M15.42 2.37A12.18 12.18 0 0 0 12 1.88a12.06 12.06 0 0 0-3.42.49 11.23 11.23 0 0 0-4.7 2.8 11.41 11.41 0 0 0-2.82 4.67 12.44 12.44 0 0 0-.54 3.52c0 .94.1 1.86.3 2.75l.13.53 1.25-.43c.85-.29 1.73-.44 2.62-.44.97 0 1.93.18 2.85.54 1.13.44 2.12 1.1 2.94 1.94l.87.89.87-.89a10.22 10.22 0 0 1 2.94-1.94 9.4 9.4 0 0 1 5.47-.1c.42.14.83.33 1.24.54l.53.28.24-.55a12.38 12.38 0 0 0 .5-3.4c0-1.22-.18-2.4-.54-3.52a11.41 11.41 0 0 0-2.82-4.67 11.23 11.23 0 0 0-4.7-2.8zM9.47 11.88c-.83 0-1.63.15-2.39.43l-.48.18v-4.1l.36-.21a8.4 8.4 0 0 1 3.58-.93c.96 0 1.9.17 2.78.51l.4.16v4.61l-.54-.25a8.1 8.1 0 0 0-3.71-.4zm5.06 0a8.1 8.1 0 0 0-3.71.4l-.54.25V7.92l.4-.16a8.4 8.4 0 0 1 2.78-.51 8.4 8.4 0 0 1 3.58.93l.36.21v4.1l-.48-.18c-.76-.28-1.56-.43-2.39-.43z',
  },
  deepseek: {
    name: 'DeepSeek',
    color: '#0066FF',
    category: 'ai',
    emoji: '🐳',
    viewBox: '0 0 24 24',
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.93V15c0-.55-.45-1-1-1s-1 .45-1 1v1.93C7.59 16.47 5 13.98 5 11c0-3.86 3.14-7 7-7s7 3.14 7 7c0 2.98-2.59 5.47-6 5.93zM12 6c-2.76 0-5 2.24-5 5 0 1.63.79 3.08 2 3.99V13c0-1.65 1.35-3 3-3s3 1.35 3 3v1.99c1.21-.91 2-2.36 2-3.99 0-2.76-2.24-5-5-5z',
  },
  perplexity: {
    name: 'Perplexity AI',
    color: '#20B8CD',
    category: 'ai',
    emoji: '🔍',
    viewBox: '0 0 24 24',
    path: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15.93v-3.86a2.07 2.07 0 0 1-2 0v3.86A8 8 0 0 1 4.07 13h3.86a2.07 2.07 0 0 1 0-2H4.07A8 8 0 0 1 11 4.07v3.86a2.07 2.07 0 0 1 2 0V4.07A8 8 0 0 1 19.93 11h-3.86a2.07 2.07 0 0 1 0 2h3.86A8 8 0 0 1 13 17.93z',
  },
  cursor: {
    name: 'Cursor AI',
    color: '#A855F7',
    category: 'ai',
    emoji: '💻',
    viewBox: '0 0 24 24',
    path: 'M12 2L4 20l8-4 8 4L12 2zm0 4.5l4.5 10.12-4.5-2.25-4.5 2.25L12 6.5z',
  },
  copilot: {
    name: 'GitHub Copilot',
    color: '#8957E5',
    category: 'ai',
    emoji: '👾',
    viewBox: '0 0 24 24',
    path: 'M12 2a10 10 0 0 0-10 10c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z',
  },

  // ── Subscriptions & Media ──
  spotify: {
    name: 'Spotify Premium',
    color: '#1DB954',
    category: 'apps',
    emoji: '🎵',
    viewBox: '0 0 24 24',
    path: 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z',
  },
  netflix: {
    name: 'Netflix',
    color: '#E50914',
    category: 'apps',
    emoji: '🎬',
    viewBox: '0 0 24 24',
    path: 'M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.596 2.344-6.65 4.692-13.287 7.042-19.936h4.814v23.935h-4.814V9.615l-5.32 14.384h-3.444L3.6 5.568v18.431H0V0h5.398z',
  },
  youtube: {
    name: 'YouTube Premium',
    color: '#FF0000',
    category: 'apps',
    emoji: '▶️',
    viewBox: '0 0 24 24',
    path: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  },
  discord: {
    name: 'Discord Nitro',
    color: '#5865F2',
    category: 'apps',
    emoji: '💬',
    viewBox: '0 0 24 24',
    path: 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z',
  },
  canva: {
    name: 'Canva Pro',
    color: '#00C4CC',
    category: 'apps',
    emoji: '🎨',
    viewBox: '0 0 24 24',
    path: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.176 17.067c-1.365 1.365-3.326 1.83-5.074 1.487l.635-2.222c1.08.204 2.29-.08 3.123-.913.918-.918 1.134-2.294.673-3.447l2.203-.787c.725 1.85.342 4.078-1.56 5.882zm-2.02-8.31l-2.202.787c-.725-1.85-.342-4.078 1.56-5.882 1.365-1.365 3.326-1.83 5.074-1.487l-.635 2.222c-1.08-.204-2.29.08-3.123.913-.918.918-1.134 2.294-.673 3.447z',
  },
  duolingo: {
    name: 'Duolingo Super',
    color: '#58CC02',
    category: 'apps',
    emoji: '🦉',
    viewBox: '0 0 24 24',
    path: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-2.25 5.25a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm4.5 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm-2.25 8.25c2.485 0 4.5 1.343 4.5 3s-2.015 3-4.5 3-4.5-1.343-4.5-3 2.015-3 4.5-3z',
  },
  telegram: {
    name: 'Telegram Premium',
    color: '#26A5E4',
    category: 'apps',
    emoji: '✈️',
    viewBox: '0 0 24 24',
    path: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
  },
  apple: {
    name: 'Apple / Music',
    color: '#A2AAAD',
    category: 'apps',
    emoji: '🍏',
    viewBox: '0 0 24 24',
    path: 'M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.71c.64-.78 1.08-1.86.96-2.95-1 .04-2.14.66-2.81 1.44-.59.68-1.11 1.77-.97 2.83 1.12.09 2.18-.54 2.82-1.32z',
  },

  // ── Gaming & Crypto ──
  steam: {
    name: 'Steam',
    color: '#66C0F4',
    category: 'gaming',
    emoji: '🎮',
    viewBox: '0 0 24 24',
    path: 'M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.029 4.524 4.524s-2.03 4.524-4.524 4.524h-.105l-4.076 2.911c0 .052.005.105.005.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 12-5.373 12-12S18.605 0 11.979 0z',
  },
  playstation: {
    name: 'PlayStation',
    color: '#003791',
    category: 'gaming',
    emoji: '🎮',
    viewBox: '0 0 24 24',
    path: 'M8.995 18.232v2.338c0 .341.28.618.625.618.344 0 .624-.277.624-.618V1.43c0-.341-.28-.618-.624-.618-.345 0-.625.277-.625.618v10.518H4.218c-.344 0-.625.278-.625.618s.281.618.625.618h4.777v5.048zm9.58-9.458c-1.396 0-2.529 1.13-2.529 2.522s1.133 2.522 2.529 2.522 2.529-1.13 2.529-2.522-1.133-2.522-2.529-2.522z',
  },
  xbox: {
    name: 'Xbox Game Pass',
    color: '#107C10',
    category: 'gaming',
    emoji: '🎮',
    viewBox: '0 0 24 24',
    path: 'M4.102 21.033A11.942 11.942 0 0 0 12 24c3.08 0 5.895-1.164 8.033-3.084-2.457-3.231-6.113-5.263-8.033-5.263-1.884 0-5.467 1.986-7.898 5.38zM21.945 6.772a11.944 11.944 0 0 0-3.666-4.237c-3.136 2.37-6.095 5.568-7.79 8.358 1.95 2.87 4.982 6.012 8.347 8.163 1.94-3.553 2.94-7.447 3.109-12.284zm-19.89 0C2.224 11.609 3.224 15.503 5.164 19.056c3.365-2.151 6.397-5.293 8.347-8.163C11.816 8.103 8.857 4.905 5.721 2.535A11.944 11.944 0 0 0 2.055 6.772zM12 0C8.36 0 5.093 1.624 2.89 4.2c3.488 2.316 6.745 5.344 8.796 8.286C13.737 9.544 16.994 6.516 20.482 4.2 18.28 1.624 15.013 0 12 0z',
  },
  binance: {
    name: 'Binance Pay',
    color: '#F0B90B',
    category: 'gaming',
    emoji: '🔶',
    viewBox: '0 0 24 24',
    path: 'M16.624 13.92l2.715 2.715-7.34 7.34-7.338-7.34 2.715-2.715 4.623 4.623 4.625-4.623zm0-3.84l4.623-4.625 2.715 2.715-7.338 7.34-2.715-2.715 4.623-4.623.092-.092zm-9.248 0l4.625 4.623-2.715 2.715-7.34-7.34 2.715-2.715 4.623 4.625.092.092zm4.625-4.623L16.624 10.08l-4.625 4.625L7.376 10.08l4.625-4.623zM11.999 0l7.338 7.338-2.715 2.715-4.623-4.623-4.625 4.623-2.715-2.715 7.34-7.338z',
  },
  usdt: {
    name: 'Tether USDT',
    color: '#26A17B',
    category: 'gaming',
    emoji: '₮',
    viewBox: '0 0 24 24',
    path: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm2.5 7.5h4v2h-4v1.2c2.6.2 4.5 1.1 4.5 2.3 0 1.2-1.9 2.1-4.5 2.3V18h-2.5v-2.7c-2.6-.2-4.5-1.1-4.5-2.3 0-1.2 1.9-2.1 4.5-2.3V9.5h-4v-2h4V5h2.5v2.5zm-5 5.5c0 .6 1.8 1.1 3.75 1.1s3.75-.5 3.75-1.1-1.8-1.1-3.75-1.1S9.5 12.4 9.5 13z',
  },
};

// ═════════════════════════════════════════════════════════════════
// 2. Lucide Icons Registry
// ═════════════════════════════════════════════════════════════════
export const ICON_MAP = {
  gem: Gem,
  headphones: Headphones,
  gamepad: Gamepad2,
  zap: Zap,
  'credit-card': CreditCard,
  wallet: Wallet,
  'shopping-bag': ShoppingBag,
  store: Store,
  package: Package,
  megaphone: Megaphone,
  key: Key,
  globe: Globe,
  rocket: Rocket,
  star: Star,
  flame: Flame,
  'file-text': FileText,
  message: MessageSquare,
  bot: Bot,
  film: Film,
  smartphone: Smartphone,
  shield: ShieldCheck,
  tag: Tag,
  coins: Coins,
  sparkles: Sparkles,
  award: Award,
  tv: Tv,
  music: Music,
};

// ═════════════════════════════════════════════════════════════════
// 3. Backward Compatibility Emojis Map
// ═════════════════════════════════════════════════════════════════
export const LEGACY_EMOJI_MAP = {
  '💎': Gem,
  '🎧': Headphones,
  '🎮': Gamepad2,
  '⚡': Zap,
  '💳': CreditCard,
  '🛍️': ShoppingBag,
  '🛍': ShoppingBag,
  '📦': Package,
  '📢': Megaphone,
  '🔑': Key,
  '🌐': Globe,
  '🚀': Rocket,
  '⭐': Star,
  '🔥': Flame,
  '📜': FileText,
  '💬': MessageSquare,
  '🤖': Bot,
  '🎬': Film,
  '📱': Smartphone,
  '💰': Coins,
  '🦉': Sparkles,
  '✅': ShieldCheck,
};

// ═════════════════════════════════════════════════════════════════
// 4. Categories Definition
// ═════════════════════════════════════════════════════════════════
export const STORE_ICON_CATEGORIES = [
  { id: 'ai', label: 'ذكاء اصطناعي (AI)', icon: '🤖' },
  { id: 'apps', label: 'اشتراكات وتطبيقات', icon: '🎵' },
  { id: 'gaming', label: 'ألعاب وعملات', icon: '🎮' },
  { id: 'general', label: 'أيقونات عامة', icon: '✨' },
];

// ═════════════════════════════════════════════════════════════════
// 5. Curated List of All Icons for Pickers
// ═════════════════════════════════════════════════════════════════
export const STORE_ICON_OPTIONS = [
  // ── AI ──
  { id: 'gemini', label: 'Google Gemini', category: 'ai', color: '#8E75C2', isBrand: true, emoji: '⚡' },
  { id: 'chatgpt', label: 'ChatGPT / OpenAI', category: 'ai', color: '#10A37F', isBrand: true, emoji: '🤖' },
  { id: 'claude', label: 'Anthropic Claude', category: 'ai', color: '#D97757', isBrand: true, emoji: '🟣' },
  { id: 'midjourney', label: 'Midjourney', category: 'ai', color: '#38BDF8', isBrand: true, emoji: '🎨' },
  { id: 'deepseek', label: 'DeepSeek', category: 'ai', color: '#0066FF', isBrand: true, emoji: '🐳' },
  { id: 'perplexity', label: 'Perplexity AI', category: 'ai', color: '#20B8CD', isBrand: true, emoji: '🔍' },
  { id: 'cursor', label: 'Cursor AI', category: 'ai', color: '#A855F7', isBrand: true, emoji: '💻' },
  { id: 'copilot', label: 'GitHub Copilot', category: 'ai', color: '#8957E5', isBrand: true, emoji: '👾' },
  { id: 'bot', label: 'روبوت / AI Bot', category: 'ai', Icon: Bot, color: '#38bdf8', emoji: '🤖' },

  // ── Apps & Subscriptions ──
  { id: 'spotify', label: 'Spotify Premium', category: 'apps', color: '#1DB954', isBrand: true, emoji: '🎵' },
  { id: 'netflix', label: 'Netflix', category: 'apps', color: '#E50914', isBrand: true, emoji: '🎬' },
  { id: 'youtube', label: 'YouTube Premium', category: 'apps', color: '#FF0000', isBrand: true, emoji: '▶️' },
  { id: 'discord', label: 'Discord Nitro', category: 'apps', color: '#5865F2', isBrand: true, emoji: '💬' },
  { id: 'canva', label: 'Canva Pro', category: 'apps', color: '#00C4CC', isBrand: true, emoji: '🎨' },
  { id: 'duolingo', label: 'Duolingo Super', category: 'apps', color: '#58CC02', isBrand: true, emoji: '🦉' },
  { id: 'telegram', label: 'Telegram Premium', category: 'apps', color: '#26A5E4', isBrand: true, emoji: '✈️' },
  { id: 'apple', label: 'Apple Music / Services', category: 'apps', color: '#A2AAAD', isBrand: true, emoji: '🍏' },
  { id: 'headphones', label: 'صوتيات وبودكاست', category: 'apps', Icon: Headphones, color: '#10b981', emoji: '🎧' },
  { id: 'film', label: 'سينما وأفلام', category: 'apps', Icon: Film, color: '#f43f5e', emoji: '🎬' },
  { id: 'smartphone', label: 'تطبيقات الهاتف', category: 'apps', Icon: Smartphone, color: '#38bdf8', emoji: '📱' },

  // ── Gaming & Crypto ──
  { id: 'steam', label: 'Steam', category: 'gaming', color: '#66C0F4', isBrand: true, emoji: '🎮' },
  { id: 'playstation', label: 'PlayStation', category: 'gaming', color: '#003791', isBrand: true, emoji: '🎮' },
  { id: 'xbox', label: 'Xbox Game Pass', category: 'gaming', color: '#107C10', isBrand: true, emoji: '🎮' },
  { id: 'binance', label: 'Binance Pay', category: 'gaming', color: '#F0B90B', isBrand: true, emoji: '🔶' },
  { id: 'usdt', label: 'Tether USDT', category: 'gaming', color: '#26A17B', isBrand: true, emoji: '₮' },
  { id: 'gamepad', label: 'ألعاب وشحن شدات', category: 'gaming', Icon: Gamepad2, color: '#818cf8', emoji: '🎮' },
  { id: 'coins', label: 'عملات ورصيد', category: 'gaming', Icon: Coins, color: '#fbbf24', emoji: '💰' },
  { id: 'credit-card', label: 'بطاقات دفع وحسابات', category: 'gaming', Icon: CreditCard, color: '#34d399', emoji: '💳' },
  { id: 'wallet', label: 'محفظة مالية', category: 'gaming', Icon: Wallet, color: '#a78bfa', emoji: '👛' },

  // ── General UI ──
  { id: 'gem', label: 'جوهرة / VIP', category: 'general', Icon: Gem, color: '#38bdf8', emoji: '💎' },
  { id: 'zap', label: 'تسليم فوري / برق', category: 'general', Icon: Zap, color: '#eab308', emoji: '⚡' },
  { id: 'shopping-bag', label: 'متجر وتسوق', category: 'general', Icon: ShoppingBag, color: '#ec4899', emoji: '🛍️' },
  { id: 'package', label: 'باقة / منتج', category: 'general', Icon: Package, color: '#f97316', emoji: '📦' },
  { id: 'megaphone', label: 'قناة وإعلانات', category: 'general', Icon: Megaphone, color: '#06b6d4', emoji: '📢' },
  { id: 'shield', label: 'ضمان وأمان', category: 'general', Icon: ShieldCheck, color: '#10b981', emoji: '🛡️' },
  { id: 'file-text', label: 'شروط وقوانين', category: 'general', Icon: FileText, color: '#94a3b8', emoji: '📜' },
  { id: 'flame', label: 'عروض حصرية', category: 'general', Icon: Flame, color: '#ef4444', emoji: '🔥' },
  { id: 'star', label: 'مميز ومفضل', category: 'general', Icon: Star, color: '#fbbf24', emoji: '⭐' },
  { id: 'key', label: 'تراخيص ومفاتيح تفعيل', category: 'general', Icon: Key, color: '#f59e0b', emoji: '🔑' },
  { id: 'globe', label: 'رابط خارجي', category: 'general', Icon: Globe, color: '#38bdf8', emoji: '🌐' },
  { id: 'tag', label: 'تخفيض وكوبون', category: 'general', Icon: Tag, color: '#a855f7', emoji: '🏷️' },
];

export function stripEmojis(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{E0020}-\u{E007F}]|[\u{FE00}-\u{FE0F}]/gu, '')
    .trim();
}

export function getIconTelegramEmoji(iconId) {
  if (!iconId) return '';
  const item = STORE_ICON_OPTIONS.find(opt => opt.id === iconId);
  if (item && item.emoji) return item.emoji;
  if (BRAND_ICONS[iconId]) return BRAND_ICONS[iconId].emoji || '⚡';
  return '';
}

/**
 * Universal StoreIcon component
 * High-definition vector icons, brand SVG logos, Simple Icons CDN, and Lucide icons.
 */
export default function StoreIcon({ icon, size = 16, color, style, className }) {
  if (!icon || icon === 'none') return null;

  // 1. Raw SVG snippet
  if (typeof icon === 'string' && icon.trim().startsWith('<svg')) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          verticalAlign: 'middle',
          ...style,
        }}
        className={className}
        dangerouslySetInnerHTML={{ __html: icon }}
      />
    );
  }

  // 2. Direct Image URL
  if (typeof icon === 'string' && (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('data:image'))) {
    return (
      <img
        src={icon}
        alt="icon"
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'inline-block',
          verticalAlign: 'middle',
          ...style,
        }}
        className={className}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    );
  }

  // 3. Simple Icons CDN (prefix si:)
  if (typeof icon === 'string' && icon.startsWith('si:')) {
    const slug = icon.replace('si:', '').trim().toLowerCase();
    return (
      <img
        src={`https://cdn.simpleicons.org/${slug}`}
        alt={slug}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'inline-block',
          verticalAlign: 'middle',
          ...style,
        }}
        className={className}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    );
  }

  // 4. Built-in Brand SVG (Highest performance, crisp vector, no network request)
  const brand = BRAND_ICONS[icon];
  if (brand) {
    return (
      <svg
        viewBox={brand.viewBox || '0 0 24 24'}
        width={size}
        height={size}
        fill={color || brand.color || 'currentColor'}
        style={{
          display: 'inline-block',
          verticalAlign: 'middle',
          flexShrink: 0,
          ...style,
        }}
        className={className}
      >
        <path d={brand.path} />
      </svg>
    );
  }

  // 5. Lucide standard icons
  const LucideComponent = ICON_MAP[icon] || LEGACY_EMOJI_MAP[icon];
  if (LucideComponent) {
    return <LucideComponent size={size} color={color} style={style} className={className} />;
  }

  // Fallback: Sparkles
  return <Sparkles size={size} color={color || '#38bdf8'} style={style} className={className} />;
}

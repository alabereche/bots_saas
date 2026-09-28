import React, { useEffect, useRef } from 'react';
import { X, Play, Sparkles, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

export function TelegramStoreVideoModal({ isOpen, onClose }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      // Attempt auto-play with audio unmute if user interacted
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    } else {
      document.body.style.overflow = '';
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-[#0c1220] border border-cyan-500/40 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.95),0_0_50px_rgba(34,158,217,0.25)] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Top Glowing Ambient Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cyan-950/80 bg-[#090e1a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30 flex-shrink-0">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-extrabold text-base sm:text-lg">
                  كيف يعمل متجر التيليجرام؟
                </h3>
                <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-500/40 px-2.5 py-0.5 rounded-full font-bold">
                  دليل عملي متحرك ⚡
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                شرح توضيحي كامل لرحلة العميل من تصفح الأزرار إلى استلام الكود الرقمي في التيليجرام
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
            title="إغلاق النافذة (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Video Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Video Container (16:9 4K frame) */}
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-cyan-500/30 shadow-2xl flex items-center justify-center group">
            <video
              ref={videoRef}
              src="/telegram-store-guide.mp4"
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            >
              عذراً، متصفحك لا يدعم تشغيل الفيديو.
            </video>
          </div>

          {/* 3 Steps Explanatory Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            {/* Step 1 */}
            <div className="bg-[#111a2d] border border-cyan-900/50 rounded-2xl p-3.5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-6 h-6 rounded-lg bg-cyan-950 text-cyan-300 flex items-center justify-center text-xs font-bold border border-cyan-500/30">
                  1
                </span>
                <span className="text-white font-extrabold text-sm">أزرار الشاشة الثابتة</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                الزبون يرى شبكة الأزرار (2×2) وأزرار الكتالوج فور دخوله، ويطلب بنقرة زر واحدة دون كتابة أي أوامر.
              </p>
              <div className="mt-2 text-[10px] text-cyan-400 font-medium flex items-center gap-1">
                <Zap className="w-3 h-3" />
                <span>شاشة التيليجرام • تجربة سلسة</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-[#111a2d] border border-cyan-900/50 rounded-2xl p-3.5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-6 h-6 rounded-lg bg-cyan-950 text-cyan-300 flex items-center justify-center text-xs font-bold border border-cyan-500/30">
                  2
                </span>
                <span className="text-white font-extrabold text-sm">إشعار مباشر في اللوحة</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                يصلك الطلب فورياً في لوحة التحكم مع تفاصيل العميل، المنتج المطلوب، والمبلغ المسدد بدقة.
              </p>
              <div className="mt-2 text-[10px] text-cyan-400 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>لوحة التحكم • بث طلبات حي</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-[#111a2d] border border-cyan-900/50 rounded-2xl p-3.5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-6 h-6 rounded-lg bg-cyan-950 text-cyan-300 flex items-center justify-center text-xs font-bold border border-cyan-500/30">
                  3
                </span>
                <span className="text-white font-extrabold text-sm">تسليم الكود والتأكيد</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                تسليم الكود بنقرة زر (أو تلقائياً)، ويستلم الزبون رسالة التأكيد والكود داخل التيليجرام في نفس الثانية.
              </p>
              <div className="mt-2 text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>تسليم آلي فوري 100%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-cyan-950/80 bg-[#090e1a] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>نظام أورا بوت المعتمد لربط متاجر التيليجرام الرسمية</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md shadow-cyan-600/30"
          >
            فهمت، إغلاق الشرح
          </button>
        </div>
      </div>
    </div>
  );
}

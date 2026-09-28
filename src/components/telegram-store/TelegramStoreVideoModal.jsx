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
      className="tg-video-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="tg-video-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '920px',
          maxHeight: '92vh',
          background: 'var(--bg-modal, #131312)',
          border: '1px solid var(--border-bright, rgba(230, 227, 211, 0.2))',
          borderRadius: 'var(--radius-lg, 22px)',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 22px',
          borderBottom: '1px solid var(--border-default, rgba(255, 255, 255, 0.08))',
          background: 'var(--bg-surface, #0d0d0c)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
              flexShrink: 0,
            }}>
              <Play size={16} fill="currentColor" style={{ marginLeft: '1px' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary, #e6e3d3)', fontSize: '1.05rem', fontWeight: 800 }}>
                  كيف يعمل متجر التيليجرام؟
                </h3>
                <span style={{
                  fontSize: '11px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontWeight: 700,
                }}>
                  دليل عمل متجرك ⚡ فيديو
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #a5a294)' }}>
                شرح توضيحي كامل لرحلة العميل من تصفح الأزرار إلى استلام الكود الرقمي في التيليجرام
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-secondary, #a5a294)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e11d48';
              e.currentTarget.style.borderColor = '#f43f5e';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = 'var(--text-secondary, #a5a294)';
            }}
            title="إغلاق النافذة (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Video Body */}
        <div style={{
          padding: '18px 22px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          background: 'var(--bg-modal, #131312)',
        }}>
          {/* Video Container (16:9 4K frame) */}
          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            maxHeight: '520px',
            borderRadius: '16px',
            overflow: 'hidden',
            background: '#000000',
            border: '1px solid var(--border-default, rgba(255, 255, 255, 0.1))',
            boxShadow: '0 14px 40px rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <video
              ref={videoRef}
              src="/telegram-store-guide.mp4"
              controls
              autoPlay
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            >
              عذراً، متصفحك لا يدعم تشغيل الفيديو.
            </video>
          </div>

          {/* 3 Steps Explanatory Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '12px',
          }}>
            {/* Step 1 */}
            <div style={{
              background: 'var(--bg-surface, #0d0d0c)',
              border: '1px solid var(--border-default, rgba(255, 255, 255, 0.08))',
              borderRadius: '16px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 800,
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}>
                    1
                  </span>
                  <span style={{ color: 'var(--text-primary, #e6e3d3)', fontWeight: 800, fontSize: '0.88rem' }}>أزرار الشاشة الثابتة</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary, #a5a294)', lineHeight: 1.6 }}>
                  الزبون يرى شبكة الأزرار (2×2) وأزرار الكتالوج فور دخوله، ويطلب بنقرة زر واحدة دون كتابة أي أوامر.
                </p>
              </div>
              <div style={{ marginTop: '10px', fontSize: '11px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Zap size={12} />
                <span>شاشة التيليجرام • تجربة سلسة</span>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{
              background: 'var(--bg-surface, #0d0d0c)',
              border: '1px solid var(--border-default, rgba(255, 255, 255, 0.08))',
              borderRadius: '16px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 800,
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}>
                    2
                  </span>
                  <span style={{ color: 'var(--text-primary, #e6e3d3)', fontWeight: 800, fontSize: '0.88rem' }}>إشعار مباشر في اللوحة</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary, #a5a294)', lineHeight: 1.6 }}>
                  يصلك الطلب فورياً في لوحة التحكم مع تفاصيل العميل، المنتج المطلوب، والمبلغ المسدد بدقة.
                </p>
              </div>
              <div style={{ marginTop: '10px', fontSize: '11px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={12} />
                <span>لوحة التحكم • بث طلبات حي</span>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{
              background: 'var(--bg-surface, #0d0d0c)',
              border: '1px solid var(--border-default, rgba(255, 255, 255, 0.08))',
              borderRadius: '16px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 800,
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}>
                    3
                  </span>
                  <span style={{ color: 'var(--text-primary, #e6e3d3)', fontWeight: 800, fontSize: '0.88rem' }}>تسليم الكود والتأكيد</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary, #a5a294)', lineHeight: 1.6 }}>
                  تسليم الكود بنقرة زر (أو تلقائياً)، ويستلم الزبون رسالة التأكيد والكود داخل التيليجرام في نفس الثانية.
                </p>
              </div>
              <div style={{ marginTop: '10px', fontSize: '11px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={12} />
                <span>تسليم آلي فوري 100%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid var(--border-default, rgba(255, 255, 255, 0.08))',
          background: 'var(--bg-surface, #0d0d0c)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary, #a5a294)' }}>
            <ShieldCheck size={16} color="#10b981" />
            <span>نظام أورا بوت المعتمد لربط متاجر التيليجرام الرسمية</span>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="btn btn-primary"
            style={{
              padding: '8px 24px',
              borderRadius: '999px',
              background: '#10b981',
              border: 'none',
              color: '#042f2e',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.2s',
            }}
          >
            فهمت، إغلاق الشرح
          </button>
        </div>
      </div>
    </div>
  );
}

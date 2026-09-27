import { useState } from 'react';
import StoreIcon, { stripEmojis } from './StoreIcons';
import {
  AlertTriangle,
  Megaphone,
  CheckCircle2,
  ShoppingBag,
  Folder,
  ArrowRight,
  Coins,
  CreditCard,
  FileText,
  RotateCcw,
  Bot,
  Clock,
  ExternalLink,
} from 'lucide-react';

/**
 * TelegramPhoneMockup — Ultra-Realistic Telegram Mobile Screen Simulator
 * Renders the bot's live banner, welcome greeting, and inline keyboard buttons
 * with real-time interactive simulation.
 */
export default function TelegramPhoneMockup({
  botName = 'متجر تيليغرام',
  businessName = 'متجرنا الرقمي',
  bannerUrl = '',
  welcomeMessage = 'مرحباً بك في متجرنا الرقمي!\nاختر من القائمة أدناه لتصفح الباقات وشحن رصيدك فوراً:',
  buttons = [], // array of rows: [ [ { id, text, icon, action, ... } ] ]
  forceSubscribeChannel = '',
  walletInfo = '',
  rulesText = '',
  paymentMethods = [],
  paymentTimeoutMinutes = 15,
  products = [],
}) {
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [mockView, setMockView] = useState('menu'); // 'menu' | 'product' | 'checkout' | 'payment_details' | 'wallet' | 'rules' | 'force_sub'

  // Time display
  const currentTime = new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', hour12: false }) || '21:30';

  // Handle clicking button inside phone
  const handleButtonClick = (btn) => {
    if (!btn) return;
    if (btn.action === 'product') {
      const prod = products.find(p => p.id === btn.productId) || {
        name: btn.text,
        price: btn.productPrice || '1000',
        description: 'تسليم فوري ومضمون مع دعم فني 24/7.',
        imageUrl: btn.productImage || bannerUrl || '',
      };
      setSelectedProduct(prod);
      setMockView('product');
    } else if (btn.action === 'submenu' && btn.subButtons?.length > 0) {
      setActiveSubmenu(btn);
    } else if (btn.action === 'wallet') {
      setMockView('wallet');
    } else if (btn.action === 'rules') {
      setMockView('rules');
    } else if (btn.action === 'url' && btn.url) {
      alert(`محاكاة: الزبون سينتقل إلى الرابط:\n${btn.url}`);
    }
  };

  // Buttons to display (either active submenu or main rows)
  const currentRows = activeSubmenu
    ? [
        ...(activeSubmenu.subButtons || []),
        [{ id: 'back_main', text: 'رجوع للقائمة الرئيسية', action: 'back_main' }],
      ]
    : buttons;

  return (
    <div className="tg-phone-wrapper" style={{
      width: '100%',
      maxWidth: '340px',
      margin: '0 auto',
      position: 'relative',
      userSelect: 'none',
      direction: 'ltr',
      boxSizing: 'border-box',
    }}>
      {/* ── Outer Phone Chassis ── */}
      <div style={{
        background: '#1c1c1e',
        borderRadius: 'min(48px, 12vw)',
        padding: '11px',
        boxShadow: '0 25px 60px -10px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.12), inset 0 0 3px rgba(255,255,255,0.25)',
        position: 'relative',
        boxSizing: 'border-box',
        width: '100%',
      }}>
        {/* Dynamic Island / Speaker Pill */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90px',
          height: '24px',
          background: '#000',
          borderRadius: '20px',
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: '8px',
        }}>
          {/* Mini lens reflection */}
          <div style={{
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            background: '#1a1a2e',
            border: '1px solid #28283a',
          }} />
        </div>

        {/* ── Screen Canvas (Telegram Dark Theme) ── */}
        <div style={{
          background: '#0e1621',
          borderRadius: '38px',
          overflow: 'hidden',
          height: '620px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          border: '1px solid #1f2a38',
        }}>
          {/* 1. Status Bar */}
          <div style={{
            height: '42px',
            padding: '10px 18px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            fontWeight: 700,
            color: '#ffffff',
            zIndex: 30,
          }}>
            <span>{currentTime}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <svg width="13" height="10" viewBox="0 0 16 12" fill="currentColor">
                <rect x="0" y="8" width="3" height="4" rx="0.5" />
                <rect x="4" y="6" width="3" height="6" rx="0.5" />
                <rect x="8" y="3" width="3" height="9" rx="0.5" />
                <rect x="12" y="0" width="3" height="12" rx="0.5" />
              </svg>
              <span style={{ fontSize: '9px', fontWeight: 800 }}>5G</span>
              {/* Battery icon */}
              <div style={{
                width: '18px',
                height: '9px',
                border: '1.2px solid #fff',
                borderRadius: '2.5px',
                padding: '1px',
                display: 'flex',
                alignItems: 'center',
              }}>
                <div style={{ width: '100%', height: '100%', background: '#10b981', borderRadius: '1px' }} />
              </div>
            </div>
          </div>

          {/* 2. Telegram Top Header Bar */}
          <div style={{
            background: '#17212b',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #131c26',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            zIndex: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Back arrow */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6c7883" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              {/* Bot Avatar */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0ea5e9, #10b981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: '13px',
                boxShadow: '0 2px 8px rgba(14, 165, 233, 0.4)',
              }}>
                {botName ? botName.charAt(0) : <Bot size={16} />}
              </div>
              {/* Bot Info */}
              <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                <div style={{
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  maxWidth: '140px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {botName || businessName}
                </div>
                <div style={{ color: '#0ea5e9', fontSize: '10px', fontWeight: 600 }}>
                  bot • متصل
                </div>
              </div>
            </div>

            {/* Header Right Action icons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#6c7883' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </div>
          </div>

          {/* 3. Telegram Chat Background & Content */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            background: 'radial-gradient(circle at center, #111b27 0%, #0c141d 100%)',
            direction: 'rtl',
          }}>
            {/* Date Pill */}
            <div style={{
              alignSelf: 'center',
              background: 'rgba(0, 0, 0, 0.35)',
              color: '#a1aebc',
              fontSize: '10px',
              padding: '2px 8px',
              borderRadius: '10px',
              fontWeight: 600,
            }}>
              اليوم
            </div>

            {/* Force Subscribe Warning Simulator (if enabled) */}
            {forceSubscribeChannel && mockView === 'force_sub' && (
              <div style={{
                background: '#182533',
                borderRadius: '14px 14px 4px 14px',
                padding: '10px',
                boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                border: '1px solid rgba(14, 165, 233, 0.25)',
              }}>
                <div style={{ fontSize: '11px', color: '#ffffff', lineHeight: 1.5, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <AlertTriangle size={13} color="#f59e0b" />
                  <span><strong>تنبيه الزبون:</strong> يرجى الانضمام لقناة الإثباتات واللوغز أولاً لفتح المتجر</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <button style={{
                    background: '#2b5278',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    padding: '7px',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                  }}>
                    <Megaphone size={12} />
                    <span>انضم للقناة ({forceSubscribeChannel})</span>
                  </button>
                  <button 
                    onClick={() => setMockView('menu')}
                    style={{
                      background: '#10b981',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      padding: '7px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                    }}
                  >
                    <CheckCircle2 size={12} />
                    <span>تم الانضمام / فتح المتجر</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bot Message Bubble (Banner + Greeting + Buttons) */}
            {mockView === 'menu' && (
              <div style={{
                background: '#182533',
                borderRadius: '14px 14px 4px 14px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.06)',
                maxWidth: '96%',
              }}>
                {/* Banner Image (if provided) */}
                {bannerUrl ? (
                  <div style={{ width: '100%', maxHeight: '130px', overflow: 'hidden' }}>
                    <img
                      src={bannerUrl}
                      alt="Banner"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                ) : (
                  <div style={{
                    height: '80px',
                    background: 'linear-gradient(135deg, rgba(14,165,233,0.25) 0%, rgba(16,185,129,0.25) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#34d399',
                    fontSize: '12px',
                    fontWeight: 700,
                    gap: '6px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <ShoppingBag size={16} />
                    <span>{businessName}</span>
                  </div>
                )}

                {/* Message Body */}
                <div style={{ padding: '9px 11px 6px' }}>
                  <div style={{
                    fontSize: '11px',
                    color: '#f0f3f6',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-line',
                    wordBreak: 'break-word',
                  }}>
                    {activeSubmenu ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Folder size={12} color="#38bdf8" />
                        <span>قائمة: {stripEmojis(activeSubmenu.text)}</span>
                      </span>
                    ) : stripEmojis(welcomeMessage)}
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '3px',
                    marginTop: '4px',
                    color: '#6c7883',
                    fontSize: '9px',
                  }}>
                    <span>{currentTime}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#0ea5e9">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </div>
                </div>

                {/* ── LIVE TELEGRAM INLINE KEYBOARD ── */}
                <div style={{
                  padding: '6px 7px 7px',
                  background: 'rgba(0,0,0,0.18)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}>
                  {(!currentRows || currentRows.length === 0) ? (
                    <div style={{
                      padding: '12px 8px',
                      textAlign: 'center',
                      color: '#708499',
                      fontSize: '10px',
                      border: '1px dashed rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                    }}>
                      لا توجد أزرار بعد. أضف أزراراً من المحرر باليسار
                    </div>
                  ) : (
                    currentRows.map((row, rIdx) => (
                      <div
                        key={rIdx}
                        style={{
                          display: 'flex',
                          gap: '4px',
                          width: '100%',
                        }}
                      >
                        {row.map((btn, bIdx) => (
                          <button
                            key={btn.id || bIdx}
                            onClick={() => {
                              if (btn.action === 'back_main') {
                                setActiveSubmenu(null);
                              } else {
                                handleButtonClick(btn);
                              }
                            }}
                            title={`نقر تجريبي: ${btn.text}`}
                            style={{
                              flex: 1,
                              background: btn.action === 'back_main' ? '#3e4a59' : '#2b5278',
                              border: 'none',
                              borderRadius: '7px',
                              color: '#ffffff',
                              padding: '7px 4px',
                              fontSize: row.length >= 3 ? '9.5px' : '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              transition: 'background 0.15s ease, transform 0.1s ease',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#356391'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = btn.action === 'back_main' ? '#3e4a59' : '#2b5278'; }}
                          >
                            {btn.action === 'back_main' ? (
                              <ArrowRight size={12} />
                            ) : (
                              btn.icon && <StoreIcon icon={btn.icon} size={row.length >= 3 ? 11 : 13} />
                            )}
                            <span>{stripEmojis(btn.text)}</span>
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Product Details Simulation View */}
            {mockView === 'product' && selectedProduct && (
              <div style={{
                background: '#182533',
                borderRadius: '14px 14px 4px 14px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                border: '1px solid rgba(16,185,129,0.3)',
              }}>
                {selectedProduct.imageUrl && (
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    style={{ width: '100%', height: '110px', objectFit: 'cover' }}
                  />
                )}
                <div style={{ padding: '10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                    {selectedProduct.name}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#10b981', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Coins size={13} color="#10b981" />
                    <span>السعر: {selectedProduct.price} دج</span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#b9c7d4', lineHeight: 1.5, marginBottom: '10px' }}>
                    {selectedProduct.description || 'تسليم فوري ومباشر بعد تأكيد الدفع.'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <button
                      onClick={() => setMockView('checkout')}
                      style={{
                        background: '#10b981',
                        border: 'none',
                        borderRadius: '7px',
                        color: '#fff',
                        padding: '7px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                      }}
                    >
                      <CreditCard size={12} />
                      <span>شراء الآن (اختيار وسيلة الدفع)</span>
                    </button>
                    <button
                      onClick={() => setMockView('menu')}
                      style={{
                        background: '#2b5278',
                        border: 'none',
                        borderRadius: '7px',
                        color: '#fff',
                        padding: '6px',
                        fontSize: '10.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                      }}
                    >
                      <ArrowRight size={12} />
                      <span>رجوع للقائمة</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Checkout / Order Summary with Payment Methods Simulation (Matching Screenshot) */}
            {mockView === 'checkout' && selectedProduct && (
              <div style={{
                background: '#182533',
                borderRadius: '14px 14px 4px 14px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                border: '1px solid rgba(14,165,233,0.3)',
              }}>
                {selectedProduct.imageUrl && (
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    style={{ width: '100%', height: '100px', objectFit: 'cover' }}
                  />
                )}
                <div style={{ padding: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#fff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>🛒</span>
                    <span>طلب جديد</span>
                  </div>

                  <div style={{ fontSize: '10.5px', color: '#c5d3e0', lineHeight: 1.6, marginBottom: '10px' }}>
                    <div>🧾 <strong>الطلب:</strong> #53880</div>
                    <div>📦 <strong>المنتج:</strong> {selectedProduct.name}</div>
                    <div>🔢 <strong>الكمية:</strong> 1</div>
                    <div>💰 <strong>المجموع:</strong> {selectedProduct.price} دج</div>
                    <div>🏷️ <strong>المرجع:</strong> BF3195BC277D</div>
                    <div style={{ color: '#c084fc' }}>⏳ <strong>مهلة الدفع:</strong> {paymentTimeoutMinutes} دقيقة</div>
                    <div style={{ marginTop: '6px', fontWeight: 700, color: '#38bdf8' }}>💳 اختر طريقة الدفع:</div>
                  </div>

                  {/* Payment Methods Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {(paymentMethods.filter(m => m.enabled !== false).length > 0
                      ? paymentMethods.filter(m => m.enabled !== false)
                      : [
                          { id: 'binance', name: '🔸 الدفع عبر Binance', details: 'معرف الدفع: 123456789' },
                          { id: 'baridi', name: '💳 بريدي موب BaridiMob', details: 'RIP: 00799999000123456789' },
                          { id: 'ccp', name: '📬 الحساب البريدي CCP', details: 'رقم الحساب: 1234567 مفتاح 89' },
                        ]
                    ).map((method, mIdx) => (
                      <button
                        key={method.id || mIdx}
                        onClick={() => {
                          setSelectedMethod(method);
                          setMockView('payment_details');
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          color: '#fff',
                          padding: '7px 10px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s',
                        }}
                      >
                        {method.name}
                      </button>
                    ))}

                    <button
                      onClick={() => setMockView('menu')}
                      style={{
                        background: 'rgba(248, 113, 113, 0.15)',
                        border: '1px solid rgba(248, 113, 113, 0.25)',
                        borderRadius: '8px',
                        color: '#f87171',
                        padding: '6px 10px',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        marginTop: '3px',
                      }}
                    >
                      ❌ إلغاء الطلب
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Details with Countdown Timer View */}
            {mockView === 'payment_details' && selectedMethod && (
              <div style={{
                background: '#182533',
                borderRadius: '14px 14px 4px 14px',
                padding: '11px',
                border: '1px solid rgba(192, 132, 252, 0.35)',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#c084fc', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CreditCard size={14} />
                  <span>{selectedMethod.name}</span>
                </div>

                <div style={{
                  background: 'rgba(168, 85, 247, 0.12)',
                  border: '1px solid rgba(168, 85, 247, 0.25)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: '#c084fc',
                  fontWeight: 700,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Clock size={13} />
                    <span>مؤقت الدفع:</span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{paymentTimeoutMinutes}:00</span>
                </div>

                <div style={{ fontSize: '10.5px', color: '#e0e6ed', lineHeight: 1.5, marginBottom: '8px' }}>
                  <div>🧾 <strong>رقم الطلب:</strong> #53880</div>
                  <div>💰 <strong>المبلغ المطلوب:</strong> {selectedProduct?.price || '1000'} دج</div>
                </div>

                <div style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '7px',
                  padding: '7px 9px',
                  marginBottom: '9px',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: '#38bdf8',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {selectedMethod.details || 'تفاصيل الحساب...'}
                </div>

                <div style={{ fontSize: '9.5px', color: '#94a3b8', lineHeight: 1.4, marginBottom: '9px' }}>
                  📌 <strong>تعليمات:</strong> حول المبلغ قبل انتهاء المؤقت ثم أرسل صورة الوصل أو معرف الدفع (Binance Pay ID) هنا مباشرة لتأكيد طلبك!
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <button
                    onClick={() => alert(`محاكاة: الزبون يضغط على فحص حالة الدفع. متبقي ${paymentTimeoutMinutes} دقيقة.`)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '7px',
                      color: '#fff',
                      padding: '6px',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    🔄 فحص حالة الدفع والمؤقت
                  </button>
                  <button
                    onClick={() => setMockView('menu')}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(248, 113, 113, 0.25)',
                      borderRadius: '7px',
                      color: '#f87171',
                      padding: '5px',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    ❌ إلغاء الطلب
                  </button>
                </div>
              </div>
            )}

            {/* Wallet / Payment Simulation View */}
            {mockView === 'wallet' && (
              <div style={{
                background: '#182533',
                borderRadius: '14px 14px 4px 14px',
                padding: '11px',
                border: '1px solid rgba(14,165,233,0.3)',
              }}>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0ea5e9', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={14} color="#0ea5e9" />
                  <span>شحن الرصيد والدفع</span>
                </div>
                <div style={{ fontSize: '10.5px', color: '#e0e6ed', lineHeight: 1.6, whiteSpace: 'pre-line', marginBottom: '10px' }}>
                  {walletInfo || `طرق الدفع المتوفرة:\n• بريدي موب (BaridiMob): 00799999000123456789\n• الحساب الجاري (CCP)\nبعد التحويل، أرسل صورة الوصل هنا مباشرة!`}
                </div>
                <button
                  onClick={() => setMockView('menu')}
                  style={{
                    width: '100%',
                    background: '#2b5278',
                    border: 'none',
                    borderRadius: '7px',
                    color: '#fff',
                    padding: '6px',
                    fontSize: '10.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                  }}
                >
                  <ArrowRight size={12} />
                  <span>رجوع للقائمة</span>
                </button>
              </div>
            )}

            {/* Rules / Terms Simulation View */}
            {mockView === 'rules' && (
              <div style={{
                background: '#182533',
                borderRadius: '14px 14px 4px 14px',
                padding: '11px',
                border: '1px solid rgba(245,158,11,0.3)',
              }}>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#f59e0b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} color="#f59e0b" />
                  <span>قوانين وشروط المتجر</span>
                </div>
                <div style={{ fontSize: '10px', color: '#d1d8e0', lineHeight: 1.6, whiteSpace: 'pre-line', marginBottom: '10px' }}>
                  {rulesText || `1. التسليم يتم فور تأكيد وصل الدفع.\n2. الضمان ساري طوال فترة الاشتراك.\n3. يمنع مشاركة الحسابات المخالفة للضمان.`}
                </div>
                <button
                  onClick={() => setMockView('menu')}
                  style={{
                    width: '100%',
                    background: '#2b5278',
                    border: 'none',
                    borderRadius: '7px',
                    color: '#fff',
                    padding: '6px',
                    fontSize: '10.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                  }}
                >
                  <ArrowRight size={12} />
                  <span>رجوع للقائمة</span>
                </button>
              </div>
            )}
          </div>

          {/* 4. Bottom Chat Input Mockup */}
          <div style={{
            background: '#17212b',
            padding: '7px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderTop: '1px solid #131c26',
            direction: 'rtl',
          }}>
            <div style={{
              flex: 1,
              background: '#0e1621',
              borderRadius: '18px',
              padding: '6px 12px',
              color: '#6c7883',
              fontSize: '11px',
              textAlign: 'right',
            }}>
              اكتب رسالة أو اختر زراً...
            </div>
            {/* Reset simulation view shortcut */}
            {(mockView !== 'menu' || activeSubmenu) && (
              <button
                onClick={() => { setMockView('menu'); setActiveSubmenu(null); }}
                title="إعادة ضبط المحاكي للقائمة الرئيسية"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '26px',
                  height: '26px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RotateCcw size={12} />
              </button>
            )}
          </div>

          {/* 5. Home Indicator Pill */}
          <div style={{
            height: '14px',
            background: '#17212b',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <div style={{ width: '85px', height: '3px', background: '#ffffff', borderRadius: '3px', opacity: 0.5 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

(function () {
  'use strict';

  // Identify the executing script tag to read configuration attributes
  const currentScript = document.currentScript || (function () {
    const scripts = document.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.includes('widget.js')) {
        return scripts[i];
      }
    }
    return scripts[scripts.length - 1];
  })();

  if (!currentScript) return;

  const rawWhatsapp = currentScript.getAttribute('data-whatsapp') || '';
  const rawTelegram = currentScript.getAttribute('data-telegram') || '';
  const botName = currentScript.getAttribute('data-name') || 'خدمة العملاء';
  const customGreeting = currentScript.getAttribute('data-greeting') || 'تواصل معنا مباشرة عبر المنصة المفضلة لديك';
  const defaultText = currentScript.getAttribute('data-text') || 'مرحباً، أود الاستفسار عن الخدمات والأسعار';
  const position = currentScript.getAttribute('data-position') || 'right'; // 'right' or 'left'
  const primaryColor = currentScript.getAttribute('data-color') || '#2563eb';

  // Normalize channels
  const cleanWhatsapp = rawWhatsapp.replace(/[^0-9]/g, '');
  const cleanTelegram = rawTelegram.replace(/^@/, '').trim();

  // If neither channel is provided, do nothing
  if (!cleanWhatsapp && !cleanTelegram) {
    console.warn('[AuraBot Widget] No WhatsApp number or Telegram username configured.');
    return;
  }

  // Prevent multiple injections
  if (document.getElementById('aurabot-widget-root')) {
    return;
  }

  // Inject Scoped Styles
  const styleEl = document.createElement('style');
  styleEl.id = 'aurabot-widget-styles';
  styleEl.textContent = `
    #aurabot-widget-root {
      position: fixed;
      bottom: 24px;
      ${position === 'left' ? 'left: 24px;' : 'right: 24px;'}
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      direction: rtl;
      text-align: right;
      -webkit-font-smoothing: antialiased;
      box-sizing: border-box;
    }
    #aurabot-widget-root * {
      box-sizing: border-box;
    }
    .aurabot-launcher-btn {
      width: 60px;
      height: 60px;
      border-radius: 30px;
      background-color: ${primaryColor};
      color: #ffffff;
      border: none;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22), 0 2px 6px rgba(0, 0, 0, 0.12);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
      outline: none;
      padding: 0;
      position: relative;
    }
    .aurabot-launcher-btn:hover {
      transform: scale(1.08);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
    }
    .aurabot-launcher-badge {
      position: absolute;
      top: 2px;
      ${position === 'left' ? 'right: 2px;' : 'left: 2px;'}
      width: 13px;
      height: 13px;
      background: #10b981;
      border: 2.5px solid #ffffff;
      border-radius: 50%;
    }
    .aurabot-card-popup {
      position: fixed;
      bottom: 96px;
      ${position === 'left' ? 'left: 24px;' : 'right: 24px;'}
      width: 340px;
      max-width: calc(100vw - 32px);
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.05);
      color: #f8fafc;
      overflow: hidden;
      transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.22s;
      opacity: 0;
      visibility: hidden;
      transform: translateY(16px) scale(0.95);
      z-index: 2147483646;
    }
    .aurabot-card-popup.is-open {
      opacity: 1;
      visibility: visible;
      transform: translateY(0) scale(1);
    }
    .aurabot-card-header {
      padding: 1.1rem 1.25rem;
      background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      position: relative;
    }
    .aurabot-close-btn {
      position: absolute;
      top: 12px;
      left: 12px;
      background: rgba(255, 255, 255, 0.08);
      border: none;
      color: #94a3b8;
      width: 28px;
      height: 28px;
      border-radius: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .aurabot-close-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }
    .aurabot-header-main {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .aurabot-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${primaryColor}, #1d4ed8);
      color: #ffffff;
      font-weight: 800;
      font-size: 1.15rem;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
    }
    .aurabot-avatar-dot {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 11px;
      height: 11px;
      border-radius: 50%;
      background: #10b981;
      border: 2px solid #1e293b;
    }
    .aurabot-header-text h3 {
      font-size: 1rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 2px 0;
      line-height: 1.2;
    }
    .aurabot-status-label {
      font-size: 0.74rem;
      color: #10b981;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .aurabot-status-label-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #10b981;
    }
    .aurabot-card-body {
      padding: 1.15rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .aurabot-greeting-text {
      font-size: 0.84rem;
      color: #94a3b8;
      line-height: 1.5;
      margin: 0 0 6px 0;
    }
    .aurabot-channel-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0.85rem 1rem;
      border-radius: 14px;
      text-decoration: none;
      color: #ffffff;
      font-weight: 700;
      font-size: 0.92rem;
      transition: transform 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .aurabot-channel-btn:hover {
      transform: translateY(-2px);
      filter: brightness(1.06);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
    }
    .aurabot-channel-whatsapp {
      background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
    }
    .aurabot-channel-telegram {
      background: linear-gradient(135deg, #2AABEE 0%, #229ED9 100%);
    }
    .aurabot-channel-icon {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .aurabot-channel-info {
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .aurabot-channel-title {
      font-size: 0.92rem;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.2;
    }
    .aurabot-channel-sub {
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.85);
      font-weight: 500;
      margin-top: 2px;
    }
    .aurabot-arrow-icon {
      color: rgba(255, 255, 255, 0.8);
      flex-shrink: 0;
    }
    .aurabot-card-footer {
      padding: 0.6rem 1.25rem;
      background: #090e1a;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      text-align: center;
      font-size: 0.68rem;
      color: #64748b;
    }
    @media (max-width: 480px) {
      #aurabot-widget-root {
        bottom: 16px;
        ${position === 'left' ? 'left: 16px;' : 'right: 16px;'}
      }
      .aurabot-card-popup {
        bottom: 84px;
        ${position === 'left' ? 'left: 16px;' : 'right: 16px;'}
        width: calc(100vw - 32px);
      }
    }
  `;
  document.head.appendChild(styleEl);

  // Create Container
  const container = document.createElement('div');
  container.id = 'aurabot-widget-root';

  // SVG Icons (No Emojis)
  const chatIconSvg = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  const closeIconSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const whatsappSvg = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M20.52 3.48A11.93 11.93 0 0012.04 0C5.46 0 .1 5.36.1 11.94c0 2.1.55 4.15 1.6 5.96L0 24l6.26-1.64a11.87 11.87 0 005.78 1.48h.01c6.58 0 11.94-5.36 11.94-11.94 0-3.19-1.24-6.19-3.47-8.42zM12.05 21.84h-.01a9.87 9.87 0 01-5.03-1.38l-.36-.21-3.73.98.99-3.64-.24-.38a9.88 9.88 0 01-1.52-5.27c0-5.46 4.44-9.9 9.9-9.9 2.64 0 5.13 1.03 7 2.9a9.83 9.83 0 012.89 6.99c0 5.46-4.44 9.91-9.89 9.91zm5.43-7.41c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z"/></svg>';
  const telegramSvg = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.832.932z"/></svg>';
  const arrowSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  const closeMiniSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  // State
  let isOpen = false;

  // Floating Launcher Button
  const launcher = document.createElement('button');
  launcher.className = 'aurabot-launcher-btn';
  launcher.setAttribute('aria-label', 'فتح خيارات التواصل');
  launcher.innerHTML = chatIconSvg + '<span class="aurabot-launcher-badge"></span>';

  // Popover Card
  const card = document.createElement('div');
  card.className = 'aurabot-card-popup';

  const avatarLetter = (botName || 'م').charAt(0).toUpperCase();

  // Links
  const whatsappUrl = cleanWhatsapp
    ? 'https://wa.me/' + cleanWhatsapp + '?text=' + encodeURIComponent(defaultText)
    : '';
  const telegramUrl = cleanTelegram
    ? 'https://t.me/' + cleanTelegram
    : '';

  let channelsHtml = '';
  if (cleanWhatsapp) {
    channelsHtml += `
      <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="aurabot-channel-btn aurabot-channel-whatsapp">
        <div class="aurabot-channel-icon">${whatsappSvg}</div>
        <div class="aurabot-channel-info">
          <span class="aurabot-channel-title">محادثة عبر واتساب</span>
          <span class="aurabot-channel-sub">رد فوري بالذكاء الاصطناعي</span>
        </div>
        <div class="aurabot-arrow-icon">${arrowSvg}</div>
      </a>
    `;
  }
  if (cleanTelegram) {
    channelsHtml += `
      <a href="${telegramUrl}" target="_blank" rel="noopener noreferrer" class="aurabot-channel-btn aurabot-channel-telegram">
        <div class="aurabot-channel-icon">${telegramSvg}</div>
        <div class="aurabot-channel-info">
          <span class="aurabot-channel-title">محادثة عبر تيليغرام</span>
          <span class="aurabot-channel-sub">تواصل فوري ومباشر</span>
        </div>
        <div class="aurabot-arrow-icon">${arrowSvg}</div>
      </a>
    `;
  }

  card.innerHTML = `
    <div class="aurabot-card-header">
      <button type="button" class="aurabot-close-btn" aria-label="إغلاق">${closeMiniSvg}</button>
      <div class="aurabot-header-main">
        <div class="aurabot-avatar">
          ${avatarLetter}
          <span class="aurabot-avatar-dot"></span>
        </div>
        <div class="aurabot-header-text">
          <h3>${botName}</h3>
          <span class="aurabot-status-label">
            <span class="aurabot-status-label-dot"></span>
            متصل الآن • نرد فوراً
          </span>
        </div>
      </div>
    </div>
    <div class="aurabot-card-body">
      <p class="aurabot-greeting-text">${customGreeting}</p>
      ${channelsHtml}
    </div>
    <div class="aurabot-card-footer">
      مدعوم بواسطة AuraBot
    </div>
  `;

  // Toggle Function
  function toggleWidget() {
    isOpen = !isOpen;
    if (isOpen) {
      card.classList.add('is-open');
      launcher.innerHTML = closeIconSvg;
    } else {
      card.classList.remove('is-open');
      launcher.innerHTML = chatIconSvg + '<span class="aurabot-launcher-badge"></span>';
    }
  }

  launcher.onclick = function (e) {
    e.stopPropagation();
    toggleWidget();
  };

  card.querySelector('.aurabot-close-btn').onclick = function (e) {
    e.stopPropagation();
    toggleWidget();
  };

  // Close on outer click
  document.addEventListener('click', function (e) {
    if (isOpen && !container.contains(e.target)) {
      toggleWidget();
    }
  });

  container.appendChild(card);
  container.appendChild(launcher);
  document.body.appendChild(container);
})();

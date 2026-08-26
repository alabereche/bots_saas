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

  const botId = currentScript ? (currentScript.getAttribute('data-bot-id') || currentScript.getAttribute('data-bot')) : null;
  if (!botId) {
    console.warn('[AuraBot Widget] Missing data-bot-id attribute on script tag.');
    return;
  }

  const scriptOrigin = (function () {
    try {
      const url = new URL(currentScript.src);
      return url.origin;
    } catch {
      return 'https://aurabot.pages.dev';
    }
  })();

  const position = (currentScript && currentScript.getAttribute('data-position')) || 'right'; // 'right' or 'left'
  const primaryColor = (currentScript && currentScript.getAttribute('data-color')) || '#2563eb';
  const customGreeting = (currentScript && currentScript.getAttribute('data-greeting')) || '';

  // Prevent multiple injections
  if (document.getElementById('aurabot-widget-root')) {
    return;
  }

  // Create Container
  const container = document.createElement('div');
  container.id = 'aurabot-widget-root';
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  if (position === 'left') {
    container.style.left = '20px';
  } else {
    container.style.right = '20px';
  }
  container.style.zIndex = '2147483647';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  // State
  let isOpen = false;

  // Floating Launcher Button
  const launcher = document.createElement('button');
  launcher.id = 'aurabot-launcher';
  launcher.setAttribute('aria-label', 'Open Live Chat');
  launcher.style.width = '56px';
  launcher.style.height = '56px';
  launcher.style.borderRadius = '28px';
  launcher.style.backgroundColor = primaryColor;
  launcher.style.color = '#ffffff';
  launcher.style.border = 'none';
  launcher.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.15)';
  launcher.style.cursor = 'pointer';
  launcher.style.display = 'flex';
  launcher.style.alignItems = 'center';
  launcher.style.justifyContent = 'center';
  launcher.style.transition = 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease';
  launcher.style.outline = 'none';
  launcher.style.padding = '0';

  // Chat Icon SVG
  const chatSvg = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  const closeSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  launcher.innerHTML = chatSvg;

  launcher.onmouseenter = function () {
    launcher.style.transform = 'scale(1.08)';
  };
  launcher.onmouseleave = function () {
    launcher.style.transform = 'scale(1)';
  };

  // Iframe Window
  const iframeContainer = document.createElement('div');
  iframeContainer.id = 'aurabot-iframe-container';
  iframeContainer.style.position = 'fixed';
  iframeContainer.style.bottom = '88px';
  if (position === 'left') {
    iframeContainer.style.left = '20px';
  } else {
    iframeContainer.style.right = '20px';
  }
  iframeContainer.style.width = '380px';
  iframeContainer.style.maxWidth = 'calc(100vw - 32px)';
  iframeContainer.style.height = '600px';
  iframeContainer.style.maxHeight = 'calc(100vh - 110px)';
  iframeContainer.style.borderRadius = '18px';
  iframeContainer.style.overflow = 'hidden';
  iframeContainer.style.boxShadow = '0 12px 48px rgba(0, 0, 0, 0.35), 0 4px 16px rgba(0, 0, 0, 0.15)';
  iframeContainer.style.border = '1px solid rgba(255, 255, 255, 0.12)';
  iframeContainer.style.background = '#0d1526';
  iframeContainer.style.transition = 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.25s';
  iframeContainer.style.opacity = '0';
  iframeContainer.style.visibility = 'hidden';
  iframeContainer.style.transform = 'translateY(18px) scale(0.96)';
  iframeContainer.style.zIndex = '2147483646';

  let iframeLoaded = false;
  let iframe = null;

  function initIframe() {
    if (iframeLoaded) return;
    iframe = document.createElement('iframe');
    const params = new URLSearchParams();
    params.set('embedded', 'true');
    if (customGreeting) params.set('greeting', customGreeting);
    if (primaryColor) params.set('primaryColor', encodeURIComponent(primaryColor));
    
    iframe.src = scriptOrigin + '/chat/' + encodeURIComponent(botId) + '?' + params.toString();
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.background = '#0d1526';
    iframe.setAttribute('allow', 'clipboard-write');
    iframeContainer.appendChild(iframe);
    iframeLoaded = true;
  }

  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      initIframe();
      iframeContainer.style.visibility = 'visible';
      iframeContainer.style.opacity = '1';
      iframeContainer.style.transform = 'translateY(0) scale(1)';
      launcher.innerHTML = closeSvg;
    } else {
      iframeContainer.style.opacity = '0';
      iframeContainer.style.transform = 'translateY(18px) scale(0.96)';
      launcher.innerHTML = chatSvg;
      setTimeout(function () {
        if (!isOpen) iframeContainer.style.visibility = 'hidden';
      }, 250);
    }
  }

  launcher.onclick = toggleChat;

  container.appendChild(iframeContainer);
  container.appendChild(launcher);
  document.body.appendChild(container);

  // Responsive mobile adjust
  function handleResize() {
    if (window.innerWidth <= 480) {
      iframeContainer.style.width = 'calc(100vw - 24px)';
      iframeContainer.style.height = 'calc(100vh - 100px)';
      iframeContainer.style.bottom = '80px';
      iframeContainer.style.right = '12px';
      iframeContainer.style.left = '12px';
    } else {
      iframeContainer.style.width = '380px';
      iframeContainer.style.height = '600px';
      iframeContainer.style.bottom = '88px';
      if (position === 'left') {
        iframeContainer.style.left = '20px';
        iframeContainer.style.right = 'auto';
      } else {
        iframeContainer.style.right = '20px';
        iframeContainer.style.left = 'auto';
      }
    }
  }
  window.addEventListener('resize', handleResize);
  handleResize();
})();

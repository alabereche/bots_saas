import React, { useState, useMemo } from 'react';
import StoreIcon, {
  STORE_ICON_OPTIONS,
  STORE_ICON_CATEGORIES,
  BRAND_ICONS,
} from './StoreIcons';
import { Search, Sparkles, X, Code, Check, ExternalLink } from 'lucide-react';

const POPULAR_SEARCH_SUGGESTIONS = [
  'gemini', 'openai', 'anthropic', 'spotify', 'netflix', 'youtube',
  'discord', 'canva', 'duolingo', 'telegram', 'steam', 'playstation',
  'xbox', 'binance', 'tether', 'apple', 'adobe', 'figma', 'notion',
  'github', 'twitch', 'tiktok', 'instagram', 'stripe', 'paypal',
];

export default function StoreIconPicker({
  selectedIcon = '',
  onSelectIcon,
}) {
  const [activeCategory, setActiveCategory] = useState('ai');
  const [searchQuery, setSearchQuery] = useState('');
  const [customInput, setCustomInput] = useState(
    selectedIcon && (selectedIcon.startsWith('<svg') || selectedIcon.startsWith('http') || selectedIcon.startsWith('si:'))
      ? selectedIcon
      : ''
  );

  // Filtered preset icons based on active category
  const categoryIcons = useMemo(() => {
    return STORE_ICON_OPTIONS.filter((opt) => opt.category === activeCategory);
  }, [activeCategory]);

  // Filtered search results from local presets
  const localSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return STORE_ICON_OPTIONS.filter(
      (opt) =>
        opt.id.toLowerCase().includes(q) ||
        (opt.label && opt.label.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // Handle Simple Icon search slug selection
  const handleSelectSimpleIconSlug = (slug) => {
    const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (!cleanSlug) return;
    onSelectIcon(`si:${cleanSlug}`);
  };

  const isCustomSelected =
    selectedIcon &&
    (selectedIcon.startsWith('<svg') ||
      selectedIcon.startsWith('http') ||
      selectedIcon.startsWith('si:'));

  return (
    <div className="tg-icon-picker-container">
      {/* ─── 1. Selected Icon Status Bar ─── */}
      <div className="tg-icon-picker-header">
        <div className="tg-icon-picker-current">
          <span className="tg-icon-picker-preview-box">
            {selectedIcon ? (
              <StoreIcon icon={selectedIcon} size={20} />
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
            )}
          </span>
          <div className="tg-icon-picker-current-info">
            <span className="tg-icon-picker-current-label">
              {selectedIcon ? 'الأيقونة المختارة حالياً' : 'لم يتم اختيار أيقونة'}
            </span>
            <span className="tg-icon-picker-current-val">
              {selectedIcon ? (
                selectedIcon.startsWith('<svg') ? 'كود SVG مخصص' :
                selectedIcon.startsWith('si:') ? `Simple Icons (${selectedIcon.replace('si:', '')})` :
                STORE_ICON_OPTIONS.find(o => o.id === selectedIcon)?.label || selectedIcon
              ) : 'يظهر النص فقط بدون أيقونة'}
            </span>
          </div>
        </div>

        {selectedIcon && (
          <button
            type="button"
            onClick={() => onSelectIcon('')}
            className="tg-icon-picker-clear-btn"
            title="إزالة الأيقونة"
          >
            <X size={13} />
            <span>بدون أيقونة</span>
          </button>
        )}
      </div>

      {/* ─── 2. Categories Navigation Tabs ─── */}
      <div className="tg-icon-picker-tabs">
        {STORE_ICON_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              setActiveCategory(cat.id);
            }}
            className={`tg-icon-picker-tab ${activeCategory === cat.id ? 'is-active' : ''}`}
          >
            <span style={{ fontSize: '14px' }}>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => setActiveCategory('search')}
          className={`tg-icon-picker-tab ${activeCategory === 'search' ? 'is-active is-search-tab' : ''}`}
        >
          <Search size={13} />
          <span>بحث Simple Icons (3,400+)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('custom')}
          className={`tg-icon-picker-tab ${activeCategory === 'custom' ? 'is-active is-custom-tab' : ''}`}
        >
          <Code size={13} />
          <span>لصق كود SVG</span>
        </button>
      </div>

      {/* ─── 3. Content Panel ─── */}
      <div className="tg-icon-picker-body">
        {/* Preset Categories View (AI, Apps, Gaming, General) */}
        {activeCategory !== 'search' && activeCategory !== 'custom' && (
          <div className="tg-icon-grid">
            {categoryIcons.map((opt) => {
              const isSelected = selectedIcon === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelectIcon(opt.id)}
                  className={`tg-icon-card ${isSelected ? 'is-selected' : ''}`}
                  style={{
                    borderColor: isSelected ? (opt.color || '#38bdf8') : undefined,
                  }}
                  title={opt.label}
                >
                  <div
                    className="tg-icon-card-icon"
                    style={{
                      background: isSelected ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <StoreIcon icon={opt.id} size={22} color={opt.color} />
                  </div>
                  <span className="tg-icon-card-label" title={opt.label}>
                    {opt.label}
                  </span>
                  {isSelected && (
                    <span className="tg-icon-card-check">
                      <Check size={10} color="#fff" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Live Search Tab for 3,400+ Simple Icons */}
        {activeCategory === 'search' && (
          <div className="tg-icon-search-panel">
            <div className="tg-icon-search-input-wrapper">
              <Search size={15} className="tg-icon-search-icon" />
              <input
                type="text"
                placeholder="اكتب اسم أي خدمة بالإنجليزية (مثل: gemini, apple, figma, aws, stripe)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="tg-icon-search-input"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="tg-icon-search-clear"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Quick Suggestions Chips */}
            <div className="tg-icon-search-chips">
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>مقترحات سريعة:</span>
              {POPULAR_SEARCH_SUGGESTIONS.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  onClick={() => {
                    setSearchQuery(slug);
                    handleSelectSimpleIconSlug(slug);
                  }}
                  className={`tg-icon-chip ${selectedIcon === `si:${slug}` ? 'is-active' : ''}`}
                >
                  <img
                    src={`https://cdn.simpleicons.org/${slug}`}
                    alt={slug}
                    style={{ width: '13px', height: '13px', objectFit: 'contain' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <span>{slug}</span>
                </button>
              ))}
            </div>

            {/* Live Search Direct Preview Card */}
            {searchQuery.trim().length >= 2 && (
              <div className="tg-icon-search-direct-preview">
                <div className="tg-icon-search-direct-box">
                  <img
                    src={`https://cdn.simpleicons.org/${searchQuery.toLowerCase().trim()}`}
                    alt={searchQuery}
                    style={{ width: '28px', height: '28px', objectFit: 'contain' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const errNotice = document.getElementById('si-err-notice');
                      if (errNotice) errNotice.style.display = 'block';
                    }}
                    onLoad={(e) => {
                      e.target.style.display = 'block';
                      const errNotice = document.getElementById('si-err-notice');
                      if (errNotice) errNotice.style.display = 'none';
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#fff' }}>
                      {searchQuery.toLowerCase().trim()}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#38bdf8' }}>
                      أيقونة رسمية من مكتبة Simple Icons
                    </div>
                    <div id="si-err-notice" style={{ display: 'none', fontSize: '10.5px', color: '#f87171' }}>
                      لم يتم العثور على اسم الأيقونة في Simple Icons. تأكد من صحة الكلمة بالإنجليزية.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectSimpleIconSlug(searchQuery)}
                  className="tg-icon-search-select-btn"
                >
                  <Check size={14} />
                  <span>اختيار هذه الأيقونة</span>
                </button>
              </div>
            )}

            {/* Matches in Local Pre-compiled List */}
            {localSearchResults.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  أيقونات متطابقة في القائمة السريعة:
                </div>
                <div className="tg-icon-grid">
                  {localSearchResults.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onSelectIcon(opt.id)}
                      className={`tg-icon-card ${selectedIcon === opt.id ? 'is-selected' : ''}`}
                    >
                      <div className="tg-icon-card-icon">
                        <StoreIcon icon={opt.id} size={22} color={opt.color} />
                      </div>
                      <span className="tg-icon-card-label">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Custom SVG Code / URL Paste Tab */}
        {activeCategory === 'custom' && (
          <div className="tg-icon-custom-panel">
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '8px' }}>
              انسخ كود الـ <strong>SVG</strong> مباشرة من موقع <a href="https://simpleicons.org" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>simpleicons.org</a> أو الصق رابط صورة الشعار:
            </div>

            <textarea
              rows={4}
              placeholder='<svg viewBox="0 0 24 24" ...> أو رابط https://...'
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              className="tg-icon-custom-textarea"
            />

            {/* Live Preview of Pasted Input */}
            {customInput.trim() && (
              <div className="tg-icon-custom-preview-wrapper">
                <div className="tg-icon-custom-preview-box">
                  <StoreIcon icon={customInput.trim()} size={28} />
                </div>
                <div style={{ flex: 1, fontSize: '11px', color: '#34d399' }}>
                  ✓ معاينة الشعار المخصص (جاهز للتطبيق)
                </div>
                <button
                  type="button"
                  onClick={() => onSelectIcon(customInput.trim())}
                  className="tg-icon-custom-apply-btn"
                >
                  <Check size={13} />
                  <span>تطبيق هذا الشعار</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

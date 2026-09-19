import React, { useState, useEffect, useRef } from 'react';
import { uploadProductImage, deleteProductImage } from '../services/firebase';
import { useToast } from '../context/ToastContext';

export function getSafeImageUrl(url) {
  if (!url) return '';
  // Old legacy VPS uploads are unreachable on the HTTPS domain — fallback cleanly
  if (url.includes('162.62.233.152') || url.includes('localhost')) {
    return '';
  }
  // Engine-hosted images via the Cloudflare tunnel are HTTPS — serve directly
  if (url.startsWith('https://wa.nosfir.online/')) return url;
  if (url.startsWith('https://') || url.startsWith('data:')) return url;
  if (url.startsWith('http://')) {
    const raw = url.replace(/^https?:\/\//, '');
    return `https://wsrv.nl/?url=${encodeURIComponent(raw)}`;
  }
  return url;
}

function ProductCoverImage({ src, name }) {
  const [error, setError] = useState(false);
  const safeSrc = getSafeImageUrl(src);

  if (!safeSrc || error) {
    return (
      <div className="item-no-image">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span>بدون صورة</span>
      </div>
    );
  }

  return (
    <img
      src={safeSrc}
      alt={name}
      className="item-cover-img"
      onError={() => setError(true)}
    />
  );
}

export default function ProductCatalogManager({ bot, onUpdateBot }) {
  const toast = useToast();
  const [products, setProducts] = useState(bot?.products || []);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    oldPrice: '',
    description: '',
    primaryImage: '',
    secondaryImages: [],
    stock: '',
  });
  const [showStockManager, setShowStockManager] = useState(false);
  const [stockDraft, setStockDraft] = useState({});
  const [stockFilter, setStockFilter] = useState('all');

  const primaryInputRef = useRef(null);
  const secondaryInputRef = useRef(null);

  // The engine decrements/restores stock on the LIVE bot doc (orders,
  // returns) — mirror the incoming products into local state so the badges
  // move in real time. Skipped while a form session is open so an
  // in-progress edit is never clobbered mid-typing.
  useEffect(() => {
    if (isAdding || editingId || saving) return;
    const incoming = bot?.products || [];
    setProducts((prev) =>
      JSON.stringify(prev) === JSON.stringify(incoming) ? prev : incoming
    );
  }, [bot?.products]);

  // Instant client-side WebP/JPEG compression helper
  const compressFileToDataUrl = (file) => {
    return new Promise((resolve) => {
      if (!file) return resolve('');
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const maxDim = 800;
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            let dataUrl = canvas.toDataURL('image/webp', 0.8);
            if (!dataUrl.startsWith('data:image/webp')) {
              dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            }
            resolve(dataUrl);
          } catch (err) {
            resolve(e.target.result);
          }
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Upload Images Helper (Instant WebP compression)
  const uploadFiles = async (files) => {
    if (!files || files.length === 0) return [];
    setUploading(true);
    try {
      const uploadPromises = files.map(compressFileToDataUrl);
      const urls = await Promise.all(uploadPromises);
      return urls.filter(Boolean);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('حدث خطأ أثناء معالجة الصورة');
      return [];
    } finally {
      setUploading(false);
    }
  };

  // Delete Image Helper
  const deleteImageFile = () => {};

  // Handle Primary Image Upload
  const handlePrimaryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const uploaded = await uploadFiles(files);
    if (uploaded.length === 0) return;

    setFormData((prev) => {
      const newPrimary = uploaded[0];
      const rest = uploaded.slice(1);
      const combinedSecondary = [...(prev.secondaryImages || []), ...rest].slice(0, 4);

      if (prev.primaryImage) deleteImageFile(prev.primaryImage);

      return {
        ...prev,
        primaryImage: newPrimary,
        secondaryImages: combinedSecondary,
      };
    });

    toast.success('تم ضغط ورفع الصورة بنجاح (WebP)');
    if (primaryInputRef.current) primaryInputRef.current.value = '';
  };

  // Handle Secondary Images Upload (Auto-promotes to primary if primary is missing)
  const handleSecondaryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const uploaded = await uploadFiles(files);
    if (uploaded.length === 0) return;

    setFormData((prev) => {
      let newPrimary = prev.primaryImage;
      let newSecondary = [...(prev.secondaryImages || [])];
      let toAssign = [...uploaded];

      if (!newPrimary && toAssign.length > 0) {
        newPrimary = toAssign.shift();
      }

      newSecondary = [...newSecondary, ...toAssign].slice(0, 4);

      return {
        ...prev,
        primaryImage: newPrimary,
        secondaryImages: newSecondary,
      };
    });

    toast.success(`تم ضغط ورفع الصور بنجاح (WebP)`);
    if (secondaryInputRef.current) secondaryInputRef.current.value = '';
  };

  // Set any secondary image as Primary
  const setAsPrimary = (idx) => {
    setFormData((prev) => {
      const selectedImg = prev.secondaryImages[idx];
      const oldPrimary = prev.primaryImage;
      const newSecondary = prev.secondaryImages.filter((_, i) => i !== idx);
      if (oldPrimary) newSecondary.unshift(oldPrimary);

      return {
        ...prev,
        primaryImage: selectedImg,
        secondaryImages: newSecondary.slice(0, 4),
      };
    });
    toast.success('تم تعيين الصورة كصورة رئيسية للمنتج');
  };

  // Remove Secondary Image
  const removeSecondaryImage = (idx) => {
    const removedUrl = formData.secondaryImages[idx];
    if (removedUrl) deleteImageFile(removedUrl);
    setFormData((prev) => ({
      ...prev,
      secondaryImages: prev.secondaryImages.filter((_, i) => i !== idx),
    }));
  };

  // Save Product (Add or Edit)
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('يرجى كتابة اسم المنتج');
      return;
    }

    setSaving(true);
    try {
      let updatedList = [...products];
      // '' = unmanaged (feature off for this product); a number = managed
      const normalizedStock = formData.stock === '' || formData.stock === null
        ? null
        : Math.max(0, Math.floor(Number(formData.stock) || 0));

      if (editingId) {
        // Edit existing — spread the previous product first so fields the
        // form does not own (id, anything future) survive the round-trip
        updatedList = updatedList.map((p) =>
          p.id === editingId
            ? { ...p, ...formData, stock: normalizedStock, id: editingId }
            : p
        );
      } else {
        // Add new
        const newProduct = {
          ...formData,
          stock: normalizedStock,
          id: `prod_${Date.now()}`,
        };
        updatedList.push(newProduct);
      }

      await onUpdateBot({ products: updatedList });
      setProducts(updatedList);
      setIsAdding(false);
      setEditingId(null);
      setFormData({ name: '', price: '', oldPrice: '', description: '', primaryImage: '', secondaryImages: [], stock: '' });
      toast.success(editingId ? 'تم تحديث المنتج بنجاح' : 'تمت إضافة المنتج بنجاح');
    } catch (err) {
      console.error('Save product error:', err);
      toast.error('حدث خطأ أثناء حفظ المنتج في قاعدة البيانات');
    } finally {
      setSaving(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`هل أنت متأكد من حذف المنتج "${product.name}"؟`)) return;

    if (product.primaryImage) deleteImageFile(product.primaryImage);
    if (Array.isArray(product.secondaryImages)) {
      product.secondaryImages.forEach(deleteImageFile);
    }

    const updatedList = products.filter((p) => p.id !== product.id);
    try {
      await onUpdateBot({ products: updatedList });
      setProducts(updatedList);
      toast.success('تم حذف المنتج والصور بنجاح');
    } catch (err) {
      console.error('Delete product error:', err);
      toast.error('فشل حذف المنتج');
    }
  };

  // ─── Stock manager (a LENS over the same catalog products — one save) ───
  const openStockManager = () => {
    const draft = {};
    products.forEach((p) => {
      draft[p.id] = p.stock === null || p.stock === undefined ? '' : String(p.stock);
    });
    setStockDraft(draft);
    setStockFilter('all');
    setShowStockManager(true);
  };

  const handleStockSave = async () => {
    setSaving(true);
    try {
      const updated = products.map((p) => {
        const v = stockDraft[p.id];
        const norm = v === '' || v === null || v === undefined
          ? null
          : Math.max(0, Math.floor(Number(v) || 0));
        return { ...p, stock: norm };
      });
      await onUpdateBot({ products: updated });
      setProducts(updated);
      toast.success('تم حفظ كميات المخزون بنجاح');
      setShowStockManager(false);
    } catch (err) {
      toast.error('فشل حفظ المخزون: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Start Editing
  const startEdit = (product) => {
    setEditingId(product.id);
    const validPrimary = getSafeImageUrl(product.primaryImage);
    const validSecondary = (product.secondaryImages || product.images?.slice(1) || [])
      .map(getSafeImageUrl)
      .filter(Boolean);

    setFormData({
      name: product.name || '',
      price: product.price || '',
      oldPrice: product.oldPrice || '',
      description: product.description || '',
      primaryImage: validPrimary,
      secondaryImages: validSecondary,
      stock: product.stock === null || product.stock === undefined ? '' : String(product.stock),
    });
    setIsAdding(true);
  };

  return (
    <div className="catalog-manager">
      {/* Header Banner */}
      <div className="catalog-hero-card">
        <div className="catalog-hero-content">
          <div className="catalog-hero-icon-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <div>
            <h3 className="catalog-hero-title">
              كتالوج المنتجات المصور (اختياري)
            </h3>
            <p className="catalog-hero-subtitle">
              أضف منتجاتك بصور مضغوطة تلقائياً. يعرض الذكاء الاصطناعي الصورة الأساسية مع السعر فوراً، ويرسل الألبوم الكامل للزبون عند طلبه.
            </p>
          </div>
        </div>

        {!isAdding && (
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ gap: '8px', padding: '0.65rem 1.25rem', whiteSpace: 'nowrap' }}
              onClick={() => {
                setEditingId(null);
                setFormData({ name: '', price: '', oldPrice: '', description: '', primaryImage: '', secondaryImages: [], stock: '' });
                setIsAdding(true);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              إضافة منتج جديد
            </button>
            {products.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ gap: '8px', padding: '0.65rem 1.25rem', whiteSpace: 'nowrap' }}
                onClick={openStockManager}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 7H4"/><path d="M12 3v18"/><path d="M6 21h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z"/></svg>
                إدارة المخزون
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Form Box */}
      {isAdding && (
        <form onSubmit={handleSaveProduct} className="catalog-editor-card">
          <div className="editor-header-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="editor-badge-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </div>
              <div>
                <h4 className="editor-title">
                  {editingId ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد إلى الكتالوج'}
                </h4>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                  يتم ضغط وتخزين الصور بصيغة WebP لتسريع التحميل وحفظ المساحة
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setIsAdding(false);
                setEditingId(null);
              }}
            >
              إلغاء
            </button>
          </div>

          <div className="editor-form-grid">
            <div className="form-group">
              <label className="form-label">اسم المنتج *</label>
              <input
                type="text"
                className="form-input custom-input"
                placeholder="مثال: ساعة ذكية Ultra Smartwatch مع 3 أحزمة"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">السعر ({bot.currency || 'دج'})</label>
              <div className="price-input-wrapper">
                <input
                  type="text"
                  className="form-input custom-input price-input"
                  placeholder="مثال: 6500"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
                <span className="currency-pill">{bot.currency || 'دج'}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">السعر قبل التخفيض (اختياري)</label>
              <div className="price-input-wrapper">
                <input
                  type="text"
                  className="form-input custom-input price-input"
                  placeholder="مثال: 6500"
                  value={formData.oldPrice}
                  onChange={(e) => setFormData({ ...formData, oldPrice: e.target.value })}
                />
                <span className="currency-pill">{bot.currency || 'دج'}</span>
              </div>
            </div>

          <div className="form-group">
            <label className="form-label">الكمية المتاحة (اختياري — اتركها فارغة لمنتج بلا تتبع مخزون)</label>
            <input
              type="number"
              min="0"
              className="form-input"
              placeholder="مثال: 12 — عند النفاذ يعتذر البوت تلقائياً"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
              style={{ direction: 'ltr' }}
            />
          </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">الوصف والمواصفات (يقرأها الذكاء الاصطناعي لإجابة الزبون بدقة)</label>
            <textarea
              className="form-textarea custom-textarea"
              rows="3"
              placeholder="مثال: ساعة أوريجينال وقوية، تأتي مع 3 أحزمة تبديل، تدعم الإشعارات والاتصال، شاشة لمس عالية الدقة..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Media Section: Unified & Balanced Layout */}
          <div className="editor-media-layout">
            {/* 1. Primary Image Box */}
            <div className="media-card primary-card">
              <div className="media-card-header">
                <div className="media-card-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ color: '#fbbf24' }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  الصورة الأساسية (تظهر أولاً)
                </div>
                {formData.primaryImage && (
                  <button
                    type="button"
                    className="btn-text-danger"
                    onClick={() => {
                      deleteImageFile(formData.primaryImage);
                      setFormData({ ...formData, primaryImage: '' });
                    }}
                  >
                    حذف الصورة
                  </button>
                )}
              </div>

              {getSafeImageUrl(formData.primaryImage) ? (
                <div className="preview-primary-box">
                  <img src={getSafeImageUrl(formData.primaryImage)} alt="الرئيسية" />
                  <div className="webp-pill-badge">
                    <span>جاهزة</span>
                  </div>
                </div>
              ) : (
                <div
                  className="dropzone-box primary-dropzone"
                  onClick={() => primaryInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={primaryInputRef}
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handlePrimaryUpload}
                    disabled={uploading}
                  />
                  <div className="dropzone-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </div>
                  <div className="dropzone-text">
                    {uploading ? 'جاري المعالجة...' : 'اضغط لاختيار صورة أساسية'}
                  </div>
                  <div className="dropzone-hint">JPG, PNG, WebP</div>
                </div>
              )}
            </div>

            {/* 2. Secondary Images Box */}
            <div className="media-card secondary-card">
              <div className="media-card-header">
                <div className="media-card-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  صور إضافية وزوايا (ألبوم عند الطلب)
                </div>
                <span className="count-tag">
                  {formData.secondaryImages?.length || 0} / 4 صور
                </span>
              </div>

              <div className="secondary-slots-grid">
                {(formData.secondaryImages || []).map((imgUrl, i) => (
                  <div key={i} className="preview-secondary-slot">
                    <img src={getSafeImageUrl(imgUrl)} alt={`زاوية ${i + 1}`} />
                    <div className="slot-actions-overlay">
                      <button
                        type="button"
                        className="btn-slot-primary"
                        onClick={() => setAsPrimary(i)}
                        title="تعيين كصورة أساسية"
                      >
                        رئيسية
                      </button>
                      <button
                        type="button"
                        className="btn-slot-delete"
                        onClick={() => removeSecondaryImage(i)}
                        title="حذف الصورة"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </div>
                ))}

                {(formData.secondaryImages?.length || 0) < 4 && (
                  <div
                    className="dropzone-box secondary-slot-dropzone"
                    onClick={() => secondaryInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={secondaryInputRef}
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      multiple
                      style={{ display: 'none' }}
                      onChange={handleSecondaryUpload}
                      disabled={uploading}
                    />
                    <div style={{ fontSize: '1.2rem', color: 'var(--color-primary)' }}>+</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                      {uploading ? 'جاري الرفع...' : 'إضافة صورة'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="editor-footer-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsAdding(false);
                setEditingId(null);
              }}
              disabled={saving || uploading}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ minWidth: '130px' }}
              disabled={saving || uploading}
            >
              {saving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'إضافة للمتجر'}
            </button>
          </div>
        </form>
      )}

      {/* Products Grid */}
      {products.length === 0 && !isAdding ? (
        <div className="catalog-empty-container">
          <div className="empty-icon-circle">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          </div>
          <h4 className="empty-title">
            لا توجد منتجات مضافة في الكتالوج حتى الآن
          </h4>
          <p className="empty-desc">
            هذه الميزة اختيارية. إذا أردت أن يقوم البوت بإرسال صور حقيقية ومواصفات منظمة للزبائن عند السؤال، أضف أول منتج الآن.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsAdding(true)}
          >
            + إضافة أول منتج
          </button>
        </div>
      ) : showStockManager ? (
        <div className="catalog-editor-card" style={{ padding: '1.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.7rem', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              إدارة المخزون — الكميات المتبقية
            </h4>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {[['all', 'الكل'], ['low', 'على وشك النفاذ'], ['out', 'نفذ']].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStockFilter(val)}
                  style={{
                    padding: '0.4rem 0.85rem', fontSize: '0.78rem', fontWeight: 700,
                    borderRadius: 'var(--radius-full)', cursor: 'pointer',
                    border: stockFilter === val ? '1px solid var(--color-primary)' : '1px solid var(--border-default)',
                    background: stockFilter === val ? 'rgba(16, 185, 129, 0.14)' : 'var(--bg-cell)',
                    color: stockFilter === val ? 'var(--color-primary-light)' : 'var(--text-secondary)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            اترك الخانة فارغة لمنتج بلا تتبع. الطلبية المؤكدة تحجز قطعة (البوت يتوقف عن بيعها)، و«تم التوصيل» تخرجها من المخزون نهائياً، و«ملغي/مرتجع» تحررها. ما يراه الزبون = الفعلي ناقص المحجوز.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.1rem' }}>
            {products
              .filter((p) => {
                if (stockFilter === 'low') return p.stock !== null && p.stock !== undefined && p.stock > 0 && p.stock <= 3;
                if (stockFilter === 'out') return p.stock === 0;
                return true;
              })
              .map((p) => {
              const managed = p.stock !== null && p.stock !== undefined;
              const avail = managed ? p.stock - (p.reserved || 0) : null;
              const tier = managed ? (avail <= 0 ? { label: 'نفذ', color: '#f87171' } : avail <= 3 ? { label: 'آخر ' + avail + ' قطع', color: '#fbbf24' } : { label: 'متوفر ' + avail, color: '#34d399' }) : null;
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap',
                  padding: '0.6rem 0.8rem', borderRadius: '12px',
                  background: 'var(--bg-cell)', border: '1px solid var(--border-subtle)',
                }}>
                  <span style={{ flex: '1 1 200px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {p.name}
                  </span>
                  {tier && (
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: tier.color, minWidth: '72px' }}>
                      {tier.label}
                    </span>
                  )}
                  {managed && (p.reserved || 0) > 0 && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-full)', padding: '2px 9px' }}>
                      محجوز {p.reserved}
                    </span>
                  )}
                  <input
                    type="number"
                    min="0"
                    placeholder="بدون"
                    value={stockDraft[p.id] ?? ''}
                    onChange={(e) => setStockDraft({ ...stockDraft, [p.id]: e.target.value })}
                    style={{
                      width: '92px', padding: '0.45rem 0.6rem', direction: 'ltr',
                      background: 'var(--bg-app)', color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)', borderRadius: '9px',
                      fontSize: '0.88rem',
                    }}
                  />
                </div>
              );
            })}
            {products.filter((p) => {
              if (stockFilter === 'low') return p.stock !== null && p.stock !== undefined && p.stock > 0 && p.stock <= 3;
              if (stockFilter === 'out') return p.stock === 0;
              return true;
            }).length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem', padding: '1rem' }}>
                لا منتجات مطابقة لهذا الفلتر.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowStockManager(false)}>
              إلغاء
            </button>
            <button type="button" className="btn btn-primary" onClick={handleStockSave} disabled={saving}>
              {saving ? 'جارٍ الحفظ...' : 'حفظ المخزون'}
            </button>
          </div>
        </div>
      ) : (
        <div className="catalog-items-grid">
          {products.map((p) => {
            const validPrimary = getSafeImageUrl(p.primaryImage);
            const validSecondary = (p.secondaryImages || []).map(getSafeImageUrl).filter(Boolean);
            const totalImgs = (validPrimary ? 1 : 0) + validSecondary.length;

            return (
              <div key={p.id} className="catalog-item-card">
                {/* Image Cover */}
                <div className="item-cover-wrapper">
                  <ProductCoverImage src={p.primaryImage} name={p.name} />
                  <div className="item-cover-gradient" />

                  {totalImgs > 0 && (
                    <div className="item-count-chip">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      {totalImgs} {totalImgs === 1 ? 'صورة' : 'صور'}
                    </div>
                  )}

                  {p.stock !== null && p.stock !== undefined && (() => {
                    // Sellable = physical stock minus units reserved by pending orders
                    const avail = p.stock - (p.reserved || 0);
                    return (
                      <div className="item-stock-chip" style={{
                        position: 'absolute', bottom: '10px', right: '10px',
                        padding: '3px 10px', borderRadius: 'var(--radius-full)',
                        fontSize: '0.72rem', fontWeight: 800,
                        background: avail <= 0 ? 'rgba(239, 68, 68, 0.16)' : avail <= 3 ? 'rgba(245, 158, 11, 0.16)' : 'rgba(16, 185, 129, 0.16)',
                        border: avail <= 0 ? '1px solid rgba(239, 68, 68, 0.45)' : avail <= 3 ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid rgba(16, 185, 129, 0.45)',
                        color: avail <= 0 ? '#f87171' : avail <= 3 ? '#fbbf24' : '#34d399',
                        backdropFilter: 'blur(6px)',
                      }}>
                        {avail <= 0 ? 'نفذ' : avail <= 3 ? `آخر ${avail} قطع` : `متوفر ${avail}`}
                      </div>
                    );
                  })()}
                </div>

                {/* Body Content */}
                <div className="item-content-body">
                  <div className="item-header-row">
                    <h5 className="item-name" title={p.name}>{p.name}</h5>
                  </div>

                  {p.price && (() => {
                    const oldP = parseFloat(p.oldPrice);
                    const newP = parseFloat(p.price);
                    const pct = (oldP > 0 && newP > 0 && oldP > newP)
                      ? Math.round((1 - newP / oldP) * 100)
                      : 0;
                    return (
                      <div className="item-price-row">
                        {!!pct && (
                          <span className="item-discount-badge">خصم {pct}%</span>
                        )}
                        {!!pct && (
                          <span className="item-price-old">{p.oldPrice} {bot.currency || 'دج'}</span>
                        )}
                        <span className="item-price-tag">{p.price} {bot.currency || 'دج'}</span>
                      </div>
                    );
                  })()}

                  {p.description ? (
                    <p className="item-description-text">{p.description}</p>
                  ) : (
                    <p className="item-description-text" style={{ fontStyle: 'italic', opacity: 0.5 }}>بدون وصف إضافي</p>
                  )}

                  {/* Actions Footer */}
                  <div className="item-actions-footer">
                    <button
                      type="button"
                      className="btn-item-edit"
                      onClick={() => startEdit(p)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      تعديل
                    </button>
                    <button
                      type="button"
                      className="btn-item-delete"
                      onClick={() => handleDeleteProduct(p)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

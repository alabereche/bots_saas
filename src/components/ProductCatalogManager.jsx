import React, { useState, useRef } from 'react';
import { auth } from '../services/firebase';
import { useToast } from '../context/ToastContext';

const API_BASE = import.meta.env.VITE_WHATSAPP_ENGINE_URL || 'http://162.62.233.152:3001';

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
    description: '',
    primaryImage: '',
    secondaryImages: [],
  });

  const primaryInputRef = useRef(null);
  const secondaryInputRef = useRef(null);

  // Get Auth Token for Secure API Calls
  const getAuthToken = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');
    return await user.getIdToken();
  };

  // Upload Images Helper (Multer + Sharp on VPS)
  const uploadFiles = async (files) => {
    if (!files || files.length === 0) return [];
    setUploading(true);
    try {
      const token = await getAuthToken();
      const body = new FormData();
      body.append('botId', bot.id);
      for (let i = 0; i < files.length; i++) {
        body.append('images', files[i]);
      }

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل رفع الصور');
      }

      return data.images.map((img) => img.url);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(err.message || 'خطأ أثناء رفع الصور إلى السيرفر');
      return [];
    } finally {
      setUploading(false);
    }
  };

  // Delete Image from VPS Disk (Garbage Collection)
  const deleteImageFile = async (url) => {
    if (!url || !url.includes('/uploads/')) return;
    try {
      const token = await getAuthToken();
      await fetch(`${API_BASE}/api/upload/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          botId: bot.id,
          url,
        }),
      });
    } catch (err) {
      console.warn('Failed to delete image file from server:', err.message);
    }
  };

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

      if (editingId) {
        // Edit existing
        updatedList = updatedList.map((p) =>
          p.id === editingId
            ? { ...formData, id: editingId }
            : p
        );
      } else {
        // Add new
        const newProduct = {
          ...formData,
          id: `prod_${Date.now()}`,
        };
        updatedList.push(newProduct);
      }

      await onUpdateBot({ products: updatedList });
      setProducts(updatedList);
      setIsAdding(false);
      setEditingId(null);
      setFormData({ name: '', price: '', description: '', primaryImage: '', secondaryImages: [] });
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

  // Start Editing
  const startEdit = (product) => {
    setEditingId(product.id);
    setFormData({
      name: product.name || '',
      price: product.price || '',
      description: product.description || '',
      primaryImage: product.primaryImage || '',
      secondaryImages: product.secondaryImages || product.images?.slice(1) || [],
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
          <button
            type="button"
            className="btn btn-primary"
            style={{ gap: '8px', padding: '0.65rem 1.25rem', whiteSpace: 'nowrap' }}
            onClick={() => {
              setEditingId(null);
              setFormData({ name: '', price: '', description: '', primaryImage: '', secondaryImages: [] });
              setIsAdding(true);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            إضافة منتج جديد
          </button>
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

              {formData.primaryImage ? (
                <div className="preview-primary-box">
                  <img src={formData.primaryImage} alt="الرئيسية" />
                  <div className="webp-pill-badge">
                    <span>WebP</span>
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
                    {uploading ? 'جاري الضغط والرفع...' : 'اضغط لرفع الصورة الأساسية'}
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
                    <img src={imgUrl} alt={`زاوية ${i + 1}`} />
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
      ) : (
        <div className="catalog-items-grid">
          {products.map((p) => {
            const hasImages = !!p.primaryImage || (p.secondaryImages && p.secondaryImages.length > 0);
            const totalImgs = (p.primaryImage ? 1 : 0) + (p.secondaryImages?.length || 0);

            return (
              <div key={p.id} className="catalog-item-card">
                {/* Image Cover */}
                <div className="item-cover-wrapper">
                  {p.primaryImage ? (
                    <img src={p.primaryImage} alt={p.name} className="item-cover-img" />
                  ) : (
                    <div className="item-no-image">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      <span>بدون صورة</span>
                    </div>
                  )}

                  <div className="item-cover-gradient" />

                  {totalImgs > 0 && (
                    <div className="item-count-chip">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      {totalImgs} {totalImgs === 1 ? 'صورة' : 'صور'}
                    </div>
                  )}
                </div>

                {/* Body Content */}
                <div className="item-content-body">
                  <div className="item-header-row">
                    <h5 className="item-name" title={p.name}>{p.name}</h5>
                    {p.price && (
                      <span className="item-price-tag">
                        {p.price} {bot.currency || 'دج'}
                      </span>
                    )}
                  </div>

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

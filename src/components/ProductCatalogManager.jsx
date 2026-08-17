import React, { useState, useRef } from 'react';
import { auth } from '../services/firebase';
import { useToast } from '../context/ToastContext';

const API_BASE = 'http://162.62.233.152:3001';

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
    const file = e.target.files?.[0];
    if (!file) return;
    const uploaded = await uploadFiles([file]);
    if (uploaded.length > 0) {
      // If there was an old image, delete it
      if (formData.primaryImage) deleteImageFile(formData.primaryImage);
      setFormData((prev) => ({ ...prev, primaryImage: uploaded[0] }));
      toast.success('تم ضغط ورفع الصورة الرئيسية (WebP)');
    }
  };

  // Handle Secondary Images Upload (Max 4)
  const handleSecondaryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const currentCount = formData.secondaryImages?.length || 0;
    const availableSlots = 4 - currentCount;

    if (availableSlots <= 0) {
      toast.error('الحد الأقصى للصور الثانوية هو 4 صور فقط');
      return;
    }

    const filesToUpload = files.slice(0, availableSlots);
    const uploaded = await uploadFiles(filesToUpload);
    if (uploaded.length > 0) {
      setFormData((prev) => ({
        ...prev,
        secondaryImages: [...(prev.secondaryImages || []), ...uploaded].slice(0, 4),
      }));
      toast.success(`تم ضغط ورفع ${uploaded.length} صورة ثانوية (WebP)`);
    }
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

    // Delete image files from VPS
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
      {/* Header Info */}
      <div className="catalog-header">
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            🛍️ كتالوج المنتجات المصور (اختياري)
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            أضف منتجاتك بصورة رئيسية و حتى 4 صور للزوايا. سيقوم الذكاء الاصطناعي بعرض الصورة وسعرها عند استفسار الزبون، أو إرسال الألبوم الكامل عند طلبه.
          </p>
        </div>
        {!isAdding && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingId(null);
              setFormData({ name: '', price: '', description: '', primaryImage: '', secondaryImages: [] });
              setIsAdding(true);
            }}
          >
            + إضافة منتج جديد
          </button>
        )}
      </div>

      {/* Add / Edit Form Modal / Box */}
      {isAdding && (
        <form onSubmit={handleSaveProduct} className="catalog-form-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {editingId ? '✏️ تعديل المنتج' : '✨ إضافة منتج جديد إلى الكتالوج'}
            </h4>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: '0.8rem', padding: '4px 10px' }}
              onClick={() => {
                setIsAdding(false);
                setEditingId(null);
              }}
            >
              إلغاء
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">اسم المنتج *</label>
              <input
                type="text"
                className="form-input"
                placeholder="مثال: كارت شاشة Nvidia RTX 4060 8GB"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">السعر ({bot.currency || 'دج'})</label>
              <input
                type="text"
                className="form-input"
                placeholder="مثال: 64,000"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.2rem' }}>
            <label className="form-label">الوصف والمواصفات (يقرأها الذكاء الاصطناعي لإجابة الزبون)</label>
            <textarea
              className="form-textarea"
              rows="2"
              placeholder="مثال: نسخة ثلاثية المراوح، تدعم DLSS 3، جديدة مع ضمان رسمي سنة كاملة..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Media Section: 1 Primary + up to 4 Secondary */}
          <div className="catalog-media-section">
            {/* 1. Primary Image */}
            <div className="media-box primary-media-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399' }}>
                  ⭐ الصورة الرئيسية (تظهر في الرد الأول)
                </span>
                {formData.primaryImage && (
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer' }}
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
                <div className="image-preview-wrapper main-preview">
                  <img src={formData.primaryImage} alt="الرئيسية" />
                  <span className="badge badge-success" style={{ position: 'absolute', bottom: '6px', right: '6px' }}>WebP مضغوطة</span>
                </div>
              ) : (
                <div
                  className="upload-dropzone"
                  onClick={() => primaryInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={primaryInputRef}
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    style={{ display: 'none' }}
                    onChange={handlePrimaryUpload}
                    disabled={uploading}
                  />
                  <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>📷</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {uploading ? 'جاري الضغط والرفع...' : 'اضغط لرفع الصورة الرئيسية (JPG / PNG / WebP)'}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Secondary Images (Max 4) */}
            <div className="media-box secondary-media-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  🖼️ صور إضافية وزوايا (حتى 4 صور - تظهر عند طلب الزبون)
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  {formData.secondaryImages?.length || 0} / 4 صور
                </span>
              </div>

              <div className="secondary-grid">
                {(formData.secondaryImages || []).map((imgUrl, i) => (
                  <div key={i} className="image-preview-wrapper secondary-preview">
                    <img src={imgUrl} alt={`زاوية ${i + 1}`} />
                    <button
                      type="button"
                      className="btn-remove-img"
                      onClick={() => removeSecondaryImage(i)}
                      title="حذف هذه الصورة"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {(formData.secondaryImages?.length || 0) < 4 && (
                  <div
                    className="upload-dropzone secondary-dropzone"
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
                    <div style={{ fontSize: '1.2rem' }}>+</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                      {uploading ? 'جاري الرفع...' : 'إضافة صورة'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1.2rem' }}>
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
              disabled={saving || uploading}
            >
              {saving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'إضافة للمتجر'}
            </button>
          </div>
        </form>
      )}

      {/* Products List Grid */}
      {products.length === 0 && !isAdding ? (
        <div className="catalog-empty-state">
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📦</div>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            لا توجد منتجات مصورة حتى الآن
          </h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 1.2rem' }}>
            هذه الميزة اختيارية. إذا تركتها فارغة، سيعمل البوت بشكل نصي طبيعي مع قائمة الخدمات. أضف منتجات إذا كنت تريد إرسال الصور للزبائن.
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
        <div className="products-grid">
          {products.map((p) => {
            const hasImages = !!p.primaryImage || (p.secondaryImages && p.secondaryImages.length > 0);
            const totalImgs = (p.primaryImage ? 1 : 0) + (p.secondaryImages?.length || 0);

            return (
              <div key={p.id} className="product-card">
                {/* Thumbnail Preview */}
                <div className="product-card-thumb">
                  {p.primaryImage ? (
                    <img src={p.primaryImage} alt={p.name} />
                  ) : (
                    <div className="thumb-placeholder">📷 بدون صورة</div>
                  )}
                  {totalImgs > 0 && (
                    <span className="thumb-count-badge">
                      {totalImgs} {totalImgs === 1 ? 'صورة' : 'صور'}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="product-card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                    <h5 className="product-title">{p.name}</h5>
                    {p.price && (
                      <span className="product-price-badge">
                        {p.price} {bot.currency || 'دج'}
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <p className="product-desc">{p.description}</p>
                  )}

                  {/* Actions */}
                  <div className="product-card-actions">
                    <button
                      type="button"
                      className="btn-action-edit"
                      onClick={() => startEdit(p)}
                    >
                      ✏️ تعديل
                    </button>
                    <button
                      type="button"
                      className="btn-action-delete"
                      onClick={() => handleDeleteProduct(p)}
                    >
                      🗑️ حذف
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

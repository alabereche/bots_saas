import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBot } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { COUNTRIES } from '../data/countries';

export const BUSINESS_TYPES = [
  { value: 'shop', label: '🏪 متجر إلكتروني / مبيعات وتجارة', placeholder: 'مثال:\nحذاء رياضي - 4500 دج\nقميص قطني - 2500 دج\nعطر فاخر - 6000 دج' },
  { value: 'support', label: '🎧 خدمة عملاء ودعم فني', placeholder: 'مثال:\nكيفية إعادة تعيين كلمة المرور\nأوقات الرد على التذاكر\nسياسة الإرجاع والضمان' },
  { value: 'agency', label: '🏢 شركة / وكالة خدمات', placeholder: 'مثال:\nتصميم المواقع وتطبيقات الموبايل\nإدارة الحملات الإعلانية\nصناعة المحتوى والتسويق' },
  { value: 'booking', label: '📅 حجز مواعيد واستشارات', placeholder: 'مثال:\nجلسة استشارية (45 دقيقة) - 3000 دج\nموعد مقابلة عمل\nحجز معاينة ميدانية' },
  { value: 'clinic', label: '🩺 عيادة / مركز صحي وطبي', placeholder: 'مثال:\nفحص طبي عام - 2000 دج\nتنظيف وتبييض الأسنان - 5000 دج\nجلسة علاج طبيعي - 3000 دج' },
  { value: 'education', label: '🎓 تعليم / دورات وتدريب', placeholder: 'مثال:\nدورة الذكاء الاصطناعي - 15000 دج\nكورس اللغة الإنجليزية - 8000 دج\nدروس خصوصية' },
  { value: 'realestate', label: '🏠 عقارات ومقاولات', placeholder: 'مثال:\nشقق للبيع F3 و F4\nكراء محلات تجارية\nأراضي للبناء واستشارات عقارية' },
  { value: 'restaurant', label: '🍽️ مطعم / كافيه', placeholder: 'مثال:\nوجبة برجر دبل - 900 دج\nبيتزا مارغريتا - 800 دج\nعصائر ومشروبات - 250 دج' },
  { value: 'services', label: '🛠️ خدمات مهنية وحرفية', placeholder: 'مثال:\nصيانة أجهزة التكييف\nخدمات كهرباء ومعمارية\nنقل أثاث وبضائع' },
  { value: 'assistant', label: '🤖 مساعد ذكي شخصي / عام', placeholder: 'اكتب هنا المعلومات والبيانات والمهام التي تريد أن يجيب عنها مساعدك الشخصي...' },
  { value: 'custom', label: '✍️ نشاط أو فكرة مخصصة', placeholder: 'اكتب هنا تفاصيل نشاطك وخدماتك والأسئلة الشائعة بالتفصيل...' },
];

const RESPONSE_STYLES = [
  { value: 'formal', label: 'رسمي', desc: 'ردود مهنية واحترافية' },
  { value: 'friendly', label: 'ودود', desc: 'ردود طبيعية ومرحة' },
  { value: 'concise', label: 'مختصر', desc: 'ردود سريعة ومباشرة' },
];

const LANGUAGES = [
  { value: 'arabic_algerian', label: 'دارجة جزائرية', desc: 'اللهجة الجزائرية الدارجة' },
  { value: 'arabic_formal', label: 'عربي فصيح', desc: 'اللغة العربية الفصحى' },
  { value: 'auto', label: 'تلقائي', desc: 'يرد بنفس لغة المستخدم' },
];

export default function CreateBot() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Project Info
  const [platform, setPlatform] = useState('telegram');
  const [businessName, setBusinessName] = useState('');
  const [botName, setBotName] = useState('');
  const [businessType, setBusinessType] = useState('shop');
  const [customType, setCustomType] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('DZ'); // Default: Algeria
  const [description, setDescription] = useState('');
  const [services, setServices] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [location, setLocation] = useState('');
  const [contact, setContact] = useState('');

  // Step 2: Personality
  const [responseStyle, setResponseStyle] = useState('friendly');
  const [language, setLanguage] = useState('arabic_algerian');
  const [customInstructions, setCustomInstructions] = useState('');

  // Step 3: Technical
  const [telegramToken, setTelegramToken] = useState('');

  const countryObj = COUNTRIES.find(c => c.code === selectedCountry) || COUNTRIES[0];
  const selectedTypeObj = BUSINESS_TYPES.find(b => b.value === businessType) || BUSINESS_TYPES[0];

  const validateStep1 = () => {
    if (!businessName.trim() || !botName.trim()) {
      toast.error('يرجى ملء اسم المشروع واسم البوت');
      return false;
    }
    if (businessType === 'custom' && !customType.trim()) {
      toast.error('يرجى تحديد نوع النشاط المخصص');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (platform === 'telegram' && !telegramToken.trim()) {
      toast.error('يرجى إدخال توكن بوت تيليغرام (BotFather Token)');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    setStep(s => Math.min(s + 1, 3));
  };

  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    if (!validateStep3()) return;
    if (!user) {
      toast.error('يرجى تسجيل الدخول أولاً');
      return;
    }

    setLoading(true);
    try {
      const botData = {
        userId: user.uid,
        userEmail: user.email,
        platform,
        businessName: businessName.trim(),
        botName: botName.trim(),
        businessType,
        customType: businessType === 'custom' ? customType.trim() : '',
        country: selectedCountry,
        countryName: countryObj.name,
        currency: countryObj.currency,
        phoneCode: countryObj.dialCode,
        description: description.trim(),
        services: services.trim(),
        workingHours: workingHours.trim(),
        location: location.trim(),
        contact: contact.trim(),
        responseStyle,
        language,
        customInstructions: customInstructions.trim(),
        aiProvider: 'gemini',
        aiModel: 'gemini-2.5-flash',
        isActive: false,
        messagesCount: 0,
        ordersCount: 0,
        autoOrdersTelegram: true,
        autoOrdersWhatsapp: true,
      };

      if (platform === 'telegram') {
        botData.telegramToken = telegramToken.trim();
      } else {
        botData.whatsappEnabled = true;
        botData.whatsappStatus = 'not_initialized';
      }

      const created = await createBot(botData);
      toast.success('تم إنشاء البوت بنجاح!');
      navigate(`/bot/${created.id}`);
    } catch (err) {
      toast.error(err.message || 'خطأ في إنشاء البوت');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container animate-enter" style={{ maxWidth: '820px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 'var(--space-6)' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem', gap: 'var(--space-2)', borderRadius: 'var(--radius-full)' }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          العودة للوحة التحكم
        </button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>إنشاء <span className="text-gradient">بوت ذكي مخصص</span></h1>
        <p style={{ color: 'var(--text-secondary)' }}>أنشئ مساعدك الذكي لأي نشاط، متجر، شركة، عيادة، أو خدمة في دقائق</p>
      </div>

      {/* Wizard Progress */}
      <div className="wizard-progress">
        <div className={`wizard-step ${step >= 1 ? (step > 1 ? 'completed' : 'active') : ''}`}>
          <div className="wizard-step-number">
            {step > 1 ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : '1'}
          </div>
          <span className="wizard-step-label">معلومات النشاط</span>
        </div>
        <div className={`wizard-connector ${step > 1 ? 'completed' : ''}`} />
        <div className={`wizard-step ${step >= 2 ? (step > 2 ? 'completed' : 'active') : ''}`}>
          <div className="wizard-step-number">
            {step > 2 ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : '2'}
          </div>
          <span className="wizard-step-label">شخصية البوت</span>
        </div>
        <div className={`wizard-connector ${step > 2 ? 'completed' : ''}`} />
        <div className={`wizard-step ${step === 3 ? 'active' : ''}`}>
          <div className="wizard-step-number">3</div>
          <span className="wizard-step-label">الربط والتشغيل</span>
        </div>
      </div>

      <div className="card">
        {/* Step 1: Business Info */}
        {step === 1 && (
          <div className="wizard-body">
            <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                معلومات المشروع أو النشاط
              </span>
            </h3>

            {/* Platform Selection */}
            <div className="form-group">
              <label className="form-label">منصة البوت <span className="required">*</span></label>
              <div className="radio-group" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <label className={`radio-card ${platform === 'telegram' ? 'selected' : ''}`}>
                  <input type="radio" name="platform" value="telegram" checked={platform === 'telegram'} onChange={e => setPlatform(e.target.value)} />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#26A5E4' }}><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                    <span className="radio-card-label">تيليغرام (Telegram)</span>
                  </span>
                  <span className="radio-card-desc">يعمل عبر توكن مجاني من BotFather</span>
                </label>
                <label className={`radio-card ${platform === 'whatsapp' ? 'selected' : ''}`}>
                  <input type="radio" name="platform" value="whatsapp" checked={platform === 'whatsapp'} onChange={e => setPlatform(e.target.value)} />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#25D366' }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    <span className="radio-card-label">واتساب (WhatsApp)</span>
                  </span>
                  <span className="radio-card-desc">ربط مباشر بمسح رمز QR Code</span>
                </label>
              </div>
            </div>

            {/* Country and Currency Selector */}
            <div className="form-group">
              <label className="form-label">دولة النشاط والعملة <span className="required">*</span></label>
              <select 
                className="form-input form-select" 
                value={selectedCountry} 
                onChange={e => {
                  setSelectedCountry(e.target.value);
                  if (e.target.value === 'DZ') setLanguage('arabic_algerian');
                  else setLanguage('arabic_formal');
                }}
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} — العملة: {c.currency} ({c.currencyName})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">اسم المشروع / الجهة <span className="required">*</span></label>
                <input type="text" className="form-input" placeholder="مثال: متجر النور / عيادة الشفاء / وكالة الإبداع" value={businessName} onChange={e => setBusinessName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">اسم البوت <span className="required">*</span></label>
                <input type="text" className="form-input" placeholder="مثال: المساعد الذكي / خدمة العملاء" value={botName} onChange={e => setBotName(e.target.value)} />
              </div>
            </div>

            {/* Business Type */}
            <div className="form-group">
              <label className="form-label">نوع ومجال النشاط <span className="required">*</span></label>
              <select className="form-input form-select" value={businessType} onChange={e => setBusinessType(e.target.value)}>
                {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {businessType === 'custom' && (
              <div className="form-group animate-enter">
                <label className="form-label">حدد نوع النشاط المخصص <span className="required">*</span></label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="مثال: تأجير فساتين، صيانة سيارات، بيع اشتراكات رقمية، جمعية خيرية..." 
                  value={customType} 
                  onChange={e => setCustomType(e.target.value)} 
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">نبذة ووصف عن المشروع</label>
              <textarea className="form-input form-textarea" rows="2" placeholder="اكتب نبذة مختصرة عن نشاطك والهدف منه..." value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">الخدمات / المنتجات / قائمة الأسعار والمعلومات (بالـ {countryObj.currency})</label>
              <textarea 
                className="form-input form-textarea" 
                rows="4"
                placeholder={selectedTypeObj.placeholder}
                value={services} 
                onChange={e => setServices(e.target.value)} 
              />
              <p className="form-helper">أدخل هنا كل الخدمات، المنتجات، الأسعار، أو الأسئلة المتكررة التي تريد من البوت الإجابة عنها</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">مواعيد وساعات العمل / التوفر</label>
                <input type="text" className="form-input" placeholder="مثال: يومياً من 8 صباحاً حتى 8 مساءً" value={workingHours} onChange={e => setWorkingHours(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">الموقع أو المدينة / الولاية</label>
                <input type="text" className="form-input" placeholder="مثال: الجزائر العاصمة، وهران، سطيف، أو متاح أونلاين" value={location} onChange={e => setLocation(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">بيانات التواصل المباشر (الهاتف / الحسابات)</label>
              <input type="text" className="form-input" placeholder={`مثال: ${countryObj.example}`} value={contact} onChange={e => setContact(e.target.value)} />
            </div>
          </div>
        )}

        {/* Step 2: Personality */}
        {step === 2 && (
          <div className="wizard-body">
            <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                شخصية البوت وأسلوب التحدث
              </span>
            </h3>

            <div className="form-group">
              <label className="form-label">أسلوب الرد</label>
              <div className="radio-group">
                {RESPONSE_STYLES.map(s => (
                  <label key={s.value} className={`radio-card ${responseStyle === s.value ? 'selected' : ''}`}>
                    <input type="radio" name="responseStyle" value={s.value} checked={responseStyle === s.value} onChange={e => setResponseStyle(e.target.value)} />
                    <span className="radio-card-label">{s.label}</span>
                    <span className="radio-card-desc">{s.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">اللغة واللهجة المعتمدة</label>
              <div className="radio-group">
                {LANGUAGES.map(l => (
                  <label key={l.value} className={`radio-card ${language === l.value ? 'selected' : ''}`}>
                    <input type="radio" name="language" value={l.value} checked={language === l.value} onChange={e => setLanguage(e.target.value)} />
                    <span className="radio-card-label">{l.label}</span>
                    <span className="radio-card-desc">{l.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">تعليمات وقواعد مخصصة إضافية (اختياري)</label>
              <textarea className="form-input form-textarea" rows="3" placeholder="مثال: التوصيل متاح لجميع الولايات. لا تقدم خصومات إلا للكميات الكبيرة. عند الاستفسار عن كذا قل كذا..." value={customInstructions} onChange={e => setCustomInstructions(e.target.value)} />
              <p className="form-helper">أي شروط أو تعليمات خاصة تود من الذكاء الاصطناعي الالتزام بها حرفياً</p>
            </div>
          </div>
        )}

        {/* Step 3: Technical */}
        {step === 3 && (
          <div className="wizard-body">
            <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                الربط والتشغيل الفوري
              </span>
            </h3>

            {platform === 'telegram' && (
              <div className="form-group">
                <label className="form-label">توكن بوت تيليغرام (BotFather Token) <span className="required">*</span></label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="مثال: 123456789:ABCDefGhIJKlmnOPQrsTUVwxyz" 
                  value={telegramToken} 
                  onChange={e => setTelegramToken(e.target.value)} 
                  dir="ltr" 
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }} 
                />
                <p className="form-helper">احصل على التوكن مجاناً وبسهولة من @BotFather في تيليغرام عبر أمر /newbot</p>
              </div>
            )}

            {platform === 'whatsapp' && (
              <div style={{ background: 'rgba(37, 211, 102, 0.08)', border: '1px solid rgba(37, 211, 102, 0.2)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  <span style={{ fontWeight: 600, color: '#25D366', fontSize: 'var(--text-sm)' }}>ربط واتساب الفوري</span>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
                  بعد الضغط على "إنشاء وتشغيل البوت"، ستفتح صفحة البوت وسيظهر لك رمز QR Code لمسحه عبر تطبيق WhatsApp من هاتفك.
                </p>
              </div>
            )}

            <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                <span style={{ fontWeight: 600, color: 'var(--accent-color)', fontSize: 'var(--text-sm)' }}>الذكاء الاصطناعي (Google Gemini 2.5 Flash)</span>
              </div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
                سيتحدث البوت بلهجة وعملة <strong>{countryObj.name} ({countryObj.currency})</strong> مع دعم كامل لحجز الطلبات والاستشارات والمواعيد وتسجيلها آلياً في لوحة تحكمك.
              </p>
            </div>
          </div>
        )}

        {/* Wizard Actions */}
        <div className="wizard-actions">
          {step > 1 ? (
            <button className="btn btn-secondary" onClick={handleBack}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              السابق
            </button>
          ) : <div />}

          {step < 3 ? (
            <button className="btn btn-primary" onClick={handleNext}>
              التالي
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={loading}>
              {loading ? <span className="spinner" /> : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              )}
              إنشاء وتشغيل البوت
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

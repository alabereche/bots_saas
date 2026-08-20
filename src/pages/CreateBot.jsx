import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBot } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { COUNTRIES } from '../data/countries';

export const BUSINESS_TYPES = [
  { value: 'shop', label: 'متجر إلكتروني / مبيعات وتجارة', placeholder: 'مثال:\nحذاء رياضي - 4500 دج\nقميص قطني - 2500 دج\nعطر فاخر - 6000 دج' },
  { value: 'support', label: 'خدمة عملاء ودعم فني', placeholder: 'مثال:\nكيفية إعادة تعيين كلمة المرور\nأوقات الرد على التذاكر\nسياسة الإرجاع والضمان' },
  { value: 'agency', label: 'شركة / وكالة خدمات', placeholder: 'مثال:\nتصميم المواقع وتطبيقات الموبايل\nإدارة الحملات الإعلانية\nصناعة المحتوى والتسويق' },
  { value: 'booking', label: 'حجز مواعيد واستشارات', placeholder: 'مثال:\nجلسة استشارية (45 دقيقة) - 3000 دج\nموعد مقابلة عمل\nحجز معاينة ميدانية' },
  { value: 'clinic', label: 'عيادة / مركز صحي وطبي', placeholder: 'مثال:\nفحص طبي عام - 2000 دج\nتنظيف وتبييض الأسنان - 5000 دج\nجلسة علاج طبيعي - 3000 دج' },
  { value: 'education', label: 'تعليم / دورات وتدريب', placeholder: 'مثال:\nدورة الذكاء الاصطناعي - 15000 دج\nكورس اللغة الإنجليزية - 8000 دج\nدروس خصوصية' },
  { value: 'realestate', label: 'عقارات ومقاولات', placeholder: 'مثال:\nشقق للبيع F3 و F4\nكراء محلات تجارية\nأراضي للبناء واستشارات عقارية' },
  { value: 'restaurant', label: 'مطعم / كافيه', placeholder: 'مثال:\nوجبة برجر دبل - 900 دج\nبيتزا مارغريتا - 800 دج\nعصائر ومشروبات - 250 دج' },
  { value: 'services', label: 'خدمات مهنية وحرفية', placeholder: 'مثال:\nصيانة أجهزة التكييف\nخدمات كهرباء ومعمارية\nنقل أثاث وبضائع' },
  { value: 'assistant', label: 'مساعد ذكي شخصي / عام', placeholder: 'اكتب هنا المعلومات والبيانات والمهام التي تريد أن يجيب عنها مساعدك الشخصي...' },
  { value: 'custom', label: 'نشاط أو فكرة مخصصة', placeholder: 'اكتب هنا تفاصيل نشاطك وخدماتك والأسئلة الشائعة بالتفصيل...' },
];

const RESPONSE_STYLES = [
  { value: 'friendly', label: 'ودود وطبيعي', desc: 'ردود مرحة، لبقة وتجذب الزبائن' },
  { value: 'formal', label: 'رسمي واحترافي', desc: 'ردود دقيقة، مهنية ومباشرة' },
  { value: 'concise', label: 'مختصر وسريع', desc: 'إجابات محددة بدون إطالة' },
];

const LANGUAGES = [
  { value: 'arabic_algerian', label: 'دارجة جزائرية', desc: 'لهجة جزائرية مفهومة وقريبة من الزبائن' },
  { value: 'arabic_formal', label: 'عربي فصيح', desc: 'لغة عربية سليمة ومفهومة لكل الدول' },
  { value: 'auto', label: 'تلقائي ذكي', desc: 'يرد بنفس لغة ولهجة كل زبون تلقائياً' },
];

const CHANNELS_CONFIG = [
  {
    id: 'facebook',
    name: 'فيسبوك مسنجر',
    subtitle: 'Messenger',
    desc: 'الرد الفوري على رسائل صفحتك وتأكيد الطلبيات',
    color: '#0084FF',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.093.303 2.253.464 3.443.464 6.627 0 12-4.974 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26 6.559-6.963 3.13 3.26 5.889-3.26-6.56 6.963z"/>
      </svg>
    ),
  },
  {
    id: 'instagram',
    name: 'إنستغرام Direct',
    subtitle: 'Instagram DM',
    desc: 'أتمتة المحادثات وحجز الطلبات من رسائل الحساب',
    color: '#E4405F',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
  },
  {
    id: 'whatsapp',
    name: 'واتساب',
    subtitle: 'WhatsApp',
    desc: 'ربط رقم المتجر بمسح كود QR وإرسال الفواتير',
    color: '#25D366',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
  },
  {
    id: 'telegram',
    name: 'تيليغرام',
    subtitle: 'Telegram',
    desc: 'ربط توكن BotFather مع شحن وتتبع الطلبيات',
    color: '#26A5E4',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
  },
];

export default function CreateBot() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [selectedChannels, setSelectedChannels] = useState(['facebook', 'instagram', 'whatsapp', 'telegram']);
  const [businessName, setBusinessName] = useState('');
  const [botName, setBotName] = useState('');
  const [businessType, setBusinessType] = useState('shop');
  const [customType, setCustomType] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('DZ');
  const [description, setDescription] = useState('');
  const [services, setServices] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [location, setLocation] = useState('');
  const [contact, setContact] = useState('');

  const [responseStyle, setResponseStyle] = useState('friendly');
  const [language, setLanguage] = useState('arabic_algerian');
  const [customInstructions, setCustomInstructions] = useState('');

  const [telegramToken, setTelegramToken] = useState('');

  const countryObj = COUNTRIES.find(c => c.code === selectedCountry) || COUNTRIES[0];
  const selectedTypeObj = BUSINESS_TYPES.find(b => b.value === businessType) || BUSINESS_TYPES[0];

  const toggleChannel = (channelId) => {
    setSelectedChannels(prev => {
      if (prev.includes(channelId)) {
        if (prev.length === 1) {
          toast.warning('يجب الإبقاء على قناة واحدة على الأقل');
          return prev;
        }
        return prev.filter(c => c !== channelId);
      } else {
        return [...prev, channelId];
      }
    });
  };

  const validateStep1 = () => {
    if (!businessName.trim() || !botName.trim()) {
      toast.error('يرجى ملء اسم المشروع واسم البوت');
      return false;
    }
    if (selectedChannels.length === 0) {
      toast.error('يرجى اختيار قناة واحدة على الأقل');
      return false;
    }
    if (businessType === 'custom' && !customType.trim()) {
      toast.error('يرجى تحديد نوع النشاط المخصص');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (selectedChannels.includes('telegram') && !telegramToken.trim()) {
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
      const primaryPlatform = selectedChannels.includes('whatsapp') ? 'whatsapp' : selectedChannels[0];

      const botData = {
        userId: user.uid,
        userEmail: user.email,
        platform: primaryPlatform,
        enabledChannels: selectedChannels,
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
        aiModel: 'gemini-3.5-flash-lite',
        isActive: false,
        messagesCount: 0,
        ordersCount: 0,
        autoOrdersTelegram: true,
        autoOrdersWhatsapp: true,
        facebookEnabled: selectedChannels.includes('facebook'),
        instagramEnabled: selectedChannels.includes('instagram'),
        whatsappEnabled: selectedChannels.includes('whatsapp'),
        telegramEnabled: selectedChannels.includes('telegram'),
        whatsappStatus: selectedChannels.includes('whatsapp') ? 'not_initialized' : 'disabled',
        features: {
          catalog: true,
          orders: businessType === 'shop' || businessType === 'restaurant' || businessType === 'services',
          orderTracking: businessType === 'shop',
          delivery: businessType === 'shop',
          notifications: businessType === 'shop',
          bookings: businessType === 'booking' || businessType === 'clinic' || businessType === 'salon',
          webhooks: true,
        },
      };

      if (selectedChannels.includes('telegram') && telegramToken.trim()) {
        botData.telegramToken = telegramToken.trim();
      }

      const created = await createBot(botData);
      toast.success('تم إنشاء المتجر والمساعد الذكي بنجاح!');
      navigate(`/bot/${created.id}`);
    } catch (err) {
      toast.error(err.message || 'خطأ في إنشاء البوت');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '820px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1.25rem' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard')} style={{ gap: '6px' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          العودة للوحة التحكم
        </button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: '999px',
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          color: '#60a5fa',
          fontSize: '0.82rem',
          fontWeight: 700,
          marginBottom: '0.85rem'
        }}>
          <span style={{ fontSize: '1rem' }}>⚡</span> عقل ذكي موحد لكل القنوات (Omnichannel)
        </div>
        <h1 style={{ fontSize: '1.95rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>
          إنشاء مساعد ذكي لمتجرك
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.94rem', maxWidth: '580px', margin: '0 auto' }}>
          أدخل بيانات نشاطك وكتالوجك مرة واحدة، وسيتولى الذكاء الاصطناعي الرد والبيع وتأكيد الطلبيات عبر كافة قنواتك المفضلة فوراً.
        </p>
      </div>

      <div className="wizard-progress">
        <div className={`wizard-step ${step >= 1 ? (step > 1 ? 'completed' : 'active') : ''}`}>
          <div className="wizard-step-number">
            {step > 1 ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : '1'}
          </div>
          <span>النشاط والقنوات</span>
        </div>
        <div className={`wizard-connector ${step > 1 ? 'completed' : ''}`} />
        <div className={`wizard-step ${step >= 2 ? (step > 2 ? 'completed' : 'active') : ''}`}>
          <div className="wizard-step-number">
            {step > 2 ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : '2'}
          </div>
          <span>شخصية الذكاء الاصطناعي</span>
        </div>
        <div className={`wizard-connector ${step > 2 ? 'completed' : ''}`} />
        <div className={`wizard-step ${step === 3 ? 'active' : ''}`}>
          <div className="wizard-step-number">3</div>
          <span>الربط والتشغيل</span>
        </div>
      </div>

      <div className="card" style={{ padding: '2rem', border: '1px solid rgba(255, 255, 255, 0.08)', background: 'linear-gradient(180deg, rgba(20, 26, 40, 0.95) 0%, rgba(13, 17, 26, 0.95) 100%)' }}>
        
        {step === 1 && (
          <div>
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  قنوات التواصل المستهدفة للربط <span className="required">*</span>
                </label>
                <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                  {selectedChannels.length} قنوات محددة لنفس المتجر
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
                {CHANNELS_CONFIG.map(ch => {
                  const isSelected = selectedChannels.includes(ch.id);
                  return (
                    <div
                      key={ch.id}
                      onClick={() => toggleChannel(ch.id)}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        background: isSelected ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.015)',
                        border: isSelected ? `1.5px solid ${ch.color}` : '1.5px solid rgba(255, 255, 255, 0.08)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isSelected ? `0 0 15px ${ch.color}25` : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.6rem',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ color: ch.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {ch.icon}
                        </div>
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '6px',
                          border: isSelected ? `2px solid ${ch.color}` : '2px solid rgba(255, 255, 255, 0.2)',
                          background: isSelected ? ch.color : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: 800
                        }}>
                          {isSelected && '✓'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>
                          {ch.name}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.3 }}>
                          {ch.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="form-helper" style={{ marginTop: '8px' }}>
                💡 يمكنك تحديد أكثر من منصة معاً. عقل البوت والكتالوج سيكون مشتركاً وموحداً بينهم تلقائياً.
              </p>
            </div>

            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '1.5rem 0' }} />

            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '1.25rem' }}>
              معلومات النشاط والعملة
            </h3>

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

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">اسم المشروع / المتجر <span className="required">*</span></label>
                <input type="text" className="form-input" placeholder="مثال: متجر النور / عيادة الشفاء" value={businessName} onChange={e => setBusinessName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">اسم المساعد الآلي <span className="required">*</span></label>
                <input type="text" className="form-input" placeholder="مثال: سارة / المساعد الذكي" value={botName} onChange={e => setBotName(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">نوع ومجال النشاط <span className="required">*</span></label>
              <select className="form-input form-select" value={businessType} onChange={e => setBusinessType(e.target.value)}>
                {BUSINESS_TYPES.map(b => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>

            {businessType === 'custom' && (
              <div className="form-group">
                <label className="form-label">حدد نوع النشاط المخصص <span className="required">*</span></label>
                <input type="text" className="form-input" placeholder="مثال: خدمات شحن وتخليص جمركي" value={customType} onChange={e => setCustomType(e.target.value)} />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">نبذة ووصف عن المشروع</label>
              <textarea className="form-input form-textarea" rows="2" placeholder="اكتب نبذة مختصرة عن نشاطك والهدف منه..." value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">
                {businessType === 'shop' || businessType === 'restaurant' ? 'المنتجات / قائمة الأسعار الأولية' : 'الخدمات / قائمة الأسعار والمعلومات'} ({countryObj.currency})
              </label>
              <textarea className="form-input form-textarea" rows="4" placeholder={selectedTypeObj.placeholder} value={services} onChange={e => setServices(e.target.value)} />
              <p className="form-helper">يمكنك إضافة وإدارة كتالوج متقدم بالصور والأقسام لاحقاً من لوحة تحكم البوت</p>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">أوقات العمل</label>
                <input type="text" className="form-input" placeholder="مثال: يومياً من 9 صباحاً إلى 8 مساءً" value={workingHours} onChange={e => setWorkingHours(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">المقر / العنوان</label>
                <input type="text" className="form-input" placeholder="مثال: الجزائر العاصمة، حي النصر" value={location} onChange={e => setLocation(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">معلومات التواصل المباشر</label>
              <input type="text" className="form-input" placeholder="مثال: هاتف: 0550123456" value={contact} onChange={e => setContact(e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-body">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', marginBottom: '1.25rem' }}>
              شخصية البوت وأسلوب التحدث
            </h3>

            <div className="form-group">
              <label className="form-label">أسلوب الرد والتفاعل</label>
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
              <p className="form-helper">أي شروط أو سياسات خاصة تود من الذكاء الاصطناعي الالتزام بها حرفياً مع زبائنك</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="wizard-body">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', marginBottom: '1.25rem' }}>
              الربط والتشغيل الفوري
            </h3>

            {selectedChannels.includes('telegram') && (
              <div className="form-group" style={{ background: 'rgba(38, 165, 228, 0.06)', border: '1px solid rgba(38, 165, 228, 0.25)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                  <span style={{ color: '#26A5E4' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                  </span>
                  <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.95rem' }}>إعداد بوت تيليغرام</span>
                </div>
                <label className="form-label">توكن البوت من BotFather <span className="required">*</span></label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="مثال: 123456789:ABCDefGhIJKlmnOPQrsTUVwxyz" 
                  value={telegramToken} 
                  onChange={e => setTelegramToken(e.target.value)} 
                  dir="ltr" 
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }} 
                />
                <p className="form-helper">احصل على التوكن مجاناً وبسهولة من @BotFather في تيليغرام عبر أمر /newbot</p>
              </div>
            )}

            {/* Channels Summary Card */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                القنوات المفعلة للربط في هذا البوت ({selectedChannels.length}):
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {selectedChannels.map(chId => {
                  const ch = CHANNELS_CONFIG.find(c => c.id === chId);
                  if (!ch) return null;
                  return (
                    <div key={ch.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: ch.color }}>{ch.icon}</span>
                        <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.9rem' }}>{ch.name}</span>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>
                        جاهز للربط الفوري ✓
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Engine Info */}
            <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ color: '#a78bfa' }}>✨</span>
                <span style={{ fontWeight: 700, color: '#a78bfa', fontSize: '0.95rem' }}>
                  محرك الذكاء الاصطناعي (Google Gemini 3.5 Flash-Lite)
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                سيعمل البوت بلهجة وعملة <strong>{countryObj.name} ({countryObj.currency})</strong> مع دعم كامل لحجز وتأكيد الطلبيات، وإرسال الصور وكتالوج المنتجات، وتتبع الشحنات آلياً.
              </p>
            </div>
          </div>
        )}

        {/* Wizard Actions */}
        <div className="wizard-actions" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between' }}>
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
              إنشاء وتشغيل المساعد الذكي
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

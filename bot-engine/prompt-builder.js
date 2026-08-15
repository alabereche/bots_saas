// ═══════════════════════════════════════════════════════════════
// BotForge — Universal Prompt Builder
// Creates dynamic AI personas for ANY use case:
// Stores, Customer Support, Clinics, Agencies, Real Estate,
// Education, Booking Appointments, Personal Assistants, etc.
// ═══════════════════════════════════════════════════════════════

const STYLE_MAP = {
  formal: 'استخدم لغة رسمية ومهنية واحترافية. لا تستخدم عبارات عامية.',
  friendly: 'كن ودوداً ومرحاً وقريباً من المستخدم. استخدم لغة طبيعية ومريحة ومرحبة.',
  concise: 'كن مختصراً ومباشراً. أعطِ إجابات قصيرة ودقيقة بدون إطالة.',
};

const LANG_MAP = {
  arabic_formal: 'تحدث باللغة العربية الفصحى فقط.',
  arabic_algerian: 'تحدث بالدارجة الجزائرية المفهومة واللطيفة. استخدم تعبيرات جزائرية طبيعية مثل: واش، كيفاش، بصح، هذاك، مرحبا بيك، ربي يحفظك.',
  auto: 'رد بنفس لغة المستخدم. إذا كتب بالعربية رد بالعربية، وإذا كتب بالفرنسية أو الإنجليزية رد بنفس لغته.',
};

const TYPE_MAP = {
  shop: 'متجر / نشاط تجاري',
  support: 'خدمة عملاء ودعم فني',
  agency: 'شركة / وكالة خدمات',
  booking: 'مركز حجز مواعيد واستشارات',
  clinic: 'عيادة / مركز صحي',
  education: 'مؤسسة تعليمية / تدريب',
  realestate: 'عقارات وتطوير عقاري',
  restaurant: 'مطعم / مقهى',
  services: 'مقدم خدمات مهنية',
  assistant: 'مساعد ذكي شخصي',
  custom: 'مشروع / جهة',
  other: 'مشروع',
};

export function buildSystemPrompt(config) {
  const activityType = TYPE_MAP[config.businessType] || config.customType || 'مشروع';
  const style = STYLE_MAP[config.responseStyle] || STYLE_MAP.friendly;
  const lang = LANG_MAP[config.language] || (config.country === 'DZ' ? LANG_MAP.arabic_algerian : LANG_MAP.arabic_formal);
  const currency = config.currency || 'دج';
  const countryName = config.countryName || 'الجزائر';

  let prompt = `أنت "${config.botName}"، المساعد الذكي الرسمي لـ "${config.businessName}" (${activityType}) في ${countryName}.

## طبيعة عملك ودورك
أنت مساعد تفاعلي متخصص في تمثيل "${config.businessName}". دورك هو مساعدة المستخدمين والعملاء، الإجابة على استفساراتهم، تقديم المعلومات بدقة، وتسهيل أي إجراء يطلبونه (حجز، شراء، استفسار، تواصل).

## أسلوب التحدث
${style}

## لغة الرد
${lang}
`;

  if (config.description) {
    prompt += `\n## نبذة وتعريف عن المشروع / النشاط\n${config.description}\n`;
  }

  if (config.services) {
    prompt += `\n## الخدمات / المنتجات / قائمة الأسعار والمعلومات\n${config.services}\n`;
  }

  if (config.workingHours) {
    prompt += `\n## مواعيد وساعات العمل / التوفر\n${config.workingHours}\n`;
  }

  if (config.location) {
    prompt += `\n## الموقع / المدينة / العنوان\n${config.location}\n`;
  }

  if (config.contact) {
    prompt += `\n## بيانات التواصل وقنوات الدعم المباشرة\n${config.contact}\n`;
  }

  if (config.customInstructions) {
    prompt += `\n## تعليمات وقواعد مخصصة (يجب الالتزام بها بدقة عالية)\n${config.customInstructions}\n`;
  }

  prompt += `
## قواعد عامة وسلوكيات الذكاء الاصطناعي:
1. كن مفيداً وإيجابياً ومباشراً في إجاباتك.
2. إذا سألك المستخدم عن أسعار أو تفاصيل غير مذكورة في المعلومات أعلاه، لا تخترع تفاصيل من عندك، بل أخبره بلطف أن هذه التفاصيل سيجيبه عنها الفريق المختص عند التواصل المباشر.
3. إذا طلب المستخدم التحدث مع المسؤول البشري أو المالك: "سأحولك الآن إلى المسؤول، يرجى الانتظار لحظات."`;

  // Universal Booking & Order Collection (Works for products, services, appointments, consultations)
  if (config.autoOrdersEnabled) {
    prompt += `

## نظام الحجز وتأكيد الطلبات التلقائي
أنت مخول أيضاً بجمع وتأكيد بيانات الطلبات أو حجوزات المواعيد/الخدمات من المستخدمين:

### خطوات الحجز أو تسجيل الطلب:
1. بعد أن يحدد المستخدم ما يرغب به (منتج، خدمة، استشارة، موعد)، اطلب منه المعلومات التالية:
   - الاسم الكامل
   - رقم الهاتف
   - العنوان أو المدينة أو التفاصيل المطلوبة
2. اعرض ملخصاً واضحاً للحجز أو الطلب:

📋 ملخص الطلب / الحجز:
📌 الخدمة/الطلب: (ما حدده المستخدم)
${config.currency ? `💰 السعر / الرسوم: (المبلغ إن وجد) ${currency}` : ''}
👤 الاسم: (اسم المستخدم)
📱 الهاتف: (رقم الهاتف)
📍 العنوان / الملاحظات: (التفاصيل)

ثم اسأله للتأكيد: "هل تؤكد هذه البيانات للمتابعة معك؟"

3. إذا أكد المستخدم صراحةً (نعم، تمام، أكيد، واه، صح، أو أي عبارة موافقة)، أضف في آخر سطر من ردك بالضبط:
[ORDER_CONFIRMED]{"product":"الخدمة أو المنتج","price":"السعر إن وجد","name":"الاسم","phone":"الرقم","address":"العنوان أو الملاحظات"}

(تنبيه: هذا السطر تقني للمحرك ولن يظهر للمستخدم في الواجهة).`;
  }

  return prompt;
}

// ═══════════════════════════════════════════════════════════════
// BotForge — System Prompt Builder (CommonJS version)
// Reused from Telegram engine — generates AI prompts from config
// ═══════════════════════════════════════════════════════════════

const STYLE_MAP = {
  formal: 'استخدم لغة رسمية ومهنية واحترافية. لا تستخدم عبارات عامية.',
  friendly: 'كن ودوداً ومرحاً وقريباً من المستخدم. استخدم لغة طبيعية ومريحة.',
  concise: 'كن مختصراً ومباشراً. أعطِ إجابات قصيرة ودقيقة بدون إطالة.',
};

const LANG_MAP = {
  arabic_formal: 'تحدث باللغة العربية الفصحى فقط.',
  arabic_algerian: 'تحدث بالدارجة الجزائرية. استخدم تعبيرات مثل: واش، كيفاش، بصح، هذاك، ياسر، إلخ.',
  auto: 'رد بنفس لغة المستخدم. إذا كتب بالعربية رد بالعربية، وإذا كتب بالفرنسية رد بالفرنسية.',
};

const TYPE_MAP = {
  restaurant: 'مطعم', shop: 'متجر', clinic: 'عيادة',
  salon: 'صالون تجميل', delivery: 'خدمة توصيل',
  education: 'مؤسسة تعليمية', other: 'مشروع',
};

function buildSystemPrompt(config) {
  const type = TYPE_MAP[config.businessType] || 'مشروع';
  const style = STYLE_MAP[config.responseStyle] || STYLE_MAP.friendly;
  const lang = LANG_MAP[config.language] || LANG_MAP.auto;

  let prompt = `أنت "${config.botName}"، مساعد ذكي لـ "${config.businessName}" وهو ${type}.

## دورك
أنت مسؤول عن الرد على استفسارات العملاء والزبائن بخصوص ${config.businessName}. ساعدهم بأفضل طريقة ممكنة.

## أسلوبك
${style}

## اللغة
${lang}
`;

  if (config.description) prompt += `\n## وصف المشروع\n${config.description}\n`;
  if (config.services) prompt += `\n## الخدمات والأسعار\n${config.services}\n`;
  if (config.workingHours) prompt += `\n## ساعات العمل\n${config.workingHours}\n`;
  if (config.location) prompt += `\n## الموقع\n${config.location}\n`;
  if (config.contact) prompt += `\n## بيانات التواصل\n${config.contact}\n`;
  if (config.customInstructions) prompt += `\n## تعليمات خاصة (اتبعها بدقة)\n${config.customInstructions}\n`;

  prompt += `
## قواعد عامة
- لا تخترع أسعاراً أو خدمات غير مذكورة أعلاه.
- إذا سأل المستخدم عن شيء لا تعرفه، اعتذر واقترح عليه التواصل مباشرة.
- لا ترد على أسئلة خارج نطاق عمل ${config.businessName}.
- كن دقيقاً في المعلومات ولا تتكلم بما لا تعرفه.
- اجعل ردودك مفيدة وواضحة.`;

  return prompt;
}

module.exports = { buildSystemPrompt };

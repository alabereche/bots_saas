import fs from 'fs';
import path from 'path';

const targetFile = path.resolve('src/pages/BotDetail.jsx');
let code = fs.readFileSync(targetFile, 'utf8');

const newFunc = `  const defaultDeliveryMessage = (order, currentBot) => {
    const customerName = order.customerName || 'عميلنا العزيز';
    const productName = order.product || 'طلبيتكم';
    const price = order.price ? \`\${order.price} \${currentBot.currency || 'دج'}\` : '';
    const address = order.address || '';
    const storeName = currentBot.businessName || 'متجرنا';

    if (currentBot.deliveryReceiptMessage && currentBot.deliveryReceiptMessage.trim()) {
      return currentBot.deliveryReceiptMessage
        .replace(/{name}/g, customerName)
        .replace(/{product}/g, productName)
        .replace(/{price}/g, price)
        .replace(/{address}/g, address)
        .replace(/{store}/g, storeName);
    }

    let text = \`طلبيتك وصلت وهي جاهزة للاستلام!\\n\\n\`;
    text += \`عزيزي/عزيزتي \${customerName}،\\n\`;
    text += \`يسعدنا إبلاغك بأن طلبيتك الخاصة بـ (\${productName}) قد وصلت وباتت جاهزة للاستلام.\\n\\n\`;
    text += \`📋 تفاصيل الاستلام:\\n\`;
    text += \`• الطلب / المنتج: \${productName}\\n\`;
    if (price) text += \`• المبلغ المطلوب عند الاستلام: \${price}\\n\`;
    if (address) text += \`• العنوان / جهة التسليم: \${address}\\n\`;
    text += \`\\nيرجى التقدم للاستلام، وإذا كان لديك أي استفسار يسعدنا دائماً تواصلك معنا!\\n\`;
    text += \`شكراً لتعاملك وثقتك بـ "\${storeName}".\`;
    return text;
  };`;

code = code.replace(/const defaultDeliveryMessage = \([\s\S]*?return text;\s*};/, newFunc.trim());

// Update button labels and text
code = code.replace('>اكتمل التوصيل</button>', '>وصلت الطلبية (إشعار الاستلام)</button>');
code = code.replace('إشعار وإيصال التوصيل التلقائي', 'إشعار وصول الطلبية والاستلام');
code = code.replace('عند الضغط على "اكتمل التوصيل" في أي طلبية، يتم إرسال رسالة شكر وإيصال استلام للزبون تلقائياً في المحادثة.', 'عند الضغط على "وصلت الطلبية"، يتم إرسال إشعار فوري للزبون بأن طلبيته وصلت وجاهزة للاستلام مع العنوان والمبلغ المطلوب.');
code = code.replace('إشعار اكتمال التوصيل', 'إشعار وصول الطلبية والاستلام');

fs.writeFileSync(targetFile, code, 'utf8');
console.log('Successfully updated BotDetail.jsx');

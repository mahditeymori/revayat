// Local FAQ knowledge base for the support widget (components/SupportWidget.tsx).
// No external AI call — matching is plain keyword scoring, so answering stays
// fast and free of server/API load. Add new entries here; no code changes needed.
export type FaqEntry = { id: string; question: string; keywords: string[]; answer: string };

export const faqEntries: FaqEntry[] = [
  {
    id: 'shipping-time',
    question: 'ارسال سفارش چقدر طول می‌کشد؟',
    keywords: ['ارسال', 'تحویل', 'پست', 'زمان', 'چند روز'],
    answer:
      'سفارش‌ها طی یک روز کاری آماده و تحویل پست می‌شوند. تهران ۱ تا ۲ روز کاری، سایر شهرها ۲ تا ۴ روز کاری. پس از تحویل به پست، کد رهگیری پیامک می‌شود.',
  },
  {
    id: 'shipping-cost',
    question: 'هزینه ارسال چقدر است؟',
    keywords: ['هزینه ارسال', 'کرایه پست', 'هزینه پست'],
    answer: 'هزینه ارسال بر اساس مقصد در صفحه تسویه حساب محاسبه و پیش از پرداخت نمایش داده می‌شود.',
  },
  {
    id: 'returns',
    question: 'چطور می‌توانم کالا را بازگردانم؟',
    keywords: ['بازگشت', 'مرجوعی', 'پس دادن', 'استرداد'],
    answer:
      'تا ۷ روز پس از دریافت سفارش امکان بازگشت وجود دارد؛ کالا باید استفاده‌نشده و با برچسب اصلی باشد. برای شروع، شماره سفارش را از صفحه تماس با ما ارسال کنید.',
  },
  {
    id: 'refund',
    question: 'پول بازگشتی چه زمانی به حسابم برمی‌گردد؟',
    keywords: ['استرداد وجه', 'پول برگشت', 'بازگشت وجه'],
    answer: 'پس از دریافت و بررسی کالای مرجوعی، مبلغ طی ۳ تا ۵ روز کاری به حساب شما بازمی‌گردد.',
  },
  {
    id: 'size-guide',
    question: 'چه سایزی مناسب من است؟',
    keywords: ['سایز', 'اندازه', 'راهنمای سایز', 'فیت'],
    answer:
      'تی‌شرت‌ها دوخت اورسایز دارند؛ برای فیت استاندارد یک سایز کوچک‌تر بگیرید. S: عرض ۵۲ قد ۷۰ — M: عرض ۵۶ قد ۷۲ — L: عرض ۶۰ قد ۷۴ — XL: عرض ۶۴ قد ۷۶ (سانتی‌متر).',
  },
  {
    id: 'material',
    question: 'جنس پارچه چیست و چطور بشورم؟',
    keywords: ['جنس', 'پارچه', 'شستشو', 'نگهداری'],
    answer: 'پنبه سوپر درجه‌یک با دوخت اورسایز. شست‌وشو با آب سرد و اتو از پشت پارچه توصیه می‌شود.',
  },
  {
    id: 'order-tracking',
    question: 'چطور سفارشم را پیگیری کنم؟',
    keywords: ['پیگیری', 'کد رهگیری', 'وضعیت سفارش'],
    answer: 'پس از تحویل مرسوله به پست، کد رهگیری از طریق پیامک برای شما ارسال می‌شود.',
  },
  {
    id: 'cancel-order',
    question: 'می‌توانم سفارشم را لغو کنم؟',
    keywords: ['لغو', 'کنسل', 'انصراف'],
    answer: 'تا پیش از ارسال مرسوله به پست امکان لغو سفارش وجود دارد؛ از صفحه تماس با ما شماره سفارش را ارسال کنید تا پیگیری شود.',
  },
  {
    id: 'payment',
    question: 'روش‌های پرداخت چیست؟',
    keywords: ['پرداخت', 'درگاه', 'کارت بانکی'],
    answer: 'پرداخت به‌صورت آنلاین و از طریق درگاه بانکی امن در مرحله تسویه حساب انجام می‌شود.',
  },
  {
    id: 'authenticity',
    question: 'سایت روایت اعتماد الکترونیکی دارد؟',
    keywords: ['اینماد', 'نماد اعتماد', 'اعتبار سایت'],
    answer: 'بله، نماد اعتماد الکترونیکی روایت در پایین صفحه و کنار دکمه خرید قابل مشاهده و کلیک است.',
  },
  {
    id: 'contact',
    question: 'چطور با پشتیبانی تماس بگیرم؟',
    keywords: ['تماس', 'پشتیبانی', 'ارتباط با ما'],
    answer: 'از طریق صفحه تماس با ما یا اینستاگرام instagram.com/revayat.shop در ارتباط باشید. پاسخ‌گویی شنبه تا چهارشنبه، ۱۰ تا ۱۸.',
  },
  {
    id: 'privacy',
    question: 'اطلاعات من چطور محافظت می‌شود؟',
    keywords: ['حریم خصوصی', 'اطلاعات شخصی', 'کوکی'],
    answer: 'روایت از سرویس تحلیلی بیرونی استفاده نمی‌کند و اطلاعات سفارش فقط برای ارسال کالا نگهداری می‌شود. جزئیات در صفحه حریم خصوصی.',
  },
];

const STOPWORD_MIN_LEN = 2;

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Plain keyword-overlap scoring — no model, no network call. Runs client-side
// in well under a millisecond for this list size.
export function findAnswer(rawQuery: string): FaqEntry | null {
  const query = normalize(rawQuery);
  if (!query) return null;
  const words = query.split(' ').filter((w) => w.length >= STOPWORD_MIN_LEN);
  if (words.length === 0) return null;

  let best: FaqEntry | null = null;
  let bestScore = 0;
  for (const entry of faqEntries) {
    const haystack = normalize(`${entry.question} ${entry.keywords.join(' ')}`);
    let score = words.reduce((acc, w) => acc + (haystack.includes(w) ? 1 : 0), 0);
    if (haystack.includes(query)) score += 2; // whole-phrase match, e.g. a suggested question clicked verbatim
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore > 0 ? best : null;
}

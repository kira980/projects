export type Locale = "he" | "ar";

type Dict = Record<string, { he: string; ar: string }>;

/**
 * Flat dictionary for the driver + production apps only — the rest of
 * the system stays Hebrew. Both languages render RTL; only text and
 * `lang` change.
 */
const DICT: Dict = {
  // Shared
  back: { he: "חזרה", ar: "رجوع" },
  logout: { he: "יציאה", ar: "خروج" },
  refresh: { he: "רענון", ar: "تحديث" },
  save: { he: "שמירה", ar: "حفظ" },
  saving: { he: "שומר...", ar: "جاري الحفظ..." },
  cancel: { he: "ביטול", ar: "إلغاء" },
  notes_optional: { he: "הערה (לא חובה)", ar: "ملاحظة (اختياري)" },
  proof_photo_optional: { he: "צילום אסמכתא (לא חובה)", ar: "صورة إثبات (اختياري)" },
  amount: { he: "סכום (₪)", ar: "المبلغ (₪)" },
  payment_method: { he: "אמצעי תשלום", ar: "طريقة الدفع" },
  method_cash: { he: "מזומן", ar: "نقداً" },
  method_card: { he: "אשראי", ar: "بطاقة" },
  method_transfer: { he: "העברה", ar: "تحويل" },
  method_check: { he: "צ'ק", ar: "شيك" },
  enter_code: { he: "כניסה", ar: "دخول" },
  checking: { he: "בודק...", ar: "جاري التحقق..." },
  wrong_code: { he: "קוד שגוי", ar: "رمز خاطئ" },

  // New-order alerts (driver + production)
  new_order_alert: { he: "התקבלה הזמנה חדשה", ar: "وصل طلب جديد" },
  new_orders_alert: { he: "התקבלו הזמנות חדשות", ar: "وصلت طلبات جديدة" },
  enable_alerts: { he: "הפעלת התראות", ar: "تفعيل التنبيهات" },
  alerts_on: { he: "התראות פעילות", ar: "التنبيهات مفعّلة" },
  alerts_enabled_toast: {
    he: "התראות על הזמנות חדשות הופעלו",
    ar: "تم تفعيل تنبيهات الطلبات الجديدة",
  },
  alerts_local_only: {
    he: "התראות בתוך המסך פעילות (ללא התראות רקע)",
    ar: "التنبيهات داخل الشاشة مفعّلة (بدون تنبيهات في الخلفية)",
  },
  alerts_https_required: {
    he: "התראות רקע דורשות כתובת מאובטחת (https)",
    ar: "تنبيهات الخلفية تتطلب عنوانًا آمنًا (https)",
  },
  alerts_denied: {
    he: "ההרשאה להתראות נדחתה בדפדפן",
    ar: "تم رفض إذن التنبيهات في المتصفح",
  },
  alerts_save_failed: {
    he: "שמירת ההתראות נכשלה — נסו שוב",
    ar: "فشل حفظ التنبيهات — حاول مرة أخرى",
  },

  // Driver login
  driver_title: { he: "אפליקציית נהג", ar: "تطبيق السائق" },
  driver_subtitle: { he: "כניסה בקוד אישי — מחובר עד סוף היום", ar: "الدخول برمز شخصي — يبقى متصلاً حتى نهاية اليوم" },

  // Driver orders
  driver_orders_title: { he: "המשלוחים שלי", ar: "توصيلاتي" },
  collected_today: { he: "נאסף היום", ar: "تم تحصيله اليوم" },
  total_deliveries: { he: "סה\"כ משלוחים", ar: "إجمالي التوصيلات" },
  completed: { he: "הושלמו", ar: "تم إنجازها" },
  debt_payment_button: { he: "תשלום חוב לקוח", ar: "دفع دين الزبون" },
  collection_summary: { he: "סיכום גבייה", ar: "ملخص التحصيل" },
  filter_all: { he: "הכל", ar: "الكل" },
  filter_active: { he: "פעילה", ar: "نشطة" },
  filter_done: { he: "הושלמו", ar: "منجزة" },
  sort_default: { he: "סדר ברירת מחדל", ar: "الترتيب الافتراضي" },
  sort_distance: { he: "מרחק ממני", ar: "المسافة مني" },
  sort_code: { he: "קוד משלוח", ar: "رمز التوصيل" },
  city_all: { he: "כל הערים", ar: "كل المدن" },
  no_active_deliveries: { he: "אין משלוחים ממתינים 🎉", ar: "لا توجد توصيلات بالانتظار 🎉" },
  no_deliveries: { he: "אין משלוחים להצגה", ar: "لا توجد توصيلات لعرضها" },
  call: { he: "חיוג", ar: "اتصال" },
  maps: { he: "מפות", ar: "خرائط" },
  to_collect: { he: "לגבייה", ar: "للتحصيل" },
  outcome_paid: { he: "נמסר + שולם", ar: "تم التسليم + الدفع" },
  outcome_unpaid: { he: "נמסר ללא תשלום", ar: "تم التسليم بدون دفع" },
  outcome_partial: { he: "שולם חלקית", ar: "دفع جزئي" },
  outcome_failed: { he: "מסירה נכשלה", ar: "فشل التسليم" },
  collected_amount: { he: "סכום שנגבה (₪)", ar: "المبلغ المحصّل (₪)" },
  driver_note: { he: "הערת נהג", ar: "ملاحظة السائق" },
  confirm_update: { he: "אישור ועדכון", ar: "تأكيد وتحديث" },
  choose_outcome: { he: "יש לבחור תוצאה", ar: "الرجاء اختيار النتيجة" },

  // Production login
  production_title: { he: "מסך אפייה", ar: "شاشة الإنتاج" },
  production_subtitle: { he: "כניסה לאופים בלבד — קוד אישי", ar: "دخول للخبازين فقط — رمز شخصي" },

  // Production orders
  production_orders_title: { he: "הכנות", ar: "التحضيرات" },
  production_delivery_title: { he: "הכנות משלוחים", ar: "تحضيرات التوصيل" },
  production_takeaway_title: { he: "הכנות איסוף עצמי", ar: "تحضيرات الاستلام" },
  hello_prefix: { he: "שלום,", ar: "مرحباً," },
  tomorrow_summary: { he: "סיכום מחר", ar: "ملخص الغد" },
  today_label: { he: "היום", ar: "اليوم" },
  tomorrow_label: { he: "מחר", ar: "غداً" },
  prev_day: { he: "יום קודם", ar: "اليوم السابق" },
  next_day: { he: "יום הבא", ar: "اليوم التالي" },
  clear: { he: "ניקוי", ar: "مسح" },
  map: { he: "מפה", ar: "خريطة" },
  driver_search_placeholder: {
    he: "חיפוש: מספר הזמנה, קוד או לקוח",
    ar: "بحث: رقم الطلب، الرمز أو الزبون",
  },
  filter_todo: { he: "להכנה", ar: "للتحضير" },
  filter_ready: { he: "מוכן", ar: "جاهز" },
  // Delivery type — the prep screen shows both kinds and filters by these.
  type_all: { he: "הכל", ar: "الكل" },
  type_delivery: { he: "משלוח", ar: "توصيل" },
  type_takeaway: { he: "איסוף עצמי", ar: "استلام ذاتي" },
  day_summary: { he: "סיכום הכנות", ar: "ملخص التحضيرات" },
  no_orders_day: {
    he: "אין הזמנות להכנה ליום זה 🎉",
    ar: "لا توجد طلبات للتحضير لهذا اليوم 🎉",
  },
  mark_all_ready: { he: "הכל מוכן", ar: "الكل جاهز" },
  mark_all_ready_confirm: {
    he: "לסמן את כל ההזמנות כמוכנות?",
    ar: "تحديد كل الطلبات كجاهزة؟",
  },
  updating: { he: "מעדכן...", ar: "جاري التحديث..." },
  no_orders_today: { he: "אין הזמנות להכנה להיום 🎉", ar: "لا توجد طلبات للتحضير اليوم 🎉" },
  no_orders_tomorrow: { he: "אין הזמנות להכנה למחר 🎉", ar: "لا توجد طلبات للتحضير غداً 🎉" },
  status_preparing: { he: "בהכנה", ar: "قيد التحضير" },
  status_ready: { he: "מוכן", ar: "جاهز" },
  status_problem: { he: "בעיה", ar: "مشكلة" },

  // Production shortage (ناقص)
  shortage_action: { he: "ناقص (חוסר)", ar: "ناقص" },
  save_shortage: { he: "שמירת חוסר", ar: "حفظ النقص" },
  shortage_saved: { he: "החוסר נשמר", ar: "تم حفظ النقص" },
  enter_prepared: { he: "כמות שהוכנה לכל פריט", ar: "الكمية المحضّرة لكل صنف" },
  prepared_range_error: {
    he: "כמות מוכנה חייבת להיות בין 0 לכמות שהוזמנה",
    ar: "يجب أن تكون الكمية المحضّرة بين 0 والكمية المطلوبة",
  },
  shortage_note: { he: "הערת חוסר (לא חובה)", ar: "ملاحظة النقص (اختياري)" },
  updated_total: { he: "סה\"כ מעודכן", ar: "الإجمالي المحدّث" },
  missing: { he: "חסר", ar: "ناقص" },

  // Driver debt payment (multi-order)
  monthly_customer: { he: "לקוח חודשי", ar: "زبون شهري" },
  select_orders: { he: "בחר הזמנות לתשלום", ar: "اختر الطلبات للدفع" },
  selected_total: { he: "סה\"כ נבחר", ar: "الإجمالي المختار" },
  remaining: { he: "יתרה", ar: "المتبقي" },
  no_open_debt: { he: "אין הזמנות עם חוב פתוח", ar: "لا توجد طلبات بدين مفتوح" },

  // Units of measure
  unit_unit: { he: "יחידה", ar: "قطعة" },
  unit_kg: { he: 'ק"ג', ar: "كغم" },
  unit_tray: { he: "מגש", ar: "صينية" },
  unit_box: { he: "ארגז", ar: "صندوق" },
  unit_package: { he: "חבילה", ar: "علبة" },

  // Prep summary
  orders_word: { he: "הזמנות", ar: "طلبات" },
};

export function t(key: keyof typeof DICT, locale: Locale): string {
  return DICT[key]?.[locale] ?? key;
}

/** Localized unit-of-measure label (falls back to the raw type). */
export function unitLabel(unitType: string, locale: Locale): string {
  const key = `unit_${unitType}` as keyof typeof DICT;
  return DICT[key]?.[locale] ?? unitType;
}

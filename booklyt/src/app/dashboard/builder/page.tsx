'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  Eye,
  EyeOff,
  Palette,
  Layout,
  Type,
  Save,
  Globe,
  ArrowLeft,
  Check,
  Loader2,
  GripVertical,
  Smartphone,
  Monitor,
  RefreshCw,
  Settings,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { TenantWebsite } from '@/components/layouts/TenantWebsite'
import { PreviewViewport } from '@/components/builder/PreviewViewport'
import { getWebsiteStyle, normalizeLayoutSections } from '@/lib/builder/website-style'
import { HeadlineEditor } from '@/components/builder/HeadlineEditor'
import { ImageDragEditor } from '@/components/builder/ImageDragEditor'
import { TEMPLATE_PRESETS } from '@/lib/builder/templates'
import { compressImage, formatBytes } from '@/lib/builder/compress-image'
import type {
  BuilderWebsiteData,
  BrandConfig,
  ContentConfig,
  LayoutConfig,
  MetaConfig,
  SectionConfig,
  SectionType,
  SectionVariant,
} from '@/types/builder'
import type { Business } from '@/types/database'

// ── Default config ──────────────────────────────────────────────────────────

const DEFAULT_BRAND: BrandConfig = {
  primaryColor: '#7c3aed',
  accentColor: '#f5f3ff',
  backgroundColor: '#ffffff',
  surfaceColor: '#f9fafb',
  textColor: '#0f0f14',
  mutedColor: '#6b7280',
  font: 'Inter',
  radius: '12px',
  buttonStyle: 'rounded',
  cardStyle: 'elevated',
}

const DEFAULT_LAYOUT: LayoutConfig = {
  templateName: 'default',
  sections: [
    { id: 'hero', type: 'hero', visible: true, variant: 'default', order: 0 },
    { id: 'services', type: 'services', visible: true, variant: 'default', order: 1 },
    { id: 'staff', type: 'staff', visible: true, variant: 'default', order: 2 },
    { id: 'booking', type: 'booking', visible: true, variant: 'default', order: 3 },
    { id: 'testimonials', type: 'testimonials', visible: true, variant: 'default', order: 4 },
    { id: 'contact', type: 'contact', visible: true, variant: 'default', order: 5 },
    { id: 'about', type: 'about', visible: true, variant: 'default', order: 6 },
    { id: 'gallery', type: 'gallery', visible: false, variant: 'default', order: 7 },
  ],
  spacingStyle: 'comfortable',
  pageStyle: 'light',
}

const DEFAULT_CONTENT: ContentConfig = {
  heroTitle: 'Book Your Appointment',
  heroSubtitle: 'Premium service, simple booking.',
  heroCtaText: 'Book Now',
}

// ── Constants ────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<SectionType, string> = {
  hero: 'Hero Banner',
  services: 'Services',
  about: 'About Us',
  staff: 'Our Team',
  gallery: 'Gallery',
  booking: 'Booking Calendar',
  contact: 'Contact & Location',
  testimonials: 'Reviews',
}

const SECTION_LABELS_AR: Record<SectionType, string> = {
  hero: 'البانر الرئيسي',
  services: 'الخدمات',
  about: 'من نحن',
  staff: 'الفريق',
  gallery: 'المعرض',
  booking: 'تقويم الحجز',
  contact: 'التواصل والموقع',
  testimonials: 'التقييمات',
}

const builderCopy = {
  en: {
    title: 'Website Builder',
    desktop: 'Desktop',
    mobile: 'Mobile',
    saved: 'Saved!',
    saveDraft: 'Save draft',
    restoreLive: 'Restore live',
    liveRestored: 'Live style loaded',
    published: 'Published!',
    publish: 'Publish',
    sections: 'Sections',
    design: 'Design',
    content: 'Content',
    templates: 'Templates',
    pageSections: 'Page Sections',
    colors: 'Colors',
    typography: 'Typography',
    borderRadius: 'Border Radius',
    buttonStyle: 'Button Style',
    cardStyle: 'Card Style',
    bookingCalendar: 'Booking Calendar',
    calendarLayout: 'Calendar layout',
    monthly: 'Monthly',
    weekly: 'Weekly',
    selectedDateColor: 'Selected date color',
    uploading: 'Uploading...',
    uploadFromDevice: 'Upload from device',
    uploadFailed: 'Upload failed',
    saveFailed: 'Save failed',
    loadDataFailed: 'Could not load your website data.',
    uploadUrlFailed: 'Could not get upload URL',
    settings: 'Settings',
    loading: 'Loading your website and business data…',
    loadFailedTitle: 'Your website could not be loaded',
    tryAgain: 'Try again',
    backTo: 'Back to',
    admin: 'Admin',
    dashboard: 'Dashboard',
    style: 'Style',
    bookingAlwaysShown: 'Booking calendar is always shown',
    colorPrimary: 'Primary',
    colorAccent: 'Accent',
    colorBackground: 'Background',
    colorSurface: 'Surface',
    colorText: 'Text',
    radiusSharp: 'Sharp',
    radiusSoft: 'Soft',
    radiusRound: 'Round',
    radiusPill: 'Pill',
    btnRounded: 'Rounded',
    btnPill: 'Pill',
    btnSharp: 'Sharp',
    btnOutline: 'Outline',
    cardElevated: 'Elevated',
    cardFlat: 'Flat',
    cardBordered: 'Bordered',
    cardGhost: 'Ghost',
    selectedDateHelp: 'Highlights the chosen day & time slot',
    resetToPrimary: 'Reset to primary color',
    selectedDayText: 'Selected day text',
    selectedDayTextHelp: 'Text color on highlighted dates',
    resetToWhite: 'Reset to white',
    heroPhoto: 'Hero photo',
    pasteImageUrl: 'Paste image URL',
    bucketHint: 'Create the "business-media" bucket in Supabase Storage (set to Public), then try again.',
    showHeadline: 'Show headline and introduction',
    showHeadlineHelp: 'Placement follows your website style',
    overlayDarkness: 'Overlay darkness',
    imageFraming: 'Image framing',
    framingHelp: 'Drag to pan · Drag corners to zoom',
    hiddenHeroText: 'Hidden hero text',
    heroText: 'Hero text',
    headline: 'Headline',
    headlineHint: 'Select words to color them',
    headlinePlaceholder: 'Awaken Your Beauty',
    subtitle: 'Subtitle',
    buttonLabel: 'Button label',
    add: 'Add',
    sectionHeading: 'Section heading',
    aboutSection: 'About us',
    aboutEyebrowPlaceholder: 'About us',
    aboutTitlePlaceholder: 'Our story',
    aboutStory: 'Your story',
    aboutTextPlaceholder: 'What you do, what makes your place worth the trip, and who customers will meet when they walk in.',
    aboutHelp: 'Line breaks are kept exactly as you type them.',
    aboutPhoto: 'Photo (optional)',
    findUs: 'Find us',
    smallLabel: 'Small label',
    heading: 'Heading',
    comeVisitUs: 'Come visit us',
    businessType: 'Business type',
    bookingMode: 'Booking mode',
    language: 'Language',
    branding: 'Branding',
    businessName: 'Business name',
    businessNamePlaceholder: 'Your Business',
    slogan: 'Slogan',
    sloganPlaceholder: 'Your tagline',
    logoAndIcon: 'Logo & app icon',
    replaceLogo: 'Replace logo / icon',
    uploadLogo: 'Upload logo / icon',
    bookingConfig: 'Booking config',
    staffSelection: 'Staff selection',
    capacityBehavior: 'Capacity behavior',
    appPwa: 'App / PWA',
    appDisplayName: 'App display name',
    appNamePlaceholder: 'My App',
    splashBackground: 'Splash background',
    mobileNavStyle: 'Mobile nav style',
    defaultOpenMode: 'Default open mode',
    presets: 'Presets',
    presetsHelp: 'Choose a layout, typography, and image treatment. Your text and photos are kept.',
    previewNote: 'Preview only · No bookings or messages are sent',
    doneEditing: 'Done editing',
    editOnPage: 'Edit on page',
    typeBarber: 'Barber',
    typeSalon: 'Salon',
    typeGym: 'Gym',
    typeClinic: 'Clinic',
    typeSpa: 'Spa',
    typeWorkshop: 'Workshop',
    typeGeneral: 'General',
    modeAppointment: 'Appointment',
    modeClass: 'Class',
    modeEvent: 'Event',
    staffRequired: 'Required',
    staffOptional: 'Optional',
    staffHidden: 'Hidden',
    perSlot: 'Per slot',
    perDay: 'Per day',
    navBottomTabs: 'Bottom tabs',
    navHamburger: 'Hamburger',
    navMinimal: 'Minimal',
    openStandalone: 'Standalone',
    openBrowser: 'Browser',
    openFullscreen: 'Fullscreen',
  },
  ar: {
    title: 'مصمم الموقع',
    desktop: 'سطح المكتب',
    mobile: 'الهاتف',
    saved: 'تم الحفظ!',
    saveDraft: 'حفظ المسودة',
    restoreLive: 'استرجاع المنشور',
    liveRestored: 'تم تحميل التصميم المنشور',
    published: 'تم النشر!',
    publish: 'نشر',
    sections: 'الأقسام',
    design: 'التصميم',
    content: 'المحتوى',
    templates: 'القوالب',
    pageSections: 'أقسام الصفحة',
    colors: 'الألوان',
    typography: 'الخطوط',
    borderRadius: 'استدارة الحواف',
    buttonStyle: 'شكل الأزرار',
    cardStyle: 'شكل البطاقات',
    bookingCalendar: 'تقويم الحجز',
    calendarLayout: 'طريقة عرض التقويم',
    monthly: 'شهري',
    weekly: 'أسبوعي',
    selectedDateColor: 'لون التاريخ المختار',
    uploading: 'جار الرفع...',
    uploadFromDevice: 'رفع من الجهاز',
    uploadFailed: 'فشل الرفع',
    saveFailed: 'فشل الحفظ',
    loadDataFailed: 'تعذر تحميل بيانات موقعك.',
    uploadUrlFailed: 'تعذر الحصول على رابط الرفع',
    settings: 'الإعدادات',
    loading: 'جارٍ تحميل موقعك وبيانات نشاطك…',
    loadFailedTitle: 'تعذر تحميل موقعك',
    tryAgain: 'إعادة المحاولة',
    backTo: 'العودة إلى',
    admin: 'الإدارة',
    dashboard: 'لوحة التحكم',
    style: 'النمط',
    bookingAlwaysShown: 'تقويم الحجز يظهر دائماً',
    colorPrimary: 'اللون الأساسي',
    colorAccent: 'اللون الثانوي',
    colorBackground: 'الخلفية',
    colorSurface: 'خلفية البطاقات',
    colorText: 'النص',
    radiusSharp: 'حاد',
    radiusSoft: 'ناعم',
    radiusRound: 'دائري',
    radiusPill: 'كبسولة',
    btnRounded: 'مستدير',
    btnPill: 'كبسولة',
    btnSharp: 'حاد',
    btnOutline: 'محدد',
    cardElevated: 'بارز',
    cardFlat: 'مسطح',
    cardBordered: 'بإطار',
    cardGhost: 'شفاف',
    selectedDateHelp: 'يميّز اليوم والوقت المختارين',
    resetToPrimary: 'العودة إلى اللون الأساسي',
    selectedDayText: 'نص اليوم المختار',
    selectedDayTextHelp: 'لون النص على التواريخ المميزة',
    resetToWhite: 'العودة إلى الأبيض',
    heroPhoto: 'صورة الغلاف',
    pasteImageUrl: 'الصق رابط الصورة',
    bucketHint: 'أنشئ مجلد "business-media" في تخزين Supabase (اجعله عاماً) ثم أعد المحاولة.',
    showHeadline: 'إظهار العنوان والمقدمة',
    showHeadlineHelp: 'يتبع الموضع نمط موقعك',
    overlayDarkness: 'درجة تعتيم الصورة',
    imageFraming: 'تأطير الصورة',
    framingHelp: 'اسحب للتحريك · اسحب الأركان للتكبير',
    hiddenHeroText: 'نص الغلاف (مخفي)',
    heroText: 'نص الغلاف',
    headline: 'العنوان الرئيسي',
    headlineHint: 'حدّد الكلمات لتلوينها',
    headlinePlaceholder: 'أيقظ جمالك',
    subtitle: 'العنوان الفرعي',
    buttonLabel: 'نص الزر',
    add: 'إضافة',
    sectionHeading: 'عنوان القسم',
    aboutSection: 'من نحن',
    aboutEyebrowPlaceholder: 'من نحن',
    aboutTitlePlaceholder: 'قصتنا',
    aboutStory: 'قصتك',
    aboutTextPlaceholder: 'ماذا تقدّم، وما الذي يميّز مكانك، ومن سيقابل عملاؤك عند وصولهم.',
    aboutHelp: 'تُحفظ أسطر النص كما تكتبها تماماً.',
    aboutPhoto: 'صورة (اختياري)',
    findUs: 'كيف تجدنا',
    smallLabel: 'نص صغير',
    heading: 'العنوان',
    comeVisitUs: 'زورونا',
    businessType: 'نوع النشاط',
    bookingMode: 'نمط الحجز',
    language: 'اللغة',
    branding: 'الهوية',
    businessName: 'اسم النشاط',
    businessNamePlaceholder: 'اسم نشاطك',
    slogan: 'الشعار الكتابي',
    sloganPlaceholder: 'جملتك التعريفية',
    logoAndIcon: 'الشعار وأيقونة التطبيق',
    replaceLogo: 'استبدال الشعار / الأيقونة',
    uploadLogo: 'رفع الشعار / الأيقونة',
    bookingConfig: 'إعدادات الحجز',
    staffSelection: 'اختيار الموظف',
    capacityBehavior: 'حساب الطاقة الاستيعابية',
    appPwa: 'إعدادات التطبيق',
    appDisplayName: 'اسم التطبيق',
    appNamePlaceholder: 'تطبيقي',
    splashBackground: 'لون شاشة البداية',
    mobileNavStyle: 'شريط التنقل',
    defaultOpenMode: 'وضع الفتح الافتراضي',
    presets: 'القوالب الجاهزة',
    presetsHelp: 'اختر التخطيط والخطوط ومعالجة الصور. نصوصك وصورك تبقى كما هي.',
    previewNote: 'معاينة فقط · لا يتم إنشاء حجوزات أو إرسال رسائل',
    doneEditing: 'إنهاء التعديل',
    editOnPage: 'التعديل على الصفحة',
    typeBarber: 'حلاقة',
    typeSalon: 'صالون',
    typeGym: 'نادي رياضي',
    typeClinic: 'عيادة',
    typeSpa: 'سبا',
    typeWorkshop: 'ورشة',
    typeGeneral: 'عام',
    modeAppointment: 'موعد',
    modeClass: 'حصة',
    modeEvent: 'فعالية',
    staffRequired: 'إلزامي',
    staffOptional: 'اختياري',
    staffHidden: 'مخفي',
    perSlot: 'لكل موعد',
    perDay: 'لكل يوم',
    navBottomTabs: 'تبويبات سفلية',
    navHamburger: 'قائمة جانبية',
    navMinimal: 'مبسّط',
    openStandalone: 'تطبيق مستقل',
    openBrowser: 'المتصفح',
    openFullscreen: 'ملء الشاشة',
  },
} as const

const GOOGLE_FONTS = [
  'Inter',
  'Outfit',
  'Playfair Display',
  'Cormorant Garamond',
  'DM Serif Display',
  'Syne',
  'Raleway',
  'Josefin Sans',
]

const SECTION_VARIANTS: Record<SectionType, SectionVariant[]> = {
  hero: ['default', 'centered', 'bold', 'split'],
  services: ['default', 'minimal', 'centered', 'bold'],
  about: ['default', 'centered'],
  staff: ['default', 'centered', 'minimal'],
  gallery: ['default'],
  booking: ['default', 'centered'],
  contact: ['default', 'split', 'centered'],
  testimonials: ['default', 'minimal', 'bold', 'centered'],
}

const VARIANT_LABELS: Record<SectionVariant, { en: string; ar: string }> = {
  default: { en: 'Default', ar: 'افتراضي' },
  centered: { en: 'Centered', ar: 'في الوسط' },
  bold: { en: 'Bold', ar: 'عريض' },
  split: { en: 'Split', ar: 'مقسوم' },
  minimal: { en: 'Minimal', ar: 'مبسّط' },
}

type LeftPanelTab = 'sections' | 'design' | 'content' | 'templates' | 'settings'

const DEFAULT_META: MetaConfig = {
  businessType: 'general',
  bookingMode: 'appointment',
  language: 'en',
  branding: {},
  booking: {
    calendarType: 'monthly',
    staffSelectionBehavior: 'optional',
    capacityBehavior: 'per-slot',
  },
  app: {
    mobileNavStyle: 'bottom-tabs',
    defaultOpenMode: 'standalone',
  },
}

function ensureBookingSectionVisible(layout: LayoutConfig): LayoutConfig {
  // Also drops legacy `offers` sections and adds `about` for configs saved
  // before that swap, so the section list never shows an unnamed row.
  const normalized = normalizeLayoutSections(layout)
  return {
    ...normalized,
    sections: normalized.sections.map(section =>
      section.type === 'booking' ? { ...section, visible: true } : section
    ),
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BuilderPage() {
  const pathname = usePathname()
  const adminSlug = pathname.match(/^\/admin\/([^/]+)\/builder/)?.[1]
  const configEndpoint = adminSlug
    ? `/api/admin/portal/${adminSlug}/builder-config`
    : '/api/builder/config'
  const backHref = adminSlug ? `/admin/${adminSlug}` : '/dashboard'
  const backLabel = adminSlug ? 'admin' : 'dashboard'
  const [activeTab, setActiveTab] = useState<LeftPanelTab>('sections')
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND)
  const [layout, setLayout] = useState<LayoutConfig>(DEFAULT_LAYOUT)
  const [content, setContent] = useState<ContentConfig>(DEFAULT_CONTENT)
  const [meta, setMeta] = useState<MetaConfig>(DEFAULT_META)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [published, setPublished] = useState(false)
  const [liveRestored, setLiveRestored] = useState(false)
  const [publishedConfig, setPublishedConfig] = useState<{
    brand: BrandConfig
    layout: LayoutConfig
    content: ContentConfig
    meta?: MetaConfig
  } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSaving, setUploadSaving] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingAbout, setUploadingAbout] = useState(false)
  const [preview, setPreview] = useState<'desktop' | 'mobile'>('desktop')
  const [previewLanguage, setPreviewLanguage] = useState<Business['language']>('en')
  const uiLanguage = meta.language ?? previewLanguage
  const bc = builderCopy[uiLanguage]
  const isRtl = uiLanguage === 'ar'
  const sectionLabels = isRtl ? SECTION_LABELS_AR : SECTION_LABELS
  const [previewData, setPreviewData] = useState<BuilderWebsiteData | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [inlineEditing, setInlineEditing] = useState(false)

  useEffect(() => {
    if (window.innerWidth < 768) setPreview('mobile')
  }, [])

  // Load existing config on mount, then scroll preview to top
  useEffect(() => {
    let disposed = false
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    setLoadingConfig(true)
    setLoadError(null)
    fetch(configEndpoint, { signal: controller.signal, cache: 'no-store' })
      .then(async r => {
        const data = await r.json()
        if (!r.ok || !data.preview_data) throw new Error(data.error || builderCopy.en.loadDataFailed)
        return data
      })
      .then(data => {
        if (disposed) return
        setPreviewData(data.preview_data)
        if (data.brand_json)   setBrand(data.brand_json)
        if (data.layout_json)  setLayout(ensureBookingSectionVisible(data.layout_json))
        if (data.content_json) setContent(data.content_json)
        if (data.meta_json && Object.keys(data.meta_json).length > 0) {
          setMeta(prev => ({ ...prev, ...data.meta_json }))
        }
        if (data.published_config_json?.brand && data.published_config_json?.layout) {
          setPublishedConfig({
            brand: data.published_config_json.brand,
            layout: ensureBookingSectionVisible(data.published_config_json.layout),
            content: data.published_config_json.content ?? {},
            meta: data.published_config_json.meta,
          })
        }
        if (data.business_language === 'ar' || data.business_language === 'en') {
          setPreviewLanguage(data.business_language)
          // A saved config without an explicit language inherits the business record,
          // so the builder chrome and the preview start in the same language.
          if (!data.meta_json?.language) setMeta(prev => ({ ...prev, language: data.business_language }))
        }

      })
      .catch(error => { if (!disposed) setLoadError(error.name === 'AbortError' ? 'Loading took too long. Please try again.' : error.message) })
      .finally(() => { clearTimeout(timeout); if (!disposed) setLoadingConfig(false) })
    return () => { disposed = true; clearTimeout(timeout); controller.abort() }
  }, [configEndpoint, loadAttempt])

  const updateBrand = useCallback((updates: Partial<BrandConfig>) => {
    setBrand(prev => ({ ...prev, ...updates }))
  }, [])

  const toggleSection = useCallback((id: string) => {
    if (id === 'booking') return
    setLayout(prev => ({
      ...prev,
      sections: prev.sections.map(s => (s.id === id ? { ...s, visible: !s.visible } : s)),
    }))
  }, [])

  const updateSectionVariant = useCallback((id: string, variant: string) => {
    setLayout(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === id ? { ...s, variant: variant as SectionConfig['variant'] } : s
      ),
    }))
  }, [])

  const reorderSections = useCallback((newSections: SectionConfig[]) => {
    setLayout(prev => ({
      ...prev,
      sections: newSections.map((s, i) => ({
        ...s,
        order: i,
        visible: s.type === 'booking' ? true : s.visible,
      })),
    }))
  }, [])

  const applyTemplate = useCallback((slug: string) => {
    const tpl = TEMPLATE_PRESETS.find(t => t.slug === slug)
    if (!tpl) return
    setBrand(prev => ({ ...tpl.brand, logo: prev.logo }))
    setLayout(ensureBookingSectionVisible(tpl.layout))
  }, [])

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      const res = await fetch(configEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_draft', brand, layout, content, meta }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `Save failed (${res.status})`)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      alert(err instanceof Error ? err.message : bc.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  const handleRestoreLive = () => {
    if (!publishedConfig) return
    setBrand(publishedConfig.brand)
    setLayout(ensureBookingSectionVisible(publishedConfig.layout))
    setContent(publishedConfig.content)
    if (publishedConfig.meta) setMeta(prev => ({ ...prev, ...publishedConfig.meta }))
    setLiveRestored(true)
    setTimeout(() => setLiveRestored(false), 2500)
  }

  const handlePublish = async () => {
    setPublishing(true)
    try {
      // First save the draft, then publish
      const saveRes = await fetch(configEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_draft', brand, layout, content, meta }),
      })
      if (!saveRes.ok) {
        const j = await saveRes.json().catch(() => ({}))
        throw new Error(
          typeof j.error === 'string' ? j.error : `Save failed (${saveRes.status})`
        )
      }
      const pubRes = await fetch(configEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      })
      if (!pubRes.ok) {
        const j = await pubRes.json().catch(() => ({}))
        throw new Error(
          typeof j.error === 'string' ? j.error : `Publish failed (${pubRes.status})`
        )
      }
      setPublishedConfig({
        brand,
        layout: ensureBookingSectionVisible(layout),
        content,
        meta,
      })
      setPublished(true)
      setTimeout(() => setPublished(false), 3000)
    } catch (err) {
      alert(err instanceof Error ? err.message : `${bc.uploadFailed}`)
    } finally {
      setPublishing(false)
    }
  }

  const uploadLogoImage = async (file: File) => {
    setUploadingLogo(true)
    try {
      const { file: compressed } = await compressImage(file, 1024, 0.88)
      const urlRes = await fetch('/api/builder/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: compressed.name, contentType: compressed.type, size: compressed.size }),
      })
      const urlJson = await urlRes.json()
      if (!urlRes.ok) throw new Error(urlJson.error ?? bc.uploadUrlFailed)
      const uploadRes = await fetch(urlJson.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': compressed.type },
        body: compressed,
      })
      if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`)
      setMeta(prev => ({ ...prev, branding: { ...prev.branding, logoUrl: urlJson.publicUrl, appIconUrl: urlJson.publicUrl } }))
    } catch (err) {
      alert(err instanceof Error ? err.message : bc.uploadFailed)
    } finally {
      setUploadingLogo(false)
    }
  }

  const uploadAboutImage = async (file: File) => {
    setUploadingAbout(true)
    try {
      const { file: compressed } = await compressImage(file)
      const urlRes = await fetch('/api/builder/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: compressed.name, contentType: compressed.type, size: compressed.size, admin_slug: adminSlug }),
      })
      const urlJson = await urlRes.json()
      if (!urlRes.ok) throw new Error(urlJson.error ?? bc.uploadUrlFailed)
      const uploadRes = await fetch(urlJson.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': compressed.type },
        body: compressed,
      })
      if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`)
      setContent(prev => ({ ...prev, aboutImage: urlJson.publicUrl }))
    } catch (err) {
      alert(err instanceof Error ? err.message : bc.uploadFailed)
    } finally {
      setUploadingAbout(false)
    }
  }

  if (loadingConfig || loadError || !previewData) {
    return <div className="min-h-screen bg-zinc-950 text-white grid place-items-center p-6" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-md text-center space-y-4">
        {loadingConfig ? <><Loader2 className="w-6 h-6 animate-spin mx-auto" /><p>{bc.loading}</p></> : <>
          <h1 className="text-xl font-semibold">{bc.loadFailedTitle}</h1>
          <p className="text-zinc-400" role="alert">{loadError}</p>
          <button onClick={() => setLoadAttempt(value => value + 1)} className="px-5 py-2 rounded-lg bg-white text-zinc-950">{bc.tryAgain}</button>
        </>}
        <Link href={backHref} className="block text-sm text-zinc-400 underline">{bc.backTo} {bc[backLabel]}</Link>
      </div>
    </div>
  }

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-zinc-950 lg:overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 pb-2 border-b border-white/[0.06] bg-zinc-900 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)', minHeight: 'calc(env(safe-area-inset-top) + 56px)' }}>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
            {bc[backLabel]}
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-white text-sm font-medium truncate">{bc.title}</span>
        </div>

        {/* Preview toggle */}
        <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1 order-3 w-full justify-center sm:order-none sm:w-auto">
          <button
            onClick={() => setPreview('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              preview === 'desktop' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            {bc.desktop}
          </button>
          <button
            onClick={() => setPreview('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              preview === 'mobile' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            {bc.mobile}
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveDraft}
            disabled={saving || uploading || uploadingLogo}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border border-white/[0.1] text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-all disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saved ? bc.saved : bc.saveDraft}
          </button>
          <button
            onClick={handleRestoreLive}
            disabled={!publishedConfig}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border border-white/[0.1] text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            {liveRestored ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {liveRestored ? bc.liveRestored : bc.restoreLive}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || uploading || uploadingLogo}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{
              background: published
                ? '#16a34a'
                : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
            }}
          >
            {publishing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : published ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Globe className="w-3.5 h-3.5" />
            )}
            {published ? bc.published : bc.publish}
          </button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        {/* ── Left panel ── */}
        <div className="w-full lg:w-72 bg-zinc-900 border-b lg:border-b-0 lg:border-r border-white/[0.06] flex flex-col overflow-hidden shrink-0 max-h-[48vh] lg:max-h-none">
          {/* Tab bar */}
          <div className="flex border-b border-white/[0.06] shrink-0">
            {(
              [
                { id: 'sections', icon: Layout, label: bc.sections },
                { id: 'design', icon: Palette, label: bc.design },
                { id: 'content', icon: Type, label: bc.content },
                { id: 'templates', icon: Eye, label: bc.templates },
                { id: 'settings', icon: Settings, label: bc.settings },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  activeTab === tab.id
                    ? 'text-white border-b-2 border-violet-500'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* ── Sections tab ── */}
            {activeTab === 'sections' && (
              <div className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
                  {bc.pageSections}
                </p>
                <Reorder.Group
                  axis="y"
                  values={layout.sections}
                  onReorder={reorderSections}
                  className="space-y-1.5"
                >
                  {layout.sections.map(section => (
                    <Reorder.Item
                      key={section.id}
                      value={section}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <div
                        onClick={() =>
                          setSelectedSection(
                            section.id === selectedSection ? null : section.id
                          )
                        }
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                          selectedSection === section.id
                            ? 'bg-violet-600/20 border border-violet-500/30'
                            : 'bg-zinc-800/50 hover:bg-zinc-800 border border-transparent'
                        } ${!section.visible ? 'opacity-40' : ''}`}
                      >
                        <GripVertical className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                        <span className="flex-1 text-sm font-medium text-zinc-200">
                        {sectionLabels[section.type]}
                        </span>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            toggleSection(section.id)
                          }}
                          disabled={section.type === 'booking'}
                          title={section.type === 'booking' ? bc.bookingAlwaysShown : undefined}
                          className="shrink-0 p-1 rounded hover:bg-zinc-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {section.visible ? (
                            <Eye className="w-3.5 h-3.5 text-zinc-400" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-zinc-600" />
                          )}
                        </button>
                      </div>

                      {/* Section variant selector — shows when selected */}
                      <AnimatePresence>
                        {selectedSection === section.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-1 ml-8 p-3 bg-zinc-800/50 rounded-xl">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                                {bc.style}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {SECTION_VARIANTS[section.type].map(v => (
                                  <button
                                    key={v}
                                    onClick={() => updateSectionVariant(section.id, v)}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                                      section.variant === v
                                        ? 'bg-violet-600 text-white'
                                        : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                                    }`}
                                  >
                                    {VARIANT_LABELS[v][uiLanguage]}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>
            )}

            {/* ── Design tab ── */}
            {activeTab === 'design' && (
              <div className="p-4 space-y-6">
                {/* Colors */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
                    {bc.colors}
                  </p>
                  <div className="space-y-2.5">
                    {(
                      [
                        { key: 'primaryColor', label: bc.colorPrimary },
                        { key: 'accentColor', label: bc.colorAccent },
                        { key: 'backgroundColor', label: bc.colorBackground },
                        { key: 'surfaceColor', label: bc.colorSurface },
                        { key: 'textColor', label: bc.colorText },
                      ] as const
                    ).map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-xs text-zinc-400">{label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-600 font-mono">
                            {brand[key]}
                          </span>
                          <label className="cursor-pointer">
                            <div
                              className="w-7 h-7 rounded-lg border-2 border-zinc-700 overflow-hidden"
                              style={{ background: brand[key] }}
                            />
                            <input
                              type="color"
                              value={brand[key]}
                              onChange={e => updateBrand({ [key]: e.target.value })}
                              className="sr-only"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Typography */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
                    {bc.typography}
                  </p>
                  <select
                    value={brand.font}
                    onChange={e => updateBrand({ font: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                  >
                    {GOOGLE_FONTS.map(f => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Border Radius */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
                    {bc.borderRadius}
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: bc.radiusSharp, value: '4px' },
                      { label: bc.radiusSoft, value: '12px' },
                      { label: bc.radiusRound, value: '20px' },
                      { label: bc.radiusPill, value: '32px' },
                    ].map(r => (
                      <button
                        key={r.value}
                        onClick={() => updateBrand({ radius: r.value })}
                        className={`py-2 text-[11px] font-medium rounded-lg transition-all ${
                          brand.radius === r.value
                            ? 'bg-violet-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Button Style */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
                    {bc.buttonStyle}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([['rounded', bc.btnRounded], ['pill', bc.btnPill], ['sharp', bc.btnSharp], ['outline', bc.btnOutline]] as const).map(([style, label]) => (
                      <button
                        key={style}
                        onClick={() => updateBrand({ buttonStyle: style })}
                        className={`py-2 text-[11px] font-medium rounded-lg transition-all ${
                          brand.buttonStyle === style
                            ? 'bg-violet-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card Style */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
                    {bc.cardStyle}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([['elevated', bc.cardElevated], ['flat', bc.cardFlat], ['bordered', bc.cardBordered], ['ghost', bc.cardGhost]] as const).map(([style, label]) => (
                      <button
                        key={style}
                        onClick={() => updateBrand({ cardStyle: style })}
                        className={`py-2 text-[11px] font-medium rounded-lg transition-all ${
                          brand.cardStyle === style
                            ? 'bg-violet-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Calendar color — separate from primary */}
                <div className="border-t border-zinc-800 pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
                    {bc.bookingCalendar}
                  </p>
                  <div className="space-y-2.5">
                    <div>
                      <span className="text-xs text-zinc-400">{bc.calendarLayout}</span>
                      <div className="grid grid-cols-2 gap-1.5 mt-2">
                        {(
                          [
                            { label: bc.monthly, value: 'monthly' },
                            { label: bc.weekly, value: 'weekly' },
                          ] as const
                        ).map(option => (
                          <button
                            key={option.value}
                            onClick={() => setContent(prev => ({ ...prev, calendarView: option.value }))}
                            className={`py-2 text-[11px] font-medium rounded-lg transition-all ${
                              (content.calendarView ?? 'monthly') === option.value
                                ? 'bg-violet-600 text-white'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-zinc-400">{bc.selectedDateColor}</span>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{bc.selectedDateHelp}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-600 font-mono">
                          {brand.calendarColor ?? brand.primaryColor}
                        </span>
                        <label className="cursor-pointer">
                          <div
                            className="w-7 h-7 rounded-lg border-2 border-zinc-700 overflow-hidden"
                            style={{ background: brand.calendarColor ?? brand.primaryColor }}
                          />
                          <input
                            type="color"
                            value={brand.calendarColor ?? brand.primaryColor}
                            onChange={e => updateBrand({ calendarColor: e.target.value })}
                            className="sr-only"
                          />
                        </label>
                      </div>
                    </div>
                    {brand.calendarColor && brand.calendarColor !== brand.primaryColor && (
                      <button
                        onClick={() => updateBrand({ calendarColor: undefined })}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 underline"
                      >
                        {bc.resetToPrimary}
                      </button>
                    )}

                    {/* Calendar text color */}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="text-xs text-zinc-400">{bc.selectedDayText}</span>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{bc.selectedDayTextHelp}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-600 font-mono">
                          {brand.calendarTextColor ?? '#ffffff'}
                        </span>
                        <label className="cursor-pointer">
                          <div
                            className="w-7 h-7 rounded-lg border-2 border-zinc-700 overflow-hidden"
                            style={{ background: brand.calendarTextColor ?? '#ffffff' }}
                          />
                          <input
                            type="color"
                            value={brand.calendarTextColor ?? '#ffffff'}
                            onChange={e => updateBrand({ calendarTextColor: e.target.value })}
                            className="sr-only"
                          />
                        </label>
                      </div>
                    </div>
                    {brand.calendarTextColor && brand.calendarTextColor !== '#ffffff' && (
                      <button
                        onClick={() => updateBrand({ calendarTextColor: undefined })}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 underline"
                      >
                        {bc.resetToWhite}
                      </button>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* ── Content tab ── */}
            {activeTab === 'content' && (
              <div className="p-4 space-y-5">

                {/* Hero image */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">{bc.heroPhoto}</p>

                  {/* Preview */}
                  {content.heroImage && (
                    <div className="relative mb-2 rounded-xl overflow-hidden" style={{ height: 100 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={content.heroImage} alt="Hero" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setContent(prev => ({ ...prev, heroImage: undefined }))}
                        className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white text-xs hover:bg-black/80"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* URL paste */}
                  <label className="block text-xs text-zinc-400 mb-1.5">{bc.pasteImageUrl}</label>
                  <input
                    type="url"
                    value={content.heroImage ?? ''}
                    onChange={e => setContent(prev => ({ ...prev, heroImage: e.target.value || undefined }))}
                    placeholder="https://example.com/photo.jpg"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                  />

                  {/* File upload */}
                  <label className={`mt-2 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-dashed text-xs transition-colors ${uploading ? 'border-violet-500 text-violet-400 cursor-wait' : 'border-zinc-600 text-zinc-400 hover:text-zinc-200 hover:border-zinc-400 cursor-pointer'}`}>
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    )}
                    {uploading ? bc.uploading : bc.uploadFromDevice}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={async e => {
                        const raw = e.target.files?.[0]
                        if (!raw) return

                        // Show local blob preview immediately. This URL only
                        // resolves inside this tab, so it must be replaced by the
                        // Supabase URL on success and rolled back on failure —
                        // never left in state where Publish would persist it.
                        const previousHeroImage = content.heroImage
                        const localUrl = URL.createObjectURL(raw)
                        setContent(prev => ({ ...prev, heroImage: localUrl }))
                        setUploadError(null)
                        setUploadSaving(null)
                        setUploading(true)

                        try {
                          // Step 1: compress in the browser (resize to ≤1920px, convert to WebP)
                          const { file, originalSize, compressedSize } = await compressImage(raw)
                          const saved = Math.round((1 - compressedSize / originalSize) * 100)
                          if (saved > 5) setUploadSaving(`${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (−${saved}%)`)

                          // Step 2: get a short-lived signed upload URL from server (tiny JSON, no file)
                          const urlRes = await fetch('/api/builder/upload-url', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              filename:    file.name,
                              contentType: file.type,
                              size:        file.size,
                              admin_slug:  adminSlug,
                            }),
                          })
                          const urlJson = await urlRes.json()
                          if (!urlRes.ok) throw new Error(urlJson.error ?? bc.uploadUrlFailed)

                          // Step 3: upload compressed file directly browser → Supabase (no Next.js limit)
                          const uploadRes = await fetch(urlJson.signedUrl, {
                            method: 'PUT',
                            headers: { 'Content-Type': file.type },
                            body: file,
                          })
                          if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`)

                          // Step 4: swap blob URL for permanent Supabase URL
                          setContent(prev => ({ ...prev, heroImage: urlJson.publicUrl }))
                          URL.revokeObjectURL(localUrl)
                        } catch (err) {
                          // Roll the preview back: a blob: URL that survives here
                          // would publish as a broken image on the live site.
                          setContent(prev => ({ ...prev, heroImage: previousHeroImage }))
                          URL.revokeObjectURL(localUrl)
                          setUploadSaving(null)
                          setUploadError(err instanceof Error ? err.message : bc.uploadFailed)
                        } finally {
                          setUploading(false)
                        }
                      }}
                    />
                  </label>

                  {/* Compression savings */}
                  {uploadSaving && !uploadError && (
                    <div className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 flex items-center gap-1.5">
                      <Check className="w-3 h-3 shrink-0" />
                      Compressed: {uploadSaving}
                    </div>
                  )}

                  {/* Upload error */}
                  {uploadError && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                      <span className="font-semibold">{bc.uploadFailed}: </span>{uploadError}
                      {uploadError.includes('bucket') || uploadError.includes('Bucket') ? (
                        <span className="block mt-1 text-red-400/70">
                          {bc.bucketHint}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Show headline and introduction */}
                {content.heroImage && (
                  <div className="border-t border-zinc-800 pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-zinc-200 font-medium">{bc.showHeadline}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{bc.showHeadlineHelp}</p>
                      </div>
                      <button
                        onClick={() => setContent(prev => ({ ...prev, showHeroText: !(prev.showHeroText ?? true) }))}
                        className={`relative w-10 h-5 rounded-full transition-colors ${(content.showHeroText ?? true) ? 'bg-violet-600' : 'bg-zinc-700'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${(content.showHeroText ?? true) ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>

                    {(content.showHeroText ?? true) && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs text-zinc-400">{bc.overlayDarkness}</label>
                          <span className="text-xs text-zinc-500 tabular-nums">{content.heroImageOverlayOpacity ?? 40}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={80}
                          step={5}
                          value={content.heroImageOverlayOpacity ?? 40}
                          onChange={e => setContent(prev => ({ ...prev, heroImageOverlayOpacity: Number(e.target.value) }))}
                          className="w-full accent-violet-500"
                        />
                      </div>
                    )}

                    {/* Image framing — drag to pan, corners to zoom */}
                    <div className="pt-2 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{bc.imageFraming}</p>
                      <ImageDragEditor
                        src={content.heroImage!}
                        positionX={content.heroImagePositionX ?? 50}
                        positionY={content.heroImagePositionY ?? 50}
                        zoom={content.heroImageZoom ?? 100}
                        onChange={(x, y, z) => setContent(prev => ({
                          ...prev, heroImagePositionX: x, heroImagePositionY: y, heroImageZoom: z,
                        }))}
                      />
                      <p className="text-[10px] text-zinc-600 text-center">
                        {bc.framingHelp}
                      </p>
                    </div>
                  </div>
                )}

                {/* Text content */}
                <div className="border-t border-zinc-800 pt-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {content.heroImage && content.showHeroText === false ? bc.hiddenHeroText : bc.heroText}
                  </p>
                  {/* Headline with rich text color picker */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-zinc-400">{bc.headline}</label>
                      <span className="text-[10px] text-zinc-600">{bc.headlineHint}</span>
                    </div>
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 focus-within:border-violet-500 transition-colors">
                      <HeadlineEditor
                        value={content.heroTitle ?? ''}
                        htmlValue={content.heroTitleHtml}
                        onChange={(plain, html) =>
                          setContent(prev => ({
                            ...prev,
                            heroTitle: plain,
                            heroTitleHtml: html,
                          }))
                        }
                        placeholder={bc.headlinePlaceholder}
                      />
                    </div>
                  </div>

                  {/* Subtitle */}
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{bc.subtitle}</label>
                    <input
                      type="text"
                      value={content.heroSubtitle ?? ''}
                      onChange={e => setContent(prev => ({ ...prev, heroSubtitle: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  {/* Button label */}
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{bc.buttonLabel}</label>
                    <input
                      type="text"
                      value={content.heroCtaText ?? ''}
                      onChange={e => setContent(prev => ({ ...prev, heroCtaText: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {bc.aboutSection}
                  </p>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{bc.smallLabel}</label>
                    <input
                      type="text"
                      value={content.aboutEyebrow ?? ''}
                      onChange={e => setContent(prev => ({ ...prev, aboutEyebrow: e.target.value || undefined }))}
                      placeholder={bc.aboutEyebrowPlaceholder}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{bc.heading}</label>
                    <input
                      type="text"
                      value={content.aboutTitle ?? ''}
                      onChange={e => setContent(prev => ({ ...prev, aboutTitle: e.target.value || undefined }))}
                      placeholder={bc.aboutTitlePlaceholder}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{bc.aboutStory}</label>
                    <textarea
                      value={content.aboutText ?? ''}
                      onChange={e => setContent(prev => ({ ...prev, aboutText: e.target.value || undefined }))}
                      placeholder={bc.aboutTextPlaceholder}
                      rows={6}
                      className="w-full resize-none bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                    <p className="mt-1 text-[10px] text-zinc-600">{bc.aboutHelp}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{bc.aboutPhoto}</label>
                    {content.aboutImage && (
                      <div className="relative mb-2 rounded-xl overflow-hidden" style={{ height: 90 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={content.aboutImage} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setContent(prev => ({ ...prev, aboutImage: undefined }))}
                          className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white text-xs hover:bg-black/80"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-dashed text-xs transition-colors ${uploadingAbout ? 'border-violet-500 text-violet-400 cursor-wait' : 'border-zinc-600 text-zinc-400 hover:text-zinc-200 hover:border-zinc-400 cursor-pointer'}`}>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={uploadingAbout}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) uploadAboutImage(file)
                          e.target.value = ''
                        }}
                      />
                      {uploadingAbout ? bc.uploading : bc.uploadFromDevice}
                    </label>
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {bc.findUs}
                  </p>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{bc.smallLabel}</label>
                    <input
                      type="text"
                      value={content.contactEyebrow ?? bc.findUs}
                      onChange={e => setContent(prev => ({ ...prev, contactEyebrow: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{bc.heading}</label>
                    <input
                      type="text"
                      value={content.contactText ?? bc.comeVisitUs}
                      onChange={e => setContent(prev => ({ ...prev, contactText: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

              </div>
            )}

            {/* ── Settings tab ── */}
            {activeTab === 'settings' && (
              <div className="p-4 space-y-6">

                {/* Business type */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
                    {bc.businessType}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([['barber', bc.typeBarber], ['salon', bc.typeSalon], ['gym', bc.typeGym], ['clinic', bc.typeClinic], ['spa', bc.typeSpa], ['workshop', bc.typeWorkshop], ['general', bc.typeGeneral]] as const).map(([type, label]) => (
                      <button
                        key={type}
                        onClick={() => setMeta(prev => ({ ...prev, businessType: type }))}
                        className={`py-2 text-[11px] font-medium rounded-lg transition-all ${
                          meta.businessType === type
                            ? 'bg-violet-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Booking mode */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
                    {bc.bookingMode}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([['appointment', bc.modeAppointment], ['class', bc.modeClass], ['event', bc.modeEvent]] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        onClick={() => setMeta(prev => ({ ...prev, bookingMode: mode }))}
                        className={`py-2 text-[11px] font-medium rounded-lg transition-all ${
                          meta.bookingMode === mode
                            ? 'bg-violet-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
                    {bc.language}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }] as const).map(lang => (
                      <button
                        key={lang.value}
                        onClick={() => setMeta(prev => ({ ...prev, language: lang.value }))}
                        className={`py-2 text-[11px] font-medium rounded-lg transition-all ${
                          meta.language === lang.value
                            ? 'bg-violet-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Branding */}
                <div className="border-t border-zinc-800 pt-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {bc.branding}
                  </p>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">
                      {bc.businessName}
                    </label>
                    <input
                      type="text"
                      value={meta.branding?.businessName ?? ''}
                      onChange={e => setMeta(prev => ({ ...prev, branding: { ...prev.branding, businessName: e.target.value || undefined } }))}
                      placeholder={bc.businessNamePlaceholder}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">
                      {bc.slogan}
                    </label>
                    <input
                      type="text"
                      value={meta.branding?.slogan ?? ''}
                      onChange={e => setMeta(prev => ({ ...prev, branding: { ...prev.branding, slogan: e.target.value || undefined } }))}
                      placeholder={bc.sloganPlaceholder}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{bc.logoAndIcon}</label>
                    <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-dashed text-xs transition-colors ${uploadingLogo ? 'border-violet-500 text-violet-400 cursor-wait' : 'border-zinc-600 text-zinc-400 hover:text-zinc-200 hover:border-zinc-400 cursor-pointer'}`}>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={uploadingLogo}
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) uploadLogoImage(f)
                          e.target.value = ''
                        }}
                      />
                      {uploadingLogo ? bc.uploading : (meta.branding?.logoUrl ? `↩ ${bc.replaceLogo}` : `⬆ ${bc.uploadLogo}`)}
                    </label>
                    {meta.branding?.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={meta.branding.logoUrl} alt="logo preview" className="mt-2 h-10 w-10 rounded-lg object-cover border border-zinc-700" />
                    )}
                  </div>
                </div>

                {/* Booking config */}
                <div className="border-t border-zinc-800 pt-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {bc.bookingConfig}
                  </p>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">
                      {bc.staffSelection}
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([['required', bc.staffRequired], ['optional', bc.staffOptional], ['hidden', bc.staffHidden]] as const).map(([v, label]) => (
                        <button
                          key={v}
                          onClick={() => setMeta(prev => ({ ...prev, booking: { ...DEFAULT_META.booking!, ...prev.booking, staffSelectionBehavior: v } }))}
                          className={`py-2 text-[11px] font-medium rounded-lg transition-all ${
                            (meta.booking?.staffSelectionBehavior ?? 'optional') === v
                              ? 'bg-violet-600 text-white'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">
                      {bc.capacityBehavior}
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([{ value: 'per-slot', label: bc.perSlot }, { value: 'per-day', label: bc.perDay }] as const).map(v => (
                        <button
                          key={v.value}
                          onClick={() => setMeta(prev => ({ ...prev, booking: { ...DEFAULT_META.booking!, ...prev.booking, capacityBehavior: v.value } }))}
                          className={`py-2 text-[11px] font-medium rounded-lg transition-all ${
                            (meta.booking?.capacityBehavior ?? 'per-slot') === v.value
                              ? 'bg-violet-600 text-white'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* App / PWA */}
                <div className="border-t border-zinc-800 pt-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {bc.appPwa}
                  </p>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">
                      {bc.appDisplayName}
                    </label>
                    <input
                      type="text"
                      value={meta.app?.appDisplayName ?? ''}
                      onChange={e => setMeta(prev => ({ ...prev, app: { ...DEFAULT_META.app!, ...prev.app, appDisplayName: e.target.value || undefined } }))}
                      placeholder={bc.appNamePlaceholder}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">
                      {bc.splashBackground}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={meta.app?.splashBackground ?? ''}
                        onChange={e => setMeta(prev => ({ ...prev, app: { ...DEFAULT_META.app!, ...prev.app, splashBackground: e.target.value || undefined } }))}
                        placeholder="#ffffff"
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                      />
                      <label className="cursor-pointer">
                        <div
                          className="w-9 h-9 rounded-lg border-2 border-zinc-700 overflow-hidden"
                          style={{ background: meta.app?.splashBackground || brand.backgroundColor }}
                        />
                        <input
                          type="color"
                          value={meta.app?.splashBackground || brand.backgroundColor}
                          onChange={e => setMeta(prev => ({ ...prev, app: { ...DEFAULT_META.app!, ...prev.app, splashBackground: e.target.value } }))}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">
                      {bc.mobileNavStyle}
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([['bottom-tabs', bc.navBottomTabs], ['hamburger', bc.navHamburger], ['minimal', bc.navMinimal]] as const).map(([v, label]) => (
                        <button
                          key={v}
                          onClick={() => setMeta(prev => ({ ...prev, app: { ...DEFAULT_META.app!, ...prev.app, mobileNavStyle: v } }))}
                          className={`py-2 text-[10px] font-medium rounded-lg transition-all ${
                            (meta.app?.mobileNavStyle ?? 'bottom-tabs') === v
                              ? 'bg-violet-600 text-white'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">
                      {bc.defaultOpenMode}
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([['standalone', bc.openStandalone], ['browser', bc.openBrowser], ['fullscreen', bc.openFullscreen]] as const).map(([v, label]) => (
                        <button
                          key={v}
                          onClick={() => setMeta(prev => ({ ...prev, app: { ...DEFAULT_META.app!, ...prev.app, defaultOpenMode: v } }))}
                          className={`py-2 text-[10px] font-medium rounded-lg transition-all ${
                            (meta.app?.defaultOpenMode ?? 'standalone') === v
                              ? 'bg-violet-600 text-white'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ── Templates tab ── */}
            {activeTab === 'templates' && (
              <div className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
                  {bc.presets}
                </p>
                <p className="text-xs text-zinc-500 mb-4">
                  {bc.presetsHelp}
                </p>
                <div className="space-y-2">
                  {TEMPLATE_PRESETS.map(tpl => (
                    <button
                      key={tpl.slug}
                      onClick={() => applyTemplate(tpl.slug)}
                      aria-pressed={getWebsiteStyle(layout) === getWebsiteStyle(tpl.layout)}
                      className={`w-full text-start p-4 rounded-xl border transition-all group ${getWebsiteStyle(layout) === getWebsiteStyle(tpl.layout) ? 'bg-zinc-800 border-violet-400 ring-1 ring-violet-400' : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 hover:border-zinc-600'}`}
                    >
                      <div className="style-thumbnail mb-3" data-style={getWebsiteStyle(tpl.layout)} style={{ background: tpl.brand.backgroundColor, color: tpl.brand.textColor }} aria-hidden="true">
                        <div className="thumb-nav" />
                        <div className="thumb-copy"><i /><i /><i /></div>
                        <div className="thumb-photo">{(content.heroImage || previewData.services.find(service => service.image_url)?.image_url) && <Image unoptimized width={160} height={100} src={content.heroImage || previewData.services.find(service => service.image_url)?.image_url || ''} alt="" />}</div>
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-6 h-6 rounded-md shrink-0"
                          style={{ background: tpl.brand.primaryColor }}
                        />
                        <span className="font-semibold text-sm text-zinc-200 group-hover:text-white">
                          {isRtl ? tpl.nameAr : tpl.name}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">{isRtl ? tpl.descriptionAr : tpl.description}</p>
                      <div className="flex gap-1.5 mt-3">
                        {[
                          tpl.brand.primaryColor,
                          tpl.brand.accentColor,
                          tpl.brand.backgroundColor,
                          tpl.brand.textColor,
                        ].map((c, i) => (
                          <div
                            key={i}
                            className="w-4 h-4 rounded-full border border-zinc-600"
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* The preview uses the public website renderer and actual tenant data. */}
        <div className="flex-1 min-w-0 overflow-auto bg-zinc-100 p-3 sm:p-6">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4 text-zinc-600 text-xs">
            <div><p className="font-semibold text-zinc-900">{previewData.business.name}</p><p className="mt-1">{bc.previewNote}</p></div>
            <button onClick={() => setInlineEditing(value => !value)} aria-pressed={inlineEditing} className={`rounded-lg border px-3 py-2 ${inlineEditing ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white border-zinc-300'}`}>{inlineEditing ? bc.doneEditing : bc.editOnPage}</button>
          </div>
          <PreviewViewport mode={preview}>
            <TenantWebsite config={{ brand, layout, content, meta }} {...previewData} previewMode
              onContentChange={inlineEditing ? updates => setContent(prev => ({ ...prev, ...updates })) : undefined}
            />
          </PreviewViewport>
        </div>
      </div>
    </div>
  )
}

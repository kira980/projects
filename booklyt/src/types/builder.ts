import type { Business, Service, ServiceCategory, StaffMember, StaffService, WorkingHours } from './database'

export type ButtonStyle = 'rounded' | 'pill' | 'sharp' | 'outline'
export type CardStyle = 'elevated' | 'flat' | 'bordered' | 'ghost'
export type WebsiteStyle = 'editorial' | 'atelier' | 'practice' | 'performance' | 'retreat'
export type SpacingStyle = 'compact' | 'comfortable' | 'spacious'
export type SectionVariant = 'default' | 'centered' | 'split' | 'minimal' | 'bold'
export type CalendarView = 'monthly' | 'weekly'

export type BusinessType = 'barber' | 'salon' | 'gym' | 'clinic' | 'spa' | 'workshop' | 'general'
export type BookingConfigMode = 'appointment' | 'class' | 'event'
export type StaffSelectionBehavior = 'required' | 'optional' | 'hidden'
export type CapacityBehavior = 'per-slot' | 'per-day'
export type MobileNavStyle = 'bottom-tabs' | 'hamburger' | 'minimal'
export type AppOpenMode = 'standalone' | 'browser' | 'fullscreen'

export interface BrandingConfig {
  businessName?: string
  slogan?: string
  logoUrl?: string
  appIconUrl?: string
}

export interface BookingConfig {
  calendarType: CalendarView
  staffSelectionBehavior: StaffSelectionBehavior
  capacityBehavior: CapacityBehavior
}

export interface AppConfig {
  appDisplayName?: string
  splashBackground?: string
  mobileNavStyle: MobileNavStyle
  defaultOpenMode: AppOpenMode
}

export interface MetaConfig {
  businessType?: BusinessType
  bookingMode?: BookingConfigMode
  language?: 'en' | 'ar'
  branding?: BrandingConfig
  booking?: BookingConfig
  app?: AppConfig
}

export interface TestimonialItem {
  name: string
  text: string
  rating: number
}

export interface ContactLink {
  type: 'instagram' | 'phone' | 'waze'
  enabled: boolean
  value: string
}

export interface BrandConfig {
  logo?: string
  primaryColor: string
  accentColor: string
  backgroundColor: string
  surfaceColor: string
  textColor: string
  mutedColor: string
  font: string
  radius: string
  buttonStyle: ButtonStyle
  cardStyle: CardStyle
  calendarColor?: string       // Calendar highlight — defaults to primaryColor if unset
  calendarTextColor?: string   // Text on selected calendar day — defaults to white
}

export interface SectionConfig {
  id: string
  type: SectionType
  visible: boolean
  variant: SectionVariant
  order: number
  props?: Record<string, unknown>
}

export type SectionType =
  | 'hero'
  | 'services'
  | 'about'
  | 'staff'
  | 'gallery'
  | 'booking'
  | 'contact'
  | 'testimonials'

export interface LayoutConfig {
  websiteStyle?: WebsiteStyle
  templateName: string
  sections: SectionConfig[]
  spacingStyle: SpacingStyle
  pageStyle: 'light' | 'dark' | 'auto'
}

export interface ContentConfig {
  heroTitle?: string
  heroSubtitle?: string
  heroCtaText?: string
  heroEyebrow?: string
  heroTitleHtml?: string   // Rich-text headline — HTML with <span style="color:X"> for colored words
  heroImage?: string              // URL of uploaded or pasted hero background image
  showHeroText?: boolean          // Whether to show title/subtitle on top of hero image
  heroImageOverlayOpacity?: number // 0–80 — darkness of the overlay when showHeroText is on
  heroImagePositionX?: number     // 0–100 horizontal focal point (CSS object-position-x), default 50
  heroImagePositionY?: number     // 0–100 vertical focal point (CSS object-position-y), default 50
  heroImageZoom?: number          // 50–200 zoom percentage applied via CSS scale(), default 100
  calendarView?: CalendarView
  aboutEyebrow?: string
  aboutTitle?: string
  aboutText?: string
  aboutImage?: string
  galleryImages?: string[]
  contactText?: string
  servicesHeading?: string
  servicesEyebrow?: string
  staffHeading?: string
  staffEyebrow?: string
  galleryHeading?: string
  galleryEyebrow?: string
  bookingHeading?: string
  bookingEyebrow?: string
  galleryHidden?: boolean[]
  testimonialHeading?: string
  testimonialEyebrow?: string
  testimonials?: TestimonialItem[]
  contactEyebrow?: string
  contactLinks?: ContactLink[]
  customSections?: Record<string, Record<string, unknown>>
}

export interface TenantExperienceConfig {
  id?: string
  business_id: string
  brand_json: BrandConfig
  layout_json: LayoutConfig
  content_json: ContentConfig
  meta_json?: MetaConfig
  published_config_json?: PublishedConfig | null
  draft_config_json?: DraftConfig | null
  is_published: boolean
  created_at?: string
  updated_at?: string
}

export interface PublishedConfig {
  brand: BrandConfig
  layout: LayoutConfig
  content: ContentConfig
  meta?: MetaConfig
  publishedAt: string
}

export type DraftConfig = Omit<PublishedConfig, 'publishedAt'> & { savedAt: string }

export interface TemplatePreset {
  name: string
  nameAr: string
  slug: string
  description: string
  descriptionAr: string
  preview: string
  brand: BrandConfig
  layout: LayoutConfig
  content: Partial<ContentConfig>
}

export interface BuilderWebsiteData {
  business: Business
  services: Service[]
  categories: ServiceCategory[]
  staff: StaffMember[]
  staffServices: StaffService[]
  workingHours: WorkingHours[]
}

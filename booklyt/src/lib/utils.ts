import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Currencies where the symbol appears after the number (right side)
const RIGHT_SYMBOL_CURRENCIES = new Set(["ILS", "NIS", "SAR", "AED", "EGP", "JOD", "KWD", "BHD", "OMR", "QAR"])

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", ILS: "₪", NIS: "₪",
  SAR: "ر.س", AED: "د.إ", EGP: "ج.م", JOD: "د.أ",
  KWD: "د.ك", BHD: "د.ب", OMR: "ر.ع", QAR: "ر.ق",
  TRY: "₺", INR: "₹", CAD: "CA$", AUD: "A$", CHF: "CHF",
}

export const SUPPORTED_CURRENCIES = [
  { code: "USD", label: "USD — US Dollar ($)" },
  { code: "ILS", label: "ILS — Israeli Shekel (₪)" },
  { code: "EUR", label: "EUR — Euro (€)" },
  { code: "GBP", label: "GBP — British Pound (£)" },
  { code: "SAR", label: "SAR — Saudi Riyal (ر.س)" },
  { code: "AED", label: "AED — UAE Dirham (د.إ)" },
  { code: "EGP", label: "EGP — Egyptian Pound (ج.م)" },
  { code: "JOD", label: "JOD — Jordanian Dinar (د.أ)" },
  { code: "TRY", label: "TRY — Turkish Lira (₺)" },
  { code: "CAD", label: "CAD — Canadian Dollar (CA$)" },
  { code: "AUD", label: "AUD — Australian Dollar (A$)" },
]

export function formatCurrency(amount: number, currency = "USD"): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency
  const isZeroDecimal = Number.isInteger(amount)
  const num = isZeroDecimal ? amount.toString() : amount.toFixed(2)
  if (RIGHT_SYMBOL_CURRENCIES.has(currency)) return `${num} ${sym}`
  return `${sym}${num}`
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .trim()
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

export const COUNTRY_CODES = [
  { code: "972", label: "+972 — Israel 🇮🇱" },
  { code: "1",   label: "+1 — USA / Canada 🇺🇸" },
  { code: "44",  label: "+44 — UK 🇬🇧" },
  { code: "49",  label: "+49 — Germany 🇩🇪" },
  { code: "33",  label: "+33 — France 🇫🇷" },
  { code: "39",  label: "+39 — Italy 🇮🇹" },
  { code: "34",  label: "+34 — Spain 🇪🇸" },
  { code: "31",  label: "+31 — Netherlands 🇳🇱" },
  { code: "971", label: "+971 — UAE 🇦🇪" },
  { code: "966", label: "+966 — Saudi Arabia 🇸🇦" },
  { code: "962", label: "+962 — Jordan 🇯🇴" },
  { code: "20",  label: "+20 — Egypt 🇪🇬" },
  { code: "961", label: "+961 — Lebanon 🇱🇧" },
  { code: "90",  label: "+90 — Turkey 🇹🇷" },
  { code: "7",   label: "+7 — Russia 🇷🇺" },
  { code: "86",  label: "+86 — China 🇨🇳" },
  { code: "91",  label: "+91 — India 🇮🇳" },
  { code: "55",  label: "+55 — Brazil 🇧🇷" },
  { code: "52",  label: "+52 — Mexico 🇲🇽" },
  { code: "61",  label: "+61 — Australia 🇦🇺" },
]

export const BUSINESS_CATEGORIES = [
  { value: "barbershop", label: "Barbershop" },
  { value: "salon", label: "Hair Salon" },
  { value: "spa", label: "Spa & Wellness" },
  { value: "nail_salon", label: "Nail Salon" },
  { value: "tattoo", label: "Tattoo Studio" },
  { value: "clinic", label: "Medical Clinic" },
  { value: "dental", label: "Dental Practice" },
  { value: "physiotherapy", label: "Physiotherapy" },
  { value: "fitness", label: "Personal Training" },
  { value: "yoga", label: "Yoga Studio" },
  { value: "massage", label: "Massage Therapy" },
  { value: "beauty", label: "Beauty Studio" },
  { value: "eyebrow", label: "Eyebrow & Lash" },
  { value: "makeup", label: "Makeup Artist" },
  { value: "other", label: "Other" },
]

export const TIMEZONES = [
  { value: "Asia/Jerusalem", label: "Israel (Asia/Jerusalem)" },
  { value: "Asia/Riyadh", label: "Saudi Arabia (Asia/Riyadh)" },
  { value: "Asia/Dubai", label: "UAE (Asia/Dubai)" },
  { value: "Asia/Amman", label: "Jordan (Asia/Amman)" },
  { value: "Africa/Cairo", label: "Egypt (Africa/Cairo)" },
  { value: "Europe/London", label: "UK (Europe/London)" },
  { value: "Europe/Berlin", label: "Germany (Europe/Berlin)" },
  { value: "Europe/Paris", label: "France (Europe/Paris)" },
  { value: "Europe/Istanbul", label: "Turkey (Europe/Istanbul)" },
  { value: "America/New_York", label: "US Eastern (America/New_York)" },
  { value: "America/Chicago", label: "US Central (America/Chicago)" },
  { value: "America/Los_Angeles", label: "US Pacific (America/Los_Angeles)" },
  { value: "Australia/Sydney", label: "Australia (Australia/Sydney)" },
]

export const APPOINTMENT_STATUS_COLORS: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
}

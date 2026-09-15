import type { LayoutConfig, SectionConfig, WebsiteStyle } from '@/types/builder'

export const WEBSITE_STYLES: Record<WebsiteStyle, { name: string; nameAr: string; description: string; descriptionAr: string }> = {
  editorial: { name: 'Editorial', nameAr: 'تحريري', description: 'A split cover, oversized serif headings and a numbered service menu.', descriptionAr: 'غلاف مقسوم، عناوين كبيرة، وقائمة خدمات مرقّمة.' },
  atelier: { name: 'Atelier', nameAr: 'أتيليه', description: 'A centred masthead, panoramic photography and a visual service collection.', descriptionAr: 'عنوان في الوسط، صور عريضة، ومجموعة خدمات مصوّرة.' },
  practice: { name: 'Modern Practice', nameAr: 'عيادة حديثة', description: 'A compact introduction, appointment overview and clear service rows.', descriptionAr: 'مقدمة مختصرة، نظرة على المواعيد، وصفوف خدمات واضحة.' },
  performance: { name: 'Performance', nameAr: 'أداء', description: 'An immersive cover, bold typography and a structured service grid.', descriptionAr: 'غلاف غامر، خط عريض، وشبكة خدمات منظمة.' },
  retreat: { name: 'Quiet Luxury', nameAr: 'فخامة هادئة', description: 'Portrait photography, generous spacing and treatment cards.', descriptionAr: 'صور عمودية، مساحات واسعة، وبطاقات جلسات.' },
}

export function getWebsiteStyle(layout: LayoutConfig): WebsiteStyle {
  if (layout.websiteStyle && layout.websiteStyle in WEBSITE_STYLES) return layout.websiteStyle
  const legacy: Record<string, WebsiteStyle> = {
    'luxury-barber': 'editorial', 'soft-salon': 'atelier', 'minimal-clinic': 'practice',
    'bold-fitness': 'performance', 'elegant-spa': 'retreat',
  }
  return legacy[layout.templateName] ?? 'practice'
}

// Layouts saved before Offers was replaced by About still carry an `offers`
// section and no `about` one. Normalising on read keeps those sites rendering
// and gives their owners the new section without a data migration.
export function normalizeLayoutSections(layout: LayoutConfig): LayoutConfig {
  // `offers` is no longer in SectionType, so the saved value is compared as a string.
  const sections: SectionConfig[] = layout.sections.filter(section => String(section.type) !== 'offers')
  if (!sections.some(section => section.type === 'about')) {
    sections.push({
      id: 'about',
      type: 'about',
      visible: false,
      variant: 'default',
      order: Math.max(-1, ...sections.map(section => section.order)) + 1,
    })
  }
  return { ...layout, sections }
}

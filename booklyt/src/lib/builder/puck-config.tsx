import type { Config } from '@measured/puck'

// Puck config is intentionally minimal — we use SectionConfig/SectionRenderer
// as the primary rendering system. Puck is used for drag-drop reordering +
// visual content editing only.

export const puckConfig: Config = {
  components: {
    HeroBlock: {
      label: 'Hero Section',
      fields: {
        title: { type: 'text', label: 'Headline' },
        subtitle: { type: 'text', label: 'Subtitle' },
        ctaText: { type: 'text', label: 'Button Text' },
        variant: {
          type: 'select',
          label: 'Style',
          options: [
            { label: 'Default', value: 'default' },
            { label: 'Centered', value: 'centered' },
            { label: 'Bold', value: 'bold' },
            { label: 'Split', value: 'split' },
          ],
        },
      },
      defaultProps: {
        title: 'Your Business Name',
        subtitle: 'Book your appointment online, anytime.',
        ctaText: 'Book Now',
        variant: 'default',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render: (props: any) => (
        <div className="puck-preview-hero p-8 text-center">
          <h1 className="text-4xl font-bold mb-4">{props.title}</h1>
          <p className="text-lg text-gray-600 mb-6">{props.subtitle}</p>
          <button className="px-6 py-3 bg-violet-600 text-white rounded-lg">{props.ctaText}</button>
        </div>
      ),
    },
    ServicesBlock: {
      label: 'Services Section',
      fields: {
        variant: {
          type: 'select',
          label: 'Layout',
          options: [
            { label: 'Grid', value: 'default' },
            { label: 'Minimal List', value: 'minimal' },
            { label: 'Centered', value: 'centered' },
          ],
        },
      },
      defaultProps: { variant: 'default' },
      render: () => (
        <div className="p-8">
          <p className="text-xs uppercase tracking-widest text-violet-600 font-bold mb-2">Services</p>
          <h2 className="text-2xl font-bold">Our Services</h2>
          <p className="text-sm text-gray-500 mt-2">Services from your business will appear here.</p>
        </div>
      ),
    },
  },
}

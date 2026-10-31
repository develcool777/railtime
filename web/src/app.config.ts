export default defineAppConfig({
  ui: {
    colors: {
      primary: 'brand',
      neutral: 'slate',
    },
    // The brand green carries white text in either theme.
    button: {
      compoundVariants: [{ color: 'primary', variant: 'solid', class: 'text-white bg-brand-500 hover:bg-brand-600 active:bg-brand-600' }],
    },
    // A choice of a few, side by side (Fastest | Fewer changes): small, the picked one a light pill on a muted track.
    tabs: {
      defaultVariants: { color: 'neutral', size: 'sm' },
      compoundVariants: [{ color: 'neutral', variant: 'pill', class: { indicator: 'bg-default', trigger: 'data-[state=active]:text-highlighted' } }],
    },
    // A status beside a title (a plan's, a city's): small and quiet.
    badge: {
      defaultVariants: { variant: 'subtle', size: 'sm' },
    },
  },
});

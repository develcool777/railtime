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
  },
});

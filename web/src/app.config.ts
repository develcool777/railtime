export default defineAppConfig({
  ui: {
    colors: {
      primary: 'brand',
      neutral: 'slate',
    },
    // A choice of a few, side by side (Fastest | Fewer changes): small, the picked one a light pill on a muted track.
    tabs: {
      defaultVariants: { color: 'neutral', size: 'sm' },
      // The picked one stands out of its track in either theme: white on grey, lighter grey on dark.
      compoundVariants: [
        { color: 'neutral', variant: 'pill', class: { indicator: 'bg-default dark:bg-accented', trigger: 'data-[state=active]:text-highlighted' } },
      ],
    },
    // A status beside a title (a plan's, a city's): small and quiet.
    badge: {
      defaultVariants: { variant: 'subtle', size: 'sm' },
    },
    // ⌘K: a panel under the header, as tall as its results, its field roomy; a row's mark centred on its name.
    dashboardSearch: {
      slots: { input: '[&_input]:h-13 [&_input]:text-base' },
      variants: {
        fullscreen: {
          false: { modal: 'top-18 translate-y-0 rounded-lg shadow-[0_20px_60px_rgba(21,32,48,0.25)] sm:h-auto sm:max-h-[28rem] sm:max-w-[560px]' },
        },
      },
    },
    commandPalette: {
      slots: { item: 'items-center' },
    },
    // Nothing to show yet (no station picked, no match): plain on the panel, small.
    empty: {
      defaultVariants: { variant: 'naked', size: 'sm' },
    },
    // A run of changes (the Changes list, a line's history): the line between them visible, those done
    // with their own dot on a green line, the current one ringed.
    timeline: {
      slots: { item: 'cursor-pointer', separator: 'bg-accented' },
      compoundVariants: [
        { color: 'primary', class: { indicator: 'group-data-[state=completed]:bg-transparent' } },
        // Each change's row keeps its own room below it.
        { orientation: 'vertical', size: '3xs', class: { wrapper: 'pb-0' } },
      ],
    },
    // The home page is a catalogue, not a landing page: its hero, sections and cards at that scale.
    pageHero: {
      slots: {
        container: 'py-14 sm:py-16 lg:py-16 gap-8',
        headline: 'eyebrow text-primary mb-3',
        title: 'text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.05] tracking-[-0.02em] font-extrabold max-w-[720px]',
        description: 'text-default text-[17px] leading-relaxed max-w-[600px] mt-4',
      },
      // Left, as the rest of the page reads.
      variants: { orientation: { vertical: { headline: 'justify-start', wrapper: 'text-left', description: 'text-pretty', links: 'justify-start' } } },
    },
    pageSection: {
      slots: {
        container: 'py-6 sm:py-8 lg:py-8 gap-4 sm:gap-4',
        title: 'text-lg sm:text-lg lg:text-lg tracking-normal',
        description: 'text-muted text-[13px] sm:text-[13px] mt-0',
      },
      variants: {
        orientation: {
          vertical: { headline: 'justify-start', leading: 'justify-start', title: 'text-left', description: 'text-left', links: 'justify-start' },
        },
        title: { true: { description: 'mt-1' } },
      },
      compoundVariants: [
        { orientation: 'vertical', title: true, class: { body: 'mt-4' } },
        { orientation: 'vertical', description: true, class: { body: 'mt-4' } },
      ],
    },
    pageGrid: {
      base: 'xl:grid-cols-4 gap-4',
    },
    pageCard: {
      slots: {
        root: 'overflow-hidden bg-default shadow-card',
        container: 'p-0 sm:p-0 gap-y-0',
        header: 'mb-0 border-b border-default w-full',
        body: 'px-[18px] pt-4 w-full',
        footer: 'px-[18px] pt-2 pb-[18px] w-full',
        title: 'font-bold',
        description: 'text-muted text-[13px] truncate w-full',
      },
    },
  },
});

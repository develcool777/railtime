/** What the help says can be done on the map and in time, each with the icon of the button that does it, or what it writes. */
export const HELP_TOPICS: { title: string; items: { icon?: string; text?: string; label: string; description: string }[] }[] = [
  {
    title: 'On the map',
    items: [
      { icon: 'i-lucide-mouse-pointer-click', label: 'A station', description: 'Click one for its lines, when each came, and the stops either side' },
      { icon: 'i-lucide-locate-fixed', label: 'Fit the network', description: 'Back to the whole city' },
      { icon: 'i-lucide-captions', label: 'Station names', description: 'Name the stations, or show only their dots: crossed out while they are hidden' },
      { text: '3D', label: 'Flat or 3D', description: 'Tilt the map close up, over the city’s buildings; 2D lays it flat again' },
      { icon: 'i-lucide-maximize-2', label: 'Map only', description: 'Hide everything but the map, full screen' },
    ],
  },
  {
    title: 'In time',
    items: [
      { icon: 'i-lucide-history', label: 'History', description: 'Open the timeline and drag to any day since the first line opened' },
      { icon: 'i-lucide-play', label: 'Play', description: 'Watch the network grow, change by change' },
      { icon: 'i-lucide-settings-2', label: 'Player settings', description: 'Its speed, how the camera follows, the minimap, 3D' },
    ],
  },
];

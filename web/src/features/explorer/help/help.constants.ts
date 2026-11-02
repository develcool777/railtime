/** What the help says can be done on the map and in time, each with the icon of the button that does it, or what it writes. */
export const HELP_TOPICS: { title: string; items: { icon?: string; text?: string; label: string; description: string }[] }[] = [
  {
    title: 'On the map',
    items: [
      { icon: 'i-lucide-mouse-pointer-click', label: 'A station', description: 'Click one for its lines, when each came, and the stops either side' },
      { icon: 'i-lucide-locate-fixed', label: 'Fit the network', description: 'Back to the whole city' },
      { icon: 'i-lucide-captions', label: 'Station names', description: 'Name the stations, or show only their dots: crossed out while they are hidden' },
      {
        icon: 'i-lucide-type',
        label: 'Street names',
        description: 'Name the city’s streets and places, or leave only the stations named: crossed out while they are hidden',
      },
      { text: '3D', label: 'Flat or 3D', description: 'Tilt the map close up, over the city’s buildings; 2D lays it flat again' },
      { icon: 'i-lucide-maximize-2', label: 'Map only', description: 'Hide everything but the map, full screen' },
    ],
  },
  {
    title: 'In time',
    items: [
      { icon: 'i-lucide-gallery-horizontal', label: 'Timeline', description: 'Drag or click it to see the network on any day since the first line opened' },
      { icon: 'i-lucide-play', label: 'Play', description: 'Watch the network grow, change by change, on from the day shown' },
      { icon: 'i-lucide-skip-forward', label: 'Previous and next change', description: 'Step through the changes one at a time' },
      { icon: 'i-lucide-undo-2', label: 'Today', description: 'Back to the network as it is, or a plan built' },
      { icon: 'i-lucide-settings-2', label: 'Player settings', description: 'Its speed, how the camera follows, the minimap' },
    ],
  },
];

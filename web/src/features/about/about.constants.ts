import type { AboutFeature } from './about.types';

/** When the Privacy and Terms pages last changed, as they say. */
export const LEGAL_UPDATED = '8 November 2026';

/** What a visitor can do with a city's network. */
export const ABOUT_FEATURES: AboutFeature[] = [
  { name: 'See any day', text: 'Move through the timeline to see which lines and stations were open on that date.' },
  { name: 'Play the history', text: 'Watch the network grow from its first line to today, one change at a time.' },
  { name: 'Browse lines and stations', text: 'Look up every line and station, and the changes that shaped the network.' },
  { name: 'Find a route', text: 'Compare up to three ways between two stations, each with an estimated journey time.' },
  { name: 'Check your reach', text: 'See how far you can get from a station, by time.' },
  { name: 'Measure coverage', text: 'See how much of the city is within walking distance of a station, and how that changed over the years.' },
  { name: 'Read the numbers', text: "Follow the network's growth in charts, and see its records on the date shown." },
  {
    name: 'Open a plan',
    text: 'See what could come next, or what never happened: projects under construction, planned, proposed, at concept stage or abandoned.',
  },
];

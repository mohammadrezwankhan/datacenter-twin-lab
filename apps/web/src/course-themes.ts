export type CourseTheme = {
  accent: string;
  softAccent: string;
  chapter: string;
  shortTitle: string;
  objective: string;
  glyph: string;
};

export const courseThemes: Readonly<Record<string, CourseTheme>> = {
  'power-energy': {
    accent: '#78e4c1',
    softAccent: '#17352f',
    chapter: 'Energy & reserve',
    shortTitle: 'Power → energy',
    objective: 'Convert a steady power request into energy over time.',
    glyph: '↗',
  },
  'distribution-loss': {
    accent: '#83bcff',
    softAccent: '#182f48',
    chapter: 'Energy & reserve',
    shortTitle: 'Delivery losses',
    objective: 'Estimate source demand when distribution is less than perfect.',
    glyph: '⇢',
  },
  'ride-through': {
    accent: '#c0a5ff',
    softAccent: '#2c2446',
    chapter: 'Energy & reserve',
    shortTitle: 'Battery runway',
    objective: 'Relate usable stored energy to the time a load can be served.',
    glyph: '◷',
  },
  'generator-delay': {
    accent: '#ffd17e',
    softAccent: '#3b3020',
    chapter: 'Continuity systems',
    shortTitle: 'Generator start',
    objective: 'Trace the delay between a utility event and generator readiness.',
    glyph: '⌁',
  },
  'generator-failure': {
    accent: '#ff9e8b',
    softAccent: '#3b2627',
    chapter: 'Continuity systems',
    shortTitle: 'Generator failure',
    objective: 'Compare service when backup generation is unavailable or ready.',
    glyph: '⚡',
  },
  'n-plus-one': {
    accent: '#69d8d3',
    softAccent: '#163737',
    chapter: 'Continuity systems',
    shortTitle: 'Surviving path',
    objective: 'Check whether one remaining distribution path can carry the load.',
    glyph: '⑂',
  },
  'shared-controls': {
    accent: '#c3e77f',
    softAccent: '#2d3821',
    chapter: 'Shared risks & reserve',
    shortTitle: 'Shared controls',
    objective: 'See how a common control dependency can affect both power paths.',
    glyph: '⌘',
  },
  'single-point': {
    accent: '#f19dcc',
    softAccent: '#3a2635',
    chapter: 'Shared risks & reserve',
    shortTitle: 'Common bus',
    objective: 'Trace the effect of one upstream asset shared by two paths.',
    glyph: '⊗',
  },
  precharge: {
    accent: '#a9b4ff',
    softAccent: '#252b47',
    chapter: 'Shared risks & reserve',
    shortTitle: 'Pre-outage charge',
    objective: 'Include energy added before an outage when estimating reserve.',
    glyph: '↥',
  },
  'ai-outage': {
    accent: '#8de0a1',
    softAccent: '#20372b',
    chapter: 'Planning at scale',
    shortTitle: 'AI-scale outage',
    objective: 'Scale an aggregate 50 MW IT request against stored energy.',
    glyph: '▦',
  },
  'recovery-deadline': {
    accent: '#f5ae73',
    softAccent: '#3a2b23',
    chapter: 'Planning at scale',
    shortTitle: 'Recovery deadline',
    objective: 'Resolve a narrow reserve margin around the recovery event time.',
    glyph: '⏱',
  },
  pue: {
    accent: '#91d9ff',
    softAccent: '#1b3343',
    chapter: 'Planning at scale',
    shortTitle: 'PUE & continuity',
    objective: 'Compare annual facility energy while keeping continuity separate.',
    glyph: '◌',
  },
};

export const courseChapters = [
  { title: 'Energy & reserve', lessonIds: ['power-energy', 'distribution-loss', 'ride-through'] },
  {
    title: 'Continuity systems',
    lessonIds: ['generator-delay', 'generator-failure', 'n-plus-one'],
  },
  { title: 'Shared risks & reserve', lessonIds: ['shared-controls', 'single-point', 'precharge'] },
  { title: 'Planning at scale', lessonIds: ['ai-outage', 'recovery-deadline', 'pue'] },
] as const;

export type FacilityPresetKind = 'outage' | 'ramp' | 'reserve';

export type FacilityPresets = Readonly<Record<FacilityPresetKind, string>>;

export interface FacilityProfile {
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  color: string;
  loadMw: number;
  presets: FacilityPresets;
}

export interface ScenarioMode {
  id: FacilityPresetKind;
  name: string;
  description: string;
}

export const facilityProfiles: readonly FacilityProfile[] = [
  {
    id: 'ai_cluster_50mw',
    name: 'AI cluster',
    eyebrow: 'AI COMPUTE',
    description: 'High-density aggregate compute',
    color: '#a78bfa',
    loadMw: 50,
    presets: {
      outage: 'ai_cluster_generator_failure',
      ramp: 'ai_cluster_50mw_ramp',
      reserve: 'ai_cluster_50mw_reserve',
    },
  },
  {
    id: 'hyperscale_200mw',
    name: 'Hyperscale',
    eyebrow: 'CLOUD CAMPUS',
    description: 'Campus-scale cloud infrastructure',
    color: '#38bdf8',
    loadMw: 200,
    presets: {
      outage: 'hyperscale_200mw_outage',
      ramp: 'hyperscale_200mw_ramp',
      reserve: 'hyperscale_200mw_reserve',
    },
  },
  {
    id: 'crypto_30mw',
    name: 'Crypto mining',
    eyebrow: 'DIGITAL ASSETS',
    description: 'Steady aggregate mining demand',
    color: '#fbbf24',
    loadMw: 30,
    presets: {
      outage: 'crypto_30mw_outage',
      ramp: 'crypto_30mw_ramp',
      reserve: 'crypto_30mw_reserve',
    },
  },
  {
    id: 'traditional_5mw',
    name: 'Traditional',
    eyebrow: 'ENTERPRISE',
    description: 'Mixed enterprise IT demand',
    color: '#34d399',
    loadMw: 5,
    presets: {
      outage: 'traditional_5mw_outage',
      ramp: 'traditional_5mw_ramp',
      reserve: 'traditional_5mw_reserve',
    },
  },
];

export const scenarioModes: readonly ScenarioMode[] = [
  {
    id: 'outage',
    name: 'Grid outage',
    description:
      'Utility and generator are unavailable from 300 s to 900 s. Initial battery energy is 0.1 h of gross IT load; with 0.9 discharge and 0.95 distribution efficiency, it serves the load for 307.8 s after the outage begins.',
  },
  {
    id: 'ramp',
    name: 'Load step',
    description:
      'Aggregate IT demand steps to 80% at 300 s, 110% at 600 s and 100% at 900 s. These are piecewise power inputs, not a GPU workload, electrical transient or stability simulation.',
  },
  {
    id: 'reserve',
    name: 'Extended reserve',
    description:
      'Utility and generator fail at 300 s and recover at 11,100 s: exactly 3 h in a bounded 4 h run with 60 s steps. Opening battery capacity is 4 h gross IT load, and charging is disabled. With 0.9 discharge and 0.95 distribution efficiency, a full reserve gives 3.42 h of delivered power; half gives 1.71 h ride-through and 1.29 h unserved.',
  },
];

export const facilityProfileById: ReadonlyMap<string, FacilityProfile> = new Map(
  facilityProfiles.map((profile) => [profile.id, profile]),
);

export const facilityProfileByPresetId: ReadonlyMap<string, FacilityProfile> = new Map(
  facilityProfiles.flatMap((profile) =>
    Object.values(profile.presets).map((preset) => [preset, profile] as const),
  ),
);

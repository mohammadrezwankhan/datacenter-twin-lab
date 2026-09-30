export type ResearchStudyId =
  'load-step' | 'modal' | 'forced-response' | 'model-comparison' | 'grid-network';

export type ResearchChartLine = {
  label: string;
  values: number[];
  color?: string;
};

export type ResearchChart = {
  id: string;
  title: string;
  x_label: string;
  y_label: string;
  x: number[];
  lines: ResearchChartLine[];
};

export type ResearchMode = {
  real: number;
  imag: number;
  frequency_hz: number;
  damping: number | null;
  dominant_state: string;
};

export type ResearchMetric = {
  label: string;
  value: number | null;
  unit: string;
};

export type ResearchResult = {
  study_id: string;
  model: string;
  config: Record<string, number>;
  solver: Record<string, unknown>;
  assumptions: string[];
  metrics: ResearchMetric[];
  charts: ResearchChart[];
  modes?: ResearchMode[];
  diagnostics: Record<string, unknown>;
};

export type ResearchField = {
  name: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  help: string;
};

export type PredictionChoice = {
  value: string;
  label: string;
};

export type ResearchStudy = {
  id: ResearchStudyId;
  shortName: string;
  title: string;
  eyebrow: string;
  color: string;
  softColor: string;
  objective: string;
  teachingPoint: string;
  modelNote: string;
  predictions: PredictionChoice[];
  fields: ResearchField[];
};

const commonPortFields: ResearchField[] = [
  {
    name: 'vsi_bandwidth_hz',
    label: 'VSI control bandwidth',
    unit: 'Hz',
    min: 60,
    max: 100,
    step: 1,
    initial: 80,
    help: 'Control bandwidth for the voltage-source inverter model.',
  },
  {
    name: 'grid_reactance_pu',
    label: 'Grid reactance',
    unit: 'pu',
    min: 0.1,
    max: 0.3,
    step: 0.01,
    initial: 0.19,
    help: 'Per-unit series grid reactance at the study base.',
  },
  {
    name: 'dc_capacitance_pu',
    label: 'DC-link capacitance',
    unit: 'pu',
    min: 1,
    max: 3,
    step: 0.1,
    initial: 2,
    help: 'Per-unit DC-link capacitance.',
  },
];

export const RESEARCH_STUDIES: ResearchStudy[] = [
  {
    id: 'load-step',
    shortName: 'Load step',
    title: 'A step in demand',
    eyebrow: '01 / TIME RESPONSE',
    color: '#e7b15b',
    softColor: '#362b1d',
    objective:
      'Change a balanced active-power demand. Inspect how the converter and DC link respond over the first second.',
    teachingPoint:
      'Compare the imposed load change with the modeled DC-link and power traces. A step input is not the same thing as a steady-state operating point.',
    modelNote: 'Single study case · balanced averaged converter model · fixed 1 s window.',
    predictions: [
      {
        value: 'smooth',
        label: 'The control response will smooth the step, with a transient before settling.',
      },
      { value: 'instant', label: 'The DC-link voltage will immediately follow the load step.' },
    ],
    fields: [
      {
        name: 'load_initial_pu',
        label: 'Initial load',
        unit: 'pu',
        min: 0.3,
        max: 0.7,
        step: 0.01,
        initial: 0.5,
        help: 'Balanced active-power load before the event.',
      },
      {
        name: 'load_final_pu',
        label: 'Final load',
        unit: 'pu',
        min: 0.4,
        max: 0.8,
        step: 0.01,
        initial: 0.6,
        help: 'Balanced active-power load after the event.',
      },
      ...commonPortFields,
    ],
  },
  {
    id: 'modal',
    shortName: 'Modal study',
    title: 'Read the system modes',
    eyebrow: '02 / SMALL-SIGNAL MODES',
    color: '#b59aff',
    softColor: '#2a2442',
    objective:
      'Inspect the linearized eigenvalues and participation at one operating point. Read each pole relative to the zero-real axis.',
    teachingPoint:
      'Each marker is a model mode. Its real part, frequency and damping describe the linearized case; they are not a nonlinear stability certificate.',
    modelNote: 'One operating point · 21-state averaged model · eigenvalues and participation.',
    predictions: [
      {
        value: 'coupled',
        label: 'At least one mode will involve more than one electrical subsystem.',
      },
      { value: 'local', label: 'The dominant participation will be concentrated in one state.' },
    ],
    fields: [
      {
        name: 'load_pu',
        label: 'Operating load',
        unit: 'pu',
        min: 0.3,
        max: 0.7,
        step: 0.01,
        initial: 0.5,
        help: 'Balanced active-power load at the linearization point.',
      },
      ...commonPortFields,
    ],
  },
  {
    id: 'forced-response',
    shortName: 'Forced response',
    title: 'Drive a synthetic disturbance',
    eyebrow: '03 / FREQUENCY RESPONSE',
    color: '#66d3d7',
    softColor: '#173539',
    objective:
      'Choose a sinusoidal forcing frequency and amplitude. Compare the synthetic load signal with the resulting model response and spectrum.',
    teachingPoint:
      'This is a constructed input to the averaged model. Peaks depend on the configured model and do not represent a measured grid disturbance.',
    modelNote: 'Synthetic sinusoid · 2 s response window · model-derived spectrum.',
    predictions: [
      {
        value: 'amplified',
        label: 'A dynamic response will be visible beyond the imposed input amplitude.',
      },
      { value: 'tracks', label: 'The response will closely track the imposed sinusoid.' },
    ],
    fields: [
      {
        name: 'load_pu',
        label: 'Operating load',
        unit: 'pu',
        min: 0.3,
        max: 0.7,
        step: 0.01,
        initial: 0.5,
        help: 'Balanced load at the operating point.',
      },
      ...commonPortFields,
      {
        name: 'forcing_frequency_hz',
        label: 'Forcing frequency',
        unit: 'Hz',
        min: 0.5,
        max: 30,
        step: 0.1,
        initial: 5,
        help: 'Frequency of the synthetic input sinusoid.',
      },
      {
        name: 'forcing_amplitude_pu',
        label: 'Forcing amplitude',
        unit: 'pu',
        min: 0.01,
        max: 0.05,
        step: 0.001,
        initial: 0.03,
        help: 'Synthetic sinusoidal amplitude in per unit.',
      },
    ],
  },
  {
    id: 'model-comparison',
    shortName: 'Model comparison',
    title: 'Compare two model resolutions',
    eyebrow: '04 / FULL VS REDUCED',
    color: '#81c99c',
    softColor: '#1c362b',
    objective:
      'Apply a load step at 0.04 s to full and reduced models. Compare their supplied startup over an 0.08 s window.',
    teachingPoint:
      'A discrepancy identifies sensitivity to model structure and retained states. The comparison does not establish which model is correct without independent evidence.',
    modelNote: '41-state full model vs 21-state reduced model · 0.08 s startup · BDF integration.',
    predictions: [
      {
        value: 'different',
        label: 'The two model resolutions will produce a visible transient difference.',
      },
      { value: 'similar', label: 'The two responses will closely overlap over this short window.' },
    ],
    fields: [
      {
        name: 'load_final_pu',
        label: 'Final load',
        unit: 'pu',
        min: 0.5,
        max: 0.7,
        step: 0.01,
        initial: 0.6,
        help: 'Balanced active-power load after the event at 0.04 s.',
      },
    ],
  },
  {
    id: 'grid-network',
    shortName: 'Nine-bus network',
    title: 'Inspect a converter-rich network',
    eyebrow: '05 / NETWORK MODES',
    color: '#ed8fa0',
    softColor: '#3b252d',
    objective:
      'Change network load scale and inspect the power-flow operating point and linearized modes for a modified nine-bus system.',
    teachingPoint:
      'Synchronous-machine, grid-forming, grid-following and DC-link ports interact through the network. A power-flow solution is not a dynamic-stability result or grid-adequacy study.',
    modelNote: 'Modified nine-bus example · SM, GFM, GFL and DC ports · no measured GPU trace.',
    predictions: [
      {
        value: 'interaction',
        label: 'The eigenvalue and participation results will show modes across the mixed ports.',
      },
      {
        value: 'separate',
        label: 'The reported modes will remain concentrated within individual ports.',
      },
    ],
    fields: [
      {
        name: 'load_scale',
        label: 'Network load scale',
        unit: 'pu',
        min: 0.4,
        max: 0.6,
        step: 0.01,
        initial: 0.5,
        help: 'Uniform scale applied to the example network loads.',
      },
    ],
  },
];

export const isResearchStudyId = (value: string | null): value is ResearchStudyId =>
  RESEARCH_STUDIES.some((study) => study.id === value);

export function initialConfig(study: ResearchStudy) {
  return Object.fromEntries(study.fields.map((field) => [field.name, field.initial]));
}

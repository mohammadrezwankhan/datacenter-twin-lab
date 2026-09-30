/** Original DC-link RLC teaching circuit; see docs/studies/emt.md. */
export type EmtConfig = {
  source_v: number;
  resistance_ohm: number;
  inductance_mh: number;
  capacitance_mf: number;
  load_ohm: number;
  sag_pu: number;
  sag_start_ms: number;
  sag_duration_ms: number;
  duration_ms: number;
  step_us: number;
};
export type EmtRow = {
  time_ms: number;
  source_v: number;
  bus_v: number;
  source_a: number;
  load_a: number;
  stored_j: number;
  balance_error_j: number;
};
export type EmtResult = {
  model: 'dc-link-rlc-v1';
  config: EmtConfig;
  sample_step_us: 100;
  assumptions: string[];
  rows: EmtRow[];
  summary: {
    initial_bus_v: number;
    minimum_bus_v: number;
    peak_source_a: number;
    recovery_peak_v: number;
    source_energy_j: number;
    resistor_loss_j: number;
    load_energy_j: number;
    initial_stored_j: number;
    final_stored_j: number;
    balance_error_j: number;
  };
};
export const DEFAULT_EMT: EmtConfig = {
  source_v: 800,
  resistance_ohm: 0.08,
  inductance_mh: 0.6,
  capacitance_mf: 12,
  load_ohm: 12.8,
  sag_pu: 0.5,
  sag_start_ms: 40,
  sag_duration_ms: 80,
  duration_ms: 200,
  step_us: 20,
};
export const EMT_LIMITS: Record<keyof EmtConfig, [number, number]> = {
  source_v: [400, 1000],
  resistance_ohm: [0.02, 1],
  inductance_mh: [0.1, 5],
  capacitance_mf: [1, 50],
  load_ohm: [2, 50],
  sag_pu: [0.1, 1],
  sag_start_ms: [10, 80],
  sag_duration_ms: [5, 100],
  duration_ms: [200, 300],
  step_us: [5, 50],
};
export const EMT_PRESETS = [
  {
    id: 'voltage-sag',
    name: 'Voltage sag',
    description: 'Halve the source for 80 ms.',
    config: { ...DEFAULT_EMT },
  },
  {
    id: 'short-dip',
    name: 'Short, deep dip',
    description: 'A 10 ms dip to 0.4 pu.',
    config: { ...DEFAULT_EMT, sag_pu: 0.4, sag_duration_ms: 10 },
  },
  {
    id: 'buffered-bus',
    name: 'More capacitance',
    description: 'Double the DC-link capacitance.',
    config: { ...DEFAULT_EMT, capacitance_mf: 24 },
  },
  {
    id: 'recovery-ringing',
    name: 'Recovery ringing',
    description: 'Lower damping and a smaller capacitor.',
    config: { ...DEFAULT_EMT, resistance_ohm: 0.02, capacitance_mf: 4 },
  },
];
const assumptions = [
  'Ideal DC-equivalent source; linear series R-L and shunt C with a constant-resistance load.',
  'Initial state is the pre-sag DC steady state; source step events are right-continuous.',
  'No rectifier, switching devices, UPS controller, protection, AC network or thermal model.',
  'Signed source energy includes reverse flow into the ideal source; no reverse-blocking diode.',
  'The ideal capacitor permits negative voltage; nonlinear voltage clamps and device limits are absent.',
  'Authored teaching parameters, not a calibrated facility or a PSCAD/EMTDC reproduction.',
  'RK4 integration; 100 us output sampling. Reported extrema are integration-endpoint samples.',
];

export function validateEmt(config: EmtConfig): EmtConfig {
  if (
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config) ||
    Object.keys(config).length !== Object.keys(DEFAULT_EMT).length ||
    Object.keys(config).some((key) => !(key in DEFAULT_EMT))
  )
    throw new Error('EMT config must contain exactly the documented ten fields');
  for (const key of Object.keys(EMT_LIMITS) as (keyof EmtConfig)[]) {
    const [low, high] = EMT_LIMITS[key];
    if (
      typeof config[key] !== 'number' ||
      !Number.isFinite(config[key]) ||
      config[key] < low ||
      config[key] > high
    )
      throw new Error(`${key} must be between ${low} and ${high}`);
  }
  for (const key of ['sag_start_ms', 'sag_duration_ms', 'duration_ms'] as const)
    if (!Number.isInteger(config[key]))
      throw new Error(`${key} must be a whole number of milliseconds`);
  if (![5, 10, 20, 25, 50].includes(config.step_us))
    throw new Error('step_us must be one of 5, 10, 20, 25, 50');
  if (config.sag_start_ms + config.sag_duration_ms >= config.duration_ms)
    throw new Error('The sag must clear before the study ends');
  return { ...config };
}

export function simulateEmt(input: EmtConfig = DEFAULT_EMT): EmtResult {
  const config = validateEmt(input);
  const { source_v: nominal, resistance_ohm: resistance, load_ohm: load, step_us: step } = config;
  const inductance = config.inductance_mh / 1000;
  const capacitance = config.capacitance_mf / 1000;
  const dt = step / 1_000_000;
  const start = config.sag_start_ms * 1000;
  const clear = (config.sag_start_ms + config.sag_duration_ms) * 1000;
  const steps = (config.duration_ms * 1000) / step;
  const initialCurrent = nominal / (resistance + load);
  const initialVoltage = load * initialCurrent;
  // Integrate source/loss/load energy at the same RK stages as i and v.
  let state = [initialCurrent, initialVoltage, 0, 0, 0];
  const stored = (i: number, v: number) => 0.5 * inductance * i * i + 0.5 * capacitance * v * v;
  const initialEnergy = stored(initialCurrent, initialVoltage);
  const source = (us: number) => (us >= start && us < clear ? nominal * config.sag_pu : nominal);
  const derivative = (values: number[], supply: number) => {
    const [i, v] = values;
    return [
      (supply - resistance * i - v) / inductance,
      (i - v / load) / capacitance,
      supply * i,
      resistance * i * i,
      (v * v) / load,
    ];
  };
  let minimum = initialVoltage;
  let peakCurrent = Math.abs(initialCurrent);
  let recoveryPeak = -Infinity;
  const rows: EmtRow[] = [];
  for (let index = 0; index <= steps; index++) {
    const us = index * step;
    const [i, v, supplied, lost, consumed] = state;
    minimum = Math.min(minimum, v);
    peakCurrent = Math.max(peakCurrent, Math.abs(i));
    if (us >= clear) recoveryPeak = Math.max(recoveryPeak, v);
    if (us % 100 === 0) {
      const energy = stored(i, v);
      rows.push({
        time_ms: us / 1000,
        source_v: source(us),
        bus_v: v,
        source_a: i,
        load_a: v / load,
        stored_j: energy,
        balance_error_j: supplied - lost - consumed - (energy - initialEnergy),
      });
    }
    if (index === steps) break;
    // Left-interval forcing avoids applying a new event in the prior RK step.
    const supply = source(us);
    const k1 = derivative(state, supply);
    const k2 = derivative(
      state.map((v, j) => v + (dt * k1[j]) / 2),
      supply,
    );
    const k3 = derivative(
      state.map((v, j) => v + (dt * k2[j]) / 2),
      supply,
    );
    const k4 = derivative(
      state.map((v, j) => v + dt * k3[j]),
      supply,
    );
    state = state.map((v, j) => v + (dt * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])) / 6);
  }
  const finalEnergy = stored(state[0], state[1]);
  return {
    model: 'dc-link-rlc-v1',
    config,
    sample_step_us: 100,
    assumptions: [...assumptions],
    rows,
    summary: {
      initial_bus_v: initialVoltage,
      minimum_bus_v: minimum,
      peak_source_a: peakCurrent,
      recovery_peak_v: recoveryPeak,
      source_energy_j: state[2],
      resistor_loss_j: state[3],
      load_energy_j: state[4],
      initial_stored_j: initialEnergy,
      final_stored_j: finalEnergy,
      balance_error_j: state[2] - state[3] - state[4] - (finalEnergy - initialEnergy),
    },
  };
}

export function refineEmt(config: EmtConfig) {
  if (![10, 20, 50].includes(config.step_us))
    throw new Error('Choose 10, 20 or 50 us for a half-step comparison');
  const coarse = simulateEmt(config);
  const fine = simulateEmt({ ...config, step_us: config.step_us / 2 });
  let difference = 0;
  coarse.rows.forEach((row, i) => {
    difference = Math.max(difference, Math.abs(row.bus_v - fine.rows[i].bus_v));
  });
  return { coarse, fine, max_bus_difference_v: difference };
}

/** Compare the complete schema and all numeric fields, not just a headline. */
export function compareEmt(actual: EmtResult, expected: EmtResult): number {
  let maximum = 0;
  const walk = (a: unknown, b: unknown, path: string): void => {
    if (typeof a === 'number' && typeof b === 'number') {
      const difference = Math.abs(a - b);
      if (!Number.isFinite(difference) || difference > 1e-7)
        throw new Error(`EMT mismatch at ${path}`);
      maximum = Math.max(maximum, difference);
    } else if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) throw new Error(`EMT length mismatch at ${path}`);
      a.forEach((v, i) => walk(v, b[i], `${path}[${i}]`));
    } else if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
      const keys = Object.keys(a).sort();
      if (JSON.stringify(keys) !== JSON.stringify(Object.keys(b).sort()))
        throw new Error(`EMT schema mismatch at ${path}`);
      keys.forEach((key) =>
        walk(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          `${path}.${key}`,
        ),
      );
    } else if (a !== b) throw new Error(`EMT value mismatch at ${path}`);
  };
  walk(actual, expected, 'result');
  return maximum;
}

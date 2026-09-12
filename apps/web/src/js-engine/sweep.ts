import { canonicalJson, compareUnicode } from './canonical';
import { decimalText, InputError, Rational } from './decimal';
import { simulateValidated } from './continuity';
import { validateScenario } from './contract';
import type { SiteScenario, Sweep, Summary } from './types';
import { ENGINE_VERSION } from './version';

const UNITS: Record<string, string> = {
  battery_initial_kwh: 'kWh',
  it_demand_kw: 'kW',
  generator_start_delay_s: 's',
  distribution_efficiency: 'ratio',
};
const PARAMETERS = new Set(Object.keys(UNITS));
const MAX_FULL_RESULT_BYTES = 16 * 1024 * 1024;

function summary(run: ReturnType<typeof simulateValidated>): Summary {
  const warningCounts: Record<string, number> = {};
  for (const interval of run.intervals)
    for (const warning of interval.warnings)
      warningCounts[warning] = (warningCounts[warning] ?? 0) + 1;
  const firstBattery = run.events.find((event) => event.action === 'battery_depleted');
  const result: Summary = { ...run.summary };
  result.requested_kwh = run.summary.requested_it_kwh;
  result.served_kwh = run.summary.served_it_kwh;
  result.unserved_kwh = run.summary.unserved_it_kwh;
  result.unserved_seconds = run.summary.unserved_duration_s;
  result.first_battery_depletion_s = firstBattery?.at_s ?? null;
  result.cost_unknowns = ['generator_energy_charge', 'total_incremental_energy_charge'].filter(
    (key) => run.summary[key] === null,
  );
  result.warning_counts = warningCounts;
  return result;
}

function parseSweepValue(
  value: unknown,
  parameter: string,
  index: number,
): { label: string; parsed: Rational } {
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new InputError(`values[${index}]: expected a finite decimal value`);
  const parsed = Rational.fromDecimal(value, `values[${index}]`);
  if (parameter === 'generator_start_delay_s' && parsed.denominator !== 1n)
    throw new InputError(
      `values[${index}]: generator_start_delay_s must be an integer number of seconds`,
    );
  return { label: decimalText(parsed), parsed };
}

export function sweepContinuity(input: unknown, parameter: string, values: unknown[]): Sweep {
  const scenario = validateScenario(input);
  if (!PARAMETERS.has(parameter))
    throw new InputError(
      `parameter: expected one of ${Array.from(PARAMETERS).sort(compareUnicode).join(', ')}`,
    );
  if (!Array.isArray(values) || values.length === 0)
    throw new InputError('values: expected a nonempty list');
  if (values.length > 20) throw new InputError('values: at most 20 values are supported');
  const parsed = values.map((value, index) => parseSweepValue(value, parameter, index));
  if (new Set(parsed.map((item) => item.label)).size !== parsed.length)
    throw new InputError('values: duplicate value');
  const baseRun = simulateValidated(scenario);
  const runs: Sweep['runs'] = [];
  const fullResults: ReturnType<typeof simulateValidated>[] = [];
  let fullSize = 0;
  let includeFull = true;
  for (const item of parsed) {
    const candidate = {
      ...scenario,
      [parameter]:
        parameter === 'generator_start_delay_s' ? Number(item.parsed.numerator) : item.label,
    } as SiteScenario;
    const run = simulateValidated(validateScenario(candidate));
    const result = run;
    if (includeFull) {
      fullSize += new TextEncoder().encode(canonicalJson(result as never)).byteLength;
      if (fullSize <= MAX_FULL_RESULT_BYTES) fullResults.push(result);
      else {
        includeFull = false;
        fullResults.length = 0;
      }
    }
    runs.push({
      value: item.label,
      value_label: `${item.label} ${UNITS[parameter]}`,
      value_unit: UNITS[parameter],
      run_id: run.run_id,
      input_sha256: run.input_sha256,
      summary: summary(run),
    });
  }
  if (includeFull)
    for (let index = 0; index < runs.length; index++) runs[index].result = fullResults[index];
  return {
    schema_version: 2,
    model: 'single_load_electrical_continuity_sensitivity_v1',
    engine_version: ENGINE_VERSION,
    base_run_id: baseRun.run_id,
    base_input_sha256: baseRun.input_sha256,
    base_scenario: scenario,
    parameter,
    parameter_unit: UNITS[parameter],
    values: parsed.map((item) => item.label),
    runs,
    full_results_included: includeFull,
    full_results_limit_bytes: MAX_FULL_RESULT_BYTES,
    assumptions: [
      'Each value is evaluated from the same starting schema-v2 scenario.',
      'Values change one scenario field; battery capacity and all other topology inputs remain fixed.',
      'Energy accounting is exact within the synthetic single-IT-load continuity model.',
    ],
    limitations: [
      'This is a deterministic sensitivity sweep, not calibration or a forecast.',
      'Cooling, workload queues, switching transients, protection studies and physical controls are outside the model.',
      'Costs remain illustrative or unknown according to the scenario tariff and generator cost inputs.',
    ],
  };
}

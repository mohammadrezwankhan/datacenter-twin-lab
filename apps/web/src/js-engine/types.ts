export interface Asset {
  id: string;
  name: string;
  kind: string;
  capacity_kw: string;
  failure_domains: string[];
  source_ids: string[];
}

export interface Dependency {
  source: string;
  target: string;
  relation: string;
}

export interface ScenarioEvent {
  at_s: number;
  action: string;
  target: string;
  value_kw: string | null;
}

export interface SiteScenario {
  schema_version: 2;
  id: string;
  name: string;
  currency: 'USD' | 'EUR' | 'INR';
  duration_s: number;
  step_s: number;
  it_demand_kw: string;
  it_capacity_kw: string;
  distribution_efficiency: string;
  tariff_per_kwh: string | null;
  generator_cost_per_kwh: string | null;
  generator_start_delay_s: number;
  battery_capacity_kwh: string;
  battery_initial_kwh: string;
  battery_charge_kw: string;
  battery_charge_efficiency: string;
  battery_discharge_efficiency: string;
  source_ids: string[];
  assets: Asset[];
  dependencies: Dependency[];
  events: ScenarioEvent[];
}

export interface DemoData {
  engine_version: string;
  presets: { id: string; name: string }[];
  scenarios: Record<string, SiteScenario>;
}

export interface Interval {
  start_s: string;
  end_s: string;
  duration_s: string;
  requested_it_kw: string;
  served_it_kw: string;
  unserved_it_kw: string;
  electrical_source_kw: string;
  grid_kw: string;
  generator_kw: string;
  battery_discharge_kw: string;
  battery_charge_kw: string;
  battery_start_kwh: string;
  battery_end_kwh: string;
  it_capacity_margin_kw: string;
  grid_energy_charge_to_date: string | null;
  energy: Record<string, string>;
  energy_balance_residual_kwh: string;
  asset_states: Record<string, string>;
  warnings: string[];
  feed_flows_kw: { source: string; target: string; kw: string }[];
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type Summary = { [key: string]: JsonValue };

export interface Run {
  schema_version: 2;
  model: 'single_load_electrical_continuity_v1';
  engine_version: string;
  run_id: string;
  input_sha256: string;
  mode: 'SIMULATED';
  quality: 'synthetic_uncalibrated';
  scenario: SiteScenario;
  intervals: Interval[];
  events: Record<string, JsonValue>[];
  summary: Summary;
  boundary: string;
  limitations: string[];
}

export type DecimalInput = string | number;

export interface SweepRun {
  value: string;
  value_label: string;
  value_unit: string;
  run_id: string;
  input_sha256: string;
  summary: Summary;
  result?: Run;
}

export interface Sweep {
  schema_version: 2;
  model: 'single_load_electrical_continuity_sensitivity_v1';
  engine_version: string;
  base_run_id: string;
  base_input_sha256: string;
  base_scenario: SiteScenario;
  parameter: string;
  parameter_unit: string;
  values: string[];
  runs: SweepRun[];
  full_results_included: boolean;
  full_results_limit_bytes: number;
  assumptions: string[];
  limitations: string[];
}

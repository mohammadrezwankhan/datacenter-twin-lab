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
export interface SiteScenario {
  schema_version: 2;
  id: string;
  name: string;
  currency: string;
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
  events: { at_s: number; action: string; target: string; value_kw: string | null }[];
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
  asset_states: Record<string, string>;
  warnings: string[];
  energy: Record<string, string>;
  energy_balance_residual_kwh: string;
  feed_flows_kw: { source: string; target: string; kw: string }[];
}
export interface Run {
  schema_version: 2;
  model: string;
  engine_version: string;
  run_id: string;
  input_sha256: string;
  mode: string;
  quality: string;
  boundary: string;
  limitations: string[];
  scenario: SiteScenario;
  intervals: Interval[];
  events: { at_s: string; action: string; target?: string; ready_at_s?: string }[];
  summary: Record<string, string | number | null>;
}
export interface Source {
  id: string;
  title: string;
  url: string | null;
  locator: string;
  retrieved_on: string;
  evidence_type: string;
  claim: string;
  limitations: string;
}
export interface Hardware {
  id: string;
  vendor: string;
  sku: string;
  gpu: string;
  gpu_count: number;
  gpu_memory_total_gb: number;
  max_system_power_kw: string;
  rack_units: number;
  price: null;
  calibrated: false;
  source_ids: string[];
}
export interface Offer {
  id: string;
  provider: string;
  sku: string;
  gpu: string;
  gpu_count: number;
  gpu_memory_total: number;
  gpu_memory_unit: string;
  billing_unit: string;
  billing_status: string;
  region: string | null;
  rate: string | null;
  currency: string;
  price_status: string;
  observed_on?: string;
  effective_from?: string;
  availability: string;
  source_ids: string[];
}
export interface Model {
  id: string;
  provider: string;
  exact_model: string;
  deployment_route: string;
  weights_license: string | null;
  self_hosting: string;
  performance: null;
  source_ids: string[];
}
export interface Jurisdiction {
  id: string;
  name: string;
  instrument: string;
  applicability: string;
  screening_question: string;
  decision: string;
  source_ids: string[];
}
export interface Catalog {
  schema_version: number;
  reviewed_on: string;
  sources: Source[];
  hardware: Hardware[];
  cloud_offers: Offer[];
  models: Model[];
  jurisdictions: Jurisdiction[];
}

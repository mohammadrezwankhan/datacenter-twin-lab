import { decimalText, InputError, moneyText, Rational } from './decimal';

function object(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new InputError(`${name}: expected an object`);
  return value as Record<string, unknown>;
}

function exactKeys(data: Record<string, unknown>, keys: string[], name: string): void {
  const expected = new Set(keys);
  const missing = keys.filter((key) => !Object.prototype.hasOwnProperty.call(data, key));
  const extra = Object.keys(data).filter((key) => !expected.has(key));
  if (missing.length || extra.length)
    throw new InputError(
      `${name}: missing fields [${missing.join(', ')}]; unknown fields [${extra.join(', ')}]`,
    );
}

function stringValue(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim() || Array.from(value).length > 200)
    throw new InputError(`${name}: expected nonempty text of at most 200 characters`);
  return value;
}

function integer(value: unknown, name: string, low: number, high: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < low || value > high)
    throw new InputError(`${name}: expected an integer from ${low} to ${high}`);
  return value;
}

export interface CatalogOffer {
  id: string;
  gpu_count: number;
  billing_unit: string;
  currency: string;
  source_ids: string[];
  [key: string]: unknown;
}

export interface Catalog {
  cloud_offers?: CatalogOffer[];
  [key: string]: unknown;
}

export function normalizeQuote(input: unknown, catalog: Catalog): Record<string, unknown> {
  const data = object(input, 'quote');
  exactKeys(data, ['offer_id', 'node_count', 'billed_hours', 'assumed_rate'], 'quote');
  const offerId = stringValue(data.offer_id, 'offer_id');
  const offer = (catalog.cloud_offers ?? []).find((item) => item.id === offerId);
  if (!offer) throw new InputError('offer_id: unknown catalogue offer');
  const count = integer(data.node_count, 'node_count', 1, 100000);
  const hours = Rational.fromDecimal(data.billed_hours, 'billed_hours');
  const rate =
    data.assumed_rate === null ? null : Rational.fromDecimal(data.assumed_rate, 'assumed_rate');
  const gpuCount = offer.gpu_count;
  const nodeHours = Rational.fromInteger(count).mul(hours);
  const units =
    offer.billing_unit === 'gpu_hour' ? nodeHours.mul(Rational.fromInteger(gpuCount)) : nodeHours;
  const total = rate === null ? null : units.mul(rate);
  const nodeRate =
    rate === null
      ? null
      : rate.mul(
          offer.billing_unit === 'gpu_hour' ? Rational.fromInteger(gpuCount) : Rational.one(),
        );
  const gpuRate = nodeRate === null ? null : nodeRate.div(Rational.fromInteger(gpuCount));
  return {
    offer,
    inputs: {
      offer_id: offerId,
      node_count: count,
      billed_hours: decimalText(hours),
      assumed_rate: rate === null ? null : decimalText(rate),
    },
    billing_unit: offer.billing_unit,
    billed_units: decimalText(units),
    billed_node_hours: decimalText(nodeHours),
    normalized_node_hour_rate: nodeRate === null ? null : decimalText(nodeRate),
    provisioned_gpu_hour_rate: gpuRate === null ? null : decimalText(gpuRate),
    cost: moneyText(total),
    currency: offer.currency,
    price_status: rate === null ? 'unknown' : 'user_assumption',
    source_ids: offer.source_ids,
    calibrated: false,
    limitations: [
      'User-entered rate is an assumption, not a fetched vendor quote.',
      'Already-billed hours exclude invoice granularity, minimums, taxes and ancillary charges.',
      'No workload throughput, utilization, region availability or performance equivalence is inferred.',
    ],
  };
}

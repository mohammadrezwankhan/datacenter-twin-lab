/** Exact non-negative input decimals and signed rational arithmetic.
 *
 * The Python continuity engine keeps all simulation quantities as Fraction
 * values and only converts at the JSON boundary with a 100 digit, half-even
 * Decimal context.  This module mirrors that boundary without using binary
 * floating point for any model quantity.
 */

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputError';
  }
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function gcd(left: bigint, right: bigint): bigint {
  left = abs(left);
  right = abs(right);
  while (right !== 0n) {
    const next = left % right;
    left = right;
    right = next;
  }
  return left || 1n;
}

function pow10(exponent: bigint): bigint {
  if (exponent < 0n) throw new Error('Negative power of ten');
  // Scenario inputs are bounded to nine decimal places.  Intermediate
  // quantities remain small enough for this conversion; keep a guard so a
  // malformed direct value cannot allocate an unbounded integer.
  if (exponent > 100000n) throw new InputError('numeric representation is too long');
  return 10n ** exponent;
}

// Python's Decimal parser accepts every Unicode Nd digit and ignores ASCII
// underscores in the numeric text.  Normalize those forms before applying the
// deliberately small decimal grammar below.  The ranges are the Unicode
// decimal-digit blocks; mathematical digits have five adjacent blocks.
const UNICODE_DIGIT_RANGES: readonly [number, number][] = [
  [0x30, 0x39],
  [0x660, 0x669],
  [0x6f0, 0x6f9],
  [0x7c0, 0x7c9],
  [0x966, 0x96f],
  [0x9e6, 0x9ef],
  [0xa66, 0xa6f],
  [0xae6, 0xaef],
  [0xb66, 0xb6f],
  [0xbe6, 0xbef],
  [0xc66, 0xc6f],
  [0xce6, 0xcef],
  [0xd66, 0xd6f],
  [0xde6, 0xdef],
  [0xe50, 0xe59],
  [0xed0, 0xed9],
  [0xf20, 0xf29],
  [0x1040, 0x1049],
  [0x1090, 0x1099],
  [0x17e0, 0x17e9],
  [0x1810, 0x1819],
  [0x1946, 0x194f],
  [0x19d0, 0x19d9],
  [0x1a80, 0x1a89],
  [0x1a90, 0x1a99],
  [0x1b50, 0x1b59],
  [0x1bb0, 0x1bb9],
  [0x1c40, 0x1c49],
  [0x1c50, 0x1c59],
  [0xa620, 0xa629],
  [0xa8d0, 0xa8d9],
  [0xa900, 0xa909],
  [0xa9d0, 0xa9d9],
  [0xa9f0, 0xa9f9],
  [0xaa50, 0xaa59],
  [0xabf0, 0xabf9],
  [0xff10, 0xff19],
  [0x104a0, 0x104a9],
  [0x10d30, 0x10d39],
  [0x11066, 0x1106f],
  [0x110f0, 0x110f9],
  [0x11136, 0x1113f],
  [0x111d0, 0x111d9],
  [0x112f0, 0x112f9],
  [0x11450, 0x11459],
  [0x114d0, 0x114d9],
  [0x11650, 0x11659],
  [0x116c0, 0x116c9],
  [0x11730, 0x11739],
  [0x118e0, 0x118e9],
  [0x11950, 0x11959],
  [0x11c50, 0x11c59],
  [0x11d50, 0x11d59],
  [0x11da0, 0x11da9],
  [0x11f50, 0x11f59],
  [0x16a60, 0x16a69],
  [0x16ac0, 0x16ac9],
  [0x16b50, 0x16b59],
  [0x1d7ce, 0x1d7d7],
  [0x1d7d8, 0x1d7e1],
  [0x1d7e2, 0x1d7eb],
  [0x1d7ec, 0x1d7f5],
  [0x1d7f6, 0x1d7ff],
  [0x1e140, 0x1e149],
  [0x1e2f0, 0x1e2f9],
  [0x1e4f0, 0x1e4f9],
  [0x1e950, 0x1e959],
  [0x1fbf0, 0x1fbf9],
];

function normalizeDecimalText(input: string): string {
  return Array.from(input.trim())
    .filter((character) => character !== '_')
    .map((character) => {
      const codePoint = character.codePointAt(0)!;
      for (const [start, end] of UNICODE_DIGIT_RANGES)
        if (codePoint >= start && codePoint <= end) return String(codePoint - start);
      return character;
    })
    .join('');
}

/** A reduced signed rational. Denominator is always positive. */
export class Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;

  constructor(numerator: bigint | number, denominator: bigint | number = 1n) {
    let n = BigInt(numerator);
    let d = BigInt(denominator);
    if (d === 0n) throw new Error('Division by zero');
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    if (n === 0n) {
      this.numerator = 0n;
      this.denominator = 1n;
      return;
    }
    const divisor = gcd(n, d);
    this.numerator = n / divisor;
    this.denominator = d / divisor;
  }

  static zero(): Rational {
    return new Rational(0n);
  }

  static one(): Rational {
    return new Rational(1n);
  }

  static fromInteger(value: number | bigint): Rational {
    return new Rational(BigInt(value));
  }

  static fromDecimal(
    value: unknown,
    name = 'value',
    options: { positive?: boolean } = {},
  ): Rational {
    if (typeof value !== 'string' && typeof value !== 'number')
      throw new InputError(`${name}: expected a finite decimal number`);
    if (typeof value === 'number' && !Number.isFinite(value))
      throw new InputError(`${name}: expected a finite decimal number`);
    const rawInput = String(value);
    if (Array.from(rawInput).length > 128)
      throw new InputError(`${name}: numeric representation is too long`);
    const input = normalizeDecimalText(rawInput);
    const match = input.trim().match(/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/);
    if (!match) throw new InputError(`${name}: expected a finite decimal number`);
    const sign = match[1] === '-' ? -1n : 1n;
    const integerPart = match[2] ?? '';
    const fractionPart = match[3] ?? match[4] ?? '';
    const exponentText = match[5] ?? '0';
    let exponent: bigint;
    try {
      exponent = BigInt(exponentText);
    } catch {
      throw new InputError(`${name}: expected a finite decimal number`);
    }
    // Decimal.as_tuple().exponent is the effective exponent after accounting
    // for written fractional digits; trailing zeroes therefore remain subject
    // to the Python contract's nine-place bound.
    const effectiveExponent = exponent - BigInt(fractionPart.length);
    if (effectiveExponent < -9n)
      throw new InputError(`${name}: maximum 1e12 with at most nine decimal places`);
    const digitsText = `${integerPart}${fractionPart}`.replace(/^0+(?=\d)/, '') || '0';
    let numerator: bigint;
    try {
      numerator =
        BigInt(digitsText) *
        pow10(exponent < BigInt(fractionPart.length) ? 0n : exponent - BigInt(fractionPart.length));
    } catch (error) {
      if (error instanceof InputError) throw error;
      throw new InputError(`${name}: expected a finite decimal number`);
    }
    let denominator = 1n;
    const decimalPlaces = BigInt(fractionPart.length) - exponent;
    if (decimalPlaces > 0n) {
      if (decimalPlaces > 100000n)
        throw new InputError(`${name}: numeric representation is too long`);
      // The branch above used no scale for negative effective exponents.
      numerator = BigInt(digitsText);
      denominator = pow10(decimalPlaces);
    }
    const result = new Rational(sign * numerator, denominator);
    if (result.numerator < 0n || (options.positive === true && result.numerator === 0n))
      throw new InputError(`${name}: must be ${options.positive ? 'positive' : 'nonnegative'}`);
    if (result.compare(new Rational(1000000000000n)) > 0)
      throw new InputError(`${name}: maximum 1e12 with at most nine decimal places`);
    return result;
  }

  add(other: Rational): Rational {
    return new Rational(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  sub(other: Rational): Rational {
    return new Rational(
      this.numerator * other.denominator - other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  mul(other: Rational): Rational {
    return new Rational(this.numerator * other.numerator, this.denominator * other.denominator);
  }

  div(other: Rational): Rational {
    return new Rational(this.numerator * other.denominator, this.denominator * other.numerator);
  }

  neg(): Rational {
    return new Rational(-this.numerator, this.denominator);
  }

  compare(other: Rational): number {
    const left = this.numerator * other.denominator;
    const right = other.numerator * this.denominator;
    return left < right ? -1 : left > right ? 1 : 0;
  }

  isZero(): boolean {
    return this.numerator === 0n;
  }

  isPositive(): boolean {
    return this.numerator > 0n;
  }

  toDecimal(): string {
    return decimalText(this);
  }

  toMoney(): string | null {
    return moneyText(this);
  }
}

function roundHalfEven(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n || numerator < 0n) throw new Error('Expected nonnegative division');
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const twice = remainder * 2n;
  if (twice > denominator || (twice === denominator && quotient % 2n === 1n)) return quotient + 1n;
  return quotient;
}

function decimalExponent(numerator: bigint, denominator: bigint): number {
  let exponent = numerator.toString().length - denominator.toString().length;
  if (exponent >= 0) {
    if (numerator < denominator * pow10(BigInt(exponent))) exponent -= 1;
  } else if (numerator * pow10(BigInt(-exponent)) < denominator) {
    exponent -= 1;
  }
  return exponent;
}

/** Python Decimal( n ) / Decimal( d ) under prec=100, ROUND_HALF_EVEN, f format. */
export function decimalText(value: Rational): string {
  if (value.isZero()) return '0';
  const negative = value.numerator < 0n;
  const numerator = abs(value.numerator);
  const denominator = value.denominator;
  const exponent = decimalExponent(numerator, denominator);
  const scale = 99 - exponent;
  const scaledNumerator = scale >= 0 ? numerator * pow10(BigInt(scale)) : numerator;
  const scaledDenominator = scale >= 0 ? denominator : denominator * pow10(BigInt(-scale));
  const coefficient = roundHalfEven(scaledNumerator, scaledDenominator);
  let digits = coefficient.toString();
  let output: string;
  if (scale >= 0) {
    const point = digits.length - scale;
    if (point <= 0) output = `0.${'0'.repeat(-point)}${digits}`;
    else if (point >= digits.length) output = `${digits}${'0'.repeat(point - digits.length)}`;
    else output = `${digits.slice(0, point)}.${digits.slice(point)}`;
  } else {
    output = `${digits}${'0'.repeat(-scale)}`;
  }
  if (output.includes('.')) output = output.replace(/0+$/, '').replace(/\.$/, '');
  if (output === '' || output === '0') return '0';
  return negative ? `-${output}` : output;
}

/** Python Decimal(...).quantize(Decimal("0.01"), ROUND_HALF_EVEN). */
export function moneyText(value: Rational | null): string | null {
  if (value === null) return null;
  const negative = value.numerator < 0n;
  const rounded = roundHalfEven(abs(value.numerator) * 100n, value.denominator);
  const whole = rounded / 100n;
  const cents = (rounded % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole.toString()}.${cents}`;
}

export function rational(value: number | bigint): Rational {
  return Rational.fromInteger(value);
}

export function parseDecimal(value: unknown, name = 'value', positive = false): Rational {
  return Rational.fromDecimal(value, name, { positive });
}

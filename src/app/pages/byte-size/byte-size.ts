import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

type InputUnit = 'B' | 'KB' | 'MB' | 'GB' | 'TB' | 'PB' | 'KiB' | 'MiB' | 'GiB' | 'TiB' | 'PiB';

const INPUT_UNIT_BYTES: Record<InputUnit, number> = {
  B: 1,
  KB: 1e3,
  MB: 1e6,
  GB: 1e9,
  TB: 1e12,
  PB: 1e15,
  KiB: 1024,
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
  TiB: 1024 ** 4,
  PiB: 1024 ** 5
};

const DECIMAL_UNITS: InputUnit[] = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
const BINARY_UNITS: InputUnit[] = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB'];

const SCALES: { name: string; decimal: string; binary: string }[] = [
  { name: 'Byte', decimal: 'B', binary: 'B' },
  { name: 'Kilobyte', decimal: 'KB', binary: 'KiB' },
  { name: 'Megabyte', decimal: 'MB', binary: 'MiB' },
  { name: 'Gigabyte', decimal: 'GB', binary: 'GiB' },
  { name: 'Terabyte', decimal: 'TB', binary: 'TiB' },
  { name: 'Petabyte', decimal: 'PB', binary: 'PiB' }
];

const REFERENCE_SIZES: { label: string; size: number; unit: InputUnit }[] = [
  { label: '100 B', size: 100, unit: 'B' },
  { label: '1 KB', size: 1, unit: 'KB' },
  { label: '10 KB', size: 10, unit: 'KB' },
  { label: '100 KB', size: 100, unit: 'KB' },
  { label: '1 MB', size: 1, unit: 'MB' }
];

const REFERENCE_COUNTS: { label: string; count: number }[] = [
  { label: '10K', count: 1e4 },
  { label: '100K', count: 1e5 },
  { label: '1M', count: 1e6 },
  { label: '10M', count: 1e7 },
  { label: '100M', count: 1e8 },
  { label: '1B', count: 1e9 }
];

// Background/text color per decimal unit index, so the grid reads as bands
const UNIT_COLORS: Record<string, string> = {
  MB: 'bg-gray-50 text-gray-600',
  GB: 'bg-blue-50 text-blue-700',
  TB: 'bg-blue-100 text-blue-800',
  PB: 'bg-blue-200 text-blue-900'
};

const RULES: { left: string; right: string }[] = [
  { left: 'KB × 1K', right: 'MB' },
  { left: 'KB × 1M', right: 'GB' },
  { left: 'KB × 1B', right: 'TB' },
  { left: 'MB × 1M', right: 'TB' },
  { left: 'MB × 1B', right: 'PB' }
];

const COMPARISONS: { singular: string; plural: string; bytes: number; each: string }[] = [
  { singular: 'text message', plural: 'text messages', bytes: 160, each: '160 B' },
  { singular: 'page of plain text', plural: 'pages of plain text', bytes: 2e3, each: '2 KB' },
  { singular: 'smartphone photo', plural: 'smartphone photos', bytes: 3e6, each: '3 MB' },
  { singular: 'CD', plural: 'CDs', bytes: 7e8, each: '700 MB' },
  { singular: 'DVD', plural: 'DVDs', bytes: 4.7e9, each: '4.7 GB' },
  { singular: 'laptop SSD', plural: 'laptop SSDs', bytes: 1e12, each: '1 TB' },
  { singular: 'large hard drive', plural: 'large hard drives', bytes: 2e13, each: '20 TB' }
];

// Record counts for the "at scale" ladder
const SCALE_COUNTS: { label: string; count: number }[] = [{ label: '1K', count: 1e3 }, ...REFERENCE_COUNTS];

const UTF8 = new TextEncoder();

const SHORTHAND: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };

function parseMultiplier(text: string): number | null {
  const match = text
    .trim()
    .toLowerCase()
    .replace(/[,_\s]/g, '')
    .match(/^(\d*\.?\d+)([kmbt])?$/);
  if (!match) return null;
  const value = Number(match[1]) * (match[2] ? SHORTHAND[match[2]] : 1);
  return isFinite(value) ? value : null;
}

function formatValue(n: number): string {
  if (!isFinite(n) || n === 0) return '0';
  // Cap significant digits so float noise (e.g. 1e24 -> 999,999,...,784) never shows up
  if (n >= 1e15) return n.toLocaleString('en-US', { maximumSignificantDigits: 15 });
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { maximumSignificantDigits: 4 });
}

// Index of the largest unit the value reaches at least 1 of, capped at PB
function bestScaleIndex(bytes: number, base: number): number {
  let i = 0;
  while (i < SCALES.length - 1 && bytes >= base ** (i + 1)) i++;
  return i;
}

function humanize(bytes: number): { value: string; unit: string } {
  const i = bestScaleIndex(bytes, 1000);
  return {
    value: (bytes / 1000 ** i).toLocaleString('en-US', { maximumSignificantDigits: 3 }),
    unit: SCALES[i].decimal
  };
}

function humanizeText(bytes: number): string {
  const { value, unit } = humanize(bytes);
  return `${value} ${unit}`;
}

function unitColor(unit: string): string {
  return UNIT_COLORS[unit] ?? 'bg-gray-50 text-gray-500';
}

function minifiedJsonBytes(text: string): number | null {
  try {
    return UTF8.encode(JSON.stringify(JSON.parse(text))).length;
  } catch {
    return null;
  }
}

function multiplierWords(n: number): string {
  if (n < 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { notation: 'compact', compactDisplay: 'long', maximumFractionDigits: 2 });
}

function multiplierShorthand(n: number): string {
  return n.toLocaleString('en-US', { notation: 'compact', compactDisplay: 'short' });
}

function comparison(bytes: number): string | null {
  const ref = [...COMPARISONS].reverse().find((c) => bytes >= c.bytes);
  if (!ref) return null;
  const n = bytes / ref.bytes;
  const count = n.toLocaleString('en-US', { maximumFractionDigits: n < 10 ? 1 : 0 });
  return `About ${count} ${count === '1' ? ref.singular : ref.plural} (${ref.each} each)`;
}

interface SizeRow {
  name: string;
  decimal: string;
  binary: string;
}

@Component({
  selector: 'app-byte-size',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mt-4 max-w-2xl space-y-6">
      <a routerLink="/" class="text-blue-500 text-sm hover:underline inline-block">← All tools</a>

      <div>
        <h2 class="text-gray-800 text-2xl font-bold mb-1">Byte Size Calculator</h2>
        <p class="text-gray-500 text-sm">
          How much space will it take? Enter a record size (or paste a sample payload) and how many records you have.
        </p>
      </div>

      <div>
        <div class="flex flex-col sm:flex-row gap-3">
          @if (payloadActive()) {
            <div class="flex flex-col gap-1 flex-1">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Size (from sample)</label>
              <div class="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800 text-sm">
                {{ recordBytesText() }}
                <span class="text-gray-400">· {{ recordBytesExact() }} bytes</span>
              </div>
            </div>
          } @else {
            <div class="flex flex-col gap-1 flex-1">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Size</label>
              <input
                type="number"
                min="0"
                [value]="size() ?? ''"
                (input)="onSizeChange($event)"
                placeholder="e.g. 10"
                class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              />
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Unit</label>
              <select
                (change)="onUnitChange($event)"
                class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-white"
              >
                <optgroup label="Decimal (1000)">
                  @for (u of decimalUnits; track u) {
                    <option [value]="u" [selected]="u === unit()">{{ u }}</option>
                  }
                </optgroup>
                <optgroup label="Binary (1024)">
                  @for (u of binaryUnits; track u) {
                    <option [value]="u" [selected]="u === unit()">{{ u }}</option>
                  }
                </optgroup>
              </select>
            </div>
          }

          <div class="flex flex-col gap-1 flex-1">
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">× How many</label>
            <input
              type="text"
              inputmode="decimal"
              [value]="multiplierText()"
              (input)="onMultiplierChange($event)"
              placeholder="e.g. 100M, 2.5k, 1B"
              class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              [class.border-red-400]="multiplier() === null"
            />
            <span
              class="text-xs"
              [class.text-gray-400]="multiplier() !== null"
              [class.text-red-500]="multiplier() === null"
            >
              {{
                multiplier() === null ? 'Use a number, optionally ending in k, M, B, or T' : '= ' + multiplierInWords()
              }}
            </span>
          </div>
        </div>

        <div class="mt-3">
          <button
            (click)="showSample.set(!showSample())"
            class="text-blue-500 text-sm hover:underline cursor-pointer"
            [attr.aria-expanded]="showSample()"
          >
            {{ showSample() ? '▾' : '▸' }} Measure a sample payload
          </button>
          @if (showSample()) {
            <div class="mt-3 flex flex-col gap-2">
              <textarea
                rows="6"
                [value]="payloadText()"
                (input)="onPayloadChange($event)"
                placeholder="Paste a sample record -- a JSON payload, CSV row, log line, etc. Its size replaces the Size field above."
                class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 font-mono resize-y"
              ></textarea>
              @if (payloadActive()) {
                <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                  <span>
                    {{ payloadBytesExact() }} bytes (UTF-8) · {{ payloadChars() }} characters
                    @if (payloadBytes() !== payloadCharCount()) {
                      <span class="text-gray-400">-- includes multi-byte characters</span>
                    }
                  </span>
                  @if (minifiedBytes() !== null && minifiedBytes() !== payloadBytes()) {
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" [checked]="useMinified()" (change)="useMinified.set(!useMinified())" />
                      Use minified JSON size ({{ minifiedBytesText() }})
                    </label>
                  }
                  <button
                    (click)="payloadText.set('')"
                    class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors ml-auto"
                  >
                    Clear sample
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <div #answer class="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 scroll-mt-4">
        @if (result(); as r) {
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm text-gray-600">{{ r.sentence }}</p>
              <p class="text-4xl font-bold text-blue-700 my-1">{{ r.headline }}</p>
              <p class="text-xs text-gray-500 font-mono">{{ r.bytes }} bytes</p>
              @if (r.comparison) {
                <p class="text-xs text-gray-500 mt-1">{{ r.comparison }}</p>
              }
            </div>
            <button
              (click)="copyHeadline()"
              class="px-2 py-1 border border-gray-300 hover:border-gray-400 bg-white text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors whitespace-nowrap"
            >
              {{ copiedHeadline() ? 'Copied!' : 'Copy' }}
            </button>
          </div>
        } @else {
          <p class="text-sm text-gray-400">Enter a size and how many to see the total.</p>
        }
      </div>

      @if (recordBytes() !== null) {
        <div>
          <h3 class="text-gray-800 text-lg font-bold mb-1">At scale</h3>
          <p class="text-gray-500 text-sm mb-3">
            {{ recordBytesText() }} per record, from a thousand to a billion records. Click one to use it.
          </p>
          <div class="grid grid-cols-4 sm:grid-cols-7 gap-2">
            @for (step of ladder(); track step.count) {
              <button
                (click)="pickCount(step.count)"
                class="rounded-lg px-2 py-2 text-center cursor-pointer transition-shadow"
                [class]="tileClass(step.color, multiplier() === step.count)"
              >
                <div class="text-xs opacity-70">× {{ step.label }}</div>
                <div class="font-mono text-sm font-semibold whitespace-nowrap">{{ step.text }}</div>
              </button>
            }
          </div>
        </div>
      }

      @if (result()) {
        <div>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <button
              (click)="showAll.set(!showAll())"
              class="text-blue-500 text-sm hover:underline cursor-pointer"
              [attr.aria-expanded]="showAll()"
            >
              {{ showAll() ? '▾ Hide all units' : '▸ Show all units' }}
            </button>
            @if (showAll()) {
              <label class="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  [checked]="binaryVisible()"
                  [disabled]="isBinaryInput()"
                  (change)="showBinary.set(!showBinary())"
                />
                Show binary (KiB, MiB, ...)
              </label>
            }
          </div>

          @if (showAll()) {
            <div class="overflow-x-auto rounded-xl border border-gray-200 mt-3">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-200">
                    <th class="text-left px-4 py-3 font-semibold text-gray-600 w-28">Unit</th>
                    <th class="text-right px-4 py-3 font-semibold text-gray-600">Decimal (1000)</th>
                    @if (binaryVisible()) {
                      <th class="text-right px-4 py-3 font-semibold text-gray-600">Binary (1024)</th>
                    }
                    <th class="px-4 py-3 w-20">
                      <button
                        (click)="copyAll()"
                        class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors float-right whitespace-nowrap"
                      >
                        {{ copiedAll() ? 'Copied!' : 'Copy all' }}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of rows(); track row.name; let i = $index) {
                    @let best = i === bestIndex();
                    @let bestDecimal = best && !isBinaryInput();
                    @let bestBinary = best && isBinaryInput();
                    <tr class="border-b border-gray-100 last:border-0" [class.bg-blue-50]="best">
                      <td class="px-4 py-3 font-medium" [class.text-blue-700]="best" [class.text-gray-400]="!best">
                        {{ row.name }}
                      </td>
                      <td
                        class="px-4 py-3 text-right font-mono whitespace-nowrap"
                        [class.font-bold]="bestDecimal"
                        [class.text-blue-700]="bestDecimal"
                        [class.text-gray-400]="!bestDecimal"
                      >
                        {{ row.decimal }}
                      </td>
                      @if (binaryVisible()) {
                        <td
                          class="px-4 py-3 text-right font-mono whitespace-nowrap"
                          [class.font-bold]="bestBinary"
                          [class.text-blue-700]="bestBinary"
                          [class.text-gray-400]="!bestBinary"
                        >
                          {{ row.binary }}
                        </td>
                      }
                      <td class="px-4 py-3 text-right">
                        <button
                          (click)="copyRow(row)"
                          class="px-2 py-1 border border-gray-300 hover:border-gray-400 bg-white text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors"
                        >
                          {{ copiedRow() === row.name ? 'Copied!' : 'Copy' }}
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }

      <div>
        <h3 class="text-gray-800 text-lg font-bold mb-1">Rules of thumb</h3>
        <p class="text-gray-500 text-sm mb-3">
          Every × 1,000 moves up one unit. × 10 or × 100 just moves the number: 10 KB × 100M = 1 KB × 1B = 1 TB.
        </p>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
          @for (rule of rules; track rule.left; let last = $last) {
            <div
              class="rounded-lg border border-gray-200 px-3 py-2 text-center"
              [class.col-span-2]="last"
              [class.sm:col-span-1]="last"
            >
              <div class="text-xs text-gray-500 font-mono">{{ rule.left }}</div>
              <div class="text-sm font-semibold text-gray-800">= {{ rule.right }}</div>
            </div>
          }
        </div>
      </div>

      <div>
        <h3 class="text-gray-800 text-lg font-bold mb-1">Quick reference</h3>
        <p class="text-gray-500 text-sm mb-3">
          Record size × how many, in decimal units. Same color = same unit. Click a cell to load it above.
        </p>
        <div class="overflow-x-auto rounded-xl border border-gray-200">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200">
                <th class="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap sticky left-0 bg-gray-50">
                  Size × How many
                </th>
                @for (c of referenceCounts; track c.label) {
                  <th class="text-center px-1 py-3 font-semibold text-gray-600">{{ c.label }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (r of referenceRows; track r.label) {
                <tr class="border-b border-gray-100 last:border-0">
                  <td class="px-3 py-2 text-gray-500 font-medium whitespace-nowrap sticky left-0 bg-white">
                    {{ r.label }}
                  </td>
                  @for (cell of r.cells; track cell.count) {
                    <td class="px-1 py-1">
                      <button
                        (click)="pickReference(r.size, r.unit, cell.count, answer)"
                        class="w-full rounded-md px-2 py-2 font-mono whitespace-nowrap cursor-pointer transition-shadow"
                        [class]="tileClass(cell.color, isActive(r.size, r.unit, cell.count))"
                        [attr.aria-label]="r.label + ' times ' + cell.countLabel + ' = ' + cell.text"
                      >
                        {{ cell.text }}
                      </button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="flex flex-wrap gap-2 mt-3 text-xs">
          @for (u of legend; track u.unit) {
            <span class="rounded-md px-2 py-1 font-mono {{ u.color }}">{{ u.unit }}</span>
          }
        </div>
      </div>
    </main>
  `
})
export class ByteSizeCalculator {
  readonly size = signal<number | null>(10);
  readonly unit = signal<InputUnit>('KB');
  readonly multiplierText = signal('100M');
  readonly showAll = signal(false);
  readonly showBinary = signal(false);
  readonly copiedRow = signal<string | null>(null);
  readonly copiedAll = signal(false);
  readonly copiedHeadline = signal(false);
  readonly showSample = signal(false);
  readonly payloadText = signal('');
  readonly useMinified = signal(false);

  readonly decimalUnits = DECIMAL_UNITS;
  readonly binaryUnits = BINARY_UNITS;
  readonly rules = RULES;
  readonly referenceCounts = REFERENCE_COUNTS;
  readonly legend = Object.entries(UNIT_COLORS).map(([unit, color]) => ({ unit, color }));
  readonly referenceRows = REFERENCE_SIZES.map((s) => ({
    ...s,
    cells: REFERENCE_COUNTS.map((c) => {
      const { value, unit } = humanize(s.size * INPUT_UNIT_BYTES[s.unit] * c.count);
      return {
        count: c.count,
        countLabel: c.label,
        text: `${value} ${unit}`,
        color: unitColor(unit)
      };
    })
  }));

  readonly multiplier = computed(() => parseMultiplier(this.multiplierText()));
  readonly multiplierInWords = computed(() => {
    const m = this.multiplier();
    return m === null ? '' : multiplierWords(m);
  });

  readonly payloadActive = computed(() => this.payloadText().length > 0);
  readonly payloadBytes = computed(() => UTF8.encode(this.payloadText()).length);
  readonly payloadCharCount = computed(() => [...this.payloadText()].length);
  readonly payloadBytesExact = computed(() => formatValue(this.payloadBytes()));
  readonly payloadChars = computed(() => formatValue(this.payloadCharCount()));
  readonly minifiedBytes = computed(() => (this.payloadActive() ? minifiedJsonBytes(this.payloadText()) : null));
  readonly minifiedBytesText = computed(() => formatValue(this.minifiedBytes() ?? 0) + ' bytes');

  // Bytes for one record -- from the pasted sample when there is one, otherwise size × unit
  readonly recordBytes = computed<number | null>(() => {
    if (this.payloadActive()) {
      const minified = this.minifiedBytes();
      return this.useMinified() && minified !== null ? minified : this.payloadBytes();
    }
    const s = this.size();
    if (s === null || s <= 0) return null;
    return s * INPUT_UNIT_BYTES[this.unit()];
  });
  readonly recordBytesText = computed(() => humanizeText(this.recordBytes() ?? 0));
  readonly recordBytesExact = computed(() => formatValue(this.recordBytes() ?? 0));

  readonly totalBytes = computed<number | null>(() => {
    const record = this.recordBytes();
    const m = this.multiplier();
    if (record === null || record <= 0 || m === null || m <= 0) return null;
    return record * m;
  });

  readonly ladder = computed(() => {
    const record = this.recordBytes() ?? 0;
    return SCALE_COUNTS.map((c) => {
      const { value, unit } = humanize(record * c.count);
      return { count: c.count, label: c.label, text: `${value} ${unit}`, color: unitColor(unit) };
    });
  });

  readonly isBinaryInput = computed(() => !this.payloadActive() && BINARY_UNITS.includes(this.unit()));

  // Binary input always shows the binary column, since that is where the answer lives
  readonly binaryVisible = computed(() => this.showBinary() || this.isBinaryInput());

  // Answer in the same system the user typed in (KiB in -> binary out)
  readonly base = computed(() => (this.isBinaryInput() ? 1024 : 1000));

  readonly bestIndex = computed(() => {
    const total = this.totalBytes();
    return total === null ? -1 : bestScaleIndex(total, this.base());
  });

  readonly result = computed(() => {
    const total = this.totalBytes();
    if (total === null) return null;

    const base = this.base();
    const i = this.bestIndex();
    const label = this.isBinaryInput() ? SCALES[i].binary : SCALES[i].decimal;
    const m = this.multiplier()!;
    const sizeText = this.payloadActive()
      ? `${this.recordBytesText()} sample`
      : `${formatValue(this.size()!)} ${this.unit()}`;

    return {
      sentence: m === 1 ? `${sizeText} =` : `${sizeText} × ${multiplierWords(m)} =`,
      headline: `${formatValue(total / base ** i)} ${label}`,
      bytes: formatValue(total),
      comparison: comparison(total)
    };
  });

  readonly rows = computed<SizeRow[]>(() => {
    const total = this.totalBytes();
    if (total === null) return [];
    return SCALES.map((scale, i) => ({
      name: scale.name,
      decimal: `${formatValue(total / 1000 ** i)} ${scale.decimal}`,
      binary: `${formatValue(total / 1024 ** i)} ${scale.binary}`
    }));
  });

  // Unit color plus a ring for the selected tile (a single [class] binding so stale classes never linger)
  tileClass(color: string, active: boolean): string {
    return `${color} ${active ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-blue-300'}`;
  }

  isActive(size: number, unit: InputUnit, count: number): boolean {
    return !this.payloadActive() && this.size() === size && this.unit() === unit && this.multiplier() === count;
  }

  pickReference(size: number, unit: InputUnit, count: number, answer: HTMLElement): void {
    this.size.set(size);
    this.unit.set(unit);
    this.multiplierText.set(multiplierShorthand(count));
    this.payloadText.set('');
    answer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  pickCount(count: number): void {
    this.multiplierText.set(multiplierShorthand(count));
  }

  onPayloadChange(event: Event): void {
    this.payloadText.set((event.target as HTMLTextAreaElement).value);
  }

  onSizeChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.size.set(val === '' ? null : Number(val));
  }

  onUnitChange(event: Event): void {
    this.unit.set((event.target as HTMLSelectElement).value as InputUnit);
  }

  onMultiplierChange(event: Event): void {
    this.multiplierText.set((event.target as HTMLInputElement).value);
  }

  async copyHeadline(): Promise<void> {
    const r = this.result();
    if (!r) return;
    try {
      await navigator.clipboard.writeText(`${r.sentence} ${r.headline}`);
      this.copiedHeadline.set(true);
      setTimeout(() => this.copiedHeadline.set(false), 2000);
    } catch {}
  }

  async copyRow(row: SizeRow): Promise<void> {
    const text = this.binaryVisible() ? `${row.decimal} (${row.binary})` : row.decimal;
    try {
      await navigator.clipboard.writeText(text);
      this.copiedRow.set(row.name);
      setTimeout(() => this.copiedRow.set(null), 2000);
    } catch {}
  }

  async copyAll(): Promise<void> {
    const text = this.rows()
      .map((r) => `${r.name}: ${r.decimal}${this.binaryVisible() ? ` (${r.binary})` : ''}`)
      .join('\n');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copiedAll.set(true);
      setTimeout(() => this.copiedAll.set(false), 2000);
    } catch {}
  }
}

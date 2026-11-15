import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

const UNITS: { label: string; name: string; bytes: number }[] = [
  { label: 'B', name: 'Bytes', bytes: 1 },
  { label: 'KB', name: 'Kilobytes', bytes: 1e3 },
  { label: 'MB', name: 'Megabytes', bytes: 1e6 },
  { label: 'GB', name: 'Gigabytes', bytes: 1e9 },
  { label: 'TB', name: 'Terabytes', bytes: 1e12 },
  { label: 'PB', name: 'Petabytes', bytes: 1e15 }
];

// 1, 10 and 100 of each unit from B to TB
const REFERENCE_SIZES: { label: string; bytes: number }[] = UNITS.slice(0, 5).flatMap((u) =>
  [1, 10, 100].map((m) => ({ label: `${m} ${u.label}`, bytes: m * u.bytes }))
);

const REFERENCE_COUNTS: { label: string; count: number }[] = [
  { label: '10', count: 10 },
  { label: '100', count: 100 },
  { label: '1K', count: 1e3 }
];

const SHORTHAND: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };

// Accepts plain numbers or shorthand like 100M, 2.5k, 1,000,000
function parseRecords(text: string): number | null {
  const match = text
    .trim()
    .toLowerCase()
    .replace(/[,_\s]/g, '')
    .match(/^(\d*\.?\d+)([kmbt])?$/);
  return match ? Number(match[1]) * (match[2] ? SHORTHAND[match[2]] : 1) : null;
}

function formatValue(n: number): string {
  if (!isFinite(n) || n === 0) return '0';
  // Cap significant digits so float noise (e.g. 1e24 -> 999,999,...,784) never shows up
  if (n >= 1e15) return n.toLocaleString('en-US', { maximumSignificantDigits: 15 });
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { maximumSignificantDigits: 4 });
}

function inWords(n: number): string {
  return n < 1000
    ? formatValue(n)
    : n.toLocaleString('en-US', { notation: 'compact', compactDisplay: 'long', maximumFractionDigits: 2 });
}

// Largest unit the value reaches at least 1 of, capped at PB
function bestUnitIndex(bytes: number): number {
  let i = 0;
  while (i < UNITS.length - 1 && bytes >= UNITS[i + 1].bytes) i++;
  return i;
}

function humanize(bytes: number): string {
  const unit = UNITS[bestUnitIndex(bytes)];
  return `${(bytes / unit.bytes).toLocaleString('en-US', { maximumSignificantDigits: 3 })} ${unit.label}`;
}

const SAMPLE_FORMULA = '1-byte chars × 1 + 2-byte chars × 2 + 3-byte chars × 3 + 4-byte chars × 4';

// UTF-8 uses 1 byte up to U+007F, 2 up to U+07FF, 3 up to U+FFFF and 4 beyond
function utf8Length(char: string): number {
  const code = char.codePointAt(0)!;
  return code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
}

interface SizeRow {
  name: string;
  formatted: string;
  best: boolean;
}

@Component({
  selector: 'app-byte-size',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mt-4 max-w-2xl">
      <a routerLink="/" class="text-blue-500 text-sm hover:underline mb-6 inline-block">← All tools</a>

      <h2 class="text-gray-800 text-2xl font-bold mb-6">Byte Size Calculator</h2>

      <h3 class="mb-1">
        <button
          (click)="showTotal.set(!showTotal())"
          class="flex items-center gap-1 text-gray-800 text-lg font-bold cursor-pointer"
          [attr.aria-expanded]="showTotal()"
        >
          <svg
            class="w-5 h-5 text-gray-500 transition-transform"
            [class.rotate-90]="showTotal()"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
              clip-rule="evenodd"
            />
          </svg>
          Total size
        </button>
      </h3>
      <p class="text-gray-500 text-sm mb-6">How much space do <strong class="text-gray-600">n</strong> records take?</p>

      @if (showTotal()) {
        <div class="flex flex-col sm:flex-row gap-3 mb-6">
          <div class="flex flex-col gap-1 flex-1">
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Record size</label>
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
              @for (u of units; track u.label) {
                <option [value]="u.label" [selected]="u.label === unit()">{{ u.label }}</option>
              }
            </select>
          </div>
          <div class="flex flex-col gap-1 flex-1">
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Records{{ records() !== null ? ' (n = ' + recordsInWords() + ')' : '' }}
            </label>
            <input
              type="text"
              inputmode="decimal"
              [value]="recordsText()"
              (input)="onRecordsChange($event)"
              placeholder="e.g. 100M, 2.5K or 1,000,000"
              class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
            />
            <span class="text-xs text-gray-400">K = thousand, M = million, B = billion, T = trillion</span>
          </div>
        </div>

        <div class="overflow-x-auto rounded-xl border border-gray-200 mb-6">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200">
                <th class="text-left px-4 py-3 font-semibold text-gray-600">Unit</th>
                <th class="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.name) {
                <tr class="border-b border-gray-100 last:border-0">
                  <td class="px-4 py-3 text-gray-600">{{ row.name }}</td>
                  <td
                    class="px-4 py-3 text-right font-mono whitespace-nowrap"
                    [class]="row.best ? 'font-semibold text-gray-600' : 'text-gray-500'"
                  >
                    {{ row.formatted }}
                  </td>
                </tr>
              }
              @if (rows().length === 0) {
                @for (u of units; track u.label) {
                  <tr class="border-b border-gray-100 last:border-0">
                    <td class="px-4 py-3 text-gray-600">{{ u.name }}</td>
                    <td class="px-4 py-3 text-right text-gray-300">--</td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <div class="mb-6">
          <button
            (click)="showTotalMath.set(!showTotalMath())"
            class="flex items-center gap-1 text-blue-500 text-sm font-medium hover:underline cursor-pointer"
            [attr.aria-expanded]="showTotalMath()"
          >
            <svg
              class="w-5 h-5 transition-transform"
              [class.rotate-90]="showTotalMath()"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                clip-rule="evenodd"
              />
            </svg>
            Math
          </button>
          @if (showTotalMath()) {
            <div class="overflow-x-auto rounded-xl border border-gray-200 mt-3">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-200">
                    <th class="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Case</th>
                    <th class="text-left px-4 py-3 font-semibold text-gray-600">How it's solved</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of totalMath(); track row.label) {
                    <tr class="border-b border-gray-100 last:border-0">
                      <td class="px-4 py-3 text-gray-500 whitespace-nowrap align-top">
                        <div>{{ row.label }}</div>
                        @for (line of row.legend; track $index) {
                          <div class="text-xs text-gray-400 font-mono mt-1">{{ line }}</div>
                        }
                      </td>
                      <td class="px-4 py-3 font-mono text-xs text-gray-600">
                        @for (step of row.work; track $index; let first = $first; let last = $last) {
                          <div [class]="last && !first ? 'font-semibold' : ''">{{ first ? '' : '= ' }}{{ step }}</div>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }

      <h3 class="mb-1">
        <button
          (click)="showSample.set(!showSample())"
          class="flex items-center gap-1 text-gray-800 text-lg font-bold cursor-pointer"
          [attr.aria-expanded]="showSample()"
        >
          <svg
            class="w-5 h-5 text-gray-500 transition-transform"
            [class.rotate-90]="showSample()"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
              clip-rule="evenodd"
            />
          </svg>
          Measure a sample
        </button>
      </h3>
      <p class="text-gray-500 text-sm mb-6">How many bytes is one record?</p>

      @if (showSample()) {
        <div class="flex flex-col gap-1 mb-6">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Sample record</label>
          <textarea
            rows="4"
            [value]="sampleText()"
            (input)="onSampleChange($event)"
            placeholder="Paste a JSON payload, CSV row, log line..."
            class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
          ></textarea>
        </div>

        <div class="overflow-x-auto rounded-xl border border-gray-200 mb-6">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200">
                <th class="text-left px-4 py-3 font-semibold text-gray-600">Measure</th>
                <th class="text-right px-4 py-3 font-semibold text-gray-600">
                  <span class="flex items-center justify-end gap-2">
                    @if (sample(); as s) {
                      <button
                        (click)="useSample(s.bytes)"
                        class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors whitespace-nowrap"
                      >
                        Use as record size
                      </button>
                    }
                    Value
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-b border-gray-100">
                <td class="px-4 py-3 text-gray-600">Characters</td>
                <td class="px-4 py-3 text-right font-mono text-gray-500">
                  {{ sample() ? fmt(sample()!.chars) : '--' }}
                </td>
              </tr>
              <tr>
                <td class="px-4 py-3 text-gray-600">Bytes (UTF-8)</td>
                <td class="px-4 py-3 text-right font-mono font-semibold text-gray-600">
                  {{ sample() ? fmt(sample()!.bytes) : '--' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mb-6">
          <button
            (click)="showSampleMath.set(!showSampleMath())"
            class="flex items-center gap-1 text-blue-500 text-sm font-medium hover:underline cursor-pointer"
            [attr.aria-expanded]="showSampleMath()"
          >
            <svg
              class="w-5 h-5 transition-transform"
              [class.rotate-90]="showSampleMath()"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                clip-rule="evenodd"
              />
            </svg>
            Math
          </button>
          @if (showSampleMath()) {
            <div class="overflow-x-auto rounded-xl border border-gray-200 mt-3">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-200">
                    <th class="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Case</th>
                    <th class="text-left px-4 py-3 font-semibold text-gray-600">How it's solved</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="px-4 py-3 text-gray-500 whitespace-nowrap align-top">
                      <div>Bytes (UTF-8)</div>
                      <div class="text-xs text-gray-400 font-mono mt-1">A-Z, 0-9 = 1 byte</div>
                      <div class="text-xs text-gray-400 font-mono mt-1">é, ñ = 2 bytes</div>
                      <div class="text-xs text-gray-400 font-mono mt-1">€, 中 = 3 bytes</div>
                      <div class="text-xs text-gray-400 font-mono mt-1">emoji = 4 bytes</div>
                    </td>
                    <td class="px-4 py-3 font-mono text-xs text-gray-600">
                      @for (step of sampleWork(); track $index; let first = $first; let last = $last) {
                        <div [class]="last && !first ? 'font-semibold' : ''">{{ first ? '' : '= ' }}{{ step }}</div>
                      }
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          }
        </div>
      }

      <h3 class="mb-1">
        <button
          (click)="showReference.set(!showReference())"
          class="flex items-center gap-1 text-gray-800 text-lg font-bold cursor-pointer"
          [attr.aria-expanded]="showReference()"
        >
          <svg
            class="w-5 h-5 text-gray-500 transition-transform"
            [class.rotate-90]="showReference()"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
              clip-rule="evenodd"
            />
          </svg>
          Quick reference
        </button>
      </h3>
      <p class="text-gray-500 text-sm mb-6">Common record sizes × record counts.</p>

      @if (showReference()) {
        <div class="overflow-x-auto rounded-xl border border-gray-200">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200">
                <th class="text-left px-4 py-3 font-semibold text-gray-600">Size</th>
                @for (c of referenceCounts; track c.label) {
                  <th class="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">× {{ c.label }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (r of referenceRows; track r.label) {
                <tr class="border-b border-gray-100 last:border-0">
                  <td class="px-4 py-3 text-gray-600 whitespace-nowrap">{{ r.label }}</td>
                  @for (cell of r.cells; track $index) {
                    <td class="px-4 py-3 text-right font-mono text-gray-500 whitespace-nowrap">{{ cell }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </main>
  `
})
export class ByteSizeCalculator {
  readonly fmt = formatValue;
  readonly size = signal<number | null>(10);
  readonly unit = signal('KB');
  readonly recordsText = signal('100M');
  readonly sampleText = signal('');
  readonly showTotal = signal(true);
  readonly showSample = signal(false);
  readonly showReference = signal(false);
  readonly showTotalMath = signal(false);
  readonly showSampleMath = signal(false);

  readonly units = UNITS;
  readonly referenceCounts = REFERENCE_COUNTS;
  readonly referenceRows = REFERENCE_SIZES.map((s) => ({
    label: s.label,
    cells: REFERENCE_COUNTS.map((c) => humanize(s.bytes * c.count))
  }));

  readonly records = computed(() => parseRecords(this.recordsText()));
  readonly recordsInWords = computed(() => inWords(this.records() ?? 0));

  readonly total = computed<number | null>(() => {
    const s = this.size();
    const n = this.records();
    if (s === null || s <= 0 || n === null || n <= 0) return null;
    return s * UNITS.find((u) => u.label === this.unit())!.bytes * n;
  });

  readonly rows = computed<SizeRow[]>(() => {
    const total = this.total();
    if (total === null) return [];
    const best = bestUnitIndex(total);
    return UNITS.map((u, i) => ({
      name: u.name,
      formatted: `${formatValue(total / u.bytes)} ${u.label}`,
      best: i === best
    }));
  });

  // Formula first, then the numbers plugged in step by step; just the formula until the inputs are valid
  readonly totalMath = computed(() => {
    const total = this.total();
    const unit = UNITS.find((u) => u.label === this.unit())!;
    if (total === null) {
      return [
        {
          label: 'Total in bytes',
          legend: [`1 ${unit.label} = ${formatValue(unit.bytes)} B`],
          work: ['record size × n']
        },
        { label: 'Most readable unit', legend: [], work: ['bytes ÷ bytes per unit'] }
      ];
    }
    const best = UNITS[bestUnitIndex(total)];
    const size = formatValue(this.size()!);
    const n = formatValue(this.records()!);
    return [
      {
        label: 'Total in bytes',
        legend: [`1 ${unit.label} = ${formatValue(unit.bytes)} B`, `n = ${n}`],
        work: [
          'record size × n',
          `${size} ${unit.label} × ${n}`,
          ...(unit.bytes === 1 ? [] : [`${size} × ${formatValue(unit.bytes)} B × ${n}`]),
          `${formatValue(total)} B`
        ]
      },
      {
        label: 'Most readable unit',
        legend: [`1 ${best.label} = ${formatValue(best.bytes)} B`],
        work: [
          `bytes ÷ bytes per ${best.label}`,
          `${formatValue(total)} ÷ ${formatValue(best.bytes)}`,
          `${formatValue(total / best.bytes)} ${best.label}`
        ]
      }
    ];
  });

  readonly sample = computed(() => {
    const chars = [...this.sampleText()];
    if (chars.length === 0) return null;

    // Count characters by how many bytes UTF-8 needs for each
    const byLength = [0, 0, 0, 0];
    for (const char of chars) byLength[utf8Length(char) - 1]++;
    const groups = byLength.map((count, i) => ({ count, size: i + 1 })).filter((g) => g.count > 0);
    const bytes = groups.reduce((acc, g) => acc + g.count * g.size, 0);

    return {
      chars: chars.length,
      bytes,
      work: [
        SAMPLE_FORMULA,
        groups.map((g) => `${formatValue(g.count)} × ${g.size}`).join(' + '),
        groups.map((g) => formatValue(g.count * g.size)).join(' + '),
        `${formatValue(bytes)} bytes`
      ].filter((step, i, steps) => step !== steps[i - 1])
    };
  });

  // Just the formula until there is a sample to measure
  readonly sampleWork = computed(() => this.sample()?.work ?? [SAMPLE_FORMULA]);

  onSizeChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.size.set(val === '' ? null : Number(val));
  }

  onUnitChange(event: Event): void {
    this.unit.set((event.target as HTMLSelectElement).value);
  }

  onRecordsChange(event: Event): void {
    this.recordsText.set((event.target as HTMLInputElement).value);
  }

  onSampleChange(event: Event): void {
    this.sampleText.set((event.target as HTMLTextAreaElement).value);
  }

  useSample(bytes: number): void {
    this.size.set(bytes);
    this.unit.set('B');
    this.showTotal.set(true);
  }
}

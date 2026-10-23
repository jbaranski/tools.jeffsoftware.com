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

const SCALES: { name: string; decimal: string; binary: string }[] = [
  { name: 'Byte', decimal: 'B', binary: 'B' },
  { name: 'Kilobyte', decimal: 'KB', binary: 'KiB' },
  { name: 'Megabyte', decimal: 'MB', binary: 'MiB' },
  { name: 'Gigabyte', decimal: 'GB', binary: 'GiB' },
  { name: 'Terabyte', decimal: 'TB', binary: 'TiB' },
  { name: 'Petabyte', decimal: 'PB', binary: 'PiB' }
];

const REFERENCE_SIZES: { label: string; bytes: number }[] = [
  { label: '100 B', bytes: 100 },
  { label: '1 KB', bytes: 1e3 },
  { label: '10 KB', bytes: 1e4 },
  { label: '100 KB', bytes: 1e5 },
  { label: '1 MB', bytes: 1e6 },
  { label: '10 MB', bytes: 1e7 }
];

const REFERENCE_COUNTS: { label: string; count: number }[] = [
  { label: '1K', count: 1e3 },
  { label: '10K', count: 1e4 },
  { label: '100K', count: 1e5 },
  { label: '1M', count: 1e6 },
  { label: '10M', count: 1e7 },
  { label: '100M', count: 1e8 },
  { label: '1B', count: 1e9 }
];

function formatValue(n: number): string {
  if (!isFinite(n) || n === 0) return '0';
  // Cap significant digits so float noise (e.g. 1e24 -> 999,999,...,784) never shows up
  if (n >= 1e15) return n.toLocaleString('en-US', { maximumSignificantDigits: 15 });
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { maximumSignificantDigits: 4 });
}

function humanize(bytes: number): string {
  let i = 0;
  while (i < SCALES.length - 1 && bytes >= 1000 ** (i + 1)) i++;
  const value = (bytes / 1000 ** i).toLocaleString('en-US', { maximumSignificantDigits: 3 });
  return `${value} ${SCALES[i].decimal}`;
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
          Enter a size, its unit, and a multiplier (e.g. a record count). See the total in bytes through petabytes -- in
          both decimal (1000) and binary (1024) units.
        </p>
      </div>

      <div class="flex flex-col sm:flex-row gap-3">
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
            [value]="unit()"
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

        <div class="flex flex-col gap-1 flex-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">× Multiplier</label>
          <input
            type="number"
            min="0"
            [value]="multiplier()"
            (input)="onMultiplierChange($event)"
            placeholder="e.g. 100000000"
            class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
          />
        </div>
      </div>

      <div class="overflow-x-auto rounded-xl border border-gray-200">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="text-left px-4 py-3 font-semibold text-gray-600 w-28">Unit</th>
              <th class="text-right px-4 py-3 font-semibold text-gray-600">Decimal (1000)</th>
              <th class="text-right px-4 py-3 font-semibold text-gray-600">Binary (1024)</th>
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
            @for (row of rows(); track row.name) {
              <tr class="border-b border-gray-100 last:border-0">
                <td class="px-4 py-3 text-gray-500 font-medium">{{ row.name }}</td>
                <td class="px-4 py-3 text-right font-mono font-semibold text-gray-800 whitespace-nowrap">
                  {{ row.decimal }}
                </td>
                <td class="px-4 py-3 text-right font-mono text-gray-500 whitespace-nowrap">{{ row.binary }}</td>
                <td class="px-4 py-3 text-right">
                  <button
                    (click)="copyRow(row)"
                    class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors"
                  >
                    {{ copiedRow() === row.name ? 'Copied!' : 'Copy' }}
                  </button>
                </td>
              </tr>
            }
            @if (rows().length === 0) {
              @for (scale of scales; track scale.name) {
                <tr class="border-b border-gray-100 last:border-0">
                  <td class="px-4 py-3 text-gray-500 font-medium">{{ scale.name }}</td>
                  <td class="px-4 py-3 text-right text-gray-300">--</td>
                  <td class="px-4 py-3 text-right text-gray-300">--</td>
                  <td class="px-4 py-3"></td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <div>
        <h3 class="text-gray-800 text-lg font-bold mb-1">Quick reference</h3>
        <p class="text-gray-500 text-sm">
          Record size × record count, in decimal units. A 10 KB record × 100M records is 1 TB.
        </p>
      </div>

      <div class="overflow-x-auto rounded-xl border border-gray-200">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap sticky left-0 bg-gray-50">
                Size × Count
              </th>
              @for (c of referenceCounts; track c.label) {
                <th class="text-right px-3 py-3 font-semibold text-gray-600">{{ c.label }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (r of referenceRows; track r.label) {
              <tr class="border-b border-gray-100 last:border-0">
                <td class="px-3 py-3 text-gray-500 font-medium whitespace-nowrap sticky left-0 bg-white">
                  {{ r.label }}
                </td>
                @for (cell of r.cells; track $index) {
                  <td class="px-3 py-3 text-right font-mono text-gray-800 whitespace-nowrap">{{ cell }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </main>
  `
})
export class ByteSizeCalculator {
  readonly size = signal<number | null>(null);
  readonly unit = signal<InputUnit>('KB');
  readonly multiplier = signal<number>(1);
  readonly copiedRow = signal<string | null>(null);
  readonly copiedAll = signal(false);

  readonly scales = SCALES;
  readonly decimalUnits: InputUnit[] = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  readonly binaryUnits: InputUnit[] = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  readonly referenceCounts = REFERENCE_COUNTS;
  readonly referenceRows = REFERENCE_SIZES.map((s) => ({
    label: s.label,
    cells: REFERENCE_COUNTS.map((c) => humanize(s.bytes * c.count))
  }));

  readonly rows = computed<SizeRow[]>(() => {
    const s = this.size();
    const m = this.multiplier();

    if (s === null || s <= 0 || m <= 0) return [];

    const totalBytes = s * INPUT_UNIT_BYTES[this.unit()] * m;

    return SCALES.map((scale, i) => ({
      name: scale.name,
      decimal: `${formatValue(totalBytes / 1000 ** i)} ${scale.decimal}`,
      binary: `${formatValue(totalBytes / 1024 ** i)} ${scale.binary}`
    }));
  });

  onSizeChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.size.set(val === '' ? null : Number(val));
  }

  onUnitChange(event: Event): void {
    this.unit.set((event.target as HTMLSelectElement).value as InputUnit);
  }

  onMultiplierChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.multiplier.set(val === '' ? 1 : Number(val));
  }

  async copyRow(row: SizeRow): Promise<void> {
    try {
      await navigator.clipboard.writeText(`${row.decimal} (${row.binary})`);
      this.copiedRow.set(row.name);
      setTimeout(() => this.copiedRow.set(null), 2000);
    } catch {}
  }

  async copyAll(): Promise<void> {
    const text = this.rows()
      .map((r) => `${r.name}: ${r.decimal} (${r.binary})`)
      .join('\n');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copiedAll.set(true);
      setTimeout(() => this.copiedAll.set(false), 2000);
    } catch {}
  }
}

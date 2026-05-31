import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALE = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion'];

function threeDigitsToWords(n: number): string {
  if (n === 0) return '';
  let result = '';
  if (n >= 100) {
    result += ONES[Math.floor(n / 100)] + ' hundred';
    n %= 100;
    if (n > 0) result += ' ';
  }
  if (n >= 20) {
    result += TENS[Math.floor(n / 10)];
    if (n % 10 > 0) result += '-' + ONES[n % 10];
  } else if (n > 0) {
    result += ONES[n];
  }
  return result;
}

function numberToWords(n: number): string {
  const int = Math.floor(Math.abs(n));
  if (int === 0) return 'zero';
  const prefix = n < 0 ? 'negative ' : '';
  const chunks: number[] = [];
  let remaining = int;
  while (remaining > 0) {
    chunks.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }
  const parts: string[] = [];
  for (let i = chunks.length - 1; i >= 0; i--) {
    if (chunks[i] === 0) continue;
    const words = threeDigitsToWords(chunks[i]);
    parts.push(SCALE[i] ? words + ' ' + SCALE[i] : words);
  }
  return prefix + parts.join(', ');
}

function formatNumber(n: number): string {
  if (!isFinite(n)) return '0';
  const fixed = parseFloat(n.toFixed(2));
  const [intPart, decPart] = fixed.toString().split('.');
  const withCommas = parseInt(intPart, 10).toLocaleString('en-US');
  return decPart && decPart !== '00' ? withCommas + '.' + decPart : withCommas;
}

interface TpsRow {
  label: string;
  value: number;
  formatted: string;
  words: string;
}

type TimeUnit = 'second' | 'minute' | 'hour' | 'day';

const UNIT_SECONDS: Record<TimeUnit, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 86400,
};

@Component({
  selector: 'app-tps',
  imports: [RouterLink, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mt-4 max-w-2xl">
      <a routerLink="/" class="text-blue-500 text-sm hover:underline mb-6 inline-block">← All tools</a>

      <h2 class="text-gray-800 text-2xl font-bold mb-1">TPS Calculator</h2>
      <p class="text-gray-500 text-sm mb-6">
        Enter a count and the time window it occurred in. See the throughput per second, minute, hour, and day — as a number and in words.
      </p>

      <div class="flex flex-col sm:flex-row gap-3 mb-8">
        <div class="flex flex-col gap-1 flex-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Count</label>
          <input
            type="number"
            min="0"
            step="1"
            [ngModel]="count()"
            (ngModelChange)="count.set($event)"
            placeholder="e.g. 1000000"
            class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Per (quantity)</label>
          <input
            type="number"
            min="1"
            step="1"
            [ngModel]="uotQty()"
            (ngModelChange)="uotQty.set($event)"
            class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Unit</label>
          <select
            [ngModel]="uotUnit()"
            (ngModelChange)="uotUnit.set($event)"
            class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-white"
          >
            <option value="second">second</option>
            <option value="minute">minute</option>
            <option value="hour">hour</option>
            <option value="day">day</option>
          </select>
        </div>
      </div>

      <div class="overflow-x-auto rounded-xl border border-gray-200">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="text-left px-4 py-3 font-semibold text-gray-600 w-28">Per</th>
              <th class="text-right px-4 py-3 font-semibold text-gray-600">Value</th>
              <th class="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">In words</th>
              <th class="px-4 py-3 w-20">
                <button
                  (click)="copyAll()"
                  class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors float-right"
                >{{ copiedAll() ? 'Copied!' : 'Copy all' }}</button>
              </th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.label) {
              <tr class="border-b border-gray-100 last:border-0">
                <td class="px-4 py-3 text-gray-500 font-medium">{{ row.label }}</td>
                <td class="px-4 py-3 text-right font-mono font-semibold text-gray-800">{{ row.formatted }}</td>
                <td class="px-4 py-3 text-gray-500 italic hidden sm:table-cell">{{ row.words }}</td>
                <td class="px-4 py-3 text-right">
                  <button
                    (click)="copyRow(row)"
                    class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors"
                  >{{ copiedRow() === row.label ? 'Copied!' : 'Copy' }}</button>
                </td>
              </tr>
              <tr class="sm:hidden border-b border-gray-100 last:border-0 bg-gray-50">
                <td colspan="3" class="px-4 pb-3 text-gray-400 italic text-xs">{{ row.words }}</td>
              </tr>
            }
            @if (rows().length === 0) {
              @for (_ of emptyRows; track $index) {
                <tr class="border-b border-gray-100 last:border-0">
                  <td class="px-4 py-3 text-gray-300">—</td>
                  <td class="px-4 py-3"></td>
                  <td class="px-4 py-3 hidden sm:table-cell"></td>
                  <td class="px-4 py-3"></td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </main>
  `
})
export class TpsCalculator {
  readonly count = signal<number | null>(null);
  readonly uotQty = signal<number>(1);
  readonly uotUnit = signal<TimeUnit>('minute');
  readonly copiedRow = signal<string | null>(null);
  readonly copiedAll = signal(false);

  readonly emptyRows = Array(4).fill(null);

  readonly rows = computed<TpsRow[]>(() => {
    const c = this.count();
    const qty = this.uotQty();
    const unit = this.uotUnit();

    if (c === null || c <= 0 || qty <= 0) return [];

    const totalSeconds = qty * UNIT_SECONDS[unit];
    const perSecond = c / totalSeconds;

    const intervals: { label: string; multiplier: number }[] = [
      { label: 'second', multiplier: 1 },
      { label: 'minute', multiplier: 60 },
      { label: 'hour', multiplier: 3600 },
      { label: 'day', multiplier: 86400 },
    ];

    return intervals.map(({ label, multiplier }) => {
      const value = perSecond * multiplier;
      return {
        label,
        value,
        formatted: formatNumber(value),
        words: numberToWords(value),
      };
    });
  });

  async copyRow(row: TpsRow): Promise<void> {
    try {
      await navigator.clipboard.writeText(`${row.label}: ${row.formatted}`);
      this.copiedRow.set(row.label);
      setTimeout(() => this.copiedRow.set(null), 2000);
    } catch {}
  }

  async copyAll(): Promise<void> {
    const text = this.rows().map(r => `${r.label}: ${r.formatted}`).join('\n');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copiedAll.set(true);
      setTimeout(() => this.copiedAll.set(false), 2000);
    } catch {}
  }
}

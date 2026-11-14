import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

// Exact integer math (BigInt) keeps results like 52! precise instead of rounding to floats
const MAX_N = 1000;

function factorial(n: number): bigint {
  let result = 1n;
  for (let i = 2; i <= n; i++) result *= BigInt(i);
  return result;
}

// n! / (n - r)!
function permutations(n: number, r: number): bigint {
  if (r > n) return 0n;
  let result = 1n;
  for (let i = n - r + 1; i <= n; i++) result *= BigInt(i);
  return result;
}

// n! / (r! (n - r)!) -- each intermediate step is itself a binomial coefficient, so division stays exact
function combinations(n: number, r: number): bigint {
  if (r > n) return 0n;
  const k = Math.min(r, n - r);
  let result = 1n;
  for (let i = 1; i <= k; i++) result = (result * BigInt(n - k + i)) / BigInt(i);
  return result;
}

// Short form past 15 digits (rounded to 3 significant digits), commas otherwise
function display(n: bigint): string {
  const digits = n.toString();
  if (digits.length <= 15) return n.toLocaleString('en-US');
  let exponent = digits.length - 1;
  let mantissa = Math.round(Number(digits.slice(0, 4)) / 10);
  if (mantissa === 1000) {
    mantissa = 100;
    exponent++;
  }
  const m = String(mantissa);
  return `≈ ${m[0]}.${m.slice(1)} × 10^${exponent}`;
}

// One item per character, or split on commas / spaces when present
function parseItems(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  if (/\s/.test(trimmed)) return trimmed.split(/\s+/);
  return [...trimmed];
}

interface CountRow {
  label: string;
  example: string;
  value: bigint;
}

@Component({
  selector: 'app-combinatorics',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mt-4 max-w-2xl">
      <a routerLink="/" class="text-blue-500 text-sm hover:underline mb-6 inline-block">← All tools</a>

      <h2 class="text-gray-800 text-2xl font-bold mb-1">Combinatorics Calculator</h2>
      <p class="text-gray-500 text-sm mb-6">
        Pick r things from n options. See how many possibilities there are, depending on whether order and repeats
        matter.
      </p>

      <div class="flex flex-col sm:flex-row gap-3 mb-6">
        <div class="flex flex-col gap-1 flex-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Options (n)</label>
          <input
            type="number"
            min="0"
            [max]="maxN"
            step="1"
            [value]="n() ?? ''"
            (input)="n.set(num($event))"
            placeholder="e.g. 10"
            class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
          />
        </div>
        <div class="flex flex-col gap-1 flex-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Pick (r)</label>
          <input
            type="number"
            min="0"
            [max]="maxN"
            step="1"
            [value]="r() ?? ''"
            (input)="r.set(num($event))"
            placeholder="e.g. 6"
            class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
          />
        </div>
      </div>

      <div class="overflow-x-auto rounded-xl border border-gray-200 mb-6">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="text-left px-4 py-3 font-semibold text-gray-600">Order / repeats</th>
              <th class="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Like</th>
              <th class="text-right px-4 py-3 font-semibold text-gray-600">Possibilities</th>
              <th class="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.label) {
              <tr class="border-b border-gray-100 last:border-0">
                <td class="px-4 py-3 text-gray-500 font-medium">{{ row.label }}</td>
                <td class="px-4 py-3 text-gray-500 italic hidden sm:table-cell">{{ row.example }}</td>
                <td class="px-4 py-3 text-right font-mono font-semibold text-gray-800 whitespace-nowrap">
                  {{ display(row.value) }}
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    (click)="copy(row.label, row.value)"
                    class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors"
                  >
                    {{ copied() === row.label ? 'Copied!' : 'Copy' }}
                  </button>
                </td>
              </tr>
            }
            @if (rows().length === 0) {
              @for (label of rowLabels; track label) {
                <tr class="border-b border-gray-100 last:border-0">
                  <td class="px-4 py-3 text-gray-500 font-medium">{{ label }}</td>
                  <td class="px-4 py-3 hidden sm:table-cell"></td>
                  <td class="px-4 py-3 text-right text-gray-300">--</td>
                  <td class="px-4 py-3"></td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <div class="flex flex-col gap-1 mb-6">
        <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Arrange these items</label>
        <input
          type="text"
          [value]="itemsText()"
          (input)="onItemsChange($event)"
          placeholder="e.g. 123456, 112233, or red, red, blue"
          class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
        />
      </div>

      <div class="overflow-x-auto rounded-xl border border-gray-200">
        <table class="w-full text-sm">
          <tbody>
            <tr>
              <td class="px-4 py-3 text-gray-500 font-medium">Different orders</td>
              <td class="px-4 py-3 text-right font-mono font-semibold text-gray-800 whitespace-nowrap">
                @if (arrangements(); as a) {
                  {{ display(a) }}
                } @else {
                  <span class="text-gray-300 font-normal">--</span>
                }
              </td>
              <td class="px-4 py-3 text-right w-16">
                @if (arrangements(); as a) {
                  <button
                    (click)="copy('arrange', a)"
                    class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors"
                  >
                    {{ copied() === 'arrange' ? 'Copied!' : 'Copy' }}
                  </button>
                }
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  `
})
export class Combinatorics {
  readonly maxN = MAX_N;
  readonly display = display;
  readonly n = signal<number | null>(10);
  readonly r = signal<number | null>(6);
  readonly itemsText = signal('123456');
  readonly copied = signal<string | null>(null);

  readonly rowLabels = [
    'Order matters, repeats OK',
    'Order matters, no repeats',
    'Any order, repeats OK',
    'Any order, no repeats'
  ];

  readonly rows = computed<CountRow[]>(() => {
    const n = this.n();
    const r = this.r();
    const valid = (x: number | null): x is number => x !== null && Number.isInteger(x) && x >= 0 && x <= MAX_N;
    if (!valid(n) || !valid(r)) return [];

    const values = [
      BigInt(n) ** BigInt(r),
      permutations(n, r),
      n === 0 ? (r === 0 ? 1n : 0n) : combinations(n + r - 1, r),
      combinations(n, r)
    ];
    const examples = ['a PIN code', 'a race podium', 'ice cream scoops', 'lottery numbers'];
    return this.rowLabels.map((label, i) => ({ label, example: examples[i], value: values[i] }));
  });

  // n! divided by k! for each item that appears k times
  readonly arrangements = computed<bigint | null>(() => {
    const items = parseItems(this.itemsText());
    if (items.length === 0 || items.length > MAX_N) return null;
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
    let result = factorial(items.length);
    for (const count of counts.values()) result /= factorial(count);
    return result;
  });

  num(event: Event): number | null {
    const val = (event.target as HTMLInputElement).value;
    return val === '' ? null : Number(val);
  }

  onItemsChange(event: Event): void {
    this.itemsText.set((event.target as HTMLInputElement).value);
  }

  async copy(key: string, value: bigint): Promise<void> {
    try {
      await navigator.clipboard.writeText(value.toString());
      this.copied.set(key);
      setTimeout(() => this.copied.set(null), 2000);
    } catch {}
  }
}

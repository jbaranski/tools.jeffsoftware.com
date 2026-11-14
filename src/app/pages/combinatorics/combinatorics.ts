import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

// Exact integer math (BigInt) keeps results like 52! precise instead of rounding to floats
const MAX_N = 1000;
const EXAMPLE_COUNT = 5;
const MAX_EXAMPLE_ITEMS = 24;
const MAX_WRITTEN_TERMS = 8;

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

// "5 × 4 × 3": `count` descending terms starting at `from`, shortened with … when long
function product(from: number, count: number): string {
  if (count === 0) return '1';
  const terms = Array.from({ length: count }, (_, i) => from - i);
  if (count <= MAX_WRITTEN_TERMS) return terms.join(' × ');
  return `${terms.slice(0, 3).join(' × ')} × … × ${terms.slice(-2).join(' × ')}`;
}

function subscript(n: number): string {
  return String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]);
}

// Multiply terms together, adding parentheses only when there is more than one
function group(terms: string[]): string {
  return terms.length === 1 ? terms[0] : `(${terms.join(' × ')})`;
}

function wrap(expr: string): string {
  return expr.includes(' ') ? `(${expr})` : expr;
}

// With commas, each comma-separated value is one item, keeping only its ASCII letters and digits ("10, 21" -> 10, 21).
// Without commas, each ASCII letter or digit is one item ("ABC" -> A, B, C). Everything else is ignored.
function parseItems(text: string): string[] {
  if (text.includes(',')) {
    return text
      .split(',')
      .map((part) => part.replace(/[^A-Za-z0-9]/g, ''))
      .filter((part) => part.length > 0);
  }
  return text.match(/[A-Za-z0-9]/g) ?? [];
}

function randomIndex(n: number): number {
  return Math.floor(Math.random() * n);
}

// First r of a random shuffle of 0..n-1
function randomDistinct(n: number, r: number): number[] {
  const pool = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < r; i++) {
    const j = i + randomIndex(n - i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, r);
}

// Up to EXAMPLE_COUNT distinct samples, sorted so small cases read in a natural order
function sampleExamples(draw: () => number[], total: bigint): number[][] {
  const want = total < BigInt(EXAMPLE_COUNT) ? Number(total) : EXAMPLE_COUNT;
  const found = new Map<string, number[]>();
  for (let tries = 0; found.size < want && tries < 500; tries++) {
    const sample = draw();
    found.set(sample.join(','), sample);
  }
  return [...found.values()].sort((a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  });
}

function formatExample(items: string[], indexes: number[]): string {
  const shown = indexes.slice(0, MAX_EXAMPLE_ITEMS).map((i) => items[i]);
  // Single characters read fine run together (AB); longer items need separating (10, 21)
  const joiner = items.every((item) => item.length === 1) ? '' : ', ';
  return shown.join(joiner) + (indexes.length > MAX_EXAMPLE_ITEMS ? '…' : '');
}

interface CountRow {
  order: boolean;
  repeats: boolean;
  value: bigint;
  examples: string[];
  // Formula first, then the same formula with the numbers in, simplified step by step to the answer
  work: string[];
}

@Component({
  selector: 'app-combinatorics',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mt-4 max-w-2xl">
      <a routerLink="/" class="text-blue-500 text-sm hover:underline mb-6 inline-block">← All tools</a>

      <h2 class="text-gray-800 text-2xl font-bold mb-6">Combinatorics Calculator</h2>

      <h3 class="text-gray-800 text-lg font-bold mb-1">Pick from options</h3>
      <p class="text-gray-500 text-sm mb-6">
        How many ways can you pick <strong class="text-gray-600">r</strong> items from
        <strong class="text-gray-600">n</strong> options?
      </p>

      <div class="flex flex-col sm:flex-row gap-3 mb-6">
        <div class="flex flex-col gap-1 sm:w-28">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Pick (r)</label>
          <input
            type="number"
            min="0"
            [max]="maxN"
            step="1"
            [value]="r() ?? ''"
            (input)="onRChange($event)"
            placeholder="e.g. 2"
            class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
          />
        </div>
        <div class="flex flex-col gap-1 flex-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Options (n = {{ options().length }})
          </label>
          <input
            type="text"
            [value]="optionsText()"
            (input)="onOptionsChange($event)"
            placeholder="e.g. ABC, or comma-separated like 10, 21, 35"
            class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 font-mono"
          />
        </div>
      </div>

      <div class="overflow-x-auto rounded-xl border border-gray-200 mb-6">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="text-left px-4 py-3 font-semibold text-gray-600">Order matters</th>
              <th class="text-left px-4 py-3 font-semibold text-gray-600">Repeats allowed</th>
              <th class="text-right px-4 py-3 font-semibold text-gray-600">Possibilities</th>
              <th class="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">
                <span class="flex items-center justify-between gap-2">
                  Examples
                  <button
                    (click)="seed.set(seed() + 1)"
                    class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors whitespace-nowrap"
                  >
                    New examples
                  </button>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track $index) {
              <tr class="border-b border-gray-100 last:border-0">
                <td class="px-4 py-3 text-gray-600">{{ row.order ? 'Yes' : 'No' }}</td>
                <td class="px-4 py-3 text-gray-600">{{ row.repeats ? 'Yes' : 'No' }}</td>
                <td class="px-4 py-3 text-right font-mono font-semibold text-gray-600 whitespace-nowrap">
                  {{ display(row.value) }}
                </td>
                <td class="px-4 py-3 font-mono text-gray-500 text-xs hidden sm:table-cell">
                  {{ row.examples.length > 0 ? list(row.examples) : '--' }}
                </td>
              </tr>
              <tr class="sm:hidden border-b border-gray-100 last:border-0 bg-gray-50">
                <td colspan="3" class="px-4 pb-3 font-mono text-gray-500 text-xs">
                  {{ row.examples.length > 0 ? list(row.examples) : '--' }}
                </td>
              </tr>
            }
            @if (rows().length === 0) {
              @for (_ of emptyRows; track $index) {
                <tr class="border-b border-gray-100 last:border-0">
                  <td class="px-4 py-3 text-gray-300">--</td>
                  <td class="px-4 py-3"></td>
                  <td class="px-4 py-3"></td>
                  <td class="px-4 py-3 hidden sm:table-cell"></td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <div class="mb-6">
        <div class="flex items-center justify-between gap-3">
          <button
            (click)="showPickMath.set(!showPickMath())"
            class="flex items-center gap-1 text-blue-500 text-sm font-medium hover:underline cursor-pointer"
            [attr.aria-expanded]="showPickMath()"
          >
            <svg
              class="w-5 h-5 transition-transform"
              [class.rotate-90]="showPickMath()"
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
          <button
            (click)="seed.set(seed() + 1)"
            class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors whitespace-nowrap sm:hidden"
          >
            New examples
          </button>
        </div>
        @if (showPickMath() && rows().length > 0) {
          <div class="overflow-x-auto rounded-xl border border-gray-200 mt-3">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-gray-50 border-b border-gray-200">
                  <th class="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Case</th>
                  <th class="text-left px-4 py-3 font-semibold text-gray-600">How it's solved</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track $index) {
                  <tr class="border-b border-gray-100 last:border-0">
                    <td class="px-4 py-3 text-gray-500 whitespace-nowrap align-top">
                      <div>Order: {{ row.order ? 'Yes' : 'No' }}</div>
                      <div>Repeats: {{ row.repeats ? 'Yes' : 'No' }}</div>
                      <div class="text-xs text-gray-400 font-mono mt-1">n = {{ options().length }}, r = {{ r() }}</div>
                    </td>
                    <td class="px-4 py-3 font-mono text-xs text-gray-600">
                      @for (step of row.work; track $index; let first = $first; let last = $last) {
                        <div [class]="last ? 'font-semibold' : ''">{{ first ? '' : '= ' }}{{ step }}</div>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <h3 class="text-gray-800 text-lg font-bold mb-1">Arrange items</h3>
      <p class="text-gray-500 text-sm mb-6">
        How many different orders can <strong class="text-gray-600">n</strong> items go in?
      </p>

      <div class="flex flex-col gap-1 mb-6">
        <label class="text-xs font-medium text-gray-500 uppercase tracking-wide"> Items (n = {{ itemCount() }}) </label>
        <input
          type="text"
          [value]="itemsText()"
          (input)="onItemsChange($event)"
          placeholder="e.g. AABC, or comma-separated like 10, 10, 21"
          class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 font-mono"
        />
      </div>

      <div class="overflow-x-auto rounded-xl border border-gray-200 mb-6">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Possibilities</th>
              <th class="text-left px-4 py-3 font-semibold text-gray-600">
                <span class="flex items-center justify-between gap-2">
                  Examples
                  <button
                    (click)="seed.set(seed() + 1)"
                    class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors whitespace-nowrap"
                  >
                    New examples
                  </button>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              @if (arrangement(); as a) {
                <td class="px-4 py-3 text-right font-mono font-semibold text-gray-600 whitespace-nowrap">
                  {{ display(a.value) }}
                </td>
                <td class="px-4 py-3 font-mono text-gray-500 text-xs">{{ list(a.examples) }}</td>
              } @else {
                <td class="px-4 py-3 text-right text-gray-300">--</td>
                <td class="px-4 py-3"></td>
              }
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <div class="flex items-center justify-between gap-3">
          <button
            (click)="showArrangeMath.set(!showArrangeMath())"
            class="flex items-center gap-1 text-blue-500 text-sm font-medium hover:underline cursor-pointer"
            [attr.aria-expanded]="showArrangeMath()"
          >
            <svg
              class="w-5 h-5 transition-transform"
              [class.rotate-90]="showArrangeMath()"
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
        </div>
        @if (showArrangeMath() && arrangement(); as a) {
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
                    <div>{{ a.repeatedCount === 0 ? 'All different' : 'With repeats' }}</div>
                    @for (line of a.legend; track $index) {
                      <div class="text-xs text-gray-400 font-mono mt-1">{{ line }}</div>
                    }
                  </td>
                  <td class="px-4 py-3 font-mono text-xs text-gray-600">
                    @for (step of a.work; track $index; let first = $first; let last = $last) {
                      <div [class]="last ? 'font-semibold' : ''">{{ first ? '' : '= ' }}{{ step }}</div>
                    }
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        }
      </div>
    </main>
  `
})
export class Combinatorics {
  readonly maxN = MAX_N;
  readonly display = display;
  // Each example in its own parentheses: (AB), (BA), (CC)
  readonly list = (examples: string[]) => examples.map((e) => `(${e})`).join(', ');
  readonly emptyRows = Array(4).fill(null);
  readonly r = signal<number | null>(2);
  readonly optionsText = signal('ABC');
  readonly itemsText = signal('AABC');
  // Bumped by "New examples" so the example computeds re-run
  readonly seed = signal(0);
  readonly showPickMath = signal(false);
  readonly showArrangeMath = signal(false);

  // Duplicate options count once
  readonly options = computed(() => [...new Set(parseItems(this.optionsText()))]);
  readonly itemCount = computed(() => parseItems(this.itemsText()).length);

  readonly rows = computed<CountRow[]>(() => {
    this.seed();
    const items = this.options();
    const n = items.length;
    const r = this.r();
    if (n === 0 || n > MAX_N || r === null || !Number.isInteger(r) || r < 0 || r > MAX_N) return [];

    const sortedDraw = (draw: () => number[]) => () => draw().sort((a, b) => a - b);
    const withRepeats = () => Array.from({ length: r }, () => randomIndex(n));
    const distinct = () => randomDistinct(n, r);
    const tooMany = `can't pick ${r} different from ${n}`;

    const powerWork = ['n^r', `${n}^${r}`];
    if (r > 1 && r <= MAX_WRITTEN_TERMS) powerWork.push(Array(r).fill(n).join(' × '));

    const permValue = permutations(n, r);
    const permWork =
      r > n
        ? ['n! / (n − r)!', `0 (${tooMany})`]
        : ['n! / (n − r)!', `${n}! / (${n} − ${r})!`, `${n}! / ${n - r}!`, product(n, r)];

    // C(N, r) cancels to r descending terms from N over r!
    const multiN = n + r - 1;
    const multiValue = combinations(multiN, r);
    const multiWork = [
      '(n + r − 1)! / (r! × (n − 1)!)',
      `(${n} + ${r} − 1)! / (${r}! × (${n} − 1)!)`,
      `${multiN}! / (${r}! × ${n - 1}!)`,
      `${wrap(product(multiN, r))} / ${wrap(product(r, r))}`
    ];

    const combValue = combinations(n, r);
    const combWork =
      r > n
        ? ['n! / (r! × (n − r)!)', `0 (${tooMany})`]
        : [
            'n! / (r! × (n − r)!)',
            `${n}! / (${r}! × (${n} − ${r})!)`,
            `${n}! / (${r}! × ${n - r}!)`,
            `${wrap(product(n, r))} / ${wrap(product(r, r))}`
          ];

    const cases = [
      { order: true, repeats: true, value: BigInt(n) ** BigInt(r), draw: withRepeats, work: powerWork },
      { order: true, repeats: false, value: permValue, draw: distinct, work: permWork },
      { order: false, repeats: true, value: multiValue, draw: sortedDraw(withRepeats), work: multiWork },
      { order: false, repeats: false, value: combValue, draw: sortedDraw(distinct), work: combWork }
    ];

    return cases.map((c) => ({
      order: c.order,
      repeats: c.repeats,
      value: c.value,
      examples: r === 0 ? [] : sampleExamples(c.draw, c.value).map((s) => formatExample(items, s)),
      work: c.work[c.work.length - 1].startsWith('0 (') ? c.work : [...c.work, display(c.value)]
    }));
  });

  // n! divided by k! for each item that appears k times
  readonly arrangement = computed(() => {
    this.seed();
    const items = parseItems(this.itemsText());
    if (items.length === 0 || items.length > MAX_N) return null;

    const counts = new Map<string, number>();
    for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
    const repeated = [...counts.entries()].filter(([, k]) => k > 1);
    const total = factorial(items.length);
    let divisor = 1n;
    for (const [, k] of repeated) divisor *= factorial(k);
    const value = total / divisor;

    const n = items.length;
    const legend = [`n = ${n}`, ...repeated.map(([item, k], i) => `k${subscript(i + 1)} = ${k} (${item} repeats)`)];
    const work =
      repeated.length === 0
        ? ['n!', `${n}!`, product(n, n), display(value)]
        : [
            `n! / ${group(repeated.map((_, i) => `k${subscript(i + 1)}!`))}`,
            `${n}! / ${group(repeated.map(([, k]) => `${k}!`))}`,
            `${wrap(product(n, n))} / ${group(repeated.map(([, k]) => wrap(product(k, k))))}`,
            `${display(total)} / ${display(divisor)}`,
            display(value)
          ];

    // Map each item to the index of its first occurrence so duplicates compare equal
    const unique = [...counts.keys()];
    const indexes = items.map((item) => unique.indexOf(item));
    const shuffle = () => randomDistinct(indexes.length, indexes.length).map((i) => indexes[i]);
    return {
      value,
      work,
      legend,
      repeatedCount: repeated.length,
      examples: sampleExamples(shuffle, value).map((s) => formatExample(unique, s))
    };
  });

  onRChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.r.set(val === '' ? null : Number(val));
  }

  onOptionsChange(event: Event): void {
    this.optionsText.set((event.target as HTMLInputElement).value);
  }

  onItemsChange(event: Event): void {
    this.itemsText.set((event.target as HTMLInputElement).value);
  }
}

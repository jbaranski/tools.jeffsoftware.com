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

// !n = (n - 1)(!(n - 1) + !(n - 2)), with !0 = 1 and !1 = 0
function derangements(n: number): bigint {
  let prev = 1n;
  let curr = 0n;
  if (n === 0) return prev;
  for (let i = 2; i <= n; i++) [prev, curr] = [curr, BigInt(i - 1) * (curr + prev)];
  return curr;
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
// Joins terms with `sep`, shortening long lists to the first 3 and last 2
function abbreviate(terms: string[], sep: string): string {
  if (terms.length <= MAX_WRITTEN_TERMS) return terms.join(sep);
  return `${terms.slice(0, 3).join(sep)}${sep}…${sep}${terms.slice(-2).join(sep)}`;
}

function group(terms: string[]): string {
  return terms.length === 1 ? terms[0] : `(${terms.join(' × ')})`;
}

function dedupeSteps(steps: string[]): string[] {
  return steps.filter((step, i) => step !== steps[i - 1]);
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
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
    return a.length - b.length;
  });
}

function formatExample(items: string[], indexes: number[]): string {
  const shown = indexes.slice(0, MAX_EXAMPLE_ITEMS).map((i) => items[i]);
  // Single characters read fine run together (AB); longer items need separating (10, 21)
  const joiner = items.every((item) => item.length === 1) ? '' : ', ';
  return shown.join(joiner) + (indexes.length > MAX_EXAMPLE_ITEMS ? '…' : '');
}

interface ArrangeRow {
  label: string;
  // null when the case is only worked out for all-different items
  value: bigint | null;
  examples: string[];
  legend: string[];
  work: string[];
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

      <h3 class="mb-1">
        <button
          (click)="showPick.set(!showPick())"
          class="flex items-center gap-1 text-gray-800 text-lg font-bold cursor-pointer"
          [attr.aria-expanded]="showPick()"
        >
          <svg
            class="w-5 h-5 text-gray-500 transition-transform"
            [class.rotate-90]="showPick()"
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
          Pick from options
        </button>
      </h3>
      <p class="text-gray-500 text-sm mb-6">
        How many ways can you pick <strong class="text-gray-600">r</strong> items from
        <strong class="text-gray-600">n</strong> options?
      </p>

      @if (showPick()) {
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
                      (click)="pickSeed.set(pickSeed() + 1)"
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
              (click)="pickSeed.set(pickSeed() + 1)"
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
                        <div class="text-xs text-gray-400 font-mono mt-1">
                          n = {{ options().length }}, r = {{ r() }}
                        </div>
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
      }

      <h3 class="mb-1">
        <button
          (click)="showArrange.set(!showArrange())"
          class="flex items-center gap-1 text-gray-800 text-lg font-bold cursor-pointer"
          [attr.aria-expanded]="showArrange()"
        >
          <svg
            class="w-5 h-5 text-gray-500 transition-transform"
            [class.rotate-90]="showArrange()"
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
          Arrange items
        </button>
      </h3>
      <p class="text-gray-500 text-sm mb-6">
        How many ways can you arrange or group <strong class="text-gray-600">n</strong> items?
      </p>

      @if (showArrange()) {
        <div class="flex flex-col gap-1 mb-6">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Items (n = {{ itemCount() }})</label>
          <input
            type="text"
            [value]="itemsText()"
            (input)="onItemsChange($event)"
            placeholder="e.g. ABCD, or comma-separated like 10, 10, 21"
            class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 font-mono"
          />
        </div>

        <div class="overflow-x-auto rounded-xl border border-gray-200 mb-6">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200">
                <th class="text-left px-4 py-3 font-semibold text-gray-600">Arrangement</th>
                <th class="text-right px-4 py-3 font-semibold text-gray-600">Possibilities</th>
                <th class="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">
                  <span class="flex items-center justify-between gap-2">
                    Examples
                    <button
                      (click)="arrangeSeed.set(arrangeSeed() + 1)"
                      class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors whitespace-nowrap"
                    >
                      New examples
                    </button>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              @for (row of arrangeRows(); track row.label) {
                <tr class="border-b border-gray-100 last:border-0">
                  <td class="px-4 py-3 text-gray-600">
                    {{ row.label }}
                    @if (noteFor(row.label); as note) {
                      <span class="text-xs text-gray-400 ml-1">{{ note }}</span>
                    }
                  </td>
                  <td class="px-4 py-3 text-right font-mono font-semibold text-gray-600 whitespace-nowrap">
                    {{ row.value === null ? '--' : display(row.value) }}
                  </td>
                  <td class="px-4 py-3 font-mono text-gray-500 text-xs hidden sm:table-cell">
                    {{ arrangeExamples(row) }}
                  </td>
                </tr>
                <tr class="sm:hidden border-b border-gray-100 last:border-0 bg-gray-50">
                  <td colspan="2" class="px-4 pb-3 font-mono text-gray-500 text-xs">{{ arrangeExamples(row) }}</td>
                </tr>
              }
              @if (arrangeRows().length === 0) {
                @for (label of arrangeLabels; track label) {
                  <tr class="border-b border-gray-100 last:border-0">
                    <td class="px-4 py-3 text-gray-600">
                      {{ label }}
                      @if (noteFor(label); as note) {
                        <span class="text-xs text-gray-400 ml-1">{{ note }}</span>
                      }
                    </td>
                    <td class="px-4 py-3 text-right text-gray-300">--</td>
                    <td class="px-4 py-3 hidden sm:table-cell"></td>
                  </tr>
                }
              }
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
            <button
              (click)="arrangeSeed.set(arrangeSeed() + 1)"
              class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors whitespace-nowrap sm:hidden"
            >
              New examples
            </button>
          </div>
          @if (showArrangeMath() && arrangeRows().length > 0) {
            <div class="overflow-x-auto rounded-xl border border-gray-200 mt-3">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-200">
                    <th class="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Case</th>
                    <th class="text-left px-4 py-3 font-semibold text-gray-600">How it's solved</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of arrangeRows(); track row.label) {
                    <tr class="border-b border-gray-100 last:border-0">
                      <td class="px-4 py-3 text-gray-500 whitespace-nowrap align-top">
                        <div>
                          {{ row.label }}
                          @if (noteFor(row.label); as note) {
                            <span class="text-xs text-gray-400 ml-1">{{ note }}</span>
                          }
                        </div>
                        @for (line of row.legend; track $index) {
                          <div class="text-xs text-gray-400 font-mono mt-1">{{ line }}</div>
                        }
                      </td>
                      <td class="px-4 py-3 font-mono text-xs text-gray-600">
                        @for (step of row.work; track $index; let first = $first; let last = $last) {
                          <div [class]="last && row.value !== null ? 'font-semibold' : ''">
                            {{ first || row.value === null ? '' : '= ' }}{{ step }}
                          </div>
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
  readonly itemsText = signal('ABCD');
  readonly arrangeLabels = ['In a line', 'In a circle', 'Nothing in its original spot', 'Groups of any size'];
  // Small gray note beside a row name: the constraint that row works under
  readonly noteFor = (label: string): string | null =>
    label === 'In a circle' || label === 'Nothing in its original spot'
      ? 'no repeats'
      : label === 'Groups of any size'
        ? "order doesn't matter"
        : null;
  // Bumped by each section's "New examples" so only that section's examples re-run
  readonly pickSeed = signal(0);
  readonly arrangeSeed = signal(0);
  readonly showPick = signal(true);
  readonly showArrange = signal(false);
  readonly showPickMath = signal(false);
  readonly showArrangeMath = signal(false);

  // Duplicate options count once
  readonly options = computed(() => [...new Set(parseItems(this.optionsText()))]);
  readonly itemCount = computed(() => parseItems(this.itemsText()).length);

  readonly rows = computed<CountRow[]>(() => {
    this.pickSeed();
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
      work: dedupeSteps(c.work[c.work.length - 1].startsWith('0 (') ? c.work : [...c.work, display(c.value)])
    }));
  });

  readonly arrangeRows = computed<ArrangeRow[]>(() => {
    this.arrangeSeed();
    const items = parseItems(this.itemsText());
    const n = items.length;
    if (n === 0 || n > MAX_N) return [];

    const counts = new Map<string, number>();
    for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
    const unique = [...counts.keys()];
    const ks = [...counts.values()];
    const repeated = [...counts.entries()].filter(([, k]) => k > 1);
    const allDifferent = repeated.length === 0;
    // Each item as the index of its first occurrence, so duplicates compare equal
    const indexes = items.map((item) => unique.indexOf(item));
    const examples = (draw: () => number[], value: bigint) =>
      sampleExamples(draw, value).map((sample) => formatExample(unique, sample));
    const needsDifferent = (label: string): ArrangeRow => ({
      label,
      value: null,
      examples: [],
      legend: [],
      work: ['Only worked out when no item repeats']
    });

    // In a line: n! divided by k! for each item that appears k times
    const total = factorial(n);
    let divisor = 1n;
    for (const [, k] of repeated) divisor *= factorial(k);
    const lineValue = total / divisor;
    const line: ArrangeRow = {
      label: 'In a line',
      value: lineValue,
      examples: examples(() => randomDistinct(n, n).map((i) => indexes[i]), lineValue),
      legend: [`n = ${n}`, ...repeated.map(([item, k], i) => `k${subscript(i + 1)} = ${k} (${item} repeats)`)],
      work: allDifferent
        ? ['n!', `${n}!`, product(n, n), display(lineValue)]
        : [
            `n! / ${group(repeated.map((_, i) => `k${subscript(i + 1)}!`))}`,
            `${n}! / ${group(repeated.map(([, k]) => `${k}!`))}`,
            `${wrap(product(n, n))} / ${group(repeated.map(([, k]) => wrap(product(k, k))))}`,
            `${display(total)} / ${display(divisor)}`,
            display(lineValue)
          ]
    };

    // In a circle: fix the first item in place and arrange the rest, so rotations count once
    let circle = needsDifferent('In a circle');
    if (allDifferent) {
      const value = factorial(n - 1);
      const rotated = () => {
        const order = randomDistinct(n, n);
        const start = order.indexOf(0);
        return [...order.slice(start), ...order.slice(0, start)];
      };
      circle = {
        label: 'In a circle',
        value,
        examples: examples(rotated, value),
        legend: [`n = ${n}`, 'rotations count once'],
        work: ['(n − 1)!', `(${n} − 1)!`, `${n - 1}!`, product(n - 1, n - 1), display(value)]
      };
    }

    // Nothing in its original spot: inclusion-exclusion gives n! × (1/0! − 1/1! + 1/2! − … ± 1/n!)
    let derangement = needsDifferent('Nothing in its original spot');
    if (allDifferent) {
      const value = derangements(n);
      const signs = Array.from({ length: n + 1 }, (_, k) => (k % 2 === 0 ? '+' : '−'));
      const fractions = signs.map((sign, k) => `${k === 0 ? '' : `${sign} `}1/${k}!`);
      const terms = signs.map((sign, k) => `${k === 0 ? '' : `${sign} `}${display(factorial(n) / factorial(k))}`);
      const shuffled = () => {
        let order = randomDistinct(n, n);
        for (let tries = 0; tries < 1000 && order.some((v, i) => v === i); tries++) order = randomDistinct(n, n);
        return order;
      };
      derangement = {
        label: 'Nothing in its original spot',
        value,
        examples: examples(shuffled, value),
        legend: [`n = ${n}`, 'no item where you typed it'],
        work: [
          'n! × (1/0! − 1/1! + 1/2! − … ± 1/n!)',
          `${n}! × (${abbreviate(fractions, ' ')})`,
          abbreviate(terms, ' '),
          display(value)
        ]
      };
    }

    // Groups of any size: each item is in or out (2^n); with repeats, take 0 to k copies of each (k + 1 choices)
    const subsetValue = ks.reduce((acc, k) => acc * BigInt(k + 1), 1n);
    // One random group per size, so the examples show the full range from empty to everything
    const sizes =
      n + 1 <= EXAMPLE_COUNT
        ? Array.from({ length: n + 1 }, (_, size) => size)
        : [...new Set([0, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4), n])];
    const subsetExamples = sizes.map((size) =>
      formatExample(
        unique,
        randomDistinct(n, size)
          .map((i) => indexes[i])
          .sort((a, b) => a - b)
      )
    );
    const bySize = Array.from({ length: n + 1 }, (_, size) => size);
    const subsets: ArrangeRow = {
      label: 'Groups of any size',
      value: subsetValue,
      examples: subsetExamples,
      legend: allDifferent
        ? [`n = ${n}`, 'each item in or out']
        : [`n = ${n}`, ...unique.map((item, i) => `k${subscript(i + 1)} = ${ks[i]} (${item})`)],
      // 2^n is the sum of the group counts for every size: C(n, 0) + C(n, 1) + … + C(n, n)
      work: allDifferent
        ? [
            'C(n, 0) + C(n, 1) + … + C(n, n)',
            abbreviate(
              bySize.map((size) => `C(${n}, ${size})`),
              ' + '
            ),
            abbreviate(
              bySize.map((size) => display(combinations(n, size))),
              ' + '
            ),
            `2^${n}`,
            display(subsetValue)
          ]
        : [
            abbreviate(
              ks.map((_, i) => `(k${subscript(i + 1)} + 1)`),
              ' × '
            ),
            abbreviate(
              ks.map((k) => `(${k} + 1)`),
              ' × '
            ),
            abbreviate(
              ks.map((k) => `${k + 1}`),
              ' × '
            ),
            display(subsetValue)
          ]
    };

    return [line, circle, derangement, subsets].map((row) => ({ ...row, work: dedupeSteps(row.work) }));
  });

  arrangeExamples(row: ArrangeRow): string {
    if (row.value === null) return 'Only for items with no repeats';
    return row.examples.length > 0 ? this.list(row.examples) : '--';
  }

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

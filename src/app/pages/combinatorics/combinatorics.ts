import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

// Exact integer math (BigInt) keeps results like 52! precise instead of rounding to floats
const MAX_N = 1000;

const ONES = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen'
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALE = [
  '',
  'thousand',
  'million',
  'billion',
  'trillion',
  'quadrillion',
  'quintillion',
  'sextillion',
  'septillion',
  'octillion',
  'nonillion',
  'decillion'
];

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

// Words for numbers up to the decillions; null beyond that
function bigToWords(n: bigint): string | null {
  if (n === 0n) return 'zero';
  const chunks: number[] = [];
  let remaining = n;
  while (remaining > 0n) {
    chunks.push(Number(remaining % 1000n));
    remaining /= 1000n;
  }
  if (chunks.length > SCALE.length) return null;
  const parts: string[] = [];
  for (let i = chunks.length - 1; i >= 0; i--) {
    if (chunks[i] === 0) continue;
    const words = threeDigitsToWords(chunks[i]);
    parts.push(SCALE[i] ? words + ' ' + SCALE[i] : words);
  }
  return parts.join(', ');
}

// Rounded to 3 significant digits, for numbers too long to read at a glance
function scientific(n: bigint): string | null {
  const digits = n.toString();
  if (digits.length <= 15) return null;
  let exponent = digits.length - 1;
  let mantissa = Math.round(Number(digits.slice(0, 4)) / 10);
  if (mantissa === 1000) {
    mantissa = 100;
    exponent++;
  }
  const m = String(mantissa);
  return `≈ ${m[0]}.${m.slice(1)} × 10^${exponent}`;
}

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

interface Answer {
  exact: string;
  digits: number;
  scientific: string | null;
  words: string | null;
}

function toAnswer(n: bigint): Answer {
  return {
    exact: n.toLocaleString('en-US'),
    digits: n.toString().length,
    scientific: scientific(n),
    // Past 15 digits the words run for lines -- the scientific form is easier to read
    words: n.toString().length <= 15 ? bigToWords(n) : null
  };
}

interface PickCard {
  key: string;
  order: string;
  repeats: string;
  name: string;
  formula: string;
  example: string;
  impossible: string | null;
  answer: Answer;
}

@Component({
  selector: 'app-combinatorics',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mt-4 max-w-2xl space-y-6">
      <a routerLink="/" class="text-blue-500 text-sm hover:underline inline-block">← All tools</a>

      <div>
        <h2 class="text-gray-800 text-2xl font-bold mb-1">Combinatorics Calculator</h2>
        <p class="text-gray-500 text-sm">
          How many possibilities are there? Pick r things from n options, or arrange a set of items -- with or without
          repeats. Results are exact, no matter how big.
        </p>
      </div>

      <div>
        <h3 class="text-gray-800 text-lg font-bold mb-1">Pick r from n</h3>
        <p class="text-gray-500 text-sm mb-3">
          A 6-digit PIN picks 6 slots from 10 digits. Whether order and repeats matter changes the answer a lot.
        </p>
        <div class="flex flex-col sm:flex-row gap-3">
          <div class="flex flex-col gap-1 flex-1">
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Options to pick from (n)</label>
            <input
              type="number"
              min="0"
              [max]="maxN"
              step="1"
              [value]="n() ?? ''"
              (input)="onNChange($event)"
              placeholder="e.g. 10"
              class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
            />
          </div>
          <div class="flex flex-col gap-1 flex-1">
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">How many to pick (r)</label>
            <input
              type="number"
              min="0"
              [max]="maxN"
              step="1"
              [value]="r() ?? ''"
              (input)="onRChange($event)"
              placeholder="e.g. 6"
              class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
            />
          </div>
        </div>
        @if (pickError()) {
          <p class="text-red-500 text-xs mt-1">{{ pickError() }}</p>
        }
      </div>

      @if (cards().length > 0) {
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          @for (card of cards(); track card.key) {
            <div class="rounded-xl border border-gray-200 p-4 flex flex-col gap-2 min-w-0">
              <div class="flex flex-wrap gap-1 text-xs font-medium">
                <span class="rounded-md bg-blue-50 text-blue-700 px-2 py-0.5">{{ card.order }}</span>
                <span class="rounded-md bg-gray-100 text-gray-600 px-2 py-0.5">{{ card.repeats }}</span>
              </div>
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="text-gray-800 font-semibold">{{ card.name }}</div>
                  <div class="text-xs text-gray-500 font-mono">{{ card.formula }}</div>
                </div>
                <button
                  (click)="copy(card.key, card.answer.exact)"
                  class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors whitespace-nowrap"
                >
                  {{ copied() === card.key ? 'Copied!' : 'Copy' }}
                </button>
              </div>
              <div class="text-2xl font-bold text-blue-700 font-mono break-all">
                {{ card.answer.scientific ?? card.answer.exact }}
              </div>
              @if (card.impossible) {
                <div class="text-xs text-gray-500">{{ card.impossible }}</div>
              } @else {
                @if (card.answer.scientific) {
                  <div class="text-xs text-gray-500 font-mono break-all">
                    {{ card.answer.digits }} digits: {{ card.answer.exact }}
                  </div>
                }
                @if (card.answer.words) {
                  <div class="text-xs text-gray-500 italic">{{ card.answer.words }}</div>
                }
                <div class="text-xs text-gray-500">{{ card.example }}</div>
                <div class="text-xs text-gray-500">
                  Chance of guessing it in one try: 1 in {{ card.answer.scientific ?? card.answer.exact }}
                </div>
              }
            </div>
          }
        </div>
      }

      <div>
        <h3 class="text-gray-800 text-lg font-bold mb-1">Arrange these items</h3>
        <p class="text-gray-500 text-sm mb-3">
          How many different orders can these go in? Each character is an item, or separate items with spaces or commas.
          Duplicate items are handled -- swapping two identical items is not a new order.
        </p>
        <input
          type="text"
          [value]="itemsText()"
          (input)="onItemsChange($event)"
          placeholder="e.g. 123456, 112233, MISSISSIPPI, or red, red, blue"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
        />
        <div class="flex flex-wrap items-center gap-2 mt-3 text-xs">
          <span class="text-gray-500">Try:</span>
          @for (example of itemExamples; track example) {
            <button
              (click)="itemsText.set(example)"
              class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 font-mono rounded cursor-pointer transition-colors"
            >
              {{ example }}
            </button>
          }
        </div>
        @if (arrangeError()) {
          <p class="text-red-500 text-xs mt-1">{{ arrangeError() }}</p>
        }
      </div>

      @if (arrangement(); as a) {
        <div class="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex flex-col gap-2 min-w-0">
          <div class="flex items-start justify-between gap-3">
            <p class="text-sm text-gray-600">
              {{ a.count }} items{{ a.hasDuplicates ? ' with repeats' : ', all different,' }} can be arranged in
            </p>
            <button
              (click)="copy('arrange', a.answer.exact)"
              class="px-2 py-1 border border-gray-300 hover:border-gray-400 bg-white text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors whitespace-nowrap"
            >
              {{ copied() === 'arrange' ? 'Copied!' : 'Copy' }}
            </button>
          </div>
          <p class="text-3xl font-bold text-blue-700 font-mono break-all">
            {{ a.answer.scientific ?? a.answer.exact }}
          </p>
          <p class="text-xs text-gray-500 font-mono break-words">{{ a.formula }}</p>
          @if (a.answer.scientific) {
            <p class="text-xs text-gray-500 font-mono break-all">{{ a.answer.digits }} digits: {{ a.answer.exact }}</p>
          }
          @if (a.answer.words) {
            <p class="text-xs text-gray-500 italic">{{ a.answer.words }}</p>
          }
          @if (a.hasDuplicates) {
            <div class="flex flex-wrap gap-1 text-xs">
              @for (g of a.groups; track g.item) {
                <span class="rounded-md bg-white border border-blue-200 text-gray-600 px-2 py-0.5 font-mono"
                  >{{ g.item }} ×{{ g.count }}</span
                >
              }
            </div>
            <p class="text-xs text-gray-500">
              If every item were different it would be {{ a.count }}! = {{ a.allDistinct }}.
            </p>
          }
        </div>
      }
    </main>
  `
})
export class Combinatorics {
  readonly maxN = MAX_N;
  readonly n = signal<number | null>(10);
  readonly r = signal<number | null>(6);
  readonly itemsText = signal('123456');
  readonly copied = signal<string | null>(null);

  readonly itemExamples = ['123456', '112233', 'MISSISSIPPI', 'red, red, blue, green'];

  readonly pickError = computed(() => {
    const n = this.n();
    const r = this.r();
    if (n === null || r === null) return 'Enter both n and r.';
    if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0) return 'Use whole numbers, 0 or more.';
    if (n > MAX_N || r > MAX_N) return `Keep n and r at ${MAX_N.toLocaleString('en-US')} or less.`;
    return null;
  });

  readonly cards = computed<PickCard[]>(() => {
    if (this.pickError()) return [];
    const n = this.n()!;
    const r = this.r()!;
    const tooMany = r > n ? `Not possible -- you can't pick ${r} different things from only ${n}.` : null;

    return [
      {
        key: 'perm-rep',
        order: 'Order matters',
        repeats: 'Repeats allowed',
        name: 'Permutations with repetition',
        formula: `n^r = ${n}^${r}`,
        example: `Like a ${r}-character code where each spot is one of ${n} options (a PIN).`,
        impossible: null,
        answer: toAnswer(BigInt(n) ** BigInt(r))
      },
      {
        key: 'perm',
        order: 'Order matters',
        repeats: 'No repeats',
        name: 'Permutations',
        formula: `n! / (n − r)! = ${n}! / ${Math.max(n - r, 0)}!`,
        example: `Like ranking ${r} winners (1st, 2nd, 3rd, ...) out of ${n} entrants.`,
        impossible: tooMany,
        answer: toAnswer(permutations(n, r))
      },
      {
        key: 'comb-rep',
        order: "Order doesn't matter",
        repeats: 'Repeats allowed',
        name: 'Combinations with repetition',
        formula: `(n + r − 1)! / (r! (n − 1)!) = C(${n + r - 1}, ${r})`,
        example: `Like ${r} scoops of ice cream from ${n} flavors, doubles allowed.`,
        impossible: n === 0 && r > 0 ? `Not possible -- there are no options to pick from.` : null,
        answer: toAnswer(n === 0 ? (r === 0 ? 1n : 0n) : combinations(n + r - 1, r))
      },
      {
        key: 'comb',
        order: "Order doesn't matter",
        repeats: 'No repeats',
        name: 'Combinations',
        formula: `n! / (r! (n − r)!) = C(${n}, ${r})`,
        example: `Like choosing a group of ${r} from ${n} people, or lottery numbers.`,
        impossible: tooMany,
        answer: toAnswer(combinations(n, r))
      }
    ];
  });

  readonly items = computed(() => parseItems(this.itemsText()));

  readonly arrangeError = computed(() =>
    this.items().length > MAX_N ? `Keep it to ${MAX_N.toLocaleString('en-US')} items or less.` : null
  );

  readonly arrangement = computed(() => {
    const items = this.items();
    if (items.length === 0 || this.arrangeError()) return null;

    const counts = new Map<string, number>();
    for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
    const groups = [...counts.entries()].map(([item, count]) => ({ item, count })).sort((a, b) => b.count - a.count);
    const repeated = groups.filter((g) => g.count > 1);

    const total = factorial(items.length);
    let divisor = 1n;
    for (const g of repeated) divisor *= factorial(g.count);

    const formula =
      repeated.length === 0
        ? `${items.length}!`
        : `${items.length}! / (${repeated.map((g) => `${g.count}!`).join(' × ')})`;

    return {
      count: items.length,
      hasDuplicates: repeated.length > 0,
      groups,
      formula,
      allDistinct: total.toLocaleString('en-US'),
      answer: toAnswer(total / divisor)
    };
  });

  onNChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.n.set(val === '' ? null : Number(val));
  }

  onRChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.r.set(val === '' ? null : Number(val));
  }

  onItemsChange(event: Event): void {
    this.itemsText.set((event.target as HTMLInputElement).value);
  }

  async copy(key: string, text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(key);
      setTimeout(() => this.copied.set(null), 2000);
    } catch {}
  }
}

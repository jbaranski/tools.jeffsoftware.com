import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

const MAX_SOCKS = 1000;
const SIM_BATCH = 10000;

function pct(p: number): string {
  if (p === 0) return '0%';
  if (p === 1) return '100%';
  if (p < 0.001) return '< 0.1%';
  if (p > 0.999) return '> 99.9%';
  return (p * 100).toLocaleString('en-US', { maximumFractionDigits: 1 }) + '%';
}

function fmt(n: number | bigint): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
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

// n choose r, exact -- the counts get far too big for plain floats with hundreds of socks
function choose(n: number, r: number): bigint {
  if (r < 0 || r > n) return 0n;
  const k = Math.min(r, n - r);
  let result = 1n;
  for (let i = 1; i <= k; i++) result = (result * BigInt(n - k + i)) / BigInt(i);
  return result;
}

// Ratio of two big counts as a float, keeping 9 digits of precision
function ratio(num: bigint, den: bigint): number {
  return den === 0n ? 0 : Number((num * 1_000_000_000n) / den) / 1_000_000_000;
}

function isWhole(n: number | null): n is number {
  return n !== null && Number.isInteger(n) && n >= 0;
}

interface ResultRow {
  label: string;
  note: string | null;
  chance: string;
  count: string;
  legend: string[];
  // Formula first, then the numbers plugged in, simplified step by step to the answer
  work: string[];
}

@Component({
  selector: 'app-bayes',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mt-4 max-w-2xl">
      <a routerLink="/" class="text-blue-500 text-sm hover:underline mb-6 inline-block">← All tools</a>

      <h2 class="text-gray-800 text-2xl font-bold mb-6">Bayesian Experiments</h2>

      <h3 class="mb-1">
        <button
          (click)="showSocks.set(!showSocks())"
          class="flex items-center gap-1 text-gray-800 text-lg font-bold cursor-pointer"
          [attr.aria-expanded]="showSocks()"
        >
          <svg
            class="w-5 h-5 text-gray-500 transition-transform"
            [class.rotate-90]="showSocks()"
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
          Sock drawer
        </button>
      </h3>
      <p class="text-gray-500 text-sm mb-6">
        You picked <strong class="text-gray-600">k</strong> of <strong class="text-gray-600">n</strong> socks and made
        <strong class="text-gray-600">m</strong> pairs. What's the chance the next sock makes a pair?
      </p>

      @if (showSocks()) {
        <div class="mb-6">
          <div class="flex flex-col sm:flex-row gap-3">
            <div class="flex flex-col gap-1 flex-1 min-w-0">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Socks (n)</label>
              <input
                type="number"
                min="2"
                step="2"
                [value]="total() ?? ''"
                (input)="total.set(num($event))"
                placeholder="e.g. 10"
                class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              />
            </div>
            <div class="flex flex-col gap-1 flex-1 min-w-0">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Picked (k)</label>
              <input
                type="number"
                min="0"
                step="1"
                [value]="picked() ?? ''"
                (input)="picked.set(num($event))"
                placeholder="e.g. 4"
                class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              />
            </div>
            <div class="flex flex-col gap-1 flex-1 min-w-0">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Pairs made (m)</label>
              <input
                type="number"
                min="0"
                step="1"
                [value]="pairs() ?? ''"
                (input)="pairs.set(num($event))"
                placeholder="e.g. 0"
                class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              />
            </div>
          </div>
          @if (sockError()) {
            <p class="text-red-500 text-xs mt-1">{{ sockError() }}</p>
          }
        </div>

        <div class="overflow-x-auto rounded-xl border border-gray-200 mb-6">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200">
                <th class="text-left px-4 py-3 font-semibold text-gray-600">Question</th>
                <th class="text-right px-4 py-3 font-semibold text-gray-600">Chance</th>
                <th class="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Out of</th>
              </tr>
            </thead>
            <tbody>
              @for (row of sockRows(); track row.label) {
                <tr class="border-b border-gray-100 last:border-0">
                  <td class="px-4 py-3 text-gray-600">
                    {{ row.label }}
                    @if (row.note) {
                      <span class="text-xs text-gray-400 ml-1">{{ row.note }}</span>
                    }
                  </td>
                  <td class="px-4 py-3 text-right font-mono font-semibold text-gray-600 whitespace-nowrap">
                    {{ row.chance }}
                  </td>
                  <td class="px-4 py-3 font-mono text-gray-500 text-xs hidden sm:table-cell">{{ row.count }}</td>
                </tr>
                <tr class="sm:hidden border-b border-gray-100 last:border-0 bg-gray-50">
                  <td colspan="2" class="px-4 pb-3 font-mono text-gray-500 text-xs">{{ row.count }}</td>
                </tr>
              }
              @if (sockRows().length === 0) {
                @for (label of sockLabels; track label) {
                  <tr class="border-b border-gray-100 last:border-0">
                    <td class="px-4 py-3 text-gray-600">{{ label }}</td>
                    <td class="px-4 py-3 text-right text-gray-300">--</td>
                    <td class="px-4 py-3 hidden sm:table-cell"></td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <div class="mb-6">
          <div class="flex items-center gap-6">
            <button
              (click)="showSockMath.set(!showSockMath())"
              class="flex items-center gap-1 text-blue-500 text-sm font-medium hover:underline cursor-pointer"
              [attr.aria-expanded]="showSockMath()"
            >
              <svg
                class="w-5 h-5 transition-transform"
                [class.rotate-90]="showSockMath()"
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
              (click)="showSim.set(!showSim())"
              class="flex items-center gap-1 text-blue-500 text-sm font-medium hover:underline cursor-pointer"
              [attr.aria-expanded]="showSim()"
            >
              <svg
                class="w-5 h-5 transition-transform"
                [class.rotate-90]="showSim()"
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
              Simulation
            </button>
          </div>

          @if (showSockMath() && sockRows().length > 0) {
            <div class="overflow-x-auto rounded-xl border border-gray-200 mt-3">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-200">
                    <th class="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Case</th>
                    <th class="text-left px-4 py-3 font-semibold text-gray-600">How it's solved</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of sockRows(); track row.label) {
                    <tr class="border-b border-gray-100 last:border-0">
                      <td class="px-4 py-3 text-gray-500 align-top">
                        <div>{{ row.label }}</div>
                        @for (line of row.legend; track $index) {
                          <div class="text-xs text-gray-400 font-mono mt-1">{{ line }}</div>
                        }
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

          @if (showSim() && socks(); as s) {
            <div class="overflow-x-auto rounded-xl border border-gray-200 mt-3">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-200">
                    <th class="text-left px-4 py-3 font-semibold text-gray-600">
                      <span class="flex items-center gap-2">
                        Shuffles: {{ sim() ? fmt(sim()!.trials) : 0 }}
                        <button
                          (click)="runSimulation()"
                          class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors whitespace-nowrap"
                        >
                          Run {{ fmt(simBatch) }} more
                        </button>
                        @if (sim()) {
                          <button
                            (click)="simRaw.set(null)"
                            class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors whitespace-nowrap"
                          >
                            Reset
                          </button>
                        }
                      </span>
                    </th>
                    <th class="text-right px-4 py-3 font-semibold text-gray-600">Simulated</th>
                    <th class="text-right px-4 py-3 font-semibold text-gray-600">Exact</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-b border-gray-100">
                    <td class="px-4 py-3 text-gray-600">
                      Made {{ s.pairs }} {{ s.pairs === 1 ? 'pair' : 'pairs' }} in {{ s.picked }} picks
                    </td>
                    <td class="px-4 py-3 text-right font-mono text-gray-500 whitespace-nowrap">
                      {{ sim() ? pct(sim()!.kept / sim()!.trials) : '--' }}
                    </td>
                    <td class="px-4 py-3 text-right font-mono text-gray-500 whitespace-nowrap">
                      {{ s.observationPct }}
                    </td>
                  </tr>
                  <tr>
                    <td class="px-4 py-3 text-gray-600">
                      Then the next sock made a pair
                      <span class="text-xs text-gray-400 ml-1">only shuffles that matched</span>
                    </td>
                    <td class="px-4 py-3 text-right font-mono font-semibold text-gray-600 whitespace-nowrap">
                      {{ sim() && sim()!.kept > 0 ? pct(sim()!.hits / sim()!.kept) : '--' }}
                    </td>
                    <td class="px-4 py-3 text-right font-mono font-semibold text-gray-600 whitespace-nowrap">
                      {{ s.nextPct }}
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
          (click)="showMix.set(!showMix())"
          class="flex items-center gap-1 text-gray-800 text-lg font-bold cursor-pointer"
          [attr.aria-expanded]="showMix()"
        >
          <svg
            class="w-5 h-5 text-gray-500 transition-transform"
            [class.rotate-90]="showMix()"
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
          Unknown mix
        </button>
      </h3>
      <p class="text-gray-500 text-sm mb-6">
        You don't know what's in the bag. You saw <strong class="text-gray-600">s</strong> yes in
        <strong class="text-gray-600">n</strong> picks. What's the chance the next pick is a yes?
      </p>

      @if (showMix()) {
        <div class="mb-6">
          <div class="flex flex-col sm:flex-row gap-3">
            <div class="flex flex-col gap-1 flex-1 min-w-0">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Picks (n)</label>
              <input
                type="number"
                min="0"
                step="1"
                [value]="trials() ?? ''"
                (input)="trials.set(num($event))"
                placeholder="e.g. 10"
                class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              />
            </div>
            <div class="flex flex-col gap-1 flex-1 min-w-0">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Yes (s)</label>
              <input
                type="number"
                min="0"
                step="1"
                [value]="successes() ?? ''"
                (input)="successes.set(num($event))"
                placeholder="e.g. 7"
                class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              />
            </div>
          </div>
          @if (mixError()) {
            <p class="text-red-500 text-xs mt-1">{{ mixError() }}</p>
          }
        </div>

        <div class="overflow-x-auto rounded-xl border border-gray-200 mb-6">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200">
                <th class="text-left px-4 py-3 font-semibold text-gray-600">Method</th>
                <th class="text-right px-4 py-3 font-semibold text-gray-600">Chance next is yes</th>
              </tr>
            </thead>
            <tbody>
              @for (row of mixRows(); track row.label) {
                <tr class="border-b border-gray-100 last:border-0">
                  <td class="px-4 py-3 text-gray-600">
                    {{ row.label }}
                    @if (row.note) {
                      <span class="text-xs text-gray-400 ml-1">{{ row.note }}</span>
                    }
                  </td>
                  <td class="px-4 py-3 text-right font-mono font-semibold text-gray-600 whitespace-nowrap">
                    {{ row.chance }}
                  </td>
                </tr>
              }
              @if (mixRows().length === 0) {
                @for (label of mixLabels; track label) {
                  <tr class="border-b border-gray-100 last:border-0">
                    <td class="px-4 py-3 text-gray-600">{{ label }}</td>
                    <td class="px-4 py-3 text-right text-gray-300">--</td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <div>
          <button
            (click)="showMixMath.set(!showMixMath())"
            class="flex items-center gap-1 text-blue-500 text-sm font-medium hover:underline cursor-pointer"
            [attr.aria-expanded]="showMixMath()"
          >
            <svg
              class="w-5 h-5 transition-transform"
              [class.rotate-90]="showMixMath()"
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
          @if (showMixMath() && mixRows().length > 0) {
            <div class="overflow-x-auto rounded-xl border border-gray-200 mt-3">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-200">
                    <th class="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Case</th>
                    <th class="text-left px-4 py-3 font-semibold text-gray-600">How it's solved</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of mixRows(); track row.label) {
                    <tr class="border-b border-gray-100 last:border-0">
                      <td class="px-4 py-3 text-gray-500 align-top">
                        <div>{{ row.label }}</div>
                        @for (line of row.legend; track $index) {
                          <div class="text-xs text-gray-400 font-mono mt-1">{{ line }}</div>
                        }
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
    </main>
  `
})
export class BayesExperiments {
  readonly simBatch = SIM_BATCH;
  readonly pct = pct;
  readonly fmt = fmt;

  readonly showSocks = signal(true);
  readonly showMix = signal(false);
  readonly showSockMath = signal(false);
  readonly showSim = signal(false);
  readonly showMixMath = signal(false);

  readonly total = signal<number | null>(10);
  readonly picked = signal<number | null>(4);
  readonly pairs = signal<number | null>(0);
  readonly trials = signal<number | null>(10);
  readonly successes = signal<number | null>(7);

  readonly sockLabels = ['Next sock makes a pair', 'Before seeing any pairs', 'Seeing what you saw'];
  readonly mixLabels = ['Raw ratio', 'Laplace', 'Jeffreys'];

  // Simulation tallies, tagged with the inputs they were run for so stale results never show
  readonly simRaw = signal<{ key: string; trials: number; kept: number; hits: number } | null>(null);

  readonly sockError = computed(() => {
    const total = this.total();
    const picked = this.picked();
    const pairs = this.pairs();
    if (!isWhole(total) || !isWhole(picked) || !isWhole(pairs)) return 'Use whole numbers, 0 or more.';
    if (total < 2 || total % 2 !== 0) return 'Socks come in pairs -- use an even number of socks.';
    if (total > MAX_SOCKS) return `Keep it to ${fmt(MAX_SOCKS)} socks or less.`;
    if (picked >= total) return 'Leave at least one sock in the drawer to pick next.';
    if (pairs * 2 > picked) return `${picked} socks can make at most ${Math.floor(picked / 2)} pairs.`;
    const atLeast = picked - total / 2;
    if (picked - pairs * 2 > total / 2 - pairs) {
      return `Not possible -- with ${total / 2} pairs, ${picked} socks must make at least ${atLeast} ${atLeast === 1 ? 'pair' : 'pairs'}.`;
    }
    return null;
  });

  readonly socks = computed(() => {
    if (this.sockError()) return null;
    const total = this.total()!;
    const picked = this.picked()!;
    const pairs = this.pairs()!;
    const pairCount = total / 2;
    const singles = picked - pairs * 2;
    const left = total - picked;

    // Ways to pick `picked` socks with exactly `pairs` full pairs, over all ways to pick them
    const ways = choose(pairCount, pairs) * choose(pairCount - pairs, singles) * 2n ** BigInt(singles);
    const allWays = choose(total, picked);

    return {
      total,
      picked,
      pairs,
      pairCount,
      singles,
      left,
      ways,
      allWays,
      next: singles / left,
      nextPct: pct(singles / left),
      prior: picked / (total - 1),
      observationPct: pct(ratio(ways, allWays))
    };
  });

  readonly sockRows = computed<ResultRow[]>(() => {
    const s = this.socks();
    if (!s) return [];
    const vars = `n = ${s.total}, k = ${s.picked}, m = ${s.pairs}`;
    return [
      {
        label: 'Next sock makes a pair',
        note: null,
        chance: s.nextPct,
        count: `${fmt(s.singles)} of the ${fmt(s.left)} socks left match one in your hand`,
        legend: [vars, 'k − 2m socks in hand are unmatched', 'their partners are still in the drawer'],
        work: [
          'unmatched in hand / socks left',
          '(k − 2m) / (n − k)',
          `(${s.picked} − 2 × ${s.pairs}) / (${s.total} − ${s.picked})`,
          `${s.singles} / ${s.left}`,
          s.nextPct
        ]
      },
      {
        label: 'Before seeing any pairs',
        note: 'only knowing k',
        chance: pct(s.prior),
        count: `${fmt(s.picked)} of the other ${fmt(s.total - 1)} socks are in your hand`,
        legend: [vars, "the next sock's partner is equally", 'likely to be any other sock'],
        work: ['k / (n − 1)', `${s.picked} / (${s.total} − 1)`, `${s.picked} / ${s.total - 1}`, pct(s.prior)]
      },
      {
        label: 'Seeing what you saw',
        note: `${s.pairs} ${s.pairs === 1 ? 'pair' : 'pairs'} in ${s.picked} picks`,
        chance: s.observationPct,
        count: `${display(s.ways)} of the ${display(s.allWays)} ways to pick ${s.picked} socks`,
        legend: [vars, `p = n / 2 = ${s.pairCount} pairs`, `u = k − 2m = ${s.singles} unmatched`],
        work: [
          'C(p, m) × C(p − m, u) × 2^u / C(n, k)',
          `C(${s.pairCount}, ${s.pairs}) × C(${s.pairCount - s.pairs}, ${s.singles}) × 2^${s.singles} / C(${s.total}, ${s.picked})`,
          `${display(choose(s.pairCount, s.pairs))} × ${display(choose(s.pairCount - s.pairs, s.singles))} × ${display(2n ** BigInt(s.singles))} / ${display(s.allWays)}`,
          `${display(s.ways)} / ${display(s.allWays)}`,
          s.observationPct
        ]
      }
    ];
  });

  readonly simKey = computed(() => `${this.total()}|${this.picked()}|${this.pairs()}`);
  readonly sim = computed(() => {
    const raw = this.simRaw();
    return raw && raw.key === this.simKey() ? raw : null;
  });

  readonly mixError = computed(() => {
    const n = this.trials();
    const s = this.successes();
    if (!isWhole(n) || !isWhole(s)) return 'Use whole numbers, 0 or more.';
    if (s > n) return `Can't have more than ${n} yes in ${n} picks.`;
    return null;
  });

  readonly mixRows = computed<ResultRow[]>(() => {
    if (this.mixError()) return [];
    const n = this.trials()!;
    const s = this.successes()!;
    const vars = `n = ${n}, s = ${s}`;
    const laplace = (s + 1) / (n + 2);
    const jeffreys = (s + 0.5) / (n + 1);
    return [
      {
        label: 'Raw ratio',
        note: 'trusts the sample completely',
        chance: n === 0 ? '--' : pct(s / n),
        count: '',
        legend: [vars],
        work: n === 0 ? ['s / n', 'no picks yet, so nothing to divide'] : ['s / n', `${s} / ${n}`, pct(s / n)]
      },
      {
        label: 'Laplace',
        note: 'assumes nothing',
        chance: pct(laplace),
        count: '',
        legend: [vars, 'as if you had already seen', '1 yes and 1 no'],
        work: ['(s + 1) / (n + 2)', `(${s} + 1) / (${n} + 2)`, `${s + 1} / ${n + 2}`, pct(laplace)]
      },
      {
        label: 'Jeffreys',
        note: 'trusts lopsided samples more',
        chance: pct(jeffreys),
        count: '',
        legend: [vars, 'as if you had already seen', '½ yes and ½ no'],
        work: ['(s + ½) / (n + 1)', `(${s} + ½) / (${n} + 1)`, `${s + 0.5} / ${n + 1}`, pct(jeffreys)]
      }
    ];
  });

  num(event: Event): number | null {
    const val = (event.target as HTMLInputElement).value;
    return val === '' ? null : Number(val);
  }

  runSimulation(): void {
    const s = this.socks();
    if (!s) return;

    // Each sock is labeled with its pair number; a sock pairs up if its partner was already seen
    const drawer = Array.from({ length: s.total }, (_, i) => i >> 1);
    const seen = new Uint8Array(s.pairCount);
    let kept = 0;
    let hits = 0;

    for (let t = 0; t < SIM_BATCH; t++) {
      // Partial Fisher-Yates: only the first picked + 1 positions need to be random
      for (let i = 0; i <= s.picked; i++) {
        const j = i + Math.floor(Math.random() * (s.total - i));
        [drawer[i], drawer[j]] = [drawer[j], drawer[i]];
      }
      seen.fill(0);
      let pairs = 0;
      for (let i = 0; i < s.picked; i++) {
        if (seen[drawer[i]]) pairs++;
        else seen[drawer[i]] = 1;
      }
      if (pairs !== s.pairs) continue;
      kept++;
      // A completed pair has both socks in hand, so a hit here can only be a held unmatched sock
      if (seen[drawer[s.picked]]) hits++;
    }

    const prev = this.sim();
    this.simRaw.set({
      key: this.simKey(),
      trials: (prev?.trials ?? 0) + SIM_BATCH,
      kept: (prev?.kept ?? 0) + kept,
      hits: (prev?.hits ?? 0) + hits
    });
  }
}

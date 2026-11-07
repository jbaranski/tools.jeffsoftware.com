import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

const MAX_SOCKS = 1000;
const SIM_BATCH = 10000;
const MAX_LADDER = 12;

type Prior = 'uniform' | 'jeffreys';

const PRIORS: Record<Prior, { a: number; b: number; label: string }> = {
  uniform: { a: 1, b: 1, label: 'No idea (Laplace)' },
  jeffreys: { a: 0.5, b: 0.5, label: 'Favor lopsided (Jeffreys)' }
};

function pct(p: number): string {
  if (p === 0) return '0%';
  if (p === 1) return '100%';
  if (p < 0.001) return '< 0.1%';
  if (p > 0.999) return '> 99.9%';
  return (p * 100).toLocaleString('en-US', { maximumFractionDigits: 1 }) + '%';
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// log of n choose r -- the counts get far too big for plain floats with hundreds of socks
function logChoose(n: number, r: number): number {
  let result = 0;
  for (let i = 1; i <= r; i++) result += Math.log(n - r + i) - Math.log(i);
  return result;
}

function isWhole(n: number | null): n is number {
  return n !== null && Number.isInteger(n) && n >= 0;
}

@Component({
  selector: 'app-bayes',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mt-4 max-w-2xl space-y-6">
      <a routerLink="/" class="text-blue-500 text-sm hover:underline inline-block">← All tools</a>

      <div>
        <h2 class="text-gray-800 text-2xl font-bold mb-1">Bayesian Experiments</h2>
        <p class="text-gray-500 text-sm">
          What are the odds of the next pick, given what you've already seen? Work it out step by step, then run the
          experiment thousands of times to check.
        </p>
      </div>

      <div>
        <h3 class="text-gray-800 text-lg font-bold mb-1">The sock drawer</h3>
        <p class="text-gray-500 text-sm mb-3">
          A drawer of loose pairs. You've pulled some socks out at random. Will the next one match a sock you're
          holding?
        </p>
        <div class="flex flex-col sm:flex-row gap-3">
          <div class="flex flex-col gap-1 flex-1 min-w-0">
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Socks in the drawer</label>
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
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Picked so far</label>
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
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Pairs made so far</label>
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

      @if (socks(); as s) {
        <div class="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <p class="text-sm text-gray-600">Chance the next sock makes a pair</p>
          <p class="text-4xl font-bold text-blue-700 my-1">{{ s.nextPct }}</p>
          <p class="text-xs text-gray-500">
            {{ s.singles }} of the {{ s.left }} socks left in the drawer match a sock in your hand.
          </p>
        </div>

        <div>
          <h3 class="text-gray-800 text-lg font-bold mb-3">Why</h3>
          <ol class="list-decimal pl-5 space-y-2 text-sm text-gray-600">
            <li>{{ s.total }} socks is {{ s.pairCount }} pairs.</li>
            <li>
              You picked {{ s.picked }} and made {{ s.pairs }} {{ s.pairs === 1 ? 'pair' : 'pairs' }}, so you're holding
              <span class="font-semibold text-gray-800">{{ s.singles }} unmatched</span>
              {{ s.singles === 1 ? 'sock' : 'socks' }}, each from a different pair.
            </li>
            <li>
              The partner of every unmatched sock is still in the drawer -- that's
              <span class="font-semibold text-gray-800">{{ s.singles }}</span> socks that would make a pair.
            </li>
            <li>
              {{ s.total }} − {{ s.picked }} = <span class="font-semibold text-gray-800">{{ s.left }}</span> socks are
              left to pick from.
            </li>
            <li>
              So the next sock makes a pair {{ s.singles }} in {{ s.left }} times =
              <span class="font-semibold text-blue-700">{{ s.nextPct }}</span
              >.
              @if (s.untouched > 0) {
                The other {{ s.left - s.singles }} ({{ s.missPct }}) come from {{ s.untouched }} untouched
                {{ s.untouched === 1 ? 'pair' : 'pairs' }} and leave you with one more unmatched sock.
              } @else {
                Every sock left in the drawer matches one in your hand.
              }
            </li>
          </ol>
        </div>

        <div>
          <h3 class="text-gray-800 text-lg font-bold mb-1">What seeing it changed</h3>
          <p class="text-gray-500 text-sm mb-3">
            This is the Bayesian part: what you observed changes the odds of what comes next.
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="rounded-xl border border-gray-200 p-4">
              <div class="text-xs font-medium text-gray-500 uppercase tracking-wide">Before you looked</div>
              <div class="text-2xl font-bold text-gray-800 my-1">{{ s.priorPct }}</div>
              <p class="text-xs text-gray-500">
                Knowing only that you'd pulled {{ s.picked }}, the next sock's partner is equally likely to be any of
                the other {{ s.total - 1 }} socks, and {{ s.picked }} of them are in your hand.
              </p>
            </div>
            <div class="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div class="text-xs font-medium text-blue-700 uppercase tracking-wide">
                After seeing {{ s.pairs }} {{ s.pairs === 1 ? 'pair' : 'pairs' }}
              </div>
              <div class="text-2xl font-bold text-blue-700 my-1">{{ s.nextPct }}</div>
              <p class="text-xs text-gray-500">
                {{ s.shiftExplanation }}
              </p>
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-3">
            How likely was what you saw? Pulling {{ s.picked }} socks and making exactly {{ s.pairs }}
            {{ s.pairs === 1 ? 'pair' : 'pairs' }} happens {{ s.observationPct }} of the time.
          </p>
        </div>

        <div>
          <h3 class="text-gray-800 text-lg font-bold mb-1">Chance of no pairs yet, pick by pick</h3>
          <p class="text-gray-500 text-sm mb-3">
            From a full drawer. By pick {{ s.pairCount + 1 }} a pair is guaranteed -- there are only
            {{ s.pairCount }} different pairs.
          </p>
          <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">
            @for (step of s.ladder; track step.picks) {
              <div
                class="rounded-lg px-2 py-2 text-center"
                [class]="
                  step.picks === s.picked
                    ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-500'
                    : 'bg-gray-50 text-gray-600'
                "
              >
                <div class="text-xs opacity-70">{{ step.picks }} {{ step.picks === 1 ? 'pick' : 'picks' }}</div>
                <div class="font-mono text-sm font-semibold">{{ step.pct }}</div>
              </div>
            }
          </div>
          @if (s.ladderTruncated) {
            <p class="text-xs text-gray-400 mt-3">Showing the first {{ maxLadder }} picks.</p>
          }
        </div>

        <div>
          <h3 class="text-gray-800 text-lg font-bold mb-1">Run the experiment</h3>
          <p class="text-gray-500 text-sm mb-3">
            Shuffle the drawer and pull {{ s.picked }} socks, {{ simBatch.toLocaleString('en-US') }} times. Keep only
            the runs where you made exactly {{ s.pairs }} {{ s.pairs === 1 ? 'pair' : 'pairs' }} (just like you did),
            then see how often the next sock paired up. Throwing away the runs that don't match what you saw is
            conditioning -- the heart of Bayes.
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <button
              (click)="runSimulation()"
              class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors"
            >
              {{
                sim()
                  ? 'Run ' + simBatch.toLocaleString('en-US') + ' more'
                  : 'Run ' + simBatch.toLocaleString('en-US') + ' times'
              }}
            </button>
            @if (sim()) {
              <button
                (click)="simRaw.set(null)"
                class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors"
              >
                Reset
              </button>
            }
          </div>
          @if (sim(); as r) {
            <div class="overflow-x-auto rounded-xl border border-gray-200 mt-3">
              <table class="w-full text-sm">
                <tbody>
                  <tr class="border-b border-gray-100">
                    <td class="px-4 py-3 text-gray-500 font-medium">Shuffles run</td>
                    <td class="px-4 py-3 text-right font-mono text-gray-800">{{ fmt(r.trials) }}</td>
                    <td class="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell"></td>
                  </tr>
                  <tr class="border-b border-gray-100">
                    <td class="px-4 py-3 text-gray-500 font-medium">Matched what you saw</td>
                    <td class="px-4 py-3 text-right font-mono text-gray-800">
                      {{ fmt(r.kept) }} ({{ pct(r.kept / r.trials) }})
                    </td>
                    <td class="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">
                      expected {{ s.observationPct }}
                    </td>
                  </tr>
                  <tr>
                    <td class="px-4 py-3 text-gray-500 font-medium">Next sock made a pair</td>
                    <td class="px-4 py-3 text-right font-mono font-semibold text-blue-700">
                      @if (r.kept > 0) {
                        {{ fmt(r.hits) }} ({{ pct(r.hits / r.kept) }})
                      } @else {
                        --
                      }
                    </td>
                    <td class="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">exact {{ s.nextPct }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            @if (r.kept === 0) {
              <p class="text-xs text-gray-500 mt-3">
                None of the shuffles matched -- what you saw is rare ({{ s.observationPct }}). Run more.
              </p>
            }
          }
        </div>
      }

      <div>
        <h3 class="text-gray-800 text-lg font-bold mb-1">Unknown mix</h3>
        <p class="text-gray-500 text-sm mb-3">
          Now you don't know what's in the bag. You've pulled some things out and counted how many were "yes" (red,
          defective, a click...). What's the chance the next one is a yes?
        </p>
        <div class="flex flex-col sm:flex-row gap-3">
          <div class="flex flex-col gap-1 flex-1 min-w-0">
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Picks so far</label>
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
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">How many were "yes"</label>
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
          <div class="flex flex-col gap-1 flex-1 min-w-0">
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Starting belief</label>
            <select
              (change)="onPriorChange($event)"
              class="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-white"
            >
              @for (p of priorOptions; track p.key) {
                <option [value]="p.key" [selected]="p.key === prior()">{{ p.label }}</option>
              }
            </select>
          </div>
        </div>
        @if (mixError()) {
          <p class="text-red-500 text-xs mt-1">{{ mixError() }}</p>
        }
      </div>

      @if (mix(); as m) {
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="rounded-xl border border-gray-200 p-4">
            <div class="text-xs font-medium text-gray-500 uppercase tracking-wide">Just the raw ratio</div>
            <div class="text-2xl font-bold text-gray-800 my-1">{{ m.naivePct }}</div>
            <p class="text-xs text-gray-500">{{ m.naiveExplanation }}</p>
          </div>
          <div class="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div class="text-xs font-medium text-blue-700 uppercase tracking-wide">Bayesian estimate</div>
            <div class="text-2xl font-bold text-blue-700 my-1">{{ m.bayesPct }}</div>
            <p class="text-xs text-gray-500">{{ m.bayesExplanation }}</p>
          </div>
        </div>
      }
    </main>
  `
})
export class BayesExperiments {
  readonly maxLadder = MAX_LADDER;
  readonly simBatch = SIM_BATCH;
  readonly pct = pct;
  readonly fmt = fmt;

  readonly total = signal<number | null>(10);
  readonly picked = signal<number | null>(4);
  readonly pairs = signal<number | null>(0);

  readonly trials = signal<number | null>(10);
  readonly successes = signal<number | null>(7);
  readonly prior = signal<Prior>('uniform');
  readonly priorOptions = (Object.keys(PRIORS) as Prior[]).map((key) => ({ key, label: PRIORS[key].label }));

  // Simulation tallies, tagged with the inputs they were run for so stale results never show
  readonly simRaw = signal<{ key: string; trials: number; kept: number; hits: number } | null>(null);

  readonly sockError = computed(() => {
    const total = this.total();
    const picked = this.picked();
    const pairs = this.pairs();
    if (!isWhole(total) || !isWhole(picked) || !isWhole(pairs)) return 'Use whole numbers, 0 or more.';
    if (total < 2 || total % 2 !== 0) return 'Socks come in pairs -- use an even number of socks.';
    if (total > MAX_SOCKS) return `Keep it to ${MAX_SOCKS.toLocaleString('en-US')} socks or less.`;
    if (picked >= total) return 'Leave at least one sock in the drawer to pick next.';
    if (pairs * 2 > picked) return `${picked} socks can make at most ${Math.floor(picked / 2)} pairs.`;
    const singles = picked - pairs * 2;
    if (singles > total / 2 - pairs) {
      const atLeast = picked - total / 2;
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
    const next = singles / left;
    const prior = picked / (total - 1);

    // Ways to pick `picked` socks with exactly `pairs` complete pairs, over all ways to pick them
    const logObservation =
      logChoose(pairCount, pairs) +
      logChoose(pairCount - pairs, singles) +
      singles * Math.log(2) -
      logChoose(total, picked);

    const ladder: { picks: number; pct: string }[] = [];
    let noPair = 1;
    for (let j = 1; j <= Math.min(pairCount + 1, MAX_LADDER); j++) {
      // The j-th sock avoids every partner of the j - 1 unmatched socks already held
      noPair *= (total - 2 * (j - 1)) / (total - (j - 1));
      ladder.push({ picks: j, pct: pct(Math.max(noPair, 0)) });
    }

    let shiftExplanation: string;
    if (Math.abs(next - prior) < 1e-9) {
      shiftExplanation = 'Same as before -- what you saw happens to leave the odds unchanged.';
    } else if (next > prior) {
      shiftExplanation =
        'Higher: every unmatched sock in your hand leaves its partner waiting in the drawer, ' +
        'while the drawer keeps getting smaller.';
    } else {
      shiftExplanation =
        'Lower: socks you already paired up are out of play, so fewer partners are left waiting in the drawer.';
    }

    return {
      total,
      picked,
      pairs,
      pairCount,
      singles,
      left,
      untouched: pairCount - pairs - singles,
      nextPct: pct(next),
      missPct: pct(1 - next),
      priorPct: pct(prior),
      shiftExplanation,
      observationPct: pct(Math.exp(logObservation)),
      ladder,
      ladderTruncated: pairCount + 1 > MAX_LADDER
    };
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
    if (s > n) return `Can't have more than ${n} "yes" out of ${n} picks.`;
    return null;
  });

  readonly mix = computed(() => {
    if (this.mixError()) return null;
    const n = this.trials()!;
    const s = this.successes()!;
    const { a, b } = PRIORS[this.prior()];
    const bayes = (s + a) / (n + a + b);

    const naiveExplanation =
      n === 0
        ? 'With no picks yet, the raw ratio has nothing to say.'
        : s === n || s === 0
          ? `${s} of ${n} -- it claims the next pick is certain, which a small sample can't really promise.`
          : `${s} of ${n}, treating your sample as the whole truth.`;

    const bayesExplanation =
      this.prior() === 'uniform'
        ? `(${s} + 1) / (${n} + 2) -- as if you'd already seen one "yes" and one "no" before starting. ` +
          'Small samples get pulled toward 50%; big samples barely move.'
        : `(${s} + ½) / (${n} + 1) -- half a "yes" and half a "no" up front. ` +
          'Trusts lopsided samples a bit more than the Laplace rule.';

    return {
      naivePct: n === 0 ? '--' : pct(s / n),
      naiveExplanation,
      bayesPct: pct(bayes),
      bayesExplanation
    };
  });

  num(event: Event): number | null {
    const val = (event.target as HTMLInputElement).value;
    return val === '' ? null : Number(val);
  }

  onPriorChange(event: Event): void {
    this.prior.set((event.target as HTMLSelectElement).value as Prior);
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

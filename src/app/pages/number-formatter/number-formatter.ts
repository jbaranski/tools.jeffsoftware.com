import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion'];

function groupToWords(n: number): string {
  if (n === 0) return '';
  let result = '';
  if (n >= 100) {
    result += ONES[Math.floor(n / 100)] + ' hundred';
    n = n % 100;
    if (n > 0) result += ' and ';
  }
  if (n >= 20) {
    result += TENS[Math.floor(n / 10)];
    const ones = n % 10;
    if (ones > 0) result += '-' + ONES[ones];
  } else if (n > 0) {
    result += ONES[n];
  }
  return result;
}

function formatWithCommas(input: string): string {
  const result: string[] = [];
  let count = 0;
  for (let i = input.length - 1; i >= 0; i--) {
    if (count > 0 && count % 3 === 0) result.unshift(',');
    result.unshift(input[i]);
    count++;
  }
  return result.join('');
}

function numberToWords(input: string): string {
  if (input === '0') return 'Zero';
  const groups: number[] = [];
  for (let i = input.length; i > 0; i -= 3) {
    const start = Math.max(0, i - 3);
    groups.push(parseInt(input.slice(start, i), 10));
  }
  let parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    const isLastGroup = i === 0;
    const higherGroupsExist = groups.slice(1).some(x => x !== 0);
    let words = groupToWords(g);
    if (isLastGroup && higherGroupsExist && g < 100) {
      parts.push('and ' + words);
    } else {
      if (SCALES[i]) words += ' ' + SCALES[i];
      parts.push(words);
    }
  }
  const result = parts.join(', ');
  return result.charAt(0).toUpperCase() + result.slice(1);
}

interface FormatterResult {
  plain: string;
  commas: string;
  words: string;
}

@Component({
  selector: 'app-number-formatter',
  imports: [RouterLink, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mt-4">
      <a routerLink="/" class="text-blue-500 text-sm hover:underline mb-6 inline-block">← All tools</a>

      <h2 class="text-gray-800 text-2xl font-bold mb-1">Number Formatter</h2>
      <p class="text-gray-500 text-sm mb-6">Format a number with comma separators and convert it to English words.</p>

      <div class="mb-6">
        <label class="block text-xs font-medium text-gray-600 mb-1">Number</label>
        <input
          type="text"
          [ngModel]="input()"
          (ngModelChange)="onInput($event)"
          placeholder="e.g. 1,000,000 or 1000000"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
        />
        @if (error()) {
          <p class="text-red-500 text-xs mt-1">{{ error() }}</p>
        }
      </div>

      <div class="overflow-x-auto rounded-xl border border-gray-200">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="text-left px-4 py-3 font-semibold text-gray-600 w-32">Format</th>
              <th class="text-left px-4 py-3 font-semibold text-gray-600">Value</th>
              <th class="px-4 py-3 w-24">
                <button
                  (click)="copyAll()"
                  class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors float-right"
                >{{ copiedAll() ? 'Copied!' : 'Copy all' }}</button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-gray-100">
              <td class="px-4 py-3 text-gray-500 font-medium">Plain</td>
              <td class="px-4 py-3 font-mono text-gray-800 break-all select-all">{{ result()?.plain ?? '' }}</td>
              <td class="px-4 py-3 text-right">
                <button
                  (click)="copyField('plain')"
                  class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors"
                >{{ copiedField() === 'plain' ? 'Copied!' : 'Copy' }}</button>
              </td>
            </tr>
            <tr class="border-b border-gray-100">
              <td class="px-4 py-3 text-gray-500 font-medium">With commas</td>
              <td class="px-4 py-3 font-mono text-gray-800 break-all select-all">{{ result()?.commas ?? '' }}</td>
              <td class="px-4 py-3 text-right">
                <button
                  (click)="copyField('commas')"
                  class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors"
                >{{ copiedField() === 'commas' ? 'Copied!' : 'Copy' }}</button>
              </td>
            </tr>
            <tr>
              <td class="px-4 py-3 text-gray-500 font-medium">In words</td>
              <td class="px-4 py-3 text-gray-800 break-words select-all">{{ result()?.words ?? '' }}</td>
              <td class="px-4 py-3 text-right">
                <button
                  (click)="copyField('words')"
                  class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors"
                >{{ copiedField() === 'words' ? 'Copied!' : 'Copy' }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  `
})
export class NumberFormatter {
  readonly input = signal('');
  readonly error = signal('');
  readonly copiedField = signal<string | null>(null);
  readonly copiedAll = signal(false);

  readonly result = computed<FormatterResult | null>(() => {
    const raw = this.input().trim().replace(/,/g, '');
    if (!raw) return null;
    return { plain: raw, commas: formatWithCommas(raw), words: numberToWords(raw) };
  });

  onInput(value: string): void {
    const trimmed = value.trim();
    if (trimmed === '') {
      this.input.set('');
      this.error.set('');
      return;
    }
    const stripped = trimmed.replace(/,/g, '');
    if (!/^\d+$/.test(stripped)) {
      this.error.set('Only digits and commas allowed.');
      this.input.set(trimmed);
      return;
    }
    if (stripped.length > 1 && stripped[0] === '0') {
      this.error.set('No leading zeros.');
      this.input.set(trimmed);
      return;
    }
    if (stripped.length > 24) {
      this.error.set('Number too large (max 24 digits).');
      this.input.set(trimmed);
      return;
    }
    this.error.set('');
    this.input.set(trimmed);
  }

  async copyAll(): Promise<void> {
    const r = this.result();
    if (!r) return;
    const text = `plain: ${r.plain}\nwith commas: ${r.commas}\nin words: ${r.words}`;
    try {
      await navigator.clipboard.writeText(text);
      this.copiedAll.set(true);
      setTimeout(() => this.copiedAll.set(false), 2000);
    } catch {}
  }

  async copyField(field: keyof FormatterResult): Promise<void> {
    const r = this.result();
    if (!r) return;
    try {
      await navigator.clipboard.writeText(r[field]);
      this.copiedField.set(field);
      setTimeout(() => this.copiedField.set(null), 2000);
    } catch {}
  }
}

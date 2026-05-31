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
  // groups[0] = ones group, groups[1] = thousands, etc.
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

      @if (result(); as r) {
        <div class="space-y-3">
          <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p class="text-xs font-medium text-gray-500 mb-1">Plain</p>
            <p class="font-mono text-lg text-gray-800 select-all break-all">{{ r.plain }}</p>
          </div>
          <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p class="text-xs font-medium text-gray-500 mb-1">With commas</p>
            <p class="font-mono text-lg text-gray-800 select-all break-all">{{ r.commas }}</p>
          </div>
          <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p class="text-xs font-medium text-gray-500 mb-1">In words</p>
            <p class="text-lg text-gray-800 select-all break-words">{{ r.words }}</p>
          </div>
        </div>
      }
    </main>
  `
})
export class NumberFormatter {
  readonly input = signal('');
  readonly error = signal('');

  readonly result = computed(() => {
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
}

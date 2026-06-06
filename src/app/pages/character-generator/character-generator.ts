import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SPECIAL = '!@#$%^&*()[]{}|?,.<>/-_=+;:`~';

function generateChars(chars: string, length: number): string {
  if (!chars.length) return '';
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => chars[b % chars.length]).join('');
}

@Component({
  selector: 'app-character-generator',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mt-4">
      <a routerLink="/" class="text-blue-500 text-sm hover:underline mb-6 inline-block">← All tools</a>

      <h2 class="text-gray-800 text-2xl font-bold mb-1">Character Generator</h2>
      <p class="text-gray-500 text-sm mb-6">Generate a random string with configurable length and character sets.</p>

      <div class="mb-5 space-y-3">
        <div class="flex items-center gap-3">
          <label class="text-sm font-medium text-gray-700 w-16" for="char-length">Length</label>
          <input id="char-length" type="number" [value]="length()" min="1" max="256"
            (input)="length.set(clampLength(($event.target as HTMLInputElement).value))"
            class="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        <div class="flex flex-wrap gap-4">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" [checked]="includeUpper()"
              (change)="includeUpper.set(($event.target as HTMLInputElement).checked)"
              class="w-4 h-4 accent-blue-500 cursor-pointer" />
            <span class="text-sm text-gray-700">A-Z</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" [checked]="includeLower()"
              (change)="includeLower.set(($event.target as HTMLInputElement).checked)"
              class="w-4 h-4 accent-blue-500 cursor-pointer" />
            <span class="text-sm text-gray-700">a-z</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" [checked]="includeDigits()"
              (change)="includeDigits.set(($event.target as HTMLInputElement).checked)"
              class="w-4 h-4 accent-blue-500 cursor-pointer" />
            <span class="text-sm text-gray-700">0-9</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" [checked]="includeSpecial()"
              (change)="includeSpecial.set(($event.target as HTMLInputElement).checked)"
              class="w-4 h-4 accent-blue-500 cursor-pointer" />
            <span class="text-sm text-gray-700 font-mono">!@#$%^&amp;*()[]{}&#92;|?,&lt;&gt;/-_=+;:\`~</span>
          </label>
        </div>
      </div>

      @if (charset().length === 0) {
        <p class="text-red-500 text-sm mb-4">Select at least one character set.</p>
      } @else {
        <div class="mb-4">
          <span class="font-mono text-2xl font-semibold tracking-widest text-gray-800 bg-gray-100 px-4 py-2 rounded-lg select-all break-all inline-block">
            {{ result() }}
          </span>
        </div>
      }

      <div class="flex gap-2">
        <button (click)="generate()" [disabled]="charset().length === 0"
          class="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors cursor-pointer">
          Generate
        </button>
        <button (click)="copy()" [disabled]="charset().length === 0 || !result()"
          class="px-4 py-2 border border-gray-300 hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 text-sm font-medium rounded-lg transition-colors cursor-pointer">
          {{ copied() ? 'Copied!' : 'Copy' }}
        </button>
      </div>
    </main>
  `
})
export class CharacterGenerator {
  length = signal(12);
  includeUpper = signal(true);
  includeLower = signal(true);
  includeDigits = signal(true);
  includeSpecial = signal(false);

  readonly charset = computed(() => {
    let s = '';
    if (this.includeUpper()) s += UPPER;
    if (this.includeLower()) s += LOWER;
    if (this.includeDigits()) s += DIGITS;
    if (this.includeSpecial()) s += SPECIAL;
    return s;
  });

  readonly result = signal(generateChars(UPPER + LOWER + DIGITS, 12));
  readonly copied = signal(false);

  clampLength(value: string): number {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1) return 1;
    if (n > 256) return 256;
    return n;
  }

  generate(): void {
    this.result.set(generateChars(this.charset(), this.length()));
    this.copied.set(false);
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.result());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // clipboard unavailable or permission denied -- silently ignore
    }
  }
}

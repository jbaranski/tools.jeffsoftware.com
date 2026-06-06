import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateUsername(): string {
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => CHARS[b % CHARS.length]).join('');
}

@Component({
  selector: 'app-username-generator',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mt-4">
      <a routerLink="/" class="text-blue-500 text-sm hover:underline mb-6 inline-block">← All tools</a>

      <h2 class="text-gray-800 text-2xl font-bold mb-1">Username Generator</h2>
      <p class="text-gray-500 text-sm mb-6">Generates a random 12-character string using A–Z, a–z, and 0–9.</p>

      <div class="flex items-center gap-3 mb-4">
        <span class="font-mono text-2xl font-semibold tracking-widest text-gray-800 bg-gray-100 px-4 py-2 rounded-lg select-all">
          {{ username() }}
        </span>
      </div>

      <div class="flex gap-2">
        <button (click)="generate()"
          class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer">
          Generate
        </button>
        <button (click)="copy()"
          class="px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 text-sm font-medium rounded-lg transition-colors cursor-pointer">
          {{ copied() ? 'Copied!' : 'Copy' }}
        </button>
      </div>
    </main>
  `
})
export class UsernameGenerator {
  readonly username = signal(generateUsername());
  readonly copied = signal(false);

  generate(): void {
    this.username.set(generateUsername());
    this.copied.set(false);
  }

  async copy(): Promise<void> {
    await navigator.clipboard.writeText(this.username());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}

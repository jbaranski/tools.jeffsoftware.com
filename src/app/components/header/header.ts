import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6 mt-4">
      <h1 class="text-gray-800 text-center text-4xl sm:text-[2.25rem] font-bold mb-1">
        <a routerLink="/" class="hover:text-blue-500 transition-colors">Jeff's Tools</a>
      </h1>
      <p class="text-center text-gray-500 text-sm font-light">A growing collection of handy utilities</p>
    </header>
  `
})
export class Header {}

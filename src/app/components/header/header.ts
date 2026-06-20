import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-header',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6 mt-4">
      <h1 class="text-gray-800 text-center text-4xl sm:text-[2.25rem] font-bold mb-1">Jeff's Tools</h1>
    </header>
  `
})
export class Header {}

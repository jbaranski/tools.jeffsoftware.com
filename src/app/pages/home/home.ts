import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Tool {
  name: string;
  description: string;
  route: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      <ul class="space-y-2">
        @for (tool of tools; track tool.route) {
          <li>
            <a [routerLink]="tool.route"
              class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group">
              <span class="text-blue-500 font-medium group-hover:underline">{{ tool.name }}</span>
              <span class="text-gray-500 text-sm">{{ tool.description }}</span>
            </a>
          </li>
        }
      </ul>
    </main>
  `
})
export class Home {
  readonly tools: Tool[] = [
    {
      name: 'TPS Calculator',
      description: 'Calculate throughput per second, minute, hour, and day from a count and time window.',
      route: '/tps',
    },
    {
      name: 'Username Generator',
      description: 'Generate a random 12-character alphanumeric string.',
      route: '/username-generator',
    },
    {
      name: 'Number Formatter',
      description: 'Format a number with comma separators and convert it to English words.',
      route: '/number-formatter',
    },
  ];
}

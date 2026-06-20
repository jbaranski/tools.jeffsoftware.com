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
      <ul class="space-y-1">
        @for (tool of tools; track tool.route) {
          <li>
            <a [routerLink]="tool.route" class="text-blue-500 hover:underline font-medium">{{ tool.name }}</a>
            <span class="text-gray-500 text-sm"> -- {{ tool.description }}</span>
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
      route: '/tps'
    },
    {
      name: 'Character Generator',
      description: 'Generate a random string with configurable length and character sets.',
      route: '/character-generator'
    },
    {
      name: 'Number Formatter',
      description: 'Format a number with comma separators and convert it to English words.',
      route: '/number-formatter'
    }
  ];
}

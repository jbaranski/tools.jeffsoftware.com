import ICAL from 'ical.js';
import { Component, ChangeDetectionStrategy, signal, computed, Pipe, PipeTransform } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

interface CalEvent {
  uid: string;
  summary: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  location: string;
  description: string;
  isRecurring: boolean;
}

interface DateGroup {
  dateKey: string;
  date: Date;
  events: CalEvent[];
}

@Pipe({ name: 'eventTime' })
export class EventTimePipe implements PipeTransform {
  transform(event: CalEvent): string {
    if (event.allDay) return 'All day';
    const fmt = (d: Date): string => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return event.end ? `${fmt(event.start)} - ${fmt(event.end)}` : fmt(event.start);
  }
}

@Pipe({ name: 'isPast' })
export class IsPastPipe implements PipeTransform {
  transform(event: CalEvent): boolean {
    const ref = event.end ?? event.start;
    return ref < new Date();
  }
}

const MAX_OCCURRENCES = 500;

function parseIcal(raw: string): CalEvent[] {
  const parsed = ICAL.parse(raw);
  const comp = new ICAL.Component(parsed);
  const vevents = comp.getAllSubcomponents('vevent');
  const events: CalEvent[] = [];

  for (const vevent of vevents) {
    const icalEvent = new ICAL.Event(vevent);
    if (!icalEvent.startDate) continue;

    if (icalEvent.isRecurring()) {
      const iter = icalEvent.iterator();
      let next = iter.next();
      let count = 0;
      while (next && count < MAX_OCCURRENCES) {
        try {
          const details = icalEvent.getOccurrenceDetails(next);
          events.push({
            uid: icalEvent.uid || `evt-${events.length}`,
            summary: icalEvent.summary || '(No title)',
            start: details.startDate.toJSDate(),
            end: details.endDate ? details.endDate.toJSDate() : null,
            allDay: details.startDate.isDate,
            location: icalEvent.location || '',
            description: icalEvent.description || '',
            isRecurring: true
          });
        } catch {
          // skip malformed occurrence
        }
        next = iter.next();
        count++;
      }
    } else {
      events.push({
        uid: icalEvent.uid || `evt-${events.length}`,
        summary: icalEvent.summary || '(No title)',
        start: icalEvent.startDate.toJSDate(),
        end: icalEvent.endDate ? icalEvent.endDate.toJSDate() : null,
        allDay: icalEvent.startDate.isDate,
        location: icalEvent.location || '',
        description: icalEvent.description || '',
        isRecurring: false
      });
    }
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function groupByDate(events: CalEvent[]): DateGroup[] {
  const map = new Map<string, DateGroup>();
  for (const event of events) {
    const d = event.start;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!map.has(key)) {
      map.set(key, {
        dateKey: key,
        date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        events: []
      });
    }
    map.get(key)!.events.push(event);
  }
  return Array.from(map.values());
}

@Component({
  selector: 'app-ical-viewer',
  imports: [RouterLink, DatePipe, EventTimePipe, IsPastPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mt-4">
      <a routerLink="/" class="text-blue-500 text-sm hover:underline mb-6 inline-block">← All tools</a>

      <h2 class="text-gray-800 text-2xl font-bold mb-1">iCal Viewer</h2>
      <p class="text-gray-500 text-sm mb-6">Paste .ics file content to view events in chronological order.</p>

      <div class="mb-6">
        <label class="block text-xs font-medium text-gray-600 mb-1">iCal content</label>
        <textarea
          [value]="rawInput()"
          (input)="onInput($event)"
          (blur)="onBlur()"
          rows="8"
          placeholder="Paste .ics content here, then tab away to parse..."
          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 resize-y"
        ></textarea>
        @if (error()) {
          <p class="text-red-500 text-xs mt-1">{{ error() }}</p>
        }
      </div>

      @if (groups().length > 0) {
        <p class="text-gray-500 text-sm mb-6">{{ totalCount() }} event{{ totalCount() === 1 ? '' : 's' }}</p>

        @for (group of groups(); track group.dateKey) {
          <div class="mb-6">
            <h3 class="text-gray-700 font-semibold text-sm pb-1 mb-3 border-b border-gray-200">
              {{ group.date | date: 'EEEE, MMMM d, y' }}
            </h3>
            <div class="space-y-3">
              @for (event of group.events; track event.uid + event.start.getTime()) {
                <div class="rounded-lg border border-gray-200 px-4 py-3" [class.opacity-50]="event | isPast">
                  <div class="flex items-start gap-4">
                    <span class="text-xs text-gray-500 font-mono pt-0.5 shrink-0 w-32">
                      {{ event | eventTime }}
                    </span>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-gray-800">
                        {{ event.summary }}
                        @if (event.isRecurring) {
                          <span class="ml-1 text-xs font-normal text-gray-400">(recurring)</span>
                        }
                      </p>
                      @if (event.location) {
                        <p class="text-xs text-gray-500 mt-1">{{ event.location }}</p>
                      }
                      @if (event.description) {
                        <p class="text-xs text-gray-400 mt-1 whitespace-pre-wrap">{{ event.description }}</p>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      }
    </main>
  `
})
export class ICalViewer {
  readonly rawInput = signal('');
  readonly parsedText = signal('');
  readonly error = signal('');

  readonly groups = computed<DateGroup[]>(() => {
    const text = this.parsedText();
    if (!text.trim()) return [];
    try {
      return groupByDate(parseIcal(text));
    } catch {
      return [];
    }
  });

  readonly totalCount = computed(() => this.groups().reduce((sum, g) => sum + g.events.length, 0));

  onInput(event: Event): void {
    this.rawInput.set((event.target as HTMLTextAreaElement).value);
  }

  onBlur(): void {
    const text = this.rawInput().trim();
    if (!text) {
      this.error.set('');
      this.parsedText.set('');
      return;
    }
    try {
      ICAL.parse(text);
      this.error.set('');
      this.parsedText.set(text);
    } catch {
      this.error.set('Invalid iCal content -- paste the full .ics file content.');
      this.parsedText.set('');
    }
  }
}

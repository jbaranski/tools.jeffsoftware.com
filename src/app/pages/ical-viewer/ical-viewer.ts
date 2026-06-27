import ICAL from 'ical.js';
import { Component, ChangeDetectionStrategy, signal, computed, Pipe, PipeTransform } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
}

function validateRfc5545(raw: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check CRLF line endings
  const hasCrlf = raw.includes('\r\n');
  const hasBareLf = /(?<!\r)\n/.test(raw);
  if (!hasCrlf && hasBareLf) {
    issues.push({
      severity: 'warning',
      message: 'RFC 5545 requires CRLF (\\r\\n) line endings, but only LF (\\n) line endings were found.'
    });
  } else if (hasCrlf && hasBareLf) {
    issues.push({
      severity: 'warning',
      message: 'Mixed line endings detected. RFC 5545 requires consistent CRLF (\\r\\n) line endings.'
    });
  }

  // Unfold lines for further analysis (replace CRLF+space or LF+space with nothing)
  const unfolded = raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r\n|\r|\n/);

  // Check line length (75 octets max before folding)
  const foldedLines = raw.split(/\r\n|\r|\n/);
  for (let i = 0; i < foldedLines.length; i++) {
    const bytes = new TextEncoder().encode(foldedLines[i]).length;
    if (bytes > 75) {
      issues.push({
        severity: 'warning',
        message: `Line ${i + 1} exceeds 75 octets (${bytes} octets). RFC 5545 requires long lines to be folded.`
      });
      break; // report only the first occurrence to avoid flooding
    }
  }

  // Must start with BEGIN:VCALENDAR
  if (!lines[0]?.match(/^BEGIN:VCALENDAR$/i)) {
    issues.push({ severity: 'error', message: 'File must begin with "BEGIN:VCALENDAR".' });
  }

  // Must end with END:VCALENDAR (ignoring trailing blank lines)
  const lastNonEmpty = [...lines].reverse().find((l) => l.trim() !== '');
  if (lastNonEmpty && !lastNonEmpty.match(/^END:VCALENDAR$/i)) {
    issues.push({ severity: 'error', message: 'File must end with "END:VCALENDAR".' });
  }

  // Check required VCALENDAR properties
  const vcalProps = new Set<string>();
  let inVcal = false;
  let depth = 0;
  for (const line of lines) {
    if (/^BEGIN:VCALENDAR$/i.test(line)) {
      inVcal = true;
      depth = 1;
      continue;
    }
    if (!inVcal) continue;
    if (/^BEGIN:/i.test(line)) {
      depth++;
      continue;
    }
    if (/^END:/i.test(line)) {
      depth--;
      if (depth === 0) break;
      continue;
    }
    if (depth === 1) {
      const m = line.match(/^([A-Z-]+)/i);
      if (m) vcalProps.add(m[1].toUpperCase());
    }
  }
  if (!vcalProps.has('PRODID')) {
    issues.push({ severity: 'error', message: 'VCALENDAR is missing the required PRODID property.' });
  }
  if (!vcalProps.has('VERSION')) {
    issues.push({ severity: 'error', message: 'VCALENDAR is missing the required VERSION property.' });
  } else {
    const versionLine = lines.find((l) => /^VERSION:/i.test(l));
    if (versionLine && !versionLine.match(/^VERSION:2\.0$/i)) {
      issues.push({
        severity: 'warning',
        message: `VERSION should be "2.0" per RFC 5545. Found: "${versionLine.split(':').slice(1).join(':')}"`
      });
    }
  }

  // Validate each VEVENT
  let inVevent = false;
  let veventProps = new Map<string, string[]>();
  const seenUids = new Map<string, number>();
  let veventCount = 0;

  for (const line of lines) {
    if (/^BEGIN:VEVENT$/i.test(line)) {
      inVevent = true;
      veventProps = new Map();
      veventCount++;
      continue;
    }
    if (/^END:VEVENT$/i.test(line)) {
      inVevent = false;
      const label = `VEVENT #${veventCount}`;

      // UID required
      if (!veventProps.has('UID')) {
        issues.push({ severity: 'error', message: `${label} is missing the required UID property.` });
      } else {
        const uid = veventProps.get('UID')![0];
        seenUids.set(uid, (seenUids.get(uid) ?? 0) + 1);
      }

      // DTSTART required
      if (!veventProps.has('DTSTART')) {
        issues.push({ severity: 'error', message: `${label} is missing the required DTSTART property.` });
      }

      // Must not have both DTEND and DURATION
      if (veventProps.has('DTEND') && veventProps.has('DURATION')) {
        issues.push({ severity: 'error', message: `${label} must not specify both DTEND and DURATION.` });
      }

      // DTEND must not be earlier than DTSTART
      if (veventProps.has('DTSTART') && veventProps.has('DTEND')) {
        const parseDate = (s: string) => {
          // strip VALUE=DATE: prefix or similar params
          const val = s.replace(/^.*:/, '');
          // basic parse: YYYYMMDDTHHMMSSZ or YYYYMMDD
          if (/^\d{8}T\d{6}Z?$/.test(val)) {
            return new Date(
              `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}T${val.slice(9, 11)}:${val.slice(11, 13)}:${val.slice(13, 15)}Z`
            );
          }
          if (/^\d{8}$/.test(val)) {
            return new Date(`${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`);
          }
          return null;
        };
        const start = parseDate(veventProps.get('DTSTART')![0]);
        const end = parseDate(veventProps.get('DTEND')![0]);
        if (start && end && end < start) {
          issues.push({ severity: 'error', message: `${label} has DTEND before DTSTART.` });
        }
      }

      // Check for unknown/non-standard property names (informational)
      const knownProps = new Set([
        'CLASS',
        'CREATED',
        'DESCRIPTION',
        'DTSTART',
        'GEO',
        'LAST-MODIFIED',
        'LOCATION',
        'ORGANIZER',
        'PRIORITY',
        'DTSTAMP',
        'SEQUENCE',
        'STATUS',
        'SUMMARY',
        'TRANSP',
        'UID',
        'URL',
        'RECURRENCE-ID',
        'RRULE',
        'DTEND',
        'DURATION',
        'ATTACH',
        'ATTENDEE',
        'CATEGORIES',
        'COMMENT',
        'CONTACT',
        'EXDATE',
        'RSTATUS',
        'RELATED',
        'RESOURCES',
        'RDATE',
        'EXRULE',
        'X-'
      ]);
      for (const prop of veventProps.keys()) {
        if (!prop.startsWith('X-') && !knownProps.has(prop)) {
          issues.push({
            severity: 'warning',
            message: `${label} uses non-standard property "${prop}". RFC 5545 requires custom properties to be prefixed with "X-".`
          });
        }
      }

      continue;
    }
    if (inVevent) {
      const m = line.match(/^([A-Z-]+)(?:[;:](.*))?$/i);
      if (m) {
        const key = m[1].toUpperCase();
        const val = m[2] ?? '';
        if (!veventProps.has(key)) veventProps.set(key, []);
        veventProps.get(key)!.push(val);
      }
    }
  }

  // Duplicate UIDs (different from RECURRENCE-ID-based recurrences)
  for (const [uid, count] of seenUids.entries()) {
    if (count > 1) {
      issues.push({
        severity: 'warning',
        message: `UID "${uid}" appears ${count} times. Duplicate UIDs are only valid for recurring event overrides (RECURRENCE-ID).`
      });
    }
  }

  if (veventCount === 0) {
    issues.push({ severity: 'warning', message: 'No VEVENT components found in the calendar.' });
  }

  return issues;
}

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
      <p class="text-gray-500 text-sm mb-6">
        Paste .ics file content to view events in chronological order. RFC 5545 issues are reported below the input.
      </p>

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

      @if (validationIssues().length > 0) {
        <div class="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p class="text-xs font-semibold text-amber-700 mb-2">
            RFC 5545 validation -- {{ validationIssues().length }} issue{{
              validationIssues().length === 1 ? '' : 's'
            }}
            found
          </p>
          <ul class="space-y-1">
            @for (issue of validationIssues(); track $index) {
              <li class="flex items-start gap-2 text-xs">
                <span
                  class="shrink-0 font-semibold"
                  [class]="issue.severity === 'error' ? 'text-red-600' : 'text-amber-600'"
                >
                  {{ issue.severity === 'error' ? 'Error' : 'Warning' }}
                </span>
                <span class="text-gray-700">{{ issue.message }}</span>
              </li>
            }
          </ul>
        </div>
      }

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
  readonly validationIssues = signal<ValidationIssue[]>([]);

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
      this.validationIssues.set([]);
      return;
    }
    try {
      ICAL.parse(text);
      this.error.set('');
      this.parsedText.set(text);
      this.validationIssues.set(validateRfc5545(text));
    } catch {
      this.error.set('Invalid iCal content -- paste the full .ics file content.');
      this.parsedText.set('');
      this.validationIssues.set([]);
    }
  }
}

import mermaid from 'mermaid';
import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  DestroyRef,
  signal,
  computed,
  effect,
  inject,
  viewChild
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

const DEFAULT_DIAGRAM = `flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Ship it]
    B -->|No| D[Debug]
    D --> B`;

const RENDER_DEBOUNCE_MS = 400;
const MIN_SCALE = 0.2;
const MAX_SCALE = 5;
const ZOOM_STEP = 1.2;

mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });

interface DragState {
  x: number;
  y: number;
  panX: number;
  panY: number;
}

@Component({
  selector: 'app-mermaid-diagram',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mt-4">
      <a routerLink="/" class="text-blue-500 text-sm hover:underline mb-6 inline-block">← All tools</a>

      <h2 class="text-gray-800 text-2xl font-bold mb-1">Mermaid Diagram Viewer</h2>
      <p class="text-gray-500 text-sm mb-6">
        Paste
        <a href="https://mermaid.js.org/intro/" target="_blank" rel="noopener" class="text-blue-500 hover:underline"
          >Mermaid</a
        >
        diagram syntax to render it live. Drag the canvas to pan, scroll to zoom.
      </p>

      @if (isFormCollapsed()) {
        <div class="mb-6">
          <button
            (click)="isFormCollapsed.set(false)"
            class="px-3 py-1.5 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded-lg cursor-pointer transition-colors"
          >
            Show diagram source
          </button>
        </div>
      } @else {
        <div class="mb-6">
          <div class="flex items-center justify-between mb-1">
            <label class="block text-xs font-medium text-gray-600" for="mermaid-input"
              >Mermaid diagram definition</label
            >
            <button
              (click)="isFormCollapsed.set(true)"
              class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors"
            >
              Collapse
            </button>
          </div>
          <textarea
            id="mermaid-input"
            [value]="diagramText()"
            (input)="onInput($event)"
            rows="10"
            spellcheck="false"
            placeholder="flowchart TD&#10;    A --> B"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 resize-y"
          ></textarea>
          @if (renderError()) {
            <p class="text-red-500 text-xs mt-1">{{ renderError() }}</p>
          }
        </div>
      }

      <div class="mb-6 flex items-center gap-2">
        <button
          (click)="zoomOut()"
          class="w-7 h-7 border border-gray-300 hover:border-gray-400 text-gray-600 text-sm font-medium rounded cursor-pointer transition-colors"
        >
          −
        </button>
        <button
          (click)="zoomIn()"
          class="w-7 h-7 border border-gray-300 hover:border-gray-400 text-gray-600 text-sm font-medium rounded cursor-pointer transition-colors"
        >
          +
        </button>
        <button
          (click)="resetView()"
          class="px-2 py-1 border border-gray-300 hover:border-gray-400 text-gray-600 text-xs font-medium rounded cursor-pointer transition-colors"
        >
          Reset view
        </button>
        <span class="text-xs text-gray-400">{{ zoomPercent() }}</span>
      </div>

      <div
        #canvasContainer
        class="relative border border-gray-200 rounded-xl overflow-hidden bg-gray-50 h-[70vh] touch-none select-none"
        [class.cursor-grabbing]="isPanning()"
        [class.cursor-grab]="!isPanning()"
        (wheel)="onWheel($event)"
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointerleave)="onPointerUp($event)"
      >
        @if (renderedSvg(); as svg) {
          <div class="absolute top-0 left-0 origin-top-left" [style.transform]="transform()" [innerHTML]="svg"></div>
        } @else if (!renderError()) {
          <p class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
            Enter a diagram above to see it rendered here.
          </p>
        }
      </div>
    </main>
  `
})
export class MermaidDiagram {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly document = inject(DOCUMENT);
  private readonly canvasContainer = viewChild.required<ElementRef<HTMLDivElement>>('canvasContainer');

  private renderTimeoutHandle: ReturnType<typeof setTimeout> | undefined;
  private renderCounter = 0;
  private dragStart: DragState | null = null;

  readonly diagramText = signal(DEFAULT_DIAGRAM);
  readonly renderedSvg = signal<SafeHtml | null>(null);
  readonly renderError = signal<string | null>(null);
  readonly isFormCollapsed = signal(false);
  readonly isPanning = signal(false);

  readonly scale = signal(1);
  readonly panX = signal(0);
  readonly panY = signal(0);

  readonly transform = computed(() => `translate(${this.panX()}px, ${this.panY()}px) scale(${this.scale()})`);
  readonly zoomPercent = computed(() => `${Math.round(this.scale() * 100)}%`);

  constructor() {
    void this.renderDiagram(this.diagramText());

    let isFirstRun = true;
    effect(() => {
      const text = this.diagramText();
      if (isFirstRun) {
        isFirstRun = false;
        return;
      }
      clearTimeout(this.renderTimeoutHandle);
      this.renderTimeoutHandle = setTimeout(() => void this.renderDiagram(text), RENDER_DEBOUNCE_MS);
    });

    inject(DestroyRef).onDestroy(() => clearTimeout(this.renderTimeoutHandle));
  }

  onInput(event: Event): void {
    this.diagramText.set((event.target as HTMLTextAreaElement).value);
  }

  async renderDiagram(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      this.renderedSvg.set(null);
      this.renderError.set(null);
      return;
    }

    const requestId = ++this.renderCounter;
    const id = `mermaid-diagram-${requestId}`;
    try {
      const { svg } = await mermaid.render(id, trimmed);
      if (requestId !== this.renderCounter) return; // a newer render started while this one was in flight
      this.renderedSvg.set(this.sanitizer.bypassSecurityTrustHtml(svg));
      this.renderError.set(null);
    } catch (err) {
      this.document.getElementById(id)?.remove();
      if (requestId !== this.renderCounter) return;
      this.renderError.set(err instanceof Error ? err.message : 'Failed to render diagram.');
    }
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    this.zoomAt(event.clientX, event.clientY, factor, event.currentTarget as HTMLElement);
  }

  zoomIn(): void {
    this.zoomAtContainerCenter(ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoomAtContainerCenter(1 / ZOOM_STEP);
  }

  private zoomAtContainerCenter(factor: number): void {
    const el = this.canvasContainer().nativeElement;
    const rect = el.getBoundingClientRect();
    this.zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor, el);
  }

  resetView(): void {
    this.scale.set(1);
    this.panX.set(0);
    this.panY.set(0);
  }

  private zoomAt(clientX: number, clientY: number, factor: number, container: HTMLElement): void {
    const rect = container.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;
    const currentScale = this.scale();
    const newScale = Math.min(Math.max(currentScale * factor, MIN_SCALE), MAX_SCALE);
    const scaleRatio = newScale / currentScale;

    this.panX.update((x) => offsetX - (offsetX - x) * scaleRatio);
    this.panY.update((y) => offsetY - (offsetY - y) * scaleRatio);
    this.scale.set(newScale);
  }

  onPointerDown(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.dragStart = { x: event.clientX, y: event.clientY, panX: this.panX(), panY: this.panY() };
    this.isPanning.set(true);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragStart) return;
    this.panX.set(this.dragStart.panX + (event.clientX - this.dragStart.x));
    this.panY.set(this.dragStart.panY + (event.clientY - this.dragStart.y));
  }

  onPointerUp(event: PointerEvent): void {
    if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    }
    this.dragStart = null;
    this.isPanning.set(false);
  }
}

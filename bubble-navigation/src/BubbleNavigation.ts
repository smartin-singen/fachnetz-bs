import {
  css,
  html,
  LitElement,
  PropertyValues,
  svg,
  TemplateResult,
} from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { ifDefined } from 'lit/directives/if-defined.js';

interface Bubble {
  id: string;
  label: string;
  color: string;
  size?: 'small' | 'large';
  indent?: 'yes' | 'no';
  links?: Record<string, string>;
}

export class BubbleNavigation extends LitElement {
  static styles = [
    css`
      :host {
        display: block;
        box-sizing: border-box;
        container-type: inline-size;
        font-size: 16px;
      }
      *,
      *::before,
      *::after {
        box-sizing: border-box;
      }
      select {
        border-radius: 8px;
        border: none;
        box-shadow:
          0px 2px 1px -1px rgba(0, 0, 0, 0.2),
          0px 1px 1px 0px rgba(0, 0, 0, 0.14),
          0px 1px 3px 0px rgba(0, 0, 0, 0.12);
        padding: 8px;
        margin-bottom: 8px;
        max-width: 100%;
      }
      .main {
        background-color: hsl(311, 36%, 90%);
        border-radius: 8px;
        box-shadow:
          0px 2px 1px -1px rgba(0, 0, 0, 0.2),
          0px 1px 1px 0px rgba(0, 0, 0, 0.14),
          0px 1px 3px 0px rgba(0, 0, 0, 0.12);
        padding: 10px;
      }
      .main label {
        display: block;
        padding: 10px;
      }
      .groups {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        grid-auto-flow: dense;
        grid-auto-rows: 1px;
        column-gap: 8px;
        row-gap: 0;
        justify-items: center;
        width: 100%;
      }
      .groups > div {
        width: 100%;
        max-width: 280px;
        display: flex;
        justify-content: center;
        margin-bottom: 12px;
      }
      .groups svg {
        width: 100%;
        max-width: 250px;
        height: auto;
        display: block;
      }
      @container (max-width: 500px) {
        .groups {
          grid-template-columns: 1fr;
          grid-auto-rows: auto;
        }
        .groups > div {
          grid-row: auto !important;
        }
      }
      @media screen and (max-width: 500px) {
        .groups {
          grid-template-columns: 1fr;
          grid-auto-rows: auto;
        }
        .groups > div {
          grid-row: auto !important;
        }
      }
      :host([narrow]) .groups {
        grid-template-columns: 1fr;
        grid-auto-rows: auto;
      }
      :host([narrow]) .groups > div {
        grid-row: auto !important;
      }
      foreignObject body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: transparent;
      }
      .label {
        display: flex;
        height: 100%;
        justify-content: center;
        align-items: center;
        text-align: center;
        text-decoration: underline transparent;
        transition: text-decoration 0.3s ease-in-out;
      }
      .label[link] {
        cursor: pointer;
      }
      .label[link]:hover {
        text-decoration: underline black;
      }
      rect.bubble {
        filter: url(#white-glow);
      }
    `,
  ];

  declare shadowRoot: ShadowRoot;

  @property({ type: Boolean, reflect: true })
  narrow: boolean = false;

  private resizeObserver?: ResizeObserver;

  @state()
  private types?: Record<string, string>;

  @state()
  private groups?: Bubble[][];

  @state()
  private type: string = 'alle';

  @query('#schooltype')
  private select!: HTMLSelectElement;

  connectedCallback() {
    super.connectedCallback();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          this.narrow = entry.contentRect.width <= 500;
        }
      });
      this.resizeObserver.observe(this);
    } else {
      installMediaQueryWatcher(
        `(max-width: 500px)`,
        matches => (this.narrow = matches),
      );
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
  }

  protected firstUpdated(_changedProperties: PropertyValues) {
    if (sessionStorage.getItem('schulart'))
      this.type = sessionStorage.getItem('schulart') || 'alle';
  }

  updateSlotted({ target }: { target: EventTarget | null }) {
    const slot = target as HTMLSlotElement | null;
    const content = slot
      ?.assignedNodes()
      .map(n => n.textContent)
      .join('');
    if (content) {
      try {
        const data = JSON.parse(content);
        this.types = data.types;
        this.groups = data.groups;
      } catch (err) {
        console.error(
          'Failed to parse slotted JSON data in bubble-navigation:',
          err,
        );
      }
    }
  }

  selectType(e: Event) {
    this.type = (e.target as HTMLSelectElement).value;
    sessionStorage.setItem('schulart', this.type);
  }

  navigate(e: Event) {
    const target = (e.target as HTMLElement | null)?.closest(
      '[link]',
    ) as HTMLElement | null;
    const id =
      target?.getAttribute('link') ||
      (e.target as HTMLElement | null)?.getAttribute('link');
    const bubble = this.groups?.flatMap(b => b).find(b => b.id === id);
    const links = bubble?.links;
    const map = new Map(Object.entries(links || {}));
    const destination = map.get(this.type) || map.get('alle');
    if (destination) window.location.href = destination;
  }

  renderBubble(
    b: Bubble,
    x: number,
    y: number,
    width = 200,
    height = 60,
  ): TemplateResult {
    return svg`
      <rect class="bubble" x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" style="fill: ${b.color}; pointer-events: all"/>
      <foreignobject x="${x}" y="${y}" width="${width}" height="${height}" @click="${this.navigate}">
        <body xmlns="http://www.w3.org/1999/xhtml"><div class="label" link="${ifDefined(b.links ? b.id : undefined)}">${unsafeHTML(b.label)}</div></body>
      </foreignobject>
    `;
  }
  connect(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    type?: string,
  ): TemplateResult {
    switch (type) {
      case 'vh':
        return svg`<path d="M ${x1} ${y1} V ${y2} H ${x2}" stroke="black" fill="none"/>`;
      case 'hv':
        return svg`<path d="M ${x1} ${y1} H ${x2} V ${y2}" stroke="black" fill="none"/>`;
      default:
        return svg`<path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="black" fill="none" shape-rendering="geometricPrecision"/>`;
    }
  }

  render() {
    return html`
      <div hidden>
        <slot @slotchange=${this.updateSlotted}></slot>
      </div>
      <select
        id="schooltype"
        name="schooltype"
        data-initial-value="alle"
        @input="${this.selectType}"
      >
        <option ?selected="${this.type === 'alle'}" value="alle">
          - Alle -
        </option>
        ${Object.entries(this.types || {}).map(([a, b]) => html`<option value="${a}" ?selected="${this.type === a}">${b}</option>`)}
      </select>
      <div class="main">
        <label>Landesfachschaft Mathematik</label>
        <div class="groups">
          ${(this.groups || []).map(
            g =>
              html`<div style="grid-row: span ${g.length * 70 + 22};">
                ${this.renderGroup(g)}
              </div>`,
          )}
        </div>
      </div>
    `;
  }

  private renderGroup(group: Bubble[]) {
    const height = 50;
    return html`
      <svg
        viewBox="0 0 250 ${group.length * (height + 20) + 10}"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="white-glow">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="1.8"
              flood-color="white"
            ></feDropShadow>
          </filter>
        </defs>
        ${group
          .slice(1)
          .map(
            (b, i) => html`
              ${this.connect(30, 40, 40, 40 + (i + 1) * (height + 20), 'vh')}
            `,
          )}
        ${group
          .slice(1)
          .map(
            (b, i) => html`
              ${this.renderBubble(b, b.indent === 'no' ? 10 : 40, 10 + (i + 1) * (height + 20))}
            `,
          )}
        ${this.connect(30, 40, 40, 40, 'vh')}
        ${this.renderBubble(group[0], group[0].indent === 'no' ? 10 : 40, 10, group[0].size === 'large' ? 200 : 70, 60)}
      </svg>
    `;
  }
}

export const installMediaQueryWatcher = (
  mediaQuery: string,
  layoutChangedCallback: (mediaQueryMatches: boolean) => void,
) => {
  const mql = window.matchMedia(mediaQuery);
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', e => layoutChangedCallback(e.matches));
  } else {
    (mql as any).addListener(e => layoutChangedCallback(e.matches));
  }
  layoutChangedCallback(mql.matches);
};

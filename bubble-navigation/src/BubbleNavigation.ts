import {css, html, LitElement, PropertyValues, svg, TemplateResult} from 'lit';
import {query, state} from 'lit/decorators.js';
import {unsafeHTML} from "lit/directives/unsafe-html.js";
import {ifDefined} from "lit/directives/if-defined.js";

interface Bubble {
  id: string,
  label: string,
  color: string,
  size?: 'small' | 'large',
  indent?: 'yes' | 'no',
  links?: Object
}

export class BubbleNavigation extends LitElement {
  static styles = [css`
    :host {
      display: block;
      font-size: 16px;
    }
    select {
      border-radius: 8px;
      border: none;
      box-shadow: 0px 2px 1px -1px rgba(0, 0, 0, 0.2), 0px 1px 1px 0px rgba(0, 0, 0, 0.14), 0px 1px 3px 0px rgba(0, 0, 0, 0.12);
      padding: 8px;
      margin-bottom: 8px;
    }
    .main {
      background-color: hsl(311, 36%, 90%);
      border-radius: 8px;
      box-shadow: 0px 2px 1px -1px rgba(0, 0, 0, 0.2), 0px 1px 1px 0px rgba(0, 0, 0, 0.14), 0px 1px 3px 0px rgba(0, 0, 0, 0.12);
      padding: 10px;
    }
    .main label {
      display: block;
      padding: 10px;
    }
    .groups {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      grid-auto-flow: row;
      grid-auto-rows: min-content;
    }
    @media screen and (max-width: 300px) {
      .groups {
        grid-template-columns: 1fr;
      }
    }
    .label {
      display: flex;
      height: 100%;
      justify-content: center;
      align-items: center;
      text-align: center;
      text-decoration: underline transparent;
      transition: text-decoration .3s ease-in-out;
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
  `];

  declare shadowRoot: ShadowRoot;

  @state()
  private narrow: boolean = false;

  @state()
  private types?: Object;

  @state()
  private groups?: Bubble[][];

  @state()
  private type: string = "alle";

  @query('#type')
  private select!: HTMLSelectElement;

  connectedCallback() {
    super.connectedCallback();
    installMediaQueryWatcher(`(max-width: 500px)`, (matches) => this.narrow = matches);
  }

  protected firstUpdated(_changedProperties: PropertyValues) {
    if (sessionStorage.getItem("schulart"))
      this.type = sessionStorage.getItem("schulart") || "alle";
  }

  updateSlotted({target}) {
    let content = target.assignedNodes().map((n) => n.textContent).join('');
    if (content) {
      this.types = JSON.parse(content).types;
      this.groups = JSON.parse(content).groups;
      }
  }

  selectType(e) {
    this.type = e.target.value;
    sessionStorage.setItem("schulart", this.type);
  }

  navigate(e) {
    const id = e.target.getAttribute('link');
    const bubble = this.groups!.flatMap(b => b).find(b => b.id === id);
    const links = bubble?.links;
    const map = new Map(Object.entries(links || {}))
    const target = map.get(this.type) || map.get('alle');
    if (target)
      window.location.href = target;
  }

  renderBubble(b, x, y, width= 200, height = 60): TemplateResult {
    return svg`
      <rect class="bubble" x="${x}" y="${y}" width="${width}" height="${height}" rx="${height/2}" style="fill: ${b.color}; pointer-events: all"/>
      <foreignobject x="${x}" y="${y}" width="${width}" height="${height}" @click="${this.navigate}">
        <body xmlns="http://www.w3.org/1999/xhtml"><div class="label" link="${ifDefined(b.links ? b.id : undefined)}">${unsafeHTML(b.label)}</div></body>
      </foreignobject>
    `;
  }
  connect(x1: number, y1: number, x2: number, y2: number, type?: string): TemplateResult {
    switch (type) {
      case 'vh': return svg`<path d="M ${x1} ${y1} V ${y2} H ${x2}" stroke="black" fill="none"/>`;
      case 'hv': return svg`<path d="M ${x1} ${y1} H ${x2} V ${y2}" stroke="black" fill="none"/>`;
      default: return svg`<path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="black" fill="none" shape-rendering="geometricPrecision"/>`;
    }
  }

  render() {
    return html`
      <div hidden>
        <slot @slotchange=${this.updateSlotted}></slot>
      </div>
      <select id="schooltype" name="schooltype" data-initial-value="alle" @input="${this.selectType}">
        <option ?selected="${this.type === 'alle'}" value="alle">- Alle -</option>
        ${Object.entries(this.types || {}).map(([a, b]) => html`<option value="${a}" ?selected="${this.type === a}">${b}</option>`)}
      </select>
      <div class="main">
        <label>Landesfachschaft Mathematik</label>
        <div class="groups">
          ${(this.groups || []).map((g) => html`<div>${this.renderGroup(g)}</div>`)}
        </div>
      </div>
    `;
  }

  private renderGroup(group: Bubble[]) {
    const height = 50;
    return html`
      <svg viewBox="0 0 250 ${group.length*(height+20)+10}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="white-glow">
            <feDropShadow dx="0" dy="0" stdDeviation="1.8" flood-color="white"></feDropShadow>
          </filter>
        </defs>
        ${group.slice(1).map((b, i) => html`
          ${this.connect(30, 40, 40, 40 + (i+1)*(height+20), 'vh' )}
        `)}
        ${group.slice(1).map((b, i) => html`
          ${this.renderBubble(b, b.indent === 'no' ? 10 : 40, 10 + (i+1)*(height+20) )}
        `)}
        ${this.connect(30, 40, 40, 40, 'vh' )}
        ${this.renderBubble(group[0], group[0].indent === 'no' ? 10 : 40, 10, group[0].size === 'large' ? 200 : 70, 60)}
      </svg>
    `;
  }
}

export const installMediaQueryWatcher = (mediaQuery: string, layoutChangedCallback: (mediaQueryMatches: boolean) => void) => {
  let mql = window.matchMedia(mediaQuery);
  mql.addListener((e) => layoutChangedCallback(e.matches));
  layoutChangedCallback(mql.matches);
};

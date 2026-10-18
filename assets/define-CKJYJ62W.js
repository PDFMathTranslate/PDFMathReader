import{l as a,f as c,a as u,Q as h,a9 as b,aa as f,E as m,ab as g,i as r,a0 as p,ac as i,ad as l,X as o,Y as $,a5 as x,ae as S,N as y,c as n,z as v,F as k,O as C,_ as z,a8 as F}from"./tslib.es6-CzkoCd3t.js";import{t as w}from"./tab.options-CZ0bDa5D.js";import{s as A,e as N,S as D}from"./start-end-B7sBb4aN.js";import{a as E}from"./apply-mixins-D6LS69Y2.js";import{m as T}from"./autofocus-CXXx0V4B.js";import"./update-queue-CiMQqwBQ.js";import"./template-helpers-D_FBWwsr.js";import"./ref-GYoWfgVs.js";const H=n`
  ${y("inline-flex")}

  :host {
    position: relative;
    flex-direction: row;
    align-items: center;
    cursor: pointer;
    box-sizing: border-box;
    justify-content: center;
    line-height: ${a};
    font-family: ${c};
    font-size: ${u};
    color: ${h};
    fill: currentcolor;
    grid-row: 1;
    padding: ${b} ${f};
    border-radius: ${m};
    gap: 4px;
  }

  :host .tab-content {
    display: inline-flex;
    flex-direction: column;
    padding: 0 2px;
    grid-column: 3;
  }

  :host([aria-selected='true']) {
    color: ${g};
    font-weight: ${r};
  }

  /* adds hidden textContent to prevent shifting ui on bold / unbolding of text */
  :host .tab-content::after {
    content: var(--textContent);
    visibility: hidden;
    height: 0;
    line-height: ${a};
    font-weight: ${r};
  }

  :host([aria-selected='true'])::after {
    background-color: ${p};
    border-radius: ${i};
    content: '';
    inset: 0;
    position: absolute;
    z-index: 2;
  }

  :host([aria-selected='false']:hover)::after {
    background-color: ${l};
    border-radius: ${i};
    content: '';
    inset: 0;
    position: absolute;
    z-index: 1;
  }

  /*
   * TODO: Remove '(text-size-adjust: auto)' after this bug is fixed:
   * https://bugs.webkit.org/show_bug.cgi?id=298646
   * Also remove the same trick from tablist.styles.ts.
   * Using '@supports (text-size-adjust: auto)' here to exclude Safari 26 from
   * using CSS Anchor Positioning here because it crashes.
   */
  @supports (anchor-name: --a) and (text-size-adjust: auto) {
    :host([aria-selected='true'])::after {
      background-color: transparent;
    }

    :host([aria-selected='true']:hover)::after {
      background-color: ${l};
    }
  }

  :host([aria-selected='true'][disabled])::after {
    background-color: ${o};
  }

  ::slotted([slot='start']) {
    grid-column: 2;
  }

  ::slotted([slot='end']) {
    grid-column: -1;
  }

  ::slotted([slot='start']),
  ::slotted([slot='end']) {
    display: flex;
  }
  :host([disabled]) {
    cursor: not-allowed;
    fill: ${o};
    color: ${o};
    pointer-events: none;
  }

  :host([disabled]:hover)::after {
    background-color: unset;
  }

  :host(:focus) {
    outline: none;
  }

  :host(:focus-visible) {
    border-radius: ${$};
    box-shadow: 0 0 0 3px ${x};
    outline: 1px solid ${S};
  }

  @media (forced-colors: active) {
    :host([aria-selected='true'])::after {
      background-color: Highlight;
    }
  }
`;function j(t={}){return v`
    <template slot="tab" role="tab">
      ${A(t)}
      <span class="tab-content"><slot></slot></span>
      ${N(t)}
    </template>
  `}const B=j({}),I={name:w,registry:k.registry,styles:H,template:B};class s extends C{disabledChanged(e,d){this.setDisabledSideEffect(d)}constructor(){super(),this.elementInternals=this.attachInternals(),this.elementInternals.role="tab"}connectedCallback(){super.connectedCallback(),this.slot||="tab",this.setDisabledSideEffect(this.disabled),this.styles&&this.$fastController.removeStyles(this.styles),this.styles=n`
      :host {
        --textContent: '${this.textContent}';
      }
    `,this.$fastController.addStyles(this.styles),T(this)}setDisabledSideEffect(e){e?this.setAttribute("aria-disabled","true"):this.removeAttribute("aria-disabled"),this.tabIndex=e&&this.getAttribute("aria-selected")!=="true"?-1:0}}z([F({mode:"boolean"})],s.prototype,"disabled",void 0);E(s,D);s.define(I);

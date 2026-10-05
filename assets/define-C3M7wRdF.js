import{f as c,k as h,h as m,y as f,az as u,C as b,a8 as g,a2 as v,e as k,a3 as x,F as S,a4 as w,a5 as n,a6 as l}from"./tslib.es6-DFwJ_Q0V.js";import{t as $}from"./listbox.options-Dhd6118x.js";import{f as y}from"./index-DG1rUMpn.js";import{r as I}from"./ref-DmzTP_6E.js";import{i as a}from"./option.options-Bt9oS4Vo.js";import{t as z}from"./element-internals-C8Nb3xsl.js";import{w as p}from"./request-idle-callback-_-ooO1Bt.js";import{u as C}from"./unique-id-V1kxbCVl.js";import{U as H}from"./update-queue-CiMQqwBQ.js";const O=k`
  ${v("inline-flex")}

  :host {
    background-color: ${c};
    border-radius: ${h};
    border: ${m} solid ${f};
    box-shadow: ${u};
    box-sizing: border-box;
    flex-direction: column;
    margin: 0;
    min-inline-size: 160px;
    padding: ${b};
    row-gap: ${g};
    width: auto;
  }

  :host([popover]) {
    inset: unset;
    overflow: auto;
  }

  @supports (anchor-name: --anchor) {
    :host([popover]) {
      position: fixed;
      max-block-size: var(--listbox-max-height, calc(50vh - anchor-size(self-block)));
      min-inline-size: anchor-size(inline);
      inset-block-start: anchor(outside);
      inset-inline-start: anchor(inside);
      position-try-fallbacks: flip-block, flip-inline, flip-inline flip-block;
    }
  }

  @supports not (anchor-name: --anchor) {
    :host([popover]) {
      margin-block-start: var(--margin-offset, 0);
      max-block-size: var(--listbox-max-height, 50vh);
      position: absolute;
    }

    :host([popover]${y}) {
      margin-block-start: revert;
      translate: 0 -100%;
    }
  }
`;function E(){return x`
    <template
      @beforetoggle="${(s,e)=>s.beforetoggleHandler(e.event)}"
      @click="${(s,e)=>s.clickHandler(e.event)}"
    >
      <slot ${I("defaultSlot")} @slotchange="${(s,e)=>s.slotchangeHandler(e.event)}"></slot>
    </template>
  `}const F=E(),T={name:$,registry:S.registry,styles:O,template:F};class i extends w{defaultSlotChanged(){this.slotchangeHandler()}multipleChanged(e,t){this.elementInternals.ariaMultiSelectable=t?"true":"false",z(this.elementInternals,"multiple",t),H.enqueue(()=>{this.options.forEach(o=>{o.multiple=!!t})})}optionsChanged(e,t){t?.forEach((o,r)=>{o.elementInternals.ariaPosInSet=`${r+1}`,o.elementInternals.ariaSetSize=`${t.length}`})}beforetoggleHandler(e){if(!this.dropdown)return!0;if(this.dropdown.disabled){this.dropdown.open=!1;return}return this.dropdown.open=e.newState==="open",!0}get enabledOptions(){return this.options?.filter(e=>!e.disabled)??Array.from(this.querySelectorAll("*")).filter(e=>a(e)&&!e.disabled)??[]}get selectedOptions(){return this.options?.filter(e=>e.selected)??[]}clickHandler(e){if(this.dropdown)return!0;const t=e.target;return a(t)&&this.selectOption(this.enabledOptions.indexOf(t)),!0}constructor(){super(),this.elementInternals=this.attachInternals(),this.elementInternals.role="listbox"}connectedCallback(){super.connectedCallback(),p(this,()=>{this.id=this.id||C("listbox-")},{shallow:!0})}handleChange(e,t){if(t==="multiple"){this.multiple=e.multiple;return}}selectOption(e=this.selectedIndex){let t=this.selectedIndex;if(!this.multiple)this.enabledOptions.forEach((o,r)=>{const d=r===e;o.selected=d,d&&(t=r)});else{const o=this.enabledOptions[e];o&&(o.selected=!o.selected),t=e}this.selectedIndex=t}slotchangeHandler(e){p(this,()=>{if(this.defaultSlot){const t=this.defaultSlot.assignedElements().filter(o=>a(o));this.options=t}})}}n([l],i.prototype,"defaultSlot",void 0);n([l],i.prototype,"multiple",void 0);n([l],i.prototype,"options",void 0);n([l],i.prototype,"selectedIndex",void 0);n([l],i.prototype,"dropdown",void 0);i.define(T);

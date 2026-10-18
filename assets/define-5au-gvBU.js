import{D as u,E as b,Q as v,L as f,R as h,T as k,U as $,V as y,W as S,X as I,Y as C,G as x,Z as F,$ as N,a0 as V,a1 as B,a2 as w,a3 as A,a4 as D,a5 as z,a6 as O,N as T,c as _,z as g,F as H,O as E,a7 as d,_ as o,P as l,a8 as a}from"./tslib.es6-CzkoCd3t.js";import{t as M}from"./option.options-DXdFxJtw.js";import{t as P,a as R}from"./typography.partials-BGt05CIW.js";import{n,s as p,m as s,a as U,d as W}from"./index-BgWasc71.js";import{s as q}from"./start-end-B7sBb4aN.js";import{s as G}from"./template-helpers-D_FBWwsr.js";import{s as m,e as L}from"./slotted-BJWj9nbx.js";import{t as i}from"./element-internals-aotE4GzR.js";import{u as X}from"./unique-id-V1kxbCVl.js";import{U as j}from"./update-queue-CiMQqwBQ.js";import"./ref-GYoWfgVs.js";const Q=_`
  ${T("inline-grid")}

  :host {
    -webkit-tap-highlight-color: transparent;
    ${P}
    align-items: center;
    background-color: ${u};
    border-radius: ${b};
    box-sizing: border-box;
    color: ${v};
    column-gap: ${f};
    cursor: pointer;
    grid-template-areas: 'indicator start content';
    grid-template-columns: auto auto 1fr;
    min-height: 32px;
    padding: ${h};
    text-align: start;
  }

  .content {
    grid-area: content;
    line-height: 1;
  }

  ::slotted([slot='start']) {
    grid-area: start;
  }

  :host(:hover) {
    background-color: ${k};
    color: ${$};
  }

  :host(:active) {
    background-color: ${y};
    color: ${S};
  }

  :host(${n}) {
    background-color: ${u};
    color: ${I};
    cursor: default;
  }

  .checkmark-16-filled {
    fill: currentColor;
    width: 16px;
  }

  slot[name='checked-indicator'] > *,
  ::slotted([slot='checked-indicator']) {
    aspect-ratio: 1;
    flex: 0 0 auto;
    grid-area: indicator;
    visibility: hidden;
  }

  :host(${p}) :is(slot[name='checked-indicator'] > *, ::slotted([slot='checked-indicator'])) {
    visibility: visible;
  }

  :host(${s}) .checkmark-16-filled,
  :host(:not(${s})) .checkmark-12-regular {
    display: none;
  }

  :host(${s}) .checkmark-12-regular {
    background-color: ${u};
    border-radius: ${C};
    border: ${x} solid ${F};
    box-sizing: border-box;
    cursor: pointer;
    fill: transparent;
    position: relative;
    visibility: visible;
    width: 16px;
  }

  :host(${s}${p}) .checkmark-12-regular {
    background-color: ${N};
    border-color: ${V};
    fill: ${B};
  }

  :host(${n}${s}) .checkmark-12-regular {
    border-color: ${w};
  }

  :host(${n}${s}${p}) .checkmark-12-regular {
    background-color: ${A};
  }

  :host(${U}) {
    border: ${D} solid ${z};
  }

  @supports (selector(:host(:has(*)))) {
    :host(:has([slot='start']:not([size='16']))) {
      column-gap: ${h};
    }
  }

  :host(${W}) {
    column-gap: ${h};
    grid-template-areas:
      'indicator start content'
      'indicator start description';
  }

  ::slotted([slot='description']) {
    color: ${O};
    grid-area: description;
    ${R}
  }

  @media (forced-colors: active) {
    :host(${n}) {
      color: GrayText;
    }
  }
`,Y=g.partial(`
  <svg aria-hidden="true" class="checkmark-16-filled" viewBox="0 0 16 16">
    <path
      d="M14.046 3.486a.75.75 0 0 1-.032 1.06l-7.93 7.474a.85.85 0 0 1-1.188-.022l-2.68-2.72a.75.75 0 1 1 1.068-1.053l2.234 2.267l7.468-7.038a.75.75 0 0 1 1.06.032"
    />
  </svg>
  <svg aria-hidden="true" class="checkmark-12-regular" viewBox="0 0 12 12">
    <path
      d="M9.854 3.146a.5.5 0 0 1 0 .708l-4.5 4.5a.5.5 0 0 1-.708 0l-2-2a.5.5 0 1 1 .708-.708L5 7.293l4.146-4.147a.5.5 0 0 1 .708 0"
    />
  </svg>
`);function Z(c={}){return g`
    <slot name="checked-indicator">${G(c.checkedIndicator)}</slot>
    ${q(c)}
    <div class="content" part="content">
      <slot ${m({property:"freeformOutputs",filter:L("output")})}></slot>
    </div>
    <div class="description" part="description">
      <slot name="description" ${m("descriptionSlot")}></slot>
    </div>
  `}const J=Z({checkedIndicator:Y}),K={name:M,registry:H.registry,styles:Q,template:J};class r extends E{activeChanged(e,t){i(this.elementInternals,"active",t)}currentSelectedChanged(e,t){this.selected=!!t}defaultSelectedChanged(e,t){this.selected=!!t}descriptionSlotChanged(e,t){i(this.elementInternals,"description",!!t?.length)}disabledChanged(e,t){this.elementInternals.ariaDisabled=this.disabled?"true":"false",i(this.elementInternals,"disabled",this.disabled),this.setFormValue(!this.disabled&&this.selected?this.value:null)}disabledAttributeChanged(e,t){this.disabled=!!t}initialValueChanged(e,t){this._value=t}multipleChanged(e,t){i(this.elementInternals,"multiple",t),this.selected=!1}get form(){return this.elementInternals.form}static{this.formAssociated=!0}get labels(){return Object.freeze(Array.from(this.elementInternals.labels))}get selected(){return d.track(this,"selected"),!!this.currentSelected}set selected(e){this.currentSelected=e,j.enqueue(()=>{this.elementInternals&&(this.setFormValue(e?this.value:null),this.elementInternals.ariaSelected=e?"true":"false",i(this.elementInternals,"selected",e))}),d.notify(this,"selected")}get text(){return this.freeform?this.value.replace(/\s+/g," ").trim():(this.textAttribute??this.textContent)?.replace(/\s+/g," ").trim()??""}get value(){return d.track(this,"value"),this._value??this.text}set value(e){this._value=e,this.$fastController.isConnected&&(this.setFormValue(this.selected?e:null),this.freeformOutputs?.forEach(t=>{t.value=e}),d.notify(this,"value"))}connectedCallback(){super.connectedCallback(),this.freeform&&(this.value="",this.hidden=!0,this.selected=!1)}constructor(){super(),this.active=!1,this.id=X("option-"),this.initialValue="",this.multiple=!1,this.elementInternals=this.attachInternals(),this._value=this.initialValue,this.elementInternals.role="option"}setFormValue(e,t){if(this.disabled){this.elementInternals.setFormValue(null);return}this.elementInternals.setFormValue(e,e??t)}toggleSelected(e=!this.selected){this.selected=e}}o([l],r.prototype,"active",void 0);o([a({attribute:"current-selected",mode:"boolean"})],r.prototype,"currentSelected",void 0);o([a({attribute:"selected",mode:"boolean"})],r.prototype,"defaultSelected",void 0);o([l],r.prototype,"descriptionSlot",void 0);o([l],r.prototype,"disabled",void 0);o([a({attribute:"disabled",mode:"boolean"})],r.prototype,"disabledAttribute",void 0);o([a({attribute:"form"})],r.prototype,"formAttribute",void 0);o([a({mode:"boolean"})],r.prototype,"freeform",void 0);o([a({attribute:"id"})],r.prototype,"id",void 0);o([a({attribute:"value",mode:"fromView"})],r.prototype,"initialValue",void 0);o([l],r.prototype,"multiple",void 0);o([a],r.prototype,"name",void 0);o([l],r.prototype,"start",void 0);o([a({attribute:"text",mode:"fromView"})],r.prototype,"textAttribute",void 0);r.define(K);

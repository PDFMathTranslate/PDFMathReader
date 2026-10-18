import{F,f,a as y,b as c,l as E,ab as m,aM as M,L as v,D as k,G as s,ag as x,Z as S,E as n,M as p,aa as O,aN as A,a0 as q,aO as D,aP as R,af as b,aQ as X,a6 as L,n as P,ad as _,aD as V,ak as U,aH as W,aR as j,aS as G,a2 as z,X as J,a1 as Q,aT as Z,d as K,e as Y,R as tt,g as N,h as et,an as ot,a9 as rt,t as at,aE as I,J as lt,av as it,aU as w,aV as C,N as st,c as nt,z as dt,O as ct,a7 as B,_ as e,a8 as r,P as $,aW as g}from"./tslib.es6-CzkoCd3t.js";import{n as d}from"./index-BgWasc71.js";import{s as pt,e as ut,S as ht}from"./start-end-B7sBb4aN.js";import{r as H}from"./ref-GYoWfgVs.js";import{s as mt}from"./slotted-BJWj9nbx.js";import{a as bt}from"./apply-mixins-D6LS69Y2.js";import{m as $t}from"./autofocus-CXXx0V4B.js";import{U as T}from"./update-queue-CiMQqwBQ.js";import"./element-internals-aotE4GzR.js";import"./template-helpers-D_FBWwsr.js";const gt={text:"text"},ft=["date","datetime-local","email","month","number","password","search","tel","text","time","url","week"],yt=`${F.prefix}-text-input`,vt=nt`
  ${st("block")}

  :host {
    font-family: ${f};
    font-size: ${y};
    font-weight: ${c};
    line-height: ${E};
    max-width: 400px;
  }
  .label {
    display: flex;
    color: ${m};
    padding-bottom: ${M};
    flex-shrink: 0;
    padding-inline-end: ${v};
  }

  .label[hidden],
  :host(:empty) .label {
    display: none;
  }

  .root {
    align-items: center;
    background-color: ${k};
    border: ${s} solid ${x};
    border-bottom-color: ${S};
    border-radius: ${n};
    box-sizing: border-box;
    height: 32px;
    display: inline-flex;
    flex-direction: row;
    gap: ${p};
    padding: 0 ${O};
    position: relative;
    width: 100%;
  }

  :has(.control:user-invalid) {
    border-color: ${A};
  }

  .root::after {
    box-sizing: border-box;
    content: '';
    position: absolute;
    left: -1px;
    bottom: 0px;
    right: -1px;
    height: max(2px, ${n});
    border-radius: 0 0 ${n} ${n};
    border-bottom: 2px solid ${q};
    clip-path: inset(calc(100% - 2px) 1px 0px);
    transform: scaleX(0);
    transition-property: transform;
    transition-duration: ${D};
    transition-delay: ${R};
  }
  .control {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    color: ${m};
    border-radius: ${n};
    background: ${b};
    font-family: ${f};
    font-weight: ${c};
    font-size: ${y};
    border: none;
    vertical-align: center;
  }
  .control:focus-visible {
    outline: 0;
    border: 0;
  }
  .control::placeholder {
    color: ${X};
  }
  :host ::slotted([slot='start']),
  :host ::slotted([slot='end']) {
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${L};
    font-size: ${P};
  }
  :host ::slotted([slot='start']) {
    padding-right: ${p};
  }
  :host ::slotted([slot='end']) {
    padding-left: ${p};
    gap: ${v};
  }
  :host(:hover) .root {
    border-color: ${_};
    border-bottom-color: ${V};
  }
  :host(:active) .root {
    border-color: ${U};
  }
  :host(:focus-within) .root {
    outline: transparent solid 2px;
    border-bottom: 0;
  }
  :host(:focus-within) .root::after {
    transform: scaleX(1);
    transition-property: transform;
    transition-duration: ${W};
    transition-delay: ${j};
  }
  :host(:focus-within:active) .root:after {
    border-bottom-color: ${G};
  }
  :host([appearance='outline']:focus-within) .root {
    border: ${s} solid ${x};
  }
  :host(:focus-within) .control {
    color: ${m};
  }
  :host(${d}) .root {
    background: ${b};
    border: ${s} solid ${z};
  }
  :host(${d}) .control::placeholder,
  :host(${d}) ::slotted([slot='start']),
  :host(${d}) ::slotted([slot='end']) {
    color: ${J};
  }
  ::selection {
    color: ${Q};
    background-color: ${Z};
  }
  :host([control-size='small']) .control {
    font-size: ${K};
    font-weight: ${c};
    line-height: ${Y};
  }
  :host([control-size='small']) .root {
    height: 24px;
    gap: ${p};
    padding: 0 ${tt};
  }
  :host([control-size='small']) ::slotted([slot='start']),
  :host([control-size='small']) ::slotted([slot='end']) {
    font-size: ${N};
  }
  :host([control-size='large']) .control {
    font-size: ${N};
    font-weight: ${c};
    line-height: ${et};
  }
  :host([control-size='large']) .root {
    height: 40px;
    gap: ${ot};
    padding: 0 ${rt};
  }
  :host([control-size='large']) ::slotted([slot='start']),
  :host([control-size='large']) ::slotted([slot='end']) {
    font-size: ${at};
  }
  :host([appearance='underline']) .root {
    background: ${b};
    border: 0;
    border-radius: 0;
    border-bottom: ${s} solid ${S};
  }
  :host([appearance='underline']:hover) .root {
    border-bottom-color: ${V};
  }
  :host([appearance='underline']:active) .root {
    border-bottom-color: ${I};
  }
  :host([appearance='underline']:focus-within) .root {
    border: 0;
    border-bottom-color: ${I};
  }
  :host([appearance='underline']${d}) .root {
    border-bottom-color: ${z};
  }
  :host([appearance='filled-lighter']) .root,
  :host([appearance='filled-darker']) .root {
    border: ${s} solid ${lt};
    box-shadow: ${it};
  }
  :host([appearance='filled-lighter']) .root {
    background: ${k};
  }
  :host([appearance='filled-darker']) .root {
    background: ${w};
  }
  :host([appearance='filled-lighter']:hover) .root,
  :host([appearance='filled-darker']:hover) .root {
    border-color: ${C};
  }
  :host([appearance='filled-lighter']:active) .root,
  :host([appearance='filled-darker']:active) .root {
    border-color: ${C};
    background: ${w};
  }
`;function kt(l={}){return dt`
    <template @keydown="${(t,a)=>t.keydownHandler(a.event)}">
      <label part="label" for="control" class="label" ${H("controlLabel")}>
        <slot ${mt("defaultSlottedNodes")}></slot>
      </label>
      <div class="root" part="root">
        ${pt(l)}
        <input
          class="control"
          part="control"
          id="control"
          @change="${(t,a)=>t.changeHandler(a.event)}"
          @input="${(t,a)=>t.inputHandler(a.event)}"
          autocomplete="${t=>t.autocomplete}"
          ?disabled="${t=>t.disabled}"
          list="${t=>t.list}"
          maxlength="${t=>t.maxlength}"
          minlength="${t=>t.minlength}"
          ?multiple="${t=>t.multiple}"
          name="${t=>t.name}"
          pattern="${t=>t.pattern}"
          placeholder="${t=>t.placeholder}"
          ?readonly="${t=>t.readOnly}"
          ?required="${t=>t.required}"
          size="${t=>t.size}"
          spellcheck="${t=>t.spellcheck}"
          type="${t=>t.type}"
          value="${t=>t.value}"
          ${H("control")}
        />
        ${ut(l)}
      </div>
    </template>
  `}const xt=kt(),St={name:yt,registry:F.registry,shadowOptions:{delegatesFocus:!0},styles:vt,template:xt};class o extends ct{constructor(){super(...arguments),this.type=gt.text,this.dirtyValue=!1,this.elementInternals=this.attachInternals()}currentValueChanged(t,a){this.value=a}defaultSlottedNodesChanged(t,a){T.enqueue(()=>{this.controlLabel&&(this.controlLabel.hidden=!a?.some(i=>i.nodeType===Node.ELEMENT_NODE||i.nodeType===Node.TEXT_NODE&&!!i.textContent?.trim()))})}initialValueChanged(){this.dirtyValue||(this.value=this.initialValue)}readOnlyChanged(){this.$fastController.isConnected&&(this.elementInternals.ariaReadOnly=`${!!this.readOnly}`)}requiredChanged(t,a){this.$fastController.isConnected&&(this.elementInternals.ariaRequired=`${!!a}`)}controlChanged(t,a){T.enqueue(()=>{this.$fastController.isConnected&&this.setValidity()})}static{this.formAssociated=!0}get validity(){return this.elementInternals.validity}get validationMessage(){return this.elementInternals.validationMessage||this.control.validationMessage}get value(){return B.track(this,"value"),this.currentValue}set value(t){this.currentValue=t,this.elementInternals&&this.control&&(this.control.value=t??"",this.setFormValue(t),this.setValidity(),B.notify(this,"value"))}get willValidate(){return this.elementInternals.willValidate}get form(){return this.elementInternals.form}changeHandler(t){return this.setValidity(),this.$emit("change",t,{bubbles:!0,composed:!0}),!0}checkValidity(){return this.elementInternals.checkValidity()}clickHandler(t){return t.target===this&&this.control?.click(),!0}connectedCallback(){super.connectedCallback(),this.setFormValue(this.value),this.setValidity(),$t(this)}formResetCallback(){this.value=this.initialValue,this.dirtyValue=!1}implicitSubmit(){if(!this.elementInternals.form)return;if(this.elementInternals.form.elements.length===1){this.elementInternals.form.requestSubmit();return}const t=[...this.elementInternals.form.elements],a=t.find(h=>h.getAttribute("type")==="submit");if(a){a.click();return}t.filter(h=>ft.includes(h.getAttribute("type")??"")).length>1||this.elementInternals.form.requestSubmit()}inputHandler(t){return this.dirtyValue=!0,this.value=this.control.value,!0}keydownHandler(t){return t.key==="Enter"&&this.implicitSubmit(),!0}select(){this.control.select(),this.$emit("select")}setCustomValidity(t){this.elementInternals.setValidity({customError:!0},t),this.reportValidity()}reportValidity(){return this.elementInternals.reportValidity()}setFormValue(t,a){this.elementInternals?.setFormValue(t,t??a)}setValidity(t,a,i){if(this.elementInternals&&this.control){if(this.disabled){this.elementInternals.setValidity({});return}this.elementInternals.setValidity(t??this.control.validity,a??this.validationMessage,i??this.control)}}}e([r],o.prototype,"autocomplete",void 0);e([r({attribute:"current-value"})],o.prototype,"currentValue",void 0);e([$],o.prototype,"defaultSlottedNodes",void 0);e([r],o.prototype,"dirname",void 0);e([r({mode:"boolean"})],o.prototype,"disabled",void 0);e([r({attribute:"form"})],o.prototype,"formAttribute",void 0);e([r({attribute:"value",mode:"fromView"})],o.prototype,"initialValue",void 0);e([r],o.prototype,"list",void 0);e([r({converter:g})],o.prototype,"maxlength",void 0);e([r({converter:g})],o.prototype,"minlength",void 0);e([r({mode:"boolean"})],o.prototype,"multiple",void 0);e([r],o.prototype,"name",void 0);e([r],o.prototype,"pattern",void 0);e([r],o.prototype,"placeholder",void 0);e([r({attribute:"readonly",mode:"boolean"})],o.prototype,"readOnly",void 0);e([r({mode:"boolean"})],o.prototype,"required",void 0);e([r({converter:g})],o.prototype,"size",void 0);e([r({converter:{fromView:l=>typeof l=="string"?["true",""].includes(l.trim().toLowerCase()):null,toView:l=>l.toString()}})],o.prototype,"spellcheck",void 0);e([r],o.prototype,"type",void 0);e([$],o.prototype,"control",void 0);e([$],o.prototype,"controlLabel",void 0);class u extends o{}e([r],u.prototype,"appearance",void 0);e([r({attribute:"control-size"})],u.prototype,"controlSize",void 0);bt(u,ht);u.define(St);

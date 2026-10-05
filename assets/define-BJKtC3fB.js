import{F as g,c as $,a as y,b as k,d as i,e as v,s as x,f as S,g as F,h as B,i as A,j as I,k as N,l as H,m as T,n as z,o as w,p as C,q as E,r as P,t as R,u as D,v as M,w as q,x as V,y as c,z as O,A as W,B as u,C as j,D as L,E as _,G,H as X,I as J,J as K,K as Q,L as U,M as Y,N as Z,O as ee,P as oe,Q as d,R as te,S as re,T as ae,U as b,V as p,W as se,X as h,Y as ie,Z as ne,_ as le,$ as de,a0 as m,a1 as f,a2 as ce,a3 as ue,a4 as be,a5 as t,a6 as pe,a7 as r}from"./tslib.es6-DFwJ_Q0V.js";import{s as he,e as me,S as fe}from"./start-end-BGgqGkCu.js";import{s as ge}from"./slotted-vHRWPtXN.js";import{a as ve}from"./apply-mixins-BeRkEhVx.js";import{m as $e}from"./autofocus-CXXx0V4B.js";import"./update-queue-CiMQqwBQ.js";import"./template-helpers-BMdXD38S.js";import"./ref-DmzTP_6E.js";const l={submit:"submit",reset:"reset"},ye=`${g.prefix}-button`,ke=v`
  ${ce("inline-flex")}

  :host {
    --icon-spacing: ${x};
    position: relative;
    contain: layout style;
    vertical-align: middle;
    align-items: center;
    box-sizing: border-box;
    justify-content: center;
    text-align: center;
    text-decoration-line: none;
    margin: 0;
    min-height: 32px;
    outline-style: none;
    background-color: ${S};
    color: ${F};
    border: ${B} solid ${A};
    padding: 0 ${I};
    min-width: 96px;
    border-radius: ${N};
    font-size: ${H};
    font-family: ${T};
    font-weight: ${z};
    line-height: ${w};
    transition-duration: ${C};
    transition-property: background, border, color;
    transition-timing-function: ${E};
    cursor: pointer;
    user-select: none;
  }

  .content {
    display: inherit;
  }

  :host(:hover) {
    background-color: ${P};
    color: ${R};
    border-color: ${D};
  }

  :host(:hover:active) {
    background-color: ${M};
    border-color: ${q};
    color: ${V};
    outline-style: none;
  }

  :host(:focus-visible) {
    border-color: ${c};
    outline: ${O} solid ${c};
    box-shadow: ${W}, 0 0 0 2px ${u};
  }

  @media screen and (prefers-reduced-motion: reduce) {
    :host {
      transition-duration: 0.01ms;
    }
  }

  ::slotted(svg) {
    font-size: 20px;
    height: 20px;
    width: 20px;
    fill: currentColor;
  }

  ::slotted([slot='start']) {
    margin-inline-end: var(--icon-spacing);
  }

  ::slotted([slot='end']),
  [slot='end'] {
    flex-shrink: 0;
    margin-inline-start: var(--icon-spacing);
  }

  :host([icon-only]) {
    min-width: 32px;
    max-width: 32px;
  }

  :host([size='small']) {
    --icon-spacing: ${j};
    min-height: 24px;
    min-width: 64px;
    padding: 0 ${L};
    border-radius: ${_};
    font-size: ${G};
    line-height: ${X};
    font-weight: ${J};
  }

  :host([size='small'][icon-only]) {
    min-width: 24px;
    max-width: 24px;
  }

  :host([size='large']) {
    min-height: 40px;
    border-radius: ${K};
    padding: 0 ${Q};
    font-size: ${U};
    line-height: ${Y};
  }

  :host([size='large'][icon-only]) {
    min-width: 40px;
    max-width: 40px;
  }

  :host([size='large']) ::slotted(svg) {
    font-size: 24px;
    height: 24px;
    width: 24px;
  }

  :host(:is([shape='circular'], [shape='circular']:focus-visible)) {
    border-radius: ${Z};
  }

  :host(:is([shape='square'], [shape='square']:focus-visible)) {
    border-radius: ${ee};
  }

  :host([appearance='primary']) {
    background-color: ${oe};
    color: ${d};
    border-color: transparent;
  }

  :host([appearance='primary']:hover) {
    background-color: ${te};
  }

  :host([appearance='primary']:is(:hover, :hover:active):not(:focus-visible)) {
    border-color: transparent;
  }

  :host([appearance='primary']:is(:hover, :hover:active)) {
    color: ${d};
  }

  :host([appearance='primary']:hover:active) {
    background-color: ${re};
  }

  :host([appearance='primary']:focus-visible) {
    border-color: ${d};
    box-shadow: ${ae}, 0 0 0 2px ${u};
  }

  :host([appearance='outline']) {
    background-color: ${i};
  }

  :host([appearance='outline']:hover) {
    background-color: ${b};
  }

  :host([appearance='outline']:hover:active) {
    background-color: ${p};
  }

  :host([appearance='subtle']) {
    background-color: ${se};
    color: ${h};
    border-color: transparent;
  }

  :host([appearance='subtle']:hover) {
    background-color: ${ie};
    color: ${ne};
    border-color: transparent;
  }

  :host([appearance='subtle']:hover:active) {
    background-color: ${le};
    color: ${de};
    border-color: transparent;
  }

  :host([appearance='subtle']:hover) ::slotted(svg) {
    fill: ${m};
  }

  :host([appearance='subtle']:hover:active) ::slotted(svg) {
    fill: ${f};
  }

  :host([appearance='transparent']) {
    background-color: ${i};
    color: ${h};
  }

  :host([appearance='transparent']:hover) {
    background-color: ${b};
    color: ${m};
  }

  :host([appearance='transparent']:hover:active) {
    background-color: ${p};
    color: ${f};
  }

  :host(:is([appearance='transparent'], [appearance='transparent']:is(:hover, :active))) {
    border-color: transparent;
  }
`,xe=v`
  ${ke}

  :host(:is(:disabled, [disabled], [disabled-focusable], [appearance]:disabled, [appearance][disabled], [appearance][disabled-focusable])),
  :host(:is(:disabled, [disabled], [disabled-focusable], [appearance]:disabled, [appearance][disabled], [appearance][disabled-focusable]):hover),
  :host(:is(:disabled, [disabled], [disabled-focusable], [appearance]:disabled, [appearance][disabled], [appearance][disabled-focusable]):hover:active) {
    background-color: ${$};
    border-color: ${y};
    color: ${k};
    cursor: not-allowed;
  }

  :host([appearance='primary']:is(:disabled, [disabled], [disabled-focusable])),
  :host([appearance='primary']:is(:disabled, [disabled], [disabled-focusable]):is(:hover, :hover:active)) {
    border-color: transparent;
  }

  :host([appearance='outline']:is(:disabled, [disabled], [disabled-focusable])),
  :host([appearance='outline']:is(:disabled, [disabled], [disabled-focusable]):is(:hover, :hover:active)) {
    background-color: ${i};
  }

  :host([appearance='subtle']:is(:disabled, [disabled], [disabled-focusable])),
  :host([appearance='subtle']:is(:disabled, [disabled], [disabled-focusable]):is(:hover, :hover:active)) {
    background-color: ${i};
    border-color: transparent;
  }

  :host([appearance='transparent']:is(:disabled, [disabled], [disabled-focusable])),
  :host([appearance='transparent']:is(:disabled, [disabled], [disabled-focusable]):is(:hover, :hover:active)) {
    border-color: transparent;
    background-color: ${i};
  }

  @media (forced-colors: active) {
    :host {
      background-color: ButtonFace;
      color: ButtonText;
    }

    :host(:is(:hover, :focus-visible)) {
      border-color: Highlight !important;
    }

    :host([appearance='primary']:not(:is(:hover, :focus-visible))) {
      background-color: Highlight;
      color: HighlightText;
      forced-color-adjust: none;
    }

    :host(
        :is(
            :disabled,
            [disabled],
            [disabled-focusable],
            [appearance]:disabled,
            [appearance][disabled],
            [appearance][disabled-focusable]
          )
      ) {
      background-color: ButtonFace;
      color: GrayText;
      border-color: ButtonText;
    }
  }
`;function Se(n={}){return ue`
    <template
      @click="${(o,e)=>o.clickHandler(e.event)}"
      @keypress="${(o,e)=>o.keypressHandler(e.event)}"
    >
      ${he(n)}
      <span class="content" part="content">
        <slot ${ge("defaultSlottedContent")}></slot>
      </span>
      ${me(n)}
    </template>
  `}const Fe=Se(),Be={name:ye,registry:g.registry,styles:xe,template:Fe};class a extends be{disabledChanged(){this.setTabIndex()}disabledFocusableChanged(o,e){this.elementInternals&&(this.elementInternals.ariaDisabled=`${!!e}`)}get form(){return this.elementInternals.form}static{this.formAssociated=!0}get labels(){return Object.freeze(Array.from(this.elementInternals.labels))}typeChanged(o,e){e!==l.submit&&(this.formSubmissionFallbackControl?.remove(),this.shadowRoot?.querySelector('slot[name="internal"]')?.remove())}clickHandler(o){if(o&&this.disabledFocusable){o.stopImmediatePropagation();return}return this.press(),!0}connectedCallback(){super.connectedCallback(),this.elementInternals.ariaDisabled=`${!!this.disabledFocusable}`,this.setTabIndex(),$e(this)}constructor(){super(),this.disabledFocusable=!1,this.elementInternals=this.attachInternals(),this.elementInternals.role="button"}createAndInsertFormSubmissionFallbackControl(){const o=this.formSubmissionFallbackControlSlot??document.createElement("slot");o.setAttribute("name","internal"),this.shadowRoot?.appendChild(o),this.formSubmissionFallbackControlSlot=o;const e=this.formSubmissionFallbackControl??document.createElement("button");e.style.display="none",e.setAttribute("type","submit"),e.setAttribute("slot","internal"),this.formNoValidate&&e.toggleAttribute("formnovalidate",!0),this.elementInternals.form?.id&&e.setAttribute("form",this.elementInternals.form.id),this.name&&e.setAttribute("name",this.name),this.value&&e.setAttribute("value",this.value),this.formAction&&e.setAttribute("formaction",this.formAction??""),this.formEnctype&&e.setAttribute("formenctype",this.formEnctype??""),this.formMethod&&e.setAttribute("formmethod",this.formMethod??""),this.formTarget&&e.setAttribute("formtarget",this.formTarget??""),this.append(e),this.formSubmissionFallbackControl=e}formDisabledCallback(o){this.disabled=o}keypressHandler(o){if(o&&this.disabledFocusable){o.stopImmediatePropagation();return}if(o.key==="Enter"||o.key===" "){this.click();return}return!0}press(){switch(this.type){case l.reset:{this.resetForm();break}case l.submit:{this.submitForm();break}}}resetForm(){this.elementInternals.form?.reset()}setTabIndex(){if(this.disabled){this.removeAttribute("tabindex");return}this.tabIndex=Number(this.getAttribute("tabindex")??0)<0?-1:0}submitForm(){if(!(!this.elementInternals.form||this.disabled||this.type!==l.submit)){if(!this.name&&!this.formAction&&!this.formEnctype&&!this.formAttribute&&!this.formMethod&&!this.formNoValidate&&!this.formTarget){this.elementInternals.form.requestSubmit();return}try{this.elementInternals.setFormValue(this.value??""),this.elementInternals.form.requestSubmit(this)}catch{this.createAndInsertFormSubmissionFallbackControl(),this.elementInternals.setFormValue(null),this.elementInternals.form.requestSubmit(this.formSubmissionFallbackControl)}}}}t([pe],a.prototype,"defaultSlottedContent",void 0);t([r({mode:"boolean"})],a.prototype,"disabled",void 0);t([r({attribute:"disabled-focusable",mode:"boolean"})],a.prototype,"disabledFocusable",void 0);t([r({attribute:"formaction"})],a.prototype,"formAction",void 0);t([r({attribute:"form"})],a.prototype,"formAttribute",void 0);t([r({attribute:"formenctype"})],a.prototype,"formEnctype",void 0);t([r({attribute:"formmethod"})],a.prototype,"formMethod",void 0);t([r({attribute:"formnovalidate",mode:"boolean"})],a.prototype,"formNoValidate",void 0);t([r({attribute:"formtarget"})],a.prototype,"formTarget",void 0);t([r],a.prototype,"name",void 0);t([r],a.prototype,"type",void 0);t([r],a.prototype,"value",void 0);class s extends a{constructor(){super(...arguments),this.iconOnly=!1}}t([r],s.prototype,"appearance",void 0);t([r],s.prototype,"shape",void 0);t([r],s.prototype,"size",void 0);t([r({attribute:"icon-only",mode:"boolean"})],s.prototype,"iconOnly",void 0);ve(s,fe);s.define(Be);

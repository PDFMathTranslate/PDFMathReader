import{F as g,a3 as $,a2 as y,X as k,af as i,c as v,R as x,D as S,ab as F,G as B,ag as A,a9 as N,E as I,a as z,f as H,i as T,l as w,ah as C,ai as E,T as P,aj as R,ad as D,V as q,ak as M,al as V,J as c,a4 as O,am as W,a5 as u,L as j,an as L,Y as _,d as G,e as X,b as J,ao as Q,ap as U,g as Y,h as K,ac as Z,aq as ee,ar as oe,as as d,at as te,au as ae,av as re,aw as b,ax as p,ay as se,Q as h,az as ie,U as ne,aA as le,W as de,aB as m,aC as f,N as ce,z as ue,O as be,_ as t,P as pe,a8 as a}from"./tslib.es6-CzkoCd3t.js";import{s as he,e as me,S as fe}from"./start-end-B7sBb4aN.js";import{s as ge}from"./slotted-BJWj9nbx.js";import{a as ve}from"./apply-mixins-D6LS69Y2.js";import{m as $e}from"./autofocus-CXXx0V4B.js";import"./update-queue-CiMQqwBQ.js";import"./template-helpers-D_FBWwsr.js";import"./ref-GYoWfgVs.js";const l={submit:"submit",reset:"reset"},ye=`${g.prefix}-button`,ke=v`
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
    padding: 0 ${N};
    min-width: 96px;
    border-radius: ${I};
    font-size: ${z};
    font-family: ${H};
    font-weight: ${T};
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
    background-color: ${q};
    border-color: ${M};
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
    border-radius: ${Q};
    padding: 0 ${U};
    font-size: ${Y};
    line-height: ${K};
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
    background-color: ${ae};
  }

  :host([appearance='primary']:focus-visible) {
    border-color: ${d};
    box-shadow: ${re}, 0 0 0 2px ${u};
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
  `}const Fe=Se(),Be={name:ye,registry:g.registry,styles:xe,template:Fe};class r extends be{disabledChanged(){this.setTabIndex()}disabledFocusableChanged(o,e){this.elementInternals&&(this.elementInternals.ariaDisabled=`${!!e}`)}get form(){return this.elementInternals.form}static{this.formAssociated=!0}get labels(){return Object.freeze(Array.from(this.elementInternals.labels))}typeChanged(o,e){e!==l.submit&&(this.formSubmissionFallbackControl?.remove(),this.shadowRoot?.querySelector('slot[name="internal"]')?.remove())}clickHandler(o){if(o&&this.disabledFocusable){o.stopImmediatePropagation();return}return this.press(),!0}connectedCallback(){super.connectedCallback(),this.elementInternals.ariaDisabled=`${!!this.disabledFocusable}`,this.setTabIndex(),$e(this)}constructor(){super(),this.disabledFocusable=!1,this.elementInternals=this.attachInternals(),this.elementInternals.role="button"}createAndInsertFormSubmissionFallbackControl(){const o=this.formSubmissionFallbackControlSlot??document.createElement("slot");o.setAttribute("name","internal"),this.shadowRoot?.appendChild(o),this.formSubmissionFallbackControlSlot=o;const e=this.formSubmissionFallbackControl??document.createElement("button");e.style.display="none",e.setAttribute("type","submit"),e.setAttribute("slot","internal"),this.formNoValidate&&e.toggleAttribute("formnovalidate",!0),this.elementInternals.form?.id&&e.setAttribute("form",this.elementInternals.form.id),this.name&&e.setAttribute("name",this.name),this.value&&e.setAttribute("value",this.value),this.formAction&&e.setAttribute("formaction",this.formAction??""),this.formEnctype&&e.setAttribute("formenctype",this.formEnctype??""),this.formMethod&&e.setAttribute("formmethod",this.formMethod??""),this.formTarget&&e.setAttribute("formtarget",this.formTarget??""),this.append(e),this.formSubmissionFallbackControl=e}formDisabledCallback(o){this.disabled=o}keypressHandler(o){if(o&&this.disabledFocusable){o.stopImmediatePropagation();return}if(o.key==="Enter"||o.key===" "){this.click();return}return!0}press(){switch(this.type){case l.reset:{this.resetForm();break}case l.submit:{this.submitForm();break}}}resetForm(){this.elementInternals.form?.reset()}setTabIndex(){if(this.disabled){this.removeAttribute("tabindex");return}this.tabIndex=Number(this.getAttribute("tabindex")??0)<0?-1:0}submitForm(){if(!(!this.elementInternals.form||this.disabled||this.type!==l.submit)){if(!this.name&&!this.formAction&&!this.formEnctype&&!this.formAttribute&&!this.formMethod&&!this.formNoValidate&&!this.formTarget){this.elementInternals.form.requestSubmit();return}try{this.elementInternals.setFormValue(this.value??""),this.elementInternals.form.requestSubmit(this)}catch{this.createAndInsertFormSubmissionFallbackControl(),this.elementInternals.setFormValue(null),this.elementInternals.form.requestSubmit(this.formSubmissionFallbackControl)}}}}t([pe],r.prototype,"defaultSlottedContent",void 0);t([a({mode:"boolean"})],r.prototype,"disabled",void 0);t([a({attribute:"disabled-focusable",mode:"boolean"})],r.prototype,"disabledFocusable",void 0);t([a({attribute:"formaction"})],r.prototype,"formAction",void 0);t([a({attribute:"form"})],r.prototype,"formAttribute",void 0);t([a({attribute:"formenctype"})],r.prototype,"formEnctype",void 0);t([a({attribute:"formmethod"})],r.prototype,"formMethod",void 0);t([a({attribute:"formnovalidate",mode:"boolean"})],r.prototype,"formNoValidate",void 0);t([a({attribute:"formtarget"})],r.prototype,"formTarget",void 0);t([a],r.prototype,"name",void 0);t([a],r.prototype,"type",void 0);t([a],r.prototype,"value",void 0);class s extends r{constructor(){super(...arguments),this.iconOnly=!1}}t([a],s.prototype,"appearance",void 0);t([a],s.prototype,"shape",void 0);t([a],s.prototype,"size",void 0);t([a({attribute:"icon-only",mode:"boolean"})],s.prototype,"iconOnly",void 0);ve(s,fe);s.define(Be);

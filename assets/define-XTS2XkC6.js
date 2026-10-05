import{am as u,F as V,g as M,ao as E,f as B,k as w,h as d,y as k,a8 as I,ap as O,aq as z,ar as C,s as D,D as q,as as S,j as L,af as j,at as R,z as F,au as U,av as W,an as _,B as K,ag as X,aw as G,a9 as J,ax as Q,d as Y,O as Z,i as ee,u as te,aa as oe,ad as ie,w as re,ab as se,ae as ne,ay as ae,a as le,c as ce,b as de,o as he,H as pe,M as ue,a2 as be,e as fe,a3 as g,a4 as me,a5 as n,a6 as p,a7 as a}from"./tslib.es6-DFwJ_Q0V.js";import{t as ge,a as ve,b as xe}from"./typography.partials-BtuDfCd2.js";import{p as ye,o as $e,n as c}from"./index-DG1rUMpn.js";import{s as we}from"./template-helpers-BMdXD38S.js";import{r as b}from"./ref-DmzTP_6E.js";import{i as A}from"./listbox.options-Dhd6118x.js";import{i as f}from"./option.options-Bt9oS4Vo.js";import{g as ke}from"./direction-L4Y57tJR.js";import{t as h,A as T}from"./element-internals-C8Nb3xsl.js";import{w as Ie}from"./request-idle-callback-_-ooO1Bt.js";import{u as v}from"./unique-id-V1kxbCVl.js";import{m as Oe}from"./autofocus-CXXx0V4B.js";import{U as m}from"./update-queue-CiMQqwBQ.js";function P(i,e,t){return Object.assign({},t,{get(){return u.trackVolatile(),t.get.apply(this)}})}const Ce={outline:"outline"},x={combobox:"combobox",dropdown:"dropdown"},Se=`${V.prefix}-dropdown`,Fe=fe`
  ${be("inline-flex")}

  :host {
    box-sizing: border-box;
    color: ${M};
    cursor: pointer;
  }

  :host(${ye}) {
    color: ${E};
  }

  .control {
    appearance: none;
    background-color: ${B};
    border-radius: ${w};
    border: ${d} solid ${k};
    box-shadow: inset 0 0 0 ${d} var(--control-border-color);
    box-sizing: border-box;
    color: inherit;
    column-gap: ${I};
    display: inline-flex;
    justify-content: space-between;
    min-width: 160px;
    overflow: hidden;
    padding: ${O} ${z};
    white-space: normal;
    position: relative;
    text-align: start;
    width: 100%;
    z-index: 1;
    ${ge}
  }

  :host([size='small']) .control {
    column-gap: ${I};
    padding: ${C} ${D};
    ${ve}
  }

  :host([size='large']) .control {
    column-gap: ${q};
    padding: ${S} ${L};
    ${xe}
  }

  ::slotted(:is(input, button)) {
    all: unset;
    flex: 1 1 auto;
  }

  ::slotted(button) {
    cursor: pointer;
  }

  ::slotted(input) {
    cursor: text;
  }

  :where(slot[name='indicator'] > *, ::slotted([slot='indicator'])) {
    all: unset;
    align-items: center;
    appearance: none;
    aspect-ratio: 1;
    color: ${j};
    display: inline-flex;
    justify-content: center;
    width: 20px;
  }

  :host([size='small']) :where(slot[name='indicator'] > *, ::slotted([slot='indicator'])) {
    width: 16px;
  }

  :host([size='large']) :where(slot[name='indicator'] > *, ::slotted([slot='indicator'])) {
    width: 24px;
  }

  .control::after,
  .control::before {
    content: '' / '';
    inset: auto 0 0;
    pointer-events: none;
    position: absolute;
  }

  .control::before {
    height: ${d};
  }

  .control::after {
    background-color: ${R};
    height: ${F};
    scale: 0 1;
    transition: scale ${U} ${W};
  }

  /**
  * focus-ring style uses lingering :focus-within selector due to platform limitations
  * TODO: Convert selector to \`:host(:has(:focus-visible)) .control\` when browser support increases
  * ISSUE: https://issues.chromium.org/issues/40062355
  */
  :host(:where(:focus-within)) .control {
    border-radius: ${w};
    box-shadow: inset 0 0 0 1px ${_};
    outline: ${F} solid ${K};
  }

  :host(:where(${$e}, :focus-within)) .control::after {
    scale: 1 1;
    transition-duration: ${X};
    transition-timing-function: ${G};
  }

  :host(:where([appearance='outline'], [appearance='transparent'])) .control::before {
    background-color: ${J};
  }

  :host([appearance='transparent']) .control {
    --control-border-color: ${Q};
    background-color: ${Y};
    border-radius: ${Z};
  }

  :host([appearance='outline']) .control {
    --control-border-color: ${ee};
  }

  :host([appearance='outline']) .control:hover {
    --control-border-color: ${te};
  }

  :host(:where([appearance='outline'], [appearance='transparent'])) .control:hover::before {
    background-color: ${oe};
  }

  :host([appearance='outline']) .control:hover::after {
    background-color: ${ie};
  }

  :host([appearance='outline']) .control:active {
    --control-border-color: ${re};
  }

  :host(:where([appearance='outline'], [appearance='transparent'])) .control:active::before {
    background-color: ${se};
  }

  :host(:where([appearance='outline'], [appearance='transparent'])) .control:active::after {
    background-color: ${ne};
  }

  :host([appearance='filled-darker']) .control {
    background-color: ${ae};
  }

  :host(:where([appearance='filled-lighter'], [appearance='filled-darker'])) .control {
    --control-border-color: ${k};
  }

  :host(${c}),
  :host(${c}) ::slotted(:where(button, input)) {
    cursor: not-allowed;
  }

  :host(${c}) .control::before,
  :host(${c}) .control::after {
    content: none;
  }

  :host(${c}) .control:is(*, :active, :hover),
  :host(${c}) :where(slot[name='indicator'] > *, ::slotted([slot='indicator'])) {
    --control-border-color: ${le};
    background-color: ${ce};
    color: ${de};
  }

  ::slotted(:not([slot]):not([popover])),
  ::slotted([popover]:not(:popover-open)) {
    display: none;
  }

  @supports not (anchor-name: --anchor) {
    :host {
      --listbox-max-height: 50vh;
      --margin-offset: calc(${he} + (${O} * 2) + ${d});
    }

    :host([size='small']) {
      --margin-offset: calc(${pe} + (${C} * 2) + ${d});
    }

    :host([size='large']) {
      --margin-offset: calc(${ue} + (${S} * 2) + ${d});
    }
  }

  @media (forced-colors: active) {
    :host(${c}) .control {
      border-color: GrayText;
    }
    :host(${c}) :where(slot[name='indicator'] > *, ::slotted([slot='indicator'])) {
      color: GrayText;
    }
  }
`,Ae=g`
  <svg class="chevron-down-20-regular" aria-hidden="true" slot="indicator" viewBox="0 0 20 20" ${b("indicator")}>
    <path
      d="M15.85 7.65a.5.5 0 0 1 0 .7l-5.46 5.49a.55.55 0 0 1-.78 0L4.15 8.35a.5.5 0 1 1 .7-.7L10 12.8l5.15-5.16a.5.5 0 0 1 .7 0"
      fill="currentColor"
    />
  </svg>
`,Te=g`
  <input
    @input="${(i,e)=>i.inputHandler(e.event)}"
    @change="${(i,e)=>i.changeHandler(e.event)}"
    aria-activedescendant="${i=>i.activeDescendant}"
    aria-controls="${i=>i.listbox?.id??null}"
    aria-labelledby="${i=>i.ariaLabelledBy}"
    aria-expanded="${i=>i.open}"
    aria-haspopup="listbox"
    placeholder="${i=>i.placeholder}"
    role="combobox"
    ?disabled="${i=>i.disabled}"
    type="${i=>i.type}"
    value="${i=>i.valueAttribute}"
    slot="control"
    ${b("control")}
  />
`,He=g`
  <button
    aria-activedescendant="${i=>i.activeDescendant}"
    aria-controls="${i=>i.listbox?.id??null}"
    aria-expanded="${i=>i.open}"
    aria-haspopup="listbox"
    role="combobox"
    ?disabled="${i=>i.disabled}"
    type="button"
    slot="control"
    ${b("control")}
  >
    ${i=>i.displayValue}
  </button>
`;function Ve(i={}){return g`
    <template
      @click="${(e,t)=>e.clickHandler(t.event)}"
      @focusout="${(e,t)=>e.focusoutHandler(t.event)}"
      @keydown="${(e,t)=>e.keydownHandler(t.event)}"
      @mousedown="${(e,t)=>e.mousedownHandler(t.event)}"
    >
      <div class="control">
        <slot name="control" ${b("controlSlot")}></slot>
        <slot name="indicator" ${b("indicatorSlot")}>${we(i.indicator)}</slot>
      </div>
      <slot @slotchange="${(e,t)=>e.slotchangeHandler(t.event)}"></slot>
    </template>
  `}const Pe=Ve({indicator:Ae}),Ne={name:Se,registry:V.registry,styles:Fe,template:Pe};function H(i){return i.closest("[lang]")?.lang??"en"}class r extends me{get activeDescendant(){if(this.open)return this.enabledOptions[this.activeIndex]?.id}activeIndexChanged(e,t){if(typeof t=="number"){const o=this.matches(":has(:focus-visible)")?t:-1;this.enabledOptions.forEach((s,l)=>{s.active=l===o}),this.open&&this.enabledOptions[o]?.scrollIntoView({block:"nearest"})}}controlChanged(e,t){t&&(t.id=t.id||v("input-"))}disabledChanged(e,t){this.listbox&&m.enqueue(()=>{this.options.forEach(o=>{o.disabled=o.disabledAttribute||this.disabled})})}get displayValue(){if(!this.$fastController.isConnected||!this.control||this.isCombobox&&this.multiple)return h(this.elementInternals,"placeholder-shown",!1),"";this.listFormatter=this.listFormatter??new Intl.ListFormat(H(this),{type:"conjunction",style:"narrow"});const e=this.listFormatter.format(this.selectedOptions.map(t=>t.text));return h(this.elementInternals,"placeholder-shown",!e),this.isCombobox?e:e||this.placeholder}listboxChanged(e,t){if(e&&u.getNotifier(this).unsubscribe(e),t){t.dropdown=this,t.popover="manual",t.tabIndex=-1;const o=u.getNotifier(this);if(o.subscribe(t),o.notify("multiple"),m.enqueue(()=>{this.options.forEach(s=>{s.disabled=s.disabledAttribute||this.disabled,s.name=this.name}),this.enabledOptions.filter(s=>s.defaultSelected).forEach((s,l)=>{s.selected=this.multiple||l===0}),this.setValidity()}),T){const s=v("--dropdown-anchor-");this.style.setProperty("anchor-name",s),this.listbox.style.setProperty("position-anchor",s)}}}multipleChanged(e,t){this.elementInternals.ariaMultiSelectable=t?"true":"false",h(this.elementInternals,"multiple",t),this.value=null}nameChanged(e,t){this.listbox&&m.enqueue(()=>{this.options.forEach(o=>{o.name=t})})}openChanged(e,t){h(this.elementInternals,"open",t),this.elementInternals.ariaExpanded=t?"true":"false",this.activeIndex=this.selectedIndex??-1,T||this.anchorPositionFallback(t)}typeChanged(e,t){this.$fastController.isConnected&&this.insertControl()}get enabledOptions(){return this.listbox?.enabledOptions??Array.from(this.querySelectorAll("*")).filter(e=>f(e)&&!e.disabled)}static{this.formAssociated=!0}get freeformOption(){return this.enabledOptions.find(e=>e.freeform)}get isCombobox(){return this.type===x.combobox}get labels(){return Object.freeze(Array.from(this.elementInternals.labels))}get options(){return this.listbox?.options??Array.from(this.querySelectorAll("*")).filter(e=>f(e))}get selectedIndex(){return this.enabledOptions.findIndex(e=>e.selected)??-1}get selectedOptions(){return this.listbox?.selectedOptions??[]}get validationMessage(){if(this.elementInternals.validationMessage)return this.elementInternals.validationMessage;if(!this._validationFallbackMessage){const e=document.createElement("input");e.type="radio",e.name="validation-message-fallback",e.required=!0,e.checked=!1,this._validationFallbackMessage=e.validationMessage}return!this.disabled&&this.required&&this.listbox.selectedOptions.length===0?this._validationFallbackMessage:""}get validity(){return this.elementInternals.validity}get value(){return u.notify(this,"value"),this.enabledOptions.find(e=>e.selected)?.value??null}set value(e){this.multiple||(this.selectOption(this.enabledOptions.findIndex(t=>t.value===e)),u.track(this,"value"))}get willValidate(){return this.elementInternals.willValidate}changeHandler(e){if(this===e.target)return!0;const t=this.isCombobox?this.enabledOptions.findIndex(o=>o.text===this.control.value):this.enabledOptions.indexOf(e.target);return this.selectOption(t,!0),!0}checkValidity(){return this.elementInternals.checkValidity()}clickHandler(e){if(this.disabled)return;const t=e.target;if(this.focus(),(t===this.control||e.composedPath().includes(this.indicator))&&!this.isCombobox)return this.listbox.togglePopover(),!0;if(!this.open)return this.listbox.showPopover(),!0;if(f(t)){if(t.disabled)return;this.selectOption(this.enabledOptions.indexOf(t),!0),this.multiple||(this.isCombobox&&(this.control.value=t.text,this.updateFreeformOption()),this.listbox.hidePopover())}return!0}constructor(){super(),this.activeIndex=0,this.id=v("dropdown-"),this.required=!1,this.type=x.dropdown,this.valueAttribute="",this.repositionListbox=()=>{this.frameId&&cancelAnimationFrame(this.frameId),this.frameId=requestAnimationFrame(()=>{const e=this.getBoundingClientRect(),t=window.innerWidth-e.right,o=e.left;this.listbox.style.minWidth=`${e.width}px`,this.listbox.style.top=`${e.top}px`,o+e.width>window.innerWidth||ke(this)==="rtl"&&t-e.width>0?(this.listbox.style.right=`${t}px`,this.listbox.style.left="unset"):(this.listbox.style.left=`${o}px`,this.listbox.style.right="unset")})},this.elementInternals=this.attachInternals(),this._insertingControl=!1,this.searchTimeoutMs=500,this.searchString="",this.elementInternals.role="presentation"}filterOptions(e,t=this.enabledOptions){return this.listCollator||(this.listCollator=new Intl.Collator(H(this),{usage:"search",sensitivity:"base"})),t.filter(o=>this.listCollator.compare(o.text.substring(0,Math.min(o.text.length,e.length)),e)===0)}focus(e){this.disabled||this.control.focus(e)}focusoutHandler(e){const t=e.relatedTarget;return this.open&&!this.contains(t)&&this.listbox.togglePopover(),!0}formResetCallback(){this.enabledOptions.forEach((e,t)=>{if(this.multiple){e.selected=!!e.defaultSelected;return}if(!e.defaultSelected){e.selected=!1;return}this.selectOption(t)}),this.setValidity()}getEnabledIndexInBounds(e,t=this.enabledOptions.length||0){return t===0?-1:(e+t)%t}inputHandler(e){this.open||this.listbox.showPopover(),this.updateFreeformOption();const t=this.control.value,o=this.enabledOptions.indexOf(this.filterOptions(t)[0]??null);return this.activeIndex=o,!0}insertControl(){if(!this._insertingControl){if(this._insertingControl=!0,this.controlSlot?.assignedNodes().forEach(e=>this.removeChild(e)),this.type===x.combobox){Te.render(this,this);return}He.render(this,this),this._insertingControl=!1}}handleSearchCharacter(e){const t=this.searchString===e.repeat(this.searchString.length);this.searchString+=e;let o=this.searchString.length>1?this.filterOptions(this.searchString):[],s=!1;if(!o.length&&t&&(o=this.filterOptions(e),s=!0),o.length){const l=this.enabledOptions[this.activeIndex],$=o.indexOf(l),N=s?o[this.getEnabledIndexInBounds($+1,o.length)]:$>=0?l:o[0];this.activeIndex=this.enabledOptions.indexOf(N)}clearTimeout(this.searchTimeout),this.searchTimeout=setTimeout(()=>{this.searchString="",this.searchTimeout=void 0},this.searchTimeoutMs)}keydownHandler(e){let t=0;switch(e.key){case"ArrowUp":{e.preventDefault(),t=-1;break}case"ArrowDown":{e.preventDefault(),t=1;break}case" ":case"Enter":case"Tab":{if(e.key===" "){if(this.isCombobox)break;e.preventDefault()}if(this.open){if(this.selectOption(this.activeIndex,!0),this.multiple)break;return this.listbox.hidePopover(),e.key==="Tab"}this.listbox.showPopover();break}case"Escape":{this.activeIndex=this.multiple?0:this.selectedIndex,this.listbox.hidePopover();break}}if(!t)return!this.isCombobox&&e.key.length===1&&e.key!==" "&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&(this.open||this.listbox.showPopover(),this.handleSearchCharacter(e.key)),!0;if(!this.open){this.listbox.showPopover();return}let o=this.activeIndex;o+=t;let s=this.getEnabledIndexInBounds(o);return s===0&&this.freeformOption?.hidden&&(s=this.getEnabledIndexInBounds(o+t)),this.activeIndex=s,!0}mousedownHandler(e){if(!(this.disabled||e.target===this.control&&!this.isCombobox))return!f(e.target)}reportValidity(){return this.elementInternals.reportValidity()}selectOption(e=this.selectedIndex,t=!1){this.listbox.selectOption(e),this.control&&(this.control.value=this.displayValue),this.setValidity(),this.updateFreeformOption(),t&&this.$emit("change")}setValidity(e,t,o){if(!this.elementInternals)return;if(this.disabled||!this.required){this.elementInternals.setValidity({});return}const s=this.required&&this.listbox.selectedOptions.length===0;this.elementInternals.setValidity({valueMissing:s,...e},t??this.validationMessage,o??this.control)}slotchangeHandler(e){const t=e.target;Ie(this,()=>{const o=t.assignedElements().find(s=>A(s));o&&(this.listbox=o)})}updateFreeformOption(e=this.control.value){if(this.freeformOption){if(e===""||this.filterOptions(e,this.enabledOptions.filter(t=>!t.freeform)).length){this.freeformOption.value="",this.freeformOption.selected=!1,this.freeformOption.hidden=!0;return}this.freeformOption.value=e,this.freeformOption.hidden=!1}}connectedCallback(){super.connectedCallback(),m.enqueue(()=>{this.insertControl()}),Oe(this)}disconnectedCallback(){r.AnchorPositionFallbackObserver?.disconnect(),this.debounceController?.abort(),this.searchTimeout&&(clearTimeout(this.searchTimeout),this.searchTimeout=void 0,this.searchString=""),super.disconnectedCallback()}anchorPositionFallback(e){if(r.AnchorPositionFallbackObserver||(r.AnchorPositionFallbackObserver=new IntersectionObserver(t=>{t.forEach(({boundingClientRect:o,isIntersecting:s,target:l})=>{if(A(l)){if(o.bottom>window.innerHeight){h(l.elementInternals,"flip-block",!0);return}o.top<0&&h(l.elementInternals,"flip-block",!1)}})},{threshold:1})),e){this.debounceController=new AbortController,r.AnchorPositionFallbackObserver.observe(this.listbox),window.addEventListener("scroll",this.repositionListbox,{passive:!0,capture:!0,signal:this.debounceController.signal}),window.addEventListener("resize",this.repositionListbox,{passive:!0,signal:this.debounceController.signal}),this.repositionListbox();return}r.AnchorPositionFallbackObserver.unobserve(this.listbox),this.debounceController?.abort(),this.frameId&&(cancelAnimationFrame(this.frameId),this.frameId=void 0)}}n([P],r.prototype,"activeDescendant",null);n([p],r.prototype,"activeIndex",void 0);n([a({attribute:"aria-labelledby",mode:"fromView"})],r.prototype,"ariaLabelledBy",void 0);n([p],r.prototype,"control",void 0);n([a({mode:"boolean"})],r.prototype,"disabled",void 0);n([P],r.prototype,"displayValue",null);n([a({attribute:"id"})],r.prototype,"id",void 0);n([p],r.prototype,"indicator",void 0);n([p],r.prototype,"indicatorSlot",void 0);n([a({attribute:"value",mode:"fromView"})],r.prototype,"initialValue",void 0);n([p],r.prototype,"listbox",void 0);n([a({mode:"boolean"})],r.prototype,"multiple",void 0);n([a],r.prototype,"name",void 0);n([p],r.prototype,"open",void 0);n([a],r.prototype,"placeholder",void 0);n([a({mode:"boolean"})],r.prototype,"required",void 0);n([a],r.prototype,"type",void 0);n([a({attribute:"value"})],r.prototype,"valueAttribute",void 0);class y extends r{constructor(){super(...arguments),this.appearance=Ce.outline}}n([a],y.prototype,"appearance",void 0);n([a],y.prototype,"size",void 0);y.define(Ne);

import{F as g,a8 as v,d as $,a9 as y,N as f,aa as C,ab as I,a as d,ac as c,ad as h,ae as u,c as V,af as x,ag as F,q as w,ah as A,ai as N,aj as _,ak as H,al as S,b as k,y as b,z as B,A as M,B as q,a2 as P,e as D,a3 as T,a4 as E,am as n,a5 as a,a6 as z,a7 as o}from"./tslib.es6-DFwJ_Q0V.js";import{n as s,c as i}from"./index-DG1rUMpn.js";import{s as R}from"./template-helpers-BMdXD38S.js";import{t as m}from"./element-internals-C8Nb3xsl.js";import{m as j}from"./autofocus-CXXx0V4B.js";import"./update-queue-CiMQqwBQ.js";const O=`${g.prefix}-switch`,X=D`
  ${P("inline-flex")}

  :host {
    box-sizing: border-box;
    align-items: center;
    flex-direction: row;
    outline: none;
    user-select: none;
    contain: content;
    padding: 0 ${v};
    width: 40px;
    height: 20px;
    background-color: ${$};
    border: 1px solid ${y};
    border-radius: ${f};
  }

  :host(:enabled) {
    cursor: pointer;
  }

  :host(:hover) {
    background: none;
    border-color: ${C};
  }
  :host(:active) {
    border-color: ${I};
  }
  :host(${s}),
  :host([readonly]) {
    border: 1px solid ${d};
    background-color: none;
    pointer: default;
  }
  :host(${i}) {
    background: ${c};
    border-color: ${c};
  }
  :host(${i}:hover) {
    background: ${h};
    border-color: ${h};
  }
  :host(${i}:active) {
    background: ${u};
    border-color: ${u};
  }
  :host(${i}${s}) {
    background: ${V};
    border-color: ${d};
  }
  .checked-indicator {
    height: 14px;
    width: 14px;
    border-radius: 50%;
    margin-inline-start: 0;
    background-color: ${x};
    transition-duration: ${F};
    transition-timing-function: ${w};
    transition-property: margin-inline-start;
  }
  :host(${i}) .checked-indicator {
    background-color: ${A};
    margin-inline-start: calc(100% - 14px);
  }
  :host(${i}:hover) .checked-indicator {
    background: ${N};
  }
  :host(${i}:active) .checked-indicator {
    background: ${_};
  }
  :host(:hover) .checked-indicator {
    background-color: ${H};
  }
  :host(:active) .checked-indicator {
    background-color: ${S};
  }
  :host(${s}) .checked-indicator,
  :host([readonly]) .checked-indicator {
    background: ${k};
  }
  :host(${i}${s}) .checked-indicator {
    background: ${k};
  }

  :host(:focus-visible) {
    outline: none;
  }

  :host(:not([slot='input']):focus-visible) {
    border-color: ${b};
    outline: ${B} solid ${b};
    outline-offset: 1px;
    box-shadow: ${M}, 0 0 0 2px ${q};
  }

  @media (forced-colors: active) {
    :host {
      border-color: InactiveBorder;
    }
    :host(${i}),
    :host(${i}:active),
    :host(${i}:hover) {
      background: Highlight;
      border-color: Highlight;
    }
    .checked-indicator,
    :host(:hover) .checked-indicator,
    :host(:active) .checked-indicator {
      background-color: ActiveCaption;
    }
    :host(${i}) .checked-indicator,
    :host(${i}:hover) .checked-indicator,
    :host(${i}:active) .checked-indicator {
      background-color: ButtonFace;
    }
    :host(${s}) .checked-indicator,
    :host(${i}${s}) .checked-indicator {
      background-color: GrayText;
    }
  }
`;function G(l={}){return T`
    <template
      @click="${(e,t)=>e.clickHandler(t.event)}"
      @input="${(e,t)=>e.inputHandler(t.event)}"
      @keydown="${(e,t)=>e.keydownHandler(t.event)}"
      @keyup="${(e,t)=>e.keyupHandler(t.event)}"
    >
      <slot name="switch">${R(l.switch)}</slot>
    </template>
  `}const W=G({switch:'<span class="checked-indicator" part="checked-indicator"></span>'}),J={name:O,registry:g.registry,styles:X,template:W};class r extends E{constructor(){super(...arguments),this.initialValue="on",this._keydownPressed=!1,this.dirtyChecked=!1,this.elementInternals=this.attachInternals(),this._validationFallbackMessage="",this._value=this.initialValue}get checked(){return n.track(this,"checked"),!!this._checked}set checked(e){this._checked=e,this.setFormValue(e?this.value:null),this.setValidity(),this.setAriaChecked(),m(this.elementInternals,"checked",e),n.notify(this,"checked")}disabledChanged(e,t){this.disabled?this.removeAttribute("tabindex"):this.tabIndex=Number(this.getAttribute("tabindex")??0)<0?-1:0,this.elementInternals.ariaDisabled=this.disabled?"true":"false",m(this.elementInternals,"disabled",this.disabled)}disabledAttributeChanged(e,t){this.disabled=!!t}initialCheckedChanged(e,t){this.dirtyChecked||(this.checked=!!t)}initialValueChanged(e,t){this._value=t}requiredChanged(e,t){this.elementInternals&&(this.setValidity(),this.elementInternals.ariaRequired=this.required?"true":"false")}get form(){return this.elementInternals.form}static{this.formAssociated=!0}get labels(){return Object.freeze(Array.from(this.elementInternals.labels))}get validationMessage(){if(this.elementInternals?.validationMessage)return this.elementInternals.validationMessage;if(!this._validationFallbackMessage){const e=document.createElement("input");e.type="checkbox",e.required=!0,e.checked=!1,this._validationFallbackMessage=e.validationMessage}return this._validationFallbackMessage}get validity(){return this.elementInternals.validity}get value(){return n.track(this,"value"),this._value}set value(e){this._value=e,this.elementInternals&&(this.setFormValue(e),this.setValidity()),n.notify(this,"value")}get willValidate(){return this.elementInternals.willValidate}checkValidity(){return this.elementInternals.checkValidity()}clickHandler(e){if(this.disabled)return;this.dirtyChecked=!0;const t=this.checked;return this.toggleChecked(),t!==this.checked&&(this.$emit("change"),this.$emit("input")),!0}connectedCallback(){super.connectedCallback(),this.disabled=!!this.disabledAttribute,this.setAriaChecked(),this.setValidity(),j(this)}inputHandler(e){return this.setFormValue(this.value),this.setValidity(),!0}keydownHandler(e){if(e.key!==" ")return!0;this._keydownPressed=!0}keyupHandler(e){if(!this._keydownPressed||e.key!==" ")return!0;this._keydownPressed=!1,this.click()}formResetCallback(){this.checked=this.initialChecked??!1,this.dirtyChecked=!1,this.setValidity()}reportValidity(){return this.elementInternals.reportValidity()}setAriaChecked(e=this.checked){this.elementInternals&&(this.elementInternals.ariaChecked=e?"true":"false")}setFormValue(e,t){this.elementInternals?.setFormValue(e,e??t)}setCustomValidity(e){this.elementInternals.setValidity({customError:!0},e),this.setValidity()}setValidity(e,t,p){if(this.elementInternals){if(this.disabled||!this.required){this.elementInternals.setValidity({});return}this.elementInternals.setValidity({valueMissing:!!this.required&&!this.checked,...e},t??this.validationMessage,p)}}toggleChecked(e=!this.checked){this.checked=e}}a([z],r.prototype,"disabled",void 0);a([o({attribute:"disabled",mode:"boolean"})],r.prototype,"disabledAttribute",void 0);a([o({attribute:"form"})],r.prototype,"formAttribute",void 0);a([o({attribute:"checked",mode:"boolean"})],r.prototype,"initialChecked",void 0);a([o({attribute:"value",mode:"fromView"})],r.prototype,"initialValue",void 0);a([o],r.prototype,"name",void 0);a([o({mode:"boolean"})],r.prototype,"required",void 0);class K extends r{constructor(){super(),this.elementInternals.role="switch"}}K.define(J);

import{F as f,ac as w,a9 as A,k as x,ad as y,ae as C,b as $,c as S,E as V,B as D,an as T,f as d,N as M,i as F,a2 as P,e as g,a3 as I,a4 as E,am as c,a5 as s,a7 as h,a6 as l}from"./tslib.es6-DFwJ_Q0V.js";import{O as o}from"./orientation-BnJ3yFU-.js";import{n as p}from"./index-DG1rUMpn.js";import{s as z}from"./template-helpers-BMdXD38S.js";import{r as b}from"./ref-DmzTP_6E.js";import{D as u,g as W}from"./direction-L4Y57tJR.js";import{m as L}from"./autofocus-CXXx0V4B.js";import{U as B}from"./update-queue-CiMQqwBQ.js";import"./element-internals-C8Nb3xsl.js";const _=o,H={singleValue:"single-value"},R=`${f.prefix}-slider`,O=g`
  ${P("inline-grid")}

  :host {
    --thumb-size: 20px;
    --track-margin-inline: calc(var(--thumb-size) / 2);
    --track-size: 4px;
    --track-overhang: calc(var(--track-size) / -2);
    --rail-color: ${w};
    --track-color: ${A};
    --slider-direction: 90deg;
    --border-radius: ${x};
    --step-marker-inset: var(--track-overhang) -1px;

    position: relative;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    outline: none;
    user-select: none;
    touch-action: none;
    min-width: 120px;
    min-height: 32px;
    grid-template-rows: 1fr var(--thumb-size) 1fr;
    grid-template-columns: var(--track-margin-inline) 1fr var(--track-margin-inline);
  }

  :host(:hover) {
    --rail-color: ${y};
  }

  :host(:active) {
    --rail-color: ${C};
  }

  :host(${p}) {
    --rail-color: ${$};
    --track-color: ${S};
  }

  :host(:not(${p})) {
    cursor: pointer;
  }

  :host(:dir(rtl)) {
    --slider-direction: -90deg;
  }

  :host([size='small']) {
    --thumb-size: 16px;
    --track-overhang: -1px;
    --track-size: 2px;
    --border-radius: ${V};
  }

  :host([orientation='vertical']) {
    --slider-direction: 0deg;
    --step-marker-inset: -1px var(--track-overhang);
    min-height: 120px;
    grid-template-rows: var(--track-margin-inline) 1fr var(--track-margin-inline);
    grid-template-columns: 1fr var(--thumb-size) 1fr;
    width: unset;
    min-width: 32px;
    justify-items: center;
  }

  :host(:not([slot='input']):focus-visible) {
    box-shadow: 0 0 0 2pt ${D};
    outline: 1px solid ${T};
  }

  :host:after,
  .track {
    height: var(--track-size);
    width: 100%;
  }

  :host:after {
    background-image: linear-gradient(
      var(--slider-direction),
      var(--rail-color) 0%,
      var(--rail-color) 50%,
      var(--track-color) 50.1%,
      var(--track-color) 100%
    );
    border-radius: var(--border-radius);
    content: '';
    grid-row: 1 / -1;
    grid-column: 1 / -1;
  }

  .track {
    position: relative;
    background-color: var(--track-color);
    grid-row: 2 / 2;
    grid-column: 2 / 2;
    forced-color-adjust: none;
    overflow: hidden;
  }

  :host([orientation='vertical'])::after,
  :host([orientation='vertical']) .track {
    height: 100%;
    width: var(--track-size);
  }

  .track::before {
    content: '';
    position: absolute;
    height: 100%;
    border-radius: inherit;
    inset-inline-start: 0;
    width: var(--slider-progress);
  }

  :host(:dir(rtl)) .track::before {
    width: calc(100% - var(--slider-progress));
  }

  :host([orientation='vertical']) .track::before {
    width: 100%;
    bottom: 0;
    height: var(--slider-progress);
  }

  :host([step]) .track::after {
    content: '';
    position: absolute;
    border-radius: inherit;
    inset: var(--step-marker-inset);
    background-image: repeating-linear-gradient(
      var(--slider-direction),
      #0000 0%,
      #0000 calc(var(--step-rate) - 1px),
      ${d} calc(var(--step-rate) - 1px),
      ${d} var(--step-rate)
    );
  }

  .thumb-container {
    position: absolute;
    grid-row: 2 / 2;
    grid-column: 2 / 2;
    transform: translateX(-50%);
    left: var(--slider-thumb);
  }

  :host([orientation='vertical']) .thumb-container {
    transform: translateY(50%);
    left: unset;
    bottom: var(--slider-thumb);
  }

  :host(:not(:active)) :is(.thumb-container, .track::before) {
    transition: all 0.2s ease;
  }

  .thumb {
    width: var(--thumb-size);
    height: var(--thumb-size);
    border-radius: ${M};
    box-shadow: 0 0 0 calc(var(--thumb-size) * 0.2) ${d} inset;
    border: calc(var(--thumb-size) * 0.05) solid ${F};
    box-sizing: border-box;
  }

  .thumb,
  .track::before {
    background-color: var(--rail-color);
  }

  @media (forced-colors: active) {
    .track:hover,
    .track:active,
    .track {
      background: WindowText;
    }
    .thumb:hover,
    .thumb:active,
    .thumb {
      background: ButtonText;
    }

    :host(:hover) .track::before,
    :host(:active) .track::before,
    .track::before {
      background: Highlight;
    }
  }
`;function U(n={}){return I`
    <template
      @pointerdown="${(t,e)=>t.handlePointerDown(e.event)}"
      @keydown="${(t,e)=>t.handleKeydown(e.event)}"
    >
      <div ${b("track")} part="track-container" class="track" style="${t=>t.position}"></div>
      <div
        ${b("thumb")}
        part="thumb-container"
        class="thumb-container"
        style="${t=>t.position}"
        @pointerdown="${(t,e)=>t.handleThumbPointerDown(e.event)}"
      >
        <slot name="thumb">${z(n.thumb)}</slot>
      </div>
    </template>
  `}const j=U({thumb:'<div class="thumb"></div>'}),K={name:R,registry:f.registry,styles:O,template:j};function k(n,t,e){return Math.min(Math.max(e,n),t)}const m={fromView(n){const t=parseFloat(n);return Number.isNaN(t)?"":t.toString()},toView(n){const t=parseFloat(n);return Number.isNaN(t)?void 0:t.toString()}};function v(n,t,e,i){let a=k(0,1,(n-t)/(e-t));return i===u.rtl&&(a=1-a),a}class r extends E{static{this.formAssociated=!0}get labels(){return Object.freeze(Array.from(this.elementInternals.labels))}handleChange(t,e){switch(e){case"min":case"max":this.setSliderPosition();case"step":this.handleStepStyles();break}}handleStepStyles(){if(this.step){const t=100/Math.floor((this.maxAsNumber-this.minAsNumber)/this.stepAsNumber);this.stepStyles!==void 0&&this.$fastController.removeStyles(this.stepStyles),this.stepStyles=g`
        :host {
          --step-rate: ${t}%;
        }
      `,this.$fastController.addStyles(this.stepStyles)}else this.stepStyles!==void 0&&this.$fastController.removeStyles(this.stepStyles)}initialValueChanged(t,e){this.$fastController.isConnected?this.value=e:this._value=e}get validity(){return this.elementInternals.validity}get validationMessage(){return this.elementInternals.validationMessage}get willValidate(){return this.elementInternals.willValidate}checkValidity(){return this.elementInternals.checkValidity()}reportValidity(){return this.elementInternals.reportValidity()}setCustomValidity(t){this.setValidity({customError:!!t},t)}setValidity(t,e,i){if(this.$fastController.isConnected){if(this.isDisabled){this.elementInternals.setValidity({});return}this.elementInternals.setValidity({customError:!!e,...t},e??this.validationMessage,i)}}get value(){return c.track(this,"value"),this._value?.toString()??""}set value(t){if(!this.$fastController.isConnected){this._value=t.toString();return}const e=parseFloat(t),i=k(this.minAsNumber,this.maxAsNumber,this.convertToConstrainedValue(e)).toString();if(i!==t){this.value=i;return}this._value=t.toString(),this.elementInternals.ariaValueNow=this._value,this.elementInternals.ariaValueText=this.valueTextFormatter(this._value),this.setSliderPosition(),this.$emit("change"),this.setFormValue(t),c.notify(this,"value")}formResetCallback(){this.value=this.initialValue??this.midpoint}formDisabledCallback(t){this.setDisabledSideEffect(t)}setFormValue(t,e){this.elementInternals.setFormValue(t,t??e)}directionChanged(){this.setSliderPosition()}get valueAsNumber(){return parseFloat(this.value)}set valueAsNumber(t){this.value=t.toString()}valueTextFormatterChanged(){typeof this.valueTextFormatter=="function"?this.elementInternals.ariaValueText=this.valueTextFormatter(this._value):this.elementInternals.ariaValueText=""}disabledChanged(){this.setDisabledSideEffect(this.disabled)}get isDisabled(){return this.disabled||this.elementInternals?.ariaDisabled==="true"||this.isConnected&&this.matches(":disabled")}minChanged(){this.elementInternals.ariaValueMin=`${this.minAsNumber}`,this.$fastController.isConnected&&this.minAsNumber>this.valueAsNumber&&(this.value=this.min)}get minAsNumber(){if(this.min!==void 0){const t=parseFloat(this.min);if(!Number.isNaN(t))return t}return 0}maxChanged(){this.elementInternals.ariaValueMax=`${this.maxAsNumber}`,this.$fastController.isConnected&&this.maxAsNumber<this.valueAsNumber&&(this.value=this.max)}get maxAsNumber(){if(this.max!==void 0){const t=parseFloat(this.max);if(!Number.isNaN(t))return t}return 100}stepChanged(){this.updateStepMultiplier(),this.$fastController.isConnected&&(this.value=this._value)}get stepAsNumber(){if(this.step!==void 0){const t=parseFloat(this.step);if(!Number.isNaN(t)&&t>0)return t}return 1}orientationChanged(t,e){this.elementInternals.ariaOrientation=e??o.horizontal,this.$fastController.isConnected&&this.setSliderPosition()}constructor(){super(),this.elementInternals=this.attachInternals(),this.direction=u.ltr,this.isDragging=!1,this.trackWidth=0,this.trackMinWidth=0,this.trackHeight=0,this.trackLeft=0,this.trackMinHeight=0,this.valueTextFormatter=()=>"",this.disabled=!1,this.min="",this.max="",this.step="",this.mode=H.singleValue,this.setupTrackConstraints=()=>{const t=this.track.getBoundingClientRect();this.trackWidth=this.track.clientWidth,this.trackMinWidth=this.track.clientLeft,this.trackHeight=t.top,this.trackMinHeight=t.bottom,this.trackLeft=this.getBoundingClientRect().left,this.trackWidth===0&&(this.trackWidth=1)},this.handleThumbPointerDown=t=>{if(this.isDisabled)return!0;const e=t!==null?window.addEventListener:window.removeEventListener;return e("pointerup",this.handleWindowPointerUp),e("pointermove",this.handlePointerMove,{passive:!0}),e("touchmove",this.handlePointerMove,{passive:!0}),e("touchend",this.handleWindowPointerUp),this.isDragging=t!==null,!0},this.handlePointerMove=t=>{if(this.isDisabled||t.defaultPrevented)return;const e=window.TouchEvent&&t instanceof TouchEvent?t.touches[0]:t,i=this.thumb.getBoundingClientRect().width,a=this.orientation===o.vertical?e.pageY-document.documentElement.scrollTop:e.pageX-document.documentElement.scrollLeft-this.trackLeft-i/2;this.value=`${this.calculateNewValue(a)}`},this.handleWindowPointerUp=()=>{this.stopDragging()},this.stopDragging=()=>{this.isDragging=!1,this.handlePointerDown(null),this.handleThumbPointerDown(null)},this.handlePointerDown=t=>{if(t===null||!this.isDisabled){const e=t!==null?window.addEventListener:window.removeEventListener,i=t!==null?document.addEventListener:document.removeEventListener;e("pointerup",this.handleWindowPointerUp),i("mouseleave",this.handleWindowPointerUp),e("pointermove",this.handlePointerMove);const a=this.thumb.getBoundingClientRect().width;if(t){this.setupTrackConstraints();const N=this.orientation===o.vertical?t.pageY-document.documentElement.scrollTop:t.pageX-document.documentElement.scrollLeft-this.trackLeft-a/2;this.value=`${this.calculateNewValue(N)}`}}return!0},this.elementInternals.role="slider",this.elementInternals.ariaOrientation=this.orientation??_.horizontal}connectedCallback(){super.connectedCallback(),requestAnimationFrame(()=>{if(!this.$fastController.isConnected)return;this.direction=W(this),this.setDisabledSideEffect(this.disabled),this.updateStepMultiplier(),this.setupTrackConstraints(),this.setupDefaultValue(),this.setSliderPosition(),this.handleStepStyles();const t=c.getNotifier(this);t.subscribe(this,"max"),t.subscribe(this,"min"),t.subscribe(this,"step")}),L(this)}disconnectedCallback(){super.disconnectedCallback();const t=c.getNotifier(this);t.unsubscribe(this,"max"),t.unsubscribe(this,"min"),t.unsubscribe(this,"step")}increment(){const t=this.direction!==u.rtl?Number(this.value)+this.stepAsNumber:Number(this.value)-this.stepAsNumber,e=this.convertToConstrainedValue(t),i=e<this.maxAsNumber?`${e}`:`${this.maxAsNumber}`;this.value=i}decrement(){const t=this.direction!==u.rtl?Number(this.value)-Number(this.stepAsNumber):Number(this.value)+Number(this.stepAsNumber),e=this.convertToConstrainedValue(t),i=e>this.minAsNumber?`${e}`:`${this.minAsNumber}`;this.value=i}handleKeydown(t){if(this.isDisabled)return!0;switch(t.key){case"Home":t.preventDefault(),this.value=this.direction!==u.rtl&&this.orientation!==o.vertical?`${this.minAsNumber}`:`${this.maxAsNumber}`;break;case"End":t.preventDefault(),this.value=this.direction!==u.rtl&&this.orientation!==o.vertical?`${this.maxAsNumber}`:`${this.minAsNumber}`;break;case"ArrowRight":case"ArrowUp":t.shiftKey||(t.preventDefault(),this.increment());break;case"ArrowLeft":case"ArrowDown":t.shiftKey||(t.preventDefault(),this.decrement());break}return!0}setSliderPosition(){const e=v(parseFloat(this.value),this.minAsNumber,this.maxAsNumber,this.orientation===o.vertical?void 0:this.direction)*100;this.position=`--slider-thumb: ${e}%; --slider-progress: ${e}%`}updateStepMultiplier(){const t=this.stepAsNumber+"",e=this.stepAsNumber%1?t.length-t.indexOf(".")-1:0;this.stepMultiplier=Math.pow(10,e)}get midpoint(){return`${this.convertToConstrainedValue((this.maxAsNumber+this.minAsNumber)/2)}`}setupDefaultValue(){this._value||(this.value=this.initialValue??this.midpoint),!Number.isNaN(this.valueAsNumber)&&(this.valueAsNumber<this.minAsNumber||this.valueAsNumber>this.maxAsNumber)&&(this.value=this.midpoint),this.elementInternals.ariaValueNow=this.value}calculateNewValue(t){this.setupTrackConstraints();const e=v(t,this.orientation===o.vertical?this.trackMinHeight:this.trackMinWidth,this.orientation===o.vertical?this.trackHeight:this.trackWidth,this.orientation===o.vertical?void 0:this.direction),i=(this.maxAsNumber-this.minAsNumber)*e+this.minAsNumber;return this.convertToConstrainedValue(i)}convertToConstrainedValue(t){isNaN(t)&&(t=this.minAsNumber);let e=t-this.minAsNumber;const i=Math.round(e/this.stepAsNumber),a=e-i*(this.stepMultiplier*this.stepAsNumber)/this.stepMultiplier;return e=a>=Number(this.stepAsNumber)/2?e-a+Number(this.stepAsNumber):e-a,e+this.minAsNumber}setDisabledSideEffect(t=this.isDisabled){B.enqueue(()=>{this.elementInternals.ariaDisabled=t.toString(),this.tabIndex=t?-1:0})}}s([h],r.prototype,"size",void 0);s([h({attribute:"value",mode:"fromView"})],r.prototype,"initialValue",void 0);s([l],r.prototype,"direction",void 0);s([l],r.prototype,"isDragging",void 0);s([l],r.prototype,"position",void 0);s([l],r.prototype,"trackWidth",void 0);s([l],r.prototype,"trackMinWidth",void 0);s([l],r.prototype,"trackHeight",void 0);s([l],r.prototype,"trackLeft",void 0);s([l],r.prototype,"trackMinHeight",void 0);s([l],r.prototype,"valueTextFormatter",void 0);s([h({mode:"boolean"})],r.prototype,"disabled",void 0);s([h({converter:m})],r.prototype,"min",void 0);s([h({converter:m})],r.prototype,"max",void 0);s([h({converter:m})],r.prototype,"step",void 0);s([h],r.prototype,"orientation",void 0);s([h],r.prototype,"mode",void 0);r.define(K);

import{F as O,aq as m,j as z,X as F,ap as N,s as R,aP as _,as as T,aQ as D,aR as H,aS as l,N as P,b as c,l as L,o as M,L as U,M as X,Y as V,t as K,aT as W,_ as C,g as j,at as G,aU as Y,aV as q,a2 as J,e as Q,a3 as Z,a4 as tt,a5 as d,a7 as f,a6 as S}from"./tslib.es6-DFwJ_Q0V.js";import{O as et}from"./orientation-BnJ3yFU-.js";import{s as st}from"./slotted-vHRWPtXN.js";import{u as it}from"./unique-id-V1kxbCVl.js";import{i as E}from"./tab.options-Du74p2jc.js";import{t as at,s as ot}from"./element-internals-C8Nb3xsl.js";import{w as nt}from"./request-idle-callback-_-ooO1Bt.js";import"./update-queue-CiMQqwBQ.js";const rt={transparent:"transparent"},I=et,lt=`${O.prefix}-tablist`,dt=Q`
  ${J("flex")}

  :host {
    --tabPaddingInline: ${m};
    --tabPaddingBlock: ${z};
    --tabIndicatorInsetInline: var(--tabPaddingInline);
    --tabIndicatorInsetBlock: 0;
    box-sizing: border-box;
    color: ${F};
    flex-direction: row;
    position: relative;
  }

  :host([size='small']) {
    --tabPaddingBlock: ${N};
    --tabPaddingInline: ${R};
  }

  :host([size='large']) {
    --tabPaddingBlock: ${_};
    --tabPaddingInline: ${m};
  }

  :host([orientation='vertical']) {
    --tabPaddingBlock: ${T};
    --tabIndicatorInsetBlock: ${T};
    --_col-start-width: 0px;
    display: grid;
    grid-template-columns: ${m} var(--_col-start-width) 1fr auto ${m};
  }

  :host(:has([slot='start'])) {
    --_col-start-width: 24px;
  }

  @scope {
    :scope:has([slot='start']) {
      --_col-start-width: 24px;
    }
  }

  :host([orientation='vertical'][size='small']) {
    --tabPaddingBlock: ${D};
    --tabIndicatorInsetBlock: ${N};
  }

  :host([orientation='vertical'][size='large']) {
    --tabPaddingBlock: ${T};
    --tabIndicatorInsetBlock: ${H};
  }

  ::slotted([slot='tab']) {
    padding-inline: var(--tabPaddingInline);
    padding-block: var(--tabPaddingBlock);
  }

  :host([orientation='vertical']) ::slotted([role='tab']) {
    justify-content: flex-start;
    display: grid;
    gap: 0;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    grid-row: unset;
    padding-inline: 0;
  }

  :host ::slotted([slot='tab'])::after {
    height: ${l};
    margin-block-start: auto;
  }

  :host([orientation='vertical']) ::slotted([slot='tab'])::after {
    width: ${l};
    height: unset;
    margin-block-start: unset;
  }

  /* ::before adds a secondary indicator placeholder that appears right after click on the active tab */
  :host ::slotted([slot='tab'])::before {
    height: ${l};
    border-radius: ${P};
    content: '';
    inset-inline: var(--tabIndicatorInsetInline);
    inset-block: var(--tabIndicatorInsetBlock);
    position: absolute;
    margin-top: auto;
  }

  :host ::slotted([slot='tab'])::before {
    inset-inline: var(--tabIndicatorInsetInline);
    inset-block: var(--tabIndicatorInsetBlock);
  }

  :host ::slotted([slot='tab'][aria-selected='true'])::before {
    background-color: ${c};
  }

  :host ::slotted([slot='tab'][aria-selected='false']:hover)::after {
    height: ${l};
    margin-block-start: auto;
    transform-origin: left;
  }

  :host([orientation='vertical']) ::slotted([slot='tab'])::before,
  :host([orientation='vertical']) ::slotted([slot='tab'][aria-selected='false']:hover)::after {
    height: unset;
    width: ${l};
    margin-inline-end: auto;
    transform-origin: top;
  }

  :host([size='small']) ::slotted([slot='tab']) {
    font-size: ${L};
    line-height: ${M};
  }

  :host([size='large']) ::slotted([slot='tab']) {
    font-size: ${U};
    line-height: ${X};
  }

  /* horizontal spacing for indicator */
  :host ::slotted([slot='tab'])::after,
  :host ::slotted([slot='tab'])::before,
  :host ::slotted([slot='tab']:hover)::after {
    inset-inline: var(--tabIndicatorInsetInline);
  }

  :host([orientation='vertical']) ::slotted([slot='tab'])::after,
  :host([orientation='vertical']) ::slotted([slot='tab'])::before,
  :host([orientation='vertical']) ::slotted([slot='tab']:hover)::after {
    inset-inline: 0;
    inset-block: var(--tabIndicatorInsetBlock);
  }

  /* disabled styles */
  :host([disabled]) {
    cursor: not-allowed;
    color: ${c};
  }

  :host([disabled]) ::slotted([slot='tab']) {
    pointer-events: none;
    cursor: not-allowed;
    color: ${c};
  }

  :host([disabled]) ::slotted([slot='tab']:after) {
    background-color: ${c};
  }

  :host([disabled]) ::slotted([slot='tab'][aria-selected='true'])::after {
    background-color: ${c};
  }

  :host([disabled]) ::slotted([slot='tab']:hover):before {
    content: unset;
  }

  :host([appearance='subtle']) ::slotted([slot='tab']:hover) {
    background-color: ${V};
    color: ${K};
    fill: ${W};
  }

  :host([appearance='subtle']) ::slotted([slot='tab']:active) {
    background-color: ${C};
    fill: ${C};
    color: ${j};
  }

  /*
   * TODO: Remove '(text-size-adjust: auto)' after this bug is fixed:
   * https://bugs.webkit.org/show_bug.cgi?id=298646
   * Also remove the same trick from tab.styles.ts.
   * Using '@supports (text-size-adjust: auto)' here to exclude Safari 26.0 from
   * using CSS Anchor Positioning here because it crashes.
   */
  @supports (anchor-name: --a) and (text-size-adjust: auto) {
    ::slotted([slot='tab'][aria-selected='true']) {
      anchor-name: --tab;
    }

    :host::after {
      background-color: ${G};
      content: '';
      inline-size: 100%;
      inset-block: auto anchor(end);
      inset-inline: anchor(center) auto;
      position: fixed;
      position-anchor: --tab;
      transform: translateX(-50%);
      transition-property: inset-inline, width;
      transition-duration: ${Y};
      transition-timing-function: ${q};
      z-index: 3;

      /* These styles should be in sync with tab.styles.ts’s :host::after */
      border-radius: ${P};
      width: calc(anchor-size() - var(--tabIndicatorInsetInline) * 2);
      height: ${l};
    }

    :host(:dir(rtl))::after {
      transform: translateX(50%);
    }

    :host([orientation='vertical'])::after {
      inset-block: anchor(center) auto;
      inset-inline: anchor(start) auto;
      transform: translateY(-50%);
      transition-property: inset-block, height;

      /* These styles should be in sync with #vertical-tab-highlight above */
      width: ${l};
      height: calc(anchor-size() - var(--tabIndicatorInsetBlock) * 2);
    }

    :host([disabled])::after {
      background-color: ${c};
    }
  }
`,ht=Z`
  <template
    role="tablist"
    focusgroup="tablist inline block"
    @click="${(e,t)=>e.handleClick(t.event)}"
    @focusin="${(e,t)=>e.handleFocusIn(t.event)}"
  >
    <slot name="tab" ${st("slottedTabs")}></slot>
  </template>
`,ct={name:lt,registry:O.registry,styles:dt,template:ht};var u={AUTHOR_TABINDEX:"data-fg-ati"},bt={NONE:"none"};function k(e,t){return e.contains(t)}function ut(){return"focusgroup"in(globalThis?.HTMLElement?.prototype??{})||"focusGroup"in(globalThis?.HTMLElement?.prototype??{})}function ft(e,t,s){const i="forward",o="backward",a="block",n="inline";if(gt(e.composedPath()[0]))return e.key==="Tab"?e.shiftKey?o:i:null;if(e.shiftKey||e.ctrlKey||e.metaKey)return null;const{writingMode:r,direction:h}=window.getComputedStyle(t),g=!r.startsWith("horizontal-"),v=h==="rtl",w=g?a:n,A=g?n:a,$=g?r.endsWith("-rl")!==v:v,B=g&&v,p={ArrowUp:{axis:A,dir:B?i:o},ArrowDown:{axis:A,dir:B?o:i},ArrowLeft:{axis:w,dir:$?i:o},ArrowRight:{axis:w,dir:$?o:i},Home:{dir:"start"},End:{dir:"end"}}[e.key];return!p||s&&p.axis&&p.axis!==s?null:p.dir}function gt(e){return e?.nodeType===Node.ELEMENT_NODE&&(["INPUT","TEXTAREA","SELECT"].includes(e.nodeName)&&!["checkbox","radio"].includes(e.getAttribute("type"))||e.isContentEditable||["AUDIO","VIDEO"].includes(e.nodeName)&&e.hasAttribute("controls")||["IFRAME","OBJECT"].includes(e.nodeName))}globalThis.__FOCUSGROUP_POLYFILL__??={o:new Set,b:!1};var pt=globalThis.__FOCUSGROUP_POLYFILL__,mt=pt.o;function x(){for(const e of mt)e.takeRecords()}var It=class{#e;#t;#a=null;#b=void 0;#d=!1;#r=!0;#i;#s=null;#o=!1;#l=null;#u=new AbortController;#h;#c;constructor(e,t,s={}){if(ut()||!e)return;this.#e=e,this.#t=t,this.#h=s.decorateOwner,this.#c=s.decorateItem,this.#f(s.definition),this.#h?.(this.#e,this.#a),this.#g();const i={signal:this.#u.signal};this.#e.addEventListener("keydown",this.#v.bind(this),i),this.#e.addEventListener("focusin",this.#T.bind(this),i),this.#e.addEventListener("focusout",this.#k.bind(this),i)}disconnect(){this.#n(),this.#u.abort(),this.#t?.disconnect?.(),this.#e=null}update(e={}){if(this.#e){if(e.definition!==void 0&&(this.#f(e.definition),this.#h?.(this.#e,this.#a)),e.authorTabindexChanges)for(const t of e.authorTabindexChanges)t.setAttribute(u.AUTHOR_TABINDEX,t.getAttribute("tabindex")??"none");this.#p(),this.#g()}}#f(e){this.#a=e?.behavior??null,this.#d=e?.wrap??!1,this.#b=e?.axis,this.#r=e?.memory??!0,this.#r||(this.#s=null)}#g(){if(!this.#a||this.#a===bt.NONE){this.#p();return}this.#t.decorate?.();for(const{element:t,segmentBoundary:s}of this.#t.items())this.#c?.(t,this.#a),t.setAttribute(u.AUTHOR_TABINDEX,t.getAttribute("tabindex")??"none"),t.tabIndex=s?0:-1;(!this.#s?.isConnected||!(this.#t.isItem?.(this.#s)??this.#t.contains(this.#s)))&&(this.#s=null);const e=this.#s??this.#t.start??this.#t.first?.()??null;e&&(e.tabIndex=0,this.#i=e,this.#n(),this.#m(e)),this.#t.flush?.()}#p(){this.#n();let e=!1;for(const{element:t}of this.#t.items()){e=!0,this.#c?.(t,null);const s=t.getAttribute(u.AUTHOR_TABINDEX);s&&(s==="none"?t.removeAttribute("tabindex"):t.setAttribute("tabindex",s),t.removeAttribute(u.AUTHOR_TABINDEX))}this.#t.undecorate?.(),e&&this.#t.flush?.()}#v(e){const t=e.composedPath()[0];if(e.defaultPrevented||t===this.#e||!this.#t.contains(t))return;let s;switch(ft(e,t,this.#b)){case"start":s=this.#t.first();break;case"end":s=this.#t.last();break;case"forward":s=this.#t.next(t),!s&&this.#d&&(s=this.#t.first());break;case"backward":s=this.#t.previous(t),!s&&this.#d&&(s=this.#t.last());break}s&&s!==t&&(this.#I(t,s,!0),this.#s=s,e.preventDefault())}#T(e){const t=e.composedPath()[0];if(t===this.#e&&this.#o&&(!e.relatedTarget||!k(this.#e,e.relatedTarget))){const i=this.#s||this.#i;this.#n(),i&&i.focus(),e.stopPropagation();return}if(!this.#t.contains(t))return;this.#o&&this.#n();const s=this.#s;if(this.#s=t,s!==t&&t.tabIndex<0){const i=s??this.#i;i&&this.#I(i,t)}}#k(e){if(!e.relatedTarget||!k(this.#e,e.relatedTarget)){const i=this.#r?this.#s||this.#i:this.#i;i&&this.#m(i)}if(e.relatedTarget&&k(this.#e,e.relatedTarget)||this.#r||!this.#i)return;const t=this.#s;this.#s=null;const s=this.#t.start??this.#t.first?.()??null;if(t!==this.#i||s!==this.#i){for(const{element:i,segmentBoundary:o}of this.#t.items())i.tabIndex=o?0:-1;s&&(s.tabIndex=0,this.#i=s),this.#t.flush?.()}}#m(e){const t=(e.assignedSlot??e).getRootNode(),s=t instanceof ShadowRoot&&t.host.hasAttribute(u.AUTHOR_TABINDEX);this.#o||!s||(this.#l=this.#e.getAttribute("tabindex"),this.#e.tabIndex=0,this.#o=!0,x())}#n(){this.#o&&(this.#l!==null?this.#e.setAttribute("tabindex",this.#l):this.#e.removeAttribute("tabindex"),this.#o=!1,this.#l=null,this.#t.flush?.(),x())}#I(e,t,s=!1){t.tabIndex=0,s&&t.focus(),e.tabIndex=this.#t.sameSegment?.(e,t)??!0?-1:0,this.#n(),x()}};class vt{constructor(t,s){this.getItems=t,this.getStart=s}get start(){return this.getStart?.()??null}first(){return this.getItems()[0]??null}last(){const t=this.getItems();return t[t.length-1]??null}next(t){const s=this.getItems(),i=s.indexOf(t);return i===-1?null:s[i+1]??null}previous(t){const s=this.getItems(),i=s.indexOf(t);return i<=0?null:s[i-1]??null}*items(){for(const t of this.getItems())yield{element:t}}contains(t){return this.getItems().includes(t)}}class b extends tt{disabledChanged(t,s){this.elementInternals&&at(this.elementInternals,"disabled",s),this.setTabs({forceDisabled:!0})}orientationChanged(t,s){this.elementInternals&&(this.elementInternals.ariaOrientation=s??I.horizontal,ot(this.elementInternals,t,s,I)),this.setTabs()}activeidChanged(t,s){this.tabs?.length>0&&this.changeTab(t,s)}slottedTabsChanged(t,s){this.tabs=s?.filter(i=>E(i))??[]}tabsChanged(t,s){this.tabs?.length>0&&this.setTabs({connectToPanel:!0})}setTabs({connectToPanel:t=!1,forceDisabled:s=!1}={}){if(!this.tabs)return;const i=this.getRootNode();let o="";for(const a of this.tabs){if(a.slot!=="tab")continue;a.id||=it("tab-"),s?a.disabled=this.disabled:a.disabled=a.disabled||this.disabled,!o&&!a.disabled&&(o=a.id);const n=this.activeid===a.id;if(a.toggleAttribute("focusgroupstart",n),a.setAttribute("aria-selected",n.toString()),t){const r=a.getAttribute("aria-controls")??"",h=i.getElementById(r);r&&h&&(h.role??="tabpanel",h.hidden=this.activeid!==a.id,this.tabPanelMap.set(a,h))}}this.disabled||(this.activeid?this.changeTab(void 0,this.activeid):o&&(this.activeid=o))}handleFocusIn(t){this.activeid=t.target.id}handleClick(t){t.isTrusted||(this.activeid=t.target.id)}changeTab(t,s){const i=this.getRootNode(),o=t?i.getElementById(t):null,a=i.getElementById(s);if(!E(a)||a.disabled||!this.contains(a))return;if(o){o.setAttribute("aria-selected","false");const r=this.tabPanelMap.get(o);r&&(r.hidden=!0)}a.setAttribute("aria-selected","true");const n=this.tabPanelMap.get(a);n&&(n.hidden=!1),this.activetab=a,this.change()}constructor(){super(),this.elementInternals=this.attachInternals(),this.disabled=!1,this.orientation=I.horizontal,this.tabs=[],this.tabPanelMap=new WeakMap,this.change=()=>{this.$emit("change",this.activetab)},this.elementInternals.role="tablist",this.elementInternals.ariaOrientation=this.orientation??I.horizontal}connectedCallback(){super.connectedCallback(),nt(this,()=>{this.setTabs()},{shallow:!0})}}d([f({mode:"boolean"})],b.prototype,"disabled",void 0);d([f],b.prototype,"orientation",void 0);d([f],b.prototype,"activeid",void 0);d([S],b.prototype,"slottedTabs",void 0);d([S],b.prototype,"tabs",void 0);class y extends b{constructor(){super(...arguments),this.appearance=rt.transparent}disconnectedCallback(){this.fg?.disconnect(),super.disconnectedCallback()}tabsChanged(t,s){super.tabsChanged(t,s),this.fgItems??=new vt(()=>this.tabs?.filter(i=>(i.getAttribute("aria-selected")==="true"||!i.disabled)&&!i.hidden)??[],()=>this.activetab??null),this.fg?this.fg.update():this.fg=new It(this,this.fgItems,{definition:{behavior:"tablist",axis:void 0,memory:!1,wrap:!0}})}}d([f],y.prototype,"appearance",void 0);d([f],y.prototype,"size",void 0);y.define(ct);

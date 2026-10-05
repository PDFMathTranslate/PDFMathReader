import{u as d}from"./unique-id-V1kxbCVl.js";import{U as p}from"./update-queue-CiMQqwBQ.js";const f="adoptedStyleSheets"in document,y="CSSScopeRule"in window,r=new Map,a=new Map,c=new Map,i=new Map,s=new CSSStyleSheet;function k(e,t=document){if(!(!t||!w(t))){if(!f||t instanceof HTMLElement&&!t.shadowRoot&&!y){const o=t===document?document.documentElement:t;A(e,o);return}[document,document.documentElement,document.body].includes(t)?g(e):b(e,t)}}const h=/^[a-zA-Z_-][a-zA-Z0-9_-]*$/;function T(e){return h.test(e)?e:""}const m=/(;|{|}|\/\*|\*\/|@import|url\s*\(|expression\s*\(|javascript:)/i;function E(e){return m.test(e)?"":e}function S(e){return r.has(e)||r.set(e,Object.keys(e).reduce((t,o)=>{const n=T(o),u=E(e[o].toString());return n&&u?`${t}--${n}:${u};`:t},"")),r.get(e)}function w(e){return[document,document.documentElement].includes(e)||e instanceof HTMLElement&&!!e.closest("body")}function g(e){if(e===null){document.adoptedStyleSheets.includes(s)&&s.replaceSync("");return}s.replaceSync(`
    html {
      ${S(e)}
    }
  `),document.adoptedStyleSheets.includes(s)||document.adoptedStyleSheets.push(s)}function b(e,t){if(e===null){t.shadowRoot&&c.has(t)?c.get(t).replaceSync(""):(delete t.dataset.fluentTheme,l(t));return}t.shadowRoot?P(t).replaceSync(`
      :host {
        ${S(e)}
      }
    `):(t.dataset.fluentTheme=_(e),l(t))}function P(e){if(!c.has(e)){const t=new CSSStyleSheet;c.set(e,t),e.shadowRoot?.adoptedStyleSheets.push(t)}return c.get(e)}function _(e){if(!a.has(e)){const t=d("fluent-theme-"),o=new CSSStyleSheet;a.set(e,t),o.replaceSync(`
      @scope ([data-fluent-theme="${t}"]) {
        :scope {
          ${S(e)}
        }
      }
    `),document.adoptedStyleSheets.push(o)}return a.get(e)}function A(e,t){let o;if(e===null){if(!i.has(t))return;o=i.get(t)}else i.set(t,e),o=e;for(const[n,u]of Object.entries(o))e===null?t.style.removeProperty(`--${n}`):t.style.setProperty(`--${n}`,u.toString())}const{userAgent:M}=navigator,O=/\bAppleWebKit\/[\d+\.]+\b/.test(M);function l(e){if(!O)return;const t="visibility",o="hidden",n=e.style.getPropertyValue(t);e.style.setProperty(t,o),p.process(),e.style.setProperty(t,n)}export{k as setTheme};

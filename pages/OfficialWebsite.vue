<script setup>
import { ref } from 'vue';
import icon from './assets/icon-512.png';
const reader = ref(null);
const readerUrl = new URL('./reader.html', location.href).href;
const settingsUrl = new URL('./reader.html?settingsWindow=1&section=general', location.href).href;
const releaseUrl = 'https://github.com/PDFMathTranslate/PDFMathReader/releases/latest';
function replay() {
  if (reader.value) reader.value.src = readerUrl + '?replay=' + Date.now();
}
</script>
<template>
  <header class="site-header">
    <a class="brand" href="#"><img :src="icon" alt="" />PDFMathReader</a>
    <nav aria-label="官网导航">
      <a href="#reader">阅读体验</a><a href="#how">运行原理</a><a href="#settings">设置</a>
    </nav>
    <a class="download-link" :href="releaseUrl">下载</a>
  </header>
  <main>
    <section class="hero">
      <h1>跨越语言。<br /><span>专注阅读。</span></h1>
      <p class="intro">译文逐段呈现，公式与图表保持原样。</p>
      <div class="actions">
        <a class="primary" href="#reader">体验阅读器 ↓</a
        ><a class="secondary" :href="releaseUrl">下载应用</a>
      </div>
      <p class="platforms">macOS · Windows · Linux</p>
    </section>
    <section id="reader" class="demo-section">
      <div class="reader-frame">
        <div class="window-traffic-lights" aria-hidden="true"><i></i><i></i><i></i></div>
        <iframe
          ref="reader"
          :src="readerUrl"
          title="PDFMathReader 实际 Vue 阅读器演示"
          allow="clipboard-write"
        ></iframe>
      </div>
      <div class="demo-footer">
        <p>默认阅读模式，可在设置中切换为对照模式。</p>
        <button @click="replay">重播翻译 ↻</button>
      </div>
      <p class="demo-note">示例使用预置译文；个人文档与完整翻译服务请使用桌面应用。</p>
    </section>
    <section id="how" class="how-section">
      <div class="section-intro">
        <h2>翻译在进行。<br /><span>阅读不等待。</span></h2>
        <p>渲染、分析与翻译独立推进，当前页面优先呈现。</p>
      </div>
      <div class="pipeline">
        <article>
          <span>01</span>
          <h3>页面渲染</h3>
          <p>按需加载视野附近的页面。</p>
        </article>
        <article>
          <span>02</span>
          <h3>版面分析</h3>
          <p>识别段落，保留公式与图表。</p>
        </article>
        <article>
          <span>03</span>
          <h3>翻译调度</h3>
          <p>优先翻译正在阅读的内容。</p>
        </article>
        <article>
          <span>04</span>
          <h3>原位呈现</h3>
          <p>译文回到原位，保持阅读连贯。</p>
        </article>
      </div>
    </section>
    <section id="settings" class="settings-section">
      <div class="section-intro">
        <h2>你的阅读。<br /><span>你的偏好。</span></h2>
        <p>调整外观、翻译与阅读方式，变化即刻同步到上方阅读器。</p>
      </div>
      <div class="settings-frame">
        <div class="window-traffic-lights" aria-hidden="true"><i></i><i></i><i></i></div>
        <iframe :src="settingsUrl" title="PDFMathReader 实际设置工作区" loading="lazy"></iframe>
      </div>
    </section>
  </main>
  <footer>
    <p>PDFMathReader <span>macOS · Windows · Linux</span></p>
    <div>
      <a href="https://github.com/PDFMathTranslate/PDFMathReader">GitHub ↗</a
      ><a href="https://github.com/PDFMathTranslate/PDFMathReader/blob/main/LICENSE">License</a>
    </div>
  </footer>
</template>

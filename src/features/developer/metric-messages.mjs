export const RENDERER_METRIC_MESSAGES = Object.freeze({
  en: Object.freeze({
    fps: 'FPS',
    frameInterval: 'Frame interval',
    latency: 'RAF scheduling latency',
    fpsTooltip: 'Measured from requestAnimationFrame callbacks.',
    frameIntervalTooltip: 'Average interval between requestAnimationFrame callbacks.',
    latencyTooltip:
      'Average callback scheduling lateness: performance.now() minus the requestAnimationFrame timestamp; this is not PDF render time.',
    metricsAria: 'Renderer frame metrics',
    hidden: 'Hidden',
  }),
  'zh-CN': Object.freeze({
    fps: 'FPS',
    frameInterval: '帧间隔',
    latency: '帧回调延迟',
    fpsTooltip: '根据 requestAnimationFrame 回调测得的每秒帧数。',
    frameIntervalTooltip: 'requestAnimationFrame 回调之间的平均间隔。',
    latencyTooltip:
      '回调调度延迟的平均值：performance.now() 减去 requestAnimationFrame 时间戳；这不是 PDF 渲染时长。',
    metricsAria: '渲染器帧指标',
    hidden: '隐藏',
  }),
  'zh-TW': Object.freeze({
    fps: 'FPS',
    frameInterval: '畫格間隔',
    latency: 'RAF 排程延遲',
    fpsTooltip: '根據 requestAnimationFrame 回呼測得的每秒畫格數。',
    frameIntervalTooltip: 'requestAnimationFrame 回呼之間的平均間隔。',
    latencyTooltip:
      '回呼排程延遲的平均值：performance.now() 減去 requestAnimationFrame 時間戳；這不是 PDF 渲染時間。',
    metricsAria: '渲染器畫格指標',
    hidden: '隱藏',
  }),
  fr: Object.freeze({
    fps: 'FPS',
    frameInterval: 'Intervalle entre les images',
    latency: 'Latence de planification RAF',
    fpsTooltip: 'Mesuré à partir des rappels requestAnimationFrame.',
    frameIntervalTooltip: 'Intervalle moyen entre les rappels requestAnimationFrame.',
    latencyTooltip:
      'Moyenne du retard de planification du rappel : performance.now() moins l’horodatage requestAnimationFrame ; ce n’est pas la durée du rendu PDF.',
    metricsAria: 'Mesures des images du moteur de rendu',
    hidden: 'Masqué',
  }),
  es: Object.freeze({
    fps: 'FPS',
    frameInterval: 'Intervalo entre fotogramas',
    latency: 'Latencia de programación de RAF',
    fpsTooltip: 'Medidos a partir de las devoluciones de llamada de requestAnimationFrame.',
    frameIntervalTooltip:
      'Intervalo medio entre las devoluciones de llamada de requestAnimationFrame.',
    latencyTooltip:
      'Promedio del retraso de programación de la devolución de llamada: performance.now() menos la marca de tiempo de requestAnimationFrame; no es la duración del renderizado del PDF.',
    metricsAria: 'Métricas de fotogramas del renderizador',
    hidden: 'Oculto',
  }),
  ja: Object.freeze({
    fps: 'FPS',
    frameInterval: 'フレーム間隔',
    latency: 'RAF スケジューリング遅延',
    fpsTooltip: 'requestAnimationFrame コールバックから測定した値。',
    frameIntervalTooltip: 'requestAnimationFrame コールバック間の平均間隔。',
    latencyTooltip:
      'コールバックのスケジューリング遅延の平均: performance.now() から requestAnimationFrame のタイムスタンプを引いた値。PDF のレンダリング時間ではありません。',
    metricsAria: 'レンダラーのフレーム指標',
    hidden: '非表示',
  }),
  ko: Object.freeze({
    fps: 'FPS',
    frameInterval: '프레임 간격',
    latency: 'RAF 예약 지연',
    fpsTooltip: 'requestAnimationFrame 콜백에서 측정한 값입니다.',
    frameIntervalTooltip: 'requestAnimationFrame 콜백 사이의 평균 간격입니다.',
    latencyTooltip:
      '콜백 예약 지연 평균: performance.now()에서 requestAnimationFrame 타임스탬프를 뺀 값이며 PDF 렌더링 시간이 아닙니다.',
    metricsAria: '렌더러 프레임 지표',
    hidden: '숨김',
  }),
});

export const OPERATION_METRIC_MESSAGES = Object.freeze({
  en: Object.freeze({
    mainMetricsAria: 'Main process latency metrics',
    operation: 'Avg operation latency',
    fileOpen: 'Avg file-open latency',
    operationTooltip:
      'Average duration of completed main-process IPC handlers, excluding monitoring and performance polls.',
    fileOpenTooltip: 'Average shell file-open delivery latency; excludes first-page rendering.',
    backendMetricsAria: 'Backend communication metrics',
    errorRate: 'Error rate',
    communication: 'Avg communication duration',
    errorRateTooltip: 'Backend requests ending in an error divided by all requests.',
    communicationTooltip: 'Average browser-to-local-backend request round trip.',
  }),
  'zh-CN': Object.freeze({
    mainMetricsAria: '主进程延迟指标',
    operation: '平均操作延迟',
    fileOpen: '平均文件打开延迟',
    operationTooltip: '已完成的主进程 IPC 处理程序平均耗时，不包括监控和性能轮询。',
    fileOpenTooltip: 'Shell 传递文件打开请求的平均延迟；不包括首屏渲染。',
    backendMetricsAria: '后端通信指标',
    errorRate: '错误率',
    communication: '平均通信时长',
    errorRateTooltip: '以错误结束的后端请求数除以请求总数。',
    communicationTooltip: '浏览器到本地后端请求的平均往返时长。',
  }),
  'zh-TW': Object.freeze({
    mainMetricsAria: '主程序延遲指標',
    operation: '平均操作延遲',
    fileOpen: '平均檔案開啟延遲',
    operationTooltip: '已完成的主程序 IPC 處理常式平均耗時，不包括監控與效能輪詢。',
    fileOpenTooltip: 'Shell 傳遞檔案開啟請求的平均延遲；不包括首頁渲染。',
    backendMetricsAria: '後端通訊指標',
    errorRate: '錯誤率',
    communication: '平均通訊時長',
    errorRateTooltip: '以錯誤結束的後端請求數除以請求總數。',
    communicationTooltip: '瀏覽器到本機後端請求的平均往返時長。',
  }),
  fr: Object.freeze({
    mainMetricsAria: 'Métriques de latence du processus principal',
    operation: 'Latence moyenne des opérations',
    fileOpen: 'Latence moyenne d’ouverture de fichier',
    operationTooltip:
      'Durée moyenne des gestionnaires IPC terminés du processus principal, hors sondages de surveillance et de performance.',
    fileOpenTooltip:
      'Latence moyenne de remise du fichier par le shell ; hors rendu de la première page.',
    backendMetricsAria: 'Métriques de communication du backend',
    errorRate: 'Taux d’erreur',
    communication: 'Durée moyenne de communication',
    errorRateTooltip:
      'Nombre de requêtes backend terminées en erreur divisé par le nombre total de requêtes.',
    communicationTooltip:
      'Durée moyenne aller-retour d’une requête du navigateur vers le backend local.',
  }),
  es: Object.freeze({
    mainMetricsAria: 'Métricas de latencia del proceso principal',
    operation: 'Latencia media de operaciones',
    fileOpen: 'Latencia media de apertura de archivos',
    operationTooltip:
      'Duración media de los controladores IPC completados del proceso principal, sin sondeos de supervisión ni rendimiento.',
    fileOpenTooltip:
      'Latencia media de entrega de apertura de archivos por el shell; no incluye el renderizado de la primera página.',
    backendMetricsAria: 'Métricas de comunicación del backend',
    errorRate: 'Tasa de errores',
    communication: 'Duración media de comunicación',
    errorRateTooltip:
      'Número de solicitudes del backend terminadas con error dividido por el total de solicitudes.',
    communicationTooltip:
      'Duración media del viaje de ida y vuelta de una solicitud del navegador al backend local.',
  }),
  ja: Object.freeze({
    mainMetricsAria: 'メインプロセスの遅延指標',
    operation: '平均操作遅延',
    fileOpen: '平均ファイルオープン遅延',
    operationTooltip:
      '監視とパフォーマンスポーリングを除く、完了したメインプロセス IPC ハンドラーの平均時間。',
    fileOpenTooltip:
      'シェルからファイルオープンが渡されるまでの平均遅延。最初のページの描画時間は含みません。',
    backendMetricsAria: 'バックエンド通信指標',
    errorRate: 'エラー率',
    communication: '平均通信時間',
    errorRateTooltip: 'エラーで終了したバックエンドリクエスト数を全リクエスト数で割った値。',
    communicationTooltip: 'ブラウザからローカルバックエンドまでのリクエスト往復時間の平均。',
  }),
  ko: Object.freeze({
    mainMetricsAria: '메인 프로세스 지연 지표',
    operation: '평균 작업 지연',
    fileOpen: '평균 파일 열기 지연',
    operationTooltip:
      '모니터링 및 성능 폴링을 제외한 완료된 메인 프로세스 IPC 핸들러의 평균 시간입니다.',
    fileOpenTooltip:
      '셸에서 파일 열기 요청을 전달하는 평균 지연이며 첫 페이지 렌더링은 포함하지 않습니다.',
    backendMetricsAria: '백엔드 통신 지표',
    errorRate: '오류율',
    communication: '평균 통신 시간',
    errorRateTooltip: '오류로 끝난 백엔드 요청 수를 전체 요청 수로 나눈 값입니다.',
    communicationTooltip: '브라우저에서 로컬 백엔드로 가는 요청의 평균 왕복 시간입니다.',
  }),
});

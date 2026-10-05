export const advancedMessages = {
  en: {
    options: {
      debug: { label: 'Debug', help: 'Use debug logging.' },
      vfont: {
        label: 'Formula font pattern',
        help: 'Regular expression for identifying formula fonts.',
      },
      vchar: {
        label: 'Formula character pattern',
        help: 'Regular expression for identifying formula characters.',
      },
      compatible: {
        label: 'PDF/A compatibility',
        help: 'Convert the PDF to PDF/A to improve compatibility.',
      },
      onnx: { label: 'ONNX model path', help: 'Path to a custom ONNX model.' },
      backend: { label: 'ONNX backend', help: 'ONNX Runtime execution provider.' },
      config: { label: 'Config file', help: 'Configuration file path.' },
      skip_subset_fonts: {
        label: 'Skip font subsetting',
        help: 'Skip font subsetting; this may improve compatibility but increases the output file size.',
      },
      ignore_cache: { label: 'Ignore cache', help: 'Ignore the cache and force retranslation.' },
      min_text_length: { label: 'Minimum text length', help: 'Minimum text length to translate.' },
      no_auto_extract_glossary: {
        label: 'Disable automatic glossary extraction',
        help: 'Disable automatic glossary extraction.',
      },
      primary_font_family: {
        label: 'Primary font family',
        help: 'Override the primary font family for translated text; if unspecified, choose automatically from the original text properties.',
      },
      formular_font_pattern: {
        label: 'Formula font pattern',
        help: 'Font pattern for identifying formula text.',
      },
      formular_char_pattern: {
        label: 'Formula character pattern',
        help: 'Character pattern for identifying formula text.',
      },
      split_short_lines: {
        label: 'Split short lines',
        help: 'Force short lines into separate paragraphs.',
      },
      short_line_split_factor: {
        label: 'Short-line split factor',
        help: 'Threshold factor for splitting short lines.',
      },
      skip_clean: { label: 'Skip PDF cleaning', help: 'Skip the PDF cleaning step.' },
      disable_rich_text_translate: {
        label: 'Disable rich-text translation',
        help: 'Disable rich-text translation.',
      },
      enhance_compatibility: {
        label: 'Enhance compatibility',
        help: 'Enable all compatibility enhancement options.',
      },
      translate_table_text: {
        label: 'Translate table text',
        help: 'Translate table text (experimental).',
      },
      skip_scanned_detection: {
        label: 'Skip scanned-page detection',
        help: 'Skip detection of scanned pages.',
      },
      ocr_workaround: {
        label: 'OCR workaround',
        help: 'Force translated text to black and add a white background.',
      },
      auto_enable_ocr_workaround: {
        label: 'Automatically enable OCR workaround',
        help: 'Automatically enable the OCR workaround for scanned documents.',
      },
      no_merge_alternating_line_numbers: {
        label: 'Do not merge alternating line numbers',
        help: 'Handle alternating line numbers and text paragraphs in documents with line numbers.',
      },
      no_remove_non_formula_lines: {
        label: 'Keep non-formula lines',
        help: 'Control removal of non-formula lines within paragraph areas.',
      },
      non_formula_line_iou_threshold: {
        label: 'Non-formula line IoU threshold',
        help: 'IoU threshold for identifying non-formula lines.',
      },
      figure_table_protection_threshold: {
        label: 'Figure and table protection threshold',
        help: 'Protection threshold for figures and tables; lines inside them are not processed.',
      },
      skip_formula_offset_calculation: {
        label: 'Skip formula offset calculation',
        help: 'Skip formula offset calculation during processing.',
      },
    },
    choices: {
      serif: 'Serif',
      'sans-serif': 'Sans-serif',
      script: 'Script',
      cpu: 'CPU',
      cuda: 'CUDA',
      auto: 'Auto',
    },
  },
  'zh-CN': {
    options: {
      debug: { label: '调试', help: '使用调试日志。' },
      vfont: { label: '公式字体模式', help: '用于识别公式字体的正则表达式。' },
      vchar: { label: '公式字符模式', help: '用于识别公式字符的正则表达式。' },
      compatible: { label: 'PDF/A 兼容性', help: '将 PDF 转换为 PDF/A 以提高兼容性。' },
      onnx: { label: 'ONNX 模型路径', help: '自定义 ONNX 模型的路径。' },
      backend: { label: 'ONNX 后端', help: 'ONNX Runtime 执行提供程序。' },
      config: { label: '配置文件', help: '配置文件路径。' },
      skip_subset_fonts: {
        label: '跳过字体子集化',
        help: '跳过字体子集化；这可能提高兼容性，但会增大输出文件。',
      },
      ignore_cache: { label: '忽略缓存', help: '忽略缓存并强制重新翻译。' },
      min_text_length: { label: '最小文本长度', help: '需要翻译的最小文本长度。' },
      no_auto_extract_glossary: { label: '禁用自动提取术语表', help: '禁用自动提取术语表。' },
      primary_font_family: {
        label: '主要字体族',
        help: '覆盖译文使用的主要字体族；未指定时，根据原文属性自动选择。',
      },
      formular_font_pattern: { label: '公式字体模式', help: '用于识别公式文本的字体模式。' },
      formular_char_pattern: { label: '公式字符模式', help: '用于识别公式文本的字符模式。' },
      split_short_lines: { label: '拆分短行', help: '强制将短行拆分为不同段落。' },
      short_line_split_factor: { label: '短行拆分系数', help: '拆分短行的阈值系数。' },
      skip_clean: { label: '跳过 PDF 清理', help: '跳过 PDF 清理步骤。' },
      disable_rich_text_translate: { label: '禁用富文本翻译', help: '禁用富文本翻译。' },
      enhance_compatibility: { label: '增强兼容性', help: '启用所有兼容性增强选项。' },
      translate_table_text: { label: '翻译表格文本', help: '翻译表格文本（实验性）。' },
      skip_scanned_detection: { label: '跳过扫描检测', help: '跳过扫描页面检测。' },
      ocr_workaround: { label: 'OCR 兼容处理', help: '强制将译文设为黑色并添加白色背景。' },
      auto_enable_ocr_workaround: {
        label: '自动启用 OCR 兼容处理',
        help: '自动为扫描文档启用 OCR 兼容处理。',
      },
      no_merge_alternating_line_numbers: {
        label: '不合并交替的行号',
        help: '处理包含行号的文档中的交替行号和文本段落。',
      },
      no_remove_non_formula_lines: {
        label: '保留非公式行',
        help: '控制段落区域内非公式行的移除。',
      },
      non_formula_line_iou_threshold: {
        label: '非公式行 IoU 阈值',
        help: '用于识别非公式行的 IoU 阈值。',
      },
      figure_table_protection_threshold: {
        label: '图表保护阈值',
        help: '图表内的行不会被处理的保护阈值。',
      },
      skip_formula_offset_calculation: {
        label: '跳过公式偏移计算',
        help: '处理期间跳过公式偏移计算。',
      },
    },
    choices: {
      serif: '衬线体',
      'sans-serif': '无衬线体',
      script: '手写体',
      cpu: 'CPU',
      cuda: 'CUDA',
      auto: 'Auto',
    },
  },
  'zh-TW': {
    options: {
      debug: { label: '除錯', help: '使用除錯記錄。' },
      vfont: { label: '公式字型模式', help: '用於識別公式字型的正規表示式。' },
      vchar: { label: '公式字元模式', help: '用於識別公式字元的正規表示式。' },
      compatible: { label: 'PDF/A 相容性', help: '將 PDF 轉換為 PDF/A 以提升相容性。' },
      onnx: { label: 'ONNX 模型路徑', help: '自訂 ONNX 模型的路徑。' },
      backend: { label: 'ONNX 後端', help: 'ONNX Runtime 執行提供者。' },
      config: { label: '設定檔', help: '設定檔路徑。' },
      skip_subset_fonts: {
        label: '略過字型子集化',
        help: '略過字型子集化；這可能提升相容性，但會增加輸出檔案大小。',
      },
      ignore_cache: { label: '忽略快取', help: '忽略快取並強制重新翻譯。' },
      min_text_length: { label: '最小文字長度', help: '需要翻譯的最小文字長度。' },
      no_auto_extract_glossary: { label: '停用自動擷取術語表', help: '停用自動擷取術語表。' },
      primary_font_family: {
        label: '主要字型系列',
        help: '覆寫譯文使用的主要字型系列；未指定時，會根據原文屬性自動選擇。',
      },
      formular_font_pattern: { label: '公式字型模式', help: '用於識別公式文字的字型模式。' },
      formular_char_pattern: { label: '公式字元模式', help: '用於識別公式文字的字元模式。' },
      split_short_lines: { label: '分割短行', help: '強制將短行分割成不同段落。' },
      short_line_split_factor: { label: '短行分割係數', help: '分割短行的閾值係數。' },
      skip_clean: { label: '略過 PDF 清理', help: '略過 PDF 清理步驟。' },
      disable_rich_text_translate: { label: '停用富文字翻譯', help: '停用富文字翻譯。' },
      enhance_compatibility: { label: '增強相容性', help: '啟用所有相容性增強選項。' },
      translate_table_text: { label: '翻譯表格文字', help: '翻譯表格文字（實驗性）。' },
      skip_scanned_detection: { label: '略過掃描偵測', help: '略過掃描頁面偵測。' },
      ocr_workaround: { label: 'OCR 相容處理', help: '強制將譯文設為黑色並加上白色背景。' },
      auto_enable_ocr_workaround: {
        label: '自動啟用 OCR 相容處理',
        help: '自動為掃描文件啟用 OCR 相容處理。',
      },
      no_merge_alternating_line_numbers: {
        label: '不合併交替的行號',
        help: '處理包含行號的文件中的交替行號與文字段落。',
      },
      no_remove_non_formula_lines: {
        label: '保留非公式行',
        help: '控制段落區域內非公式行的移除。',
      },
      non_formula_line_iou_threshold: {
        label: '非公式行 IoU 閾值',
        help: '用於識別非公式行的 IoU 閾值。',
      },
      figure_table_protection_threshold: {
        label: '圖表保護閾值',
        help: '圖表內的行不會被處理的保護閾值。',
      },
      skip_formula_offset_calculation: {
        label: '略過公式偏移計算',
        help: '處理期間略過公式偏移計算。',
      },
    },
    choices: {
      serif: '襯線體',
      'sans-serif': '無襯線體',
      script: '手寫體',
      cpu: 'CPU',
      cuda: 'CUDA',
      auto: 'Auto',
    },
  },
  ja: {
    options: {
      debug: { label: 'デバッグ', help: 'デバッグログを使用します。' },
      vfont: { label: '数式フォントパターン', help: '数式フォントを識別する正規表現。' },
      vchar: { label: '数式文字パターン', help: '数式文字を識別する正規表現。' },
      compatible: {
        label: 'PDF/A 互換性',
        help: '互換性を高めるため、PDF を PDF/A に変換します。',
      },
      onnx: { label: 'ONNX モデルのパス', help: 'カスタム ONNX モデルのパス。' },
      backend: { label: 'ONNX バックエンド', help: 'ONNX Runtime の実行プロバイダー。' },
      config: { label: '設定ファイル', help: '設定ファイルのパス。' },
      skip_subset_fonts: {
        label: 'フォントのサブセット化をスキップ',
        help: 'フォントのサブセット化をスキップします。互換性が向上する場合がありますが、出力ファイルが大きくなります。',
      },
      ignore_cache: { label: 'キャッシュを無視', help: 'キャッシュを無視して再翻訳します。' },
      min_text_length: { label: '最小テキスト長', help: '翻訳するテキストの最小長。' },
      no_auto_extract_glossary: {
        label: '用語集の自動抽出を無効化',
        help: '用語集の自動抽出を無効にします。',
      },
      primary_font_family: {
        label: '主フォントファミリー',
        help: '翻訳文の主フォントファミリーを上書きします。未指定の場合は原文の属性に基づいて自動選択します。',
      },
      formular_font_pattern: {
        label: '数式フォントパターン',
        help: '数式テキストを識別するフォントパターン。',
      },
      formular_char_pattern: {
        label: '数式文字パターン',
        help: '数式テキストを識別する文字パターン。',
      },
      split_short_lines: { label: '短い行を分割', help: '短い行を別の段落に強制的に分割します。' },
      short_line_split_factor: {
        label: '短い行の分割係数',
        help: '短い行を分割するしきい値係数。',
      },
      skip_clean: {
        label: 'PDF のクリーンアップをスキップ',
        help: 'PDF のクリーンアップ処理をスキップします。',
      },
      disable_rich_text_translate: {
        label: 'リッチテキスト翻訳を無効化',
        help: 'リッチテキスト翻訳を無効にします。',
      },
      enhance_compatibility: {
        label: '互換性を強化',
        help: 'すべての互換性強化オプションを有効にします。',
      },
      translate_table_text: {
        label: '表のテキストを翻訳',
        help: '表のテキストを翻訳します（実験的）。',
      },
      skip_scanned_detection: {
        label: 'スキャン検出をスキップ',
        help: 'スキャンページの検出をスキップします。',
      },
      ocr_workaround: { label: 'OCR 回避策', help: '翻訳文を黒色にし、白い背景を追加します。' },
      auto_enable_ocr_workaround: {
        label: 'OCR 回避策を自動的に有効化',
        help: 'スキャン文書で OCR 回避策を自動的に有効にします。',
      },
      no_merge_alternating_line_numbers: {
        label: '交互の行番号を結合しない',
        help: '行番号を含む文書で、交互に現れる行番号とテキスト段落を処理します。',
      },
      no_remove_non_formula_lines: {
        label: '数式以外の行を残す',
        help: '段落領域内の数式以外の行の削除を制御します。',
      },
      non_formula_line_iou_threshold: {
        label: '数式以外の行の IoU しきい値',
        help: '数式以外の行を識別する IoU しきい値。',
      },
      figure_table_protection_threshold: {
        label: '図表保護しきい値',
        help: '図や表の内部の行を処理しないための保護しきい値。',
      },
      skip_formula_offset_calculation: {
        label: '数式オフセット計算をスキップ',
        help: '処理中の数式オフセット計算をスキップします。',
      },
    },
    choices: {
      serif: 'セリフ体',
      'sans-serif': 'サンセリフ体',
      script: '筆記体',
      cpu: 'CPU',
      cuda: 'CUDA',
      auto: 'Auto',
    },
  },
  ko: {
    options: {
      debug: { label: '디버그', help: '디버그 로그를 사용합니다.' },
      vfont: { label: '수식 글꼴 패턴', help: '수식 글꼴을 식별하는 정규 표현식입니다.' },
      vchar: { label: '수식 문자 패턴', help: '수식 문자를 식별하는 정규 표현식입니다.' },
      compatible: {
        label: 'PDF/A 호환성',
        help: '호환성을 높이기 위해 PDF를 PDF/A 형식으로 변환합니다.',
      },
      onnx: { label: 'ONNX 모델 경로', help: '사용자 지정 ONNX 모델의 경로입니다.' },
      backend: { label: 'ONNX 백엔드', help: 'ONNX Runtime 실행 제공자입니다.' },
      config: { label: '구성 파일', help: '구성 파일 경로입니다.' },
      skip_subset_fonts: {
        label: '글꼴 서브세팅 건너뛰기',
        help: '글꼴 서브세팅을 건너뜁니다. 호환성이 향상될 수 있지만 출력 파일이 커집니다.',
      },
      ignore_cache: { label: '캐시 무시', help: '캐시를 무시하고 다시 번역합니다.' },
      min_text_length: { label: '최소 텍스트 길이', help: '번역할 텍스트의 최소 길이입니다.' },
      no_auto_extract_glossary: {
        label: '자동 용어집 추출 사용 안 함',
        help: '자동 용어집 추출을 사용하지 않습니다.',
      },
      primary_font_family: {
        label: '기본 글꼴 계열',
        help: '번역 텍스트의 기본 글꼴 계열을 재정의합니다. 지정하지 않으면 원문 속성에 따라 자동으로 선택합니다.',
      },
      formular_font_pattern: {
        label: '수식 글꼴 패턴',
        help: '수식 텍스트를 식별하는 글꼴 패턴입니다.',
      },
      formular_char_pattern: {
        label: '수식 문자 패턴',
        help: '수식 텍스트를 식별하는 문자 패턴입니다.',
      },
      split_short_lines: {
        label: '짧은 줄 분할',
        help: '짧은 줄을 서로 다른 단락으로 강제로 분할합니다.',
      },
      short_line_split_factor: {
        label: '짧은 줄 분할 계수',
        help: '짧은 줄을 분할하는 임계값 계수입니다.',
      },
      skip_clean: { label: 'PDF 정리 건너뛰기', help: 'PDF 정리 단계를 건너뜁니다.' },
      disable_rich_text_translate: {
        label: '서식 있는 텍스트 번역 사용 안 함',
        help: '서식 있는 텍스트 번역을 사용하지 않습니다.',
      },
      enhance_compatibility: {
        label: '호환성 향상',
        help: '모든 호환성 향상 옵션을 활성화합니다.',
      },
      translate_table_text: { label: '표 텍스트 번역', help: '표 텍스트를 번역합니다(실험적).' },
      skip_scanned_detection: {
        label: '스캔 감지 건너뛰기',
        help: '스캔된 페이지 감지를 건너뜁니다.',
      },
      ocr_workaround: {
        label: 'OCR 우회 처리',
        help: '번역 텍스트를 검은색으로 고정하고 흰색 배경을 추가합니다.',
      },
      auto_enable_ocr_workaround: {
        label: 'OCR 우회 처리 자동 활성화',
        help: '스캔 문서에 OCR 우회 처리를 자동으로 활성화합니다.',
      },
      no_merge_alternating_line_numbers: {
        label: '교차 줄 번호 병합 안 함',
        help: '줄 번호가 있는 문서에서 번갈아 나타나는 줄 번호와 텍스트 단락을 처리합니다.',
      },
      no_remove_non_formula_lines: {
        label: '수식이 아닌 줄 유지',
        help: '단락 영역 내 수식이 아닌 줄 제거를 제어합니다.',
      },
      non_formula_line_iou_threshold: {
        label: '수식이 아닌 줄 IoU 임계값',
        help: '수식이 아닌 줄을 식별하는 IoU 임계값입니다.',
      },
      figure_table_protection_threshold: {
        label: '그림 및 표 보호 임계값',
        help: '그림이나 표 안의 줄을 처리하지 않도록 하는 보호 임계값입니다.',
      },
      skip_formula_offset_calculation: {
        label: '수식 오프셋 계산 건너뛰기',
        help: '처리 중 수식 오프셋 계산을 건너뜁니다.',
      },
    },
    choices: {
      serif: '세리프체',
      'sans-serif': '산세리프체',
      script: '필기체',
      cpu: 'CPU',
      cuda: 'CUDA',
      auto: 'Auto',
    },
  },
  fr: {
    options: {
      debug: { label: 'Débogage', help: 'Utiliser le niveau de journalisation de débogage.' },
      vfont: {
        label: 'Motif de police des formules',
        help: 'Expression régulière pour identifier les polices des formules.',
      },
      vchar: {
        label: 'Motif de caractères des formules',
        help: 'Expression régulière pour identifier les caractères des formules.',
      },
      compatible: {
        label: 'Compatibilité PDF/A',
        help: 'Convertir le PDF au format PDF/A pour améliorer la compatibilité.',
      },
      onnx: { label: 'Chemin du modèle ONNX', help: 'Chemin vers un modèle ONNX personnalisé.' },
      backend: { label: 'Backend ONNX', help: 'Fournisseur d’exécution ONNX Runtime.' },
      config: { label: 'Fichier de configuration', help: 'Chemin du fichier de configuration.' },
      skip_subset_fonts: {
        label: 'Ignorer la création de sous-ensembles de polices',
        help: 'Ignorer la création de sous-ensembles de polices ; la compatibilité peut s’améliorer, mais le fichier de sortie sera plus volumineux.',
      },
      ignore_cache: {
        label: 'Ignorer le cache',
        help: 'Ignorer le cache et forcer la retraduction.',
      },
      min_text_length: {
        label: 'Longueur minimale du texte',
        help: 'Longueur minimale du texte à traduire.',
      },
      no_auto_extract_glossary: {
        label: 'Désactiver l’extraction automatique du glossaire',
        help: 'Désactiver l’extraction automatique du glossaire.',
      },
      primary_font_family: {
        label: 'Famille de polices principale',
        help: 'Remplacer la famille de polices principale du texte traduit ; si elle n’est pas définie, la sélectionner automatiquement selon les propriétés du texte original.',
      },
      formular_font_pattern: {
        label: 'Motif de police des formules',
        help: 'Motif de police pour identifier le texte mathématique.',
      },
      formular_char_pattern: {
        label: 'Motif de caractères des formules',
        help: 'Motif de caractères pour identifier le texte mathématique.',
      },
      split_short_lines: {
        label: 'Scinder les lignes courtes',
        help: 'Forcer la séparation des lignes courtes en paragraphes distincts.',
      },
      short_line_split_factor: {
        label: 'Facteur de séparation des lignes courtes',
        help: 'Facteur seuil pour séparer les lignes courtes.',
      },
      skip_clean: {
        label: 'Ignorer le nettoyage du PDF',
        help: 'Ignorer l’étape de nettoyage du PDF.',
      },
      disable_rich_text_translate: {
        label: 'Désactiver la traduction du texte enrichi',
        help: 'Désactiver la traduction du texte enrichi.',
      },
      enhance_compatibility: {
        label: 'Améliorer la compatibilité',
        help: 'Activer toutes les options d’amélioration de la compatibilité.',
      },
      translate_table_text: {
        label: 'Traduire le texte des tableaux',
        help: 'Traduire le texte des tableaux (expérimental).',
      },
      skip_scanned_detection: {
        label: 'Ignorer la détection des pages numérisées',
        help: 'Ignorer la détection des pages numérisées.',
      },
      ocr_workaround: {
        label: 'Contournement OCR',
        help: 'Forcer le texte traduit en noir et ajouter un arrière-plan blanc.',
      },
      auto_enable_ocr_workaround: {
        label: 'Activer automatiquement le contournement OCR',
        help: 'Activer automatiquement le contournement OCR pour les documents numérisés.',
      },
      no_merge_alternating_line_numbers: {
        label: 'Ne pas fusionner les numéros de ligne alternés',
        help: 'Gérer les numéros de ligne alternés et les paragraphes de texte des documents qui en contiennent.',
      },
      no_remove_non_formula_lines: {
        label: 'Conserver les lignes non mathématiques',
        help: 'Contrôler la suppression des lignes non mathématiques dans les zones de paragraphes.',
      },
      non_formula_line_iou_threshold: {
        label: 'Seuil IoU des lignes non mathématiques',
        help: 'Seuil IoU pour identifier les lignes non mathématiques.',
      },
      figure_table_protection_threshold: {
        label: 'Seuil de protection des figures et tableaux',
        help: 'Seuil de protection empêchant le traitement des lignes dans les figures et les tableaux.',
      },
      skip_formula_offset_calculation: {
        label: 'Ignorer le calcul du décalage des formules',
        help: 'Ignorer le calcul du décalage des formules pendant le traitement.',
      },
    },
    choices: {
      serif: 'Avec empattements',
      'sans-serif': 'Sans empattement',
      script: 'Script',
      cpu: 'CPU',
      cuda: 'CUDA',
      auto: 'Auto',
    },
  },
  es: {
    options: {
      debug: { label: 'Depuración', help: 'Usar el nivel de registro de depuración.' },
      vfont: {
        label: 'Patrón de fuente de fórmulas',
        help: 'Expresión regular para identificar fuentes de fórmulas.',
      },
      vchar: {
        label: 'Patrón de caracteres de fórmulas',
        help: 'Expresión regular para identificar caracteres de fórmulas.',
      },
      compatible: {
        label: 'Compatibilidad con PDF/A',
        help: 'Convertir el PDF a PDF/A para mejorar la compatibilidad.',
      },
      onnx: { label: 'Ruta del modelo ONNX', help: 'Ruta a un modelo ONNX personalizado.' },
      backend: { label: 'Backend de ONNX', help: 'Proveedor de ejecución de ONNX Runtime.' },
      config: { label: 'Archivo de configuración', help: 'Ruta del archivo de configuración.' },
      skip_subset_fonts: {
        label: 'Omitir la creación de subconjuntos de fuentes',
        help: 'Omitir la creación de subconjuntos de fuentes; puede mejorar la compatibilidad, pero aumenta el tamaño del archivo de salida.',
      },
      ignore_cache: {
        label: 'Ignorar la caché',
        help: 'Ignorar la caché y forzar la retraducción.',
      },
      min_text_length: {
        label: 'Longitud mínima del texto',
        help: 'Longitud mínima del texto que se traducirá.',
      },
      no_auto_extract_glossary: {
        label: 'Desactivar la extracción automática del glosario',
        help: 'Desactivar la extracción automática del glosario.',
      },
      primary_font_family: {
        label: 'Familia tipográfica principal',
        help: 'Sobrescribir la familia tipográfica principal del texto traducido; si no se especifica, se selecciona automáticamente según las propiedades del texto original.',
      },
      formular_font_pattern: {
        label: 'Patrón de fuente de fórmulas',
        help: 'Patrón de fuente para identificar texto de fórmulas.',
      },
      formular_char_pattern: {
        label: 'Patrón de caracteres de fórmulas',
        help: 'Patrón de caracteres para identificar texto de fórmulas.',
      },
      split_short_lines: {
        label: 'Separar líneas cortas',
        help: 'Forzar la separación de las líneas cortas en párrafos distintos.',
      },
      short_line_split_factor: {
        label: 'Factor de separación de líneas cortas',
        help: 'Factor umbral para separar líneas cortas.',
      },
      skip_clean: {
        label: 'Omitir la limpieza del PDF',
        help: 'Omitir el paso de limpieza del PDF.',
      },
      disable_rich_text_translate: {
        label: 'Desactivar la traducción de texto enriquecido',
        help: 'Desactivar la traducción de texto enriquecido.',
      },
      enhance_compatibility: {
        label: 'Mejorar la compatibilidad',
        help: 'Activar todas las opciones de mejora de compatibilidad.',
      },
      translate_table_text: {
        label: 'Traducir texto de tablas',
        help: 'Traducir el texto de las tablas (experimental).',
      },
      skip_scanned_detection: {
        label: 'Omitir la detección de escaneos',
        help: 'Omitir la detección de páginas escaneadas.',
      },
      ocr_workaround: {
        label: 'Solución OCR',
        help: 'Forzar el texto traducido a negro y añadir un fondo blanco.',
      },
      auto_enable_ocr_workaround: {
        label: 'Activar automáticamente la solución OCR',
        help: 'Activar automáticamente la solución OCR para documentos escaneados.',
      },
      no_merge_alternating_line_numbers: {
        label: 'No combinar números de línea alternos',
        help: 'Gestionar los números de línea alternos y los párrafos de texto en documentos con números de línea.',
      },
      no_remove_non_formula_lines: {
        label: 'Conservar líneas no pertenecientes a fórmulas',
        help: 'Controlar la eliminación de líneas no pertenecientes a fórmulas dentro de las áreas de párrafo.',
      },
      non_formula_line_iou_threshold: {
        label: 'Umbral IoU de líneas no pertenecientes a fórmulas',
        help: 'Umbral IoU para identificar líneas no pertenecientes a fórmulas.',
      },
      figure_table_protection_threshold: {
        label: 'Umbral de protección de figuras y tablas',
        help: 'Umbral de protección para no procesar líneas dentro de figuras y tablas.',
      },
      skip_formula_offset_calculation: {
        label: 'Omitir el cálculo del desplazamiento de fórmulas',
        help: 'Omitir el cálculo del desplazamiento de fórmulas durante el procesamiento.',
      },
    },
    choices: {
      serif: 'Con serifas',
      'sans-serif': 'Sin serifas',
      script: 'Manuscrita',
      cpu: 'CPU',
      cuda: 'CUDA',
      auto: 'Auto',
    },
  },
};

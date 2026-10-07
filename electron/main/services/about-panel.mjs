import { dependencyProjects } from '../../../shared/dependency-projects.mjs';

const projectURL = 'https://github.com/PDFMathTranslate/PDFMathReader';
const copy = {
  en: [
    'Author',
    'Project',
    'Many thanks to OpenAI, Anthropic, Warp, Immersive Translate, and SiliconFlow for their support.',
    'Built with the following projects',
  ],
  'zh-CN': [
    '作者',
    '项目地址',
    '感谢 OpenAI、Anthropic、Warp、沉浸式翻译和硅基流动的支持。',
    '本项目使用了以下项目',
  ],
  'zh-TW': [
    '作者',
    '專案網址',
    '感謝 OpenAI、Anthropic、Warp、沉浸式翻譯和矽基流動的支持。',
    '本專案使用了以下專案',
  ],
  ja: [
    '作者',
    'プロジェクト',
    'OpenAI、Anthropic、Warp、Immersive Translate、SiliconFlow のご支援に感謝します。',
    '本アプリで使用しているプロジェクト',
  ],
  fr: [
    'Auteur',
    'Projet',
    'Merci à OpenAI, Anthropic, Warp, Immersive Translate et SiliconFlow pour leur soutien.',
    'Projets utilisés',
  ],
  es: [
    'Autor',
    'Proyecto',
    'Gracias a OpenAI, Anthropic, Warp, Immersive Translate y SiliconFlow por su apoyo.',
    'Proyectos utilizados',
  ],
  ko: [
    '개발자',
    '프로젝트',
    'OpenAI, Anthropic, Warp, Immersive Translate, SiliconFlow의 지원에 감사드립니다.',
    '이 앱에 사용된 프로젝트',
  ],
};

export function aboutPanelOptions(version, locale = 'en') {
  const [author, project, thanks, dependencies] = copy[locale] || copy.en;
  return {
    applicationName: 'PDFMathReader',
    applicationVersion: version,
    version,
    authors: ['Rongxin (rongxin@u.nus.edu)'],
    website: projectURL,
    credits: [
      `${author}: Rongxin (rongxin@u.nus.edu)`,
      `${project}: ${projectURL}`,
      thanks,
      `${dependencies}: ${dependencyProjects.map(({ name }) => name).join(', ')}.`,
    ].join('\n\n'),
  };
}

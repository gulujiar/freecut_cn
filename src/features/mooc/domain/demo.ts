import type { MoocSequenceDocument } from '@/types/mooc';

export interface DemoSlideCopy {
  label: string;
  kicker: string;
  title: string;
  body: string;
  cards: Array<[string, string, string]>;
}

export const DEMO_SLIDES: DemoSlideCopy[] = [
  {
    label: '06 · Recap → Next',
    kicker: '06 · Recap → Next',
    title: 'Next module: cloud AI services',
    body: '业务目标已经清楚，接下来看它运行在哪一层云上。',
    cards: [
      ['01', 'API key and billing', '模型即服务，按 token 计费。'],
      ['02', 'Layered architecture', '应用跑在 ECS，连接模型服务与 RDS。'],
      ['03', 'The key red line', '密钥只放环境变量，绝不进代码。'],
    ],
  },
  {
    label: 'API key and billing',
    kicker: '01',
    title: 'API key and billing',
    body: 'Models as a service: one key, one endpoint, pay per token.',
    cards: [],
  },
  {
    label: 'Layered architecture',
    kicker: '02',
    title: 'Layered architecture',
    body: '应用运行在 ECS，并连接模型服务与 RDS。',
    cards: [],
  },
  {
    label: 'The key red line',
    kicker: '03',
    title: 'The key red line',
    body: '密钥只存在环境变量中，绝不写进代码或截图。',
    cards: [],
  },
];

/** Sample sequence used when a project has no MOOC document yet. Media ids are filled after import. */
export function createDemoSequence(): MoocSequenceDocument {
  return {
    version: '1.0',
    title: 'Cloud AI Services in Practice',
    packaging: {
      intro: {
        duration: 8,
        title: 'Cloud AI Services in Practice',
        subtitle: 'SHENZHEN UNIVERSITY OF INFORMATION TECHNOLOGY',
        sample: true,
      },
      outro: {
        duration: 6,
        title: '感谢收看',
        subtitle: 'NEXT MODULE · CLOUD AI SERVICES',
        sample: true,
      },
    },
    cues: [
      { id: 'b1', start: 8, end: 15.2, camera: 'half', slide: 0, text: '欢迎来到 Cloud AI Services in Practice。' },
      { id: 'b2', start: 15.2, end: 23, camera: 'ppt', slide: 0, text: '业务已经明确，接下来看它跑在哪一层云上。' },
      { id: 'b3', start: 23, end: 32.4, camera: 'pip', slide: 1, text: '第一块：API Key 与计费，模型即服务，按 token 付费。' },
      { id: 'b4', start: 32.4, end: 41, camera: 'ppt', slide: 2, text: '第二块：分层架构，应用跑在 ECS，并连接模型服务与数据库。' },
      { id: 'b5', start: 41, end: 49.6, camera: 'half', slide: 2, text: '请把这张图记下来，后面的实验都会用到这三层。' },
      { id: 'b6', start: 49.6, end: 58.2, camera: 'ppt', slide: 3, text: '第三块是红线：密钥只能放在环境变量里。' },
      { id: 'b7', start: 58.2, end: 66, camera: 'pip', slide: 3, text: '不要写进代码，也不要出现在截图或演示文稿里。' },
      { id: 'b8', start: 66, end: 74, camera: 'half', slide: 0, text: '课前思考：如果店铺流量今天扩大十倍，图中哪一层会先撑不住？' },
    ],
    slides: DEMO_SLIDES.map((slide) => ({ label: slide.label, sample: true })),
    sample: {
      audio: true,
      lecturer: true,
      slides: true,
      background: true,
    },
  };
}

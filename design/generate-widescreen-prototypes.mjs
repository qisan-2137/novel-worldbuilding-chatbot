import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const outDir = new URL('./widescreen-prototypes/', import.meta.url)

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function text(x, y, value, cls = 'body') {
  return `<text x="${x}" y="${y}" class="${cls}">${esc(value)}</text>`
}

function rect(x, y, w, h, r = 18, cls = 'card') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" class="${cls}"/>`
}

function chip(x, y, label, w = 92) {
  return `${rect(x, y, w, 34, 10, 'chip')}${text(x + 18, y + 23, label, 'chipText')}`
}

function line(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="line"/>`
}

function base(title, body) {
  return `<svg width="1600" height="900" viewBox="0 0 1600 900" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="70" y2="70" gradientUnits="userSpaceOnUse">
      <stop stop-color="#7487FF"/>
      <stop offset="1" stop-color="#4E63E7"/>
    </linearGradient>
    <linearGradient id="scene" x1="0" y1="0" x2="420" y2="180" gradientUnits="userSpaceOnUse">
      <stop stop-color="#82C5FF"/>
      <stop offset="0.55" stop-color="#B8E4C7"/>
      <stop offset="1" stop-color="#F2D6A4"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="28" flood-color="#182235" flood-opacity="0.08"/>
    </filter>
    <style>
      text { font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif; fill: #1E2633; }
      .page { fill: #F7F8FC; }
      .shell { fill: #FFFFFF; stroke: rgba(32,42,58,0.10); filter: url(#shadow); }
      .card { fill: #FFFFFF; stroke: rgba(32,42,58,0.10); }
      .soft { fill: #F7F9FE; stroke: rgba(32,42,58,0.09); }
      .selected { fill: #EEF2FF; stroke: rgba(86,103,235,0.14); }
      .brand { fill: url(#brand); }
      .line { stroke: rgba(32,42,58,0.10); }
      .title { font-size: 29px; font-weight: 760; }
      .h2 { font-size: 23px; font-weight: 740; }
      .h3 { font-size: 18px; font-weight: 740; }
      .body { font-size: 16px; }
      .small { font-size: 14px; fill: #647084; }
      .tiny { font-size: 12px; fill: #8993A3; }
      .nav { font-size: 13px; font-weight: 700; fill: #5667EB; }
      .chip { fill: #F4F6FB; stroke: rgba(32,42,58,0.08); }
      .chipText { font-size: 13px; fill: #596579; font-weight: 700; }
      .buttonText { font-size: 15px; fill: #fff; font-weight: 760; }
    </style>
  </defs>
  <rect width="1600" height="900" class="page"/>
  ${text(52, 54, title, 'tiny')}
  ${body}
</svg>`
}

const prototypes = [
  {
    name: '01-main-chat-workspace',
    title: 'Prototype 01 / 主会话工作台',
    body: `
      ${rect(36, 36, 1528, 828, 18, 'shell')}
      ${rect(36, 36, 78, 828, 18, 'soft')}
      <rect x="58" y="62" width="36" height="36" rx="10" class="brand"/>
      ${chip(52, 154, '会话', 52)}
      ${text(62, 226, '大纲', 'small')}
      ${text(56, 298, '创作场景', 'small')}
      ${text(58, 370, '灵感库', 'small')}
      ${text(58, 806, '设置', 'small')}
      ${rect(114, 36, 218, 828, 0, 'card')}
      ${text(146, 80, '默认小说企划', 'h3')}
      ${text(146, 106, '围绕同一部小说的世界观、灵感与设定', 'tiny')}
      ${rect(146, 146, 156, 34, 9, 'card')}
      ${text(188, 168, '+ 新建会话', 'small')}
      ${rect(146, 210, 156, 56, 8, 'selected')}
      ${text(160, 234, '帮我设计一个有关奶龙世界', 'small')}
      ${text(160, 254, '的世界观', 'small')}
      ${text(146, 308, '帮我设计一个帝国蒸汽', 'small')}
      ${text(146, 328, '的船舶魔法工业世界...', 'small')}
      ${line(146, 358, 302, 358)}
      ${text(146, 400, '我想写一部带有科幻气质', 'small')}
      ${text(146, 420, '的星际政治小说...', 'small')}
      ${line(332, 116, 1564, 116)}
      ${text(374, 80, '帮我设计一个有关奶龙世界的世界观', 'title')}
      ${text(1114, 80, '每次回复都会同步更新世界观条目和大纲节点。', 'small')}
      ${rect(374, 156, 1144, 62, 10, 'soft')}
      ${text(436, 190, '助手', 'small')}${text(1452, 190, '21:12', 'tiny')}
      ${text(436, 210, '帮我设计一个有关奶龙世界的世界观', 'body')}
      ${rect(374, 248, 1144, 62, 10, 'soft')}
      ${text(436, 282, '助手', 'small')}${text(1452, 282, '23:30', 'tiny')}
      ${text(436, 302, '111', 'body')}
      ${rect(374, 340, 1144, 62, 10, 'soft')}
      ${text(436, 374, '助手', 'small')}${text(1430, 374, '05/20 15:32', 'tiny')}
      ${text(436, 394, '帮我设计一个有关奶龙世界的世界观', 'body')}
      ${rect(374, 430, 1144, 176, 10, 'card')}
      ${text(396, 462, '例如：帮我设计一个拥有贵族血脉魔法和铁路工业革命并存的世界，并整理科技体系、魔法体系和核心冲突。', 'small')}
      ${rect(396, 556, 1086, 44, 12, 'soft')}
      ${text(486, 584, '请输入你的问题，Shift + Enter 换行', 'tiny')}
      <rect x="1440" y="562" width="36" height="36" rx="10" class="brand"/>
    `,
  },
  {
    name: '02-worldbook-settings-outline',
    title: 'Prototype 02 / 设置与大纲',
    body: `
      ${rect(72, 44, 1456, 812, 18, 'shell')}
      ${text(112, 88, '←  设置与大纲', 'title')}
      ${text(116, 154, '世界观', 'nav')}${text(260, 154, '大纲', 'h3')}${text(390, 154, '设置', 'h3')}
      ${line(116, 176, 188, 176)}
      ${rect(112, 202, 206, 604, 10, 'card')}
      ${text(136, 242, '世界书页', 'h3')}
      ${rect(132, 282, 158, 42, 8, 'selected')}${text(154, 309, '奶辉界', 'nav')}
      ${text(154, 364, '魔法体系', 'body')}${text(154, 424, '种族与势力', 'body')}
      ${text(154, 484, '历史与事件', 'body')}${text(154, 544, '地理与环境', 'body')}${text(154, 604, '科技体系', 'body')}
      ${rect(132, 752, 158, 38, 8, 'card')}${text(158, 776, '+ 新建书页', 'small')}
      ${rect(340, 202, 1144, 604, 10, 'card')}
      ${text(386, 272, '奶辉界', 'title')}${rect(1390, 240, 74, 36, 8, 'card')}${text(1410, 263, '编辑', 'small')}
      ${text(386, 326, '一个由龙族、翼乳生物与古代天空遗迹共同构成的多层奇幻世界。', 'body')}
      ${text(386, 392, '奶辉界由三层空间组成：地表的育生大陆、漂浮于天空的云翼群岛，以及埋藏在深层地脉中的古龙殿域。这个世界的生命循环依赖一种名为“灵乳”的自然能量。', 'body')}
      ${text(386, 458, '多数龙族在出生后依赖奶辉界乳以幼龙形态存活，因此奶龙在文化上既是弱小象征，也是希望象征。', 'body')}
      ${text(386, 552, '表面世界天空澄澈，实际上是灵乳流动的能量流系统，许多地区开始出现长停滞、族群异变与古遗迹苏醒。', 'body')}
      ${text(386, 760, '最后更新：今天 21:12', 'tiny')}${rect(1362, 742, 102, 38, 8, 'card')}${text(1382, 766, '历史版本', 'small')}
    `,
  },
  {
    name: '03-outline-chapters',
    title: 'Prototype 03 / 大纲章节',
    body: `
      ${rect(72, 44, 1456, 812, 18, 'shell')}
      ${text(112, 88, '←  大纲', 'title')}${rect(1340, 62, 130, 38, 9, 'card')}${text(1370, 86, '+ 新建章节', 'small')}
      ${line(72, 116, 1528, 116)}
      ${rect(112, 154, 280, 650, 10, 'soft')}${text(136, 196, '章节列表', 'tiny')}
      ${rect(130, 238, 220, 40, 8, 'selected')}${text(150, 263, '序章 世界的开端', 'nav')}
      ${text(150, 324, '第一章 龙鳞初醒', 'body')}${text(150, 384, '第二章 雾岛迷踪', 'body')}
      ${text(150, 444, '第三章 遗迹之门', 'body')}${text(150, 504, '第四章 血脉回响', 'body')}${text(150, 564, '第五章 天空裂痕', 'body')}
      ${rect(420, 154, 1010, 650, 12, 'card')}${text(462, 224, '序章 世界的开端', 'title')}
      ${text(462, 292, '核心内容', 'h3')}${text(462, 340, '远古时代，灵乳从天脉而落，滋养了大地与生灵，龙族与人类在奶辉界的各层共存，故事从一场异常的雾暴开始。', 'body')}
      ${text(462, 430, '关键节点', 'h3')}${text(482, 474, '• 灵乳畸变', 'body')}${text(482, 514, '• 龙脉出现', 'body')}${text(482, 554, '• 文明崩芽', 'body')}
      ${rect(462, 728, 204, 38, 8, 'card')}${text(488, 752, '编辑大纲', 'small')}
    `,
  },
  {
    name: '04-creative-scenes',
    title: 'Prototype 04 / 创作场景',
    body: `
      ${rect(72, 44, 1456, 812, 18, 'shell')}
      ${text(112, 88, '←  创作场景', 'title')}${rect(1340, 62, 130, 38, 9, 'card')}${text(1370, 86, '+ 新增场景', 'small')}
      ${line(72, 116, 1528, 116)}
      ${rect(112, 154, 330, 650, 10, 'soft')}${text(136, 196, '场景列表', 'tiny')}
      ${rect(130, 238, 260, 42, 8, 'selected')}${text(152, 265, '奶辉界 · 育生大陆', 'nav')}
      ${text(152, 326, '云翼群岛 · 风语村', 'body')}${text(152, 386, '古龙殿域 · 深渊入口', 'body')}${text(152, 446, '天空裂隙 · 边境地带', 'body')}
      ${rect(470, 154, 960, 650, 12, 'card')}
      <rect x="504" y="200" width="846" height="220" rx="14" fill="url(#scene)"/>
      <path d="M540 380 C630 300 700 336 770 286 C850 230 910 330 996 260 C1090 190 1158 286 1288 218 L1350 420 L504 420 Z" fill="#FFFFFF" fill-opacity="0.62"/>
      ${text(504, 480, '奶辉界 · 育生大陆', 'h2')}
      ${text(504, 532, '奶辉界最主要的地表区域，灵乳能量最为充沛，孕育了繁荣的文明与多样的生物。', 'body')}
      ${text(504, 612, '关联设定', 'small')}${chip(504, 636, '地理与环境', 106)}${chip(626, 636, '种族与势力', 106)}${chip(748, 636, '历史与事件', 106)}
      ${rect(1226, 730, 124, 38, 8, 'card')}${text(1254, 754, '编辑场景', 'small')}
    `,
  },
  {
    name: '05-inspiration-library',
    title: 'Prototype 05 / 灵感库',
    body: `
      ${rect(72, 44, 1456, 812, 18, 'shell')}
      ${text(112, 88, '←  灵感库', 'title')}
      ${line(72, 116, 1528, 116)}
      ${rect(112, 150, 880, 42, 8, 'card')}${text(140, 176, '搜索灵感关键词', 'small')}
      ${rect(1012, 150, 162, 42, 8, 'card')}${text(1052, 176, '全部类型', 'small')}
      ${rect(112, 226, 1080, 84, 12, 'card')}${chip(142, 248, '世界观', 72)}${text(236, 258, '灵乳能量失衡导致的生态异变', 'h3')}${text(1120, 258, '2天前', 'tiny')}
      ${text(236, 286, '幻想素材', 'tiny')}
      ${rect(112, 334, 1080, 84, 12, 'card')}${chip(142, 356, '科技体系', 86)}${text(236, 366, '龙族失落技术“脉能核心”', 'h3')}${text(1120, 366, '3天前', 'tiny')}
      ${rect(112, 442, 1080, 84, 12, 'card')}${chip(142, 464, '历史与事件', 98)}${text(236, 474, '古龙晚钟的沉睡守护者', 'h3')}${text(1120, 474, '5天前', 'tiny')}
      ${rect(112, 550, 1080, 84, 12, 'card')}${chip(142, 572, '种族与势力', 98)}${text(236, 582, '云翼群岛的信仰冲突', 'h3')}${text(1120, 582, '1周前', 'tiny')}
    `,
  },
  {
    name: '06-chat-detail',
    title: 'Prototype 06 / 聊天详情',
    body: `
      ${rect(72, 44, 1456, 812, 18, 'shell')}
      ${text(112, 88, '←  帮我设计一个有关奶龙世界的世界观', 'h2')}${rect(1320, 62, 82, 38, 9, 'card')}${text(1344, 86, '分享', 'small')}${rect(1418, 62, 74, 38, 9, 'card')}${text(1440, 86, '更多', 'small')}
      ${line(72, 116, 1528, 116)}
      ${rect(868, 154, 500, 48, 12, 'selected')}${text(920, 184, '帮我设计一个拥有贵族血脉魔法和铁路工业革命并存的世界', 'small')}
      ${text(120, 288, '⌘', 'nav')}${rect(190, 250, 1130, 318, 12, 'card')}
      ${text(220, 298, '好的，以下是为你设计的世界观概要，包含科技体系、魔法体系和核心冲突。', 'body')}
      ${rect(220, 350, 1034, 172, 10, 'soft')}${text(250, 392, '世界概览', 'h3')}
      ${text(250, 444, '这是一个魔法与工业并存的世界，贵族掌握古老血脉魔法，工匠与工程师推动铁路与机械革命。', 'body')}
      ${text(250, 484, '新旧秩序的冲突，将决定整个世界的走向。', 'body')}
      ${text(726, 548, '↓', 'h2')}
      ${rect(112, 742, 1376, 56, 12, 'card')}${text(210, 777, '请输入你的问题，Shift + Enter 换行', 'tiny')}<rect x="1434" y="752" width="36" height="36" rx="10" class="brand"/>
    `,
  },
]

await mkdir(outDir, { recursive: true })
await Promise.all(
  prototypes.map(async (prototype) => {
    const svg = base(prototype.title, prototype.body)
    await writeFile(join(outDir.pathname, `${prototype.name}.svg`), svg, 'utf8')
  }),
)

try {
  const sharp = (await import('sharp')).default
  await Promise.all(
    prototypes.map(async (prototype) => {
      await sharp(join(outDir.pathname, `${prototype.name}.svg`), { density: 144 })
        .png()
        .toFile(join(outDir.pathname, `${prototype.name}.png`))
    }),
  )
} catch (error) {
  console.warn(`PNG export skipped: ${error instanceof Error ? error.message : String(error)}`)
}

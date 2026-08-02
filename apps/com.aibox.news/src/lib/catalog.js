// 主题 / 源形态 / 内置精选源目录 —— 逐条对齐 NewsCore.swift + NewsSourceCatalog.swift（48 条，默认开 14 条）。
// 源名是专有名词，不参与本地化。

export const TOPICS = ['top', 'world', 'china', 'tech', 'business', 'science', 'culture', 'sports', 'health', 'general']

/** 资讯页 chip 与订阅页分组的顺序（与原生 NewsTopic.allCases 一致）。 */
export const TOPIC_ORDER = TOPICS

export const TOPIC_ICON = {
  top: 'newspaper',
  world: 'globe',
  china: 'building.columns',
  tech: 'cpu',
  business: 'chart.line.uptrend.xyaxis',
  science: 'atom',
  culture: 'books.vertical',
  sports: 'sportscourt',
  health: 'heart.text.square',
  general: 'square.grid.2x2',
}

export const FEED_KINDS = ['rss', 'atom', 'rsshub', 'api']

export function topicKey(topic) {
  return topic ? `news.topic.${topic}` : 'news.topic.all'
}

const gnews = (section) => (section
  ? `https://news.google.com/rss/headlines/section/topic/${section}?hl=zh-CN&gl=CN&ceid=CN:zh-Hans`
  : 'https://news.google.com/rss?hl=zh-CN&gl=CN&ceid=CN:zh-Hans')

/** [title, endpoint, kind, topic, enabled] */
export const SEEDS = [
  // ——— 头条 / 综合 ———
  { title: 'Google 头条', endpoint: gnews(''), kind: 'rss', topic: 'top', enabled: true },

  // ——— 国内 ———
  { title: '澎湃新闻', endpoint: 'https://feedx.net/rss/thepaper.xml', kind: 'rss', topic: 'china', enabled: true },
  { title: 'Google 国内', endpoint: gnews('NATION'), kind: 'rss', topic: 'china', enabled: true },
  { title: 'Sixth Tone', endpoint: 'https://www.sixthtone.com/rss', kind: 'rss', topic: 'china', enabled: false },

  // ——— 国际 ———
  { title: 'BBC 中文网', endpoint: 'https://www.bbc.co.uk/zhongwen/simp/index.xml', kind: 'rss', topic: 'world', enabled: true },
  { title: '纽约时报中文网', endpoint: 'https://cn.nytimes.com/rss/', kind: 'rss', topic: 'world', enabled: true },
  { title: '德国之声中文', endpoint: 'https://rss.dw.com/rdf/rss-chi-all', kind: 'rss', topic: 'world', enabled: false },
  { title: 'Google 世界', endpoint: gnews('WORLD'), kind: 'rss', topic: 'world', enabled: false },
  { title: 'BBC World', endpoint: 'https://feeds.bbci.co.uk/news/world/rss.xml', kind: 'rss', topic: 'world', enabled: false },
  { title: 'The Guardian', endpoint: 'https://www.theguardian.com/international/rss', kind: 'rss', topic: 'world', enabled: false },

  // ——— 科技 ———
  { title: '少数派', endpoint: 'https://sspai.com/feed', kind: 'rss', topic: 'tech', enabled: true },
  { title: 'IT之家', endpoint: 'https://www.ithome.com/rss/', kind: 'rss', topic: 'tech', enabled: true },
  { title: 'Solidot 奇客', endpoint: 'https://www.solidot.org/index.rss', kind: 'rss', topic: 'tech', enabled: true },
  { title: 'Google 科技', endpoint: gnews('TECHNOLOGY'), kind: 'rss', topic: 'tech', enabled: false },
  { title: '爱范儿', endpoint: 'https://www.ifanr.com/feed', kind: 'rss', topic: 'tech', enabled: false },
  { title: '新浪科技', endpoint: 'https://rss.sina.com.cn/tech/rollnews.xml', kind: 'rss', topic: 'tech', enabled: false },
  { title: 'InfoQ 中文', endpoint: 'https://www.infoq.cn/feed', kind: 'rss', topic: 'tech', enabled: false },
  { title: '阮一峰', endpoint: 'https://www.ruanyifeng.com/blog/atom.xml', kind: 'atom', topic: 'tech', enabled: false },
  { title: 'TechCrunch', endpoint: 'https://techcrunch.com/feed/', kind: 'rss', topic: 'tech', enabled: false },
  { title: 'The Verge', endpoint: 'https://www.theverge.com/rss/index.xml', kind: 'rss', topic: 'tech', enabled: false },
  { title: 'Ars Technica', endpoint: 'https://feeds.arstechnica.com/arstechnica/index', kind: 'rss', topic: 'tech', enabled: false },
  { title: 'Hacker News', endpoint: 'https://news.ycombinator.com/rss', kind: 'rss', topic: 'tech', enabled: false },

  // ——— 财经 ———
  { title: '华尔街见闻', endpoint: 'https://dedicated.wallstreetcn.com/rss.xml', kind: 'rss', topic: 'business', enabled: true },
  { title: '36氪', endpoint: 'https://36kr.com/feed', kind: 'rss', topic: 'business', enabled: true },
  { title: 'Google 财经', endpoint: gnews('BUSINESS'), kind: 'rss', topic: 'business', enabled: false },
  { title: '钛媒体', endpoint: 'https://www.tmtpost.com/feed', kind: 'rss', topic: 'business', enabled: false },
  { title: 'WSJ Markets', endpoint: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', kind: 'rss', topic: 'business', enabled: false },
  { title: 'CNBC', endpoint: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', kind: 'rss', topic: 'business', enabled: false },
  { title: 'MarketWatch', endpoint: 'https://feeds.marketwatch.com/marketwatch/topstories/', kind: 'rss', topic: 'business', enabled: false },
  { title: 'Forbes', endpoint: 'https://www.forbes.com/business/feed/', kind: 'rss', topic: 'business', enabled: false },

  // ——— 科学 ———
  { title: 'Google 科学', endpoint: gnews('SCIENCE'), kind: 'rss', topic: 'science', enabled: true },
  { title: 'Nature', endpoint: 'https://www.nature.com/nature.rss', kind: 'rss', topic: 'science', enabled: false },
  { title: '科学美国人', endpoint: 'https://rss.sciam.com/ScientificAmerican-Global', kind: 'rss', topic: 'science', enabled: false },
  { title: 'Phys.org', endpoint: 'https://phys.org/rss-feed/', kind: 'rss', topic: 'science', enabled: false },
  { title: 'NASA', endpoint: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', kind: 'rss', topic: 'science', enabled: false },
  { title: 'Quanta', endpoint: 'https://www.quantamagazine.org/feed/', kind: 'rss', topic: 'science', enabled: false },

  // ——— 体育 ———
  { title: 'Google 体育', endpoint: gnews('SPORTS'), kind: 'rss', topic: 'sports', enabled: true },
  { title: 'ESPN', endpoint: 'https://www.espn.com/espn/rss/news', kind: 'rss', topic: 'sports', enabled: false },
  { title: 'BBC Sport', endpoint: 'https://feeds.bbci.co.uk/sport/rss.xml', kind: 'rss', topic: 'sports', enabled: false },
  { title: 'Guardian Sport', endpoint: 'https://www.theguardian.com/sport/rss', kind: 'rss', topic: 'sports', enabled: false },

  // ——— 健康 ———
  { title: 'Google 健康', endpoint: gnews('HEALTH'), kind: 'rss', topic: 'health', enabled: true },
  { title: 'NYT Health', endpoint: 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml', kind: 'rss', topic: 'health', enabled: false },
  { title: 'WHO', endpoint: 'https://www.who.int/rss-feeds/news-english.xml', kind: 'rss', topic: 'health', enabled: false },

  // ——— 文化 ———
  { title: 'Google 娱乐', endpoint: gnews('ENTERTAINMENT'), kind: 'rss', topic: 'culture', enabled: true },
  { title: 'NYT Arts', endpoint: 'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml', kind: 'rss', topic: 'culture', enabled: false },
  { title: 'Guardian Culture', endpoint: 'https://www.theguardian.com/culture/rss', kind: 'rss', topic: 'culture', enabled: false },

  // ——— RSSHub 路由（默认关，需先在设置页配实例）———
  { title: '知乎热榜', endpoint: '/zhihu/hotlist', kind: 'rsshub', topic: 'china', enabled: false },
  { title: '微博热搜', endpoint: '/weibo/search/hot', kind: 'rsshub', topic: 'china', enabled: false },
  { title: 'B站每周必看', endpoint: '/bilibili/weekly', kind: 'rsshub', topic: 'culture', enabled: false },
]

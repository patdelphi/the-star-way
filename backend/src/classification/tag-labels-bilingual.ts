/**
 * 标签双语映射表
 * key 为字典中的中文 label，value 为英文翻译
 * 用于前端切换语言时显示对应标签
 */
export const TAG_LABEL_EN: Record<string, string> = {
  // AI
  'AI / LLM': 'AI / LLM',
  '机器学习': 'Machine Learning',
  'NLP / 文本': 'NLP / Text',
  '计算机视觉': 'Computer Vision',
  '生成式 AI': 'Generative AI',
  'MLOps': 'MLOps',
  'AI Agent': 'AI Agent',
  'MCP': 'MCP',
  'RAG / 向量检索': 'RAG / Vector Search',

  // Web
  '前端框架': 'Frontend Framework',
  'JavaScript / TypeScript': 'JavaScript / TypeScript',
  'CSS / 样式': 'CSS / Styling',
  'Node.js / 服务端': 'Node.js / Server',
  'Web 技术': 'Web Tech',
  'API / 通信': 'API / Communication',

  // DevOps
  '容器 / 编排': 'Container / Orchestration',
  'DevOps / CI-CD': 'DevOps / CI-CD',
  'CLI / Shell': 'CLI / Shell',
  '云计算': 'Cloud Computing',
  '监控 / 可观测': 'Monitoring / Observability',

  // 数据
  '数据库': 'Database',
  '数据库工具': 'Database Tools',
  '数据科学': 'Data Science',
  '大数据': 'Big Data',

  // 安全
  '安全 / 隐私': 'Security / Privacy',
  '加密 / 密码学': 'Cryptography',

  // 工具
  '版本控制': 'Version Control',
  '编辑器 / IDE': 'Editor / IDE',
  '效率工具': 'Productivity',
  'Awesome 列表': 'Awesome List',
  '文档': 'Documentation',
  '测试': 'Testing',
  '工具库': 'Utility Library',
  'CLI 工具': 'CLI Tool',
  '项目模板': 'Boilerplate',
  '参考文档': 'Reference',
  '机器人': 'Bot',
  '管理面板': 'Admin Panel',
  '后端服务': 'Backend Service',

  // 语言
  'Python': 'Python',
  'Rust': 'Rust',
  'Go': 'Go',
  'Java / JVM': 'Java / JVM',
  'C / C++': 'C / C++',
  'Swift': 'Swift',
  'Ruby': 'Ruby',
  'PHP': 'PHP',

  // 移动端
  'iOS': 'iOS',
  'Android': 'Android',
  '跨平台移动': 'Cross-Platform Mobile',

  // 区块链
  '区块链 / Web3': 'Blockchain / Web3',

  // 游戏
  '游戏开发': 'Game Dev',
  '游戏 Mod': 'Game Mod',

  // 底层
  '系统 / 嵌入式': 'System / Embedded',
  '网络': 'Networking',

  // 设计
  '设计 / UI': 'Design / UI',
  '多媒体': 'Multimedia',

  // 描述类
  '学习资源': 'Learning Resources',
  '开源': 'Open Source',
  '可自托管': 'Self-hosted',
  '隐私保护': 'Privacy-focused',
  '轻量级': 'Lightweight',
  '跨平台': 'Cross-Platform',
  '实时': 'Real-time',
}

/**
 * 获取标签的英文翻译
 * 如果没有映射，返回原始标签
 */
export function getTagEnLabel(zhLabel: string): string {
  return TAG_LABEL_EN[zhLabel] || zhLabel
}

/**
 * 根据语言获取标签显示文本
 */
export function getTagLabel(zhLabel: string, lang: 'zh' | 'en'): string {
  if (lang === 'en') return getTagEnLabel(zhLabel)
  return zhLabel
}

/**
 * 标签字典定义
 * 一级标签为分类大类，二级标签为细分领域
 * 每条规则定义匹配源（topic/name/description）和对应的标签
 */

// 标签分类规则
export interface TagRule {
  // 匹配关键词（topic 精确匹配 / name 和 description 模糊匹配）
  keywords: string[]
  // 匹配到的关键词对应的标签
  label: string
  // 一级分类（可选，用于分组显示）
  category?: string
  // 匹配模式：exact（精确匹配）或 includes（包含匹配）
  matchMode: 'exact' | 'includes'
}

// ===== Topic 精确匹配规则 =====
export const TOPIC_TAG_RULES: TagRule[] = [
  // AI / LLM
  { keywords: ['ai', 'artificial-intelligence', 'llm', 'large-language-model', 'gpt', 'openai', 'langchain', 'copilot'], label: 'AI / LLM', category: 'AI' },
  { keywords: ['machine-learning', 'ml', 'deep-learning', 'neural-network', 'pytorch', 'tensorflow', 'keras', 'hugging-face'], label: '机器学习', category: 'AI' },
  { keywords: ['nlp', 'natural-language-processing', 'text-generation', 'sentiment-analysis', 'chatbot'], label: 'NLP / 文本', category: 'AI' },
  { keywords: ['computer-vision', 'image-processing', 'object-detection', 'opencv'], label: '计算机视觉', category: 'AI' },
  { keywords: ['generative-ai', 'diffusion', 'stable-diffusion', 'midjourney', 'image-generation'], label: '生成式 AI', category: 'AI' },
  { keywords: ['mlops', 'mlflow', 'model-serving'], label: 'MLOps', category: 'AI' },

  // Agent / MCP
  { keywords: ['agent', 'autonomous-agent', 'ai-agent', 'llm-agent', 'function-calling'], label: 'AI Agent', category: 'AI' },
  { keywords: ['mcp', 'model-context-protocol'], label: 'MCP', category: 'AI' },
  { keywords: ['rag', 'retrieval-augmented', 'vector-database', 'vector-search', 'embedding', 'chromadb', 'pinecone', 'weaviate', 'qdrant', 'milvus'], label: 'RAG / 向量检索', category: 'AI' },

  // Web 开发
  { keywords: ['react', 'vue', 'angular', 'svelte', 'solid', 'preact', 'nextjs', 'nuxt', 'gatsby'], label: '前端框架', category: 'Web' },
  { keywords: ['typescript', 'javascript', 'es6', 'deno', 'bun'], label: 'JavaScript / TypeScript', category: 'Web' },
  { keywords: ['css', 'tailwindcss', 'sass', 'less', 'styled-components', 'postcss', 'windi-css'], label: 'CSS / 样式', category: 'Web' },
  { keywords: ['nodejs', 'express', 'koa', 'fastify', 'nest', 'hono', 'elysia', 'astro'], label: 'Node.js / 服务端', category: 'Web' },
  { keywords: ['html', 'web-components', 'webassembly', 'wasm'], label: 'Web 技术', category: 'Web' },
  { keywords: ['graphql', 'rest', 'api', 'grpc', 'protobuf'], label: 'API / 通信', category: 'Web' },

  // 后端 / 运维
  { keywords: ['docker', 'kubernetes', 'k8s', 'container', 'podman'], label: '容器 / 编排', category: 'DevOps' },
  { keywords: ['devops', 'ci-cd', 'github-actions', 'jenkins', 'gitlab-ci', 'terraform', 'ansible'], label: 'DevOps / CI-CD', category: 'DevOps' },
  { keywords: ['linux', 'shell', 'bash', 'zsh', 'cli', 'command-line', 'terminal', 'tui'], label: 'CLI / Shell', category: '工具' },
  { keywords: ['cloud', 'aws', 'azure', 'gcp', 'serverless', 'cloud-native'], label: '云计算', category: 'DevOps' },
  { keywords: ['monitoring', 'observability', 'logging', 'prometheus', 'grafana', 'elk'], label: '监控 / 可观测', category: 'DevOps' },

  // 数据库
  { keywords: ['database', 'sql', 'mysql', 'postgresql', 'sqlite', 'mongodb', 'redis', 'dynamodb', 'prisma', 'drizzle', 'supabase', 'cockroachdb'], label: '数据库', category: '数据' },
  { keywords: ['orm', 'query-builder', 'migration', 'database-tool'], label: '数据库工具', category: '数据' },

  // 安全
  { keywords: ['security', 'encryption', 'authentication', 'authorization', 'oauth', 'jwt', 'vpn', 'privacy', 'zero-trust'], label: '安全 / 隐私', category: '安全' },
  { keywords: ['cryptography', 'hash', 'ssl', 'tls', 'certificate'], label: '加密 / 密码学', category: '安全' },

  // 工具
  { keywords: ['git', 'version-control'], label: '版本控制', category: '工具' },
  { keywords: ['vim', 'neovim', 'emacs', 'editor', 'ide', 'vscode', 'vscode-extension', 'coc-nvim'], label: '编辑器 / IDE', category: '工具' },
  { keywords: ['productivity'], label: '效率工具', category: '工具' },
  { keywords: ['awesome-list', 'awesome', 'curated-list', 'resources', 'learning-resources'], label: 'Awesome 列表', category: '资源' },
  { keywords: ['documentation', 'docs', 'static-site', 'docusaurus', 'mdbook', 'mkdocs'], label: '文档', category: '工具' },
  { keywords: ['testing', 'test', 'jest', 'vitest', 'pytest', 'cypress', 'playwright', 'selenium', 'unit-test', 'e2e'], label: '测试', category: '工具' },

  // 语言生态
  { keywords: ['python', 'python3', 'python-library'], label: 'Python', category: '语言' },
  { keywords: ['rust', 'cargo'], label: 'Rust', category: '语言' },
  { keywords: ['go', 'golang'], label: 'Go', category: '语言' },
  { keywords: ['java', 'kotlin', 'scala', 'jvm', 'spring', 'gradle', 'maven'], label: 'Java / JVM', category: '语言' },
  { keywords: ['c', 'c-plus-plus', 'cpp', 'cplusplus'], label: 'C / C++', category: '语言' },
  { keywords: ['swift', 'swiftlang'], label: 'Swift', category: '语言' },
  { keywords: ['ruby', 'rails', 'ruby-on-rails'], label: 'Ruby', category: '语言' },
  { keywords: ['php', 'laravel'], label: 'PHP', category: '语言' },

  // 移动端
  { keywords: ['ios', 'swiftui', 'uikit', 'swift-ios'], label: 'iOS', category: '移动端' },
  { keywords: ['android', 'kotlin-android', 'jetpack-compose'], label: 'Android', category: '移动端' },
  { keywords: ['react-native', 'flutter', 'dart', 'cross-platform', 'mobile'], label: '跨平台移动', category: '移动端' },

  // 数据科学 / 分析
  { keywords: ['data-science', 'data-analysis', 'jupyter', 'notebook', 'pandas', 'numpy', 'matplotlib', 'plotly', 'data-visualization'], label: '数据科学', category: '数据' },
  { keywords: ['big-data', 'spark', 'hadoop', 'kafka', 'streaming', 'data-pipeline', 'etl'], label: '大数据', category: '数据' },

  // 区块链
  { keywords: ['blockchain', 'crypto', 'ethereum', 'solidity', 'web3', 'defi', 'nft', 'smart-contract'], label: '区块链 / Web3', category: '区块链' },

  // 游戏开发
  { keywords: ['game', 'game-engine', 'game-development', 'unity', 'unreal', 'godot', 'bevy'], label: '游戏开发', category: '游戏' },
  { keywords: ['minecraft', 'mod'], label: '游戏 Mod', category: '游戏' },

  // 操作系统 / 底层
  { keywords: ['os', 'operating-system', 'kernel', 'linux-kernel', 'system-programming', 'embedded', 'iot'], label: '系统 / 嵌入式', category: '底层' },
  { keywords: ['networking', 'network', 'dns', 'proxy', 'vpn', 'firewall', 'nginx', 'caddy', 'traefik'], label: '网络', category: '底层' },

  // 设计
  { keywords: ['design', 'ui', 'ux', 'design-system', 'figma', 'icon', 'font', 'color', 'accessibility'], label: '设计 / UI', category: '设计' },
  { keywords: ['image', 'screenshot', 'photo', 'video', 'audio', 'media', 'ffmpeg', 'svg'], label: '多媒体', category: '设计' },
]

// ===== 仓库名称关键词匹配规则 =====
export const NAME_TAG_RULES: TagRule[] = [
  { keywords: ['awesome', 'list', 'collection', 'curated'], label: 'Awesome 列表', matchMode: 'includes' },
  { keywords: ['boilerplate', 'starter', 'template', 'scaffold'], label: '项目模板', matchMode: 'includes' },
  { keywords: ['cheatsheet', 'reference', 'guide', 'handbook', 'book'], label: '参考文档', matchMode: 'includes' },
  { keywords: ['tool', 'util', 'utils', 'helper', 'kit', 'toolbox'], label: '工具库', matchMode: 'includes' },
  { keywords: ['cli', 'command', 'terminal', 'shell', 'console'], label: 'CLI 工具', matchMode: 'includes' },
  { keywords: ['bot', 'chatbot', 'telegram-bot', 'discord-bot'], label: '机器人', matchMode: 'includes' },
  { keywords: ['dashboard', 'admin', 'panel', 'monitor', 'analytics'], label: '管理面板', matchMode: 'includes' },
  { keywords: ['api', 'server', 'backend', 'service', 'microservice'], label: '后端服务', matchMode: 'includes' },
]

// ===== 描述关键词匹配规则 =====
export const DESC_TAG_RULES: TagRule[] = [
  { keywords: ['learn', 'tutorial', 'course', 'education', 'beginner', 'getting started'], label: '学习资源', matchMode: 'includes' },
  { keywords: ['open source', 'opensource', 'free software'], label: '开源', matchMode: 'includes' },
  { keywords: ['self-hosted', 'self-hostable', 'host-your-own'], label: '可自托管', matchMode: 'includes' },
  { keywords: ['privacy', 'privacy-focused', 'privacy-respecting'], label: '隐私保护', matchMode: 'includes' },
  { keywords: ['fast', 'lightweight', 'minimal', 'tiny', 'zero-dependency', 'no-dependency'], label: '轻量级', matchMode: 'includes' },
  { keywords: ['cross-platform', 'multi-platform', 'portable'], label: '跨平台', matchMode: 'includes' },
  { keywords: ['real-time', 'realtime', 'websocket', 'live'], label: '实时', matchMode: 'includes' },
]

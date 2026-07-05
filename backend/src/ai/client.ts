/**
 * AI 客户端 - OpenAI 兼容接口
 * 用于生成 README 摘要、中文翻译等
 */
import { loadAiConfig } from './config.js'
import { buildLearningPathPrompt, buildStarDnaPrompt } from '@shared/ai/index.js'

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

/**
 * 调用 AI 生成内容
 * @param messages 对话消息列表
 * @returns 生成的文本内容
 */
export async function chat(messages: AiMessage[]): Promise<string> {
  const config = loadAiConfig()
  if (!config.enabled) {
    throw new Error('AI 功能未启用，请配置 STARWAY_AI_BASE_URL、STARWAY_AI_API_KEY、STARWAY_AI_MODEL')
  }

  const res = await fetch(`${config.base_url}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.api_key}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AI API 错误 (${res.status}): ${text}`)
  }

  const data = await res.json() as AiResponse
  return data.choices[0]?.message?.content?.trim() || ''
}

/**
 * 将中文文本翻译为英文
 * @param text 中文文本
 * @returns 英文文本
 */
export async function translateToEnglish(text: string): Promise<string> {
  if (!text.trim()) return text

  const prompt = `将以下中文文本翻译为英文。保持原有格式（如 Markdown 标记、JSON 结构），只翻译内容，不要加任何前缀或说明。

${text}`

  return chat([
    { role: 'system', content: 'You are a professional translator. Translate Chinese text to natural, fluent English. Preserve all formatting (Markdown, JSON). Output only the translation.' },
    { role: 'user', content: prompt },
  ])
}

export interface RepoAnalysisResult {
  summary: string
  starReason: string
  reuseAdvice: string
}

/**
 * 将仓库分析结果翻译为英文（逐字段翻译）
 */
export async function translateRepoAnalysisToEnglish(analysis: RepoAnalysisResult): Promise<RepoAnalysisResult> {
  const [summary, starReason, reuseAdvice] = await Promise.all([
    translateToEnglish(analysis.summary),
    translateToEnglish(analysis.starReason),
    translateToEnglish(analysis.reuseAdvice),
  ])
  return { summary, starReason, reuseAdvice }
}

/**
 * 生成仓库深度分析（摘要 + 星标原因 + 复用建议）
 * @param fullName 仓库全名
 * @param description 仓库描述
 * @param language 主语言
 * @param topics 标签列表
 * @returns 结构化分析结果
 */
export async function generateReadmeSummary(
  fullName: string,
  description: string,
  language: string,
  topics: string[],
): Promise<string> {
  const result = await generateRepoAnalysis(fullName, description, language, topics)
  return result.summary
}

export async function generateRepoAnalysis(
  fullName: string,
  description: string,
  language: string,
  topics: string[],
): Promise<RepoAnalysisResult> {
  const prompt = `请分析以下 GitHub 仓库，输出 JSON 格式的分析结果。

仓库：${fullName}
描述：${description || '无'}
语言：${language || '未知'}
标签：${topics.join(', ') || '无'}

请输出严格的 JSON（不要加 markdown 代码块标记），包含三个字段：
- summary: 100-200字中文摘要，说明项目用途、技术特点和适用场景，要有具体洞察而非泛泛而谈
- starReason: 50-100字，说明为什么值得 star 这个项目，给出具体的亮点和价值点，不要只重复语言和协议
- reuseAdvice: 50-100字，给出复用建议，包括集成难度、注意事项、适合的复用场景，不要只说"参考架构"

示例输出格式：
{"summary":"...","starReason":"...","reuseAdvice":"..."}`

  const raw = await chat([
    { role: 'system', content: '你是一个资深开源项目分析师，擅长给出有洞察力的技术分析。你的回复必须是纯 JSON，不要加任何 markdown 标记。' },
    { role: 'user', content: prompt },
  ])

  // 尝试解析 JSON
  try {
    // 去除可能的 markdown 代码块标记
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      summary: parsed.summary || '',
      starReason: parsed.starReason || '',
      reuseAdvice: parsed.reuseAdvice || '',
    }
  } catch {
    // JSON 解析失败，把整段作为 summary
    return { summary: raw, starReason: '', reuseAdvice: '' }
  }
}

/**
 * 生成开发者 Star DNA 画像
 * @param login 用户登录名
 * @param stats 用户统计信息
 * @returns 开发者画像描述
 */
export async function generateStarDna(
  login: string,
  stats: {
    repoCount: number
    activeRepoCount: number
    languages: { language: string; count: number }[]
    tags: { tag: string; count: number }[]
    topRepos?: { full_name: string; description: string; stars: number }[]
  },
): Promise<string> {
  const prompt = buildStarDnaPrompt(login, stats)

  return chat([
    { role: 'system', content: '你是一个资深开发者社区分析师，擅长根据 GitHub 星标数据给出有洞察力的技术画像。' },
    { role: 'user', content: prompt },
  ])
}

/**
 * 生成学习路径推荐
 * @param login 用户登录名
 * @param stats 用户统计信息
 * @returns Markdown 格式的学习路径
 */
export async function generateLearningPath(
  login: string,
  stats: {
    repoCount: number
    languages: { language: string; count: number }[]
    tags: { tag: string; count: number }[]
    topRepos?: { full_name: string; description: string; stars: number }[]
  },
): Promise<string> {
  const prompt = buildLearningPathPrompt(login, stats)

  return chat([
    { role: 'system', content: '你是一个资深技术学习规划师，擅长根据开发者的兴趣标签和星标仓库生成个性化的学习路径。请引用具体项目名称给出有针对性的建议。' },
    { role: 'user', content: prompt },
  ])
}

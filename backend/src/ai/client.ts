/**
 * AI 客户端 - OpenAI 兼容接口
 * 用于生成 README 摘要、中文翻译等
 */
import { loadAiConfig } from './config.js'

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
 * 生成 README 摘要
 * @param fullName 仓库全名
 * @param description 仓库描述
 * @param language 主语言
 * @param topics 标签列表
 * @returns 中文摘要
 */
export async function generateReadmeSummary(
  fullName: string,
  description: string,
  language: string,
  topics: string[],
): Promise<string> {
  const prompt = `请为以下 GitHub 仓库生成一段简短的中文摘要（100-200 字），说明这个项目的用途、技术特点和适用场景。

仓库：${fullName}
描述：${description || '无'}
语言：${language || '未知'}
标签：${topics.join(', ') || '无'}

请直接输出摘要，不要加任何前缀或格式标记。`

  return chat([
    { role: 'system', content: '你是一个技术文档摘要专家，擅长用简洁的中文概括开源项目。' },
    { role: 'user', content: prompt },
  ])
}

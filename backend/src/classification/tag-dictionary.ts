/**
 * 标签字典（已迁移到 shared/classification）
 * 这里 re-export 保持向后兼容
 */
export {
  TOPIC_TAG_RULES,
  NAME_TAG_RULES,
  DESC_TAG_RULES,
} from '@shared/classification/tag-dictionary.js'
export type { TagRule } from '@shared/classification/tag-dictionary.js'

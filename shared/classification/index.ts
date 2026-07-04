/**
 * 分类模块入口（运行时无关的纯逻辑和数据）
 */
export { classifyRepo } from './classifier.js'
export type { ClassifyTagResult } from './classifier.js'
export { TOPIC_TAG_RULES, NAME_TAG_RULES, DESC_TAG_RULES } from './tag-dictionary.js'
export type { TagRule } from './tag-dictionary.js'
export { TAG_LABEL_EN, getTagEnLabel, getTagLabel } from './tag-labels-bilingual.js'

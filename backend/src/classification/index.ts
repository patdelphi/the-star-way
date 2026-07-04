/**
 * the-star-way 分类模块统一导出
 * 纯函数和标签字典从 shared 引用，db 版本保留本地
 */
export { classifyAllRepos, classifyReposForUser, classifyRepo } from './classifier.js'
export type { ClassificationResult, ClassifyTagResult } from './classifier.js'
export { TOPIC_TAG_RULES, NAME_TAG_RULES, DESC_TAG_RULES } from './tag-dictionary.js'
export type { TagRule } from './tag-dictionary.js'
export { TAG_LABEL_EN, getTagEnLabel, getTagLabel } from './tag-labels-bilingual.js'

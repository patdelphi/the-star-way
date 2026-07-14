/**
 * 分享卡片生成工具。
 * 使用原生 SVG / Canvas 生成可下载图片，并内置一个固定版本 QR 编码器用于展示开发者网址。
 */

export interface ShareCardData {
  login: string
  displayName?: string | null
  shareUrl: string
  systemUrl: string
  repoCount: number | null
  hiddenGemsCount: number | null
  sleepStarsCount: number | null
  topInterests: string[]
  learningPath?: string | null
  starDna?: string | null
  language: string
  labels: {
    brand: string
    projectName: string
    projectDescription: string
    title: string
    subtitle: string
    dnaLabel: string
    interests: string
    starredRepos: string
    hiddenGems: string
    sleepingStars: string
    learningPath: string
    fallbackPath: string
    footer: string
    qrLabel: string
    systemUrlLabel: string
    githubProfileLabel: string
    fullReportHint: string
  }
}

const QR_VERSION = 4
const QR_SIZE = 33
const QR_DATA_CODEWORDS = 80
const QR_EC_CODEWORDS = 20

const escapeXml = (value: string): string => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;")

const displayValue = (value: number | null): string => value === null || value === undefined ? "—" : String(value)

const normalizeCardText = (value: string): string => value
  .replace(/`/g, "")
  .replace(/^#{1,6}\s+/gm, "")
  .replace(/^\s*[-•]\s+/gm, "")
  .replace(/\*\*/g, "")
  .replace(/\s+/g, " ")
  .trim()

const truncate = (value: string, maxLength: number): string => {
  const text = normalizeCardText(value)
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

const summarizeLearningPath = (value: string, fallback: string): string => {
  const text = normalizeCardText(value || fallback)
  if (!text) return fallback
  const withoutStagePrefix = text.replace(/^阶段[一二三四五六七八九十\d]+[:：]\s*/, "")
  const sentence = withoutStagePrefix.split(/[。.!?？]/).find((item) => item.trim().length > 0)
  return truncate(sentence || withoutStagePrefix, 92)
}

const summarizeProfile = (value: string, fallback: string): string => {
  const text = normalizeCardText(value || fallback)
  const firstSentence = text.split(/[。.!?？]/).find((item) => item.trim().length > 0)
  return truncate(firstSentence || text || fallback, 54)
}

const buildLearningSummary = (interests: string[], fallback: string): string => {
  const selected = interests.slice(0, 3).map((item) => normalizeCardText(item)).filter(Boolean)
  return selected.length > 0 ? selected.join(" / ") : fallback
}

/** 按近似字宽拆分 SVG 文本，避免浏览器不能自动换行导致文本越界。 */
function wrapTextLines(value: string, maxChars: number, maxLines: number): string[] {
  const text = normalizeCardText(value)
  if (!text) return []
  const tokens = text.includes(" ") ? text.split(/\s+/) : Array.from(text)
  const lines: string[] = []
  let line = ""

  for (const token of tokens) {
    const separator = text.includes(" ") && line ? " " : ""
    const next = `${line}${separator}${token}`
    if (next.length <= maxChars) {
      line = next
      continue
    }
    if (line) lines.push(line)
    line = token.length > maxChars ? `${token.slice(0, maxChars - 1)}…` : token
    if (lines.length >= maxLines) break
  }

  if (line && lines.length < maxLines) lines.push(line)
  if (lines.length > 0 && lines.length === maxLines && text.length > lines.join(" ").length) {
    lines[lines.length - 1] = truncate(lines[lines.length - 1], Math.max(2, maxChars))
  }
  return lines
}

function wrapSvgText(lines: string[], x: number, y: number, lineHeight: number, className = "", extra = ""): string {
  const attrs = [className ? `class="${className}"` : "", extra].filter(Boolean).join(" ")
  const tspans = lines.map((line, index) => (
    `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
  )).join("")
  return `<text x="${x}" y="${y}" ${attrs}>${tspans}</text>`
}

function makeByteStream(value: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(value.slice(0, 72)))
  const bits: number[] = []
  const push = (number: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((number >> i) & 1)
  }

  push(0b0100, 4)
  push(bytes.length, 8)
  bytes.forEach((byte) => push(byte, 8))
  const maxBits = QR_DATA_CODEWORDS * 8
  const terminator = Math.min(4, maxBits - bits.length)
  for (let i = 0; i < terminator; i += 1) bits.push(0)
  while (bits.length % 8 !== 0) bits.push(0)

  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0))
  }
  for (let pad = 0; data.length < QR_DATA_CODEWORDS; pad += 1) data.push(pad % 2 === 0 ? 0xec : 0x11)
  return data
}

function buildGaloisTables() {
  const exp = new Array<number>(512).fill(0)
  const log = new Array<number>(256).fill(0)
  let value = 1
  for (let i = 0; i < 255; i += 1) {
    exp[i] = value
    log[value] = i
    value <<= 1
    if (value & 0x100) value ^= 0x11d
  }
  for (let i = 255; i < 512; i += 1) exp[i] = exp[i - 255]
  return { exp, log }
}

function qrErrorCorrection(data: number[]): number[] {
  const { exp, log } = buildGaloisTables()
  const multiply = (a: number, b: number) => (a === 0 || b === 0 ? 0 : exp[log[a] + log[b]])
  let generator = [1]
  for (let i = 0; i < QR_EC_CODEWORDS; i += 1) {
    const next = new Array(generator.length + 1).fill(0)
    generator.forEach((coef, index) => {
      next[index] ^= multiply(coef, exp[i])
      next[index + 1] ^= coef
    })
    generator = next
  }

  const message = [...data, ...new Array(QR_EC_CODEWORDS).fill(0)]
  for (let i = 0; i < data.length; i += 1) {
    const coef = message[i]
    if (coef === 0) continue
    generator.forEach((gen, index) => {
      message[i + index] ^= multiply(gen, coef)
    })
  }
  return message.slice(data.length)
}

function reserve(matrix: (boolean | null)[][], reserved: boolean[][], x: number, y: number, dark: boolean) {
  if (x < 0 || y < 0 || x >= QR_SIZE || y >= QR_SIZE) return
  matrix[y][x] = dark
  reserved[y][x] = true
}

function addFinder(matrix: (boolean | null)[][], reserved: boolean[][], x: number, y: number) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const xx = x + dx
      const yy = y + dy
      if (xx < 0 || yy < 0 || xx >= QR_SIZE || yy >= QR_SIZE) continue
      const inBox = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6
      const dark = inBox && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4))
      reserve(matrix, reserved, xx, yy, dark)
    }
  }
}

function addAlignment(matrix: (boolean | null)[][], reserved: boolean[][], centerX: number, centerY: number) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy))
      reserve(matrix, reserved, centerX + dx, centerY + dy, distance !== 1)
    }
  }
}

function formatBits(mask: number): number {
  let bits = (0b01 << 3) | mask
  let value = bits << 10
  for (let i = 14; i >= 10; i -= 1) {
    if ((value >> i) & 1) value ^= 0x537 << (i - 10)
  }
  return (((bits << 10) | value) ^ 0x5412) & 0x7fff
}

function addFormat(matrix: (boolean | null)[][], reserved: boolean[][], mask: number) {
  const bits = formatBits(mask)
  const coordsA = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]]
  const coordsB = [[QR_SIZE - 1, 8], [QR_SIZE - 2, 8], [QR_SIZE - 3, 8], [QR_SIZE - 4, 8], [QR_SIZE - 5, 8], [QR_SIZE - 6, 8], [QR_SIZE - 7, 8], [8, QR_SIZE - 8], [8, QR_SIZE - 7], [8, QR_SIZE - 6], [8, QR_SIZE - 5], [8, QR_SIZE - 4], [8, QR_SIZE - 3], [8, QR_SIZE - 2], [8, QR_SIZE - 1]]
  coordsA.forEach(([x, y], index) => reserve(matrix, reserved, x, y, Boolean((bits >> index) & 1)))
  coordsB.forEach(([x, y], index) => reserve(matrix, reserved, x, y, Boolean((bits >> index) & 1)))
}

function applyMask(mask: number, x: number, y: number): boolean {
  if (mask === 0) return (x + y) % 2 === 0
  if (mask === 1) return y % 2 === 0
  return x % 3 === 0
}

export function buildQrMatrix(value: string): boolean[][] {
  const matrix: (boolean | null)[][] = Array.from({ length: QR_SIZE }, () => Array.from({ length: QR_SIZE }, () => null))
  const reserved: boolean[][] = Array.from({ length: QR_SIZE }, () => Array.from({ length: QR_SIZE }, () => false))
  addFinder(matrix, reserved, 0, 0)
  addFinder(matrix, reserved, QR_SIZE - 7, 0)
  addFinder(matrix, reserved, 0, QR_SIZE - 7)
  addAlignment(matrix, reserved, 26, 26)
  for (let i = 8; i < QR_SIZE - 8; i += 1) {
    reserve(matrix, reserved, i, 6, i % 2 === 0)
    reserve(matrix, reserved, 6, i, i % 2 === 0)
  }
  reserve(matrix, reserved, 8, QR_VERSION * 4 + 9, true)
  for (let i = 0; i < 9; i += 1) {
    if (matrix[8][i] === null) reserved[8][i] = true
    if (matrix[i][8] === null) reserved[i][8] = true
  }
  for (let i = QR_SIZE - 8; i < QR_SIZE; i += 1) {
    reserved[8][i] = true
    reserved[i][8] = true
  }

  const codewords = [...makeByteStream(value), ...qrErrorCorrection(makeByteStream(value))]
  const bits = codewords.flatMap((byte) => Array.from({ length: 8 }, (_, index) => (byte >> (7 - index)) & 1))
  let bitIndex = 0
  let upward = true
  for (let x = QR_SIZE - 1; x > 0; x -= 2) {
    if (x === 6) x -= 1
    for (let step = 0; step < QR_SIZE; step += 1) {
      const y = upward ? QR_SIZE - 1 - step : step
      for (let dx = 0; dx < 2; dx += 1) {
        const xx = x - dx
        if (reserved[y][xx]) continue
        const bit = bitIndex < bits.length ? bits[bitIndex] === 1 : false
        matrix[y][xx] = applyMask(0, xx, y) ? !bit : bit
        bitIndex += 1
      }
    }
    upward = !upward
  }
  addFormat(matrix, reserved, 0)
  return matrix.map((row) => row.map(Boolean))
}

function renderQrSvg(value: string, x: number, y: number, size: number): string {
  const matrix = buildQrMatrix(value)
  const module = size / QR_SIZE
  const cells = matrix.flatMap((row, rowIndex) => row.map((dark, colIndex) => dark
    ? `<rect x="${x + colIndex * module}" y="${y + rowIndex * module}" width="${module + 0.02}" height="${module + 0.02}" fill="#111827"/>`
    : "",
  )).join("")
  return `<g><rect x="${x - 14}" y="${y - 14}" width="${size + 28}" height="${size + 28}" rx="24" fill="#F8FAFF"/>${cells}</g>`
}

function renderMetric(label: string, value: string, x: number): string {
  return `<g transform="translate(${x} 686)"><rect width="198" height="106" rx="22" fill="#0C1430" fill-opacity=".42" stroke="#FFFFFF" stroke-opacity=".14"/><text x="22" y="34" class="label">${escapeXml(label)}</text><text x="22" y="82" font-size="37" font-weight="800">${escapeXml(value)}</text></g>`
}

/** Build a fixed-size share card SVG. */
export function buildShareCardSvg(data: ShareCardData): string {
  const title = escapeXml(truncate(data.displayName || data.login, 18))
  const login = escapeXml(data.login)
  const shareUrl = data.shareUrl || `https://github.com/${data.login}`
  const systemUrl = data.systemUrl || "https://starway.patdelphi.xyz"
  const systemUrlText = truncate(systemUrl.replace(/^https?:\/\//, ""), 36)
  const profileText = truncate(shareUrl.replace(/^https?:\/\//, ""), 32)
  const tags = data.topInterests.slice(0, 4).map((tag) => truncate(tag, 15))
  const tagMarkup = tags.map((tag, index) => {
    const x = 176 + index * 172
    const y = 620
    const width = Math.max(128, Math.min(150, tag.length * 8 + 38))
    const color = index % 2 === 0 ? "#7DE3FF" : "#B58CFF"
    return `<g><rect x="${x}" y="${y}" width="${width}" height="40" rx="20" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-opacity="0.55"/><text x="${x + width / 2}" y="${y + 25}" text-anchor="middle" class="tag">${escapeXml(tag)}</text></g>`
  }).join("")
  const projectLines = wrapTextLines(data.labels.projectDescription, 35, 2)
  const dnaLines = wrapTextLines(summarizeProfile(data.starDna || "", data.labels.fallbackPath), 30, 2)
  const pathLines = wrapTextLines(buildLearningSummary(tags, summarizeLearningPath(data.learningPath || "", data.labels.fallbackPath)), 24, 2)
  const qr = renderQrSvg(systemUrl, 744, 780, 132)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bg" x1="80" y1="40" x2="1000" y2="1060" gradientUnits="userSpaceOnUse"><stop stop-color="#111B3D"/><stop offset="0.52" stop-color="#20205C"/><stop offset="1" stop-color="#381D63"/></linearGradient>
    <linearGradient id="accent" x1="160" y1="700" x2="900" y2="930" gradientUnits="userSpaceOnUse"><stop stop-color="#7DE3FF"/><stop offset="1" stop-color="#B58CFF"/></linearGradient>
    <style>.body{font-family:Inter,Segoe UI,Arial,sans-serif;fill:#F8FAFF}.muted{fill:#C9D2F1}.label{font-size:15px;font-weight:700;letter-spacing:1.6px;fill:#A9B5DA}.tag{font-family:Inter,Segoe UI,Arial,sans-serif;font-size:16px;font-weight:700;fill:#F8FAFF}.copy{font-size:18px;font-weight:700;fill:#F8FAFF}.small{font-size:17px;font-weight:700;fill:#D8E0FF}.url{font-size:17px;font-weight:800;fill:#9EEAFF}</style>
  </defs>
  <rect width="1080" height="1080" rx="48" fill="url(#bg)"/>
  <circle cx="140" cy="160" r="2.5" fill="#B8DFFF"/><circle cx="930" cy="135" r="3" fill="#D7C6FF"/><circle cx="940" cy="910" r="2.5" fill="#B8DFFF"/>
  <path d="M54 270C220 80 470 54 715 110C900 152 1010 270 1044 446" fill="none" stroke="#9D9AFF" stroke-opacity=".18" stroke-width="2"/>
  <rect x="120" y="100" width="840" height="880" rx="42" fill="#FFFFFF" fill-opacity=".09" stroke="#FFFFFF" stroke-opacity=".22"/>
  <g class="body">
    <text x="176" y="176" font-size="23" font-weight="700">${escapeXml(data.labels.brand)}</text>
    <text x="878" y="176" text-anchor="end" font-size="17" font-weight="700" letter-spacing="3" fill="#9EEAFF">${escapeXml(data.labels.title)}</text>
    <text x="176" y="236" font-size="44" font-weight="850">${escapeXml(data.labels.projectName)}</text>
    ${wrapSvgText(projectLines, 176, 278, 26, "small")}
    <text x="176" y="336" class="label">${escapeXml(data.labels.systemUrlLabel)}</text>
    <text x="176" y="366" class="url">${escapeXml(systemUrlText)}</text>
    <text x="176" y="446" font-size="56" font-weight="850">${title}</text>
    <text x="176" y="486" font-size="20" class="muted">@${login}</text>
    <text x="176" y="522" class="label">${escapeXml(data.labels.dnaLabel)}</text>
    ${wrapSvgText(dnaLines, 176, 550, 27, "small")}
    <text x="176" y="598" class="label">${escapeXml(data.labels.interests)}</text>
    ${tagMarkup}
    ${renderMetric(data.labels.starredRepos, displayValue(data.repoCount), 176)}
    ${renderMetric(data.labels.hiddenGems, displayValue(data.hiddenGemsCount), 403)}
    ${renderMetric(data.labels.sleepingStars, displayValue(data.sleepStarsCount), 630)}
    <rect x="176" y="822" width="500" height="108" rx="28" fill="url(#accent)" fill-opacity=".13" stroke="#A7E9FF" stroke-opacity=".32"/>
    <text x="208" y="862" class="label" fill="#A9EFFF">${escapeXml(data.labels.learningPath)}</text>
    ${wrapSvgText(pathLines, 208, 894, 24, "copy")}
    ${qr}
    <text x="810" y="946" text-anchor="middle" class="label">${escapeXml(data.labels.qrLabel)}</text>
    <text x="744" y="758" class="label">${escapeXml(data.labels.fullReportHint)}</text>
    <text x="176" y="950" font-size="16" class="muted">${escapeXml(data.labels.githubProfileLabel)} · ${escapeXml(profileText)}</text>
  </g>
</svg>`
}

/** Convert SVG to PNG and trigger a browser download. */
export async function downloadShareCard(data: ShareCardData, filename: string): Promise<void> {
  const svg = buildShareCardSvg(data)
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.decoding = "async"
    image.src = url
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("SHARE_CARD_IMAGE_LOAD_FAILED"))
    })
    const canvas = document.createElement("canvas")
    canvas.width = 1080
    canvas.height = 1080
    const context = canvas.getContext("2d")
    if (!context) throw new Error("SHARE_CARD_CANVAS_UNAVAILABLE")
    context.drawImage(image, 0, 0, 1080, 1080)
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("SHARE_CARD_PNG_FAILED")), "image/png")
    })
    const downloadUrl = URL.createObjectURL(png)
    const anchor = document.createElement("a")
    anchor.href = downloadUrl
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(downloadUrl)
  } finally {
    URL.revokeObjectURL(url)
  }
}

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
    userTitleSuffix: string
    dnaLabel: string
    interests: string
    starredRepos: string
    hiddenGems: string
    sleepingStars: string
    learningPath: string
    fallbackPath: string
    footer: string
    qrLabel: string
    githubProfileLabel: string
    fullReportHint: string
    ctaTitle: string
    ctaSubtitle: string
    basedOnStars: string
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

const summarizeProfile = (value: string, fallback: string): string => {
  const text = normalizeCardText(value || fallback)
  const firstSentence = text.split(/[。.!?？]/).find((item) => item.trim().length > 0)
  return truncate(firstSentence || text || fallback, 92)
}

const buildProfileBadge = (interests: string[], fallback: string): string => {
  const selected = interests.slice(0, 3).map((item) => normalizeCardText(item)).filter(Boolean)
  return selected.length > 0 ? truncate(selected.join(" / "), 42) : truncate(fallback, 42)
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
    const lastLine = lines[lines.length - 1].replace(/[，,\s]+$/g, "")
    const ellipsisMax = Math.max(2, maxChars)
    lines[lines.length - 1] = lastLine.length >= ellipsisMax
      ? `${lastLine.slice(0, ellipsisMax - 1)}…`
      : `${lastLine}…`
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
  let generator: number[] = [1]
  for (let i = 0; i < QR_EC_CODEWORDS; i += 1) {
    const next = new Array(generator.length + 1).fill(0)
    generator.forEach((coef, index) => {
      next[index] ^= coef
      next[index + 1] ^= multiply(coef, exp[i])
    })
    generator = next
  }

  const remainder = [...data, ...new Array(QR_EC_CODEWORDS).fill(0)]
  for (let i = 0; i < data.length; i += 1) {
    const coef = remainder[i]
    if (coef === 0) continue
    generator.forEach((gen, index) => {
      remainder[i + index] ^= multiply(gen, coef)
    })
  }
  return remainder.slice(-QR_EC_CODEWORDS)
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
  const coordsB = [[QR_SIZE - 1, 8], [QR_SIZE - 2, 8], [QR_SIZE - 3, 8], [QR_SIZE - 4, 8], [QR_SIZE - 5, 8], [QR_SIZE - 6, 8], [QR_SIZE - 7, 8], [QR_SIZE - 8, 8], [8, QR_SIZE - 7], [8, QR_SIZE - 6], [8, QR_SIZE - 5], [8, QR_SIZE - 4], [8, QR_SIZE - 3], [8, QR_SIZE - 2], [8, QR_SIZE - 1]]
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

function renderMetric(label: string, value: string, x: number, y: number): string {
  return `<g transform="translate(${x} ${y})"><rect width="214" height="78" rx="22" fill="#0D1534" fill-opacity=".62" stroke="#FFFFFF" stroke-opacity=".16"/><text x="22" y="28" class="label">${escapeXml(label)}</text><text x="22" y="64" font-size="32" font-weight="850">${escapeXml(value)}</text></g>`
}

/** Build a fixed-size share card SVG. */
export function buildShareCardSvg(data: ShareCardData): string {
  const titleLines = wrapTextLines(`${data.displayName || data.login}${data.labels.userTitleSuffix}`, 25, 2)
  const login = escapeXml(data.login)
  const shareUrl = data.shareUrl || `https://github.com/${data.login}`
  const systemUrl = data.systemUrl || "https://starway.patdelphi.xyz"
  const systemUrlText = truncate(systemUrl, 44)
  const profileText = truncate(shareUrl, 40)
  const tags = data.topInterests.slice(0, 3).map((tag) => truncate(tag, 14))
  const tagY = 662
  const tagMarkup = tags.map((tag, index) => {
    const x = 150 + index * 176
    const y = tagY
    const width = Math.max(130, Math.min(154, tag.length * 8 + 40))
    const color = index % 2 === 0 ? "#7DE3FF" : "#B58CFF"
    return `<g><rect x="${x}" y="${y}" width="${width}" height="40" rx="20" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-opacity="0.55"/><text x="${x + width / 2}" y="${y + 25}" text-anchor="middle" class="tag">${escapeXml(tag)}</text></g>`
  }).join("")
  const dnaLines = wrapTextLines(summarizeProfile(data.starDna || "", data.labels.fallbackPath), 42, 2)
  const profileBadge = buildProfileBadge(data.topInterests, data.labels.fallbackPath)
  const basedOnStars = data.labels.basedOnStars.replace("{{count}}", displayValue(data.repoCount))
  const ctaLines = wrapTextLines(data.labels.ctaSubtitle, 42, 3)
  const profileY = 302 + Math.max(0, titleLines.length - 1) * 48
  const dnaLabelY = profileY + 44
  const profileBadgeY = dnaLabelY + 40
  const dnaY = profileBadgeY + 36
  const basedOnY = dnaY + Math.max(1, dnaLines.length) * 24 + 11
  const metricY = Math.max(520, basedOnY + 20)
  const interestsY = 642
  // 二维码固定在独立 CTA 区，和统计/正文彻底分离。
  const qr = renderQrSvg(systemUrl, 730, 744, 166)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bg" x1="70" y1="30" x2="1020" y2="1060" gradientUnits="userSpaceOnUse"><stop stop-color="#102340"/><stop offset="0.48" stop-color="#222057"/><stop offset="1" stop-color="#36205D"/></linearGradient>
    <linearGradient id="hero" x1="120" y1="104" x2="920" y2="916" gradientUnits="userSpaceOnUse"><stop stop-color="#7DE3FF" stop-opacity=".20"/><stop offset="1" stop-color="#B58CFF" stop-opacity=".16"/></linearGradient>
    <linearGradient id="cta" x1="120" y1="738" x2="960" y2="966" gradientUnits="userSpaceOnUse"><stop stop-color="#E7FBFF"/><stop offset="1" stop-color="#F5F0FF"/></linearGradient>
    <style>.body{font-family:Inter,Segoe UI,Arial,sans-serif;fill:#F8FAFF}.muted{fill:#C9D2F1}.label{font-size:15px;font-weight:750;letter-spacing:1.5px;fill:#A9B5DA}.tag{font-family:Inter,Segoe UI,Arial,sans-serif;font-size:16px;font-weight:750;fill:#F8FAFF}.copy{font-size:20px;font-weight:760;fill:#F8FAFF}.small{font-size:18px;font-weight:720;fill:#D8E0FF}.url{font-size:18px;font-weight:820;fill:#9EEAFF}.dark{fill:#15213F}.darkMuted{fill:#536079}</style>
  </defs>
  <rect width="1080" height="1080" rx="56" fill="url(#bg)"/>
  <path d="M72 260C240 76 486 56 724 116C900 160 1016 286 1040 456" fill="none" stroke="#9D9AFF" stroke-opacity=".16" stroke-width="2"/>
  <path d="M64 840C258 1018 594 1040 1016 842" fill="none" stroke="#7DE3FF" stroke-opacity=".14" stroke-width="2"/>
  <rect x="108" y="96" width="864" height="888" rx="48" fill="#FFFFFF" fill-opacity=".08" stroke="#FFFFFF" stroke-opacity=".18"/>
  <rect x="136" y="126" width="808" height="582" rx="42" fill="url(#hero)" stroke="#FFFFFF" stroke-opacity=".14"/>
  <rect x="136" y="724" width="808" height="240" rx="42" fill="url(#cta)" class="share-card-cta"/>
  <g class="body">
    <text x="150" y="186" font-size="24" font-weight="760">${escapeXml(data.labels.brand)}</text>
    <text x="890" y="186" text-anchor="end" font-size="17" font-weight="760" letter-spacing="3" fill="#9EEAFF">${escapeXml(data.labels.title)}</text>
    ${wrapSvgText(titleLines, 150, 250, 48, "", 'font-size="46" font-weight="880"')}
    <text x="150" y="${profileY}" font-size="19" class="muted">@${login} · ${escapeXml(data.labels.githubProfileLabel)} ${escapeXml(profileText)}</text>
    <text x="150" y="${dnaLabelY}" class="label">${escapeXml(data.labels.dnaLabel)}</text>
    <text x="150" y="${profileBadgeY}" font-size="25" font-weight="850">${escapeXml(profileBadge)}</text>
    ${wrapSvgText(dnaLines, 150, dnaY, 24, "small")}
    <text x="150" y="${basedOnY}" font-size="16" class="muted">${escapeXml(basedOnStars)}</text>
    <text x="150" y="${interestsY}" class="label">${escapeXml(data.labels.interests)}</text>
    ${tagMarkup}
    ${renderMetric(data.labels.starredRepos, displayValue(data.repoCount), 150, metricY)}
    ${renderMetric(data.labels.hiddenGems, displayValue(data.hiddenGemsCount), 382, metricY)}
    ${renderMetric(data.labels.sleepingStars, displayValue(data.sleepStarsCount), 614, metricY)}
    <text x="176" y="798" font-size="38" font-weight="880" class="dark">${escapeXml(data.labels.ctaTitle)}</text>
    ${wrapSvgText(ctaLines, 176, 840, 27, "darkMuted")}
    <text x="176" y="916" font-size="17" font-weight="820" class="darkMuted">${escapeXml(data.labels.projectName)}</text>
    <text x="176" y="946" font-size="18" font-weight="780" class="darkMuted">${escapeXml(systemUrlText)}</text>
    ${qr}
    <text x="813" y="942" text-anchor="middle" font-size="16" font-weight="850" class="dark">${escapeXml(data.labels.qrLabel)}</text>
    <text x="813" y="958" text-anchor="middle" font-size="13" class="darkMuted">${escapeXml(data.labels.fullReportHint)}</text>
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

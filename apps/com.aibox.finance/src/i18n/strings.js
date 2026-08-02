// 文案表（规格 §12，逐字取自原生 `FinancePluginKit/Resources/Localizable.xcstrings`）。
// 键名保持与原生一致，便于两边对照与后续差分。
//
// 注意：**大数字缩写「万/亿」不在这里**——它在 lib/format.js 里对中英文一视同仁（原生标了 i18n:ignore）。

import { ZH } from './strings.zh.js'
import { EN } from './strings.en.js'

export const STRINGS = { 'zh-Hans': ZH, en: EN }

// 金额表达式求值（对应原生 LedgerAmountExpression）。
//
// 纪律：**全程零浮点**。词法 + 递归下降解析成精确有理数（BigInt 分子/分母），
// 只在最后一步 `×100 四舍五入到分` 时才落成整数。原生用 Swift `Decimal`；这里用有理数，
// 精度只会更好（`10/3*3` 在定点数下会漂成 9.99，有理数恒等于 10）。
//
// 文法（标准优先级 + 括号）：
//   expression := term (('+' | '-') term)*
//   term       := factor (('*' | '/') factor)*
//   factor     := '+' factor | '-' factor | '(' expression ')' | number
//   number     := digit+ ( ('.' | ',') digit+ )?      // 最多一个分隔符；',' 等同小数点
/** 错误码，与原生 `LedgerAmountExpression.Error` 一一对应。 */
export const ExprError = {
    empty: 'empty',
    invalidToken: 'invalidToken',
    missingOperand: 'missingOperand',
    mismatchedParenthesis: 'mismatchedParenthesis',
    divisionByZero: 'divisionByZero',
    trailingInput: 'trailingInput',
};
export class ExpressionError extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
        this.name = 'ExpressionError';
    }
}
// MARK: - 有理数（BigInt 分子 / 分母，分母恒 > 0，恒约分）
function gcd(a, b) {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}
function rat(n, d) {
    if (d === 0n)
        throw new ExpressionError(ExprError.divisionByZero);
    let num = n;
    let den = d;
    if (den < 0n) {
        num = -num;
        den = -den;
    }
    const g = gcd(num, den);
    if (g > 1n) {
        num /= g;
        den /= g;
    }
    return { n: num, d: den };
}
const ZERO = { n: 0n, d: 1n };
const add = (a, b) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => rat(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => rat(a.n * b.n, a.d * b.d);
const neg = (a) => ({ n: -a.n, d: a.d });
function div(a, b) {
    if (b.n === 0n)
        throw new ExpressionError(ExprError.divisionByZero);
    return rat(a.n * b.d, a.d * b.n);
}
/** 有理数 × 100 → 整数分，四舍五入（half away from zero，与 Swift `.plain` 一致）。 */
export function ratToMinor(value) {
    const num = value.n * 100n;
    const den = value.d;
    const negative = num < 0n;
    const abs = negative ? -num : num;
    // floor(abs/den) + (余数×2 >= den ? 1 : 0)
    let q = abs / den;
    const r = abs % den;
    if (r * 2n >= den)
        q += 1n;
    return Number(negative ? -q : q);
}
// MARK: - 预归一
/** 进解析器前逐字符替换：全角运算符与逗号。 */
export function normalizeExpression(input) {
    let out = '';
    for (const ch of String(input ?? '')) {
        if (ch === '−')
            out += '-'; // − 减号
        else if (ch === '×')
            out += '*'; // ×
        else if (ch === '÷')
            out += '/'; // ÷
        else if (ch === '，')
            out += ','; // 全角逗号
        else
            out += ch;
    }
    return out;
}
// MARK: - 词法
const DIGITS = '0123456789';
function tokenize(source) {
    const tokens = [];
    let i = 0;
    while (i < source.length) {
        const ch = source[i] ?? '';
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
            i += 1;
            continue;
        }
        if (DIGITS.includes(ch) || ch === '.' || ch === ',') {
            let digits = '';
            let fraction = '';
            let separatorSeen = false;
            while (i < source.length) {
                const c = source[i] ?? '';
                if (DIGITS.includes(c)) {
                    if (separatorSeen)
                        fraction += c;
                    else
                        digits += c;
                    i += 1;
                }
                else if (c === '.' || c === ',') {
                    // 一个数里出现两个分隔符 → invalidToken
                    if (separatorSeen)
                        throw new ExpressionError(ExprError.invalidToken);
                    separatorSeen = true;
                    i += 1;
                }
                else
                    break;
            }
            if (digits.length === 0 && fraction.length === 0)
                throw new ExpressionError(ExprError.invalidToken);
            const whole = digits.length > 0 ? digits : '0';
            const scale = BigInt(10) ** BigInt(fraction.length);
            const n = BigInt(whole) * scale + (fraction.length > 0 ? BigInt(fraction) : 0n);
            tokens.push({ kind: 'number', value: rat(n, scale) });
            continue;
        }
        if ('+-*/()'.includes(ch)) {
            tokens.push({ kind: ch });
            i += 1;
            continue;
        }
        throw new ExpressionError(ExprError.invalidToken);
    }
    return tokens;
}
// MARK: - 递归下降
class Parser {
    tokens;
    index;
    constructor(tokens) {
        this.tokens = tokens;
        this.index = 0;
    }
    peek() {
        return this.index < this.tokens.length ? (this.tokens[this.index] ?? null) : null;
    }
    expression() {
        let value = this.term();
        for (;;) {
            const token = this.peek();
            if (!token || (token.kind !== '+' && token.kind !== '-'))
                return value;
            this.index += 1;
            const right = this.term();
            value = token.kind === '+' ? add(value, right) : sub(value, right);
        }
    }
    term() {
        let value = this.factor();
        for (;;) {
            const token = this.peek();
            if (!token || (token.kind !== '*' && token.kind !== '/'))
                return value;
            this.index += 1;
            const right = this.factor();
            value = token.kind === '*' ? mul(value, right) : div(value, right);
        }
    }
    factor() {
        const token = this.peek();
        if (!token)
            throw new ExpressionError(ExprError.missingOperand);
        if (token.kind === '+') {
            this.index += 1;
            return this.factor();
        }
        if (token.kind === '-') {
            this.index += 1;
            return neg(this.factor());
        }
        if (token.kind === '(') {
            this.index += 1;
            const value = this.expression();
            const closing = this.peek();
            if (!closing || closing.kind !== ')')
                throw new ExpressionError(ExprError.mismatchedParenthesis);
            this.index += 1;
            return value;
        }
        if (token.kind === 'number') {
            this.index += 1;
            return token.value;
        }
        if (token.kind === ')')
            throw new ExpressionError(ExprError.mismatchedParenthesis);
        throw new ExpressionError(ExprError.missingOperand);
    }
}
/** 求值成有理数。抛 `ExpressionError`。 */
export function evaluateRational(input) {
    const source = normalizeExpression(input).trim();
    if (source.length === 0)
        throw new ExpressionError(ExprError.empty);
    const parser = new Parser(tokenize(source));
    const value = parser.expression();
    const rest = parser.peek();
    if (rest) {
        if (rest.kind === ')')
            throw new ExpressionError(ExprError.mismatchedParenthesis);
        throw new ExpressionError(ExprError.trailingInput);
    }
    return value;
}
/** 求值成整数分（round_half_up(value × 100)）。抛 `ExpressionError`。 */
export function evaluateMinor(input) {
    return ratToMinor(evaluateRational(input));
}
/** 求值成整数分；失败返回 null（UI 用，不想接异常的地方）。 */
export function tryEvaluateMinor(input) {
    try {
        return evaluateMinor(input);
    }
    catch (error) {
        return null;
    }
}
/**
 * 折叠成显示串（按「=」时把表达式收成结果串）。
 *
 * ⚠️ 复刻原生怪癖：内部走「取绝对值」的纯数字格式化，**负结果会丢负号**（`-5` → `5`）。
 * 因为保存要求 > 0，实际不影响落账。见 README「有意保留的原生怪癖」。
 */
export function displayValue(input) {
    const minor = evaluateMinor(input);
    const abs = Math.abs(minor);
    const whole = Math.trunc(abs / 100);
    const cents = abs % 100;
    if (cents === 0)
        return String(whole);
    if (cents % 10 === 0)
        return `${whole}.${cents / 10}`;
    return `${whole}.${String(cents).padStart(2, '0')}`;
}
// MARK: - 计算器键盘的输入规则（§2.7 ⑥）
const OPERATORS = '+-−*×/÷';
const TOKEN_BREAKERS = '+−-×*÷/()';
/** 取当前正在输入的数字 token（切分符 = `+ − × ÷ * / ( )`）。 */
export function currentToken(input) {
    const text = String(input ?? '');
    let start = text.length;
    while (start > 0 && !TOKEN_BREAKERS.includes(text[start - 1] ?? ''))
        start -= 1;
    return text.slice(start);
}
/** 追加一个运算符。空串时只允许负号；末尾已是运算符则替换。 */
export function appendOperator(input, op) {
    const text = String(input ?? '');
    if (text.length === 0)
        return op === '−' ? op : text;
    const last = text[text.length - 1] ?? '';
    if (OPERATORS.includes(last))
        return text.slice(0, -1) + op;
    return text + op;
}
/** 追加小数点：当前 token 已有小数点则忽略；token 为空时补成 `0.`。 */
export function appendDot(input) {
    const text = String(input ?? '');
    const token = currentToken(text);
    if (token.includes('.'))
        return text;
    if (token.length === 0)
        return `${text}0.`;
    return `${text}.`;
}
/** 追加数字：小数位已 ≥ 2 则忽略；token 恰为 "0" 时先删掉（禁止 `07`）。 */
export function appendDigit(input, digit) {
    const text = String(input ?? '');
    const token = currentToken(text);
    const dot = token.indexOf('.');
    if (dot >= 0 && token.length - dot - 1 >= 2)
        return text;
    if (token === '0')
        return `${text.slice(0, -1)}${digit}`;
    return `${text}${digit}`;
}

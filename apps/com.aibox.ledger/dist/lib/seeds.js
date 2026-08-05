// 内置种子（§4.8 完整清单）。
//
// 触发时机：**分类表为空**时（首次启动）一次性物化成可编辑的数据行，按当时的 App 内语言解析名称；
// 之后归用户所有（可改名/归档/增删），**永不回灌**。币种表为空时另外种入基准币 CNY（rate 1、isBase）。
// 二级分类**继承父类的颜色**。`isSeed = true` 标记内置来源。
/** 支出分类：10 个一级 / 34 个二级。 */
export const EXPENSE_SEEDS = [
    {
        en: 'Food & Drink', zh: '餐饮', icon: 'fork.knife', color: '#E8863C',
        children: [
            { en: 'Breakfast', zh: '早餐', icon: 'cup.and.saucer.fill' },
            { en: 'Lunch', zh: '午餐', icon: 'takeoutbag.and.cup.and.straw.fill' },
            { en: 'Dinner', zh: '晚餐', icon: 'fork.knife' },
            { en: 'Groceries', zh: '食材采购', icon: 'carrot.fill' },
            { en: 'Snacks', zh: '零食', icon: 'birthday.cake.fill' },
            { en: 'Coffee & Tea', zh: '咖啡饮品', icon: 'cup.and.saucer.fill' },
        ],
    },
    {
        en: 'Transport', zh: '交通', icon: 'car.fill', color: '#3A83D0',
        children: [
            { en: 'Ride-hailing', zh: '打车', icon: 'car.circle.fill' },
            { en: 'Public Transit', zh: '公共交通', icon: 'bus.fill' },
            { en: 'Fuel', zh: '加油', icon: 'fuelpump.fill' },
            { en: 'Parking', zh: '停车', icon: 'parkingsign.circle.fill' },
        ],
    },
    {
        en: 'Shopping', zh: '购物', icon: 'bag.fill', color: '#C15F9C',
        children: [
            { en: 'Clothing', zh: '服饰', icon: 'tshirt.fill' },
            { en: 'Electronics', zh: '数码', icon: 'desktopcomputer' },
            { en: 'Daily Goods', zh: '日用', icon: 'shippingbox.fill' },
            { en: 'Beauty', zh: '美妆', icon: 'sparkles' },
        ],
    },
    {
        en: 'Housing', zh: '居住', icon: 'house.fill', color: '#7C6BD0',
        children: [
            { en: 'Rent', zh: '房租', icon: 'key.fill' },
            { en: 'Utilities', zh: '水电', icon: 'bolt.fill' },
            { en: 'Property Fee', zh: '物业', icon: 'building.2.fill' },
            { en: 'Furniture', zh: '家居', icon: 'chair.lounge.fill' },
        ],
    },
    {
        en: 'Entertainment', zh: '娱乐', icon: 'gamecontroller.fill', color: '#3BAF7E',
        children: [
            { en: 'Movies', zh: '电影', icon: 'film.fill' },
            { en: 'Games', zh: '游戏', icon: 'gamecontroller.fill' },
            { en: 'Travel', zh: '旅行', icon: 'airplane' },
            { en: 'Sports', zh: '运动', icon: 'figure.run' },
        ],
    },
    {
        en: 'Health', zh: '医疗健康', icon: 'cross.case.fill', color: '#D9534F',
        children: [
            { en: 'Medical', zh: '就医', icon: 'stethoscope' },
            { en: 'Fitness', zh: '健身', icon: 'dumbbell.fill' },
            { en: 'Medicine', zh: '药品', icon: 'pills.fill' },
        ],
    },
    {
        en: 'Education', zh: '教育', icon: 'book.fill', color: '#4C8FB0',
        children: [
            { en: 'Courses', zh: '课程', icon: 'graduationcap.fill' },
            { en: 'Books', zh: '书籍', icon: 'books.vertical.fill' },
            { en: 'Training', zh: '培训', icon: 'brain.head.profile' },
        ],
    },
    {
        en: 'Social', zh: '人情', icon: 'gift.fill', color: '#D48F20',
        children: [
            { en: 'Gifts', zh: '礼物', icon: 'gift.fill' },
            { en: 'Treats', zh: '请客', icon: 'wineglass.fill' },
            { en: 'Red Packets', zh: '红包', icon: 'envelope.fill' },
        ],
    },
    {
        en: 'Subscriptions', zh: '订阅', icon: 'repeat', color: '#5E9EA0',
        children: [
            { en: 'Streaming', zh: '影音会员', icon: 'play.tv.fill' },
            { en: 'Cloud & Apps', zh: '云与应用', icon: 'icloud.fill' },
            { en: 'Membership', zh: '会员', icon: 'creditcard.fill' },
        ],
    },
    { en: 'Other Expense', zh: '其他支出', icon: 'ellipsis.circle.fill', color: '#8A887E', children: [] },
];
/** 收入分类：7 个，全部一级、无子类。 */
export const INCOME_SEEDS = [
    { en: 'Salary', zh: '工资', icon: 'banknote.fill', color: '#2A9D63' },
    { en: 'Bonus', zh: '奖金', icon: 'star.fill', color: '#D4A017' },
    { en: 'Investment Income', zh: '投资收益', icon: 'chart.line.uptrend.xyaxis', color: '#3BAF7E' },
    { en: 'Reimbursement', zh: '报销', icon: 'arrow.uturn.left.circle.fill', color: '#4C8FB0' },
    { en: 'Part-time', zh: '兼职', icon: 'briefcase.fill', color: '#7C6BD0' },
    { en: 'Gift Money', zh: '礼金', icon: 'gift.fill', color: '#D48F20' },
    { en: 'Other Income', zh: '其他收入', icon: 'ellipsis.circle.fill', color: '#8A887E' },
];
/** 默认账户（4 个）。 */
export const ACCOUNT_SEEDS = [
    { en: 'Cash', zh: '现金', kind: 'cash', icon: 'banknote.fill', color: '#3BAF7E' },
    { en: 'Bank Card', zh: '银行卡', kind: 'debit', icon: 'creditcard.fill', color: '#3A83D0' },
    { en: 'Alipay', zh: '支付宝', kind: 'ewallet', icon: 'wallet.pass.fill', color: '#1477FF' },
    { en: 'WeChat Pay', zh: '微信支付', kind: 'ewallet', icon: 'message.fill', color: '#2AAE67' },
];
/** 新建账户时按 kind 映射的图标与颜色（§2.3 账户编辑器保存段）。 */
export const ACCOUNT_KIND_ICON = {
    cash: 'banknote.fill',
    debit: 'creditcard.fill',
    credit: 'creditcard.fill',
    ewallet: 'wallet.pass.fill',
    prepaid: 'giftcard.fill',
    investment: 'chart.line.uptrend.xyaxis',
};
export const ACCOUNT_KIND_COLOR = {
    cash: '#3BAF7E',
    debit: '#3A83D0',
    credit: '#D9534F',
    ewallet: '#1477FF',
    prepaid: '#D4A017',
    investment: '#7C6BD0',
};
/** 资产页的账户分组顺序（空组不渲染）。 */
export const ACCOUNT_KIND_ORDER = ['cash', 'debit', 'ewallet', 'prepaid', 'credit', 'investment'];
/** 项目编辑器的图标网格（7 列 × 14 个）。 */
export const PROJECT_ICONS = [
    'airplane', 'figure.hiking', 'party.popper', 'gift', 'fork.knife', 'house.fill',
    'briefcase.fill', 'heart.fill', 'graduationcap.fill', 'cart.fill', 'camera.fill',
    'map.fill', 'star.fill', 'folder.fill',
];
/** 项目配色（10 色）。 */
export const PROJECT_COLORS = [
    '#3A83D0', '#2A9D63', '#E8863C', '#C15F9C', '#7C6BD0',
    '#D4A017', '#5E9EA0', '#D9534F', '#1477FF', '#E0685F',
];
/** 成员调色板（8 色，按加入序号取模）。 */
export const MEMBER_COLORS = [
    '#3A83D0', '#2A9D63', '#E8863C', '#C15F9C', '#7C6BD0', '#D4A017', '#5E9EA0', '#D9534F',
];
/** 图表回退色板（桶没有自带 colorHex 时按序取）。 */
export const CHART_FALLBACK_COLORS = [
    '#E8863C', '#3A83D0', '#3BAF7E', '#C15F9C', '#7C6BD0', '#D4A017', '#5E9EA0', '#D9534F',
];
/** 按 locale 取种子名。 */
export function seedName(entry, locale) {
    return locale === 'zh-Hans' ? entry.zh : entry.en;
}

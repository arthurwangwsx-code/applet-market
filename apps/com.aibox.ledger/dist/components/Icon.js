import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const S = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
};
const F = { fill: 'currentColor', stroke: 'none' };
// [描边路径, 填充路径]；任一为 null 表示不画。
const I = {
    // —— 导航与操作 ——
    'chevron.backward': ['M14.5 5.5L8 12l6.5 6.5'],
    'chevron.left': ['M14.5 5.5L8 12l6.5 6.5'],
    'chevron.right': ['M9.5 5.5L16 12l-6.5 6.5'],
    'chevron.down': ['M5.5 9.5L12 16l6.5-6.5'],
    'chevron.up': ['M5.5 14.5L12 8l6.5 6.5'],
    ellipsis: [
        null,
        'M5 12a1.6 1.6 0 1 1 3.2 0 1.6 1.6 0 0 1-3.2 0m5.4 0a1.6 1.6 0 1 1 3.2 0 1.6 1.6 0 0 1-3.2 0m5.4 0a1.6 1.6 0 1 1 3.2 0 1.6 1.6 0 0 1-3.2 0',
    ],
    plus: ['M12 5.5v13M5.5 12h13'],
    xmark: ['M6.5 6.5l11 11M17.5 6.5l-11 11'],
    'xmark.circle': ['M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M9 9l6 6M15 9l-6 6'],
    'xmark.circle.fill': [
        null,
        'M12 2.8a9.2 9.2 0 1 0 0 18.4 9.2 9.2 0 0 0 0-18.4m3.6 11.4-1.2 1.2L12 13.2l-2.4 2.2-1.2-1.2 2.2-2.2-2.2-2.4 1.2-1.2 2.4 2.2 2.4-2.2 1.2 1.2-2.2 2.4z',
    ],
    'checkmark.circle': ['M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M8 12.3l2.7 2.7L16 9.6'],
    'checkmark.circle.fill': [
        null,
        'M12 2.8a9.2 9.2 0 1 0 0 18.4 9.2 9.2 0 0 0 0-18.4m-1.4 13.4-3.4-3.4 1.3-1.3 2.1 2.1 5-5 1.3 1.3z',
    ],
    'checkmark.seal.fill': [
        null,
        'M12 2.6l2.2 1.7 2.8-.2.9 2.6 2.4 1.5-1 2.6 1 2.6-2.4 1.5-.9 2.6-2.8-.2L12 21l-2.2-1.7-2.8.2-.9-2.6L3.7 15l1-2.6-1-2.6L6.1 8.3l.9-2.6 2.8.2zm-1.3 12.6 5-5-1.3-1.3-3.7 3.7-1.8-1.8-1.3 1.3z',
    ],
    circle: ['M12 3.4a8.6 8.6 0 1 1 0 17.2 8.6 8.6 0 0 1 0-17.2'],
    'circle.slash': ['M12 3.4a8.6 8.6 0 1 1 0 17.2 8.6 8.6 0 0 1 0-17.2M6 6l12 12'],
    'arrow.uturn.backward': ['M9 6.5L5 10.5l4 4M5 10.5h8.5a5 5 0 0 1 0 10H9'],
    'arrow.up.right': ['M8 16l8-8M9.4 8H16v6.6'],
    'arrow.down.left': ['M16 8l-8 8M14.6 16H8V9.4'],
    'arrow.left.arrow.right': ['M7 8.5h11l-2.6-2.6M17 15.5H6l2.6 2.6'],
    'arrow.right': ['M5.5 12h13M13 6.5l6 5.5-6 5.5'],
    'arrow.up.forward.square': [
        'M6 4.6h12a1.4 1.4 0 0 1 1.4 1.4v12a1.4 1.4 0 0 1-1.4 1.4H6A1.4 1.4 0 0 1 4.6 18V6A1.4 1.4 0 0 1 6 4.6M9.5 14.5l5-5M10.5 9.5h4v4',
    ],
    'arrow.right.circle': ['M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M8 12h8M13 9l3 3-3 3'],
    'arrow.clockwise': ['M19 12a7 7 0 1 1-2.1-5M19 4v4.4h-4.4'],
    'clock.arrow.circlepath': ['M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4M12 7.6V12l3 1.8'],
    'equal.circle': ['M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M8.5 10.5h7M8.5 14h7'],
    pencil: ['M4.8 19.2l.9-3.6L15.5 5.8a1.9 1.9 0 0 1 2.7 2.7L8.4 18.3z'],
    trash: ['M5.5 7h13M9.5 7V5.4h5V7M7 7l.9 12.2h8.2L17 7M10.4 10.5v5.4M13.6 10.5v5.4'],
    'trash.slash': ['M5.5 7h13M7 7l.9 12.2h8.2L17 7M4.5 4.5l15 15'],
    archivebox: ['M3.6 5.6h16.8v3.2H3.6zM5.2 8.8v9.6h13.6V8.8M9.6 12.4h4.8'],
    'square.and.arrow.up': [
        'M12 3.6v10M8.6 7l3.4-3.4L15.4 7M5.6 12.6v6.4a1.4 1.4 0 0 0 1.4 1.4h10a1.4 1.4 0 0 0 1.4-1.4v-6.4',
    ],
    'square.and.arrow.down': [
        'M12 14V3.6M8.6 10.6l3.4 3.4 3.4-3.4M5.6 12.6v6.4a1.4 1.4 0 0 0 1.4 1.4h10a1.4 1.4 0 0 0 1.4-1.4v-6.4',
    ],
    'square.and.pencil': [
        'M18.4 12.4V18a1.6 1.6 0 0 1-1.6 1.6H6.2A1.6 1.6 0 0 1 4.6 18V7.4a1.6 1.6 0 0 1 1.6-1.6h5.6M15.4 4.4a1.8 1.8 0 0 1 2.6 2.6l-7 7-3.4.8.8-3.4z',
    ],
    'slider.horizontal.3': [
        'M4 7.5h12M18 7.5h2M4 12h4M10 12h10M4 16.5h9M15 16.5h5',
        'M16.8 7.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0M8.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0M14.5 16.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0',
    ],
    'line.3.horizontal.decrease.circle': [
        'M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M8 9.5h8M9 12h6M10.2 14.5h3.6',
    ],
    'delete.left': [
        'M8.6 5.6h9.8a1.6 1.6 0 0 1 1.6 1.6v9.6a1.6 1.6 0 0 1-1.6 1.6H8.6L3.4 12zM11.6 9.8l4.4 4.4M16 9.8l-4.4 4.4',
    ],
    sparkles: [
        null,
        'M9 3.4l1.3 3.3L13.6 8l-3.3 1.3L9 12.6 7.7 9.3 4.4 8l3.3-1.3zM17 12l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9zM16.4 3.6l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z',
    ],
    'sparkles.rectangle.stack': [
        'M4.6 8.6h14.8v10.8H4.6zM6.6 5.8h10.8M8.6 3.4h6.8',
        'M12 10.6l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
    ],
    'exclamationmark.magnifyingglass': [
        'M11 4.4a6.4 6.4 0 1 1 0 12.8 6.4 6.4 0 0 1 0-12.8M15.8 15.8l4 4M11 7.8v3.6M11 13.6v.2',
    ],
    'exclamationmark.triangle.fill': [null, 'M12 3.4l9 15.6H3zM11.1 9h1.8v5h-1.8zm0 6.4h1.8v1.8h-1.8z'],
    'externaldrive.badge.exclamationmark': ['M4.4 6.4h15.2v6.4H4.4zM7 9.6h.2M17 15v3M17 20v.2', 'M4.4 12.8h9v4.8h-9z'],
    'bolt.fill': [null, 'M13.4 2.6L5.6 13.4h5.2l-1 8 8-11h-5.2z'],
    target: [
        'M12 3.4a8.6 8.6 0 1 1 0 17.2 8.6 8.6 0 0 1 0-17.2M12 7.6a4.4 4.4 0 1 1 0 8.8 4.4 4.4 0 0 1 0-8.8',
        'M13.2 12a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0',
    ],
    'chart.pie': ['M12 3.4v8.6h8.6A8.6 8.6 0 0 0 12 3.4M12 12L6 18.1A8.6 8.6 0 1 1 12 3.4'],
    'list.bullet.rectangle': [
        'M4.4 5.4h15.2v13.2H4.4zM9 9.4h7M9 12.4h7M9 15.4h4',
        'M7.4 9.4a.9.9 0 1 1-1.8 0 .9.9 0 0 1 1.8 0M7.4 12.4a.9.9 0 1 1-1.8 0 .9.9 0 0 1 1.8 0M7.4 15.4a.9.9 0 1 1-1.8 0 .9.9 0 0 1 1.8 0',
    ],
    'chart.line.uptrend.xyaxis': ['M4.4 4.4v15.2h15.2M7.4 15.6l3.4-3.8 2.6 2.2 4.6-5.4M14.6 8.6h3.4V12'],
    'wallet.pass': [
        'M5.6 4.6h12.8a1.4 1.4 0 0 1 1.4 1.4v12a1.4 1.4 0 0 1-1.4 1.4H5.6a1.4 1.4 0 0 1-1.4-1.4V6a1.4 1.4 0 0 1 1.4-1.4M4.2 9.6h15.6M9 12.6h6',
    ],
    'wallet.pass.fill': [
        null,
        'M5.6 4.4h12.8A1.6 1.6 0 0 1 20 6v3.4H4V6a1.6 1.6 0 0 1 1.6-1.6M4 11h16v7a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18zm5 2.4h6v1.6H9z',
    ],
    folder: ['M3.6 6.6h6l1.8 2.2h9v9.6a1.4 1.4 0 0 1-1.4 1.4H5a1.4 1.4 0 0 1-1.4-1.4z'],
    'folder.fill': [null, 'M3.4 6.4h6.2l1.8 2.2h9.2v9.8a1.6 1.6 0 0 1-1.6 1.6H5a1.6 1.6 0 0 1-1.6-1.6z'],
    'folder.badge.plus': [
        'M3.6 6.6h6l1.8 2.2h9v9.6a1.4 1.4 0 0 1-1.4 1.4H5a1.4 1.4 0 0 1-1.4-1.4zM12 12.4v4.4M9.8 14.6h4.4',
    ],
    'book.closed': ['M6.4 3.6h11.2v16.8H6.4zM6.4 17.6h11.2M9.4 3.6v14'],
    tray: [
        'M3.6 13.4h4.6l1.4 2.4h4.8l1.4-2.4h4.6M5.4 4.6h13.2l1.8 8.8v4.6a1.4 1.4 0 0 1-1.4 1.4H5a1.4 1.4 0 0 1-1.4-1.4v-4.6z',
    ],
    calendar: ['M4.6 6.4h14.8v13H4.6zM4.6 10.4h14.8M8.4 4v3.4M15.6 4v3.4'],
    'text.alignleft': ['M4.6 6.6h14.8M4.6 10.6h10M4.6 14.6h14.8M4.6 18.6h8'],
    storefront: [
        'M4 9.4h16v9.8a1.2 1.2 0 0 1-1.2 1.2H5.2A1.2 1.2 0 0 1 4 19.2zM4 9.4L5.6 4.4h12.8L20 9.4M9 20.4v-5.6h6v5.6',
    ],
    tag: ['M4.6 4.6h7l8.2 8.2-7 7-8.2-8.2z', 'M9 8.4a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 0 1 2.8 0'],
    'person.badge.plus': [
        'M10 4.6a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2M3.6 20a6.4 6.4 0 0 1 11.4-4M18 14v5.4M15.3 16.7h5.4',
    ],
    'person.2.badge.plus': [
        'M8.6 5a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8M2.8 19.6a5.8 5.8 0 0 1 10.4-3.5M15.2 6.4a3 3 0 1 1 0 6M18 15.6v4.4M15.8 17.8h4.4',
    ],
    'person.badge.minus': ['M10 4.6a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2M3.6 20a6.4 6.4 0 0 1 11.4-4M15.3 16.7h5.4'],
    'coloncurrencysign.arrow.circlepath': [
        'M12 3.4a8.6 8.6 0 1 1-8.2 11M3.4 12.4V16h3.6M12 7.4v9.2M9.4 10.2h5.2M9.4 13.6h5.2',
    ],
    camera: ['M4.4 8h3.4l1.4-2.2h5.6L16.2 8h3.4v10.6H4.4zM12 10.2a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4'],
    'camera.fill': [
        null,
        'M7.6 5.6h8.8l1.4 2.2h2.6a1.6 1.6 0 0 1 1.6 1.6v8.4a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 17.8V9.4a1.6 1.6 0 0 1 1.6-1.6h2.6zM12 10.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8',
    ],
    'photo.on.rectangle': [
        'M7.4 4.6h12v10.8h-12zM4.6 8v11.4H17',
        'M10.4 8.4a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0M8 15.4l3.6-4 2.2 2.6 1.8-1.8 3 3.2z',
    ],
    gift: [
        'M4.4 9.6h15.2v3.2H4.4zM5.8 12.8h12.4v6.8H5.8zM12 9.6v10M12 9.6C10 9.6 7.6 9 7.6 6.9a1.9 1.9 0 0 1 3.5-1c.6 1 .9 2.5.9 3.7M12 9.6c2 0 4.4-.6 4.4-2.7a1.9 1.9 0 0 0-3.5-1c-.6 1-.9 2.5-.9 3.7',
    ],
    airplane: [
        null,
        'M20.6 12.4l-6.4-1.2 1.6 8-1.9.4-3.5-7.2-4 1 .3 2.4-1.5.5-1.6-3.4L2 12.6l.5-1.5 2.5.3.9-1.5-3.4-1.6.5-1.5 2.4.3 1-4 1.9.3 1 8.1z',
    ],
    'figure.hiking': [
        null,
        'M13.4 3.4a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4M11 8h2.6l2.4 3.4 2.4 1v1.8l-3.4-1.2-1.4-1.8-.4 3 2.4 3v4h-2v-3.2l-3-3-1.6 6.2H6.8l2.4-9.4-2 1.4v2.8h-2V11z',
    ],
    'party.popper': ['M4 20l4.4-11 6.6 6.6zM14 4.6v2M18.8 5.4l-1.4 1.4M19.6 10.6h-2M15.6 9.4a2 2 0 0 1 2.8-2.8'],
    'fork.knife': ['M7 3.6v7.4a2 2 0 0 0 4 0V3.6M9 11v9.4M16.4 3.6c1.6 1 2.2 3 2.2 5.4 0 1.6-.7 2.6-1.8 3v8.4'],
    'cup.and.saucer.fill': [
        null,
        'M4.6 6.4h11v6a4 4 0 0 1-8 0zm11 .8h1.6a2.4 2.4 0 0 1 0 4.8h-1.6zM3.4 18.4h13.6v1.8H3.4z',
    ],
    'takeoutbag.and.cup.and.straw.fill': [
        null,
        'M5.4 8.4h8.2l1 11.2H4.4zm1.4-3.8h5.4l1 2.4H5.8zM16 9h4.6l-.7 10.6H16zm2.4-4.6l.6 3.4h-1.6z',
    ],
    'carrot.fill': [
        null,
        'M5 19.4c-.8-.8 1.4-7.6 5.4-11.6 2.2-2.2 5-2.2 6.4-.8 1.4 1.4 1.4 4.2-.8 6.4-4 4-10.2 6.8-11 6M15.6 4.6c1.4-1.4 3.4-1.6 3.4-1.6s-.2 2-1.6 3.4M17.6 8.4c1.8-.4 3.4.6 3.4.6s-1.2 1.6-3 1.6',
    ],
    'birthday.cake.fill': [
        null,
        'M4 12.6c1.4 0 1.4 1.2 2.8 1.2s1.4-1.2 2.8-1.2 1.4 1.2 2.8 1.2 1.4-1.2 2.8-1.2 1.4 1.2 2.8 1.2V19H4zM5.6 8.6h12.8v3.4c-1.2.4-1.4-.8-2.8-.8s-1.4 1.2-2.8 1.2-1.4-1.2-2.8-1.2-1.4 1.2-2.8.8zM8 4v3M12 3.4V7M16 4v3',
    ],
    'car.fill': [
        null,
        'M5.4 10.4l1.6-4.2h10l1.6 4.2h1.4v6.2h-2.4v1.8h-2.4v-1.8H8.8v1.8H6.4v-1.8H4V10.4zM7.4 13.8a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6m9.2 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6',
    ],
    'car.circle.fill': [
        null,
        'M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8m-5 9.2l1.2-3h7.6l1.2 3v4.2h-1.8v1.2h-1.8v-1.2H9.6v1.2H7.8v-1.2H7zm2 1.4a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8m6 0a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8',
    ],
    'bus.fill': [
        null,
        'M5.4 4.4h13.2v12.4H5.4zM5 18h3v1.8H5zm11 0h3v1.8h-3zM7 6.4h10v4.6H7zm.6 7.4a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2m8.8 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2',
    ],
    'fuelpump.fill': [null, 'M5 3.6h8.4v16.8H5zm2 2.4v3.6h4.4V6zm8.4 1.6l2.6 2.6v6.6a1.6 1.6 0 0 1-3.2 0v-3.6h-1.4V7.6z'],
    'parkingsign.circle.fill': [
        null,
        'M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8M9.6 6.8h3.6a3.4 3.4 0 0 1 0 6.8h-1.6v3.6H9.6zm2 2v2.8h1.4a1.4 1.4 0 0 0 0-2.8z',
    ],
    'bag.fill': [null, 'M8.4 7.4V6.6a3.6 3.6 0 0 1 7.2 0v.8h3.4l1 12.6H4L5 7.4zm1.8 0h3.6v-.8a1.8 1.8 0 0 0-3.6 0z'],
    'tshirt.fill': [
        null,
        'M9 3.6h6c0 1.4-1.4 2.4-3 2.4s-3-1-3-2.4M8.4 3.8L3 7l2 4 2-1v10.2h10V10l2 1 2-4-5.4-3.2c-.6 2-2.2 3.4-3.6 3.4s-3-1.4-3.6-3.4',
    ],
    desktopcomputer: ['M3.6 4.6h16.8v10.8H3.6zM9 18.4h6M12 15.4v3'],
    'shippingbox.fill': [null, 'M12 2.8l8.4 3.6-8.4 3.6-8.4-3.6zM3 8.2l8.2 3.5v8.6L3 16.8zm18 0v8.6l-8.2 3.5v-8.6z'],
    'house.fill': [null, 'M12 3l9 7.4h-2.4v9.6h-4.4v-5.4h-4.4v5.4H5.4v-9.6H3z'],
    'key.fill': [
        null,
        'M15.4 3.6a5 5 0 1 1-4.6 6.9L4 17.4v3h3.4v-2.2h2.2v-2.2h2.2l1.2-1.2a5 5 0 0 1 2.4-11.2m1.2 3a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8',
    ],
    'building.2.fill': [
        null,
        'M3.4 8.4h7v11.2h-7zm8.6-4h8.6v15.2H12zm-6.6 6h2.4v2.2H5.4zm0 4h2.4v2.2H5.4zm8.4-6.4h2.4v2.2h-2.4zm4 0h2.4v2.2h-2.4zm-4 4h2.4v2.2h-2.4zm4 0h2.4v2.2h-2.4zm-4 4h2.4v2.2h-2.4zm4 0h2.4v2.2h-2.4z',
    ],
    'chair.lounge.fill': [null, 'M5.6 3.6h12.8l-1 7.4H6.6zM4 11.4h16v4.2H4zm1 4.8h2v4h-2zm12 0h2v4h-2z'],
    'gamecontroller.fill': [
        null,
        'M7 6.6h10a5 5 0 0 1 5 5v1a3.4 3.4 0 0 1-6.2 1.9l-.6-.9H8.8l-.6.9A3.4 3.4 0 0 1 2 12.6v-1a5 5 0 0 1 5-5m-1 3v1.6H4.4v1.6H6v1.6h1.6V13h1.6v-1.6H7.6V9.8zm10.4.6a1 1 0 1 0 0 2 1 1 0 0 0 0-2m-2 2.4a1 1 0 1 0 0 2 1 1 0 0 0 0-2',
    ],
    'film.fill': [
        null,
        'M3.6 4.4h16.8v15.2H3.6zm2 2v2h2.4v-2zm0 4v2h2.4v-2zm0 4v2h2.4v-2zm10.4-8v2h2.4v-2zm0 4v2h2.4v-2zm0 4v2h2.4v-2zM9.4 6.4h5.2v11.2H9.4z',
    ],
    'figure.run': [
        null,
        'M15.4 3a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8M9.6 8.2l4.6-1.4 3 2.6 3 .8-.4 1.9-3.8-1-1.4-1.2-1 3.4 3 2.8 1 5.6-2 .4-.9-4.6-3.8-3-1.4 4.4-4.4 2.8-1-1.7 3.4-2.4z',
    ],
    'cross.case.fill': [
        null,
        'M9 3.6h6v2.8h4.4v14H4.6v-14H9zm1.8 1.6v1.2h2.4V5.2zM11 9.6v2.2H8.8v2.4H11v2.2h2v-2.2h2.2v-2.4H13V9.6z',
    ],
    stethoscope: [
        'M6 4.4v4.4a3.6 3.6 0 0 0 7.2 0V4.4M6 4.4H4.4M13.2 4.4h1.6M9.6 12.4v3a4 4 0 0 0 8 0v-1.6',
        'M19 11.4a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0',
    ],
    'dumbbell.fill': [
        null,
        'M3 9.6h2.4v4.8H3zm3.4-1.4h2.4v7.6H6.4zm3.4 2.6h4.4v2.4H9.8zm5.4-2.6h2.4v7.6h-2.4zm3.4 1.4H21v4.8h-2.4z',
    ],
    'pills.fill': [
        null,
        'M6.4 3.6a3.8 3.8 0 0 1 3.8 3.8v9a3.8 3.8 0 0 1-7.6 0v-9a3.8 3.8 0 0 1 3.8-3.8m-3.8 6.8h7.6M16.6 11.4a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6m-3 6.4h6',
    ],
    'book.fill': [
        null,
        'M4 4.4h6.4c1 0 1.6.6 1.6 1.6v13.6c0-1-.6-1.6-1.6-1.6H4zm16 0h-6.4c-1 0-1.6.6-1.6 1.6v13.6c0-1 .6-1.6 1.6-1.6H20z',
    ],
    'graduationcap.fill': [
        null,
        'M12 3.4L22 8l-10 4.6L2 8zm-6 6.8l6 2.8 6-2.8v4.4c0 1.8-2.7 3.2-6 3.2s-6-1.4-6-3.2zM20 9.4v5h1.4v-5z',
    ],
    'books.vertical.fill': [null, 'M3.6 4.4h3v15.2h-3zm4 0h3v15.2h-3zm4.6.6l2.9-.8 4 14.6-2.9.8z'],
    'brain.head.profile': [
        'M8.4 20v-3.4l-2.6-1.4a5.6 5.6 0 0 1-2-4.2c0-3.8 3.2-7 7.2-7 3.4 0 6 2 6.8 4.8l1.8 3.2-1.8.8v2.6a2 2 0 0 1-2 2h-1.4V20',
        'M10 10a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0',
    ],
    'gift.fill': [
        null,
        'M4 9.4h16v3.4H4zM5.4 13.4h13.2v6.4H5.4zM11 9.4V4.6c-1-.8-2.4-1.4-3.4-.6-1 .8-.6 2.6 1 3.4.8.4 1.6 1.4 2.4 2M13 9.4V4.6c1-.8 2.4-1.4 3.4-.6 1 .8.6 2.6-1 3.4-.8.4-1.6 1.4-2.4 2',
    ],
    'wineglass.fill': [null, 'M7 3.6h10l-.6 6a4.4 4.4 0 0 1-3.4 4.2v4.8h3v1.8H8v-1.8h3v-4.8a4.4 4.4 0 0 1-3.4-4.2z'],
    'envelope.fill': [null, 'M3.4 6h17.2v12H3.4zm1.4 1.6L12 12.4l7.2-4.8z'],
    repeat: ['M5 8.6h11.4L14 6.2M19 15.4H7.6L10 17.8', 'M16.4 5.4l3.2 3.2-3.2 3.2zM7.6 12.2l-3.2 3.2 3.2 3.2z'],
    'repeat.circle': ['M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M8 10.4h8l-2-2M16 13.6H8l2 2'],
    'play.tv.fill': [null, 'M3.4 4.4h17.2v12.2H3.4zm6.8 2.6v7l6-3.5zM7 18.4h10v1.6H7z'],
    'icloud.fill': [null, 'M7.4 18.4a4.4 4.4 0 0 1-.5-8.8 5.4 5.4 0 0 1 10.3 1.2 3.8 3.8 0 0 1-.8 7.6z'],
    'creditcard.fill': [null, 'M3.4 5.4h17.2v13.2H3.4zm0 3.2h17.2v2.4H3.4zm2.4 5.4h5v1.8h-5z'],
    'ellipsis.circle.fill': [
        null,
        'M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8M8 13.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4m4 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4m4 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4',
    ],
    'banknote.fill': [null, 'M2.6 6.4h18.8v11.2H2.6zm2 2v6.8h14.8V8.4zM12 9.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2'],
    'star.fill': [null, 'M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z'],
    star: ['M12 3.6l2.6 5.5 6 .7-4.5 4.1 1.3 5.9L12 16.9l-5.4 2.9 1.3-5.9-4.5-4.1 6-.7z'],
    'arrow.uturn.left.circle.fill': [
        null,
        'M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8m-1.4 5.2v2h2.6a3.6 3.6 0 0 1 0 7.2h-2.6v-2h2.6a1.6 1.6 0 0 0 0-3.2h-2.6v2L7 10.8z',
    ],
    'briefcase.fill': [null, 'M9 3.6h6a1.6 1.6 0 0 1 1.6 1.6v1.4h4v12.8H3.4V6.6h4V5.2A1.6 1.6 0 0 1 9 3.6m0 3h6V5.4H9z'],
    briefcase: ['M3.6 7h16.8v12H3.6zM8.4 7V5.4a1.4 1.4 0 0 1 1.4-1.4h4.4a1.4 1.4 0 0 1 1.4 1.4V7'],
    'cart.fill': [
        null,
        'M2.6 4.4h3l.6 2.6h14.6l-2 8H8.2l.3 1.6h10v1.8H7L4.2 6.2H2.6zM8.6 18a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m8.4 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3',
    ],
    'map.fill': [null, 'M8.6 3.6l6.8 2.4 5-2v14.4l-5 2-6.8-2.4-5 2V5.6z'],
    'heart.fill': [
        null,
        'M12 20.4l-1.4-1.3C5.4 14.4 2 11.3 2 7.6 2 4.9 4.1 2.8 6.8 2.8c1.5 0 3 .7 3.9 1.8h2.6c.9-1.1 2.4-1.8 3.9-1.8C19.9 2.8 22 4.9 22 7.6c0 3.7-3.4 6.8-8.6 11.5z',
    ],
    'giftcard.fill': [null, 'M3.4 5.4h17.2v13.2H3.4zm0 3.2h17.2v1.8H3.4zm2.6 4h5.4v1.6H6z'],
    'message.fill': [
        null,
        'M12 3.4c5 0 9 3.3 9 7.4s-4 7.4-9 7.4c-1 0-2-.1-2.9-.4L4 20.4l1.3-3.6C3.9 15.4 3 13.3 3 10.8c0-4.1 4-7.4 9-7.4',
    ],
    banknote: ['M2.6 6.4h18.8v11.2H2.6zM12 9.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2'],
};
const ALIAS = {
    'arrow.up.right.circle': 'arrow.right.circle',
    'arrow.down.right': 'arrow.down.left',
    'person.crop.circle': 'circle',
    'square.and.arrow.up.fill': 'square.and.arrow.up',
};
const ICONS = I;
const ALIASES = ALIAS;
export default function Icon({ name, size = 17, color = 'currentColor', style }) {
    const key = ALIASES[name] ?? name;
    const shape = ICONS[key];
    const box = { display: 'block', flex: '0 0 auto', color, ...style };
    if (!shape) {
        return (_jsx("svg", { viewBox: "0 0 24 24", width: size, height: size, style: box, "aria-hidden": "true", children: _jsx("circle", { cx: "12", cy: "12", r: "4.6", fill: "currentColor", opacity: "0.55" }) }));
    }
    const [stroke, fill] = shape;
    return (_jsxs("svg", { viewBox: "0 0 24 24", width: size, height: size, style: box, "aria-hidden": "true", children: [stroke ? _jsx("path", { d: stroke, ...S }) : null, fill ? _jsx("path", { d: fill, ...F }) : null] }));
}
/** 圆形图标章：底色 = 前景色 16%，图标 size × 0.42。 */
export function IconBadge({ name, size = 36, color, background, style }) {
    return (_jsx("div", { style: {
            width: size,
            height: size,
            borderRadius: size / 2,
            background: background ?? 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
            ...style,
        }, children: _jsx(Icon, { name: name, size: Math.round(size * 0.42), color: color }) }));
}
export function Spinner({ size = 16, color = 'currentColor' }) {
    return (_jsxs("svg", { className: "lg-spin", viewBox: "0 0 24 24", width: size, height: size, style: { display: 'block', color }, children: [_jsx("circle", { cx: "12", cy: "12", r: "9", fill: "none", stroke: "currentColor", strokeWidth: "2.4", strokeOpacity: "0.22" }), _jsx("path", { d: "M21 12a9 9 0 0 0-9-9", fill: "none", stroke: "currentColor", strokeWidth: "2.4", strokeLinecap: "round" })] }));
}

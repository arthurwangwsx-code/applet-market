import { defineAppletConfig } from '@aibox/applet-vite';

// 全部约束（external / iOS 17 target / 相对基址 / 产物自检 / action 类型生成）都在预设里。
// 应用侧通常一行就够；要覆写就传参数，别绕过预设直接写裸 Vite 配置。
export default defineAppletConfig();

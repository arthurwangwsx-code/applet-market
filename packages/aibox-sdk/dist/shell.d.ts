/**
 * 应用级外壳（tabs / toolbar / navigation / scene）。
 *
 * 这几条能力有一个**共同陷阱**：命名空间恒在（容器内建），但当前呈现面可能根本画不出来——
 * card / sheet / drawer 上没有原生 TabBar，fullscreen 上没有导航栏搜索框。宿主用
 * `state.rendered` 如实上报，但裸 API 不会拦着你「以为它画出来了」，于是应用就少了一整块入口。
 *
 * SDK 把它收成 `isRendered()`：**false 就自己画一个页内 segmented / 搜索框**。
 */
export type TabsState = Awaited<ReturnType<typeof aibox.tabs.getState>>;
export type ToolbarState = Awaited<ReturnType<typeof aibox.toolbar.getState>>;
export type ToolbarSearchState = ToolbarState['search'];
export type SceneState = Awaited<ReturnType<typeof aibox.scene.getState>>;
export type NavigationState = Awaited<ReturnType<typeof aibox.navigation.getState>>;
/** 原生 TabBar 当前是否真的画出来了。false = 自己画页内切换器。 */
export declare function tabsAreRendered(): Promise<boolean>;
/** 导航栏搜索框当前是否真的画出来了。false = 自己画输入框。 */
export declare function searchIsRendered(): Promise<boolean>;
/** 读 tabs 状态（不可用返回 null）。 */
export declare function tabsState(): Promise<TabsState | null>;
/** 选中一个 tab（等价用户点击，会触发 changed 事件）。 */
export declare function selectTab(id: string): Promise<TabsState | null>;
/** 给某个 tab 打角标。`null` 清掉。 */
export declare function setTabBadge(id: string, badge: string | null): Promise<void>;
/** 读 scene 状态（呈现面、安全区、外观）。 */
export declare function sceneState(): Promise<SceneState | null>;
/** 设置导航栏标题。 */
export declare function setTitle(title: string): Promise<void>;
/**
 * 关闭确认。有未保存改动时开、保存后关——**别永久开着**，那会让用户每次退出都被拦一下。
 */
export declare function setCloseConfirmation(enabled: boolean, options?: {
    title?: string;
    message?: string;
}): Promise<void>;
/** 触觉反馈。宿主没有 haptics 时静默忽略（这是纯增强，绝不该因为它抛）。 */
export declare function haptic(kind?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'): Promise<void>;
//# sourceMappingURL=shell.d.ts.map
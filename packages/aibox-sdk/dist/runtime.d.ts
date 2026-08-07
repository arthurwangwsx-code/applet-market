/** 随宿主发布的 SDK 运行时版本。只做 additive 演进；破坏性变更必须升 major。 */
export declare const SDK_VERSION: "1.1.0";
/** 当前兼容合同的结构版本。结构只增字段，不复用旧字段表达新语义。 */
export declare const SDK_COMPATIBILITY_SCHEMA: 1;
/** 宿主在 documentStart 注入的只读运行时元数据。老宿主没有这份对象。 */
export interface ContainerRuntimeMetadata {
    schemaVersion: number;
    containerVersion: string | null;
    containerBuild: string | null;
    bridgeProtocol: {
        current: string;
        supported: string[];
    };
    runtimeModules: string[];
}
declare global {
    interface Window {
        /** 宿主运行时元数据。不存在表示老宿主或普通 Web 预览，不要把两者误判成当前宿主。 */
        readonly __aiboxContainerRuntime?: Readonly<ContainerRuntimeMetadata>;
    }
}
export type SDKDelivery = 'host-shared' | 'legacy-bundled' | 'web-preview';
/** 应用可同步读取的容器/SDK事实。读取不走桥 IPC，也不会触发授权。 */
export interface ContainerInfo {
    containerVersion: string | null;
    containerBuild: string | null;
    sdkVersion: typeof SDK_VERSION;
    sdkCompatibilitySchema: typeof SDK_COMPATIBILITY_SCHEMA;
    delivery: SDKDelivery;
    bridgeProtocol: {
        current: string | null;
        supported: string[];
    };
    runtimeModules: string[];
}
/**
 * 同步取得当前容器与 SDK 的真实版本。
 *
 * - `host-shared`：当前实现来自宿主的 `aibox-sdk.mjs`，全机只有一份。
 * - `legacy-bundled`：桥存在但宿主没有运行时元数据；通常是旧宿主里的应用内 SDK。
 * - `web-preview`：不在小应用容器里。
 *
 * 桥协议优先读 `aibox.protocol()`；元数据只是补充容器版本与运行时模块，避免把静态声明当运行时事实。
 */
export declare function containerInfo(): ContainerInfo;
/**
 * 统一的 feature 判定。
 *
 * - `supports('sdk', '1.1.0')`
 * - `supports('container', '1.2.0')`
 * - `supports('bridge', '2.0')`
 * - `supports('runtime:aibox/ui')`
 * - `supports('capability:video.resolve')`（也可简写成 `supports('video.resolve')`）
 *
 * capability 优先读宿主 `aibox.capabilities()` 的运行时目录，再以同步方法探测兜底；不依据 SDK 类型猜。
 */
export declare function supports(feature: string, minimumVersion?: string): boolean;
export interface CapabilityRequirement {
    namespace: string;
    method?: string;
    /** 可选能力缺失只进入 warnings，应用仍可启动并自行降级。 */
    optional?: boolean;
}
export interface CompatibilityRequirement {
    minContainerVersion?: string;
    minSDKVersion?: string;
    bridgeProtocol?: string;
    runtimeModules?: string[];
    capabilities?: Array<string | CapabilityRequirement>;
}
export type CompatibilityIssueKind = 'container-version' | 'sdk-version' | 'bridge-protocol' | 'runtime-module' | 'capability';
export interface CompatibilityIssue {
    kind: CompatibilityIssueKind;
    target: string;
    required?: string;
    actual?: string | null;
}
export interface CompatibilityReport {
    compatible: boolean;
    degraded: boolean;
    info: ContainerInfo;
    errors: CompatibilityIssue[];
    warnings: CompatibilityIssue[];
}
/**
 * 一次评估启动硬需求与可选增强。应用可据 `compatible` 决定是否进入主流程，
 * 据 `warnings` 关闭次要入口。这个函数纯同步、零授权、零桥 IPC。
 */
export declare function checkCompatibility(requirement?: CompatibilityRequirement): CompatibilityReport;
//# sourceMappingURL=runtime.d.ts.map
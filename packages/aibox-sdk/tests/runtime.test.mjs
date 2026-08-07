import assert from 'node:assert/strict'
import { build } from 'esbuild'

// SDK 的浏览器 ESM 故意保留扩展名省略写法；Node 不按浏览器/bundler 规则解析它。
// 测试先用与宿主资产相同的 esbuild 语义收成内存模块，测到的是实际交付形态。
const built = await build({
  entryPoints: [new URL('../dist/index.js', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'safari17',
  write: false,
})
const sdk = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`)
const { SDK_VERSION, checkCompatibility, containerInfo, supports } = sdk

function withWindow(value, run) {
  const previous = globalThis.window
  globalThis.window = value
  try {
    run()
  } finally {
    if (previous === undefined) delete globalThis.window
    else globalThis.window = previous
  }
}

assert.equal(SDK_VERSION, '1.1.0')

withWindow(undefined, () => {
  assert.equal(containerInfo().delivery, 'web-preview')
  assert.equal(supports('container', '1.0.0'), false)
  assert.equal(supports('sdk', '1.1.0'), true)
})

withWindow(
  {
    aibox: {
      protocol: () => ({ current: '2.0', supported: ['1.0', '2.0'], transport: 'test' }),
      capabilities: () => ({ video: ['resolve', 'play'], haptics: ['impact'] }),
      video: { resolve() {} },
    },
  },
  () => {
    const info = containerInfo()
    assert.equal(info.delivery, 'legacy-bundled', '老宿主有桥但无共享运行时元数据，必须显式识别')
    assert.equal(info.containerVersion, null)
    assert.equal(supports('bridge', '1.0'), true)
    assert.equal(supports('video.resolve'), true)
    assert.equal(supports('video.download'), false, '能力判定必须服从桥的真实 capabilities 目录')
    assert.equal(supports('runtime:aibox/sdk'), false, '没有宿主元数据时不能假装共享资产存在')
    const report = checkCompatibility({ runtimeModules: ['aibox/sdk'] })
    assert.equal(report.compatible, false)
    assert.equal(report.errors[0]?.kind, 'runtime-module')
  },
)

withWindow(
  {
    __aiboxContainerRuntime: {
      schemaVersion: 1,
      containerVersion: '2.4',
      containerBuild: '310',
      bridgeProtocol: { current: '1.0', supported: ['1.0'] },
      runtimeModules: ['aibox/ui', 'aibox/sdk', 'aibox/sdk/react'],
    },
    aibox: {
      // 桥自述优先于元数据里的静态协议值。
      protocol: () => ({ current: '2.0', supported: ['1.0', '2.0'], transport: 'test' }),
      capabilities: () => ({ video: ['resolve'], haptics: ['impact'] }),
      video: { resolve() {} },
      haptics: { impact() {} },
    },
  },
  () => {
    const info = containerInfo()
    assert.equal(info.delivery, 'host-shared')
    assert.equal(info.containerVersion, '2.4')
    assert.equal(info.bridgeProtocol.current, '2.0')
    assert.equal(supports('container', '2.3.9'), true)
    assert.equal(supports('container', '2.4.1'), false)
    assert.equal(supports('runtime:aibox/sdk', '1.1.0'), true)
    assert.equal(supports('video.resolve', '1'), false, '能力档位未进入桥协议前不得伪造版本支持')

    const report = checkCompatibility({
      minContainerVersion: '2.0.0',
      minSDKVersion: '1.1.0',
      bridgeProtocol: '2.0',
      runtimeModules: ['aibox/sdk'],
      capabilities: [
        { namespace: 'video', method: 'resolve' },
        { namespace: 'speech', method: 'recognize', optional: true },
      ],
    })
    assert.equal(report.compatible, true)
    assert.equal(report.degraded, true)
    assert.equal(report.warnings[0]?.target, 'speech.recognize')
  },
)

console.log('✓ SDK runtime/container compatibility contract')

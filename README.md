# WebAssembly JSON 树型数据高性能处理方案

这是一个完整的性能基准测试框架，用于对比 JavaScript 和 WebAssembly 在处理大型 JSON 树型数据时的性能差异。

## 🎯 项目目标

在 Web 环境中处理大型树形 JSON 数据时，传统的 JavaScript 递归算法存在性能瓶颈。本项目展示了如何使用 Rust + WebAssembly 显著提升处理效率，同时对比了不同的数据传输方案的性能差异。

## 🚀 技术方案对比

### 1. JavaScript 递归 (Baseline)
- 纯 JavaScript 实现的递归算法
- 作为性能对比的基准线
- 运行在 Web Worker 中避免阻塞 UI

### 2. Wasm 对象传输 (推荐)
- 使用 `serde-wasm-bindgen` 直接在 JS 对象和 Rust 结构体之间转换
- 避免了 JSON 字符串序列化/反序列化的开销
- 适用于大多数应用场景

### 3. Wasm 二进制传输 (极致性能)
- 将 JSON 转为二进制流（Uint8Array）
- 使用 Transferable 对象传输，实现零拷贝
- 适合超大规模数据处理

## 📁 项目结构

```
wasm-test/
├── wasm/                           # Rust Wasm 项目
│   ├── src/
│   │   └── lib.rs                  # 核心算法实现
│   └── Cargo.toml                  # Rust 依赖配置
├── frontend/                       # Vue 3 前端项目
│   ├── pkg/                        # 编译生成的 Wasm 包
│   │   ├── wasm_benchmark.wasm     # 编译后的 Wasm 文件
│   │   └── wasm_benchmark.js       # JS 绑定文件
│   ├── src/
│   │   ├── workers/                # Web Worker 测试模块
│   │   │   ├── test.worker.ts      # 主 Worker 入口
│   │   │   └── modules/
│   │   │       ├── js-recursive.ts     # JS 递归实现
│   │   │       ├── wasm-js-object.ts    # Wasm 对象传输
│   │   │       └── wasm-binary.ts       # Wasm 二进制传输
│   │   ├── utils/
│   │   │   └── tree-generator.ts    # 测试数据生成器
│   │   ├── components/
│   │   │   ├── ConfigPanel.vue     # 配置面板
│   │   │   └── ResultChart.vue    # 结果可视化
│   │   ├── types/
│   │   │   └── index.ts            # TypeScript 类型定义
│   │   ├── App.vue                 # 主应用组件
│   │   └── main.ts                 # 应用入口
│   ├── vite.config.ts              # Vite 配置
│   └── package.json
└── docs/                           # 项目文档
```

## 🛠️ 快速开始

### 前置要求

- Node.js 18+
- Rust 1.70+
- wasm-pack

### 1. 编译 Wasm 模块

```bash
cd wasm
wasm-pack build --target web --out-dir ../frontend/pkg
```

### 2. 安装前端依赖

```bash
cd frontend
npm install
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173/ 即可看到应用界面。

## 📊 使用指南

### 生成测试数据

1. 在配置面板中选择预设的节点数量（1,000、10,000、100,000）
2. 或自定义树深度和分支数
3. 点击"生成测试数据"按钮

### 运行性能测试

1. 数据生成完成后，点击"🔥 开始性能测试"
2. 系统将依次运行三种测试方案
3. 实时显示测试进度
4. 完成后展示详细的结果对比图表

### 查看结果

- **柱状图**: 直观对比三种方案的总耗时
- **详细表格**: 查看各项性能指标
  - 计算时间: 实际算法执行时间
  - 序列化时间: 数据转换耗时
  - 传输时间: Worker 间通信耗时
  - 内存占用: 估计的内存使用量
  - 吞吐量: 每秒处理的节点数

## 🎨 核心特性

### 1. 避免 Deep Clone 性能陷阱

使用 `structuredClone()` 替代 `JSON.parse(JSON.stringify())`，提升 5-10 倍性能。

### 2. Web Worker 隔离

所有计算都在 Worker 中执行，确保 UI 线程不卡顿。

### 3. Transferable 对象优化

二进制传输方案使用 `postMessage` 的 transfer 列表，实现内存零拷贝。

### 4. Rust 性能优化

- 使用 `-O4` 优化级别
- 启用 SIMD 指令
- LTO (Link Time Optimization) 链接时优化

## 📈 性能预期

### 小规模数据 (< 1,000 节点)
- JavaScript 可能更快（Wasm 启动开销）
- 推荐使用纯 JS 方案

### 中等规模 (1,000 - 50,000 节点)
- Wasm 对象传输方案开始显现优势
- 加速比: 2-5 倍

### 大规模数据 (> 50,000 节点)
- Wasm 优势明显
- Wasm 对象传输: 3-8 倍加速
- Wasm 二进制传输: 5-15 倍加速（取决于计算复杂度）

## 🔧 技术细节

### Rust Wasm 依赖

```toml
[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1.0", features = ["derive"] }
serde-wasm-bindgen = "0.6"  # 高效 JS 对象转换
serde_json = "1.0"          # 二进制流处理
js-sys = "0.3"
web-sys = { version = "0.3", features = ["Performance", "Window"] }
```

### Vite 配置

```typescript
export default defineConfig({
  plugins: [vue()],
  worker: {
    format: 'es'
  }
})
```

## 📝 最佳实践建议

### 1. 数据传输选择

- **小数据**: 直接使用 JS 对象传递
- **中等数据**: 使用 `structuredClone` + Wasm 对象传输
- **大数据**: 使用二进制流 + Transferable 对象

### 2. Wasm 模块初始化

Wasm 模块较大（数百 KB），建议：
- 首次使用时异步初始化
- 缓存初始化状态避免重复加载

### 3. 内存管理

- 及时终止不用的 Worker
- 大数据分批处理，避免内存溢出

## 🐛 常见问题

### Q: 遇到 DataCloneError 错误？

**A**: 确保传递给 Worker 的数据是可克隆的。使用 `structuredClone()` 进行预处理。

### Q: Wasm 模块加载失败？

**A**: 检查 Vite 配置是否正确设置了 worker 插件，确保 `.wasm` 文件路径正确。

### Q: 性能提升不明显？

**A**: 
- 确保数据规模足够大（> 10,000 节点）
- 检查计算逻辑是否足够复杂（简单计算 JS 可能更快）
- 查看浏览器控制台确认 Wasm 正常加载

## 📚 进一步阅读

- [WebAssembly 官方文档](https://webassembly.org/)
- [wasm-bindgen 使用指南](https://rustwasm.github.io/wasm-bindgen/)
- [serde-wasm-bindgen 性能对比](https://github.com/RReverser/serde-wasm-bindgen)
- [Web Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)

## 📄 许可证

MIT License

## 🙏 致谢

本方案基于社区最佳实践设计，感谢以下开源项目：
- wasm-pack
- serde
- Vue 3
- Vite

---

**提示**: 测试结果会因设备性能、浏览器版本、数据特征等因素有所差异。建议多次运行取平均值以获得更准确的结果。
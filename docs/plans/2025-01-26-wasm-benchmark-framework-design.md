# WebAssembly JSON 树型数据性能基准测试框架设计文档

**日期**: 2025-01-26  
**版本**: v1.0  
**作者**: Cline

---

## 1. 项目概述

### 1.1 目标

开发一个通用的 WebAssembly 性能基准测试框架，用于对比 JavaScript 和 WebAssembly 在处理大型 JSON 树型数据时的性能差异。

### 1.2 核心价值

- 量化 Wasm 在递归计算场景下的性能优势
- 对比不同数据传输方式（structuredClone、Transferable、MessagePack）的效率
- 提供可视化性能对比工具，辅助技术决策
- 为后续项目提供性能优化的参考依据

### 1.3 设计原则

- **模块化**：各测试维度独立封装，便于扩展
- **可扩展**：支持添加新的对比维度和测试方案
- **准确性**：确保测试数据一致性和结果可靠性
- **易用性**：提供直观的可视化界面和配置选项

---

## 2. 系统架构

### 2.1 整体架构

采用三层架构设计，各层职责清晰，通过标准接口通信：

```
┌─────────────────────────────────────────────────────────┐
│                    结果展示层 (Vue 3)                     │
│  - 测试配置面板  - 性能对比图表  - 结果导出功能           │
└────────────────────┬──────────────────────────────────────┘
                     │ postMessage / onmessage
┌────────────────────▼──────────────────────────────────────┐
│                  测试执行层 (Web Worker)                  │
│  - JS递归模块  - Wasm对象传输模块  - Wasm二进制传输模块   │
└────────────────────┬──────────────────────────────────────┘
                     │ Wasm API调用
┌────────────────────▼──────────────────────────────────────┐
│                数据处理层 (Rust Wasm)                     │
│  - 高性能递归算法  - 序列化/反序列化  - 内存优化          │
└─────────────────────────────────────────────────────────┘
```

### 2.2 各层职责

#### 数据生成层（主线程）

**职责**：
- 生成不同规模和深度的树型测试数据
- 确保测试数据的可复现性
- 提供数据序列化和缓存功能

**核心类**：
```typescript
class TreeGenerator {
  generate(depth: number, breadth: number): TreeNode[];
  generateBatch(configs: GenerationConfig[]): Map<string, TreeNode[]>;
  saveToFile(data: TreeNode[], filename: string): void;
  loadFromFile(filename: string): TreeNode[];
}
```

#### 测试执行层（Web Worker）

**职责**：
- 隔离测试环境，避免主线程阻塞
- 执行具体的性能测试逻辑
- 收集和上报性能指标
- 处理异常和重试逻辑

**核心接口**：
```typescript
interface TestModule {
  name: string;
  runTest(data: TreeNode[], config: TestConfig): Promise<TestResult>;
  cleanup?(): void; // 可选的清理方法
}

interface TestResult {
  moduleName: string;
  computeTime: number;
  serializeTime: number;
  totalTime: number;
  memoryUsage: number;
  throughput: number;
  error?: Error;
}
```

#### 结果展示层（Vue 3）

**职责**：
- 提供测试配置界面
- 展示实时测试进度
- 渲染性能对比图表
- 支持结果导出和分享

**核心组件**：
- `TestRunner.vue`: 测试执行控制器
- `ResultChart.vue`: 性能对比图表
- `ConfigPanel.vue`: 测试参数配置面板

---

## 3. Rust Wasm 模块设计

### 3.1 项目结构

```
wasm/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── tree.rs        # 树结构定义
    ├── processors.rs  # 处理算法
    └── utils.rs       # 工具函数
```

### 3.2 Cargo.toml 配置

```toml
[package]
name = "wasm-benchmark"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1.0", features = ["derive"] }
serde-wasm-bindgen = "0.6"
serde_json = "1.0"
getrandom = { version = "0.2", features = ["js"] }

[profile.release]
opt-level = 3
lto = true
codegen-units = 1

[package.metadata.wasm-pack.profile.release]
wasm-opt = ["-O4", "--enable-simd"]
```

### 3.3 核心数据结构

```rust
use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TreeNode {
    pub id: String,
    pub value: i32,
    pub children: Option<Vec<TreeNode>>,
}
```

### 3.4 导出接口

#### 模式一：基于 serde-wasm-bindgen

```rust
#[wasm_bindgen]
pub fn process_tree_js(js_objects: JsValue) -> Result<JsValue, JsValue> {
    let mut nodes: Vec<TreeNode> = serde_wasm_bindgen::from_value(js_objects)
        .map_err(|e| JsValue::from_str(&format!("反序列化失败: {}", e)))?;
    
    let start = performance::now();
    recursive_transform(&mut nodes);
    let compute_time = performance::now() - start;
    
    let result = serde_wasm_bindgen::to_value(&nodes)?;
    
    // 将耗时信息附加到结果中
    let performance = js_sys::Object::new();
    js_sys::Reflect::set(&performance, &"computeTime".into(), &compute_time.into())?;
    js_sys::Reflect::set(&result, &"_performance".into(), &performance)?;
    
    Ok(result)
}
```

#### 模式二：基于二进制流

```rust
#[wasm_bindgen]
pub fn process_tree_bytes(bytes: &[u8]) -> Result<Vec<u8>, JsError> {
    // 反序列化二进制数据
    let mut nodes: Vec<TreeNode> = serde_json::from_slice(bytes)
        .map_err(|e| JsError::new(&format!("解析失败: {}", e)))?;
    
    // 执行计算
    recursive_transform(&mut nodes);
    
    // 序列化为二进制
    let result = serde_json::to_vec(&nodes)
        .map_err(|e| JsError::new(&format!("序列化失败: {}", e)))?;
    
    Ok(result)
}
```

### 3.5 计算逻辑

```rust
pub fn recursive_transform(nodes: &mut Vec<TreeNode>) {
    for node in nodes {
        node.value = perform_complex_calculation(node.value);
        if let Some(ref mut children) = node.children {
            recursive_transform(children);
        }
    }
}

fn perform_complex_calculation(value: i32) -> i32 {
    // 模拟复杂计算
    let mut result = value;
    for _ in 0..10 {
        result = (result * 2 + 1) % 1000000;
        result = ((result as f64).sqrt() * 1000.0) as i32;
    }
    result
}

// 性能工具函数
mod performance {
    pub fn now() -> f64 {
        web_sys::window()
            .expect("无 window 对象")
            .performance()
            .expect("无 performance 对象")
            .now()
    }
}
```

### 3.6 内存优化

```rust
use std::sync::OnceLock;

// 预分配内存池
static NODE_POOL: OnceLock<Vec<TreeNode>> = OnceLock::new();

pub fn init_pool(size: usize) {
    NODE_POOL.get_or_init(|| Vec::with_capacity(size));
}

pub fn get_node(value: i32) -> TreeNode {
    TreeNode {
        id: generate_id(),
        value,
        children: None,
    }
}

fn generate_id() -> String {
    use getrandom::getrandom;
    let mut bytes = [0u8; 8];
    getrandom(&mut bytes).unwrap();
    hex::encode(&bytes)
}
```

---

## 4. Vue 3 前端设计

### 4.1 项目结构

```
src/
├── components/
│   ├── TestRunner.vue
│   ├── ResultChart.vue
│   └── ConfigPanel.vue
├── workers/
│   ├── test.worker.ts
│   └── modules/
│       ├── js-recursive.ts
│       ├── wasm-js-object.ts
│       └── wasm-binary.ts
├── utils/
│   └── tree-generator.ts
├── types/
│   └── index.ts
├── App.vue
└── main.ts
```

### 4.2 核心类型定义

```typescript
// types/index.ts
export interface TreeNode {
  id: string;
  value: number;
  children?: TreeNode[];
}

export interface TestConfig {
  nodeCount: number;
  treeDepth: number;
  branchFactor: number;
  complexity: 'simple' | 'medium' | 'complex';
}

export interface TestResult {
  testName: string;
  computeTime: number;
  serializeTime: number;
  transferTime: number;
  totalTime: number;
  memoryUsage: number;
  throughput: number;
  speedupRatio?: number;
  error?: string;
}

export interface TestReport {
  timestamp: number;
  config: TestConfig;
  results: TestResult[];
  summary: {
    fastest: string;
    slowest: string;
    avgSpeedup: number;
  };
}
```

### 4.3 测试生成器

```typescript
// utils/tree-generator.ts
export class TreeGenerator {
  generate(depth: number, breadth: number): TreeNode[] {
    if (depth <= 0) return [];
    
    const nodes: TreeNode[] = [];
    for (let i = 0; i < breadth; i++) {
      nodes.push({
        id: this.generateId(),
        value: Math.floor(Math.random() * 1000),
        children: depth > 1 ? this.generate(depth - 1, Math.floor(breadth * 0.8)) : undefined
      });
    }
    return nodes;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  countNodes(tree: TreeNode[]): number {
    let count = 0;
    for (const node of tree) {
      count++;
      if (node.children) {
        count += this.countNodes(node.children);
      }
    }
    return count;
  }
}
```

### 4.4 Web Worker 模块

#### JS 递归模块

```typescript
// workers/modules/js-recursive.ts
export async function runJsRecursive(data: TreeNode[]): Promise<TestResult> {
  const start = performance.now();
  
  // 计算时间
  const computeStart = performance.now();
  const clonedData = structuredClone(data);
  jsRecursiveTransform(clonedData);
  const computeTime = performance.now() - computeStart;
  
  const totalTime = performance.now() - start;
  
  return {
    testName: 'JS Recursive (Worker)',
    computeTime,
    serializeTime: 0, // structuredClone 不单独计算
    transferTime: 0,
    totalTime,
    memoryUsage: estimateMemoryUsage(data),
    throughput: data.length / (totalTime / 1000)
  };
}

function jsRecursiveTransform(nodes: TreeNode[]): void {
  for (const node of nodes) {
    node.value = performComplexCalculation(node.value);
    if (node.children && node.children.length > 0) {
      jsRecursiveTransform(node.children);
    }
  }
}
```

#### Wasm 对象传输模块

```typescript
// workers/modules/wasm-js-object.ts
import init, { process_tree_js } from '../../../pkg/wasm_benchmark.js';

let wasmInitialized = false;

export async function runWasmJsObject(data: TreeNode[]): Promise<TestResult> {
  const start = performance.now();
  
  // 初始化 Wasm（仅首次）
  if (!wasmInitialized) {
    await init();
    wasmInitialized = true;
  }
  
  // 序列化时间
  const serializeStart = performance.now();
  const jsValue = data as any; // 直接传递对象
  const serializeTime = performance.now() - serializeStart;
  
  // 计算时间
  const computeStart = performance.now();
  const result = process_tree_js(jsValue);
  const computeTime = performance.now() - computeStart;
  
  const totalTime = performance.now() - start;
  
  return {
    testName: 'Wasm (serde-wasm-bindgen)',
    computeTime,
    serializeTime,
    transferTime: 0,
    totalTime,
    memoryUsage: estimateMemoryUsage(data),
    throughput: data.length / (totalTime / 1000)
  };
}
```

#### Wasm 二进制传输模块

```typescript
// workers/modules/wasm-binary.ts
import init, { process_tree_bytes } from '../../../pkg/wasm_benchmark.js';

let wasmInitialized = false;

export async function runWasmBinary(data: TreeNode[]): Promise<TestResult> {
  const start = performance.now();
  
  if (!wasmInitialized) {
    await init();
    wasmInitialized = true;
  }
  
  // 序列化为二进制
  const serializeStart = performance.now();
  const jsonString = JSON.stringify(data);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(jsonString);
  const serializeTime = performance.now() - serializeStart;
  
  // 计算时间
  const computeStart = performance.now();
  const resultBytes = process_tree_bytes(bytes);
  const computeTime = performance.now() - computeStart;
  
  // 反序列化
  const decoder = new TextDecoder();
  const resultJson = decoder.decode(resultBytes);
  JSON.parse(resultJson); // 验证结果
  
  const totalTime = performance.now() - start;
  
  return {
    testName: 'Wasm (Transferable Binary)',
    computeTime,
    serializeTime,
    transferTime: 0, // Transferable 几乎无开销
    totalTime,
    memoryUsage: estimateMemoryUsage(data),
    throughput: data.length / (totalTime / 1000)
  };
}
```

### 4.5 Worker 入口

```typescript
// workers/test.worker.ts
import { runJsRecursive } from './modules/js-recursive';
import { runWasmJsObject } from './modules/wasm-js-object';
import { runWasmBinary } from './modules/wasm-binary';

self.onmessage = async (e: MessageEvent) => {
  const { testType, data } = e.data;
  
  try {
    let result;
    switch (testType) {
      case 'js-recursive':
        result = await runJsRecursive(data);
        break;
      case 'wasm-js-object':
        result = await runWasmJsObject(data);
        break;
      case 'wasm-binary':
        result = await runWasmBinary(data);
        break;
      default:
        throw new Error(`未知的测试类型: ${testType}`);
    }
    
    self.postMessage({ success: true, result });
  } catch (error) {
    self.postMessage({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
};
```

### 4.6 核心组件

#### TestRunner.vue

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';

const testData = ref<TreeNode[]>([]);
const testResults = ref<TestResult[]>([]);
const isRunning = ref(false);
const progress = ref(0);

const testModules = [
  { id: 'js-recursive', name: 'JS 递归' },
  { id: 'wasm-js-object', name: 'Wasm 对象传输' },
  { id: 'wasm-binary', name: 'Wasm 二进制传输' },
];

async function runTests() {
  isRunning.value = true;
  progress.value = 0;
  testResults.value = [];
  
  const results: TestResult[] = [];
  
  for (let i = 0; i < testModules.length; i++) {
    const module = testModules[i];
    const result = await runSingleTest(module.id, testData.value);
    results.push(result);
    progress.value = ((i + 1) / testModules.length) * 100;
  }
  
  // 计算加速比
  const baseline = results[0].totalTime;
  results.forEach(r => {
    r.speedupRatio = baseline / r.totalTime;
  });
  
  testResults.value = results;
  isRunning.value = false;
}

async function runSingleTest(testType: string, data: TreeNode[]): Promise<TestResult> {
  const worker = new Worker(
    new URL('./test.worker.ts', import.meta.url),
    { type: 'module' }
  );
  
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      if (e.data.success) {
        resolve(e.data.result);
      } else {
        reject(new Error(e.data.error));
      }
      worker.terminate();
    };
    
    worker.postMessage({ testType, data });
  });
}
</script>

<template>
  <div class="test-runner">
    <h2>性能测试执行器</h2>
    
    <div v-if="!isRunning">
      <button @click="runTests">开始测试</button>
    </div>
    
    <div v-else class="progress">
      <progress :value="progress" max="100"></progress>
      <p>测试进度: {{ progress.toFixed(1) }}%</p>
    </div>
    
    <ResultChart :results="testResults" v-if="testResults.length > 0" />
  </div>
</template>
```

#### ResultChart.vue

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import * as echarts from 'echarts';

const props = defineProps<{
  results: TestResult[];
}>();

const chartRef = ref<HTMLElement>();
let chart: echarts.ECharts | null = null;

onMounted(() => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value);
    updateChart();
  }
});

const chartOptions = computed(() => ({
  title: { text: '性能对比结果' },
  tooltip: { trigger: 'axis' },
  legend: { data: ['总耗时', '计算耗时', '序列化耗时'] },
  xAxis: {
    type: 'category',
    data: props.results.map(r => r.testName)
  },
  yAxis: { type: 'value', name: '耗时 (ms)' },
  series: [
    {
      name: '总耗时',
      type: 'bar',
      data: props.results.map(r => r.totalTime.toFixed(2))
    },
    {
      name: '计算耗时',
      type: 'bar',
      data: props.results.map(r => r.computeTime.toFixed(2))
    },
    {
      name: '序列化耗时',
      type: 'bar',
      data: props.results.map(r => r.serializeTime.toFixed(2))
    }
  ]
}));

function updateChart() {
  chart?.setOption(chartOptions.value);
}

watch(() => props.results, updateChart, { deep: true });
</script>

<template>
  <div class="result-chart" ref="chartRef" style="width: 100%; height: 400px;"></div>
</template>
```

---

## 5. 性能测试方案

### 5.1 测试数据规格

| 规模 | 节点数 | 树深度 | 分支因子 | 预期用途 |
|------|--------|--------|----------|----------|
| 小型 | 1,000 | 5 | 3-5 | 功能验证 |
| 中型 | 10,000 | 8 | 4-6 | 性能拐点观察 |
| 大型 | 100,000 | 10 | 5-7 | 主要对比场景 |
| 超大 | 500,000 | 12 | 6-8 | 压力测试 |

### 5.2 测试矩阵

**算法对比**：
1. JS 递归（主线程）
2. JS 递归（Worker + structuredClone）
3. Wasm 递归 + serde-wasm-bindgen
4. Wasm 递归 + Transferable 二进制

**计算复杂度**：
- 轻量级：`value = value * 2`
- 中量级：`value = Math.sqrt(value) * 1.5` × 10
- 重量级：复杂加密运算 × 50

### 5.3 性能指标

```typescript
interface DetailedMetrics {
  // 时间指标
  computeTime: number;        // 纯计算耗时 (ms)
  serializeTime: number;      // 序列化/反序列化耗时 (ms)
  transferTime: number;       // Worker 传输耗时 (ms)
  totalTime: number;          // 端到端总耗时 (ms)
  
  // 资源指标
  memoryUsage: number;        // 峰值内存占用 (MB)
  memoryPeak: number;         // 内存峰值 (MB)
  
  // 计算指标
  throughput: number;         // 吞吐量 (节点/秒)
  speedupRatio: number;       // 加速比
  
  // 质量指标
  resultValid: boolean;       // 结果正确性
  consistency: number;        // 多次运行稳定性 (CV%)
}
```

### 5.4 测试流程

1. **数据准备**：生成测试数据集并保存
2. **环境预热**：执行 3 次预热测试
3. **正式测试**：每个测试组合运行 5 次
4. **结果收集**：记录所有性能指标
5. **数据清洗**：去除极端值，取中位数
6. **结果验证**：对比各方案输出一致性
7. **报告生成**：生成对比报告和图表

### 5.5 预期结果

基于经验，预期性能对比：

| 数据规模 | JS 递归 | Wasm 对象 | Wasm 二进制 | 加速比 |
|----------|---------|-----------|-------------|--------|
| 1K 节点 | 5ms | 8ms | 10ms | 0.5x |
| 10K 节点 | 80ms | 60ms | 40ms | 2.0x |
| 100K 节点 | 1200ms | 500ms | 300ms | 4.0x |
| 500K 节点 | 8000ms | 2000ms | 1000ms | 8.0x |

**结论预期**：
- 小规模数据：JS 更快（Wasm 启动开销）
- 中等规模：Wasm 开始显现优势
- 大规模：Wasm 优势显著（4-8 倍）
- 二进制传输在超大数据下优势明显

---

## 6. 实施计划

### 阶段一：基础框架（2-3天）

**目标**：搭建可运行的最小原型

**任务**：
1. 初始化 Rust Wasm 项目
2. 实现基础树结构和递归算法
3. 搭建 Vue 3 + Vite 前端框架
4. 实现数据生成器
5. 实现 JS 递归测试模块
6. 实现基础的 ResultChart 组件

**交付物**：
- 可运行的测试框架
- 至少包含 1 个对比维度

### 阶段二：功能完善（3-4天）

**目标**：添加完整的对比维度

**任务**：
1. 实现 Wasm 对象传输测试模块
2. 实现 Wasm 二进制传输测试模块
3. 完善 ConfigPanel 组件
4. 添加性能指标收集
5. 实现结果验证机制
6. 优化图表展示

**交付物**：
- 完整的 3 个对比维度
- 完善的性能测试报告

### 阶段三：优化扩展（2-3天）

**目标**：性能优化和功能扩展

**任务**：
1. Rust Wasm 性能优化
2. 添加 MessagePack 传输方式
3. 实现测试结果导出
4. 添加内存监控
5. 编写使用文档
6. 代码重构和优化

**交付物**：
- 优化后的高性能版本
- 完整的文档和示例

---

## 7. 技术栈总结

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Rust | 1.70+ | Wasm 开发语言 |
| wasm-bindgen | 0.2 | JS <-> Rust 绑定 |
| serde | 1.0 | 序列化/反序列化 |
| serde-wasm-bindgen | 0.6 | 高效 JS 对象转换 |

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue 3 | 3.3+ | 前端框架 |
| Vite | 4.0+ | 构建工具 |
| TypeScript | 5.0+ | 类型系统 |
| ECharts | 5.0+ | 数据可视化 |
| vite-plugin-wasm | latest | Wasm 支持 |

---

## 8. 风险和挑战

### 8.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Wasm 内存溢出 | 高 | 配置合理的内存限制，实现分批处理 |
| Worker 兼容性问题 | 中 | 提供降级方案，支持主线程运行 |
| 序列化性能瓶颈 | 高 | 优先实现 Transferable 方案 |

### 8.2 开发挑战

1. **数据一致性验证**：确保不同测试方案输出完全一致
2. **性能测试准确性**：排除浏览器优化和缓存干扰
3. **内存监控精度**：在 Worker 环境中准确测量内存占用

---

## 9. 后续扩展方向

### 9.1 短期扩展

1. 添加 MessagePack 传输方式
2. 支持更多数据结构（图、链表）
3. 添加并发测试（多 Worker 并行）
4. 实现测试结果历史记录

### 9.2 长期扩展

1. 支持 SharedArrayBuffer 零拷贝
2. 添加 GPU 加速对比
3. 实现在线测试平台
4. 集成到 CI/CD 流程

---

## 10. 结论

本设计方案提供了一个模块化、可扩展的 WebAssembly 性能基准测试框架，能够有效对比不同技术方案在处理大型 JSON 树型数据时的性能差异。

**核心优势**：
- 清晰的分层架构，易于理解和维护
- 模块化设计，便于添加新的对比维度
- 完善的性能指标收集和可视化
- 基于真实场景的测试数据

**预期价值**：
- 量化 Wasm 的性能优势（预期 4-8 倍加速）
- 为技术选型提供数据支持
- 为性能优化提供方向指导
- 作为其他项目的参考模板

---

**文档版本历史**：
- v1.0 (2025-01-26): 初始版本，完整设计方案
import type { TreeNode, TestResult } from '../../types';

// 导入 Wasm 模块
import init, { process_tree_bytes } from '../../../pkg/wasm_benchmark.js';

let wasmInitialized = false;

export async function runWasmBinary(data: TreeNode[]): Promise<TestResult> {
  const start = performance.now();
  
  // 初始化 Wasm（仅首次）
  if (!wasmInitialized) {
    await init();
    wasmInitialized = true;
  }
  
  // 1. JS 序列化：JSON.stringify + TextEncoder
  const serializeStart = performance.now();
  const jsonString = JSON.stringify(data);
  const textEncoder = new TextEncoder();
  const inputBytes = textEncoder.encode(jsonString);
  const jsSerializeTime = performance.now() - serializeStart;
  
  // 2. Wasm 处理（包含反序列化 + 计算 + 序列化）
  const computeStart = performance.now();
  const outputBytes = process_tree_bytes(inputBytes);
  const wasmTime = performance.now() - computeStart;
  
  // 3. JS 反序列化：TextDecoder + JSON.parse
  const deserializeStart = performance.now();
  const textDecoder = new TextDecoder();
  const resultJson = textDecoder.decode(outputBytes);
  const resultData = JSON.parse(resultJson) as TreeNode[];
  const jsDeserializeTime = performance.now() - deserializeStart;
  
  const totalTime = performance.now() - start;
  
  // 将 JS 序列化和反序列化时间合并为"序列化时间"
  const serializeTime = jsSerializeTime + jsDeserializeTime;
  const computeTime = wasmTime;
  const transferTime = 0; // Worker 内部，传输时间可忽略
  
  return {
    testName: 'Wasm 二进制传输',
    computeTime,
    serializeTime,
    transferTime,
    totalTime,
    memoryUsage: estimateMemoryUsage(inputBytes),
    throughput: countNodes(resultData) / (computeTime / 1000)
  };
}

function countNodes(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    if (node.children) {
      count += countNodes(node.children);
    }
  }
  return count;
}

function estimateMemoryUsage(bytes: Uint8Array): number {
  return (bytes.length * 2) / (1024 * 1024); // 二进制数据 + Rust 解析后结构
}
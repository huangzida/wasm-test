import type { TreeNode, TestResult } from '../../types';

// 导入 Wasm 模块
import init, { perform_crud_operations_json } from '../../../pkg/wasm_benchmark.js';

let wasmInitialized = false;

export async function runWasmCrud(
  data: TreeNode[],
  crudConfig: { readCount: number; updateCount: number; deleteCount: number; insertCount: number }
): Promise<TestResult> {
  const start = performance.now();
  
  // 初始化 Wasm（仅首次）
  if (!wasmInitialized) {
    await init();
    wasmInitialized = true;
  }
  
  // 使用 JSON 字节流（比 serde-wasm-bindgen 快）
  const serializeStart = performance.now();
  const jsonBytes = new TextEncoder().encode(JSON.stringify(data));
  const serializeEnd = performance.now();
  const serializeTime1 = serializeEnd - serializeStart;
  
  // 计算 + 序列化（传入配置的操作次数）
  const computeStart = performance.now();
  const resultBytes = perform_crud_operations_json(
    jsonBytes,
    crudConfig.readCount,
    crudConfig.updateCount,
    crudConfig.deleteCount,
    crudConfig.insertCount
  );
  const computeEnd = performance.now();
  const computeTime = computeEnd - computeStart;
  
  // 反序列化结果
  const resultText = new TextDecoder().decode(resultBytes);
  JSON.parse(resultText);
  
  const totalTime = performance.now() - start;
  const transferTime = 0;
  
  return {
    testName: 'Wasm CRUD (优化版)',
    computeTime,
    serializeTime: serializeTime1,
    transferTime,
    totalTime,
    memoryUsage: estimateMemoryUsage(data),
    throughput: countNodes(data) / (totalTime / 1000)
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

function estimateMemoryUsage(data: TreeNode[]): number {
  const jsonSize = JSON.stringify(data).length;
  return (jsonSize * 2) / (1024 * 1024); // JS 对象 + 字节数组
}

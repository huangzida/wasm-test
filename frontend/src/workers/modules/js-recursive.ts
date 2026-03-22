import type { TreeNode, TestResult } from '../../types';

export async function runJsRecursive(data: TreeNode[]): Promise<TestResult> {
  const start = performance.now();
  
  // 计算时间
  const computeStart = performance.now();
  const clonedData = structuredClone(data);
  jsRecursiveTransform(clonedData);
  const computeTime = performance.now() - computeStart;
  
  const totalTime = performance.now() - start;
  
  return {
    testName: 'JS 递归 (Worker)',
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

function performComplexCalculation(value: number): number {
  let result = value;
  
  // 增加计算复杂度：1000 次迭代，包含多种运算
  // 与 Wasm 端保持一致，确保公平对比
  for (let i = 0; i < 1000; i++) {
    // 多次乘法、加法、取模运算
    result = (result * 3 + 7) % 2147483647;
    result = (result * 5 - 11) % 2147483647;
    result = (result + 999999) % 2147483647;
    
    // 平方根运算（较慢）
    result = Math.floor(Math.sqrt(result) * 10000);
    
    // 三角函数运算（最慢）
    const radians = (result * Math.PI) / 180;
    result = Math.floor(Math.sin(radians) * 1000000);
    result = Math.floor(Math.cos(radians) * 1000000);
    
    // 位运算
    result = (result << 5) | (result >>> 27);
    result = (result >>> 3) | (result << 29);
    result = result ^ 0x12345678;
    
    // 指数运算
    result = Math.floor(Math.log(Math.abs(result)) * 10000);
    
    // 对数运算
    if (result > 0) {
      result = Math.floor(Math.log10(result) * 10000);
    }
  }
  
  return Math.abs(result) % 1000000;
}

function estimateMemoryUsage(data: TreeNode[]): number {
  // 简单估算：每个节点约 200 字节
  const jsonSize = JSON.stringify(data).length;
  return (jsonSize * 2) / (1024 * 1024); // MB
}

// ====== 树的 CRUD 操作 ======

// 收集树中所有节点的 ID
function collectAllNodeIds(nodes: TreeNode[]): string[] {
  const ids: string[] = [];
  function collect(node: TreeNode) {
    ids.push(node.id);
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        collect(child);
      }
    }
  }
  for (const node of nodes) {
    collect(node);
  }
  return ids;
}

function findNodeReadonly(nodes: TreeNode[], targetId: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.id === targetId) {
      return node;
    }
    if (node.children && node.children.length > 0) {
      const found = findNodeReadonly(node.children, targetId);
      if (found) return found;
    }
  }
  return undefined;
}

function findNode(nodes: TreeNode[], targetId: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.id === targetId) {
      return node;
    }
    if (node.children && node.children.length > 0) {
      const found = findNode(node.children, targetId);
      if (found) return found;
    }
  }
  return undefined;
}

function deleteNode(nodes: TreeNode[], targetId: string): boolean {
  const index = nodes.findIndex(n => n.id === targetId);
  if (index !== -1) {
    nodes.splice(index, 1);
    return true;
  }
  
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      if (deleteNode(node.children, targetId)) {
        return true;
      }
    }
  }
  
  return false;
}

export async function runJsCrud(
  data: TreeNode[],
  crudConfig: { readCount: number; updateCount: number; deleteCount: number; insertCount: number }
): Promise<TestResult> {
  const start = performance.now();
  
  // 克隆数据
  const clonedData = structuredClone(data);
  
  // 收集所有节点 ID（从整个树中）
  const nodeIds = collectAllNodeIds(clonedData);
  
  // 确保 nodeIds 不为空
  if (nodeIds.length === 0) {
    return {
      testName: 'JS CRUD (Worker)',
      computeTime: 0,
      serializeTime: 0,
      transferTime: 0,
      totalTime: 0,
      memoryUsage: estimateMemoryUsage(data),
      throughput: 0
    };
  }
  
  // 1. 查找操作
  for (let i = 0; i < crudConfig.readCount; i++) {
    const id = nodeIds[i % nodeIds.length]!; // 循环使用 ID（非空断言）
    findNodeReadonly(clonedData, id);
  }
  
  // 2. 更新操作
  for (let i = 0; i < crudConfig.updateCount; i++) {
    const id = nodeIds[i % nodeIds.length]!; // 循环使用 ID（非空断言）
    const node = findNode(clonedData, id);
    if (node) {
      node.value += 100;
    }
  }
  
  // 3. 删除操作
  for (let i = 0; i < crudConfig.deleteCount; i++) {
    const id = nodeIds[i % nodeIds.length]!; // 循环使用 ID（非空断言）
    deleteNode(clonedData, id);
  }
  
  // 4. 插入操作
  if (clonedData.length > 0) {
    const rootNode = clonedData[0];
    if (rootNode) {
      if (!rootNode.children) {
        rootNode.children = [];
      }
      for (let i = 0; i < crudConfig.insertCount; i++) {
        rootNode.children.push({
          id: `new_node_${i}`,
          value: i * 10,
          children: undefined
        });
      }
    }
  }
  
  const totalTime = performance.now() - start;
  
  return {
    testName: 'JS CRUD (Worker)',
    computeTime: totalTime,
    serializeTime: 0,
    transferTime: 0,
    totalTime,
    memoryUsage: estimateMemoryUsage(data),
    throughput: data.length / (totalTime / 1000)
  };
}

// ====== 主线程版本（会阻塞 UI）=====

export function runJsRecursiveMain(data: TreeNode[]): TestResult {
  const start = performance.now();
  
  // 计算时间
  const clonedData = structuredClone(data);
  jsRecursiveTransform(clonedData);
  
  const totalTime = performance.now() - start;
  
  return {
    testName: 'JS 递归 (主线程)',
    computeTime: totalTime,
    serializeTime: 0,
    transferTime: 0,
    totalTime,
    memoryUsage: estimateMemoryUsage(data),
    throughput: data.length / (totalTime / 1000)
  };
}

export function runJsCrudMain(
  data: TreeNode[],
  crudConfig: { readCount: number; updateCount: number; deleteCount: number; insertCount: number }
): TestResult {
  const start = performance.now();
  
  // 克隆数据
  const clonedData = structuredClone(data);
  
  // 收集所有节点 ID（从整个树中）
  const nodeIds = collectAllNodeIds(clonedData);
  
  // 确保 nodeIds 不为空
  if (nodeIds.length === 0) {
    return {
      testName: 'JS CRUD (主线程)',
      computeTime: 0,
      serializeTime: 0,
      transferTime: 0,
      totalTime: 0,
      memoryUsage: estimateMemoryUsage(data),
      throughput: 0
    };
  }
  
  // 1. 查找操作
  for (let i = 0; i < crudConfig.readCount; i++) {
    const id = nodeIds[i % nodeIds.length]!; // 循环使用 ID（非空断言）
    findNodeReadonly(clonedData, id);
  }
  
  // 2. 更新操作
  for (let i = 0; i < crudConfig.updateCount; i++) {
    const id = nodeIds[i % nodeIds.length]!; // 循环使用 ID（非空断言）
    const node = findNode(clonedData, id);
    if (node) {
      node.value += 100;
    }
  }
  
  // 3. 删除操作
  for (let i = 0; i < crudConfig.deleteCount; i++) {
    const id = nodeIds[i % nodeIds.length]!; // 循环使用 ID（非空断言）
    deleteNode(clonedData, id);
  }
  
  // 4. 插入操作
  if (clonedData.length > 0) {
    const rootNode = clonedData[0];
    if (rootNode) {
      if (!rootNode.children) {
        rootNode.children = [];
      }
      for (let i = 0; i < crudConfig.insertCount; i++) {
        rootNode.children.push({
          id: `new_node_${i}`,
          value: i * 10,
          children: undefined
        });
      }
    }
  }
  
  const totalTime = performance.now() - start;
  
  return {
    testName: 'JS CRUD (主线程)',
    computeTime: totalTime,
    serializeTime: 0,
    transferTime: 0,
    totalTime,
    memoryUsage: estimateMemoryUsage(data),
    throughput: data.length / (totalTime / 1000)
  };
}

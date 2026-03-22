import type { TreeNode } from '../types';

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

  generateByCount(targetCount: number): TreeNode[] {
    if (targetCount <= 0) return [];
    
    // 简单直接的方法：生成精确数量的节点
    const allNodes: TreeNode[] = [];
    for (let i = 0; i < targetCount; i++) {
      allNodes.push({
        id: `node_${i}`,
        value: Math.floor(Math.random() * 1000),
        children: undefined
      });
    }
    
    // 将线性数组组织成树形结构
    // 每个节点最多 10 个子节点
    const maxChildren = 10;
    let parentIndex = 0;
    let childIndex = 1;
    
    // 构建树形结构
    while (childIndex < targetCount && parentIndex < childIndex) {
      const parent = allNodes[parentIndex];
      if (parent) {
        const childrenCount = Math.min(maxChildren, targetCount - childIndex);
        
        if (childrenCount > 0) {
          parent.children = [];
          for (let i = 0; i < childrenCount; i++) {
            const child = allNodes[childIndex + i];
            if (child) {
              parent.children.push(child);
            }
          }
          childIndex += childrenCount;
        } else {
          parent.children = undefined;
        }
      }
      parentIndex++;
    }
    
    // 清理剩余节点的 children 属性
    for (let i = parentIndex; i < targetCount; i++) {
      const node = allNodes[i];
      if (node) {
        node.children = undefined;
      }
    }
    
    // 返回根节点（前 ceil(targetCount/maxChildren) 个节点）
    const rootCount = Math.ceil(targetCount / maxChildren);
    return allNodes.slice(0, rootCount);
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

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
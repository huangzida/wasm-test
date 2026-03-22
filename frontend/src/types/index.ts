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
  crudConfig: {
    readCount: number;      // 查找次数
    updateCount: number;     // 更新次数
    deleteCount: number;     // 删除次数
    insertCount: number;     // 插入次数
  };
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
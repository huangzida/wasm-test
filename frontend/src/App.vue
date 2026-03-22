<script setup lang="ts">
import { ref } from 'vue';
import ConfigPanel from './components/ConfigPanel.vue';
import ResultChart from './components/ResultChart.vue';
import { TreeGenerator } from './utils/tree-generator';
import type { TreeNode, TestResult } from './types';

const testData = ref<TreeNode[]>([]);
const testResults = ref<TestResult[]>([]);
const isRunning = ref(false);
const progress = ref(0);
const nodeCount = ref(0);

const treeGenerator = new TreeGenerator();

// CRUD 配置
const crudConfig = ref({
  readCount: 1000,
  updateCount: 1000,
  deleteCount: 1000,
  insertCount: 1000
});

const testModules: any[] = [
  { id: 'js-recursive', name: 'JS 递归 (Worker)' },
  { id: 'js-recursive-main', name: 'JS 递归 (主线程)' },
  { id: 'wasm-js-object', name: 'Wasm 对象传输' },
  { id: 'wasm-binary', name: 'Wasm 二进制传输' },
  { id: 'js-crud', name: 'JS CRUD 操作' },
  { id: 'js-crud-main', name: 'JS CRUD (主线程)' },
  { id: 'wasm-crud', name: 'Wasm CRUD (JSON 字节流优化)' },
];

function handleGenerateData(count: number) {
  console.log(`正在生成 ${count.toLocaleString()} 个节点的测试数据...`);
  const start = performance.now();
  
  testData.value = treeGenerator.generateByCount(count);
  nodeCount.value = treeGenerator.countNodes(testData.value);
  
  const duration = performance.now() - start;
  console.log(`数据生成完成，实际节点数: ${nodeCount.value.toLocaleString()}，耗时: ${duration.toFixed(2)}ms`);
  
  // 清空之前的结果
  testResults.value = [];
}

async function runTests() {
  if (testData.value.length === 0) {
    alert('请先生成测试数据！');
    return;
  }
  
  isRunning.value = true;
  progress.value = 0;
  testResults.value = [];
  
  const results: TestResult[] = [];
  
  for (let i = 0; i < testModules.length; i++) {
    const module = testModules[i];
    console.log(`开始测试: ${module.name}`);
    
    try {
      const result = await runSingleTest(module.id, testData.value);
      results.push(result);
      console.log(`测试完成: ${module.name}, 耗时: ${result.totalTime.toFixed(2)}ms`);
    } catch (error) {
      console.error(`测试失败: ${module.name}`, error);
      results.push({
        testName: module.name,
        computeTime: 0,
        serializeTime: 0,
        transferTime: 0,
        totalTime: 0,
        memoryUsage: 0,
        throughput: 0,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    progress.value = ((i + 1) / testModules.length) * 100;
  }
  
  // 计算加速比
  if (results.length > 0 && results[0]!.totalTime > 0) {
    const baseline = results[0]!.totalTime;
    results.forEach(r => {
      if (r.totalTime > 0) {
        r.speedupRatio = baseline / r.totalTime;
      }
    });
  }
  
  testResults.value = results;
  isRunning.value = false;
}

async function runSingleTest(testType: string, data: TreeNode[]): Promise<TestResult> {
  // 主线程测试（会阻塞 UI）
  if (testType === 'js-recursive-main' || testType === 'js-crud-main') {
    // 导入主线程测试函数
    const { runJsRecursiveMain, runJsCrudMain } = await import('./workers/modules/js-recursive');
    
    // 使用 JSON 序列化确保数据是纯净的
    const cleanData = JSON.parse(JSON.stringify(data));
    
    if (testType === 'js-recursive-main') {
      return runJsRecursiveMain(cleanData);
    } else {
      return runJsCrudMain(cleanData, {
        readCount: crudConfig.value.readCount,
        updateCount: crudConfig.value.updateCount,
        deleteCount: crudConfig.value.deleteCount,
        insertCount: crudConfig.value.insertCount
      });
    }
  }
  
  // Worker 测试（不阻塞 UI）
  const worker = new Worker(
    new URL('./workers/test.worker.ts', import.meta.url),
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
    
    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };
    
    // 使用 JSON 序列化确保数据是纯净的，避免 Vue 响应式系统导致的克隆问题
    const cleanData = JSON.parse(JSON.stringify(data));
    
    // 展开 crudConfig 为普通对象，避免传递 Vue ref
    worker.postMessage({ 
      testType, 
      data: cleanData,
      crudConfig: {
        readCount: crudConfig.value.readCount,
        updateCount: crudConfig.value.updateCount,
        deleteCount: crudConfig.value.deleteCount,
        insertCount: crudConfig.value.insertCount
      }
    });
  });
}
</script>

<template>
  <div id="app">
    <header>
      <h1>🚀 WebAssembly 性能基准测试框架</h1>
      <p>对比 JavaScript 和 WebAssembly 在处理大型 JSON 树型数据时的性能差异</p>
    </header>

    <main>
      <ConfigPanel 
        @generate="handleGenerateData" 
        @updateCrudConfig="(config) => crudConfig = config" 
      />
      
      <div v-if="nodeCount > 0" class="test-info">
        <h3>当前测试数据</h3>
        <p>节点数: <strong>{{ nodeCount.toLocaleString() }}</strong></p>
        <p>数据大小: <strong>{{ (JSON.stringify(testData).length / 1024).toFixed(2) }} KB</strong></p>
        
        <div class="test-actions">
          <button 
            @click="runTests" 
            :disabled="isRunning"
            :class="{ running: isRunning }"
            class="run-btn"
          >
            {{ isRunning ? '测试中...' : '🔥 开始性能测试' }}
          </button>
        </div>
      </div>
      
      <div v-if="isRunning" class="progress-container">
        <h3>测试进度</h3>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
        </div>
        <p>{{ progress.toFixed(0) }}%</p>
      </div>
      
      <ResultChart :results="testResults" v-if="testResults.length > 0" />
    </main>

    <footer>
      <p>📊 基于 Rust + WebAssembly + Vue 3 + Vite 构建</p>
    </footer>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  padding: 20px;
}

#app {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 40px;
  text-align: center;
}

header h1 {
  font-size: 2.5em;
  margin-bottom: 10px;
}

header p {
  font-size: 1.1em;
  opacity: 0.9;
}

main {
  padding: 30px;
}

.test-info {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.test-info h3 {
  margin-bottom: 15px;
  color: #333;
}

.test-info p {
  margin: 8px 0;
  font-size: 16px;
  color: #555;
}

.test-actions {
  margin-top: 20px;
}

.run-btn {
  width: 100%;
  padding: 15px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.run-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.run-btn:active:not(:disabled) {
  transform: translateY(0);
}

.run-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.progress-container {
  background: #f8f9fa;
  padding: 25px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.progress-container h3 {
  margin-bottom: 15px;
  color: #333;
}

.progress-bar {
  width: 100%;
  height: 30px;
  background: #e0e0e0;
  border-radius: 15px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
}

.progress-container p {
  margin-top: 10px;
  text-align: center;
  font-size: 18px;
  font-weight: bold;
  color: #667eea;
}

footer {
  background: #f8f9fa;
  padding: 20px;
  text-align: center;
  color: #666;
  border-top: 1px solid #e0e0e0;
}

footer p {
  margin: 0;
}
</style>
import { runJsRecursive, runJsCrud } from './modules/js-recursive';
import { runWasmJsObject } from './modules/wasm-js-object';
import { runWasmBinary } from './modules/wasm-binary';
import { runWasmCrud } from './modules/wasm-crud';
import type { TreeNode, TestResult } from '../types';

self.onmessage = async (e: MessageEvent) => {
  const { testType, data, crudConfig } = e.data;
  
  try {
    let result: TestResult;
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
      case 'js-crud':
        result = await runJsCrud(data, crudConfig);
        break;
      case 'wasm-crud':
        result = await runWasmCrud(data, crudConfig);
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

// 导出类型供 TypeScript 使用
export type {};
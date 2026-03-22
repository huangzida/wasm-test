<script setup lang="ts">
import { ref, watch } from 'vue';

const nodeCounts = [1000, 10000, 100000, 500000];
const selectedNodeCount = ref(10000);

// CRUD 配置
const crudConfig = ref({
  readCount: 1000,
  updateCount: 1000,
  deleteCount: 1000,
  insertCount: 1000
});

const crudPresets = [
  { name: '轻量级', readCount: 100, updateCount: 100, deleteCount: 100, insertCount: 100 },
  { name: '默认', readCount: 1000, updateCount: 1000, deleteCount: 1000, insertCount: 1000 },
  { name: '重度', readCount: 10000, updateCount: 10000, deleteCount: 10000, insertCount: 10000 },
  { name: '极限', readCount: 100000, updateCount: 100000, deleteCount: 100000, insertCount: 100000 },
];

const selectedPreset = ref(1); // 默认选择"默认"预设

function applyPreset(index: number) {
  const preset = crudPresets[index];
  if (!preset) return;
  crudConfig.value = {
    readCount: preset.readCount,
    updateCount: preset.updateCount,
    deleteCount: preset.deleteCount,
    insertCount: preset.insertCount
  };
}

watch(selectedPreset, (newIndex) => {
  applyPreset(newIndex);
});

const emit = defineEmits<{
  (e: 'generate', count: number): void;
  (e: 'updateCrudConfig', config: typeof crudConfig.value): void;
}>();

watch(crudConfig, (newConfig) => {
  emit('updateCrudConfig', newConfig);
}, { deep: true });

function generateData() {
  emit('generate', selectedNodeCount.value);
}
</script>

<template>
  <div class="config-panel">
    <h2>测试配置</h2>
    
    <div class="config-item">
      <label>数据规模（节点数）：</label>
      <select v-model="selectedNodeCount">
        <option v-for="count in nodeCounts" :key="count" :value="count">
          {{ count.toLocaleString() }}
        </option>
      </select>
    </div>
    
    <button @click="generateData" class="generate-btn">
      生成测试数据
    </button>
    
    <div class="config-divider"></div>
    
    <h3>CRUD 操作配置</h3>
    
    <div class="config-item">
      <label>预设配置：</label>
      <select v-model="selectedPreset">
        <option v-for="(preset, index) in crudPresets" :key="index" :value="index">
          {{ preset.name }}
        </option>
      </select>
    </div>
    
    <div class="crud-config-grid">
      <div class="config-item">
        <label>查找次数：</label>
        <input 
          type="number" 
          v-model.number="crudConfig.readCount" 
          min="0" 
          max="100000"
          class="number-input"
        >
      </div>
      
      <div class="config-item">
        <label>更新次数：</label>
        <input 
          type="number" 
          v-model.number="crudConfig.updateCount" 
          min="0" 
          max="100000"
          class="number-input"
        >
      </div>
      
      <div class="config-item">
        <label>删除次数：</label>
        <input 
          type="number" 
          v-model.number="crudConfig.deleteCount" 
          min="0" 
          max="100000"
          class="number-input"
        >
      </div>
      
      <div class="config-item">
        <label>插入次数：</label>
        <input 
          type="number" 
          v-model.number="crudConfig.insertCount" 
          min="0" 
          max="100000"
          class="number-input"
        >
      </div>
    </div>
    
    <div class="info">
      <p><strong>说明：</strong></p>
      <ul>
      <li>1K 节点：功能验证，适合快速测试</li>
        <li>10K 节点：观察性能拐点</li>
        <li>100K 节点：主要对比场景</li>
        <li>500K 节点：压力测试（需要较大内存）</li>
      </ul>
      
      <p style="margin-top: 15px;"><strong>CRUD 配置说明：</strong></p>
      <ul>
        <li><strong>轻量级</strong>：100/100/100/100 - 少量操作，适合快速验证</li>
        <li><strong>默认</strong>：1000/1000/1000/1000 - 标准测试场景，平衡各项操作</li>
        <li><strong>重度</strong>：10000/10000/10000/10000 - 大量操作，测试极限性能</li>
        <li><strong>极限</strong>：100000/100000/100000/100000 - 超高操作次数，压力测试</li>
      </ul>
      <p style="margin-top: 10px; font-size: 12px; color: #999;">
        * 可手动配置最大 100,000 次操作
      </p>
    </div>
  </div>
</template>

<style scoped>
.config-panel {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.config-panel h2 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
}

.config-item {
  margin-bottom: 15px;
}

.config-item label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #555;
}

.config-item select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.generate-btn {
  width: 100%;
  padding: 12px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.generate-btn:hover {
  background-color: #45a049;
}

.generate-btn:active {
  background-color: #3d8b40;
}

.info {
  margin-top: 20px;
  padding: 15px;
  background: white;
  border-radius: 4px;
  border-left: 4px solid #2196F3;
}

.info p {
  margin: 0 0 10px 0;
  color: #333;
}

.info ul {
  margin: 0;
  padding-left: 20px;
  color: #666;
  font-size: 14px;
}

.info li {
  margin-bottom: 5px;
}

.config-divider {
  height: 1px;
  background: #e0e0e0;
  margin: 25px 0;
}

h3 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 1.1em;
}

.crud-config-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 10px;
}

.number-input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.3s;
}

.number-input:focus {
  outline: none;
  border-color: #2196F3;
}
</style>

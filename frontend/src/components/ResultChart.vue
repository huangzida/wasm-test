<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import type { TestResult } from '../types';

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
  title: { 
    text: '性能对比结果',
    left: 'center'
  },
  tooltip: { 
    trigger: 'axis',
    axisPointer: { type: 'shadow' }
  },
  legend: { 
    data: ['总耗时', '计算耗时', '序列化耗时'],
    top: '10%'
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    top: '20%',
    containLabel: true
  },
  xAxis: {
    type: 'category',
    data: props.results.map(r => r.testName),
    axisLabel: {
      interval: 0,
      rotate: 30
    }
  },
  yAxis: { 
    type: 'value', 
    name: '耗时 (ms)'
  },
  series: [
    {
      name: '总耗时',
      type: 'bar',
      data: props.results.map(r => r.totalTime.toFixed(2)),
      itemStyle: { color: '#5470c6' }
    },
    {
      name: '计算耗时',
      type: 'bar',
      data: props.results.map(r => r.computeTime.toFixed(2)),
      itemStyle: { color: '#91cc75' }
    },
    {
      name: '序列化耗时',
      type: 'bar',
      data: props.results.map(r => r.serializeTime.toFixed(2)),
      itemStyle: { color: '#fac858' }
    }
  ]
}));

function updateChart() {
  chart?.setOption(chartOptions.value);
}

watch(() => props.results, updateChart, { deep: true });
</script>

<template>
  <div class="result-chart">
    <div ref="chartRef" style="width: 100%; height: 400px;"></div>
    
    <div v-if="results.length > 0" class="result-table">
      <table>
        <thead>
          <tr>
            <th>测试方案</th>
            <th>总耗时 (ms)</th>
            <th>计算耗时 (ms)</th>
            <th>序列化耗时 (ms)</th>
            <th>内存占用 (MB)</th>
            <th>吞吐量 (节点/秒)</th>
            <th>加速比</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="result in results" :key="result.testName">
            <td>{{ result.testName }}</td>
            <td>{{ result.totalTime.toFixed(2) }}</td>
            <td>{{ result.computeTime.toFixed(2) }}</td>
            <td>{{ result.serializeTime.toFixed(2) }}</td>
            <td>{{ result.memoryUsage.toFixed(2) }}</td>
            <td>{{ result.throughput.toFixed(0) }}</td>
            <td>{{ result.speedupRatio ? result.speedupRatio.toFixed(2) + 'x' : '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.result-chart {
  margin-top: 20px;
}

.result-table {
  margin-top: 20px;
  overflow-x: auto;
}

.result-table table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

.result-table th,
.result-table td {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
}

.result-table th {
  background-color: #f5f5f5;
  font-weight: bold;
}

.result-table tr:hover {
  background-color: #f9f9f9;
}
</style>
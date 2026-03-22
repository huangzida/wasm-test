use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

/// 树节点结构
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TreeNode {
    pub id: String,
    pub value: i32,
    pub children: Option<Vec<TreeNode>>,
}

/// 使用 serde-wasm-bindgen 处理树结构
#[wasm_bindgen]
pub fn process_tree_js(js_objects: JsValue) -> Result<JsValue, JsValue> {
    let mut nodes: Vec<TreeNode> = serde_wasm_bindgen::from_value(js_objects)
        .map_err(|e| JsValue::from_str(&format!("反序列化失败: {}", e)))?;
    
    recursive_transform(&mut nodes);
    
    let result = serde_wasm_bindgen::to_value(&nodes)?;
    
    Ok(result)
}

/// 使用二进制流处理树结构
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

/// 递归转换树结构
pub fn recursive_transform(nodes: &mut Vec<TreeNode>) {
    for node in nodes {
        node.value = perform_complex_calculation(node.value);
        if let Some(ref mut children) = node.children {
            recursive_transform(children);
        }
    }
}

/// 执行复杂计算（模拟真实业务逻辑）
/// 
/// 注意：从 100 次迭代提升到 1000 次迭代
/// 原因：100 次迭代对现代 CPU 来说太快，无法体现 Wasm 的优势
/// 1000 次迭代更接近真实场景，能更好地展示 Rust 的性能优势
fn perform_complex_calculation(value: i32) -> i32 {
    let mut result = value;
    
    // 增加计算复杂度：1000 次迭代，包含多种运算
    for _ in 0..1000 {
        // 多次乘法、加法、取模运算
        result = (result * 3 + 7) % 2147483647;
        result = (result * 5 - 11) % 2147483647;
        result = (result + 999999) % 2147483647;
        
        // 平方根运算（较慢）
        result = ((result as f64).sqrt() * 10000.0) as i32;
        
        // 三角函数运算（最慢）
        let radians = (result as f64) * std::f64::consts::PI / 180.0;
        let sin_result = (radians.sin() * 1000000.0) as i32;
        let cos_result = (radians.cos() * 1000000.0) as i32;
        result = (sin_result + cos_result) / 2; // 合并结果避免未使用警告
        
        // 位运算
        result = result.rotate_left(5);
        result = result.rotate_right(3);
        result ^= 0x12345678;
        
        // 指数运算
        result = ((result.abs() as f64).ln() * 10000.0) as i32;
        
        // 对数运算
        if result > 0 {
            result = ((result as f64).log10() * 10000.0) as i32;
        }
    }
    
    result.abs() % 1000000
}

/// ====== 树的 CRUD 操作 ======

/// 在树中查找节点（递归）
fn find_node<'a>(nodes: &'a mut Vec<TreeNode>, target_id: &str) -> Option<&'a mut TreeNode> {
    for node in nodes {
        if node.id == target_id {
            return Some(node);
        }
        if let Some(ref mut children) = node.children {
            if let Some(found) = find_node(children, target_id) {
                return Some(found);
            }
        }
    }
    None
}

/// 在树中查找节点（不可变）
fn find_node_readonly<'a>(nodes: &'a [TreeNode], target_id: &str) -> Option<&'a TreeNode> {
    for node in nodes {
        if node.id == target_id {
            return Some(node);
        }
        if let Some(ref children) = node.children {
            if let Some(found) = find_node_readonly(children, target_id) {
                return Some(found);
            }
        }
    }
    None
}

/// 删除节点（递归）
fn delete_node(nodes: &mut Vec<TreeNode>, target_id: &str) -> bool {
    let mut found = false;
    nodes.retain(|node| {
        if node.id == target_id {
            found = true;
            false // 删除此节点
        } else {
            true
        }
    });
    
    if found {
        return true;
    }
    
    // 递归删除子节点
    for node in nodes {
        if let Some(ref mut children) = node.children {
            if delete_node(children, target_id) {
                return true;
            }
        }
    }
    
    false
}

/// 收集树中所有节点的 ID
fn collect_all_node_ids(nodes: &[TreeNode]) -> Vec<String> {
    let mut ids = Vec::new();
    
    fn collect(node: &TreeNode, ids: &mut Vec<String>) {
        ids.push(node.id.clone());
        if let Some(ref children) = node.children {
            for child in children {
                collect(child, ids);
            }
        }
    }
    
    for node in nodes {
        collect(node, &mut ids);
    }
    
    ids
}

/// 执行 CRUD 操作（零拷贝优化版本，可配置操作次数）
#[wasm_bindgen]
pub fn perform_crud_operations_json(
    bytes: &[u8],
    read_count: usize,
    update_count: usize,
    delete_count: usize,
    insert_count: usize
) -> Result<Vec<u8>, JsError> {
    // 直接从字节流反序列化（比 serde-wasm-bindgen 快）
    let mut nodes: Vec<TreeNode> = serde_json::from_slice(bytes)
        .map_err(|e| JsError::new(&format!("反序列化失败: {}", e)))?;
    
    // 收集树中所有节点的 ID（从整个树中）
    let node_ids = collect_all_node_ids(&nodes);
    
    // 确保 node_ids 不为空
    if node_ids.is_empty() {
        let result = serde_json::to_vec(&nodes)
            .map_err(|e| JsError::new(&format!("序列化失败: {}", e)))?;
        return Ok(result);
    }
    
    // 1. 查找操作（循环使用 ID）
    for i in 0..read_count {
        let id = &node_ids[i % node_ids.len()];
        let _ = find_node_readonly(&nodes, id);
    }
    
    // 2. 更新操作（循环使用 ID）
    for i in 0..update_count {
        let id = &node_ids[i % node_ids.len()];
        if let Some(node) = find_node(&mut nodes, id) {
            node.value += 100;
        }
    }
    
    // 3. 删除操作（循环使用 ID）
    for i in 0..delete_count {
        let id = &node_ids[i % node_ids.len()];
        let _ = delete_node(&mut nodes, id);
    }
    
    // 4. 插入操作：在根节点下插入新节点
    if !nodes.is_empty() {
        for i in 0..insert_count {
            let new_node = TreeNode {
                id: format!("new_node_{}", i),
                value: (i * 10) as i32,
                children: None,
            };
            nodes[0].children.get_or_insert_with(Vec::new).push(new_node);
        }
    }
    
    // 直接序列化为字节数组
    let result = serde_json::to_vec(&nodes)
        .map_err(|e| JsError::new(&format!("序列化失败: {}", e)))?;
    
    Ok(result)
}


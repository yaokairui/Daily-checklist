const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testName) {
  if (condition) {
    passed++;
    results.push(`  ✓ ${testName}`);
  } else {
    failed++;
    results.push(`  ✗ ${testName}`);
  }
}

function assertEqual(actual, expected, testName) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    results.push(`  ✓ ${testName}`);
  } else {
    failed++;
    results.push(`  ✗ ${testName} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
  }
}

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checklist-test-'));
const dataDir = path.join(testDir, 'checklist-data');
const recycleBinDir = path.join(testDir, 'checklist-recycle-bin');
const templatesDir = path.join(dataDir, 'templates');
const configFile = path.join(testDir, 'config.json');

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(recycleBinDir, { recursive: true });
fs.mkdirSync(templatesDir, { recursive: true });

console.log('\n🧪 日常清单 - 单元测试\n');

results.push('--- 配置管理 ---');
{
  const defaultConfig = {
    windowBounds: { width: 900, height: 680 },
    theme: 'system',
    shortcutKey: 'CommandOrControl+Shift+N',
    alwaysOnTop: false,
    opacity: 1.0
  };

  fs.writeFileSync(configFile, JSON.stringify(defaultConfig), 'utf-8');
  const loaded = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  assertEqual(loaded.theme, 'system', '默认主题为 system');
  assertEqual(loaded.alwaysOnTop, false, '默认不置顶');
  assertEqual(loaded.opacity, 1.0, '默认透明度为 1.0');

  const updated = { ...defaultConfig, theme: 'dark', alwaysOnTop: true, opacity: 0.8 };
  fs.writeFileSync(configFile, JSON.stringify(updated), 'utf-8');
  const reloaded = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  assertEqual(reloaded.theme, 'dark', '主题更新为 dark');
  assertEqual(reloaded.alwaysOnTop, true, '置顶更新为 true');
  assertEqual(reloaded.opacity, 0.8, '透明度更新为 0.8');
}

results.push('\n--- 清单数据 CRUD ---');
{
  const checklistName = '2024-01-15';
  const checklistData = {
    title: '今日清单',
    date: checklistName,
    todos: [
      { id: 'abc123', text: '完成项目文档', completed: false, priority: 'high', reminder: null, createdAt: new Date().toISOString() },
      { id: 'def456', text: '代码审查', completed: true, priority: 'medium', reminder: null, createdAt: new Date().toISOString() },
      { id: 'ghi789', text: '团队会议', completed: false, priority: 'low', reminder: '2024-01-15T14:00:00', createdAt: new Date().toISOString() }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const filePath = path.join(dataDir, checklistName + '.json');
  fs.writeFileSync(filePath, JSON.stringify(checklistData, null, 2), 'utf-8');
  assert(fs.existsSync(filePath), '清单文件创建成功');

  const loaded = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  assertEqual(loaded.todos.length, 3, '清单包含 3 个事项');
  assertEqual(loaded.todos[0].priority, 'high', '第一个事项优先级为 high');
  assertEqual(loaded.todos[1].completed, true, '第二个事项已完成');
  assertEqual(loaded.todos[2].reminder, '2024-01-15T14:00:00', '第三个事项有提醒');

  loaded.todos.push({
    id: 'jkl012', text: '新事项', completed: false, priority: 'medium',
    reminder: null, createdAt: new Date().toISOString()
  });
  fs.writeFileSync(filePath, JSON.stringify(loaded, null, 2), 'utf-8');
  const reloaded = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  assertEqual(reloaded.todos.length, 4, '添加事项后数量为 4');

  reloaded.todos = reloaded.todos.filter(t => t.id !== 'def456');
  fs.writeFileSync(filePath, JSON.stringify(reloaded, null, 2), 'utf-8');
  const afterDelete = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  assertEqual(afterDelete.todos.length, 3, '删除事项后数量为 3');

  const todo = afterDelete.todos.find(t => t.id === 'abc123');
  todo.completed = true;
  todo.completedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(afterDelete, null, 2), 'utf-8');
  const afterToggle = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  assertEqual(afterToggle.todos.find(t => t.id === 'abc123').completed, true, '切换完成状态成功');
}

results.push('\n--- 清单列表 ---');
{
  const dates = ['2024-01-13', '2024-01-14', '2024-01-15'];
  dates.forEach(d => {
    fs.writeFileSync(path.join(dataDir, d + '.json'), JSON.stringify({ title: d, date: d, todos: [] }), 'utf-8');
  });
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && !f.endsWith('.meta.json'));
  const names = files.map(f => f.replace('.json', '')).sort();
  assertEqual(names, dates, '清单列表按日期排序正确');
}

results.push('\n--- 回收站功能 ---');
{
  const fileName = '2024-01-13.json';
  const srcPath = path.join(dataDir, fileName);
  const content = fs.readFileSync(srcPath, 'utf-8');
  const data = JSON.parse(content);

  const meta = {
    originalName: fileName.replace('.json', ''),
    deletedAt: new Date().toISOString(),
    originalData: data
  };

  const destPath = path.join(recycleBinDir, fileName);
  fs.writeFileSync(destPath, content, 'utf-8');
  const metaPath = path.join(recycleBinDir, fileName.replace('.json', '.meta.json'));
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  fs.unlinkSync(srcPath);

  assert(!fs.existsSync(srcPath), '原文件已删除');
  assert(fs.existsSync(destPath), '回收站中文件存在');
  assert(fs.existsSync(metaPath), '回收站中元数据存在');

  const metaLoaded = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  assertEqual(metaLoaded.originalName, '2024-01-13', '元数据中原始名称正确');
  assert(metaLoaded.deletedAt !== null, '元数据中删除时间存在');

  const binFiles = fs.readdirSync(recycleBinDir).filter(f => f.endsWith('.json') && !f.endsWith('.meta.json'));
  assertEqual(binFiles.length, 1, '回收站中有 1 个清单');

  const restoreContent = fs.readFileSync(destPath, 'utf-8');
  fs.writeFileSync(srcPath, restoreContent, 'utf-8');
  fs.unlinkSync(destPath);
  if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);

  assert(fs.existsSync(srcPath), '恢复后原文件存在');
  assert(!fs.existsSync(destPath), '恢复后回收站中文件已删除');
}

results.push('\n--- 永久删除 ---');
{
  const permFile = '2024-01-13.json';
  const permPath = path.join(recycleBinDir, permFile);
  const permMetaPath = path.join(recycleBinDir, permFile.replace('.json', '.meta.json'));

  fs.writeFileSync(permPath, '{}', 'utf-8');
  fs.writeFileSync(permMetaPath, '{}', 'utf-8');

  if (fs.existsSync(permPath)) fs.unlinkSync(permPath);
  if (fs.existsSync(permMetaPath)) fs.unlinkSync(permMetaPath);

  assert(!fs.existsSync(permPath), '永久删除后文件不存在');
  assert(!fs.existsSync(permMetaPath), '永久删除后元数据不存在');
}

results.push('\n--- 清空回收站 ---');
{
  ['2024-a.json', '2024-b.json'].forEach(f => {
    fs.writeFileSync(path.join(recycleBinDir, f), '{}', 'utf-8');
    fs.writeFileSync(path.join(recycleBinDir, f.replace('.json', '.meta.json')), '{}', 'utf-8');
  });

  const binFiles = fs.readdirSync(recycleBinDir);
  binFiles.forEach(f => {
    const fp = path.join(recycleBinDir, f);
    if (fs.statSync(fp).isFile()) fs.unlinkSync(fp);
  });

  const remaining = fs.readdirSync(recycleBinDir);
  assertEqual(remaining.length, 0, '清空回收站后无文件');
}

results.push('\n--- 模板功能 ---');
{
  const templateName = '工作日清单';
  const templateData = {
    name: templateName,
    todos: [
      { text: '晨会', priority: 'high' },
      { text: '代码开发', priority: 'medium' },
      { text: '日报', priority: 'low' }
    ],
    createdAt: new Date().toISOString()
  };

  const templatePath = path.join(templatesDir, templateName + '.json');
  fs.writeFileSync(templatePath, JSON.stringify(templateData, null, 2), 'utf-8');
  assert(fs.existsSync(templatePath), '模板文件创建成功');

  const loaded = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
  assertEqual(loaded.todos.length, 3, '模板包含 3 个事项');

  const templateFiles = fs.readdirSync(templatesDir).filter(f => f.endsWith('.json'));
  assertEqual(templateFiles.length, 1, '模板列表有 1 个模板');

  fs.unlinkSync(templatePath);
  assert(!fs.existsSync(templatePath), '模板删除成功');
}

results.push('\n--- 导出功能 ---');
{
  const data = {
    title: '今日清单',
    date: '2024-01-15',
    todos: [
      { text: '任务A', completed: true, priority: 'high', reminder: null },
      { text: '任务B', completed: false, priority: 'medium', reminder: null }
    ]
  };

  const jsonExport = JSON.stringify(data, null, 2);
  const parsed = JSON.parse(jsonExport);
  assertEqual(parsed.todos.length, 2, 'JSON 导出数据正确');

  let txtExport = `${data.title}\n${'='.repeat(40)}\n日期: ${data.date}\n\n`;
  const priorityMap = { high: '🔴 高', medium: '🟡 中', low: '🟢 低' };
  data.todos.forEach((todo, i) => {
    const check = todo.completed ? '✅' : '⬜';
    const priority = priorityMap[todo.priority] || '🟡 中';
    txtExport += `${check} ${i + 1}. ${todo.text} [${priority}]\n`;
  });
  assert(txtExport.includes('任务A'), 'TXT 导出包含任务A');
  assert(txtExport.includes('✅'), 'TXT 导出包含完成标记');
}

results.push('\n--- 优先级排序 ---');
{
  const todos = [
    { id: '1', text: '低', completed: false, priority: 'low' },
    { id: '2', text: '高', completed: false, priority: 'high' },
    { id: '3', text: '中', completed: false, priority: 'medium' },
    { id: '4', text: '已完成', completed: true, priority: 'high' }
  ];

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
  });

  assertEqual(sorted[0].text, '高', '未完成高优先级排第一');
  assertEqual(sorted[1].text, '中', '未完成中优先级排第二');
  assertEqual(sorted[2].text, '低', '未完成低优先级排第三');
  assertEqual(sorted[3].text, '已完成', '已完成事项排最后');
}

results.push('\n--- 完成率统计 ---');
{
  const todos = [
    { completed: true },
    { completed: true },
    { completed: false },
    { completed: false },
    { completed: false }
  ];
  const total = todos.length;
  const done = todos.filter(t => t.completed).length;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;
  assertEqual(total, 5, '总数为 5');
  assertEqual(done, 2, '已完成 2');
  assertEqual(rate, 40, '完成率 40%');
}

results.push('\n--- ID 生成 ---');
{
  const ids = new Set();
  for (let i = 0; i < 100; i++) {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    ids.add(id);
  }
  assertEqual(ids.size, 100, '100 次 ID 生成无重复');
}

results.push('\n--- 日期键生成 ---');
{
  const d = new Date(2024, 0, 15);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  assertEqual(key, '2024-01-15', '日期键格式正确');

  const d2 = new Date(2024, 10, 5);
  const key2 = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}-${String(d2.getDate()).padStart(2, '0')}`;
  assertEqual(key2, '2024-11-05', '日期键补零正确');
}

results.push('\n--- 透明度边界 ---');
{
  function clampOpacity(v) {
    return Math.max(0.3, Math.min(1.0, v));
  }
  assertEqual(clampOpacity(0.5), 0.5, '0.5 透明度不变');
  assertEqual(clampOpacity(0.1), 0.3, '低于 0.3 钳制为 0.3');
  assertEqual(clampOpacity(1.5), 1.0, '高于 1.0 钳制为 1.0');
  assertEqual(clampOpacity(0.3), 0.3, '0.3 边界值不变');
  assertEqual(clampOpacity(1.0), 1.0, '1.0 边界值不变');
}

results.push('\n--- HTML 转义 ---');
{
  function escapeHtml(text) {
    const div = { innerHTML: '', textContent: '' };
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
  assertEqual(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;', 'XSS 转义正确');
  assertEqual(escapeHtml('正常文本'), '正常文本', '正常文本不变');
}

fs.rmSync(testDir, { recursive: true, force: true });

console.log(results.join('\n'));
console.log(`\n${'═'.repeat(40)}`);
console.log(`测试结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 项`);
console.log(`${'═'.repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);

let currentChecklistName = null;
let currentChecklistData = null;
let autoSaveTimer = null;
let editingTodoId = null;
let confirmCallback = null;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

async function init() {
  await store.ready();
  await loadConfig();
  await refreshChecklistList();
  setupEventListeners();
  setupAutoSave();

  const isPinned = await api.getAlwaysOnTop();
  updatePinButton(isPinned);

  const checklists = await store.listChecklists();
  const todayKey = store._getDateKey();
  if (checklists.includes(todayKey)) {
    await openChecklist(todayKey);
  }

  api.onCreateNewChecklist(() => createNewChecklist());
  api.onReminderFired((id) => {
    if (currentChecklistData) {
      const todo = currentChecklistData.todos.find(t => t.id === id);
      if (todo) {
        todo.reminder = null;
        saveCurrentChecklist();
        renderTodoList();
      }
    }
  });
}

async function loadConfig() {
  const config = await api.getConfig();
  const themeSelect = document.getElementById('setting-theme');
  if (themeSelect) themeSelect.value = config.theme || 'system';
  const shortcutInput = document.getElementById('setting-shortcut');
  if (shortcutInput) shortcutInput.value = config.shortcutKey || 'Ctrl+Shift+N';
  const alwaysOnTopCheckbox = document.getElementById('setting-always-on-top');
  if (alwaysOnTopCheckbox) alwaysOnTopCheckbox.checked = config.alwaysOnTop || false;
  const opacitySlider = document.getElementById('setting-opacity');
  if (opacitySlider) {
    const op = Math.round((config.opacity || 1.0) * 100);
    opacitySlider.value = op;
    document.getElementById('opacity-value').textContent = op + '%';
  }
  applyTheme(config.theme || 'system');
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.setAttribute('data-theme', 'light');
    }
  }
}

function setupAutoSave() {
  if (autoSaveTimer) clearInterval(autoSaveTimer);
  autoSaveTimer = setInterval(() => {
    if (currentChecklistData) saveCurrentChecklist();
  }, 10000);
}

async function refreshChecklistList() {
  const checklists = await store.listChecklists();
  const listEl = document.getElementById('checklist-list');
  const sorted = checklists.sort().reverse();

  listEl.innerHTML = sorted.map(name => {
    const isActive = name === currentChecklistName;
    const dateLabel = formatDateLabel(name);
    return `<div class="checklist-item ${isActive ? 'active' : ''}" data-name="${name}">
      <span class="checklist-item-label">${dateLabel}</span>
      <button class="btn-icon btn-tiny btn-remove-checklist" data-name="${name}" title="删除">✕</button>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.checklist-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-remove-checklist')) return;
      openChecklist(el.dataset.name);
    });
  });

  listEl.querySelectorAll('.btn-remove-checklist').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteChecklist(btn.dataset.name);
    });
  });
}

function formatDateLabel(name) {
  const today = store._getDateKey();
  const yesterday = store._getDateKey(new Date(Date.now() - 86400000));
  if (name === today) return '📌 今天';
  if (name === yesterday) return '📌 昨天';
  return name;
}

async function createNewChecklist() {
  const { name, data, isNew } = await store.createTodayChecklist();
  currentChecklistName = name;
  currentChecklistData = data;
  await refreshChecklistList();
  showChecklistView();
  renderTodoList();
  if (isNew) {
    document.getElementById('checklist-title').focus();
  }
}

async function openChecklist(name) {
  const data = await store.loadChecklist(name);
  if (!data) return;
  currentChecklistName = name;
  currentChecklistData = data;
  await refreshChecklistList();
  showChecklistView();
  renderTodoList();
}

function showChecklistView() {
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('checklist-view').style.display = '';
  document.getElementById('checklist-title').textContent = currentChecklistData.title || '今日清单';
  updateStats();
}

function renderTodoList() {
  const listEl = document.getElementById('todo-list');
  if (!currentChecklistData) return;

  const todos = currentChecklistData.todos;
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
  });

  const priorityLabels = { high: '高', medium: '中', low: '低' };

  listEl.innerHTML = sorted.map(todo => {
    const priorityClass = `priority-${todo.priority || 'medium'}`;
    const completedClass = todo.completed ? 'completed' : '';
    const reminderText = todo.reminder
      ? `<span class="todo-reminder">⏰ ${new Date(todo.reminder).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>`
      : '';

    return `<div class="todo-item ${completedClass}" data-id="${todo.id}">
      <div class="todo-check" data-id="${todo.id}">
        ${todo.completed ? '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="var(--accent)"/><path d="M6 10l3 3 5-5" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" stroke="var(--border-color)" stroke-width="1.5" fill="none"/></svg>'}
      </div>
      <div class="todo-content">
        <span class="todo-text">${escapeHtml(todo.text)}</span>
        <div class="todo-meta">
          <span class="todo-priority ${priorityClass}">${priorityLabels[todo.priority || 'medium']}</span>
          ${reminderText}
        </div>
      </div>
      <div class="todo-actions">
        <button class="btn-icon btn-tiny btn-edit-todo" data-id="${todo.id}" title="编辑">✏️</button>
        <button class="btn-icon btn-tiny btn-delete-todo" data-id="${todo.id}" title="删除">🗑️</button>
      </div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.todo-check').forEach(el => {
    el.addEventListener('click', () => toggleTodo(el.dataset.id));
  });
  listEl.querySelectorAll('.btn-edit-todo').forEach(btn => {
    btn.addEventListener('click', () => openEditTodo(btn.dataset.id));
  });
  listEl.querySelectorAll('.btn-delete-todo').forEach(btn => {
    btn.addEventListener('click', () => deleteTodo(btn.dataset.id));
  });

  updateStats();
  setupReminders();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function addTodo() {
  const input = document.getElementById('new-todo-input');
  const prioritySelect = document.getElementById('new-todo-priority');
  const reminderInput = document.getElementById('new-todo-reminder');

  const text = input.value.trim();
  if (!text) return;

  const todo = {
    id: generateId(),
    text,
    completed: false,
    priority: prioritySelect.value,
    reminder: reminderInput.value || null,
    createdAt: new Date().toISOString()
  };

  currentChecklistData.todos.push(todo);
  input.value = '';
  reminderInput.value = '';
  prioritySelect.value = 'medium';
  renderTodoList();
  saveCurrentChecklist();
}

function toggleTodo(id) {
  const todo = currentChecklistData.todos.find(t => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    todo.completedAt = todo.completed ? new Date().toISOString() : null;
    renderTodoList();
    saveCurrentChecklist();
  }
}

function deleteTodo(id) {
  currentChecklistData.todos = currentChecklistData.todos.filter(t => t.id !== id);
  renderTodoList();
  saveCurrentChecklist();
}

function openEditTodo(id) {
  const todo = currentChecklistData.todos.find(t => t.id === id);
  if (!todo) return;

  editingTodoId = id;
  document.getElementById('edit-todo-text').value = todo.text;
  document.getElementById('edit-todo-priority').value = todo.priority || 'medium';
  document.getElementById('edit-todo-reminder').value = todo.reminder || '';
  showModal('modal-edit-todo');
}

function saveEditTodo() {
  const todo = currentChecklistData.todos.find(t => t.id === editingTodoId);
  if (!todo) return;

  const text = document.getElementById('edit-todo-text').value.trim();
  if (!text) return;

  todo.text = text;
  todo.priority = document.getElementById('edit-todo-priority').value;
  todo.reminder = document.getElementById('edit-todo-reminder').value || null;

  hideModal('modal-edit-todo');
  renderTodoList();
  saveCurrentChecklist();
}

async function deleteChecklist(name) {
  showConfirm('删除清单', `确定要将清单「${name}」移入回收站吗？`, async () => {
    const result = await api.moveToRecycleBin(name + '.json');
    if (result.success) {
      if (currentChecklistName === name) {
        currentChecklistName = null;
        currentChecklistData = null;
        document.getElementById('empty-state').style.display = '';
        document.getElementById('checklist-view').style.display = 'none';
      }
      await refreshChecklistList();
      showToast('已移入回收站');
    } else {
      showToast('删除失败: ' + (result.error || '未知错误'));
    }
  });
}

function updateStats() {
  if (!currentChecklistData) return;
  const todos = currentChecklistData.todos;
  const total = todos.length;
  const done = todos.filter(t => t.completed).length;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-done').textContent = done;
  document.getElementById('stat-rate').textContent = rate + '%';
  document.getElementById('progress-fill').style.width = rate + '%';
}

async function saveCurrentChecklist() {
  if (!currentChecklistName || !currentChecklistData) return;
  currentChecklistData.updatedAt = new Date().toISOString();
  currentChecklistData.title = document.getElementById('checklist-title').textContent.trim() || '今日清单';
  await store.saveChecklist(currentChecklistName, currentChecklistData);
}

function setupReminders() {
  if (currentChecklistData) {
    api.setupReminders(currentChecklistData.todos);
  }
}

async function exportChecklist(format) {
  if (!currentChecklistData) return;

  let content;
  let ext;
  if (format === 'json') {
    content = await store.exportAsJson(currentChecklistData);
    ext = 'json';
  } else {
    content = await store.exportAsTxt(currentChecklistData);
    ext = 'txt';
  }

  const result = await api.exportChecklist({
    content,
    format,
    defaultName: `${currentChecklistData.title || currentChecklistName}.${ext}`
  });

  if (result.success) {
    showToast('导出成功！');
  }
}

async function importChecklist() {
  const result = await api.importChecklist();
  if (!result) return;

  try {
    const data = JSON.parse(result.content);
    if (data.todos && Array.isArray(data.todos)) {
      const name = store._getDateKey();
      data.date = name;
      data.updatedAt = new Date().toISOString();
      await store.saveChecklist(name, data);
      currentChecklistName = name;
      currentChecklistData = data;
      await refreshChecklistList();
      showChecklistView();
      renderTodoList();
      showToast('导入成功！');
    } else {
      showToast('文件格式不正确');
    }
  } catch (e) {
    showToast('导入失败，请检查文件格式');
  }
}

async function saveAsTemplate() {
  if (!currentChecklistData) return;
  const nameInput = document.getElementById('template-name-input');
  const name = nameInput.value.trim();
  if (!name) {
    showToast('请输入模板名称');
    return;
  }
  await store.saveTemplate(name, currentChecklistData);
  nameInput.value = '';
  await refreshTemplateList();
  showToast('模板已保存');
}

async function refreshTemplateList() {
  const templates = await store.listTemplates();
  const listEl = document.getElementById('template-list');

  if (templates.length === 0) {
    listEl.innerHTML = '<p class="empty-hint">暂无模板，保存当前清单为模板以便复用</p>';
    return;
  }

  listEl.innerHTML = templates.map(name => {
    return `<div class="template-item">
      <span class="template-name">${escapeHtml(name)}</span>
      <div class="template-item-actions">
        <button class="btn-secondary btn-tiny btn-use-template" data-name="${name}">使用</button>
        <button class="btn-icon btn-tiny btn-delete-template" data-name="${name}" title="删除">🗑️</button>
      </div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.btn-use-template').forEach(btn => {
    btn.addEventListener('click', async () => {
      const template = await store.loadTemplate(btn.dataset.name);
      if (template && template.todos) {
        const name = store._getDateKey();
        let data = await store.loadChecklist(name);
        if (!data) {
          data = {
            title: '今日清单',
            date: name,
            todos: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        }
        template.todos.forEach(t => {
          data.todos.push({
            id: generateId(),
            text: t.text,
            completed: false,
            priority: t.priority || 'medium',
            reminder: null,
            createdAt: new Date().toISOString()
          });
        });
        await store.saveChecklist(name, data);
        currentChecklistName = name;
        currentChecklistData = data;
        await refreshChecklistList();
        showChecklistView();
        renderTodoList();
        hideModal('modal-templates');
        showToast('模板已应用');
      }
    });
  });

  listEl.querySelectorAll('.btn-delete-template').forEach(btn => {
    btn.addEventListener('click', async () => {
      await store.deleteTemplate(btn.dataset.name);
      await refreshTemplateList();
    });
  });
}

async function refreshRecycleBin() {
  const items = await api.listRecycleBin();
  const listEl = document.getElementById('recycle-bin-list');
  const hintEl = document.getElementById('recycle-bin-hint');
  const emptyBinBtn = document.getElementById('btn-empty-bin');

  if (items.length === 0) {
    hintEl.textContent = '暂无已删除的清单';
    hintEl.style.display = '';
    emptyBinBtn.style.display = 'none';
    listEl.innerHTML = '';
    return;
  }

  hintEl.textContent = `${items.length} 个已删除的清单`;
  emptyBinBtn.style.display = '';

  listEl.innerHTML = items.map(item => {
    const deletedDate = item.deletedAt
      ? new Date(item.deletedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '未知';
    const title = item.originalData?.title || item.name;
    return `<div class="recycle-bin-item">
      <div class="recycle-bin-info">
        <span class="recycle-bin-name">${escapeHtml(title)}</span>
        <span class="recycle-bin-date">删除于 ${deletedDate}</span>
      </div>
      <div class="recycle-bin-actions">
        <button class="btn-secondary btn-tiny btn-restore" data-name="${item.fileName}">恢复</button>
        <button class="btn-icon btn-tiny btn-perm-delete" data-name="${item.fileName}" title="永久删除">🗑️</button>
      </div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.btn-restore').forEach(btn => {
    btn.addEventListener('click', async () => {
      const result = await api.restoreFromRecycleBin(btn.dataset.name);
      if (result.success) {
        await refreshRecycleBin();
        await refreshChecklistList();
        showToast('已恢复');
      } else {
        showToast('恢复失败: ' + (result.error || ''));
      }
    });
  });

  listEl.querySelectorAll('.btn-perm-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      showConfirm('永久删除', '确定要永久删除此清单吗？此操作不可恢复。', async () => {
        const result = await api.permanentlyDelete(btn.dataset.name);
        if (result.success) {
          await refreshRecycleBin();
          showToast('已永久删除');
        } else {
          showToast('删除失败: ' + (result.error || ''));
        }
      });
    });
  });
}

function updatePinButton(pinned) {
  const btn = document.getElementById('btn-pin');
  if (pinned) {
    btn.classList.add('active');
    btn.title = '取消置顶';
  } else {
    btn.classList.remove('active');
    btn.title = '置顶窗口';
  }
}

function showModal(id) {
  document.getElementById(id).style.display = 'flex';
}

function hideModal(id) {
  document.getElementById(id).style.display = 'none';
}

function showConfirm(title, message, callback) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  confirmCallback = callback;
  showModal('modal-confirm');
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function setupEventListeners() {
  document.getElementById('btn-new-checklist').addEventListener('click', () => createNewChecklist());
  document.getElementById('btn-empty-create').addEventListener('click', () => createNewChecklist());
  document.getElementById('btn-add-todo').addEventListener('click', () => addTodo());

  document.getElementById('new-todo-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTodo();
  });

  document.getElementById('checklist-title').addEventListener('blur', () => {
    if (currentChecklistData) {
      currentChecklistData.title = document.getElementById('checklist-title').textContent.trim() || '今日清单';
      saveCurrentChecklist();
    }
  });

  document.getElementById('checklist-title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('checklist-title').blur();
    }
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    const format = confirm('点击"确定"导出为 JSON 格式，"取消"导出为 TXT 格式') ? 'json' : 'txt';
    exportChecklist(format);
  });

  document.getElementById('btn-delete-checklist').addEventListener('click', () => {
    if (currentChecklistName) deleteChecklist(currentChecklistName);
  });

  document.getElementById('btn-save-edit').addEventListener('click', () => saveEditTodo());

  document.getElementById('btn-pin').addEventListener('click', async () => {
    const current = await api.getAlwaysOnTop();
    const newState = !current;
    await api.toggleAlwaysOnTop(newState);
    updatePinButton(newState);
    document.getElementById('setting-always-on-top').checked = newState;
  });

  document.getElementById('btn-recycle-bin').addEventListener('click', async () => {
    await refreshRecycleBin();
    showModal('modal-recycle-bin');
  });

  document.getElementById('btn-empty-bin').addEventListener('click', () => {
    showConfirm('清空回收站', '确定要永久删除回收站中的所有清单吗？此操作不可恢复。', async () => {
      const result = await api.emptyRecycleBin();
      if (result.success) {
        await refreshRecycleBin();
        showToast(`已清空回收站 (${result.count} 项)`);
      } else {
        showToast('清空失败');
      }
    });
  });

  document.getElementById('btn-templates').addEventListener('click', async () => {
    await refreshTemplateList();
    showModal('modal-templates');
  });

  document.getElementById('btn-save-template').addEventListener('click', () => saveAsTemplate());

  document.getElementById('btn-settings').addEventListener('click', async () => {
    const dir = await api.getDataDir();
    document.getElementById('setting-data-dir').textContent = dir;
    showModal('modal-settings');
  });

  document.getElementById('setting-theme').addEventListener('change', async (e) => {
    const theme = e.target.value;
    applyTheme(theme);
    const config = await api.getConfig();
    config.theme = theme;
    await api.saveConfig(config);
  });

  document.getElementById('setting-always-on-top').addEventListener('change', async (e) => {
    const pinned = e.target.checked;
    await api.toggleAlwaysOnTop(pinned);
    updatePinButton(pinned);
  });

  document.getElementById('setting-opacity').addEventListener('input', async (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('opacity-value').textContent = val + '%';
    await api.setOpacity(val / 100);
  });

  document.getElementById('btn-update-shortcut').addEventListener('click', async () => {
    const key = document.getElementById('setting-shortcut').value.trim();
    if (!key) return;
    const success = await api.updateShortcut(key);
    if (success) {
      showToast('快捷键已更新');
    } else {
      showToast('快捷键设置失败，请尝试其他组合');
    }
  });

  document.getElementById('btn-import').addEventListener('click', () => importChecklist());

  document.getElementById('btn-open-data-dir').addEventListener('click', async () => {
    const dir = await api.getDataDir();
    api.showItemInFolder(dir);
  });

  document.getElementById('btn-confirm-ok').addEventListener('click', () => {
    hideModal('modal-confirm');
    if (confirmCallback) {
      confirmCallback();
      confirmCallback = null;
    }
  });

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.modal;
      hideModal(modalId);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.style.display = 'none';
      }
    });
  });

  document.getElementById('checklist-list').addEventListener('dblclick', (e) => {
    if (e.target === document.getElementById('checklist-list') || e.target.classList.contains('sidebar-list')) {
      createNewChecklist();
    }
  });

  window.addEventListener('beforeunload', () => {
    if (currentChecklistData) {
      saveCurrentChecklist();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    }
  });
}

init();

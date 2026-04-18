let currentChecklistName = null;
let currentChecklistData = null;
let autoSaveTimer = null;
let editingTodoId = null;
let confirmCallback = null;
let currentTheme = 'system';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

async function init() {
  await store.ready();
  await loadConfig();
  setupEventListeners();
  setupAutoSave();

  const isPinned = await api.getAlwaysOnTop();
  updatePinButton(isPinned);

  const opacity = await api.getOpacity();
  const slider = document.getElementById('opacity-slider');
  slider.value = Math.round(opacity * 100);
  document.getElementById('opacity-label').textContent = Math.round(opacity * 100) + '%';

  const checklists = await store.listChecklists();
  const todayKey = store._getDateKey();
  if (checklists.includes(todayKey)) {
    await openChecklist(todayKey);
  } else {
    await createNewChecklist();
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
  currentTheme = config.theme || 'system';
  applyTheme(currentTheme);
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

function cycleTheme() {
  const themes = ['light', 'dark', 'system'];
  const idx = themes.indexOf(currentTheme);
  currentTheme = themes[(idx + 1) % themes.length];
  applyTheme(currentTheme);
  const labels = { light: '浅色', dark: '深色', system: '跟随系统' };
  showToast('主题: ' + labels[currentTheme]);
  api.saveConfig({ theme: currentTheme });
}

function setupAutoSave() {
  if (autoSaveTimer) clearInterval(autoSaveTimer);
  autoSaveTimer = setInterval(() => {
    if (currentChecklistData) saveCurrentChecklist();
  }, 10000);
}

async function createNewChecklist() {
  const { name, data } = await store.createTodayChecklist();
  currentChecklistName = name;
  currentChecklistData = data;
  showChecklistView();
  renderTodoList();
}

async function openChecklist(name) {
  const data = await store.loadChecklist(name);
  if (!data) return;
  currentChecklistName = name;
  currentChecklistData = data;
  showChecklistView();
  renderTodoList();
}

function showChecklistView() {
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
        ${todo.completed ? '<svg width="14" height="14" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="var(--accent)"/><path d="M6 10l3 3 5-5" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '<svg width="14" height="14" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" stroke="var(--border)" stroke-width="1.5" fill="none"/></svg>'}
      </div>
      <div class="todo-content">
        <span class="todo-text">${escapeHtml(todo.text)}</span>
        <div class="todo-meta">
          <span class="todo-priority ${priorityClass}">${priorityLabels[todo.priority || 'medium']}</span>
          ${reminderText}
        </div>
      </div>
      <div class="todo-actions">
        <button class="icon-btn" data-action="edit" data-id="${todo.id}" title="编辑" style="font-size:11px;">✏️</button>
        <button class="icon-btn" data-action="delete" data-id="${todo.id}" title="删除" style="font-size:11px;">🗑️</button>
      </div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.todo-check').forEach(el => {
    el.addEventListener('click', () => toggleTodo(el.dataset.id));
  });
  listEl.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => openEditTodo(btn.dataset.id));
  });
  listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
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
  const text = input.value.trim();
  if (!text) return;

  const todo = {
    id: generateId(),
    text,
    completed: false,
    priority: 'medium',
    reminder: null,
    createdAt: new Date().toISOString()
  };

  currentChecklistData.todos.push(todo);
  input.value = '';
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
  showConfirm('删除清单', '确定将清单移入回收站吗？', async () => {
    const result = await api.moveToRecycleBin(name + '.json');
    if (result.success) {
      currentChecklistName = null;
      currentChecklistData = null;
      await createNewChecklist();
      showToast('已移入回收站');
    } else {
      showToast('删除失败');
    }
  });
}

function updateStats() {
  if (!currentChecklistData) return;
  const todos = currentChecklistData.todos;
  const total = todos.length;
  const done = todos.filter(t => t.completed).length;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById('progress-text').textContent = `${done}/${total}`;
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
    listEl.innerHTML = '<p style="font-size:11px;color:var(--text-muted);">暂无模板</p>';
    return;
  }

  listEl.innerHTML = templates.map(name => {
    return `<div class="template-item">
      <span class="template-name">${escapeHtml(name)}</span>
      <div class="template-actions">
        <button class="text-btn" data-use="${escapeHtml(name)}">使用</button>
        <button class="icon-btn" data-del-template="${escapeHtml(name)}" title="删除" style="font-size:11px;">🗑️</button>
      </div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('[data-use]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const template = await store.loadTemplate(btn.dataset.use);
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
        showChecklistView();
        renderTodoList();
        hideModal('modal-templates');
        showToast('模板已应用');
      }
    });
  });

  listEl.querySelectorAll('[data-del-template]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await store.deleteTemplate(btn.dataset.delTemplate);
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
    emptyBinBtn.style.display = 'none';
    listEl.innerHTML = '';
    return;
  }

  hintEl.textContent = `${items.length} 个清单`;
  emptyBinBtn.style.display = '';

  listEl.innerHTML = items.map(item => {
    const deletedDate = item.deletedAt
      ? new Date(item.deletedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    const title = item.originalData?.title || item.name;
    return `<div class="recycle-item">
      <div class="recycle-info">
        <span class="recycle-name">${escapeHtml(title)}</span>
        <span class="recycle-date">${deletedDate}</span>
      </div>
      <div class="recycle-actions">
        <button class="text-btn" data-restore="${item.fileName}">恢复</button>
        <button class="icon-btn" data-perm-del="${item.fileName}" title="永久删除" style="font-size:11px;">🗑️</button>
      </div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('[data-restore]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const result = await api.restoreFromRecycleBin(btn.dataset.restore);
      if (result.success) {
        await refreshRecycleBin();
        showToast('已恢复');
      } else {
        showToast('恢复失败');
      }
    });
  });

  listEl.querySelectorAll('[data-perm-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      showConfirm('永久删除', '确定要永久删除吗？此操作不可恢复。', async () => {
        const result = await api.permanentlyDelete(btn.dataset.permDel);
        if (result.success) {
          await refreshRecycleBin();
          showToast('已永久删除');
        }
      });
    });
  });
}

async function refreshHistoryList() {
  const checklists = await store.listChecklists();
  const listEl = document.getElementById('history-list');
  const sorted = checklists.sort().reverse();

  if (sorted.length === 0) {
    listEl.innerHTML = '<p style="font-size:11px;color:var(--text-muted);">暂无清单</p>';
    return;
  }

  listEl.innerHTML = sorted.map(name => {
    const isActive = name === currentChecklistName;
    const dateLabel = formatDateLabel(name);
    return `<div class="history-item ${isActive ? 'active' : ''}" data-name="${name}">
      <span class="history-item-name">${dateLabel}</span>
      <span class="history-item-del" data-del="${name}">✕</span>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('history-item-del')) return;
      openChecklist(el.dataset.name);
      hideModal('modal-history');
    });
  });

  listEl.querySelectorAll('.history-item-del').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteChecklist(el.dataset.del);
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

function updatePinButton(pinned) {
  const btn = document.getElementById('btn-pin');
  if (pinned) {
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
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

function toggleMoreMenu() {
  const menu = document.getElementById('more-menu');
  if (menu.style.display === 'none') {
    menu.style.display = '';
  } else {
    menu.style.display = 'none';
  }
}

function toggleOpacityBar() {
  const bar = document.getElementById('opacity-bar');
  if (bar.style.display === 'none') {
    bar.style.display = '';
  } else {
    bar.style.display = 'none';
  }
}

function setupEventListeners() {
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

  document.getElementById('btn-pin').addEventListener('click', async () => {
    const current = await api.getAlwaysOnTop();
    const newState = !current;
    await api.toggleAlwaysOnTop(newState);
    updatePinButton(newState);
  });

  document.getElementById('btn-opacity').addEventListener('click', () => toggleOpacityBar());

  document.getElementById('opacity-slider').addEventListener('input', async (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('opacity-label').textContent = val + '%';
    await api.setOpacity(val / 100);
  });

  document.getElementById('btn-more').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMoreMenu();
  });

  document.addEventListener('click', (e) => {
    const menu = document.getElementById('more-menu');
    if (menu.style.display !== 'none' && !e.target.closest('#more-menu') && !e.target.closest('#btn-more')) {
      menu.style.display = 'none';
    }
  });

  document.getElementById('btn-new-checklist').addEventListener('click', () => {
    toggleMoreMenu();
    createNewChecklist();
  });

  document.getElementById('btn-history').addEventListener('click', async () => {
    toggleMoreMenu();
    await refreshHistoryList();
    showModal('modal-history');
  });

  document.getElementById('btn-templates').addEventListener('click', async () => {
    toggleMoreMenu();
    await refreshTemplateList();
    showModal('modal-templates');
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    toggleMoreMenu();
    exportChecklist('json');
  });

  document.getElementById('btn-recycle-bin').addEventListener('click', async () => {
    toggleMoreMenu();
    await refreshRecycleBin();
    showModal('modal-recycle-bin');
  });

  document.getElementById('btn-theme').addEventListener('click', () => {
    toggleMoreMenu();
    cycleTheme();
  });

  document.getElementById('btn-delete-checklist').addEventListener('click', () => {
    toggleMoreMenu();
    if (currentChecklistName) deleteChecklist(currentChecklistName);
  });

  document.getElementById('btn-save-edit').addEventListener('click', () => saveEditTodo());

  document.getElementById('btn-save-template').addEventListener('click', () => saveAsTemplate());

  document.getElementById('btn-empty-bin').addEventListener('click', () => {
    showConfirm('清空回收站', '确定永久删除所有清单吗？', async () => {
      const result = await api.emptyRecycleBin();
      if (result.success) {
        await refreshRecycleBin();
        showToast(`已清空 (${result.count} 项)`);
      }
    });
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
      hideModal(btn.dataset.modal);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.style.display = 'none';
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', init);

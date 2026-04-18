class Store {
  constructor() {
    this.dataDir = null;
    this.templatesDir = null;
    this._initPromise = this._init();
  }

  async _init() {
    this.dataDir = await api.getDataDir();
    this.templatesDir = this.dataDir + '/templates';
  }

  async ready() {
    await this._initPromise;
  }

  _getDateKey(date) {
    const d = date || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async getChecklistFilePath(name) {
    await this.ready();
    return `${this.dataDir}/${name}.json`;
  }

  async saveChecklist(name, data) {
    await this.ready();
    const filePath = `${this.dataDir}/${name}.json`;
    return api.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async loadChecklist(name) {
    await this.ready();
    const filePath = `${this.dataDir}/${name}.json`;
    const content = await api.readFile(filePath);
    if (content) {
      try {
        return JSON.parse(content);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  async listChecklists() {
    await this.ready();
    const files = await api.listFiles(this.dataDir);
    return files.map(f => f.replace('.json', ''));
  }

  async deleteChecklist(name) {
    await this.ready();
    const filePath = `${this.dataDir}/${name}.json`;
    return api.deleteFile(filePath);
  }

  async createTodayChecklist() {
    const name = this._getDateKey();
    const existing = await this.loadChecklist(name);
    if (existing) return { name, data: existing, isNew: false };

    const data = {
      title: '今日清单',
      date: name,
      todos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await this.saveChecklist(name, data);
    return { name, data, isNew: true };
  }

  async saveTemplate(name, data) {
    await this.ready();
    const filePath = `${this.templatesDir}/${name}.json`;
    const templateData = {
      name,
      todos: data.todos.map(t => ({
        text: t.text,
        priority: t.priority
      })),
      createdAt: new Date().toISOString()
    };
    return api.writeFile(filePath, JSON.stringify(templateData, null, 2));
  }

  async loadTemplate(name) {
    await this.ready();
    const filePath = `${this.templatesDir}/${name}.json`;
    const content = await api.readFile(filePath);
    if (content) {
      try {
        return JSON.parse(content);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  async listTemplates() {
    await this.ready();
    const files = await api.listFiles(this.templatesDir);
    return files.map(f => f.replace('.json', ''));
  }

  async deleteTemplate(name) {
    await this.ready();
    const filePath = `${this.templatesDir}/${name}.json`;
    return api.deleteFile(filePath);
  }

  async exportAsTxt(data) {
    let text = `${data.title}\n`;
    text += `${'='.repeat(40)}\n`;
    text += `日期: ${data.date}\n\n`;

    const priorityMap = { high: '🔴 高', medium: '🟡 中', low: '🟢 低' };

    data.todos.forEach((todo, i) => {
      const check = todo.completed ? '✅' : '⬜';
      const priority = priorityMap[todo.priority] || '🟡 中';
      text += `${check} ${i + 1}. ${todo.text} [${priority}]`;
      if (todo.reminder) {
        text += ` ⏰ ${new Date(todo.reminder).toLocaleString('zh-CN')}`;
      }
      text += '\n';
    });

    const total = data.todos.length;
    const done = data.todos.filter(t => t.completed).length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    text += `\n${'─'.repeat(40)}\n`;
    text += `总计: ${total} | 已完成: ${done} | 完成率: ${rate}%\n`;

    return text;
  }

  async exportAsJson(data) {
    return JSON.stringify(data, null, 2);
  }
}

window.store = new Store();

'use strict';

const STORAGE_KEY = 'dashboard_tareas_v2';
const STATUSES = ['Pendiente', 'En proceso', 'Finalizada', 'Cancelada'];
const PRIORITIES = ['Alta', 'Media', 'Baja'];
const $ = (id) => document.getElementById(id);

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter(t => t && typeof t.id === 'string' &&
      typeof t.description === 'string' && STATUSES.includes(t.status) &&
      PRIORITIES.includes(t.priority) &&
      (t.dueDate === '' || /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate)));
  } catch (error) {
    console.error('No se pudieron leer las tareas:', error);
    return [];
  }
}

let tasks = loadTasks();
let editingId = null;

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (error) {
    console.error('Error al guardar:', error);
    alert('No se pudieron guardar los cambios en localStorage.');
    return false;
  }
}

function updateTasks(nextTasks) {
  const previous = tasks;
  tasks = nextTasks;
  if (!persist()) {
    tasks = previous;
    return false;
  }
  render();
  return true;
}

function resetForm() {
  editingId = null;
  $('taskForm').reset();
  $('formTitle').textContent = 'Nueva tarea';
  $('saveButton').textContent = 'Agregar tarea';
  $('cancelEdit').hidden = true;
}

$('taskForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const description = $('description').value.trim();
  if (!description) {
    alert('Escribe una descripción.');
    $('description').focus();
    return;
  }

  const data = {
    description,
    status: $('status').value,
    priority: $('priority').value,
    dueDate: $('dueDate').value
  };

  if (editingId !== null) {
    if (!tasks.some(task => task.id === editingId)) {
      alert('La tarea ya no existe.');
      resetForm();
      return;
    }
    if (updateTasks(tasks.map(task => task.id === editingId ? {...task, ...data} : task))) resetForm();
  } else {
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    if (updateTasks([{id, ...data, createdAt: new Date().toISOString()}, ...tasks])) resetForm();
  }
});

$('cancelEdit').addEventListener('click', resetForm);
$('searchInput').addEventListener('input', render);
$('statusFilter').addEventListener('change', render);
$('priorityFilter').addEventListener('change', render);

function formatDate(iso) {
  if (!iso) return 'Sin vencimiento';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function isOverdue(task) {
  if (!task.dueDate || ['Finalizada', 'Cancelada'].includes(task.status)) return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  return task.dueDate < today;
}

function renderSummary() {
  const counts = Object.fromEntries(STATUSES.map(status => [status, tasks.filter(t => t.status === status).length]));
  $('totalCount').textContent = tasks.length;
  $('pendingCount').textContent = counts.Pendiente;
  $('progressCount').textContent = counts['En proceso'];
  $('completedCount').textContent = counts.Finalizada;
  $('cancelledCount').textContent = counts.Cancelada;
  const eligible = tasks.length - counts.Cancelada;
  const percent = eligible ? Math.round((counts.Finalizada / eligible) * 100) : 0;
  $('completionText').textContent = `${percent}%`;
  $('completionFill').style.width = `${percent}%`;
  $('completionBar').setAttribute('aria-valuenow', String(percent));
}

function makePill(label, cssClass) {
  const span = document.createElement('span');
  span.className = `pill ${cssClass}`;
  span.textContent = label;
  return span;
}

function render() {
  renderSummary();
  const query = $('searchInput').value.trim().toLocaleLowerCase('es');
  const status = $('statusFilter').value;
  const priority = $('priorityFilter').value;
  const visible = tasks.filter(task =>
    task.description.toLocaleLowerCase('es').includes(query) &&
    (!status || task.status === status) &&
    (!priority || task.priority === priority)
  );

  const list = $('taskList');
  list.replaceChildren();
  $('resultCount').textContent = `${visible.length} resultado${visible.length === 1 ? '' : 's'}`;
  $('emptyMessage').hidden = visible.length > 0;

  for (const task of visible) {
    const article = document.createElement('article');
    article.className = 'task';
    const content = document.createElement('div');
    content.className = 'task-content';
    const description = document.createElement('p');
    description.className = 'task-description';
    description.textContent = task.description; // Evita inyectar HTML de usuarios
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.append(
      makePill(task.status, `status-${task.status.toLowerCase().replaceAll(' ', '-')}`),
      makePill(`Prioridad ${task.priority}`, `priority-${task.priority.toLowerCase()}`)
    );
    const due = document.createElement('span');
    due.className = `due${isOverdue(task) ? ' overdue' : ''}`;
    due.textContent = `Vence: ${formatDate(task.dueDate)}${isOverdue(task) ? ' · VENCIDA' : ''}`;
    meta.append(due);
    content.append(description, meta);

    const buttons = document.createElement('div');
    buttons.className = 'task-buttons';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'btn secondary';
    edit.textContent = 'Editar';
    edit.addEventListener('click', () => editTask(task.id));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn danger';
    remove.textContent = 'Eliminar';
    remove.addEventListener('click', () => deleteTask(task.id));
    buttons.append(edit, remove);
    article.append(content, buttons);
    list.append(article);
  }
}

function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  editingId = id;
  $('description').value = task.description;
  $('status').value = task.status;
  $('priority').value = task.priority;
  $('dueDate').value = task.dueDate;
  $('formTitle').textContent = 'Editar tarea';
  $('saveButton').textContent = 'Guardar cambios';
  $('cancelEdit').hidden = false;
  $('description').focus();
  $('taskForm').scrollIntoView({behavior:'smooth', block:'center'});
}

function deleteTask(id) {
  if (!confirm('¿Seguro que deseas eliminar esta tarea?')) return;
  if (updateTasks(tasks.filter(t => t.id !== id)) && editingId === id) resetForm();
}

render();

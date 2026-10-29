import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { PRE_TRIP_ITEMS, TASK_STATUSES } from './maintenanceData'

const CATEGORIES = ['Batería', 'Neumáticos', 'Frenos', 'Eléctrico', 'Seguridad', 'General']
const PRIORITIES = ['Baja', 'Media', 'Alta']
const STORAGE_KEYS = {
  tasks: 'autodash-maintenance-tasks',
  review: 'autodash-pretrip-current',
  reviews: 'autodash-pretrip-history',
  activity: 'autodash-maintenance-activity',
}
const readStoredValue = (key, fallback) => {
  try {
    const storedValue = localStorage.getItem(key)
    return storedValue ? JSON.parse(storedValue) : fallback
  } catch {
    return fallback
  }
}
const createId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
const createReview = () => ({
  id: createId(),
  createdAt: new Date().toISOString(),
  items: Object.fromEntries(PRE_TRIP_ITEMS.map((item) => [item.id, false])),
})
const formatDate = (value) => {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(date)
}
const reviewProgress = (review) => {
  const checked = Object.values(review?.items || {}).filter(Boolean).length
  return { checked, total: PRE_TRIP_ITEMS.length, percent: Math.round((checked / PRE_TRIP_ITEMS.length) * 100) }
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="maintenance-heading">
      <div>
        <p className="maintenance-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

function TaskForm({ task, onCancel, onSubmit }) {
  const [form, setForm] = useState(() => ({
    name: task?.name || '', description: task?.description || '', category: task?.category || CATEGORIES[0],
    priority: task?.priority || 'Media', createdAt: task?.createdAt || new Date().toISOString().slice(0, 10),
    observations: task?.observations || '',
  }))
  const [validationMessage, setValidationMessage] = useState('')
  const update = (key, value) => setForm((previous) => ({ ...previous, [key]: value }))
  const submit = (event) => {
    event.preventDefault()
    if (!form.name.trim() || !form.description.trim()) {
      setValidationMessage('Escribe el nombre y la descripción de la tarea.')
      return
    }
    onSubmit({ ...form, name: form.name.trim(), description: form.description.trim() })
  }

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <form className="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-form-title" onSubmit={submit}>
        <div className="modal-heading"><div><p className="maintenance-eyebrow">Registro de mantenimiento</p><h3 id="task-form-title">{task ? 'Editar tarea' : 'Nueva tarea'}</h3></div><button type="button" className="icon-button" aria-label="Cerrar formulario" onClick={onCancel}>×</button></div>
        <label className="field-label">Nombre<input autoFocus required maxLength={90} value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Ej. Revisar freno delantero" /></label>
        <label className="field-label">Descripción<textarea required rows="2" maxLength={400} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Detalles del trabajo a realizar" /></label>
        <div className="form-two-columns"><label className="field-label">Categoría<select value={form.category} onChange={(event) => update('category', event.target.value)}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label className="field-label">Prioridad<select value={form.priority} onChange={(event) => update('priority', event.target.value)}>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></label></div>
        <label className="field-label">Fecha de registro<input required type="date" value={form.createdAt} onChange={(event) => update('createdAt', event.target.value)} /></label>
        <label className="field-label">Observaciones <span className="optional-label">Opcional</span><textarea rows="2" maxLength={400} value={form.observations} onChange={(event) => update('observations', event.target.value)} placeholder="Notas adicionales" /></label>
        {validationMessage && <p className="form-validation-message" role="alert">{validationMessage}</p>}
        <div className="modal-actions"><button type="button" className="secondary-action" onClick={onCancel}>Cancelar</button><button type="submit" className="primary-action">{task ? 'Guardar cambios' : 'Agregar tarea'}</button></div>
      </form>
    </div>,
    document.body,
  )
}

function MaintenanceBoard({ tasks, onSaveTask, onMoveTask, onDeleteTask, onNotify }) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('Todas')
  const [priorityFilter, setPriorityFilter] = useState('Todas')
  const [statusFilter, setStatusFilter] = useState('Todas')
  const [editingTask, setEditingTask] = useState(null)
  const [isAdding, setIsAdding] = useState(false)
  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const query = search.trim().toLocaleLowerCase('es-MX')
    const matchesText = !query || [task.name, task.description, task.category, task.observations].some((value) => value?.toLocaleLowerCase('es-MX').includes(query))
    return matchesText && (categoryFilter === 'Todas' || task.category === categoryFilter) && (priorityFilter === 'Todas' || task.priority === priorityFilter) && (statusFilter === 'Todas' || task.status === statusFilter)
  }), [tasks, search, categoryFilter, priorityFilter, statusFilter])
  const counts = TASK_STATUSES.map((status) => ({ ...status, count: tasks.filter((task) => task.status === status.id).length }))
  const save = (form) => {
    onSaveTask(editingTask?.id, form)
    setEditingTask(null)
    setIsAdding(false)
    onNotify(editingTask ? 'Tarea actualizada.' : 'Tarea agregada.', 'success')
  }

  return (
    <div className="maintenance-page">
      <PageHeading eyebrow="Plan de servicio" title="Tablero de mantenimiento" description="Organiza las revisiones y da seguimiento a cada trabajo." action={<button className="primary-action" type="button" onClick={() => setIsAdding(true)}>＋ Nueva tarea</button>} />
      <div className="maintenance-stat-strip">{counts.map((item) => <div className={`maintenance-stat stat-${item.color}`} key={item.id}><span>{item.label}</span><strong>{item.count}</strong></div>)}</div>
      <div className="board-toolbar"><label className="search-control"><span aria-hidden="true">⌕</span><input aria-label="Buscar tareas" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, categoría o nota" /></label><label className="filter-control"><span>Categoría</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>Todas</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label className="filter-control"><span>Prioridad</span><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option>Todas</option>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></label><label className="filter-control"><span>Estado</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="Todas">Todos</option>{TASK_STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label><span className="result-count">{filteredTasks.length} {filteredTasks.length === 1 ? 'tarea' : 'tareas'}</span></div>
      <div className="kanban-workspace">{TASK_STATUSES.map((status) => {
        const columnTasks = filteredTasks.filter((task) => task.status === status.id)
        return <section className={`kanban-lane lane-${status.color}`} key={status.id} aria-label={`${status.label}, ${columnTasks.length} tareas`}><div className="lane-heading"><div><span className="lane-dot" /><h3>{status.label}</h3></div><span className="lane-count">{columnTasks.length}</span></div><div className="lane-content">{columnTasks.map((task) => {
          const taskIndex = TASK_STATUSES.findIndex((item) => item.id === task.status)
          return <article className="maintenance-task-card" key={task.id}><div className="task-card-top"><span className={`task-category category-${task.category.toLowerCase().replaceAll(' ', '-')}`}>{task.category}</span><button className="icon-button quiet-icon" type="button" title="Editar tarea" aria-label={`Editar ${task.name}`} onClick={() => setEditingTask(task)}>···</button></div><h4>{task.name}</h4>{task.description && <p className="task-description">{task.description}</p>}<div className="task-card-meta"><span className={`priority-label priority-${task.priority.toLowerCase()}`}><i />{task.priority}</span><span>Registrada {formatDate(task.createdAt)}</span></div>{task.observations && <p className="task-observation"><strong>Nota</strong> {task.observations}</p>}<div className="task-card-actions"><button type="button" className="task-edit-button" onClick={() => setEditingTask(task)}>Editar</button><div className="task-move-actions">{taskIndex > 0 && <button type="button" title={`Mover a ${TASK_STATUSES[taskIndex - 1].label}`} aria-label={`Mover ${task.name} a ${TASK_STATUSES[taskIndex - 1].label}`} onClick={() => onMoveTask(task, TASK_STATUSES[taskIndex - 1])}>←</button>}{taskIndex < TASK_STATUSES.length - 1 && <button type="button" title={`Mover a ${TASK_STATUSES[taskIndex + 1].label}`} aria-label={`Mover ${task.name} a ${TASK_STATUSES[taskIndex + 1].label}`} onClick={() => onMoveTask(task, TASK_STATUSES[taskIndex + 1])}>→</button>}</div><button type="button" className="task-delete-button" onClick={() => { if (window.confirm(`¿Eliminar la tarea “${task.name}”?`)) onDeleteTask(task) }}>Eliminar</button></div></article>
        })}{columnTasks.length === 0 && <div className="lane-empty">{filteredTasks.length ? 'Sin tareas con estos filtros.' : 'No hay tareas en esta columna.'}</div>}</div><button type="button" className="lane-add-button" onClick={() => setIsAdding(true)}>＋ Agregar tarea</button></section>
      })}</div>
      {(isAdding || editingTask) && <TaskForm task={editingTask} onCancel={() => { setIsAdding(false); setEditingTask(null) }} onSubmit={save} />}
    </div>
  )
}

function PreTripChecklist({ currentReview, history, onToggleItem, onNewReview, onNotify }) {
  const progress = reviewProgress(currentReview)
  const pendingItems = PRE_TRIP_ITEMS.filter((item) => !currentReview.items[item.id])
  const startNew = () => {
    if (!window.confirm('¿Iniciar una nueva revisión? La revisión actual se conservará en el historial.')) return
    onNewReview()
    onNotify('Nueva revisión iniciada. La anterior quedó guardada en el historial.', 'success')
  }

  return (
    <div className="maintenance-page checklist-page">
      <PageHeading eyebrow="Preparación del viaje" title="Lista pre-viaje" description="Verifica los puntos esenciales antes de iniciar el recorrido." action={<button type="button" className="secondary-action" onClick={startNew}>↻ Nueva revisión</button>} />
      <section className="workspace-panel checklist-progress-panel"><div className="progress-summary"><div className="progress-ring large-ring" style={{ '--progress': `${progress.percent}%` }}><span>{progress.percent}<small>%</small></span></div><div><p className="maintenance-eyebrow">Avance de la revisión</p><h3>{progress.checked} de {progress.total} elementos revisados</h3><p>{pendingItems.length ? `${pendingItems.length} elementos pendientes` : 'Todos los elementos están marcados como revisados.'}</p></div></div><span className="review-date">Iniciada {formatDate(currentReview.createdAt)}</span></section>
      <section className="workspace-panel checklist-items-panel"><div className="checklist-panel-heading"><div><p className="maintenance-eyebrow">Inspección visual</p><h3>Puntos de control</h3></div><span className="checklist-count">{progress.checked}/{progress.total}</span></div><div className="checklist-items">{PRE_TRIP_ITEMS.map((item, index) => <label className={`checklist-item ${currentReview.items[item.id] ? 'is-checked' : ''}`} key={item.id}><input type="checkbox" checked={Boolean(currentReview.items[item.id])} onChange={(event) => onToggleItem(item.id, event.target.checked)} /><span className="custom-check" aria-hidden="true">✓</span><span className="checklist-item-copy"><strong>{item.label}</strong><small>{item.detail}</small></span><span className="checklist-item-number">{String(index + 1).padStart(2, '0')}</span></label>)}</div></section>
      <div className="safety-warning"><span aria-hidden="true">!</span><p>Esta lista es una guía visual y no sustituye una inspección técnica ni garantiza que el vehículo sea seguro para circular. Ante cualquier anomalía, solicita una revisión profesional.</p></div>
      {!!history.length && <section className="workspace-panel recent-reviews-panel"><div className="panel-title-row"><div><p className="maintenance-eyebrow">Registro</p><h3>Revisiones anteriores</h3></div><span className="result-count">{history.length} {history.length === 1 ? 'revisión' : 'revisiones'}</span></div><div className="recent-review-list">{history.slice(0, 3).map((review) => { const result = reviewProgress(review); return <div className="recent-review-row" key={review.id}><span className="review-check-icon">✓</span><div><strong>{formatDate(review.createdAt)}</strong><small>{result.checked} de {result.total} elementos revisados</small></div><span className="review-percent">{result.percent}%</span></div> })}</div></section>}
    </div>
  )
}

function History({ activity, history: reviews = [] }) {
  const entries = useMemo(() => [
    ...activity.map((item) => ({ ...item, type: 'activity' })),
    ...reviews.map((item) => ({ id: item.id, date: item.createdAt, title: 'Revisión pre-viaje archivada', detail: `${reviewProgress(item).checked} de ${PRE_TRIP_ITEMS.length} puntos revisados`, type: 'review' })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [activity, reviews])

  return <div className="maintenance-page"><PageHeading eyebrow="Actividad" title="Historial" description="Registro de cambios de mantenimiento y revisiones pre-viaje." /><section className="workspace-panel history-panel"><div className="history-table-heading"><span>Actividad</span><span>Detalle</span><span>Fecha</span></div>{entries.length ? <div className="history-entries">{entries.map((entry) => <article className="history-entry" key={`${entry.type}-${entry.id}`}><span className={`history-entry-icon ${entry.type === 'review' ? 'review-entry-icon' : ''}`}>{entry.type === 'review' ? '✓' : '↻'}</span><div><strong>{entry.title}</strong><small>{entry.detail}</small></div><time dateTime={entry.date}>{formatDate(entry.date)}</time></article>)}</div> : <div className="workspace-empty"><span>◷</span><h3>Aún no hay actividad</h3><p>Las tareas y revisiones completadas aparecerán aquí.</p></div>}</section></div>
}

const maintenanceViews = [
  { id: 'board', label: 'Tablero' },
  { id: 'checklist', label: 'Lista pre-viaje' },
  { id: 'history', label: 'Historial' },
]

export default function MaintenanceWorkspace() {
  const [tasks, setTasks] = useState(() => {
    const storedTasks = readStoredValue(STORAGE_KEYS.tasks, [])
    return Array.isArray(storedTasks) ? storedTasks : []
  })
  const [currentReview, setCurrentReview] = useState(() => {
    const storedReview = readStoredValue(STORAGE_KEYS.review, null)
    return storedReview?.items ? storedReview : createReview()
  })
  const [reviewHistory, setReviewHistory] = useState(() => {
    const storedHistory = readStoredValue(STORAGE_KEYS.reviews, [])
    return Array.isArray(storedHistory) ? storedHistory : []
  })
  const [activity, setActivity] = useState(() => {
    const storedActivity = readStoredValue(STORAGE_KEYS.activity, [])
    return Array.isArray(storedActivity) ? storedActivity : []
  })
  const [activeView, setActiveView] = useState('board')
  const [toast, setToast] = useState(null)

  useEffect(() => localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks)), [tasks])
  useEffect(() => localStorage.setItem(STORAGE_KEYS.review, JSON.stringify(currentReview)), [currentReview])
  useEffect(() => localStorage.setItem(STORAGE_KEYS.reviews, JSON.stringify(reviewHistory)), [reviewHistory])
  useEffect(() => localStorage.setItem(STORAGE_KEYS.activity, JSON.stringify(activity)), [activity])
  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const notify = (message, type = 'success') => setToast({ message, type })
  const logActivity = (title, detail) => {
    setActivity((previous) => [{ id: createId(), date: new Date().toISOString(), title, detail }, ...previous].slice(0, 100))
  }
  const saveTask = (taskId, form) => {
    if (taskId) {
      setTasks((previous) => previous.map((task) => task.id === taskId ? { ...task, ...form } : task))
      logActivity('Tarea actualizada', form.name)
      return
    }
    const newTask = { ...form, id: createId(), status: 'todo' }
    setTasks((previous) => [newTask, ...previous])
    logActivity('Tarea creada', newTask.name)
  }
  const moveTask = (task, status) => {
    setTasks((previous) => previous.map((item) => item.id === task.id ? { ...item, status: status.id } : item))
    logActivity('Estado actualizado', `${task.name}: ${status.label}`)
    notify(`“${task.name}” ahora está en ${status.label.toLowerCase()}.`)
  }
  const deleteTask = (task) => {
    setTasks((previous) => previous.filter((item) => item.id !== task.id))
    logActivity('Tarea eliminada', task.name)
    notify('Tarea eliminada.')
  }
  const toggleReviewItem = (itemId, checked) => {
    setCurrentReview((previous) => ({ ...previous, items: { ...previous.items, [itemId]: checked } }))
  }
  const startNewReview = () => {
    setReviewHistory((previous) => [{ ...currentReview }, ...previous])
    logActivity('Revisión pre-viaje archivada', formatDate(currentReview.createdAt))
    setCurrentReview(createReview())
  }

  return (
    <div className="workspace-view maintenance-workspace">
      <nav className="maintenance-tabs" aria-label="Secciones de mantenimiento">
        {maintenanceViews.map((view) => <button key={view.id} type="button" className={`maintenance-tab ${activeView === view.id ? 'active' : ''}`} aria-current={activeView === view.id ? 'page' : undefined} onClick={() => setActiveView(view.id)}>{view.label}{view.id === 'board' && <span>{tasks.length}</span>}</button>)}
      </nav>
      {activeView === 'board' && <MaintenanceBoard tasks={tasks} onSaveTask={saveTask} onMoveTask={moveTask} onDeleteTask={deleteTask} onNotify={notify} />}
      {activeView === 'checklist' && <PreTripChecklist currentReview={currentReview} history={reviewHistory} onToggleItem={toggleReviewItem} onNewReview={startNewReview} onNotify={notify} />}
      {activeView === 'history' && <History activity={activity} history={reviewHistory} />}
      {toast && <div className={`app-toast toast-${toast.type}`} role="status"><span aria-hidden="true">{toast.type === 'error' ? '!' : '✓'}</span>{toast.message}</div>}
    </div>
  )
}

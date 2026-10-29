import { useEffect, useMemo, useState } from 'react'
import './Maintenance.css'

const TASKS_STORAGE_KEY = 'autodash-maintenance-tasks'
const CHECKLIST_STORAGE_KEY = 'autodash-maintenance-checklists'

const STATUSES = [
  { id: 'todo', label: 'Por hacer', color: 'todo' },
  { id: 'doing', label: 'En proceso', color: 'doing' },
  { id: 'done', label: 'Hecho', color: 'done' },
]

const CATEGORIES = ['Mecánica', 'Eléctrica', 'Seguridad', 'General']
const PRIORITIES = ['Baja', 'Media', 'Alta']
const CHECKLIST_ITEMS = [
  'Nivel de batería.',
  'Neumáticos y ruedas.',
  'Luces y señales.',
  'Frenos y controles.',
  'Cables y conexiones eléctricas visibles.',
  'Elementos básicos de seguridad.',
  'Daños visibles o condiciones anormales.',
]

const emptyChecklist = () => ({
  id: createId(),
  startedAt: new Date().toISOString(),
  checked: [],
})

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function readStoredValue(key, fallback, isValid) {
  try {
    const storedValue = localStorage.getItem(key)
    if (!storedValue) return fallback

    const parsedValue = JSON.parse(storedValue)
    if (isValid(parsedValue)) return parsedValue

    console.error(`El almacenamiento de mantenimiento (${key}) tiene un formato no válido.`)
    return fallback
  } catch (error) {
    console.error(`No se pudo leer el almacenamiento de mantenimiento (${key}).`, error)
    return fallback
  }
}

function isValidChecklistSnapshot(snapshot) {
  return (
    snapshot &&
    typeof snapshot.id === 'string' &&
    Array.isArray(snapshot.checked) &&
    snapshot.checked.every(
      (index) => Number.isInteger(index) && index >= 0 && index < CHECKLIST_ITEMS.length,
    )
  )
}

function formatDate(value, includeTime = false) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' } : {}),
  }).format(date)
}

function Maintenance() {
  const [tasks, setTasks] = useState(() =>
    readStoredValue(
      TASKS_STORAGE_KEY,
      [],
      (value) =>
        Array.isArray(value) &&
        value.every(
          (task) =>
            task &&
            typeof task.id === 'string' &&
            typeof task.name === 'string' &&
            typeof task.description === 'string' &&
            typeof task.category === 'string' &&
            typeof task.priority === 'string' &&
            STATUSES.some((status) => status.id === task.status) &&
            typeof task.createdAt === 'string',
        ),
    ),
  )
  const [checklists, setChecklists] = useState(() =>
    readStoredValue(
      CHECKLIST_STORAGE_KEY,
      { current: emptyChecklist(), history: [] },
    (value) =>
      value &&
      isValidChecklistSnapshot(value.current) &&
      Array.isArray(value.history) &&
      value.history.every(isValidChecklistSnapshot),
    ),
  )
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    priority: '',
    status: '',
  })
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [draft, setDraft] = useState(createEmptyTask)

  useEffect(() => {
    try {
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks))
    } catch (error) {
      console.error('No se pudieron guardar las tareas de mantenimiento.', error)
    }
  }, [tasks])

  useEffect(() => {
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checklists))
    } catch (error) {
      console.error('No se pudo guardar la lista de cotejo de mantenimiento.', error)
    }
  }, [checklists])

  const filteredTasks = useMemo(() => {
    const query = filters.search.trim().toLocaleLowerCase('es')

    return tasks.filter((task) => {
      const matchesSearch =
        !query ||
        [task.name, task.description, task.category, task.notes]
          .filter(Boolean)
          .some((value) => value.toLocaleLowerCase('es').includes(query))

      return (
        matchesSearch &&
        (!filters.category || task.category === filters.category) &&
        (!filters.priority || task.priority === filters.priority) &&
        (!filters.status || task.status === filters.status)
      )
    })
  }, [filters, tasks])

  const completedTasks = tasks.filter((task) => task.status === 'done').length
  const progress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0
  const checkedCount = checklists.current.checked.length
  const checklistProgress = Math.round((checkedCount / CHECKLIST_ITEMS.length) * 100)
  const pendingItems = CHECKLIST_ITEMS.filter(
    (_, index) => !checklists.current.checked.includes(index),
  )

  function openNewTaskForm() {
    setDraft(createEmptyTask())
    setEditingTaskId(null)
    setFormError('')
    setIsFormOpen(true)
  }

  function openEditTaskForm(task) {
    setDraft({
      name: task.name,
      description: task.description,
      category: task.category,
      priority: task.priority,
      notes: task.notes || '',
    })
    setEditingTaskId(task.id)
    setFormError('')
    setIsFormOpen(true)
  }

  function saveTask(event) {
    event.preventDefault()
    const name = draft.name.trim()
    const description = draft.description.trim()

    if (!name || !description) {
      setFormError('El nombre y la descripción son obligatorios.')
      return
    }

    if (editingTaskId) {
      setTasks((previousTasks) =>
        previousTasks.map((task) =>
          task.id === editingTaskId
            ? { ...task, ...draft, name, description, notes: draft.notes.trim() }
            : task,
        ),
      )
    } else {
      setTasks((previousTasks) => [
        {
          id: createId(),
          ...draft,
          name,
          description,
          notes: draft.notes.trim(),
          status: 'todo',
          createdAt: new Date().toISOString(),
        },
        ...previousTasks,
      ])
    }

    setIsFormOpen(false)
    setFormError('')
  }

  function moveTask(taskId, status) {
    setTasks((previousTasks) =>
      previousTasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
    )
  }

  function deleteTask(task) {
    if (!window.confirm(`¿Eliminar la tarea "${task.name}"?`)) return
    setTasks((previousTasks) => previousTasks.filter((item) => item.id !== task.id))
  }

  function toggleChecklistItem(index) {
    setChecklists((previous) => {
      const checked = previous.current.checked.includes(index)
        ? previous.current.checked.filter((item) => item !== index)
        : [...previous.current.checked, index]

      return { ...previous, current: { ...previous.current, checked } }
    })
  }

  function startNewChecklist() {
    setChecklists((previous) => ({
      current: emptyChecklist(),
      history: [
        {
          ...previous.current,
          completedAt: new Date().toISOString(),
        },
        ...previous.history,
      ],
    }))
  }

  return (
    <div className="maintenance-module">
      <header className="maintenance-hero">
        <div>
          <span className="maintenance-eyebrow">CENTRO DE CONTROL · PAEC</span>
          <h2>Mantenimiento</h2>
          <p>Organiza las tareas del vehículo y revisa sus puntos esenciales antes de cada viaje.</p>
        </div>
        <button className="maintenance-primary-button" type="button" onClick={openNewTaskForm}>
          <span aria-hidden="true">＋</span> Nueva tarea
        </button>
      </header>

      <section className="maintenance-stats" aria-label="Estadísticas de mantenimiento">
        <article className="maintenance-stat">
          <span className="maintenance-stat-icon">▤</span>
          <div><span>Tareas registradas</span><strong>{tasks.length}</strong></div>
        </article>
        <article className="maintenance-stat">
          <span className="maintenance-stat-icon stat-todo-icon">◷</span>
          <div><span>Por hacer</span><strong>{tasks.filter((task) => task.status === 'todo').length}</strong></div>
        </article>
        <article className="maintenance-stat">
          <span className="maintenance-stat-icon stat-doing-icon">⟳</span>
          <div><span>En proceso</span><strong>{tasks.filter((task) => task.status === 'doing').length}</strong></div>
        </article>
        <article className="maintenance-stat">
          <span className="maintenance-stat-icon stat-done-icon">✓</span>
          <div><span>Completadas</span><strong>{completedTasks}</strong></div>
        </article>
        <article className="maintenance-stat maintenance-progress-stat">
          <div className="maintenance-stat-progress">
            <span>Avance general</span><strong>{progress}%</strong>
          </div>
          <div className="maintenance-progress-track"><span style={{ width: `${progress}%` }} /></div>
        </article>
      </section>

      {isFormOpen && (
        <section className="maintenance-form-panel" aria-labelledby="maintenance-form-title">
          <div className="maintenance-form-heading">
            <div>
              <span className="maintenance-eyebrow">{editingTaskId ? 'ACTUALIZAR REGISTRO' : 'NUEVO REGISTRO'}</span>
              <h3 id="maintenance-form-title">{editingTaskId ? 'Editar tarea' : 'Agregar tarea'}</h3>
            </div>
            <button type="button" className="maintenance-icon-button" aria-label="Cerrar formulario" onClick={() => setIsFormOpen(false)}>×</button>
          </div>
          <form onSubmit={saveTask}>
            <div className="maintenance-form-grid">
              <label>
                Nombre <span>*</span>
                <input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={100} required />
              </label>
              <label>
                Categoría
                <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
                  {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label>
                Prioridad
                <select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>
                  {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
                </select>
              </label>
              <label className="maintenance-form-wide">
                Descripción <span>*</span>
                <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows="3" maxLength={500} required />
              </label>
              <label className="maintenance-form-wide">
                Observaciones <small>Opcional</small>
                <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows="2" maxLength={500} />
              </label>
            </div>
            {formError && <p className="maintenance-form-error" role="alert">{formError}</p>}
            <div className="maintenance-form-actions">
              <button type="button" className="maintenance-secondary-button" onClick={() => setIsFormOpen(false)}>Cancelar</button>
              <button type="submit" className="maintenance-primary-button">{editingTaskId ? 'Guardar cambios' : 'Crear tarea'}</button>
            </div>
          </form>
        </section>
      )}

      <section className="maintenance-board-section">
        <div className="maintenance-section-heading">
          <div>
            <span className="maintenance-eyebrow">PLANIFICACIÓN</span>
            <h3>Tablero de tareas</h3>
          </div>
          <span className="maintenance-board-total">{filteredTasks.length} {filteredTasks.length === 1 ? 'tarea' : 'tareas'}</span>
        </div>

        <div className="maintenance-filters">
          <label className="maintenance-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Buscar tareas..."
              aria-label="Buscar tareas"
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            />
          </label>
          <label>
            <span className="visually-hidden">Filtrar por categoría</span>
            <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
              <option value="">Todas las categorías</option>
              {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label>
            <span className="visually-hidden">Filtrar por prioridad</span>
            <select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}>
              <option value="">Todas las prioridades</option>
              {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>
          <label>
            <span className="visually-hidden">Filtrar por estado</span>
            <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">Todos los estados</option>
              {STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
            </select>
          </label>
        </div>

        <div className="maintenance-kanban">
          {STATUSES.map((status) => {
            const columnTasks = filteredTasks.filter((task) => task.status === status.id)
            return (
              <section className={`maintenance-column column-${status.color}`} key={status.id} aria-label={`${status.label}: ${columnTasks.length} tareas`}>
                <header className="maintenance-column-heading">
                  <div><span className="maintenance-status-dot" /><h4>{status.label}</h4></div>
                  <span className="maintenance-column-count">{columnTasks.length}</span>
                </header>
                <div className="maintenance-task-list">
                  {columnTasks.length ? columnTasks.map((task) => (
                    <article className="maintenance-task-card" key={task.id}>
                      <div className="maintenance-task-card-top">
                        <span className={`maintenance-priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                        <div className="maintenance-task-actions">
                          <button type="button" aria-label={`Editar ${task.name}`} onClick={() => openEditTaskForm(task)}>✎</button>
                          <button type="button" aria-label={`Eliminar ${task.name}`} onClick={() => deleteTask(task)}>×</button>
                        </div>
                      </div>
                      <span className="maintenance-task-category">{task.category}</span>
                      <h5>{task.name}</h5>
                      <p className="maintenance-task-description">{task.description}</p>
                      {task.notes && <p className="maintenance-task-notes"><strong>Nota:</strong> {task.notes}</p>}
                      <div className="maintenance-task-footer">
                        <span>◷ {formatDate(task.createdAt)}</span>
                        <label>
                          <span className="visually-hidden">Cambiar estado de {task.name}</span>
                          <select value={task.status} onChange={(event) => moveTask(task.id, event.target.value)}>
                            {STATUSES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                          </select>
                        </label>
                      </div>
                    </article>
                  )) : (
                    <div className="maintenance-empty-column">
                      <span aria-hidden="true">◇</span>
                      <p>{tasks.length ? 'No hay tareas con estos filtros.' : 'Todavía no hay tareas aquí.'}</p>
                      {!tasks.length && status.id === 'todo' && <button type="button" onClick={openNewTaskForm}>Agregar primera tarea</button>}
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </section>

      <section className="maintenance-checklist-section">
        <div className="maintenance-checklist-main">
          <div className="maintenance-section-heading">
            <div>
              <span className="maintenance-eyebrow">ANTES DE SALIR</span>
              <h3>Lista de cotejo pre-viaje</h3>
            </div>
            <button type="button" className="maintenance-secondary-button" onClick={startNewChecklist}>↻ Nueva revisión</button>
          </div>
          <p className="maintenance-checklist-date">Revisión iniciada: {formatDate(checklists.current.startedAt, true)}</p>
          <div className="maintenance-checklist-progress">
            <div className="maintenance-progress-track"><span style={{ width: `${checklistProgress}%` }} /></div>
            <strong>{checklistProgress}%</strong>
            <span>{checkedCount} de {CHECKLIST_ITEMS.length} revisados</span>
          </div>
          <div className="maintenance-checklist-items">
            {CHECKLIST_ITEMS.map((item, index) => {
              const checked = checklists.current.checked.includes(index)
              return (
                <label className={checked ? 'maintenance-checklist-item checked' : 'maintenance-checklist-item'} key={item}>
                  <input type="checkbox" checked={checked} onChange={() => toggleChecklistItem(index)} />
                  <span className="maintenance-custom-checkbox" aria-hidden="true">{checked ? '✓' : ''}</span>
                  <span>{item}</span>
                </label>
              )
            })}
          </div>
          <div className="maintenance-pending">
            <strong>Elementos pendientes <span>{pendingItems.length}</span></strong>
            {pendingItems.length ? (
              <ul>{pendingItems.map((item) => <li key={item}>{item}</li>)}</ul>
            ) : <p>Todos los puntos de esta lista se marcaron como revisados.</p>}
          </div>
          <p className="maintenance-safety-notice"><span aria-hidden="true">!</span> Esta lista es una guía básica y no sustituye una inspección técnica ni garantiza que el vehículo sea seguro para circular.</p>
        </div>

        <aside className="maintenance-history">
          <div className="maintenance-history-heading">
            <div><span className="maintenance-eyebrow">REGISTROS</span><h3>Revisiones anteriores</h3></div>
            <span className="maintenance-column-count">{checklists.history.length}</span>
          </div>
          {checklists.history.length ? (
            <ul>
              {checklists.history.map((review) => (
                <li key={review.id}>
                  <span className="maintenance-history-icon">✓</span>
                  <div>
                    <strong>{formatDate(review.completedAt || review.startedAt, true)}</strong>
                    <span>{review.checked.length} de {CHECKLIST_ITEMS.length} puntos revisados</span>
                  </div>
                  <span className="maintenance-history-percent">{Math.round((review.checked.length / CHECKLIST_ITEMS.length) * 100)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="maintenance-history-empty">Al iniciar una nueva revisión, el registro actual aparecerá aquí.</p>
          )}
        </aside>
      </section>
    </div>
  )
}

function createEmptyTask() {
  return {
    name: '',
    description: '',
    category: CATEGORIES[0],
    priority: PRIORITIES[1],
    notes: '',
  }
}

export default Maintenance

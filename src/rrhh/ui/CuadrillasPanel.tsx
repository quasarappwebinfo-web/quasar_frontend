import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  addCrewMember,
  createCrew,
  listCrewMembers,
  listCrews,
  removeCrewMember,
  updateCrew,
} from '@/rrhh/api/cuadrillasApi'
import { listWorkers } from '@/rrhh/api/trabajadoresApi'
import type { Crew, CrewMember, Worker } from '@/rrhh/model/types'
import { ApiError } from '@/shared/api/apiJson'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import {
  Alert,
  Badge,
  Button,
  Field,
  Modal,
  PaginationBar,
  TextInput,
  TextSelect,
  useToast,
} from '@/shared/ui'
import styles from './rrhh.module.css'

export function CuadrillasPanel() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [activeOnly, setActiveOnly] = useState(true)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<Crew[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workers, setWorkers] = useState<Worker[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Crew | null>(null)
  const [name, setName] = useState('')
  const [leaderWorkerId, setLeaderWorkerId] = useState('')
  const [obraId, setObraId] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [membersCrew, setMembersCrew] = useState<Crew | null>(null)
  const [members, setMembers] = useState<CrewMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [addWorkerId, setAddWorkerId] = useState('')
  const [memberError, setMemberError] = useState<string | null>(null)

  useEffect(() => {
    void listWorkers({ page: 1, activeOnly: true }).then((data) => {
      setWorkers(data.workers)
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listCrews({
        page,
        search: debouncedSearch,
        activeOnly,
      })
      setItems(data.crews)
      setTotalItems(data.pagination.totalItems)
      setItemsPerPage(data.pagination.itemsPerPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar cuadrillas')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, activeOnly])

  useEffect(() => {
    void load()
  }, [load])

  async function loadMembers(crew: Crew) {
    setMembersLoading(true)
    setMemberError(null)
    try {
      const data = await listCrewMembers(crew.id, { currentOnly: true })
      setMembers(data.members)
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : 'No se pudieron cargar miembros')
    } finally {
      setMembersLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setName('')
    setLeaderWorkerId('')
    setObraId('')
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(crew: Crew) {
    setEditing(crew)
    setName(crew.name)
    setLeaderWorkerId(crew.leaderWorkerId ? String(crew.leaderWorkerId) : '')
    setObraId(crew.obraId ? String(crew.obraId) : '')
    setFormError(null)
    setFormOpen(true)
  }

  async function openMembers(crew: Crew) {
    setMembersCrew(crew)
    setAddWorkerId('')
    await loadMembers(crew)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        name: name.trim(),
        leaderWorkerId: leaderWorkerId ? Number(leaderWorkerId) : null,
        obraId: obraId ? Number(obraId) : null,
      }
      if (editing) {
        await updateCrew(editing.id, payload)
        toast.success('Cuadrilla actualizada')
      } else {
        await createCrew(payload)
        toast.success('Cuadrilla creada')
      }
      setFormOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(crew: Crew) {
    try {
      await updateCrew(crew.id, {
        name: crew.name,
        leaderWorkerId: crew.leaderWorkerId,
        obraId: crew.obraId,
        isActive: crew.isActive === 1 ? 2 : 1,
      })
      toast.success(crew.isActive === 1 ? 'Cuadrilla desactivada' : 'Cuadrilla activada')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar estado')
    }
  }

  async function handleAddMember() {
    if (!membersCrew || !addWorkerId) return
    setMemberError(null)
    try {
      await addCrewMember(membersCrew.id, Number(addWorkerId))
      toast.success('Miembro agregado')
      setAddWorkerId('')
      await loadMembers(membersCrew)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setMemberError(err.message)
      } else {
        setMemberError(err instanceof Error ? err.message : 'No se pudo agregar')
      }
    }
  }

  async function handleRemoveMember(member: CrewMember) {
    if (!membersCrew) return
    try {
      await removeCrewMember(member.id)
      toast.success('Miembro sacado de la cuadrilla')
      await loadMembers(membersCrew)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo sacar')
    }
  }

  return (
    <section>
      <Alert tone="info">
        Sacar un miembro deja historial (`leftAt`). Desactivar la cuadrilla no
        borra membresías.
      </Alert>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <div className={styles.searchGrow}>
            <Field label="Buscar">
              <TextInput
                placeholder="Nombre de cuadrilla"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </Field>
          </div>
          <Field label="Estado">
            <TextSelect
              value={activeOnly ? '1' : '0'}
              onChange={(e) => {
                setActiveOnly(e.target.value === '1')
                setPage(1)
              }}
            >
              <option value="1">Activas</option>
              <option value="0">Todas</option>
            </TextSelect>
          </Field>
        </div>
        <Button onClick={openCreate}>Nueva cuadrilla</Button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>No hay cuadrillas.</p>
      ) : (
        <div className={styles.cardGrid}>
          {items.map((crew) => (
            <article key={crew.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <h3 className={styles.cardTitle}>{crew.name}</h3>
                  <p className={styles.cardSubtitle}>
                    {crew.obraName || (crew.obraId ? `Obra #${crew.obraId}` : 'Sin obra')}
                  </p>
                </div>
                <Badge tone={crew.isActive === 1 ? 'success' : 'danger'}>
                  {crew.isActive === 1 ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>
              <div className={styles.cardMeta}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Líder</span>
                  <span className={styles.metaValue}>
                    {crew.leaderName || 'Sin líder'}
                  </span>
                </div>
              </div>
              <div className={styles.rowActions}>
                <Button variant="ghost" size="sm" onClick={() => void openMembers(crew)}>
                  Miembros
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(crew)}>
                  Editar
                </Button>
                <Button
                  variant={crew.isActive === 1 ? 'danger' : 'ghost'}
                  size="sm"
                  onClick={() => void toggleActive(crew)}
                >
                  {crew.isActive === 1 ? 'Desactivar' : 'Activar'}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <PaginationBar
        page={page}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onChange={setPage}
      />

      <Modal
        title={editing ? 'Editar cuadrilla' : 'Nueva cuadrilla'}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="crew-form" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="crew-form" className={styles.formGrid} onSubmit={handleSubmit}>
          <Field label="Nombre">
            <TextInput
              required
              disabled={saving}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Líder" hint="Si lo eliges, también entra como miembro">
            <TextSelect
              disabled={saving}
              value={leaderWorkerId}
              onChange={(e) => setLeaderWorkerId(e.target.value)}
            >
              <option value="">Sin líder</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.personName || `#${worker.id}`}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field label="ID de obra" hint="Opcional hasta módulo de obras">
            <TextInput
              type="number"
              disabled={saving}
              value={obraId}
              onChange={(e) => setObraId(e.target.value)}
            />
          </Field>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
        </form>
      </Modal>

      <Modal
        title={membersCrew ? `Miembros · ${membersCrew.name}` : 'Miembros'}
        open={Boolean(membersCrew)}
        onClose={() => setMembersCrew(null)}
        wide
      >
        <div className={styles.formGrid}>
          <div className={styles.filters}>
            <Field label="Agregar trabajador">
              <TextSelect
                value={addWorkerId}
                onChange={(e) => setAddWorkerId(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.personName || `#${worker.id}`}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <Button
              size="sm"
              disabled={!addWorkerId}
              onClick={() => void handleAddMember()}
            >
              Agregar
            </Button>
          </div>
          {memberError ? <Alert tone="error">{memberError}</Alert> : null}
          {membersLoading ? (
            <p className={styles.muted}>Cargando miembros…</p>
          ) : members.length === 0 ? (
            <p className={styles.muted}>Sin miembros vigentes.</p>
          ) : (
            <div className={styles.personResults}>
              {members.map((member) => (
                <div key={member.id} className={styles.personOption}>
                  <strong>{member.personName || `Trabajador #${member.workerId}`}</strong>
                  <span>
                    {member.documentNumber || 's/d'} · desde{' '}
                    {member.joinedAt.slice(0, 10)}
                  </span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void handleRemoveMember(member)}
                  >
                    Sacar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </section>
  )
}

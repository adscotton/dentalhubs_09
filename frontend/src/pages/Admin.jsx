import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const PAGE_SIZE = 8

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'associate_dentist', label: 'Associate Dentist' },
  { value: 'receptionist', label: 'Receptionist' },
]

const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map((item) => [item.value, item.label]))
const MONTH_ABBR = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.']

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

const calculateAge = (birthDate) => {
  if (!birthDate) return '-'
  const dob = new Date(birthDate)
  if (Number.isNaN(dob.getTime())) return '-'
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const monthDelta = now.getMonth() - dob.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1
  return age < 0 ? '-' : age
}

const formatPatientCode = (patientCode, patientId) => {
  const raw = `${patientCode || ''}`.trim()
  if (/^PT-\d{6}$/.test(raw)) return raw

  const digits = raw.replace(/\D/g, '')
  if (digits) return `PT-${digits.slice(-6).padStart(6, '0')}`

  const fallbackDigits = `${patientId || ''}`.replace(/\D/g, '').slice(-6)
  return `PT-${fallbackDigits.padStart(6, '0')}`
}

const formatStaffCode = (userId) => {
  const raw = `${userId || ''}`.trim()
  if (/^ST-\d{6}$/i.test(raw)) return raw.toUpperCase()

  const digits = raw.replace(/\D/g, '')
  if (digits) return `ST-${digits.slice(-6).padStart(6, '0')}`

  // Fallback for UUID-like values that may not produce enough numeric digits
  const alphanumerics = raw.replace(/[^a-zA-Z0-9]/g, '')
  const tail = alphanumerics.slice(-6).toUpperCase()
  return `ST-${tail.padStart(6, '0')}`
}

const toTitleCase = (value) => {
  const raw = `${value ?? ''}`
  if (!raw.trim()) return raw
  return raw.toLowerCase().replace(/\b[a-z]/g, (match) => match.toUpperCase())
}

function Admin() {
  const [tab, setTab] = useState('users')
  const [showAddUser, setShowAddUser] = useState(false)
  const [users, setUsers] = useState([])
  const [inactivePatients, setInactivePatients] = useState([])
  const [archivePatients, setArchivePatients] = useState([])
  const [archiveUsers, setArchiveUsers] = useState([])
  const [archiveServices, setArchiveServices] = useState([])
  const [archiveDentalConditions, setArchiveDentalConditions] = useState([])
  const [archiveType, setArchiveType] = useState('patients')
  const [usersPage, setUsersPage] = useState(1)
  const [inactivePage, setInactivePage] = useState(1)
  const [archivePage, setArchivePage] = useState(1)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [userForm, setUserForm] = useState({
    user_id: '',
    full_name: '',
    email: '',
    username: '',
    password: '',
    role: 'receptionist',
    is_active: true,
  })

  const closeModal = () => {
    setModal(null)
    setSelected(null)
    setShowCurrentPassword(false)
  }

  const showSuccess = (message) => {
    setSuccessMessage(message)
    setModal('success')
  }

  const loadUsers = async () => {
    const { data, error: fetchError } = await supabase
      .from('staff_profiles')
      .select('user_id, full_name, email, username, role, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (fetchError) throw fetchError
    setUsers(data ?? [])
  }

  const loadInactivePatients = async () => {
    const { data, error: fetchError } = await supabase
      .from('patients')
      .select('id, patient_code, first_name, last_name, sex, birth_date, archived_at, created_at')
      .eq('is_active', false)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })

    if (fetchError) throw fetchError
    setInactivePatients(data ?? [])
  }

  const loadArchives = async () => {
    const [patientsRes, usersRes, servicesRes, dentalRes] = await Promise.all([
      supabase
        .from('patients')
        .select('id, patient_code, first_name, last_name, sex, birth_date, archived_at')
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false }),
      supabase
        .from('staff_profiles')
        .select('user_id, full_name, email, username, role, is_active, updated_at')
        .eq('is_active', false)
        .order('updated_at', { ascending: false }),
      supabase
        .from('services')
        .select('id, service_name, is_active, updated_at')
        .eq('is_active', false)
        .order('updated_at', { ascending: false }),
      supabase
        .from('tooth_conditions')
        .select('id, code, condition_name, is_active, updated_at')
        .eq('is_active', false)
        .order('updated_at', { ascending: false }),
    ])

    if (patientsRes.error) throw patientsRes.error
    if (usersRes.error) throw usersRes.error
    if (servicesRes.error) throw servicesRes.error
    if (dentalRes.error) throw dentalRes.error

    setArchivePatients(patientsRes.data ?? [])
    setArchiveUsers(usersRes.data ?? [])
    setArchiveServices(servicesRes.data ?? [])
    setArchiveDentalConditions(dentalRes.data ?? [])
  }

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      await Promise.all([loadUsers(), loadInactivePatients(), loadArchives()])
    } catch (fetchError) {
      setError(fetchError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  const openConfirmArchive = (payload) => {
    setSelected(payload)
    setModal('confirm-archive')
  }

  const openConfirmRetrieve = (payload) => {
    setSelected(payload)
    setModal('confirm-retrieve')
  }

  const openEditUser = (user) => {
    setUserForm({
      user_id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      username: user.username,
      password: '',
      role: user.role,
      is_active: user.is_active,
    })
    setShowCurrentPassword(false)
    setSelected(user)
    setModal('edit-user')
  }

  const addUser = async () => {
    if (!userForm.full_name.trim() || !userForm.username.trim() || !userForm.password.trim() || !userForm.email.trim()) return

    const { error: createError } = await supabase.rpc('admin_create_user', {
      p_email: userForm.email.trim(),
      p_password: userForm.password,
      p_full_name: toTitleCase(userForm.full_name.trim()),
      p_username: userForm.username.trim(),
      p_role: userForm.role,
    })

    if (createError) {
      setError(createError.message)
      return
    }

    setShowAddUser(false)
    setUserForm({
      user_id: '',
      full_name: '',
      email: '',
      username: '',
      password: '',
      role: 'receptionist',
      is_active: true,
    })
    await loadAll()
    showSuccess('Added successfully')
  }

  const saveUserEdit = async () => {
    if (!selected) return

    try {
      const canProceed = await ensureNotLastActiveAdmin({
        targetUserId: selected.user_id,
        nextRole: userForm.role,
        nextIsActive: userForm.is_active,
      })

      if (!canProceed) {
        setError('Cannot deactivate/archive the last active admin account. Add or keep another active admin first.')
        return
      }
    } catch (guardError) {
      setError(guardError.message)
      return
    }

    const { error: updateError } = await supabase.rpc('admin_update_user_profile', {
      p_user_id: selected.user_id,
      p_full_name: toTitleCase(userForm.full_name.trim()),
      p_username: userForm.username.trim(),
      p_role: userForm.role,
      p_is_active: userForm.is_active,
    })

    if (updateError) {
      setError(updateError.message)
      return
    }

    if (userForm.password.trim()) {
      const { error: passwordError } = await supabase.rpc('admin_reset_user_password', {
        p_user_id: selected.user_id,
        p_new_password: userForm.password,
      })

      if (passwordError) {
        setError(passwordError.message)
        return
      }
    }

    await loadAll()
    closeModal()
    showSuccess('Updated successfully')
  }

  const confirmArchive = async () => {
    if (!selected) return

    if (selected.kind === 'user') {
      try {
        const canProceed = await ensureNotLastActiveAdmin({
          targetUserId: selected.user_id,
          nextRole: selected.role,
          nextIsActive: false,
        })

        if (!canProceed) {
          setError('Cannot archive the last active admin account. Add or keep another active admin first.')
          closeModal()
          return
        }
      } catch (guardError) {
        setError(guardError.message)
        closeModal()
        return
      }

      const { error: archiveError } = await supabase.rpc('admin_update_user_profile', {
        p_user_id: selected.user_id,
        p_full_name: selected.full_name,
        p_username: selected.username,
        p_role: selected.role,
        p_is_active: false,
      })

      if (archiveError) {
        setError(archiveError.message)
        return
      }

      await loadAll()
      closeModal()
      showSuccess('Archived successfully')
      return
    }

    const { data: authData } = await supabase.auth.getUser()
    const actorId = authData?.user?.id ?? null

    const { error: archiveError } = await supabase
      .from('patients')
      .update({
        is_active: false,
        archived_at: new Date().toISOString(),
        archived_by: actorId,
        updated_by: actorId,
      })
      .eq('id', selected.id)

    if (archiveError) {
      setError(archiveError.message)
      return
    }

    await loadAll()
    closeModal()
    showSuccess('Archived successfully')
  }

  const confirmRetrieve = async () => {
    if (!selected) return

    if (archiveType === 'patients') {
      const { data: authData } = await supabase.auth.getUser()
      const actorId = authData?.user?.id ?? null
      const { error: retrieveError } = await supabase
        .from('patients')
        .update({ is_active: true, archived_at: null, archived_by: null, updated_by: actorId })
        .eq('id', selected.id)

      if (retrieveError) {
        setError(retrieveError.message)
        return
      }
    } else if (archiveType === 'users') {
      const { error: retrieveError } = await supabase.rpc('admin_update_user_profile', {
        p_user_id: selected.user_id,
        p_full_name: selected.full_name,
        p_username: selected.username,
        p_role: selected.role,
        p_is_active: true,
      })

      if (retrieveError) {
        setError(retrieveError.message)
        return
      }
    } else if (archiveType === 'services') {
      const { data: authData } = await supabase.auth.getUser()
      const actorId = authData?.user?.id ?? null
      const { error: retrieveError } = await supabase
        .from('services')
        .update({ is_active: true, updated_by: actorId })
        .eq('id', selected.id)

      if (retrieveError) {
        setError(retrieveError.message)
        return
      }
    } else {
      const { data: authData } = await supabase.auth.getUser()
      const actorId = authData?.user?.id ?? null
      const { error: retrieveError } = await supabase
        .from('tooth_conditions')
        .update({ is_active: true, updated_by: actorId })
        .eq('id', selected.id)

      if (retrieveError) {
        setError(retrieveError.message)
        return
      }
    }

    await loadAll()
    closeModal()
    showSuccess('Retrieved successfully')
  }

  const archiveRows = useMemo(() => {
    if (archiveType === 'patients') return archivePatients
    if (archiveType === 'users') return archiveUsers
    if (archiveType === 'services') return archiveServices
    return archiveDentalConditions
  }, [archiveType, archivePatients, archiveUsers, archiveServices, archiveDentalConditions])
  const activeAdminCount = useMemo(
    () => users.filter((user) => user.is_active && user.role === 'admin').length,
    [users],
  )

  const ensureNotLastActiveAdmin = async ({ targetUserId, nextRole, nextIsActive }) => {
    const { data: targetUser, error: targetError } = await supabase
      .from('staff_profiles')
      .select('user_id, role, is_active')
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (targetError) throw targetError
    if (!targetUser) return true

    const isCurrentlyActiveAdmin = targetUser.is_active && targetUser.role === 'admin'
    const willRemainActiveAdmin = nextIsActive && nextRole === 'admin'
    if (!isCurrentlyActiveAdmin || willRemainActiveAdmin) return true

    const { count, error: countError } = await supabase
      .from('staff_profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('role', 'admin')

    if (countError) throw countError
    return (count ?? 0) > 1
  }

  const paginateRows = (rows, page) => {
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
    const safePage = Math.min(page, totalPages)
    const startIndex = (safePage - 1) * PAGE_SIZE
    return {
      totalPages,
      safePage,
      startIndex,
      visibleStart: rows.length === 0 ? 0 : startIndex + 1,
      visibleEnd: rows.length === 0 ? 0 : Math.min(startIndex + PAGE_SIZE, rows.length),
      pageRows: rows.slice(startIndex, startIndex + PAGE_SIZE),
      pageNumbers: Array.from({ length: totalPages }, (_, index) => index + 1),
    }
  }

  const usersPaging = paginateRows(users, usersPage)
  const inactivePaging = paginateRows(inactivePatients, inactivePage)
  const archivePaging = paginateRows(archiveRows, archivePage)

  return (
    <>
      <header className="page-header">
        <h1>Admin</h1>
      </header>

      <section className="panel tabs-panel admin-panel v2">
        <div className="panel-tabs large add-patient-tabs compact-tabs admin-tabs">
          <button type="button" className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => { setTab('users'); setShowAddUser(false); setUsersPage(1) }}>
            Manage Users
          </button>
          <button type="button" className={`tab ${tab === 'inactive' ? 'active' : ''}`} onClick={() => { setTab('inactive'); setShowAddUser(false); setInactivePage(1) }}>
            Inactive List
          </button>
          <button type="button" className={`tab ${tab === 'archive' ? 'active' : ''}`} onClick={() => { setTab('archive'); setShowAddUser(false); setArchivePage(1) }}>
            Archive List
          </button>
        </div>

        {error ? <p className="error">{error}</p> : null}
        {loading ? <p>Loading admin data...</p> : null}

        {tab === 'users' && !showAddUser ? (
          <div className="records">
            <div className="records-header">
              <div>
                <h2>Users</h2>
              </div>
              <div className="records-actions">
                <button type="button" className="primary" onClick={() => setShowAddUser(true)}>Add User</button>
              </div>
            </div>

            <div className="records-table users-table">
              <div className="table-head">
                <span>Staff ID</span>
                <span>Name</span>
                <span>Username</span>
                <span>Email</span>
                <span>Role</span>
                <span>Date Created</span>
                <span />
              </div>
              <div className="table-body">
                {usersPaging.pageRows.map((row) => (
                  <div key={row.user_id} className="table-row">
                    <span>{formatStaffCode(row.user_id)}</span>
                    <span>{row.full_name}</span>
                    <span>{row.username}</span>
                    <span>{row.email}</span>
                    <span>{ROLE_LABELS[row.role] ?? row.role}</span>
                    <span>{formatDate(row.created_at)}</span>
                    <span className="row-actions">
                      <button type="button" className="icon-btn" onClick={() => openEditUser(row)}>&#9998;</button>
                      {row.is_active ? (
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => openConfirmArchive({ ...row, kind: 'user' })}
                          disabled={row.role === 'admin' && activeAdminCount <= 1}
                          title={row.role === 'admin' && activeAdminCount <= 1 ? 'At least one active admin must remain.' : 'Archive user'}
                        >
                          &#8681;
                        </button>
                      ) : null}
                    </span>
                  </div>
                ))}
                {!loading && users.length === 0 ? <p>No users found.</p> : null}
              </div>
            </div>
            <div className="records-footer">
              <span>Showing {usersPaging.visibleStart}-{usersPaging.visibleEnd} of {users.length} entries</span>
              <div className="pagination">
                <button type="button" disabled={usersPaging.safePage <= 1} onClick={() => setUsersPage(Math.max(1, usersPaging.safePage - 1))}>Previous</button>
                {usersPaging.pageNumbers.map((page) => (
                  <button key={`users-page-${page}`} type="button" className={page === usersPaging.safePage ? 'active' : ''} onClick={() => setUsersPage(page)}>{page}</button>
                ))}
                <button type="button" disabled={usersPaging.safePage >= usersPaging.totalPages} onClick={() => setUsersPage(Math.min(usersPaging.totalPages, usersPaging.safePage + 1))}>Next</button>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'users' && showAddUser ? (
          <div className="records add-user-card">
            <div className="records-header">
              <button type="button" className="ghost" onClick={() => setShowAddUser(false)}>&larr; Back</button>
            </div>
            <h2>Add User</h2>
            <div className="history-top-grid">
              <label>Full name*<input type="text" value={userForm.full_name} onChange={(e) => setUserForm((p) => ({ ...p, full_name: toTitleCase(e.target.value) }))} /></label>
              <label>Email*<input type="email" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} /></label>
              <label>Username*<input type="text" value={userForm.username} onChange={(e) => setUserForm((p) => ({ ...p, username: e.target.value }))} /></label>
              <label>Password*<input type="password" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} /></label>
              <label>Role*<select value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))}>{ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
            </div>
            <div className="panel-footer">
              <button type="button" className="primary wide" onClick={() => { void addUser() }}>Add</button>
            </div>
          </div>
        ) : null}

        {tab === 'inactive' ? (
          <div className="records">
            <div className="records-header">
              <div>
                <h2>Inactive List</h2>
              </div>
            </div>

            <div className="records-table inactive-table">
              <div className="table-head">
                <span>Patient ID</span>
                <span>Full Name</span>
                <span>Sex</span>
                <span>Age</span>
                <span>Inactive Date</span>
                <span>Action</span>
              </div>
              <div className="table-body">
                {inactivePaging.pageRows.map((row) => (
                  <div key={row.id} className="table-row">
                    <span>{formatPatientCode(row.patient_code, row.id)}</span>
                    <span>{`${row.last_name}, ${row.first_name}`}</span>
                    <span>{row.sex === 'Male' ? 'M' : row.sex === 'Female' ? 'F' : row.sex}</span>
                    <span>{calculateAge(row.birth_date)}</span>
                    <span>{formatDate(row.archived_at ?? row.created_at)}</span>
                    <span><button type="button" className="icon-btn danger" onClick={() => openConfirmArchive({ ...row, kind: 'patient' })}>&#8681;</button></span>
                  </div>
                ))}
                {!loading && inactivePatients.length === 0 ? <p>No inactive patients found.</p> : null}
              </div>
            </div>
            <div className="records-footer">
              <span>Showing {inactivePaging.visibleStart}-{inactivePaging.visibleEnd} of {inactivePatients.length} entries</span>
              <div className="pagination">
                <button type="button" disabled={inactivePaging.safePage <= 1} onClick={() => setInactivePage(Math.max(1, inactivePaging.safePage - 1))}>Previous</button>
                {inactivePaging.pageNumbers.map((page) => (
                  <button key={`inactive-page-${page}`} type="button" className={page === inactivePaging.safePage ? 'active' : ''} onClick={() => setInactivePage(page)}>{page}</button>
                ))}
                <button type="button" disabled={inactivePaging.safePage >= inactivePaging.totalPages} onClick={() => setInactivePage(Math.min(inactivePaging.totalPages, inactivePaging.safePage + 1))}>Next</button>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'archive' ? (
          <div className="records archive-records">
            <div className="records-header">
              <div>
                <h2>Archive List</h2>
              </div>
              <div className="records-actions">
                <div className="sorter">
                  <select
                    value={archiveType}
                    onChange={(e) => {
                      setArchiveType(e.target.value)
                      setArchivePage(1)
                    }}
                  >
                    <option value="patients">Patients</option>
                    <option value="users">Users</option>
                    <option value="services">Services</option>
                    <option value="dentalCondition">Dental Condition</option>
                  </select>
                </div>
              </div>
            </div>

            <div
              className={`records-table archive-table ${
                archiveType === 'services' ? 'archive-table-services' : ''
              } ${archiveType === 'dentalCondition' ? 'archive-table-dental' : ''}`}
            >
              <div className="table-head">
                {archiveType === 'services' ? (
                  <>
                    <span>Service</span>
                    <span>Archived date</span>
                    <span>Action</span>
                  </>
                ) : null}
                {archiveType === 'dentalCondition' ? (
                  <>
                    <span>Legend</span>
                    <span>Tooth Condition</span>
                    <span>Archived date</span>
                    <span>Action</span>
                  </>
                ) : null}
                {(archiveType === 'patients' || archiveType === 'users') ? (
                  <>
                    <span>{archiveType === 'patients' ? 'Patient ID' : 'Staff ID'}</span>
                    <span>Full Name</span>
                    <span>{archiveType === 'patients' ? 'Sex' : 'Username'}</span>
                    <span>{archiveType === 'patients' ? 'Age' : 'Role'}</span>
                    <span>Archive Date</span>
                    <span>Action</span>
                  </>
                ) : null}
              </div>
              <div className="table-body">
                {archivePaging.pageRows.map((row) => (
                  <div key={archiveType === 'users' ? row.user_id : row.id} className="table-row">
                    {archiveType === 'services' ? (
                      <>
                        <span>{row.service_name}</span>
                        <span>{formatDate(row.updated_at)}</span>
                        <span><button type="button" className="view" onClick={() => openConfirmRetrieve(row)}>Retrieve</button></span>
                      </>
                    ) : null}
                    {archiveType === 'dentalCondition' ? (
                      <>
                        <span>{row.code}</span>
                        <span>{row.condition_name}</span>
                        <span>{formatDate(row.updated_at)}</span>
                        <span><button type="button" className="view" onClick={() => openConfirmRetrieve(row)}>Retrieve</button></span>
                      </>
                    ) : null}
                    {(archiveType === 'patients' || archiveType === 'users') ? (
                      <>
                        <span>{archiveType === 'patients' ? formatPatientCode(row.patient_code, row.id) : formatStaffCode(row.user_id)}</span>
                        <span>{archiveType === 'patients' ? `${row.last_name}, ${row.first_name}` : row.full_name}</span>
                        <span>{archiveType === 'patients' ? (row.sex === 'Male' ? 'M' : row.sex === 'Female' ? 'F' : row.sex) : row.username}</span>
                        <span>{archiveType === 'patients' ? calculateAge(row.birth_date) : (ROLE_LABELS[row.role] ?? row.role)}</span>
                        <span>{formatDate(archiveType === 'patients' ? row.archived_at : row.updated_at)}</span>
                        <span><button type="button" className="view" onClick={() => openConfirmRetrieve(row)}>Retrieve</button></span>
                      </>
                    ) : null}
                  </div>
                ))}
                {!loading && archiveRows.length === 0 ? <p>No archived entries found.</p> : null}
              </div>
            </div>
            <div className="records-footer">
              <span>Showing {archivePaging.visibleStart}-{archivePaging.visibleEnd} of {archiveRows.length} entries</span>
              <div className="pagination">
                <button type="button" disabled={archivePaging.safePage <= 1} onClick={() => setArchivePage(Math.max(1, archivePaging.safePage - 1))}>Previous</button>
                {archivePaging.pageNumbers.map((page) => (
                  <button key={`archive-page-${page}`} type="button" className={page === archivePaging.safePage ? 'active' : ''} onClick={() => setArchivePage(page)}>{page}</button>
                ))}
                <button type="button" disabled={archivePaging.safePage >= archivePaging.totalPages} onClick={() => setArchivePage(Math.min(archivePaging.totalPages, archivePaging.safePage + 1))}>Next</button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {modal ? <div className="modal-backdrop" onClick={closeModal} /> : null}

      {modal === 'edit-user' ? (
        <div className="pr-modal procedures-modal">
          <div className="pr-modal-head"><h2>Update User</h2><button type="button" onClick={closeModal}>X</button></div>
          <div className="pr-modal-body">
            <div className="history-top-grid">
              <label>Name<input type="text" value={userForm.full_name} onChange={(e) => setUserForm((p) => ({ ...p, full_name: toTitleCase(e.target.value) }))} /></label>
              <label>Email<input type="text" value={userForm.email} readOnly /></label>
              <label>Username<input type="text" value={userForm.username} onChange={(e) => setUserForm((p) => ({ ...p, username: e.target.value }))} /></label>
              <label>
                Current Password
                <div className="admin-current-password-wrap">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={showCurrentPassword ? 'Current password is not available' : '********'}
                    readOnly
                  />
                  <button
                    type="button"
                    className="admin-password-toggle"
                    onClick={() => setShowCurrentPassword((previous) => !previous)}
                    aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                    title={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  >
                    &#128065;
                  </button>
                </div>
              </label>
              <label className="span-2">New Password<input type="text" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} /></label>
              <label>Role<select value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))}>{ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
              <label>Active<select value={userForm.is_active ? 'yes' : 'no'} onChange={(e) => setUserForm((p) => ({ ...p, is_active: e.target.value === 'yes' }))}><option value="yes">Yes</option><option value="no">No</option></select></label>
            </div>
            <div className="modal-actions">
              <button type="button" className="danger-btn" onClick={closeModal}>Cancel</button>
              <button type="button" className="success-btn" onClick={() => { void saveUserEdit() }}>Update</button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'confirm-archive' ? (
        <div className="pr-modal procedures-modal archive-modal">
          <div className="pr-modal-head"><h2>Archive</h2></div>
          <div className="pr-modal-body">
            <p>
              {selected?.kind === 'user'
                ? 'Are you sure you want to archive this user?'
                : 'Are you sure you want to archive this patient?'}
            </p>
            <div className="modal-actions">
              <button type="button" className="danger-btn" onClick={closeModal}>No</button>
              <button type="button" className="success-btn" onClick={() => { void confirmArchive() }}>Yes</button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'confirm-retrieve' ? (
        <div className="pr-modal procedures-modal archive-modal">
          <div className="pr-modal-head"><h2>Retrieve</h2></div>
          <div className="pr-modal-body">
            <p>
              {archiveType === 'patients'
                ? 'Are you sure you want to retrieve this patient?'
                : archiveType === 'users'
                  ? 'Are you sure you want to retrieve this user?'
                  : archiveType === 'services'
                    ? 'Are you sure you want to retrieve this service?'
                    : 'Are you sure you want to retrieve this dental condition?'}
            </p>
            <div className="modal-actions">
              <button type="button" className="danger-btn" onClick={closeModal}>No</button>
              <button type="button" className="success-btn" onClick={() => { void confirmRetrieve() }}>Yes</button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'success' ? (
        <div className="pr-modal procedures-modal success-modal">
          <div className="pr-modal-head"><h2>&nbsp;</h2></div>
          <div className="pr-modal-body">
            <p>{successMessage}</p>
            <div className="modal-actions center">
              <button type="button" className="success-btn" onClick={closeModal}>Done</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default Admin

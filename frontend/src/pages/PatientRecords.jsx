import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const PAGE_SIZE = 10
const MONTH_ABBR = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.']

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

const formatSex = (value) => {
  if (!value) return '-'
  if (value === 'Male') return 'M'
  if (value === 'Female') return 'F'
  return value
}

const formatPatientCode = (patientCode, patientId) => {
  const raw = `${patientCode || ''}`.trim()
  if (/^PT-\d{6}$/.test(raw)) return raw

  const digits = raw.replace(/\D/g, '')
  if (digits) return `PT-${digits.slice(-6).padStart(6, '0')}`

  const fallbackDigits = `${patientId || ''}`.replace(/\D/g, '').slice(-6)
  return `PT-${fallbackDigits.padStart(6, '0')}`
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

const patientCodeNumber = (row) => {
  const code = formatPatientCode(row.patient_code, row.id)
  const digits = Number(code.replace(/\D/g, ''))
  return Number.isFinite(digits) ? digits : 0
}

function PatientRecords() {
  const navigate = useNavigate()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('patientId')
  const [nameSortDirection, setNameSortDirection] = useState('asc')
  const [registeredSortDirection, setRegisteredSortDirection] = useState('asc')
  const [patientIdSortDirection, setPatientIdSortDirection] = useState('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [statusConfirmRow, setStatusConfirmRow] = useState(null)
  const [isStatusUpdating, setIsStatusUpdating] = useState(false)

  const loadRecords = async () => {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('patients')
      .select('id, patient_code, first_name, last_name, sex, birth_date, created_at, is_active, archived_at')
      .is('archived_at', null)
      .order('created_at', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      setRecords([])
      setLoading(false)
      return
    }

    setRecords(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    const bootstrapTimer = setTimeout(() => {
      void loadRecords()
    }, 0)

    return () => clearTimeout(bootstrapTimer)
  }, [])

  const toggleRecord = async (row) => {
    const nextIsActive = !row.is_active
    setError('')
    setIsStatusUpdating(true)
    setStatusConfirmRow(null)

    // Optimistic update for snappier UI; rollback only if save fails.
    setRecords((prev) =>
      prev.map((item) => (
        item.id === row.id
          ? {
            ...item,
            is_active: nextIsActive,
            archived_at: null,
          }
          : item
      )),
    )

    try {
      const { data: authData } = await supabase.auth.getUser()
      const actorId = authData?.user?.id ?? null

      const { error: updateError } = await supabase
        .from('patients')
        .update({
          is_active: nextIsActive,
          archived_at: null,
          archived_by: null,
          updated_by: actorId,
        })
        .eq('id', row.id)

      if (updateError) throw updateError

      const { error: logError } = await supabase
        .from('patient_logs')
        .insert({
          patient_id: row.id,
          action: nextIsActive ? 'retrieve' : 'archive',
          details: nextIsActive ? 'Set patient active' : 'Set patient inactive',
        })

      if (logError) {
        setError(logError.message)
      }
    } catch (updateError) {
      // Rollback optimistic state if the database update failed.
      setRecords((prev) =>
        prev.map((item) => (
          item.id === row.id
            ? {
              ...item,
              is_active: row.is_active,
              archived_at: row.archived_at ?? null,
            }
            : item
        )),
      )
      setError(updateError.message)
    } finally {
      setIsStatusUpdating(false)
    }
  }

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const source = query
      ? records.filter((row) => `${row.last_name}, ${row.first_name}`.toLowerCase().includes(query))
      : [...records]

    if (sortBy === 'registered') {
      const multiplier = registeredSortDirection === 'asc' ? 1 : -1
      return source.sort((a, b) => (
        (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * multiplier
      ))
    }

    if (sortBy === 'patientId') {
      const multiplier = patientIdSortDirection === 'asc' ? 1 : -1
      return source.sort((a, b) => (patientCodeNumber(a) - patientCodeNumber(b)) * multiplier)
    }

    return source.sort((a, b) => {
      const aName = `${a.last_name}, ${a.first_name}`.toLowerCase()
      const bName = `${b.last_name}, ${b.first_name}`.toLowerCase()
      return nameSortDirection === 'asc'
        ? aName.localeCompare(bName)
        : bName.localeCompare(aName)
    })
  }, [nameSortDirection, patientIdSortDirection, records, registeredSortDirection, searchTerm, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pagedRecords = filteredRecords.slice(pageStart, pageStart + PAGE_SIZE)
  const activeCount = useMemo(() => filteredRecords.filter((row) => row.is_active).length, [filteredRecords])
  const visibleStart = filteredRecords.length === 0 ? 0 : pageStart + 1
  const visibleEnd = filteredRecords.length === 0 ? 0 : Math.min(pageStart + PAGE_SIZE, filteredRecords.length)
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)

  return (
    <>
      <header className="page-header">
        <h1>Patient Records</h1>
      </header>

      <section className="records">
        <div className="records-header">
          <div>
            <h2>Records</h2>
            <div className="records-toolbar">
              <div className="search-box">
                <span className="search-icon" aria-hidden />
                <input
                  type="text"
                  placeholder="Search by Name"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value)
                    setCurrentPage(1)
                  }}
                />
              </div>
            </div>
          </div>
          <div className="records-actions">
            <button type="button" className="primary" onClick={() => navigate('/add-patient')}>
              Add New Patient
            </button>
            <div className="sorter">
              <label htmlFor="sort">Sort by:</label>
              <select
                id="sort"
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value)
                  setCurrentPage(1)
                }}
              >
                <option value="name">Name</option>
                <option value="patientId">Patient ID</option>
                <option value="registered">Date Registered</option>
              </select>
              <button
                type="button"
                className="ghost sort-direction-btn"
                onClick={() => {
                  if (sortBy === 'registered') {
                    setRegisteredSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'))
                  } else if (sortBy === 'patientId') {
                    setPatientIdSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'))
                  } else {
                    setNameSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'))
                  }
                  setCurrentPage(1)
                }}
              >
                {sortBy === 'registered'
                  ? (registeredSortDirection === 'asc' ? 'Ascending' : 'Descending')
                  : sortBy === 'patientId'
                    ? (patientIdSortDirection === 'asc' ? 'Ascending' : 'Descending')
                  : (nameSortDirection === 'asc' ? 'Ascending' : 'Descending')}
              </button>
            </div>
          </div>
        </div>

        {error ? <p className="error">{error}</p> : null}
        {loading ? <p>Loading patient records...</p> : null}

        <div className="records-table">
          <div className="table-head">
            <span>Patient ID</span>
            <span>Full Name</span>
            <span>Sex</span>
            <span>Age</span>
            <span>Date Registered</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          <div className="table-body">
            {pagedRecords.map((row) => (
              <div key={row.id} className={`table-row ${row.is_active ? '' : 'inactive-row'}`}>
                <span>{formatPatientCode(row.patient_code, row.id)}</span>
                <span>{`${row.last_name}, ${row.first_name}`}</span>
                <span>{formatSex(row.sex)}</span>
                <span>{calculateAge(row.birth_date)}</span>
                <span>{formatDate(row.created_at)}</span>
                <span>
                  <button
                    type="button"
                    className={`status ${row.is_active ? 'on' : 'off'}`}
                    aria-label={`Set ${row.last_name}, ${row.first_name} as ${row.is_active ? 'inactive' : 'active'}`}
                    onClick={() => {
                      setError('')
                      setStatusConfirmRow(row)
                    }}
                  />
                </span>
                <span>
                  <button
                    type="button"
                    className="view"
                    onClick={() => navigate(`/records/${row.id}`)}
                  >
                    View
                  </button>
                </span>
              </div>
            ))}
            {!loading && filteredRecords.length === 0 ? <p>No records found.</p> : null}
          </div>
        </div>

        <div className="records-footer">
          <span>
            Showing {visibleStart}-{visibleEnd} of {filteredRecords.length} entries ({activeCount} active / {filteredRecords.length - activeCount} inactive)
          </span>
          <div className="pagination">
            <button type="button" disabled={safePage <= 1} onClick={() => setCurrentPage(Math.max(1, safePage - 1))}>Previous</button>
            {pageNumbers.map((page) => (
              <button
                key={page}
                type="button"
                className={page === safePage ? 'active' : ''}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
            <button type="button" disabled={safePage >= totalPages} onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}>Next</button>
          </div>
        </div>
      </section>

      {statusConfirmRow ? <div className="modal-backdrop" onClick={() => { if (!isStatusUpdating) setStatusConfirmRow(null) }} /> : null}
      {statusConfirmRow ? (
        <div className="pr-modal procedures-modal archive-modal status-confirm-modal">
          <div className="pr-modal-head"><h2>Confirm Status</h2></div>
          <div className="pr-modal-body">
            <p>
              Are you sure you want to {statusConfirmRow.is_active ? 'inactive' : 'active'} this user?
            </p>
            <div className="modal-actions">
              <button type="button" className="danger-btn" disabled={isStatusUpdating} onClick={() => setStatusConfirmRow(null)}>No</button>
              <button type="button" className="success-btn" disabled={isStatusUpdating} onClick={() => { void toggleRecord(statusConfirmRow) }}>
                {isStatusUpdating ? 'Saving...' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default PatientRecords

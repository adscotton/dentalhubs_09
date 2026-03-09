import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const PAGE_SIZE = 20
const MONTH_ABBR = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.']

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const dateLabel = `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
  const timeLabel = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${dateLabel} ${timeLabel}`
}

const formatPatientCode = (patientCode, patientId) => {
  const raw = `${patientCode || ''}`.trim()
  if (/^PT-\d{6}$/.test(raw)) return raw

  const digits = raw.replace(/\D/g, '')
  if (digits) return `PT-${digits.slice(-6).padStart(6, '0')}`

  const fallbackDigits = `${patientId || ''}`.replace(/\D/g, '').slice(-6)
  return `PT-${fallbackDigits.padStart(6, '0')}`
}

function PatientLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [sortOrder, setSortOrder] = useState('desc')
  const [currentPage, setCurrentPage] = useState(1)

  const loadLogs = async () => {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase.rpc('list_patient_logs')
    if (fetchError) {
      setError(fetchError.message)
      setLogs([])
      setLoading(false)
      return
    }

    setLogs(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    const bootstrapTimer = setTimeout(() => {
      void loadLogs()
    }, 0)

    return () => clearTimeout(bootstrapTimer)
  }, [])

  const filteredLogs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const hasDateFilter = Boolean(dateFilter)

    const attendanceRows = (logs ?? []).filter((row) => `${row.action ?? ''}`.trim().toLowerCase() === 'service_update')

    const rows = attendanceRows.filter((row) => {
      if (query && !`${row.patient_name}`.toLowerCase().includes(query)) return false
      if (!hasDateFilter) return true

      const rowDate = new Date(row.logged_at)
      if (Number.isNaN(rowDate.getTime())) return false
      const normalized = rowDate.toISOString().slice(0, 10)
      return normalized === dateFilter
    })

    return rows.sort((a, b) => {
      const aTime = new Date(a.logged_at).getTime()
      const bTime = new Date(b.logged_at).getTime()
      return sortOrder === 'asc' ? aTime - bTime : bTime - aTime
    })
  }, [logs, searchTerm, dateFilter, sortOrder])

  return (
    <>
      <header className="page-header">
        <h1>Patient Logs</h1>
      </header>

      <section className="records">
        <div className="records-header stacked">
          <div>
            <h2>Patient Logs</h2>
            <div className="filters">
              <div className="search-box">
                <span className="search-icon" aria-hidden />
                <input
                  type="text"
                  placeholder="search by name"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value)
                    setCurrentPage(1)
                  }}
                />
              </div>
              <label className="inline-field">
                Select Date:
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(event) => {
                    setDateFilter(event.target.value)
                    setCurrentPage(1)
                  }}
                />
              </label>
              <label className="inline-field">
                Sort By:
                <select
                  value={sortOrder}
                  onChange={(event) => {
                    setSortOrder(event.target.value)
                    setCurrentPage(1)
                  }}
                >
                  <option value="asc">Date Ascending</option>
                  <option value="desc">Date Descending</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {error ? <p className="error">{error}</p> : null}
        {loading ? <p>Loading patient logs...</p> : null}

        {(() => {
          const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE))
          const safePage = Math.min(currentPage, totalPages)
          const pageStart = (safePage - 1) * PAGE_SIZE
          const pagedLogs = filteredLogs.slice(pageStart, pageStart + PAGE_SIZE)
          const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
          const visibleStart = filteredLogs.length === 0 ? 0 : pageStart + 1
          const visibleEnd = filteredLogs.length === 0 ? 0 : Math.min(pageStart + PAGE_SIZE, filteredLogs.length)

          return (
            <>
        <div className="records-table logs-table">
          <div className="table-head">
            <span>Patient ID</span>
            <span>Patient Name</span>
            <span>Date &amp; time</span>
            <span>Assigned dentist</span>
          </div>
          <div className="table-body">
            {pagedLogs.map((row) => (
              <div key={row.id} className="table-row">
                <span>{formatPatientCode(row.patient_code, row.patient_id)}</span>
                <span>{row.patient_name}</span>
                <span>{formatDateTime(row.logged_at)}</span>
                <span>{row.actor_name}</span>
              </div>
            ))}
            {!loading && filteredLogs.length === 0 ? <p>No logs found.</p> : null}
          </div>
        </div>

        <div className="records-footer">
          <span>Showing {visibleStart}-{visibleEnd} of {filteredLogs.length} entries</span>
          <div className="pagination">
            <button type="button" disabled={safePage <= 1} onClick={() => setCurrentPage(Math.max(1, safePage - 1))}>Previous</button>
            {pageNumbers.map((page) => (
              <button key={page} type="button" className={page === safePage ? 'active' : ''} onClick={() => setCurrentPage(page)}>
                {page}
              </button>
            ))}
            <button type="button" disabled={safePage >= totalPages} onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}>Next</button>
          </div>
        </div>
            </>
          )
        })()}
      </section>
    </>
  )
}

export default PatientLogs

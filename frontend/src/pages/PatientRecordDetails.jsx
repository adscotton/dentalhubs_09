import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import dentalChart1 from '../assets/Dental Chart 1.png'
import dentalChart2 from '../assets/Dental Chart 2.png'
import { supabase } from '../lib/supabaseClient'

const HEALTH = [
  'Low Blood Pressure',
  'Severe Headaches',
  'High Blood Pressure',
  'Weight Loss',
  'Heart Disease',
  'Stroke',
  'Asthma',
  'Tuberculosis',
  'Diabetes',
  'Radiation Therapy',
  'Respiratory Problems',
  'Anemia/Blood Disease',
  'Hay Fever/Allergies',
  'Arthritis/Rheumatism',
  'Epilepsy/Convulsions',
  'Bleeding Problems',
  'Fainting/Seizures',
  'Heart Murmur',
  'Rheumatic Fever',
  'Kidney Disease',
  'Stomach Trouble/Ulcers',
  'Heart Surgery/Heart Attack',
  'Angina pectoris, chest pain',
  'Sexually Transmitted Disease',
  'Joint Replacement/Implant',
  'Hepatitis/Liver Disease',
  'Thyroid Problems',
  'Cancer/Tumors',
  'Head Injuries',
  'AIDS or HIV Infection',
]

const ALLERGENS = ['Local Anesthetic (ex. Lidocaine)', 'Penicillin/Antibiotics', 'Sulfa Drugs', 'Latex/Rubber', 'Aspirin']
const SEX_OPTIONS = ['Male', 'Female']
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Divorced', 'Separated']

const DQ = [
  { text: 'Do you feel pain in any of your teeth?' },
  { text: 'Are you under medical treatment now?', note: 'If so, what is the condition being treated?' },
  { text: 'Are your teeth sensitive to hot/cold liquids/food?' },
  { text: 'Are your teeth sensitive to sweet/sour liquids/food?' },
  { text: 'Do your gums bleed while brushing/flossing?' },
  { text: 'Do you have sores/lumps in/near your mouth?' },
  { text: 'Have you had orthodontic work in the past? (Braces, retainers, etc.)' },
  { text: 'Do you have any exposure to local anesthesia?' },
  { text: 'Have you had unfavorable reaction from anesthesia (eg. Lidocaine)?' },
  { text: 'Have you had problems after tooth extraction?' },
  { text: 'Have you had serious problems associated with dental treatment?' },
  { text: 'Have you had any head, neck or jaw injury?' },
  { text: 'Do you have any oral habit? (thumb sucking, mouth breathing, tongue thrusting, teeth clenching or grinding)' },
  { text: 'Do you have difficulty opening/closing your mouth?' },
  { text: 'Are you satisfied with the appearance of your teeth?' },
  { text: 'Have you had tooth bleaching/whitening done in the past?' },
  { text: 'Does dental treatment make you nervous?' },
  { text: 'Would you like to have regular recall appointments every 6 months?' },
]

const MQ = [
  { text: 'Are you in Good Health?' },
  { text: 'Are you under medical treatment now?', note: 'If so, what is the condition being treated?' },
  { text: 'Have you ever had serious illness or surgical operation?' },
  { text: 'Have you ever been hospitalized?', note: 'If so, when and why?' },
  { text: 'Are you taking any prescription/non-prescription medication?', note: 'If so, please specify:' },
  { text: 'Do you use tobacco products?' },
  { text: 'Do you use alcohol, cocaine or other dangerous drugs?' },
  { text: 'Are you pregnant?' },
  { text: 'Are you Breastfeeding?' },
  { text: 'Are you taking birth control pills?' },
]

const PERIODONTAL = ['Gingivitis', 'Moderate Periodontitis', 'Early Periodontitis', 'Advanced Periodontitis']
const OCCLUSION = ['Class I molar', 'Overbite', 'Overjet', 'Midline Deviation']
const DENTISTS = ['Dr. Jowela Elaine Roxas', 'Dr. Adrian San Nicolas', 'Dr. Keith San Miguel']
const ACCEPTED_DOCUMENT_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf', '.docx', '.txt', '.csv']
const ACCEPTED_DOCUMENT_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
])

const DENTAL_CHART_IMAGES = [
  { src: dentalChart1, alt: 'Dental chart 1' },
  { src: dentalChart2, alt: 'Dental chart 2' },
]

const TOOTH_X_POSITIONS_BY_CHART = {
  chart1: [3.3, 10.7, 18.1, 24.0, 28.7, 36.1, 40.7, 45.5, 54.1, 59.1, 64.1, 71.5, 77.1, 82.8, 91.2, 97.2],
  chart2: [4.0, 11.9, 19.5, 25.9, 30.7, 38.1, 42.9, 47.7, 52.2, 57.1, 62.3, 68.3, 73.3, 80.9, 89.6, 96.4],
}

const createToothMap = (defaultCode = '?') => Object.fromEntries(
  Array.from({ length: 32 }, (_, i) => i + 1).flatMap((tooth) => [[`top-${tooth}`, defaultCode], [`bottom-${tooth}`, defaultCode]]),
)

const syncToothMapWithLegendCodes = (toothMap, legendCodes, defaultCode) => {
  if (!toothMap || !legendCodes?.length || !defaultCode) return toothMap
  let changed = false
  const nextMap = { ...toothMap }

  Object.entries(nextMap).forEach(([position, code]) => {
    if (code === '?' && defaultCode !== '?') {
      nextMap[position] = defaultCode
      changed = true
      return
    }

  })

  return changed ? nextMap : toothMap
}

const createBooleanMap = (items, value = false) => Object.fromEntries(items.map((item) => [item, value]))
const createAnswerMap = (questions, value = '') => Object.fromEntries(questions.map((_, index) => [index, value]))
const todayIsoDate = () => new Date().toISOString().slice(0, 10)
const initialServiceLine = () => ({
  serviceId: '',
  quantity: 1,
  unitPrice: '',
})
const initialServiceForm = () => ({
  date: todayIsoDate(),
  originalDate: '',
  lines: [initialServiceLine()],
  discountType: 'peso',
  discountValue: '',
})

const DEFAULT_DENTAL_RECORD = {
  toothMap: createToothMap(),
  periodontal: createBooleanMap(PERIODONTAL),
  occlusion: createBooleanMap(OCCLUSION),
  prescriptions: '',
  notes: '',
  dentist: DENTISTS[0],
}

const cloneDentalRecord = (record) => ({
  toothMap: { ...record.toothMap },
  periodontal: { ...record.periodontal },
  occlusion: { ...record.occlusion },
  prescriptions: record.prescriptions,
  notes: record.notes,
  dentist: record.dentist,
})

const initialPatient = () => ({
  dbId: '',
  code: '',
  lastName: '',
  firstName: '',
  middleName: '',
  suffix: '',
  address: '',
  mobile: '',
  email: '',
  civilStatus: '',
  occupation: '',
  officeAddress: '',
  sex: '',
  birthdate: '',
  nickname: '',
  guardianName: '',
  guardianMobileNumber: '',
  guardianOccupation: '',
  guardianOfficeAddress: '',
  authorizationAccepted: false,
  createdAt: '',
  updatedAt: '',
  createdBy: '',
  updatedBy: '',
})

const initialDentalHistory = () => ({
  previous: '',
  lastExam: '',
  reason: '',
  answers: createAnswerMap(DQ),
  notes: {},
})

const initialMedicalHistory = () => ({
  physician: '',
  specialty: '',
  address: '',
  answers: createAnswerMap(MQ),
  notes: {},
})

const initialAllergens = () => ({
  values: createBooleanMap(ALLERGENS),
  others: '',
})

const MONTH_ABBR = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.']

const formatDateOnly = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

const formatDateInputDisplay = (isoDate) => {
  const raw = `${isoDate || ''}`.trim()
  if (!raw) return ''
  const parts = raw.split('-')
  if (parts.length < 3) return ''
  const year = parts[0]
  const month = parts[1]
  const day = parts[2].slice(0, 2)
  if (!year || !month || !day) return ''
  return `${day}/${month}/${year}`
}

const parseDateInputDisplay = (displayDate) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(`${displayDate || ''}`.trim())
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const normalizeDateInputTyping = (value) => {
  const digits = `${value || ''}`.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${formatDateOnly(date)} ${time}`
}

const formatCurrency = (value) => Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const toTitleCase = (value) => {
  const raw = `${value ?? ''}`
  if (!raw.trim()) return raw
  return raw.toLowerCase().replace(/\b[a-z]/g, (match) => match.toUpperCase())
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

const normalizeSex = (value) => {
  const normalized = `${value || ''}`.trim().toLowerCase()
  if (normalized === 'm' || normalized === 'male') return 'Male'
  if (normalized === 'f' || normalized === 'female') return 'Female'
  return ''
}

const normalizeCivilStatus = (value) => {
  const normalized = `${value || ''}`.trim().toLowerCase()
  if (normalized === 'single') return 'Single'
  if (normalized === 'married') return 'Married'
  if (normalized === 'widowed') return 'Widowed'
  if (normalized === 'divorced') return 'Divorced'
  if (normalized === 'separated') return 'Separated'
  return ''
}

const normalizeError = (error, fallback = 'Unexpected error occurred.') => {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (error?.message) return error.message
  return fallback
}

const formatPatientCode = (patientCode, patientId) => {
  const raw = `${patientCode || ''}`.trim()
  if (/^PT-\d{6}$/.test(raw)) return raw

  const digits = raw.replace(/\D/g, '')
  if (digits) return `PT-${digits.slice(-6).padStart(6, '0')}`

  const fallbackDigits = `${patientId || ''}`.replace(/\D/g, '').slice(-6)
  return `PT-${fallbackDigits.padStart(6, '0')}`
}

const normalizeAnswers = (questions, rawAnswers) => {
  const mapped = createAnswerMap(questions)
  if (!rawAnswers || typeof rawAnswers !== 'object') return mapped
  questions.forEach((_, index) => {
    const value = rawAnswers[index] ?? rawAnswers[String(index)]
    mapped[index] = value === 'YES' || value === 'NO' ? value : ''
  })
  return mapped
}

const normalizeNotes = (rawNotes) => {
  if (!rawNotes || typeof rawNotes !== 'object') return {}
  return Object.entries(rawNotes).reduce((accumulator, [key, value]) => {
    const index = Number(key)
    if (!Number.isNaN(index) && `${value ?? ''}`.trim() !== '') {
      accumulator[index] = `${value}`
    }
    return accumulator
  }, {})
}

const normalizeDentalRecord = (raw) => ({
  toothMap: { ...createToothMap(), ...(raw?.toothMap ?? {}) },
  periodontal: Object.fromEntries(PERIODONTAL.map((item) => [item, Boolean(raw?.periodontal?.[item])])),
  occlusion: Object.fromEntries(OCCLUSION.map((item) => [item, Boolean(raw?.occlusion?.[item])])),
  prescriptions: raw?.prescriptions ?? '',
  notes: raw?.notes ?? '',
  dentist: raw?.dentist ?? DENTISTS[0],
})

const toMoney = (value) => {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  return amount
}

const toServiceQuantity = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) return null
  return parsed
}

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100

const aggregateServiceLines = (lines) => {
  const byService = new Map()
  lines.forEach((line) => {
    if (!line.serviceId) return
    const quantity = toServiceQuantity(line.quantity)
    const unitPrice = toMoney(line.unitPrice)
    if (quantity === null || unitPrice === null) return

    if (!byService.has(line.serviceId)) {
      byService.set(line.serviceId, {
        serviceId: line.serviceId,
        quantity: 0,
        unitPrice,
      })
    }

    const bucket = byService.get(line.serviceId)
    bucket.quantity += quantity
    bucket.unitPrice = unitPrice
  })

  return [...byService.values()].map((line) => ({
    ...line,
    lineAmount: roundMoney(line.quantity * line.unitPrice),
  }))
}

const calculateServiceAmounts = (form) => {
  const preparedLines = aggregateServiceLines(form.lines ?? [])
  if (preparedLines.length === 0) {
    return { subtotal: null, discountAmount: null, totalAmount: null }
  }

  const subtotal = roundMoney(preparedLines.reduce((sum, line) => sum + line.lineAmount, 0))
  const rawDiscount = `${form.discountValue ?? ''}`.trim()
  const isPercentMode = form.discountType === 'percent'

  if (isPercentMode) {
    const percent = rawDiscount === '' ? 0 : Number(rawDiscount)
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return { subtotal, discountAmount: null, totalAmount: null }
    }
    const discountAmount = roundMoney((subtotal * percent) / 100)
    return { subtotal, discountAmount, totalAmount: roundMoney(subtotal - discountAmount) }
  }

  const discountAmount = rawDiscount === '' ? 0 : toMoney(rawDiscount)
  if (discountAmount === null || discountAmount > subtotal) {
    return { subtotal, discountAmount: null, totalAmount: null }
  }
  return { subtotal, discountAmount: roundMoney(discountAmount), totalAmount: roundMoney(subtotal - discountAmount) }
}

const isAcceptedDocument = (file) => {
  if (!file) return false
  const fileName = `${file.name ?? ''}`.toLowerCase()
  const hasAcceptedExtension = ACCEPTED_DOCUMENT_EXTENSIONS.some((extension) => fileName.endsWith(extension))
  const hasAcceptedMimeType = ACCEPTED_DOCUMENT_MIME_TYPES.has(`${file.type ?? ''}`.toLowerCase())
  return hasAcceptedExtension || hasAcceptedMimeType
}

function YesNoEditor({ questions, historyState, setHistoryState }) {
  return (
    <section className="history-block">
      <h3>Answer the Following Questions:</h3>
      {questions.map((question, index) => (
        <div key={question.text} className="yes-no-item">
          <p><span className="required-label">{question.text}<span className="required-asterisk">*</span></span></p>
          <div className="yes-no-row">
            <label>
              <input
                type="radio"
                checked={historyState.answers[index] === 'YES'}
                onChange={() => setHistoryState((previous) => ({ ...previous, answers: { ...previous.answers, [index]: 'YES' } }))}
              />
              Yes
            </label>
            <label>
              <input
                type="radio"
                checked={historyState.answers[index] === 'NO'}
                onChange={() => setHistoryState((previous) => ({ ...previous, answers: { ...previous.answers, [index]: 'NO' } }))}
              />
              No
            </label>
            {question.note && historyState.answers[index] === 'YES' ? (
              <label className="note-field">
                <span>{question.note}</span>
                <input
                  type="text"
                  value={historyState.notes?.[index] || ''}
                  onChange={(event) => setHistoryState((previous) => ({
                    ...previous,
                    notes: { ...(previous.notes || {}), [index]: toTitleCase(event.target.value) },
                  }))}
                />
              </label>
            ) : null}
          </div>
        </div>
      ))}
    </section>
  )
}

function PatientRecordDetails({ currentRole, currentProfile }) {
  const navigate = useNavigate()
  const { id } = useParams()

  const [tab, setTab] = useState('patient')
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [patient, setPatient] = useState(initialPatient)
  const [health, setHealth] = useState(() => createBooleanMap(HEALTH))
  const [allergens, setAllergens] = useState(initialAllergens)
  const [dentalHistory, setDentalHistory] = useState(initialDentalHistory)
  const [medicalHistory, setMedicalHistory] = useState(initialMedicalHistory)
  const [patientSnapshot, setPatientSnapshot] = useState(null)
  const [lastChangedBy, setLastChangedBy] = useState('-')
  const [legendOptions, setLegendOptions] = useState([])
  const [serviceOptions, setServiceOptions] = useState([])
  const [serviceRows, setServiceRows] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [patientDocuments, setPatientDocuments] = useState([])
  const [isUploadingDocument, setIsUploadingDocument] = useState(false)
  const [serviceFormError, setServiceFormError] = useState('')
  const [serviceForm, setServiceForm] = useState(() => initialServiceForm())
  const [dentalRecord, setDentalRecord] = useState(() => cloneDentalRecord(DEFAULT_DENTAL_RECORD))
  const [dentalRecordForm, setDentalRecordForm] = useState(() => cloneDentalRecord(DEFAULT_DENTAL_RECORD))
  const [dentalRecordMeta, setDentalRecordMeta] = useState({ updatedAt: '', updatedByName: '-' })
  const [exportPreviewHtml, setExportPreviewHtml] = useState('')
  const [birthdateInput, setBirthdateInput] = useState('')
  const [lastExamInput, setLastExamInput] = useState('')
  const exportPreviewFrameRef = useRef(null)
  const birthdatePickerRef = useRef(null)
  const lastExamPickerRef = useRef(null)

  const patientCode = useMemo(() => formatPatientCode(patient.code, patient.dbId), [patient.code, patient.dbId])
  const defaultLegendCode = useMemo(() => {
    const goodConditionLegend = legendOptions.find((legend) => `${legend.condition_name ?? ''}`.trim().toLowerCase() === 'good condition')
    return goodConditionLegend?.code || legendOptions[0]?.code || '?'
  }, [legendOptions])
  const legendCodes = useMemo(() => {
    const liveCodes = legendOptions.map((legend) => legend.code).filter(Boolean)
    const persistedCodes = [
      ...Object.values(dentalRecord?.toothMap ?? {}),
      ...Object.values(dentalRecordForm?.toothMap ?? {}),
    ].filter(Boolean)
    return [...new Set([defaultLegendCode, ...liveCodes, ...persistedCodes].filter(Boolean))]
  }, [defaultLegendCode, dentalRecord, dentalRecordForm, legendOptions])

  const takeSnapshot = useCallback(() => {
    setPatientSnapshot({
      patient: { ...patient },
      health: { ...health },
      allergens: { values: { ...allergens.values }, others: allergens.others },
      dentalHistory: { ...dentalHistory, answers: { ...dentalHistory.answers }, notes: { ...(dentalHistory.notes || {}) } },
      medicalHistory: { ...medicalHistory, answers: { ...medicalHistory.answers }, notes: { ...(medicalHistory.notes || {}) } },
    })
  }, [allergens, dentalHistory, health, medicalHistory, patient])

  const restoreSnapshot = useCallback(() => {
    if (!patientSnapshot) return
    setPatient({ ...patientSnapshot.patient })
    setHealth({ ...patientSnapshot.health })
    setAllergens({ values: { ...patientSnapshot.allergens.values }, others: patientSnapshot.allergens.others })
    setDentalHistory({
      ...patientSnapshot.dentalHistory,
      answers: { ...patientSnapshot.dentalHistory.answers },
      notes: { ...(patientSnapshot.dentalHistory.notes || {}) },
    })
    setMedicalHistory({
      ...patientSnapshot.medicalHistory,
      answers: { ...patientSnapshot.medicalHistory.answers },
      notes: { ...(patientSnapshot.medicalHistory.notes || {}) },
    })
  }, [patientSnapshot])

  const fetchStaffNames = useCallback(async (userIds) => {
    const ids = [...new Set((userIds ?? []).filter(Boolean))]
    if (!ids.length) return {}

    const { data, error: fetchError } = await supabase
      .from('staff_profiles')
      .select('user_id, full_name')
      .in('user_id', ids)

    if (fetchError) return {}

    return (data ?? []).reduce((accumulator, row) => {
      accumulator[row.user_id] = row.full_name
      return accumulator
    }, {})
  }, [])

  const loadPatient = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('patients')
      .select(`
        id,
        patient_code,
        first_name,
        last_name,
        middle_name,
        suffix,
        address,
        phone,
        email,
        sex,
        birth_date,
        nickname,
        civil_status,
        occupation,
        office_address,
        emergency_contact_name,
        emergency_contact_phone,
        guardian_name,
        guardian_mobile_number,
        guardian_occupation,
        guardian_office_address,
        health_conditions,
        allergen_info,
        medical_history,
        dental_history,
        authorization_accepted,
        created_at,
        updated_at,
        created_by,
        updated_by
      `)
      .eq('id', id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!data) throw new Error('Patient not found.')

    const nextPatient = {
      dbId: data.id,
      code: data.patient_code,
      lastName: data.last_name || '',
      firstName: data.first_name || '',
      middleName: data.middle_name || '',
      suffix: data.suffix || '',
      address: data.address || '',
      mobile: data.phone || '',
      email: data.email || '',
      civilStatus: normalizeCivilStatus(data.civil_status),
      occupation: data.occupation || '',
      officeAddress: data.office_address || '',
      sex: normalizeSex(data.sex),
      birthdate: data.birth_date || '',
      nickname: data.nickname || '',
      guardianName: data.guardian_name || data.emergency_contact_name || '',
      guardianMobileNumber: data.guardian_mobile_number || data.emergency_contact_phone || '',
      guardianOccupation: data.guardian_occupation || '',
      guardianOfficeAddress: data.guardian_office_address || '',
      authorizationAccepted: Boolean(data.authorization_accepted),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: data.created_by || '',
      updatedBy: data.updated_by || '',
    }

    const nextHealth = createBooleanMap(HEALTH)
    const rawHealth = data.health_conditions && typeof data.health_conditions === 'object' ? data.health_conditions : {}
    HEALTH.forEach((item) => {
      nextHealth[item] = Boolean(rawHealth[item])
    })

    const nextAllergens = initialAllergens()
    const rawAllergen = data.allergen_info && typeof data.allergen_info === 'object' ? data.allergen_info : {}
    const rawAllergenValues = rawAllergen.values && typeof rawAllergen.values === 'object' ? rawAllergen.values : rawAllergen
    ALLERGENS.forEach((item) => {
      nextAllergens.values[item] = Boolean(rawAllergenValues?.[item])
    })
    nextAllergens.others = `${rawAllergen.others ?? ''}`

    const rawDentalHistory = data.dental_history && typeof data.dental_history === 'object' ? data.dental_history : {}
    const nextDentalHistory = {
      previous: `${rawDentalHistory.previous ?? ''}`,
      lastExam: `${rawDentalHistory.lastExam ?? ''}`,
      reason: `${rawDentalHistory.reason ?? ''}`,
      answers: normalizeAnswers(DQ, rawDentalHistory.answers),
      notes: normalizeNotes(rawDentalHistory.notes),
    }

    const rawMedicalHistory = data.medical_history && typeof data.medical_history === 'object' ? data.medical_history : {}
    const nextMedicalHistory = {
      physician: `${rawMedicalHistory.physician ?? ''}`,
      specialty: `${rawMedicalHistory.specialty ?? ''}`,
      address: `${rawMedicalHistory.address ?? ''}`,
      answers: normalizeAnswers(MQ, rawMedicalHistory.answers),
      notes: normalizeNotes(rawMedicalHistory.notes),
    }

    const staffMap = await fetchStaffNames([nextPatient.updatedBy || nextPatient.createdBy])
    setLastChangedBy(staffMap[nextPatient.updatedBy || nextPatient.createdBy] || 'System')

    setPatient(nextPatient)
    setHealth(nextHealth)
    setAllergens(nextAllergens)
    setDentalHistory(nextDentalHistory)
    setMedicalHistory(nextMedicalHistory)
    setPatientSnapshot({
      patient: nextPatient,
      health: nextHealth,
      allergens: nextAllergens,
      dentalHistory: nextDentalHistory,
      medicalHistory: nextMedicalHistory,
    })
  }, [fetchStaffNames, id])

  const loadServiceOptions = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('services')
      .select('id, service_name, price')
      .eq('is_active', true)
      .order('service_name', { ascending: true })

    if (fetchError) throw fetchError
    setServiceOptions((data ?? []).map((service) => ({
      ...service,
      price: Number(service.price ?? 0),
    })))
  }, [])

  const loadLegendOptions = useCallback(async () => {
    let { data, error: fetchError } = await supabase
      .from('tooth_conditions')
      .select('id, code, condition_name')
      .eq('is_active', true)
      .order('code', { ascending: true })

    if (fetchError?.code === '42703') {
      const fallbackResult = await supabase
        .from('tooth_conditions')
        .select('id, code')
        .eq('is_active', true)
        .order('code', { ascending: true })

      data = fallbackResult.data
      fetchError = fallbackResult.error
    }

    if (fetchError) throw fetchError
    setLegendOptions((data ?? []).map((row) => ({
      ...row,
      condition_name: row.condition_name ?? row.code,
    })))
  }, [])

  const loadPatientDocuments = useCallback(async () => {
    let { data, error: fetchError } = await supabase
      .from('patient_documents')
      .select('*')
      .eq('patient_id', id)
      .is('archived_at', null)
      .order('created_at', { ascending: true })

    if (fetchError?.code === '42703') {
      const fallbackWithoutArchive = await supabase
        .from('patient_documents')
        .select('*')
        .eq('patient_id', id)
        .order('created_at', { ascending: true })

      data = fallbackWithoutArchive.data
      fetchError = fallbackWithoutArchive.error
    }

    if (fetchError?.code === '42703') {
      const fallbackNoOrder = await supabase
        .from('patient_documents')
        .select('*')
        .eq('patient_id', id)

      data = fallbackNoOrder.data
      fetchError = fallbackNoOrder.error
    }

    if (fetchError) {
      if (fetchError.code === '42P01') {
        setPatientDocuments([])
        return
      }
      throw fetchError
    }

    setPatientDocuments(
      (data ?? []).map((row, index) => ({
        dbId: row.id ?? null,
        id: row.id ?? `${index}-${row.file_name ?? row.fileName ?? 'document'}`,
        fileName: row.file_name ?? row.fileName ?? `Document ${index + 1}`,
        fileUrl: row.file_url ?? row.fileUrl ?? '',
        storagePath: row.storage_path ?? row.storagePath ?? '',
      })),
    )
  }, [id])

  const loadServiceRows = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('service_records')
      .select('id, service_id, quantity, unit_price, discount_amount, amount, notes, visit_at, updated_by, services(service_name, price)')
      .eq('patient_id', id)
      .is('archived_at', null)
      .order('visit_at', { ascending: false })

    if (fetchError) throw fetchError

    const rows = data ?? []
    const staffMap = await fetchStaffNames(rows.map((row) => row.updated_by))
    const groupedByDate = new Map()

    rows.forEach((row) => {
      const visitDate = row.visit_at ? row.visit_at.slice(0, 10) : '-'
      const quantity = Number(row.quantity ?? 1) >= 1 ? Number(row.quantity ?? 1) : 1
      const unitPrice = Number(row.unit_price ?? row.services?.price ?? row.amount ?? 0)
      const lineAmount = roundMoney(quantity * unitPrice)
      const discountAmount = Math.max(0, Math.min(Number(row.discount_amount ?? 0), lineAmount))
      const totalAmount = Math.max(0, Number(row.amount ?? lineAmount - discountAmount))
      let discountType = 'peso'

      if (typeof row.notes === 'string' && row.notes.trim() !== '') {
        try {
          const parsedNotes = JSON.parse(row.notes)
          if (parsedNotes?.discountType === 'percent' || parsedNotes?.discountType === 'peso') {
            discountType = parsedNotes.discountType
          }
        } catch {
          discountType = 'peso'
        }
      }

      if (!groupedByDate.has(visitDate)) {
        groupedByDate.set(visitDate, {
          id: visitDate,
          date: visitDate,
          total: 0,
          lines: [],
          by: staffMap[row.updated_by] || 'System',
          updatedAt: row.visit_at || null,
        })
      }

      const bucket = groupedByDate.get(visitDate)
      bucket.lines.push({
        id: row.id,
        serviceId: row.service_id,
        service: row.services?.service_name || 'Unknown service',
        quantity,
        unitPrice,
        lineAmount,
        discountAmount,
        total: totalAmount,
        discountType,
      })
      bucket.total = roundMoney(bucket.total + totalAmount)

      if (row.visit_at && (!bucket.updatedAt || new Date(row.visit_at).getTime() > new Date(bucket.updatedAt).getTime())) {
        bucket.updatedAt = row.visit_at
        bucket.by = staffMap[row.updated_by] || 'System'
      }
    })

    setServiceRows(
      [...groupedByDate.values()].sort((a, b) => (
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )),
    )
  }, [fetchStaffNames, id])

  const loadDentalRecord = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('dental_records')
      .select('id, findings, treatment, chart_data, recorded_at, updated_by')
      .eq('patient_id', id)
      .is('archived_at', null)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) throw fetchError

    if (!data) {
      setDentalRecord(cloneDentalRecord(DEFAULT_DENTAL_RECORD))
      setDentalRecordForm(cloneDentalRecord(DEFAULT_DENTAL_RECORD))
      setDentalRecordMeta({ updatedAt: '', updatedByName: '-' })
      return
    }

    const mappedRecord = normalizeDentalRecord({
      ...(data.chart_data ?? {}),
      notes: data.findings ?? data.chart_data?.notes ?? '',
      prescriptions: data.treatment ?? data.chart_data?.prescriptions ?? '',
    })

    const staffMap = await fetchStaffNames([data.updated_by])
    setDentalRecord(cloneDentalRecord(mappedRecord))
    setDentalRecordForm(cloneDentalRecord(mappedRecord))
    setDentalRecordMeta({ updatedAt: data.recorded_at, updatedByName: staffMap[data.updated_by] || 'System' })
  }, [fetchStaffNames, id])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // Load essentials first so the page can render faster after clicking View.
      await Promise.all([
        loadPatient(),
        loadServiceRows(),
        loadDentalRecord(),
      ])

      setLoading(false)

      // Load secondary data in the background (no blocking spinner).
      void Promise.all([
        loadServiceOptions(),
        loadLegendOptions(),
        loadPatientDocuments(),
      ]).catch((fetchError) => {
        setError(normalizeError(fetchError, 'Some supporting data failed to load.'))
      })
    } catch (fetchError) {
      setError(normalizeError(fetchError, 'Unable to load patient data.'))
      setLoading(false)
    }
  }, [loadDentalRecord, loadLegendOptions, loadPatient, loadPatientDocuments, loadServiceOptions, loadServiceRows])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    if (!legendCodes.length || !defaultLegendCode) return
    setDentalRecord((previous) => {
      const nextToothMap = syncToothMapWithLegendCodes(previous.toothMap, legendCodes, defaultLegendCode)
      if (nextToothMap === previous.toothMap) return previous
      return { ...previous, toothMap: nextToothMap }
    })
    setDentalRecordForm((previous) => {
      const nextToothMap = syncToothMapWithLegendCodes(previous.toothMap, legendCodes, defaultLegendCode)
      if (nextToothMap === previous.toothMap) return previous
      return { ...previous, toothMap: nextToothMap }
    })
  }, [defaultLegendCode, legendCodes])

  useEffect(() => {
    setBirthdateInput(formatDateInputDisplay(patient.birthdate))
  }, [patient.birthdate])

  useEffect(() => {
    setLastExamInput(formatDateInputDisplay(dentalHistory.lastExam))
  }, [dentalHistory.lastExam])

  const renderToothRow = (start, keyPrefix, rowType, positions, toothValues, onToothChange, disabled = false) => (
    <div className={`pr-drop-row ${rowType === 'top' ? 'pr-drop-row-top' : 'pr-drop-row-bottom'}`}>
      {Array.from({ length: 16 }, (_, index) => ({ tooth: index + start, left: positions[index] })).map(({ tooth, left }) => (
        <div key={`${keyPrefix}-${tooth}`} className="pr-drop-slot" style={{ left: `${left}%` }}>
          <select value={toothValues[`${rowType}-${tooth}`]} disabled={disabled} onChange={(event) => onToothChange(`${rowType}-${tooth}`, event.target.value)}>
            {legendCodes.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      ))}
    </div>
  )

  const renderDentalSection = (chart, start, keyPrefix, positions, toothValues, onToothChange, disabled = false) => (
    <div key={keyPrefix} className="pr-dental-section">
      {renderToothRow(start, `${keyPrefix}-top`, 'top', positions, toothValues, onToothChange, disabled)}
      <img src={chart.src} alt={chart.alt} />
      {renderToothRow(start, `${keyPrefix}-bottom`, 'bottom', positions, toothValues, onToothChange, disabled)}
    </div>
  )

  const close = () => {
    if (['details', 'health', 'allergen', 'dental-history', 'medical-history'].includes(modal)) {
      restoreSnapshot()
    }
    setServiceFormError('')
    setSelectedService(null)
    setDentalRecordForm(cloneDentalRecord(dentalRecord))
    setExportPreviewHtml('')
    setModal(null)
  }

  const openPatientModal = (nextModal) => {
    takeSnapshot()
    setModal(nextModal)
  }

  const openDatePicker = (event) => {
    event.currentTarget.showPicker?.()
  }

  const commitBirthdateFromInput = () => {
    const typedValue = `${birthdateInput || ''}`.trim()
    if (!typedValue) {
      setPatient((previous) => ({ ...previous, birthdate: '' }))
      return
    }

    const parsedIso = parseDateInputDisplay(typedValue)
    if (!parsedIso) {
      window.alert('Birthdate must follow dd/mm/yyyy format.')
      setBirthdateInput(formatDateInputDisplay(patient.birthdate))
      return
    }

    const maxIso = new Date().toISOString().slice(0, 10)
    if (parsedIso > maxIso) {
      window.alert('Birthdate cannot be in the future.')
      setBirthdateInput(formatDateInputDisplay(patient.birthdate))
      return
    }

    setPatient((previous) => ({ ...previous, birthdate: parsedIso }))
  }

  const commitLastExamFromInput = () => {
    const typedValue = `${lastExamInput || ''}`.trim()
    if (!typedValue) {
      setDentalHistory((previous) => ({ ...previous, lastExam: '' }))
      return
    }

    const parsedIso = parseDateInputDisplay(typedValue)
    if (!parsedIso) {
      window.alert('Date of last exam must follow dd/mm/yyyy format.')
      setLastExamInput(formatDateInputDisplay(dentalHistory.lastExam))
      return
    }

    setDentalHistory((previous) => ({ ...previous, lastExam: parsedIso }))
  }

  const openServiceEdit = (row = null) => {
    setServiceFormError('')
    if (row) {
      if (!row.lines || row.lines.length === 0) {
        setServiceForm(initialServiceForm())
        setModal('service-edit')
        return
      }

      const totalDiscount = roundMoney(row.lines.reduce((sum, line) => sum + Number(line.discountAmount ?? 0), 0))
      const resolvedDiscountType = row.lines.some((line) => line.discountType === 'percent') ? 'percent' : 'peso'
      setServiceForm({
        date: row.date,
        originalDate: row.date,
        lines: row.lines.map((line) => ({
          serviceId: line.serviceId,
          quantity: line.quantity ?? 1,
          unitPrice: serviceOptions.find((service) => service.id === line.serviceId)?.price ?? line.unitPrice ?? '',
        })),
        discountType: resolvedDiscountType,
        discountValue: totalDiscount,
      })
    } else {
      setServiceForm(initialServiceForm())
    }
    setModal('service-edit')
  }

  const updateServiceForm = (patch) => {
    if (serviceFormError) setServiceFormError('')
    setServiceForm((previous) => ({ ...previous, ...patch }))
  }

  const updateServiceLine = (index, patch) => {
    if (serviceFormError) setServiceFormError('')
    setServiceForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line, lineIndex) => {
        if (lineIndex !== index) return line
        const nextLine = { ...line, ...patch }
        if (Object.prototype.hasOwnProperty.call(patch, 'serviceId')) {
          if (!patch.serviceId) {
            nextLine.quantity = 1
            nextLine.unitPrice = ''
          } else {
            const selectedService = serviceOptions.find((service) => service.id === patch.serviceId)
            if (selectedService && (`${line.unitPrice ?? ''}`.trim() === '' || line.serviceId !== patch.serviceId)) {
              nextLine.unitPrice = selectedService.price
            }
          }
        }
        return nextLine
      }),
    }))
  }

  const addServiceLine = () => {
    setServiceForm((previous) => ({
      ...previous,
      lines: [...previous.lines, initialServiceLine()],
    }))
  }

  const removeServiceLine = (index) => {
    setServiceForm((previous) => ({
      ...previous,
      lines: previous.lines.filter((_, lineIndex) => lineIndex !== index),
    }))
  }

  const serviceAmounts = useMemo(() => calculateServiceAmounts(serviceForm), [serviceForm])

  const logPatientAction = useCallback(async (action, details) => {
    const { error: logError } = await supabase.from('patient_logs').insert({ patient_id: id, action, details })
    if (logError) throw logError
  }, [id])

  const updatePatientSection = useCallback(async (patch) => {
    setIsSaving(true)
    setError('')

    try {
      const { data: authData } = await supabase.auth.getUser()
      const actorId = authData?.user?.id ?? null

      const { error: updateError } = await supabase
        .from('patients')
        .update({ ...patch, updated_by: actorId })
        .eq('id', id)

      if (updateError) throw updateError

      await loadPatient()
      setModal(null)
    } catch (updateError) {
      setError(normalizeError(updateError, 'Unable to update patient information.'))
    } finally {
      setIsSaving(false)
    }
  }, [id, loadPatient])

  const saveDetails = async () => {
    if (!patient.firstName.trim() || !patient.lastName.trim()) {
      setError('First name and last name are required.')
      return
    }
    if (!SEX_OPTIONS.includes(patient.sex)) {
      setError('Please select sex as Male or Female.')
      return
    }

    await updatePatientSection({
      first_name: toTitleCase(patient.firstName.trim()),
      last_name: toTitleCase(patient.lastName.trim()),
      middle_name: toTitleCase(patient.middleName.trim()) || null,
      suffix: toTitleCase(patient.suffix.trim()) || null,
      sex: normalizeSex(patient.sex),
      birth_date: patient.birthdate || null,
      phone: patient.mobile.trim() || null,
      email: patient.email.trim() || null,
      address: toTitleCase(patient.address.trim()) || null,
      nickname: toTitleCase(patient.nickname.trim()) || null,
      civil_status: normalizeCivilStatus(patient.civilStatus) || null,
      occupation: toTitleCase(patient.occupation.trim()) || null,
      office_address: toTitleCase(patient.officeAddress.trim()) || null,
      emergency_contact_name: toTitleCase(patient.guardianName.trim()) || null,
      emergency_contact_phone: patient.guardianMobileNumber.trim() || null,
      guardian_name: toTitleCase(patient.guardianName.trim()) || null,
      guardian_mobile_number: patient.guardianMobileNumber.trim() || null,
      guardian_occupation: toTitleCase(patient.guardianOccupation.trim()) || null,
      guardian_office_address: toTitleCase(patient.guardianOfficeAddress.trim()) || null,
      authorization_accepted: patient.authorizationAccepted,
    })
  }

  const saveHealth = async () => {
    await updatePatientSection({ health_conditions: health })
  }

  const saveAllergens = async () => {
    await updatePatientSection({
      allergen_info: {
        ...allergens,
        others: toTitleCase(allergens.others || ''),
      },
    })
  }

  const saveDentalHistory = async () => {
    await updatePatientSection({
      dental_history: {
        ...dentalHistory,
        previous: toTitleCase(dentalHistory.previous || ''),
        reason: toTitleCase(dentalHistory.reason || ''),
        notes: Object.fromEntries(
          Object.entries(dentalHistory.notes || {}).map(([key, value]) => [key, toTitleCase(value)]),
        ),
      },
    })
  }

  const saveMedicalHistory = async () => {
    await updatePatientSection({
      medical_history: {
        ...medicalHistory,
        physician: toTitleCase(medicalHistory.physician || ''),
        specialty: toTitleCase(medicalHistory.specialty || ''),
        address: toTitleCase(medicalHistory.address || ''),
        notes: Object.fromEntries(
          Object.entries(medicalHistory.notes || {}).map(([key, value]) => [key, toTitleCase(value)]),
        ),
      },
    })
  }

  const saveService = async () => {
    setServiceFormError('')
    setError('')

    if (!serviceForm.date) {
      setServiceFormError('Service date is required.')
      return
    }

    const incompleteLine = (serviceForm.lines ?? []).find((line) => {
      const hasService = Boolean(line.serviceId)
      const hasTypedAmount = `${line.unitPrice ?? ''}`.trim() !== ''
      const hasCustomQuantity = Number(line.quantity ?? 1) !== 1
      return !hasService && (hasTypedAmount || hasCustomQuantity)
    })
    if (incompleteLine) {
      setServiceFormError('Please select a service for each filled row.')
      return
    }

    const invalidLine = (serviceForm.lines ?? []).find((line) => (
      line.serviceId && (toServiceQuantity(line.quantity) === null || toMoney(line.unitPrice) === null)
    ))
    if (invalidLine) {
      setServiceFormError('Please enter valid quantity and amount for all services.')
      return
    }

    const preparedLines = aggregateServiceLines(serviceForm.lines ?? [])
    if (preparedLines.length === 0) {
      setServiceFormError('Please add at least one service.')
      return
    }

    const subtotal = roundMoney(preparedLines.reduce((sum, line) => sum + line.lineAmount, 0))
    const rawDiscount = `${serviceForm.discountValue ?? ''}`.trim()
    let discountAmount = 0

    if (serviceForm.discountType === 'percent') {
      const percent = rawDiscount === '' ? 0 : Number(rawDiscount)
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        setServiceFormError('Discount percent must be between 0 and 100.')
        return
      }
      discountAmount = roundMoney((subtotal * percent) / 100)
    } else {
      const parsedDiscount = rawDiscount === '' ? 0 : toMoney(rawDiscount)
      if (parsedDiscount === null) {
        setServiceFormError('Please enter a valid discount amount.')
        return
      }
      discountAmount = roundMoney(parsedDiscount)
    }

    if (discountAmount > subtotal) {
      setServiceFormError('Discount cannot be greater than amount.')
      return
    }

    let discountLeft = roundMoney(discountAmount)
    const preparedLinesWithTotals = preparedLines.map((line, index) => {
      let lineDiscount = 0
      if (discountAmount > 0) {
        if (index === preparedLines.length - 1) {
          lineDiscount = roundMoney(discountLeft)
        } else {
          lineDiscount = roundMoney((discountAmount * line.lineAmount) / subtotal)
          discountLeft = roundMoney(discountLeft - lineDiscount)
        }
      }
      const clampedDiscount = Math.min(line.lineAmount, Math.max(0, lineDiscount))
      return {
        ...line,
        discountAmount: clampedDiscount,
        totalAmount: roundMoney(line.lineAmount - clampedDiscount),
      }
    })

    setIsSaving(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      const actorId = authData?.user?.id ?? null
      const isEditMode = Boolean(serviceForm.originalDate)
      const visitAtIso = `${serviceForm.date}T12:00:00.000Z`
      const archivedAt = new Date().toISOString()

      const loadRowsByDate = async (isoDate) => {
        const start = new Date(`${isoDate}T00:00:00.000Z`)
        const end = new Date(start)
        end.setUTCDate(end.getUTCDate() + 1)

        const { data, error: fetchError } = await supabase
          .from('service_records')
          .select('id, service_id, quantity, unit_price, discount_amount')
          .eq('patient_id', id)
          .is('archived_at', null)
          .gte('visit_at', start.toISOString())
          .lt('visit_at', end.toISOString())
          .order('created_at', { ascending: true })

        if (fetchError) throw fetchError
        return data ?? []
      }

      const targetDateRows = await loadRowsByDate(serviceForm.date)

      if (isEditMode && serviceForm.originalDate !== serviceForm.date) {
        const sourceRows = await loadRowsByDate(serviceForm.originalDate)
        if (sourceRows.length > 0) {
          const { error: archiveSourceError } = await supabase
            .from('service_records')
            .update({
              archived_at: archivedAt,
              archived_by: actorId,
              updated_by: actorId,
            })
            .in('id', sourceRows.map((row) => row.id))

          if (archiveSourceError) throw archiveSourceError
        }
      }

      const targetRowsByService = targetDateRows.reduce((accumulator, row) => {
        if (!accumulator.has(row.service_id)) accumulator.set(row.service_id, [])
        accumulator.get(row.service_id).push(row)
        return accumulator
      }, new Map())

      const touchedRowIds = new Set()
      const duplicateRowIdsToArchive = new Set()

      for (const line of preparedLinesWithTotals) {
        const existingRows = targetRowsByService.get(line.serviceId) ?? []
        const primaryRow = existingRows[0] ?? null
        const duplicateRows = existingRows.slice(1)
        duplicateRows.forEach((row) => duplicateRowIdsToArchive.add(row.id))

        let nextQuantity = line.quantity
        let nextDiscount = line.discountAmount

        if (primaryRow && !isEditMode) {
          nextQuantity = Math.max(1, Number(primaryRow.quantity ?? 1)) + line.quantity
          nextDiscount = Math.max(0, Number(primaryRow.discount_amount ?? 0)) + line.discountAmount
        }

        const nextLineAmount = roundMoney(nextQuantity * line.unitPrice)
        const clampedDiscount = Math.min(nextLineAmount, roundMoney(nextDiscount))
        const nextTotal = roundMoney(nextLineAmount - clampedDiscount)

        const payload = {
          service_id: line.serviceId,
          quantity: nextQuantity,
          unit_price: line.unitPrice,
          discount_amount: clampedDiscount,
          amount: nextTotal,
          notes: JSON.stringify({ discountType: serviceForm.discountType }),
          visit_at: visitAtIso,
          updated_by: actorId,
        }

        if (primaryRow) {
          const { error: updateError } = await supabase
            .from('service_records')
            .update(payload)
            .eq('id', primaryRow.id)
            .eq('patient_id', id)

          if (updateError) throw updateError
          touchedRowIds.add(primaryRow.id)
        } else {
          const { error: insertError } = await supabase
            .from('service_records')
            .insert({
              patient_id: id,
              ...payload,
              created_by: actorId,
            })

          if (insertError) throw insertError
        }
      }

      if (isEditMode && serviceForm.originalDate === serviceForm.date) {
        const rowsToArchive = targetDateRows
          .filter((row) => !touchedRowIds.has(row.id))
          .map((row) => row.id)

        rowsToArchive.forEach((rowId) => duplicateRowIdsToArchive.add(rowId))
      }

      if (duplicateRowIdsToArchive.size > 0) {
        const { error: archiveDuplicateError } = await supabase
          .from('service_records')
          .update({
            archived_at: archivedAt,
            archived_by: actorId,
            updated_by: actorId,
          })
          .in('id', [...duplicateRowIdsToArchive])

        if (archiveDuplicateError) throw archiveDuplicateError
      }

      if (!isEditMode) {
        await logPatientAction('service_update', `Added service record for ${serviceForm.date}`)
      }
      await loadServiceRows()
      close()
    } catch (saveError) {
      setError(normalizeError(saveError, 'Unable to save service record.'))
    } finally {
      setIsSaving(false)
    }
  }

  const saveDentalRecord = async () => {
    if (currentRole === 'receptionist') {
      setError('Receptionist is not allowed to update dental records.')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const { data: authData } = await supabase.auth.getUser()
      const actorId = authData?.user?.id ?? null

      const payload = {
        patient_id: id,
        tooth_number: 'ALL',
        findings: dentalRecordForm.notes,
        treatment: dentalRecordForm.prescriptions,
        chart_data: {
          toothMap: dentalRecordForm.toothMap,
          periodontal: dentalRecordForm.periodontal,
          occlusion: dentalRecordForm.occlusion,
          prescriptions: dentalRecordForm.prescriptions,
          notes: dentalRecordForm.notes,
          dentist: dentalRecordForm.dentist,
        },
        recorded_at: new Date().toISOString(),
        created_by: actorId,
        updated_by: actorId,
      }

      const { error: insertError } = await supabase.from('dental_records').insert(payload)
      if (insertError) throw insertError

      await logPatientAction('dental_update', 'Updated dental record')
      await loadDentalRecord()
      close()
    } catch (saveError) {
      setError(normalizeError(saveError, 'Unable to save dental record.'))
    } finally {
      setIsSaving(false)
    }
  }

  const viewPatientDocument = (documentItem) => {
    if (documentItem.fileUrl) {
      window.open(documentItem.fileUrl, '_blank', 'noopener,noreferrer')
      return
    }
    if (documentItem.storagePath) {
      const { data: publicUrlData } = supabase.storage.from('patient-documents').getPublicUrl(documentItem.storagePath)
      if (publicUrlData?.publicUrl) {
        window.open(publicUrlData.publicUrl, '_blank', 'noopener,noreferrer')
        return
      }
    }
    setError(`Document "${documentItem.fileName}" is not uploaded yet.`)
  }

  const deletePatientDocument = async (documentItem) => {
    const confirmed = window.confirm(`Delete document "${documentItem.fileName}"?`)
    if (!confirmed) return

    setError('')

    try {
      const { data: authData } = await supabase.auth.getUser()
      const actorId = authData?.user?.id ?? null
      const archivedAt = new Date().toISOString()

      const archivePayloads = [
        { archived_at: archivedAt, archived_by: actorId, updated_by: actorId },
        { archived_at: archivedAt, updated_by: actorId },
        { archived_at: archivedAt },
      ]

      const archiveBy = async (column, value) => {
        let archiveError = null
        for (const payload of archivePayloads) {
          const result = await supabase
            .from('patient_documents')
            .update(payload)
            .eq(column, value)
            .is('archived_at', null)

          archiveError = result.error
          if (!archiveError) return null
          if (archiveError.code !== '42703') break
        }
        return archiveError
      }

      let archiveError = null
      if (documentItem.dbId) {
        archiveError = await archiveBy('id', documentItem.dbId)
      }

      if (!documentItem.dbId || archiveError?.code === '42703') {
        archiveError = await supabase
          .from('patient_documents')
          .update({ archived_at: archivedAt })
          .eq('patient_id', id)
          .eq('file_name', documentItem.fileName)
          .is('archived_at', null)
          .then((result) => result.error)

        if (archiveError?.code === '42703') {
          archiveError = await supabase
            .from('patient_documents')
            .update({ archived_at: archivedAt })
            .eq('patient_id', id)
            .eq('fileName', documentItem.fileName)
            .then((result) => result.error)
        }
      }

      if (archiveError) throw archiveError

      if (documentItem.storagePath) {
        const { error: storageDeleteError } = await supabase
          .storage
          .from('patient-documents')
          .remove([documentItem.storagePath])

        if (storageDeleteError && !/not found/i.test(`${storageDeleteError.message ?? ''}`)) {
          throw storageDeleteError
        }
      }

      await loadPatientDocuments()
    } catch (deleteError) {
      setError(normalizeError(deleteError, 'Unable to delete document.'))
    }
  }

  const uploadPatientDocument = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!isAcceptedDocument(file)) {
      setError('Only PNG, JPEG, PDF, DOCX, TXT, and CSV files are allowed.')
      event.target.value = ''
      return
    }

    setIsUploadingDocument(true)
    setError('')

    try {
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${id}/${Date.now()}-${safeFileName}`

      const { error: uploadError } = await supabase
        .storage
        .from('patient-documents')
        .upload(storagePath, file, { upsert: false })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('patient-documents').getPublicUrl(storagePath)
      const { data: authData } = await supabase.auth.getUser()
      const actorId = authData?.user?.id ?? null

      const payloadVariants = [
        {
          patient_id: id,
          file_name: file.name,
          file_url: publicUrlData?.publicUrl || null,
          storage_path: storagePath,
          mime_type: file.type || null,
          file_size: file.size || null,
          created_by: actorId,
          updated_by: actorId,
        },
        {
          patient_id: id,
          file_name: file.name,
          storage_path: storagePath,
          created_by: actorId,
          updated_by: actorId,
        },
        {
          patient_id: id,
          file_name: file.name,
          created_by: actorId,
          updated_by: actorId,
        },
      ]

      let insertError = null
      for (const payload of payloadVariants) {
        const insertResult = await supabase.from('patient_documents').insert(payload)
        insertError = insertResult.error
        if (!insertError) break
        if (insertError.code !== '42703') break
      }

      if (insertError) {
        await supabase.storage.from('patient-documents').remove([storagePath])
        throw insertError
      }

      await loadPatientDocuments()
    } catch (uploadError) {
      setError(normalizeError(uploadError, 'Unable to upload document.'))
    } finally {
      event.target.value = ''
      setIsUploadingDocument(false)
    }
  }

  const buildExportHtml = () => {
    const escapeHtml = (value) => `${value ?? ''}`
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')

    const healthChecked = HEALTH.filter((item) => health[item]).join(', ') || '-'
    const allergenChecked = ALLERGENS.filter((item) => allergens.values[item]).join(', ') || '-'
    const periodontalChecked = PERIODONTAL.filter((item) => dentalRecord.periodontal[item]).join(', ') || '-'
    const occlusionChecked = OCCLUSION.filter((item) => dentalRecord.occlusion[item]).join(', ') || '-'
    const conditionNameByCode = legendOptions.reduce((accumulator, legend) => {
      accumulator[legend.code] = legend.condition_name || legend.code
      return accumulator
    }, {})
    const toothEntries = Object.entries(dentalRecord.toothMap)
      .filter(([, value]) => value && value !== defaultLegendCode)
      .map(([tooth, value]) => `${tooth}: ${conditionNameByCode[value] || value}`)
      .join(', ') || '-'
    const toothRowsHtml = Object.entries(dentalRecord.toothMap)
      .filter(([, value]) => value && value !== defaultLegendCode)
      .map(([tooth, value]) => `<tr><td>${escapeHtml(tooth)}</td><td>${escapeHtml(conditionNameByCode[value] || value)}</td></tr>`)
      .join('')
    const chartImagesHtml = DENTAL_CHART_IMAGES
      .map((chart) => `<img src="${escapeHtml(chart.src)}" alt="${escapeHtml(chart.alt)}" />`)
      .join('')
    const documentsRowsHtml = patientDocuments.length > 0
      ? patientDocuments.map((documentItem, index) => (
        `<tr><td>${index + 1}</td><td>${escapeHtml(documentItem.fileName)}</td></tr>`
      )).join('')
      : '<tr><td colspan="2">No documents uploaded.</td></tr>'

    const serviceEntries = serviceRows.flatMap((row) => (
      row.lines.map((line) => ({
        date: row.date,
        service: line.service,
        quantity: line.quantity,
        amount: line.lineAmount,
        discount: line.discountAmount,
        total: line.total,
      }))
    ))

    const serviceRowsHtml = serviceEntries.length > 0
      ? serviceEntries.map((row) => (
        `<tr><td>${escapeHtml(formatDateOnly(row.date))}</td><td>${escapeHtml(row.service)}</td><td>${escapeHtml(row.quantity)}</td><td>${escapeHtml(formatCurrency(row.amount))}</td><td>${escapeHtml(formatCurrency(row.discount))}</td><td>${escapeHtml(formatCurrency(row.total))}</td></tr>`
      )).join('')
      : '<tr><td colspan="6">No service records yet.</td></tr>'

    const buildHistoryAnswerRowsHtml = (questions, answers, notes) => questions.map((question, index) => {
      const answer = answers?.[index] || '-'
      const note = `${notes?.[index] ?? ''}`.trim()
      const answerDisplay = answer === 'YES' && note ? `${answer} - ${note}` : answer
      return `<tr><td>${escapeHtml(question.text)}</td><td>${escapeHtml(answerDisplay)}</td></tr>`
    }).join('')

    const dentalHistoryRowsHtml = buildHistoryAnswerRowsHtml(DQ, dentalHistory.answers, dentalHistory.notes)
    const medicalHistoryRowsHtml = buildHistoryAnswerRowsHtml(MQ, medicalHistory.answers, medicalHistory.notes)

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Patient Export - ${escapeHtml(patientCode)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #1f2d35; }
    h1, h2, h3 { margin: 0 0 10px; }
    h1 { font-size: 24px; color: #0d668c; }
    h2 { font-size: 18px; margin-top: 26px; border-bottom: 1px solid #d5e1e8; padding-bottom: 6px; }
    h3 { font-size: 15px; margin-top: 16px; color: #274151; }
    .meta { margin: 6px 0 14px; font-size: 13px; color: #445864; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; font-size: 13px; }
    .field strong { display: inline-block; min-width: 130px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    th, td { border: 1px solid #cfdbe3; padding: 8px; text-align: left; }
    th { background: #eef4f8; }
    .charts { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 10px; }
    .charts img { width: 100%; border: 1px solid #d5e1e8; border-radius: 6px; }
    .section-block { page-break-inside: avoid; }
    .small-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; font-size: 12px; }
    .small { font-size: 12px; color: #506571; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>Patient Record Export</h1>
  <div class="meta">Generated on ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
  <div class="meta">Patient ID: <strong>${escapeHtml(patientCode)}</strong></div>

  <h2>Patient Information</h2>
  <div class="grid">
    <div class="field"><strong>Name:</strong> ${escapeHtml(`${patient.lastName}, ${patient.firstName}`)}</div>
    <div class="field"><strong>Sex:</strong> ${escapeHtml(patient.sex || '-')}</div>
    <div class="field"><strong>Age:</strong> ${escapeHtml(calculateAge(patient.birthdate))}</div>
    <div class="field"><strong>Birthdate:</strong> ${escapeHtml(formatDateOnly(patient.birthdate))}</div>
    <div class="field"><strong>Mobile:</strong> ${escapeHtml(patient.mobile || '-')}</div>
    <div class="field"><strong>Email:</strong> ${escapeHtml(patient.email || '-')}</div>
    <div class="field"><strong>Address:</strong> ${escapeHtml(patient.address || '-')}</div>
    <div class="field"><strong>Civil Status:</strong> ${escapeHtml(patient.civilStatus || '-')}</div>
    <div class="field"><strong>Occupation:</strong> ${escapeHtml(patient.occupation || '-')}</div>
    <div class="field"><strong>Office Address:</strong> ${escapeHtml(patient.officeAddress || '-')}</div>
    <div class="field"><strong>Guardian:</strong> ${escapeHtml(patient.guardianName || '-')}</div>
    <div class="field"><strong>Guardian Mobile:</strong> ${escapeHtml(patient.guardianMobileNumber || '-')}</div>
    <div class="field"><strong>Health Conditions:</strong> ${escapeHtml(healthChecked)}</div>
    <div class="field"><strong>Allergens:</strong> ${escapeHtml(allergenChecked)}</div>
  </div>

  <div class="section-block">
  <h2>Dental Record</h2>
  <div class="grid">
    <div class="field"><strong>Periodontal:</strong> ${escapeHtml(periodontalChecked)}</div>
    <div class="field"><strong>Occlusion:</strong> ${escapeHtml(occlusionChecked)}</div>
    <div class="field"><strong>Dentist:</strong> ${escapeHtml(dentalRecord.dentist || '-')}</div>
    <div class="field"><strong>Tooth Conditions:</strong> ${escapeHtml(toothEntries)}</div>
    <div class="field"><strong>Prescriptions:</strong> ${escapeHtml(dentalRecord.prescriptions || '-')}</div>
    <div class="field"><strong>Notes:</strong> ${escapeHtml(dentalRecord.notes || '-')}</div>
    <div class="field"><strong>Last Updated:</strong> ${escapeHtml(formatDateTime(dentalRecordMeta.updatedAt))}</div>
    <div class="field"><strong>Updated By:</strong> ${escapeHtml(dentalRecordMeta.updatedByName || '-')}</div>
  </div>
  <h3>Dental Charts</h3>
  <div class="charts">
    ${chartImagesHtml}
  </div>
  <h3>Tooth Condition Map</h3>
  <table>
    <thead>
      <tr><th>Tooth Position</th><th>Condition Name</th></tr>
    </thead>
    <tbody>
      ${toothRowsHtml || '<tr><td colspan="2">No marked tooth conditions.</td></tr>'}
    </tbody>
  </table>
  </div>

  <div class="section-block">
  <h2>Dental and Medical History</h2>
  <div class="small-grid">
    <div><strong>Previous Dentist:</strong> ${escapeHtml(dentalHistory.previous || '-')}</div>
    <div><strong>Last Dental Exam:</strong> ${escapeHtml(formatDateOnly(dentalHistory.lastExam))}</div>
    <div><strong>Consultation Reason:</strong> ${escapeHtml(dentalHistory.reason || '-')}</div>
    <div><strong>Physician:</strong> ${escapeHtml(medicalHistory.physician || '-')}</div>
    <div><strong>Physician Specialty:</strong> ${escapeHtml(medicalHistory.specialty || '-')}</div>
    <div><strong>Physician Address:</strong> ${escapeHtml(medicalHistory.address || '-')}</div>
  </div>
  <h3>Dental History Answers</h3>
  <table>
    <thead>
      <tr><th>Question</th><th>Answer</th></tr>
    </thead>
    <tbody>
      ${dentalHistoryRowsHtml}
    </tbody>
  </table>
  <h3>Medical History Answers</h3>
  <table>
    <thead>
      <tr><th>Question</th><th>Answer</th></tr>
    </thead>
    <tbody>
      ${medicalHistoryRowsHtml}
    </tbody>
  </table>
  </div>

  <div class="section-block">
  <h2>Service Records</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Service</th>
        <th>Qty</th>
        <th>Amount (PHP)</th>
        <th>Discount (PHP)</th>
        <th>Total (PHP)</th>
      </tr>
    </thead>
    <tbody>
      ${serviceRowsHtml}
    </tbody>
  </table>
  </div>

  <div class="section-block">
  <h2>Documents</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Document Name</th></tr>
    </thead>
    <tbody>
      ${documentsRowsHtml}
    </tbody>
  </table>
  </div>

  <p class="small">Prepared by: ${escapeHtml(currentProfile?.full_name || 'Dent22 User')}</p>
</body>
</html>`
  }

  const handleExport = () => {
    try {
      setError('')
      setExportPreviewHtml(buildExportHtml())
      setModal('export-preview')
    } catch {
      setError('Unable to prepare export preview.')
    }
  }

  const printExportPreview = () => {
    const frameWindow = exportPreviewFrameRef.current?.contentWindow
    if (!frameWindow) {
      setError('Unable to open export preview for printing.')
      return
    }
    frameWindow.focus()
    frameWindow.print()
  }

  if (loading) {
    return <p>Loading patient details...</p>
  }

  if (!patient.dbId) {
    return (
      <>
        <header className="page-header"><h1>Patient Records</h1></header>
        <p className="error">{error || 'Patient not found.'}</p>
        <button type="button" className="ghost" onClick={() => navigate('/records')}>Back to Records</button>
      </>
    )
  }

  return (
    <>
      <header className="page-header"><h1>Patient Records</h1></header>
      {error ? <p className="error">{error}</p> : null}

      <section className="panel tabs-panel patient-details-page">
        <div className="panel-tabs add-patient-tabs patient-record-tabs">
          {['patient', 'dental', 'service'].map((key) => (
            <button key={key} type="button" className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
              {key === 'patient' ? 'Patient Information' : key === 'dental' ? 'Dental Records' : 'Service Records'}
            </button>
          ))}
        </div>

        <div className="actions-row">
          {tab === 'patient' ? <button type="button" className="view" onClick={handleExport}>Export</button> : null}
          {tab === 'dental' ? (
            <button
              type="button"
              className="primary"
              onClick={() => {
                void loadLegendOptions()
                setDentalRecordForm(cloneDentalRecord(dentalRecord))
                setModal('dental-record')
              }}
              disabled={currentRole === 'receptionist'}
              title={currentRole === 'receptionist' ? 'Receptionist cannot update dental records.' : 'Update dental record'}
            >
              + Update Dental Record
            </button>
          ) : null}
          {tab === 'service' ? <button type="button" className="primary" onClick={() => openServiceEdit()}>+ Add Service Record</button> : null}
        </div>

        <div className={`patient-print-area ${tab === 'patient' ? 'active' : ''}`}>
          <div className="pr-banner">
            <div className="pr-avatar-wrap"><div className="pr-avatar-head" /><div className="pr-avatar-body" /></div>
            <div className="pr-name"><small>Patient Name</small><h2>{patient.lastName}, {patient.firstName}</h2></div>
            <div className="pr-id"><small>Patient ID</small><strong>{patientCode}</strong></div>
          </div>

          {tab === 'patient' ? (
            <>
              <div className="pr-grid">
                <article className="pr-card">
                  <div className="pr-card-head">
                    <h3>Details</h3>
                    <button type="button" className="mini-edit-btn" onClick={() => openPatientModal('details')}>&#9998;</button>
                  </div>
                  <div className="pr-detail-list">
                    <div className="pr-detail-item"><span className="pr-detail-label">Nickname</span><span className="pr-detail-value">{patient.nickname || '-'}</span></div>
                    <div className="pr-detail-item"><span className="pr-detail-label">Sex</span><span className="pr-detail-value">{patient.sex || '-'}</span></div>
                    <div className="pr-detail-item"><span className="pr-detail-label">Age</span><span className="pr-detail-value">{calculateAge(patient.birthdate)}</span></div>
                    <div className="pr-detail-item"><span className="pr-detail-label">Civil Status</span><span className="pr-detail-value">{patient.civilStatus || '-'}</span></div>
                    <div className="pr-detail-item"><span className="pr-detail-label">Birthdate</span><span className="pr-detail-value">{formatDateOnly(patient.birthdate)}</span></div>
                    <div className="pr-detail-item pr-detail-item-wide"><span className="pr-detail-label">Mobile Number</span><span className="pr-detail-value">{patient.mobile || '-'}</span></div>
                    <div className="pr-detail-item"><span className="pr-detail-label">Occupation</span><span className="pr-detail-value">{patient.occupation || '-'}</span></div>
                    <div className="pr-detail-item"><span className="pr-detail-label">Office Address</span><span className="pr-detail-value">{patient.officeAddress || '-'}</span></div>
                    <div className="pr-detail-item pr-detail-item-wide"><span className="pr-detail-label">Address</span><span className="pr-detail-value">{patient.address || '-'}</span></div>
                    <div className="pr-detail-item pr-detail-item-wide"><span className="pr-detail-label">Email</span><span className="pr-detail-value">{patient.email || '-'}</span></div>
                    <div className="pr-detail-item"><span className="pr-detail-label">Guardian Name</span><span className="pr-detail-value">{patient.guardianName || '-'}</span></div>
                    <div className="pr-detail-item"><span className="pr-detail-label">Guardian Mobile</span><span className="pr-detail-value">{patient.guardianMobileNumber || '-'}</span></div>
                  </div>
                </article>
                <div className="pr-stack">
                  <article className="pr-card">
                    <div className="pr-card-head">
                      <h3>Health Status</h3>
                      <button type="button" className="mini-edit-btn" onClick={() => openPatientModal('health')}>&#9998;</button>
                    </div>
                    <div className="mini-check-grid three-col">
                      {HEALTH.map((item) => <label key={item}><input type="checkbox" checked={health[item]} readOnly />{item}</label>)}
                    </div>
                  </article>
                  <article className="pr-card">
                    <div className="pr-card-head">
                      <h3>Allergen Information</h3>
                      <button type="button" className="mini-edit-btn" onClick={() => openPatientModal('allergen')}>&#9998;</button>
                    </div>
                    <div className="mini-check-grid two-col">
                      {ALLERGENS.map((item) => <label key={item}><input type="checkbox" checked={allergens.values[item]} readOnly />{item}</label>)}
                      <label className="span-3">Others, please specify:<input type="text" readOnly value={allergens.others || ''} /></label>
                    </div>
                  </article>
                </div>
              </div>

              <div className="pr-grid second-row">
                <article className="pr-card">
                  <div className="pr-card-head">
                    <h3>Dental History</h3>
                    <button type="button" className="mini-edit-btn" onClick={() => openPatientModal('dental-history')}>&#9998;</button>
                  </div>
                  <div className="two-field-line"><p><strong>Name of Previous Dentist</strong><span>{dentalHistory.previous || '-'}</span></p><p><strong>Date of last exam</strong><span>{formatDateOnly(dentalHistory.lastExam)}</span></p></div>
                  <p className="single-field-line"><strong>What is the reason for Dental Consultation</strong><span>{dentalHistory.reason || '-'}</span></p>
                  <div className="history-answers">
                    {DQ.map((question, index) => {
                      const answer = dentalHistory.answers[index] || '-'
                      const note = `${dentalHistory.notes?.[index] ?? ''}`.trim()
                      const answerDisplay = answer === 'YES' && note ? `${answer} - ${note}` : answer
                      return (
                        <p key={question.text}>
                          <span>{question.text}</span>
                          <strong className={answer === 'NO' ? 'is-no' : ''}>{answerDisplay}</strong>
                        </p>
                      )
                    })}
                  </div>
                </article>
                <article className="pr-card">
                  <div className="pr-card-head">
                    <h3>Medical History</h3>
                    <button type="button" className="mini-edit-btn" onClick={() => openPatientModal('medical-history')}>&#9998;</button>
                  </div>
                  <div className="two-field-line"><p><strong>Name of Physician/Medical Doctor</strong><span>{medicalHistory.physician || '-'}</span></p><p><strong>Specialty (if available)</strong><span>{medicalHistory.specialty || '-'}</span></p></div>
                  <p className="single-field-line"><strong>Address</strong><span>{medicalHistory.address || '-'}</span></p>
                  <div className="history-answers">
                    {MQ.map((question, index) => {
                      const answer = medicalHistory.answers[index] || '-'
                      const note = `${medicalHistory.notes?.[index] ?? ''}`.trim()
                      const answerDisplay = answer === 'YES' && note ? `${answer} - ${note}` : answer
                      return (
                        <p key={question.text}>
                          <span>{question.text}</span>
                          <strong className={answer === 'NO' ? 'is-no' : ''}>{answerDisplay}</strong>
                        </p>
                      )
                    })}
                  </div>
                </article>
              </div>

              <article className="pr-card pr-documents-card">
                <div className="pr-card-head pr-documents-head-wrap">
                  <h3>Documents</h3>
                  <label className={`mini-doc-btn ${isUploadingDocument ? 'disabled' : ''}`}>
                    {isUploadingDocument ? 'Uploading...' : '+ Add Documents'}
                    <input type="file" accept=".png,.jpg,.jpeg,.pdf,.docx,.txt,.csv" onChange={(event) => { void uploadPatientDocument(event) }} disabled={isUploadingDocument} />
                  </label>
                </div>
                <div className="pr-documents-table">
                  <div className="pr-documents-head">
                    <span>#</span>
                    <span>Document</span>
                    <span>Action</span>
                  </div>
                  {patientDocuments.map((documentItem, index) => (
                    <div key={documentItem.id} className="pr-documents-row">
                      <span>{index + 1}</span>
                      <span className="pr-documents-name">{documentItem.fileName}</span>
                      <div className="document-actions">
                        <button type="button" className="view" onClick={() => viewPatientDocument(documentItem)}>View</button>
                        <button type="button" className="document-delete-btn" onClick={() => { void deletePatientDocument(documentItem) }}>Delete</button>
                      </div>
                    </div>
                  ))}
                  {patientDocuments.length === 0 ? <div className="pr-documents-row pr-documents-empty"><span>-</span><span>No documents uploaded yet.</span><span>-</span></div> : null}
                </div>
              </article>

              <article className="pr-card pr-authorization"><h3>Authorization and Release</h3><p>I certify that I have read and understood the questionnaire and authorize records release. Current status: <strong>{patient.authorizationAccepted ? 'Accepted' : 'Not accepted'}</strong></p></article>
              <div className="pr-meta-row"><span>Date of last changes: {formatDateTime(patient.updatedAt || patient.createdAt)}</span><span>Last changes by: {lastChangedBy}</span></div>
            </>
          ) : null}
        </div>

        {tab === 'dental' ? (
          <article className="pr-card pr-dental-layout pr-dental-prototype">
            <div className="pr-split-header">
              <article className="pr-screen-card"><h4>Periodontal Screening</h4><div className="pr-option-grid">{PERIODONTAL.map((item) => <label key={item}><input type="checkbox" checked={dentalRecord.periodontal[item]} readOnly />{item}</label>)}</div></article>
              <article className="pr-screen-card"><h4>Occlusion</h4><div className="pr-option-grid">{OCCLUSION.map((item) => <label key={item}><input type="checkbox" checked={dentalRecord.occlusion[item]} readOnly />{item}</label>)}</div></article>
            </div>
            <div className="pr-dentist-tag"><strong>Dentist:</strong> <span className="pr-dentist-name">{dentalRecord.dentist}</span></div>
            <section className="pr-dental-history-wrap">
              <h3>Dental History</h3>
              <div className="pr-dental-chart">{renderDentalSection(DENTAL_CHART_IMAGES[0], 1, 'chart-1', TOOTH_X_POSITIONS_BY_CHART.chart1, dentalRecord.toothMap, () => {}, true)}<div className="pr-dental-divider" />{renderDentalSection(DENTAL_CHART_IMAGES[1], 17, 'chart-2', TOOTH_X_POSITIONS_BY_CHART.chart2, dentalRecord.toothMap, () => {}, true)}</div>
            </section>
            <div className="pr-notes-grid"><label>Dental Prescriptions<textarea readOnly value={dentalRecord.prescriptions} /></label><label>Dental Notes<textarea readOnly value={dentalRecord.notes} /></label></div>
            <div className="pr-meta-row"><span>Date of last changes: {formatDateTime(dentalRecordMeta.updatedAt)}</span><span>Last changes by: {dentalRecordMeta.updatedByName}</span></div>
          </article>
        ) : null}

        {tab === 'service' ? (
          <article className="service-list-card">
            <div className="service-list-head"><h3>Service Records</h3><h3>Actions</h3></div>
            {serviceRows.map((row) => (
              <div key={row.id} className="service-list-row">
                <span>{formatDateOnly(row.date)}</span>
                <button type="button" className="view" onClick={() => { setSelectedService(row); setModal('service-view') }}>View</button>
                <button type="button" className="mini-edit-btn" onClick={() => openServiceEdit(row)}>&#9998;</button>
              </div>
            ))}
            {serviceRows.length === 0 ? <p>No service records yet.</p> : null}
          </article>
        ) : null}

        <div className="panel-footer details-footer"><button type="button" className="ghost" onClick={() => navigate('/records')}>Back to Records</button></div>
      </section>

      {modal ? <div className="modal-backdrop" onClick={close} /> : null}

      {modal === 'details' ? (
        <div className="pr-modal">
          <div className="pr-modal-head"><h2>Update Details</h2><button type="button" onClick={close}>X</button></div>
          <div className="pr-modal-body pr-modal-scroll">
            <div className="history-top-grid">
              <label>Lastname*<input type="text" value={patient.lastName} onChange={(event) => setPatient((previous) => ({ ...previous, lastName: event.target.value }))} /></label>
              <label>Firstname*<input type="text" value={patient.firstName} onChange={(event) => setPatient((previous) => ({ ...previous, firstName: event.target.value }))} /></label>
              <label>Middle Name<input type="text" value={patient.middleName} onChange={(event) => setPatient((previous) => ({ ...previous, middleName: event.target.value }))} /></label>
              <label>Suffix<input type="text" value={patient.suffix} onChange={(event) => setPatient((previous) => ({ ...previous, suffix: event.target.value }))} /></label>
              <label>
                Sex
                <select value={patient.sex} onChange={(event) => setPatient((previous) => ({ ...previous, sex: event.target.value }))}>
                  <option value="">Select sex</option>
                  {SEX_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Birthdate
                <div className="birthdate-input-wrap">
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    maxLength={10}
                    style={{ color: birthdateInput ? '#111827' : '#9aa6af' }}
                    value={birthdateInput}
                    onChange={(event) => setBirthdateInput(normalizeDateInputTyping(event.target.value))}
                    onBlur={commitBirthdateFromInput}
                  />
                  <button type="button" className="birthdate-picker-btn" onClick={() => birthdatePickerRef.current?.showPicker?.()} aria-label="Open birthdate picker">
                    &#128197;
                  </button>
                  <input
                    ref={birthdatePickerRef}
                    type="date"
                    className="birthdate-picker-hidden"
                    max={new Date().toISOString().slice(0, 10)}
                    value={patient.birthdate || ''}
                    onChange={(event) => {
                      const iso = event.target.value
                      setPatient((previous) => ({ ...previous, birthdate: iso }))
                      setBirthdateInput(formatDateInputDisplay(iso))
                    }}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </div>
              </label>
              <label>Nickname<input type="text" value={patient.nickname} onChange={(event) => setPatient((previous) => ({ ...previous, nickname: event.target.value }))} /></label>
              <label>Email<input type="email" value={patient.email} onChange={(event) => setPatient((previous) => ({ ...previous, email: event.target.value }))} /></label>
              <label>
                Civil Status
                <select
                  value={patient.civilStatus}
                  onChange={(event) => setPatient((previous) => ({ ...previous, civilStatus: event.target.value }))}
                  style={{ color: patient.civilStatus ? '#111827' : '#9aa6af' }}
                >
                  <option value="">Select civil status</option>
                  {CIVIL_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>Occupation<input type="text" value={patient.occupation} onChange={(event) => setPatient((previous) => ({ ...previous, occupation: event.target.value }))} /></label>
              <label className="span-2">Current Address*<input type="text" value={patient.address} onChange={(event) => setPatient((previous) => ({ ...previous, address: event.target.value }))} /></label>
              <label>Mobile Number*<input type="text" value={patient.mobile} onChange={(event) => setPatient((previous) => ({ ...previous, mobile: event.target.value }))} /></label>
              <label className="span-2">Office Address<input type="text" value={patient.officeAddress} onChange={(event) => setPatient((previous) => ({ ...previous, officeAddress: event.target.value }))} /></label>
              <label>Guardian Name<input type="text" value={patient.guardianName} onChange={(event) => setPatient((previous) => ({ ...previous, guardianName: event.target.value }))} /></label>
              <label>Guardian Mobile<input type="text" value={patient.guardianMobileNumber} onChange={(event) => setPatient((previous) => ({ ...previous, guardianMobileNumber: event.target.value }))} /></label>
              <label>Guardian Occupation<input type="text" value={patient.guardianOccupation} onChange={(event) => setPatient((previous) => ({ ...previous, guardianOccupation: event.target.value }))} /></label>
              <label className="span-2">Guardian Office Address<input type="text" value={patient.guardianOfficeAddress} onChange={(event) => setPatient((previous) => ({ ...previous, guardianOfficeAddress: event.target.value }))} /></label>
            </div>
            <div className="modal-actions"><button type="button" className="danger-btn" onClick={close}>Cancel</button><button type="button" className="success-btn" onClick={() => { void saveDetails() }} disabled={isSaving}>Save</button></div>
          </div>
        </div>
      ) : null}

      {modal === 'health' ? <div className="pr-modal"><div className="pr-modal-head"><h2>Update Health Status</h2><button type="button" onClick={close}>X</button></div><div className="pr-modal-body"><div className="mini-check-grid three-col">{HEALTH.map((item) => <label key={item}><input type="checkbox" checked={health[item]} onChange={() => setHealth((previous) => ({ ...previous, [item]: !previous[item] }))} />{item}</label>)}</div><div className="modal-actions"><button type="button" className="danger-btn" onClick={close}>Cancel</button><button type="button" className="success-btn" onClick={() => { void saveHealth() }} disabled={isSaving}>Save</button></div></div></div> : null}

      {modal === 'allergen' ? <div className="pr-modal"><div className="pr-modal-head"><h2>Update Allergen Information</h2><button type="button" onClick={close}>X</button></div><div className="pr-modal-body"><div className="mini-check-grid two-col">{ALLERGENS.map((item) => <label key={item}><input type="checkbox" checked={allergens.values[item]} onChange={() => setAllergens((previous) => ({ ...previous, values: { ...previous.values, [item]: !previous.values[item] } }))} />{item}</label>)}<label>Others, please specify:<input type="text" value={allergens.others} onChange={(event) => setAllergens((previous) => ({ ...previous, others: event.target.value }))} /></label></div><div className="modal-actions"><button type="button" className="danger-btn" onClick={close}>Cancel</button><button type="button" className="success-btn" onClick={() => { void saveAllergens() }} disabled={isSaving}>Save</button></div></div></div> : null}

      {modal === 'dental-history' ? (
        <div className="pr-modal">
          <div className="pr-modal-head"><h2>Update Dental History</h2><button type="button" onClick={close}>X</button></div>
          <div className="pr-modal-body pr-modal-scroll">
            <div className="history-top-grid">
              <label>Name of Previous Dentist<input type="text" value={dentalHistory.previous} onChange={(event) => setDentalHistory((previous) => ({ ...previous, previous: event.target.value }))} /></label>
              <label>
                Date of last Exam
                <div className="birthdate-input-wrap">
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    maxLength={10}
                    style={{ color: lastExamInput ? '#111827' : '#9aa6af' }}
                    value={lastExamInput}
                    onChange={(event) => setLastExamInput(normalizeDateInputTyping(event.target.value))}
                    onBlur={commitLastExamFromInput}
                  />
                  <button type="button" className="birthdate-picker-btn" onClick={() => lastExamPickerRef.current?.showPicker?.()} aria-label="Open exam date picker">
                    &#128197;
                  </button>
                  <input
                    ref={lastExamPickerRef}
                    type="date"
                    className="birthdate-picker-hidden"
                    value={dentalHistory.lastExam}
                    onChange={(event) => {
                      const iso = event.target.value
                      setDentalHistory((previous) => ({ ...previous, lastExam: iso }))
                      setLastExamInput(formatDateInputDisplay(iso))
                    }}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </div>
              </label>
              <label className="span-2">What is the reason for Dental Consultation?<input type="text" value={dentalHistory.reason} onChange={(event) => setDentalHistory((previous) => ({ ...previous, reason: event.target.value }))} /></label>
            </div>
            <YesNoEditor questions={DQ} historyState={dentalHistory} setHistoryState={setDentalHistory} />
            <div className="modal-actions"><button type="button" className="danger-btn" onClick={close}>Cancel</button><button type="button" className="success-btn" onClick={() => { void saveDentalHistory() }} disabled={isSaving}>Save</button></div>
          </div>
        </div>
      ) : null}

      {modal === 'medical-history' ? (
        <div className="pr-modal">
          <div className="pr-modal-head"><h2>Update Medical History</h2><button type="button" onClick={close}>X</button></div>
          <div className="pr-modal-body pr-modal-scroll">
            <div className="history-top-grid">
              <label>Name of Physician/Medical Doctor<input type="text" value={medicalHistory.physician} onChange={(event) => setMedicalHistory((previous) => ({ ...previous, physician: event.target.value }))} /></label>
              <label>Specialty (if available)<input type="text" value={medicalHistory.specialty} onChange={(event) => setMedicalHistory((previous) => ({ ...previous, specialty: event.target.value }))} /></label>
              <label className="span-2">Address<input type="text" value={medicalHistory.address} onChange={(event) => setMedicalHistory((previous) => ({ ...previous, address: event.target.value }))} /></label>
            </div>
            <YesNoEditor questions={MQ} historyState={medicalHistory} setHistoryState={setMedicalHistory} />
            <div className="modal-actions"><button type="button" className="danger-btn" onClick={close}>Cancel</button><button type="button" className="success-btn" onClick={() => { void saveMedicalHistory() }} disabled={isSaving}>Save</button></div>
          </div>
        </div>
      ) : null}

      {modal === 'service-view' && selectedService ? (
        <div className="pr-modal">
          <div className="pr-modal-head"><h2>View</h2><button type="button" onClick={close}>X</button></div>
          <div className="pr-modal-body">
            <div className="service-date-row"><strong>Date</strong><span>{formatDateOnly(selectedService.date)}</span></div>
            <div className="service-view-table">
              <div className="service-view-head"><span>Services</span><span>Quantity</span><span>Amount (PHP)</span><span>Discount (PHP)</span><span>Total (PHP)</span></div>
              {selectedService.lines.map((line) => (
                <div key={line.id} className="service-view-line">
                  <span>{line.service}</span>
                  <span>{line.quantity}</span>
                  <span>{formatCurrency(line.lineAmount)}</span>
                  <span>{formatCurrency(line.discountAmount)}</span>
                  <span>{formatCurrency(line.total)}</span>
                </div>
              ))}
            </div>
            <p className="service-last-change">Subtotal: <strong>&#8369; {formatCurrency(selectedService.total)}</strong></p>
            <p className="service-last-change">Last Changes by: {selectedService.by}</p>
            <div className="modal-actions center"><button type="button" className="view" onClick={close}>Done</button></div>
          </div>
        </div>
      ) : null}

      {modal === 'service-edit' ? (
        <div className="pr-modal service-ledger-modal">
          <div className="pr-modal-head"><h2>{serviceForm.originalDate ? 'Edit' : 'Add'} Service Record</h2><button type="button" onClick={close}>X</button></div>
          <div className="pr-modal-body pr-modal-scroll">
            <div className="service-ledger-date">
              <span className="service-ledger-date-label">Date</span>
              <label className="service-ledger-date-field">
                <input
                  type="date"
                  className="easy-date-input"
                  value={serviceForm.date}
                  onClick={openDatePicker}
                  onFocus={openDatePicker}
                  onChange={(event) => { updateServiceForm({ date: event.target.value }) }}
                />
              </label>
            </div>
            <div className="service-ledger-table">
              <div className="service-ledger-head"><span>Services</span><span>Quantity</span><span>Amount (PHP)</span><span>Remove</span></div>
              <div className="service-ledger-rows">
                {serviceForm.lines.map((line, index) => {
                  return (
                    <div key={`service-line-${index}`} className="service-ledger-row">
                      <div className="service-ledger-service-cell">
                        <select value={line.serviceId} onChange={(event) => updateServiceLine(index, { serviceId: event.target.value })}>
                          <option value="">Select service</option>
                          {serviceOptions.map((service) => <option key={service.id} value={service.id}>{service.service_name}</option>)}
                        </select>
                      </div>
                      <div className="service-ledger-qty">
                        <button type="button" className="service-ledger-qty-btn" onClick={() => updateServiceLine(index, { quantity: Math.max(1, Number(line.quantity || 1) - 1) })} disabled={!line.serviceId || Number(line.quantity || 1) <= 1}>-</button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          value={line.quantity ?? 1}
                          onChange={(event) => updateServiceLine(index, { quantity: event.target.value })}
                          disabled={!line.serviceId}
                        />
                        <button type="button" className="service-ledger-qty-btn" onClick={() => updateServiceLine(index, { quantity: Number(line.quantity || 1) + 1 })} disabled={!line.serviceId}>+</button>
                      </div>
                      <label className="service-ledger-amount">
                        <span>&#8369;</span>
                        <input type="number" inputMode="decimal" value={line.unitPrice} min="0" step="0.01" onChange={(event) => updateServiceLine(index, { unitPrice: event.target.value })} />
                      </label>
                      <div className="service-ledger-remove-cell">
                        <button type="button" className="service-ledger-remove-line" onClick={() => removeServiceLine(index)} title="Remove service">
                          &#10005;
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <button type="button" className="service-ledger-add-line" onClick={addServiceLine}>+ Add another service</button>
              <div className="service-ledger-discount-wrap">
                <div className="service-ledger-discount-left">
                  <strong>Discount</strong>
                  <select value={serviceForm.discountType} onChange={(event) => updateServiceForm({ discountType: event.target.value })} className="service-ledger-discount-mode">
                    <option value="percent">% Percent</option>
                    <option value="peso">Peso</option>
                  </select>
                </div>
                <div className="service-ledger-discount-right">
                  <label className="service-ledger-discount-input">
                    <span>{serviceForm.discountType === 'percent' ? '%' : '\u20B1'}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={serviceForm.discountValue}
                      onChange={(event) => updateServiceForm({ discountValue: event.target.value })}
                    />
                  </label>
                </div>
              </div>
              <div className="service-ledger-total"><strong>Total</strong><strong>{serviceAmounts.totalAmount === null ? '-' : `\u20B1 ${formatCurrency(serviceAmounts.totalAmount)}`}</strong></div>
            </div>
            {serviceFormError ? <p className="nav-password-error service-ledger-error">{serviceFormError}</p> : null}
            <div className="modal-actions"><button type="button" className="danger-btn" onClick={close}>Cancel</button><button type="button" className="success-btn" onClick={() => { void saveService() }} disabled={isSaving}>{serviceForm.originalDate ? 'Update' : 'Add'}</button></div>
          </div>
        </div>
      ) : null}

      {modal === 'export-preview' ? (
        <div className="pr-modal export-preview-modal">
          <div className="pr-modal-head"><h2>Export Preview</h2><button type="button" onClick={close}>X</button></div>
          <div className="pr-modal-body export-preview-body">
            <div className="export-preview-frame-wrap">
              <iframe
                ref={exportPreviewFrameRef}
                title="Patient export preview"
                className="export-preview-frame"
                srcDoc={exportPreviewHtml}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="danger-btn" onClick={close}>Close</button>
              <button type="button" className="success-btn" onClick={printExportPreview}>Print / Save PDF</button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'dental-record' ? (
        <div className="pr-modal">
          <div className="pr-modal-head"><h2>Update Dental Records</h2><button type="button" onClick={close}>X</button></div>
          <div className="pr-modal-body pr-modal-scroll pr-dental-record-modal">
            <div className="pr-modal-section-title">Check the Following</div>
            <div className="pr-dental-check-grid">
              <article className="pr-dental-check-card"><h4>Periodontal Screening</h4><div className="pr-dental-check-options">{PERIODONTAL.map((item) => <label key={`modal-periodontal-${item}`}><input type="checkbox" checked={dentalRecordForm.periodontal[item]} onChange={() => setDentalRecordForm((previous) => ({ ...previous, periodontal: { ...previous.periodontal, [item]: !previous.periodontal[item] } }))} />{item}</label>)}</div></article>
              <article className="pr-dental-check-card"><h4>Occlusion</h4><div className="pr-dental-check-options">{OCCLUSION.map((item) => <label key={`modal-occlusion-${item}`}><input type="checkbox" checked={dentalRecordForm.occlusion[item]} onChange={() => setDentalRecordForm((previous) => ({ ...previous, occlusion: { ...previous.occlusion, [item]: !previous.occlusion[item] } }))} />{item}</label>)}</div></article>
            </div>

            <div className="pr-modal-section-title">Dental Chart</div>
            <div className="pr-dental-chart">{renderDentalSection(DENTAL_CHART_IMAGES[0], 1, 'modal-chart-1', TOOTH_X_POSITIONS_BY_CHART.chart1, dentalRecordForm.toothMap, (tooth, value) => setDentalRecordForm((previous) => ({ ...previous, toothMap: { ...previous.toothMap, [tooth]: value } })))}<div className="pr-dental-divider" />{renderDentalSection(DENTAL_CHART_IMAGES[1], 17, 'modal-chart-2', TOOTH_X_POSITIONS_BY_CHART.chart2, dentalRecordForm.toothMap, (tooth, value) => setDentalRecordForm((previous) => ({ ...previous, toothMap: { ...previous.toothMap, [tooth]: value } })))}</div>

            <div className="pr-modal-section-title">Fill the Details</div>
            <div className="pr-dental-modal-notes"><label>Dental Prescriptions<textarea value={dentalRecordForm.prescriptions} onChange={(event) => setDentalRecordForm((previous) => ({ ...previous, prescriptions: event.target.value }))} /></label><label>Dental Notes<textarea value={dentalRecordForm.notes} onChange={(event) => setDentalRecordForm((previous) => ({ ...previous, notes: event.target.value }))} /></label></div>
            <div className="pr-dental-modal-dentist"><label>Add Dentist<select value={dentalRecordForm.dentist} onChange={(event) => setDentalRecordForm((previous) => ({ ...previous, dentist: event.target.value }))}>{DENTISTS.map((dentist) => <option key={dentist} value={dentist}>{dentist}</option>)}</select></label></div>
            <div className="modal-actions center"><button type="button" className="danger-btn" onClick={close}>Cancel</button><button type="button" className="success-btn" onClick={() => { void saveDentalRecord() }} disabled={isSaving || currentRole === 'receptionist'}>Save</button></div>
          </div>
        </div>
      ) : null}

      <div className="print-footer-note">Prepared by: {currentProfile?.full_name || 'Dent22 User'}</div>
    </>
  )
}

export default PatientRecordDetails

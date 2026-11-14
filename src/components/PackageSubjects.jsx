import { SUBJECTS } from '../data/seed'

export default function PackageSubjects({ value, onChange }) {
  const selected = Array.isArray(value) ? value : []
  return <fieldset className="package-subjects">
    <legend>Bộ môn được phép <span className="danger">*</span></legend>
    <div className="staff-subject-list">
      {SUBJECTS.map(subject => {
        const code = subject.toUpperCase().replaceAll(' ', '_')
        return <label key={code} className="check">
          <input type="checkbox" checked={selected.includes(code)} onChange={() => onChange(selected.includes(code) ? selected.filter(item => item !== code) : [...selected, code])} />
          {subject}
        </label>
      })}
    </div>
  </fieldset>
}

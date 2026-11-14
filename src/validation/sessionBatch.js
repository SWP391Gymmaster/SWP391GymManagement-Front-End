const columns = ['classCode', 'startTime', 'endTime', 'roomCode', 'coachEmail', 'description']

export function parseSessionCsv(text, cls, rooms, coaches) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++ } else quoted = !quoted
    } else if (ch === ',' && !quoted) { row.push(field); field = '' }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); if (row.some(v => v.trim())) rows.push(row)
      row = []; field = ''
    } else field += ch
  }
  if (quoted) throw new Error('CSV có dấu ngoặc kép chưa đóng.')
  row.push(field); if (row.some(v => v.trim())) rows.push(row)
  if (!rows.length || columns.some((c, i) => rows[0][i]?.trim().replace(/^\uFEFF/, '') !== c) || rows[0].length !== columns.length) throw new Error('Tiêu đề CSV không đúng mẫu.')
  if (rows.length < 2 || rows.length > 101) throw new Error('CSV cần có từ 1 đến 100 buổi học.')
  return rows.slice(1).map((values, index) => {
    const line = index + 2
    if (values.length !== columns.length) throw new Error(`Dòng ${line}: sai số cột.`)
    const [classCode, startTime, endTime, roomCode, coachEmail, description] = values.map(v => v.trim())
    if (classCode !== cls.classCode) throw new Error(`Dòng ${line}: mã lớp không khớp.`)
    const room = rooms.find(r => r.roomCode === roomCode || r.code === roomCode)
    const coach = coaches.find(c => c.email?.toLowerCase() === coachEmail.toLowerCase())
    if (!room || !coach) throw new Error(`Dòng ${line}: phòng hoặc email HLV không tồn tại.`)
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(startTime) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(endTime)) throw new Error(`Dòng ${line}: giờ phải theo YYYY-MM-DDTHH:mm.`)
    return { classId: cls.id, roomId: room.id, coachId: coach.id, startTime, endTime, description }
  })
}

export function repeatSessions({ classId, roomId, coachId, startTime, duration, everyDays, count, description }) {
  if (!startTime || !Number.isInteger(Number(duration)) || Number(duration) < 1 || !Number.isInteger(Number(everyDays)) || Number(everyDays) < 1 || !Number.isInteger(Number(count)) || Number(count) < 1 || Number(count) > 100) throw new Error('Nhập ngày bắt đầu, thời lượng, chu kỳ và số buổi hợp lệ (tối đa 100).')
  const start = new Date(`${startTime}:00+07:00`)
  if (Number.isNaN(start.getTime())) throw new Error('Ngày giờ bắt đầu không hợp lệ.')
  const vn = date => new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 16)
  return Array.from({ length: Number(count) }, (_, i) => {
    const at = new Date(start.getTime() + i * Number(everyDays) * 86400000)
    return { classId, roomId, coachId, startTime: vn(at), endTime: vn(new Date(at.getTime() + Number(duration) * 60000)), description }
  })
}

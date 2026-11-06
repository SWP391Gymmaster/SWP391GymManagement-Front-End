// Phân công bộ môn cho coach (trang manager). Hàm thuần để test bằng node --test.

// Coach chưa được phân công bộ môn nào (thiếu subjects hoặc mảng rỗng).
export function isUnassignedCoach(coach) {
  return !Array.isArray(coach?.subjects) || coach.subjects.length === 0
}

// Danh sách coach để hiển thị: coach chưa có bộ môn lên đầu, trong mỗi nhóm xếp theo tên (tiếng Việt). Không sửa mảng gốc.
export function sortCoachesForAssignment(coaches = []) {
  return [...coaches].sort((a, b) =>
    Number(isUnassignedCoach(b)) - Number(isUnassignedCoach(a)) ||
    String(a?.name || '').localeCompare(String(b?.name || ''), 'vi'))
}

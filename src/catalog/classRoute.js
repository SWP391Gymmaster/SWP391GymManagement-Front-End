export const classIdFromHash = hash => {
  const match = /^#\/classes\/([1-9]\d*)$/.exec(hash)
  const id = Number(match?.[1])
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

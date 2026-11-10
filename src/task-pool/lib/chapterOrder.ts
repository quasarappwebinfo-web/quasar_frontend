const CHAPTER_ORDER: string[][] = [
  ['preliminar'],
  ['estructura'],
  ['electric'],
  ['hidro', 'hidrosanit', 'plomer', 'sanitari'],
  ['obra gris', 'gris'],
  ['acabado'],
]

type NamedChapter = {
  name: string
  displayOrder?: number
}

export function chapterSortRank(name: string): number {
  const folded = fold(name)
  const index = CHAPTER_ORDER.findIndex((keys) => keys.some((key) => folded.includes(key)))
  return index === -1 ? CHAPTER_ORDER.length : index
}

export function compareChapterNames(left: string, right: string): number {
  const rank = chapterSortRank(left) - chapterSortRank(right)
  if (rank !== 0) return rank
  return left.localeCompare(right, 'es')
}

export function sortChapters<T extends NamedChapter>(chapters: T[]): T[] {
  return [...chapters].sort((left, right) => {
    const rank = chapterSortRank(left.name) - chapterSortRank(right.name)
    if (rank !== 0) return rank
    const order = (left.displayOrder ?? 999) - (right.displayOrder ?? 999)
    if (order !== 0) return order
    return left.name.localeCompare(right.name, 'es')
  })
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { chapterSortRank } from '@/task-pool/lib/chapterOrder'
import styles from './taskPool.module.css'

export type CatalogChrome = {
  search: string
  placeholder: string
  onSearch: (value: string) => void
  actionLabel: string
  onAction: () => void
}

type ChromeApi = {
  chrome: CatalogChrome | null
  setChrome: (chrome: CatalogChrome | null) => void
  refreshStats: () => void
  statsTick: number
}

const CatalogChromeContext = createContext<ChromeApi | null>(null)

export function CatalogChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChromeState] = useState<CatalogChrome | null>(null)
  const [statsTick, setStatsTick] = useState(0)
  const refreshStats = useCallback(() => setStatsTick((tick) => tick + 1), [])
  const setChrome = useCallback((next: CatalogChrome | null) => {
    setChromeState((current) => {
      if (current === next) return current
      if (
        current &&
        next &&
        current.search === next.search &&
        current.placeholder === next.placeholder &&
        current.actionLabel === next.actionLabel &&
        current.onSearch === next.onSearch &&
        current.onAction === next.onAction
      ) {
        return current
      }
      return next
    })
  }, [])

  return (
    <CatalogChromeContext.Provider value={{ chrome, setChrome, refreshStats, statsTick }}>
      {children}
    </CatalogChromeContext.Provider>
  )
}

export function useCatalogChromeValue(): CatalogChrome | null {
  return useContext(CatalogChromeContext)?.chrome ?? null
}

export function useCatalogStatsTick(): number {
  return useContext(CatalogChromeContext)?.statsTick ?? 0
}

export function useRefreshCatalogStats(): () => void {
  return useContext(CatalogChromeContext)?.refreshStats ?? (() => undefined)
}

export function useCatalogChrome(chrome: CatalogChrome) {
  const setChrome = useContext(CatalogChromeContext)?.setChrome
  const searchRef = useRef(chrome.onSearch)
  const actionRef = useRef(chrome.onAction)
  searchRef.current = chrome.onSearch
  actionRef.current = chrome.onAction
  const onSearch = useCallback((value: string) => searchRef.current(value), [])
  const onAction = useCallback(() => actionRef.current(), [])

  useEffect(() => {
    setChrome?.({
      search: chrome.search,
      placeholder: chrome.placeholder,
      actionLabel: chrome.actionLabel,
      onSearch,
      onAction,
    })
  }, [setChrome, chrome.search, chrome.placeholder, chrome.actionLabel, onSearch, onAction])

  useEffect(() => {
    return () => setChrome?.(null)
  }, [setChrome])
}

const MARKS = [
  { ink: '#1d4ed8', soft: '#e8f1ff' },
  { ink: '#c2410c', soft: '#fff1e8' },
  { ink: '#a16207', soft: '#fef9c3' },
  { ink: '#0369a1', soft: '#e0f2fe' },
  { ink: '#475569', soft: '#f1f5f9' },
  { ink: '#15803d', soft: '#e8f7ee' },
]

export function ActivityMark({ name }: { name?: string | null }) {
  const tone = MARKS[chapterSortRank(name || '')] ?? MARKS[0]
  return (
    <span className={styles.mark} style={{ color: tone.ink, background: tone.soft }}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm8 1.5V9h4.5L14 4.5ZM8 12h8v1.6H8V12Zm0 3.4h8V17H8v-1.6Z"
        />
      </svg>
    </span>
  )
}

export function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={active ? styles.pillOn : styles.pillOff}>
      <span className={styles.pillDot} />
      {active ? 'Activa' : 'Inactiva'}
    </span>
  )
}

export function RowMenu({
  items,
}: {
  items: { label: string; onClick: () => void; danger?: boolean }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  return (
    <div className={styles.menuWrap} ref={ref}>
      <button
        type="button"
        className={styles.menuBtn}
        aria-label="Acciones"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="5" r="1.6" fill="currentColor" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
          <circle cx="12" cy="19" r="1.6" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <div className={styles.menu} role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? styles.menuDanger : styles.menuItem}
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function CatalogPager({
  page,
  totalItems,
  itemsPerPage,
  noun,
  onChange,
}: {
  page: number
  totalItems: number
  itemsPerPage: number
  noun: string
  onChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(itemsPerPage, 1)))
  const from = totalItems === 0 ? 0 : (page - 1) * itemsPerPage + 1
  const to = Math.min(page * itemsPerPage, totalItems)
  const pages = pageWindow(page, totalPages)

  return (
    <footer className={styles.tableFoot}>
      <p>
        Mostrando {from.toLocaleString('es-CO')} – {to.toLocaleString('es-CO')} de{' '}
        {totalItems.toLocaleString('es-CO')} {noun}
      </p>
      <div className={styles.pager}>
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Página anterior">
          ‹
        </button>
        {pages.map((number) => (
          <button
            key={number}
            type="button"
            className={number === page ? styles.pageOn : undefined}
            onClick={() => onChange(number)}
          >
            {number}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Página siguiente"
        >
          ›
        </button>
      </div>
    </footer>
  )
}

function pageWindow(page: number, total: number): number[] {
  const width = 5
  let start = Math.max(1, page - 2)
  const end = Math.min(total, start + width - 1)
  start = Math.max(1, end - width + 1)
  const pages: number[] = []
  for (let number = start; number <= end; number += 1) pages.push(number)
  return pages
}

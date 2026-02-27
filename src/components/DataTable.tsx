// src\components\DataTable.tsx
import { useMemo, useState } from 'react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export interface DataTableColumn<T> {
  key: string
  header: string
  className?: string
  render: (row: T) => React.ReactNode
}

export interface DataTableFilter<T> {
  id: string
  label: string
  options: Array<{ label: string; value: string }>
  getValue: (row: T) => string | null | undefined
}

interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  searchKeys?: Array<keyof T>
  filters?: DataTableFilter<T>[]
  pageSize?: number
  emptyMessage?: string
}

export function DataTable<T extends object>({
  data,
  columns,
  searchKeys = [],
  filters = [],
  pageSize = 10,
  emptyMessage = 'No results found.',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})

  const filtered = useMemo(() => {
    let rows = [...data]
    const query = search.trim().toLowerCase()

    if (query && searchKeys.length > 0) {
      rows = rows.filter((row) =>
        searchKeys.some((key) => {
          const value = row[key]
          return String(value ?? '')
            .toLowerCase()
            .includes(query)
        }),
      )
    }

    for (const filter of filters) {
      const selected = activeFilters[filter.id]
      if (!selected || selected === '__all__') continue
      rows = rows.filter((row) => filter.getValue(row) === selected)
    }

    return rows
  }, [data, search, searchKeys, filters, activeFilters])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const handleFilter = (id: string, value: string) => {
    setPage(1)
    setActiveFilters((prev) => ({ ...prev, [id]: value }))
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder='Search...'
          className='max-w-xs rounded-xl'
        />

        {filters.map((filter) => (
          <Select
            key={filter.id}
            value={activeFilters[filter.id] ?? '__all__'}
            onValueChange={(value) => handleFilter(filter.id, value)}
          >
            <SelectTrigger className='w-[180px] rounded-xl'>
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='__all__'>All {filter.label}</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      <div className='overflow-x-auto rounded-2xl border bg-card'>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length > 0 ? (
              paged.map((row, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className='py-8 text-center text-muted-foreground'>
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className='flex items-center justify-between text-sm text-muted-foreground'>
        <span>
          Showing {paged.length ? (safePage - 1) * pageSize + 1 : 0}-{(safePage - 1) * pageSize + paged.length} of {filtered.length}
        </span>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            disabled={safePage <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </Button>
          <span>
            {safePage}/{totalPages}
          </span>
          <Button
            variant='outline'
            size='sm'
            disabled={safePage >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

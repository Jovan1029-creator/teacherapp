import type { ExamTimetableEntry } from '@/lib/types'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function buildExamTimetablePrintHtml(params: {
  title: string
  subtitle?: string
  schoolName?: string
  filterSummary?: string
  signatureMode?: 'standard' | 'none'
  entries: ExamTimetableEntry[]
}) {
  const rows = params.entries
    .slice()
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .map((entry, index) => {
      const term = entry.term?.trim() ? entry.term : '-'
      const venue = entry.venue?.trim() ? entry.venue : '-'
      const notes = entry.notes?.trim() ? entry.notes : '-'
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(formatDateTime(entry.starts_at))}</td>
          <td>${escapeHtml(String(entry.duration_minutes))} min</td>
          <td>${escapeHtml(entry.subject?.name ?? '-')}</td>
          <td>${escapeHtml(entry.title)}</td>
          <td>${escapeHtml(term)}</td>
          <td>${escapeHtml(entry.teacher?.full_name ?? 'Teacher')}</td>
          <td>${escapeHtml(venue)}</td>
          <td>${escapeHtml(notes)}</td>
        </tr>
      `
    })
    .join('')

  const generatedAt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
  const signatureHtml =
    params.signatureMode === 'none'
      ? ''
      : `
      <div class="signature-grid">
        <div class="signature-item"><div class="signature-line"></div><div class="signature-label">Prepared by</div></div>
        <div class="signature-item"><div class="signature-line"></div><div class="signature-label">Checked by</div></div>
        <div class="signature-item"><div class="signature-line"></div><div class="signature-label">Approved by / Headteacher</div></div>
      </div>
    `

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(params.title)}</title>
    <style>
      @page { size: A4 portrait; margin: 12mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", Tahoma, sans-serif;
        color: #111827;
        line-height: 1.35;
      }
      h1 { margin: 0; font-size: 20px; }
      p.meta { margin: 6px 0 0; color: #4b5563; font-size: 12px; }
      .header {
        margin-bottom: 12px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        padding: 12px;
        background: #f9fafb;
      }
      .school-name { margin: 0; font-size: 15px; font-weight: 700; }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      th, td {
        border: 1px solid #d1d5db;
        padding: 6px 7px;
        vertical-align: top;
      }
      th {
        background: #f3f4f6;
        text-align: left;
      }
      tbody tr:nth-child(even) td { background: #fafafa; }
      .footer {
        margin-top: 12px;
        color: #6b7280;
        font-size: 11px;
      }
      .signature-grid {
        margin-top: 16px;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
      }
      .signature-item { text-align: center; }
      .signature-line { height: 28px; border-bottom: 1px solid #9ca3af; }
      .signature-label { margin-top: 4px; color: #4b5563; font-size: 11px; }
    </style>
  </head>
  <body>
    <div class="header">
      ${params.schoolName ? `<p class="school-name">${escapeHtml(params.schoolName)}</p>` : ''}
      <h1>${escapeHtml(params.title)}</h1>
      ${params.subtitle ? `<p class="meta">${escapeHtml(params.subtitle)}</p>` : ''}
      ${params.filterSummary ? `<p class="meta">Filters: ${escapeHtml(params.filterSummary)}</p>` : ''}
      <p class="meta">Generated: ${escapeHtml(generatedAt)}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 36px;">No.</th>
          <th style="width: 140px;">Start Time</th>
          <th style="width: 70px;">Duration</th>
          <th style="width: 90px;">Subject</th>
          <th>Exam</th>
          <th style="width: 80px;">Term</th>
          <th style="width: 110px;">Teacher</th>
          <th style="width: 90px;">Venue</th>
          <th style="width: 140px;">Notes</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="9">No timetable entries.</td></tr>'}
      </tbody>
    </table>
    ${signatureHtml}
    <div class="footer">Teacher Assistant System - Exam Timetable</div>
  </body>
</html>`
}

export function printExamTimetable(params: {
  title: string
  subtitle?: string
  schoolName?: string
  filterSummary?: string
  signatureMode?: 'standard' | 'none'
  entries: ExamTimetableEntry[]
}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const html = buildExamTimetablePrintHtml(params)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.setAttribute('aria-hidden', 'true')

  const cleanup = () => {
    iframe.remove()
  }

  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (!doc) {
    cleanup()
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      window.setTimeout(cleanup, 1500)
    }
  }

  iframe.onload = triggerPrint
  window.setTimeout(triggerPrint, 400)
}


type Primitive = string | number | boolean | null | undefined

export interface ReportPrintTable {
  title?: string
  columns: string[]
  rows: Primitive[][]
  note?: string
}

export interface ReportPrintSection {
  title?: string
  paragraphs?: string[]
  summaryItems?: Array<{ label: string; value: Primitive }>
  tables?: ReportPrintTable[]
}

export interface ReportPrintOptions {
  schoolName: string
  title: string
  subtitle?: string
  filterSummary?: string
  sections: ReportPrintSection[]
  signatureMode?: 'standard' | 'none'
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function cellText(value: Primitive) {
  if (value == null) return '-'
  return String(value)
}

export function buildReportPrintHtml(options: ReportPrintOptions) {
  const generatedAt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())

  const sectionsHtml = options.sections
    .map((section) => {
      const paragraphsHtml = (section.paragraphs ?? [])
        .filter((line) => line.trim().length > 0)
        .map((line) => `<p class="section-note">${escapeHtml(line)}</p>`)
        .join('')

      const summaryHtml = (section.summaryItems?.length ?? 0)
        ? `<div class="summary-grid">${(section.summaryItems ?? [])
            .map(
              (item) =>
                `<div class="summary-card"><div class="summary-label">${escapeHtml(item.label)}</div><div class="summary-value">${escapeHtml(cellText(item.value))}</div></div>`,
            )
            .join('')}</div>`
        : ''

      const tablesHtml = (section.tables ?? [])
        .map((table) => {
          const headerHtml = table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')
          const rowsHtml = table.rows.length
            ? table.rows
                .map(
                  (row) =>
                    `<tr>${table.columns
                      .map((_, index) => `<td>${escapeHtml(cellText(row[index]))}</td>`)
                      .join('')}</tr>`,
                )
                .join('')
            : `<tr><td colspan="${table.columns.length}">No rows available.</td></tr>`

          return `
            <div class="table-block">
              ${table.title ? `<h3 class="table-title">${escapeHtml(table.title)}</h3>` : ''}
              <table>
                <thead><tr>${headerHtml}</tr></thead>
                <tbody>${rowsHtml}</tbody>
              </table>
              ${table.note ? `<p class="table-note">${escapeHtml(table.note)}</p>` : ''}
            </div>
          `
        })
        .join('')

      return `
        <section class="report-section">
          ${section.title ? `<h2>${escapeHtml(section.title)}</h2>` : ''}
          ${paragraphsHtml}
          ${summaryHtml}
          ${tablesHtml}
        </section>
      `
    })
    .join('')

  const signatureHtml =
    options.signatureMode === 'none'
      ? ''
      : `
      <div class="signature-grid">
        <div class="signature-item">
          <div class="signature-line"></div>
          <div class="signature-label">Prepared by</div>
        </div>
        <div class="signature-item">
          <div class="signature-line"></div>
          <div class="signature-label">Checked by</div>
        </div>
        <div class="signature-item">
          <div class="signature-line"></div>
          <div class="signature-label">Approved by / Headteacher</div>
        </div>
      </div>
    `

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(options.title)}</title>
    <style>
      @page { size: A4 portrait; margin: 12mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", Tahoma, sans-serif;
        color: #111827;
        line-height: 1.35;
      }
      .header {
        border: 1px solid #d1d5db;
        border-radius: 10px;
        padding: 12px;
        margin-bottom: 12px;
        background: #f9fafb;
      }
      .school-name {
        font-size: 16px;
        font-weight: 700;
      }
      .report-title {
        margin-top: 4px;
        font-size: 20px;
        font-weight: 700;
      }
      .meta {
        margin-top: 4px;
        font-size: 12px;
        color: #4b5563;
      }
      .report-section {
        margin-top: 12px;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 10px;
        break-inside: avoid;
      }
      .report-section h2 {
        margin: 0 0 8px;
        font-size: 14px;
      }
      .section-note {
        margin: 4px 0;
        font-size: 12px;
        color: #374151;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 8px;
        margin: 8px 0 10px;
      }
      .summary-card {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 8px;
        background: #fff;
      }
      .summary-label {
        font-size: 11px;
        color: #6b7280;
      }
      .summary-value {
        margin-top: 2px;
        font-size: 14px;
        font-weight: 600;
      }
      .table-block + .table-block {
        margin-top: 10px;
      }
      .table-title {
        margin: 0 0 6px;
        font-size: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      th, td {
        border: 1px solid #d1d5db;
        padding: 5px 6px;
        vertical-align: top;
      }
      th {
        background: #f3f4f6;
        text-align: left;
      }
      tbody tr:nth-child(even) td {
        background: #fafafa;
      }
      .table-note {
        margin: 6px 0 0;
        font-size: 11px;
        color: #6b7280;
      }
      .signature-grid {
        margin-top: 20px;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
      }
      .signature-item { text-align: center; }
      .signature-line {
        height: 28px;
        border-bottom: 1px solid #9ca3af;
      }
      .signature-label {
        margin-top: 4px;
        font-size: 11px;
        color: #4b5563;
      }
      .footer {
        margin-top: 10px;
        font-size: 11px;
        color: #6b7280;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="school-name">${escapeHtml(options.schoolName || 'School')}</div>
      <div class="report-title">${escapeHtml(options.title)}</div>
      ${options.subtitle ? `<div class="meta">${escapeHtml(options.subtitle)}</div>` : ''}
      ${options.filterSummary ? `<div class="meta">Filters: ${escapeHtml(options.filterSummary)}</div>` : ''}
      <div class="meta">Generated: ${escapeHtml(generatedAt)}</div>
    </div>
    ${sectionsHtml || '<section class="report-section"><p class="section-note">No data available.</p></section>'}
    ${signatureHtml}
    <div class="footer">Teacher Assistant System - Admin Reports</div>
  </body>
</html>`
}

export function printReportHtml(options: ReportPrintOptions) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const html = buildReportPrintHtml(options)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.setAttribute('aria-hidden', 'true')

  const cleanup = () => iframe.remove()

  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (!doc) {
    cleanup()
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  let didPrint = false
  const triggerPrint = () => {
    if (didPrint) return
    didPrint = true
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

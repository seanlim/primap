import ExcelJS from 'exceljs'
import { TABLE_ORDER, TABLE_COLUMNS, type TableName } from './constants'

export async function buildExportWorkbook(
  tableData: Record<TableName, Record<string, unknown>[]>
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Primap'
  workbook.created = new Date()

  for (const table of TABLE_ORDER) {
    const columns = TABLE_COLUMNS[table]
    const rows = tableData[table] ?? []
    const worksheet = workbook.addWorksheet(table)

    // Header row
    worksheet.addRow(columns)

    // Style header row
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
      }
    })

    // Data rows
    for (const row of rows) {
      const values = columns.map(col => {
        const val = row[col]
        if (val === null || val === undefined) return ''
        if (typeof val === 'boolean') return val
        if (typeof val === 'number') return val
        return String(val)
      })
      worksheet.addRow(values)
    }

    // Auto-fit column widths (approximate)
    worksheet.columns.forEach((col, i) => {
      const headerLen = columns[i]?.length ?? 10
      let maxLen = headerLen
      for (const row of rows) {
        const val = row[columns[i]]
        if (val !== null && val !== undefined) {
          maxLen = Math.max(maxLen, String(val).length)
        }
      }
      col.width = Math.min(maxLen + 2, 50)
    })
  }

  return await workbook.xlsx.writeBuffer()
}

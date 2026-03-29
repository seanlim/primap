import ExcelJS from 'exceljs'

export async function parseWorkbookToTableData(
  buffer: Buffer | ArrayBuffer
): Promise<Record<string, Record<string, unknown>[]>> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as ArrayBuffer)

  const result: Record<string, Record<string, unknown>[]> = {}

  workbook.eachSheet(worksheet => {
    const sheetName = worksheet.name
    result[sheetName] = parseSheetRows(worksheet)
  })

  return result
}

export function parseSheetRows(
  worksheet: ExcelJS.Worksheet
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []

  const headerRow = worksheet.getRow(1)
  const headers: string[] = []
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '').trim()
  })

  if (headers.length === 0) return rows

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // skip header

    const obj: Record<string, unknown> = {}
    let hasValue = false

    headers.forEach((header, colNumber) => {
      if (!header) return
      const cell = row.getCell(colNumber)
      const val = cell.value

      if (val === null || val === undefined || val === '') {
        obj[header] = null
      } else if (typeof val === 'object' && val instanceof Date) {
        obj[header] = val.toISOString()
      } else if (typeof val === 'object' && 'result' in val) {
        // ExcelJS formula result
        obj[header] = val.result
      } else {
        obj[header] = val
        hasValue = true
      }
    })

    if (hasValue) rows.push(obj)
  })

  return rows
}

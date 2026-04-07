/**
 * Run with: npx tsx scripts/create-sample-legacy-xlsx.ts
 * Creates: sample-legacy-import.xlsx in the project root
 */
import ExcelJS from 'exceljs'
import path from 'path'

const HEADERS = [
  'round_name', 'location_name', 'walk_date', 'start_time', 'end_time',
  'observer_email', 'walk_completion', 'outcome',
  'observation_notes', 'observation_lat', 'observation_lng',
  'species', 'count', 'sighting_lat', 'sighting_lng', 'observed_at', 'sighting_notes',
]

// Sample data using existing rounds and profiles from DB
const ROWS = [
  // Row 1: Sighted RBL observation
  [
    'Test Round 4', 'Bukit Timah Nature Reserve', '2026-04-01', '07:00', '09:00',
    'kjaehyeok21@gmail.com', 'COMPLETED', 'SIGHTED',
    'Clear morning, good visibility', 1.3456, 103.7789,
    'RBL', '3', 1.3460, 103.7790, '2026-04-01T07:45:00Z', 'Adult group near trail marker 5',
  ],
  // Row 2: Sighted LTM observation
  [
    'Test Round 4', 'Bukit Timah Nature Reserve', '2026-04-01', '07:00', '09:00',
    'juneha1120@gmail.com', 'COMPLETED', 'SIGHTED',
    'Spotted near water point', 1.3461, 103.7785,
    'LTM', '5-7', 1.3462, 103.7786, '2026-04-01T08:15:00Z', 'Mixed group, some juveniles',
  ],
  // Row 3: Not sighted observation
  [
    'Test Round 4', 'MacRitchie Reservoir', '2026-04-02', '06:30', '08:30',
    'kjaehyeok21@gmail.com', 'COMPLETED', 'NOT_SIGHTED',
    'Overcast, limited visibility', 1.3400, 103.8100,
    '', '', '', '', '', '',
  ],
  // Row 4: Partially completed walk
  [
    'Test Round 4', 'MacRitchie Reservoir', '2026-04-02', '06:30', '08:30',
    'seanlimdev856@gmail.com', 'PARTIAL', 'NOT_SIGHTED',
    'Rain started at 7:30, had to cut short', 1.3405, 103.8105,
    '', '', '', '', '', '',
  ],
  // Row 5: Sighted Dusky Langur
  [
    'Test Round 2', 'Central Catchment', '2026-04-03', '16:00', '18:00',
    'juneha1120@gmail.com', 'COMPLETED', 'SIGHTED',
    'Evening walk, good conditions', 1.3550, 103.8200,
    'DUSKY', '1', 1.3551, 103.8201, '2026-04-03T17:20:00Z', 'Solitary individual',
  ],
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('observations')

  // Header row
  ws.addRow(HEADERS)
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true }
  headerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    }
  })

  // Data rows
  for (const row of ROWS) {
    ws.addRow(row)
  }

  // Auto-fit columns
  ws.columns.forEach((col, i) => {
    col.width = Math.max(HEADERS[i].length + 2, 15)
  })

  const outPath = path.join(process.cwd(), 'sample-legacy-import.xlsx')
  await workbook.xlsx.writeFile(outPath)
  console.log(`Created: ${outPath}`)
  console.log(`Rows: ${ROWS.length} observations`)
  console.log(`  - 3 SIGHTED (RBL, LTM, DUSKY)`)
  console.log(`  - 2 NOT_SIGHTED`)
  console.log(`  - Rounds used: Test Round 4, Test Round 2`)
  console.log(`  - Observers: kjaehyeok21@gmail.com, juneha1120@gmail.com, seanlimdev856@gmail.com`)
}

main().catch(console.error)

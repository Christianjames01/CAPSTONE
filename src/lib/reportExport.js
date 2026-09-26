// Excel export for the head's Reports page. exceljs is loaded only when an
// export is requested, so it doesn't weigh down every page.

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123B78' } }
const PESO_FORMAT = '"₱"#,##0.00'

// sheets: [{ name, columns: [{ header, key, width, format? }], rows: [{...}] }]
// meta: lines shown above the first sheet's table (title, period, generated at)
export async function downloadExcelReport(fileName, sheets, meta = []) {
    const { default: ExcelJS } = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'CertiChain'
    workbook.created = new Date()

    sheets.forEach((sheet, index) => {
        const ws = workbook.addWorksheet(sheet.name.slice(0, 31))
        let startRow = 1

        // Report title/period only on the first sheet.
        if (index === 0 && meta.length) {
            meta.forEach((line, i) => {
                const row = ws.getRow(i + 1)
                row.getCell(1).value = line
                row.getCell(1).font = i === 0 ? { bold: true, size: 14 } : { color: { argb: 'FF57616F' } }
            })
            startRow = meta.length + 2
        }

        const headerRow = ws.getRow(startRow)
        sheet.columns.forEach((col, c) => {
            const cell = headerRow.getCell(c + 1)
            cell.value = col.header
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
            cell.fill = HEADER_FILL
            cell.alignment = { vertical: 'middle' }
            ws.getColumn(c + 1).width = col.width || 16
        })

        sheet.rows.forEach((data, r) => {
            const row = ws.getRow(startRow + 1 + r)
            sheet.columns.forEach((col, c) => {
                const cell = row.getCell(c + 1)
                const value = data[col.key]
                cell.value = value === undefined || value === null ? '' : value
                if (col.format === 'peso') cell.numFmt = PESO_FORMAT
                else if (col.format === 'decimal') cell.numFmt = '0.0'
                else if (col.format === 'datetime' && value instanceof Date) cell.numFmt = 'mmm d, yyyy h:mm AM/PM'
            })
        })

        if (sheet.rows.length === 0) {
            ws.getRow(startRow + 1).getCell(1).value = 'No data for this period.'
        }

        ws.views = [{ state: 'frozen', ySplit: startRow }]
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

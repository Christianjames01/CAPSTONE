const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123B78' } }
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 }
const BORDER = { style: 'thin', color: { argb: 'FFE1E4EA' } }
const STRIPE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } }

// sheets: [{
//   name, columns: [{ header, key, width }], rows: [{...}],
//   letterhead?: { logoBase64, title, subtitle } — when set, draws the HCDC
//   logo + a title/subtitle above the table instead of starting the header
//   row at the very top of the sheet.
// }]
//
// exceljs is ~1MB — loaded on demand here so students/employees never pay
// for it; only the Head, only when they actually click an export button.
export async function exportToExcel(filename, sheets) {
    const { default: ExcelJS } = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'HCDC Registrar Services'
    workbook.created = new Date()

    for (const sheet of sheets) {
        const ws = workbook.addWorksheet(sheet.name, { views: [] })

        sheet.columns.forEach((c, i) => {
            ws.getColumn(i + 1).width = c.width || 18
        })

        let headerRowNumber = 1

        if (sheet.letterhead) {
            const lastColLetter = String.fromCharCode(64 + Math.max(sheet.columns.length, 2))

            const imageId = workbook.addImage({ base64: sheet.letterhead.logoBase64, extension: 'png' })
            ws.addImage(imageId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 54, height: 54 } })

            ws.mergeCells(`B1:${lastColLetter}1`)
            ws.getCell('B1').value = sheet.letterhead.title
            ws.getCell('B1').font = { bold: true, size: 15, color: { argb: 'FF123B78' } }
            ws.getCell('B1').alignment = { vertical: 'middle' }

            ws.mergeCells(`B2:${lastColLetter}2`)
            ws.getCell('B2').value = sheet.letterhead.subtitle
            ws.getCell('B2').font = { size: 11, color: { argb: 'FF57616F' } }
            ws.getCell('B2').alignment = { vertical: 'middle' }

            ws.mergeCells(`B3:${lastColLetter}3`)
            ws.getCell('B3').value = `Generated ${new Date().toLocaleString('en-PH')}`
            ws.getCell('B3').font = { size: 9, italic: true, color: { argb: 'FF57616F' } }
            ws.getCell('B3').alignment = { vertical: 'middle' }

            ws.getRow(1).height = 26
            ws.getRow(2).height = 18
            ws.getRow(3).height = 16
            headerRowNumber = 5
        }

        const headerRow = ws.getRow(headerRowNumber)
        sheet.columns.forEach((c, i) => {
            headerRow.getCell(i + 1).value = c.header
        })
        headerRow.eachCell((cell) => {
            cell.fill = HEADER_FILL
            cell.font = HEADER_FONT
            cell.alignment = { vertical: 'middle', horizontal: 'left' }
            cell.border = { bottom: BORDER }
        })
        headerRow.height = 22

        sheet.rows.forEach((row, i) => {
            const dataRow = ws.getRow(headerRowNumber + 1 + i)

            sheet.columns.forEach((c, colIdx) => {
                dataRow.getCell(colIdx + 1).value = row[c.key]
            })

            dataRow.eachCell((cell) => {
                cell.border = { bottom: BORDER }
                if (i % 2 === 1) cell.fill = STRIPE_FILL
            })
        })

        ws.views = [{ state: 'frozen', ySplit: headerRowNumber }]
        ws.autoFilter = {
            from: { row: headerRowNumber, column: 1 },
            to: { row: headerRowNumber, column: sheet.columns.length },
        }
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
}

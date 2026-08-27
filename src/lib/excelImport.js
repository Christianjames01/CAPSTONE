// Reads the first sheet of an .xlsx file into an array of row objects,
// keyed by the header row. exceljs is loaded on demand (see excelExport.js
// for why) — only paid for when someone actually imports a file.
export async function parseExcelFile(file) {
    const { default: ExcelJS } = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const buffer = await file.arrayBuffer()
    await workbook.xlsx.load(buffer)

    const ws = workbook.worksheets[0]
    if (!ws) return []

    const headers = []
    ws.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value ?? '').trim()
    })

    const rows = []

    ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return

        const obj = {}
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const key = headers[colNumber]
            if (key) obj[key] = cell.value === null || cell.value === undefined ? '' : String(cell.value).trim()
        })

        if (Object.values(obj).some((v) => v !== '')) {
            rows.push(obj)
        }
    })

    return rows
}

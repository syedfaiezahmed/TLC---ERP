import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import moment from 'moment';

const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return 'PKR 0.00';
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'PKR',
        minimumFractionDigits: 2
    }).format(amount || 0);
};

// Helper to add professional header to Excel
const addExcelHeader = (worksheet, title, dateRange, companyName, themeColor = '2E7D32') => {
    // Company branding
    worksheet.mergeCells('A1:H1');
    const companyCell = worksheet.getCell('A1');
    companyCell.value = companyName || 'TLC Coaching Management System';
    companyCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: `FF${themeColor}` } };
    companyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    companyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };

    // Report title
    worksheet.mergeCells('A2:H2');
    const titleCell = worksheet.getCell('A2');
    titleCell.value = title;
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF333333' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Date range and generation info
    worksheet.mergeCells('A3:H3');
    const dateCell = worksheet.getCell('A3');
    dateCell.value = `Period: ${dateRange} | Generated: ${moment().format('DD MMM YYYY HH:mm')}`;
    dateCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF666666' } };
    dateCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add professional border to header section
    ['A1', 'A2', 'A3'].forEach(cell => {
        worksheet.getCell(cell).border = {
            top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
        };
    });

    // Add empty row for spacing
    worksheet.addRow([]);
    worksheet.addRow([]);
};

// Helper to add summary section to Excel
const addExcelSummary = (worksheet, summaryData, startRow) => {
    let currentRow = startRow;
    
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    const summaryTitle = worksheet.getCell(`A${currentRow}`);
    summaryTitle.value = 'SUMMARY';
    summaryTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    summaryTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    summaryTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    
    currentRow++;
    
    Object.entries(summaryData).forEach(([key, value]) => {
        if (typeof value === 'number') {
            worksheet.getCell(`A${currentRow}`).value = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            worksheet.getCell(`B${currentRow}`).value = formatCurrency(value);
            worksheet.getCell(`B${currentRow}`).font = { bold: true };
            worksheet.getCell(`B${currentRow}`).numFmt = '"PKR"#,##0.00';
        }
        currentRow++;
    });
    
    worksheet.addRow([]);
    return currentRow + 1;
};

// Enhanced Excel export with professional formatting
export const exportToExcel = async (data, columns, title, dateRange, companyName, themeColor = '2E7D32', summaryData = null) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    // Set default row height and column widths
    worksheet.properties.defaultRowHeight = 20;
    worksheet.getRow(1).height = 25;
    worksheet.getRow(2).height = 20;
    worksheet.getRow(3).height = 18;

    // Add professional header
    addExcelHeader(worksheet, title, dateRange, companyName, themeColor);

    // Add summary if provided
    let dataStartRow = 6;
    if (summaryData) {
        dataStartRow = addExcelSummary(worksheet, summaryData, dataStartRow);
    }

    // Add column headers with professional styling
    const headerRow = worksheet.addRow(columns.map(c => c.header));
    headerRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${themeColor}` } };
        cell.alignment = { vertical: 'middle', horizontal: colNumber > 3 ? 'right' : 'left' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
        };
    });

    // Add data rows with alternating colors and proper formatting
    data.forEach((row, index) => {
        const dataRow = worksheet.addRow(columns.map(col => {
            let value = row[col.key];
            
            // Format currency columns
            if (col.format === 'currency') {
                return value || 0;
            }
            
            // Format dates
            if (col.key.includes('Date') || col.key.includes('date')) {
                return value ? moment(value).format('DD-MM-YYYY') : '';
            }
            
            return value || '';
        }));

        // Style data rows
        dataRow.eachCell((cell, colNumber) => {
            const column = columns[colNumber - 1];
            
            // Alternating row colors
            if (index % 2 === 0) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
            }
            
            // Currency formatting
            if (column?.format === 'currency') {
                cell.numFmt = '"PKR"#,##0.00';
                cell.font = { name: 'Calibri', size: 11 };
                cell.alignment = { vertical: 'middle', horizontal: 'right' };
            } else {
                cell.font = { name: 'Calibri', size: 11 };
                cell.alignment = { vertical: 'middle', horizontal: column?.align || 'left' };
            }
            
            // Borders
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE9ECEF' } },
                bottom: { style: 'thin', color: { argb: 'FFE9ECEF' } },
                left: { style: 'thin', color: { argb: 'FFE9ECEF' } },
                right: { style: 'thin', color: { argb: 'FFE9ECEF' } }
            };
        });
    });

    // Set column widths
    columns.forEach((col, index) => {
        const width = col.width || 15;
        worksheet.getColumn(index + 1).width = width;
    });

    // Add footer
    const footerRow = worksheet.rowCount + 2;
    worksheet.mergeCells(`A${footerRow}:H${footerRow}`);
    const footerCell = worksheet.getCell(`A${footerRow}`);
    footerCell.value = `Report generated by TLC Coaching Management System on ${moment().format('DD MMM YYYY [at] HH:mm')}`;
    footerCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF999999' } };
    footerCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Generate and download file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${moment().format('YYYY-MM-DD_HH-mm')}.xlsx`;
    saveAs(blob, fileName);
};

// Enhanced PDF export with professional formatting
export const exportToPDF = (data, columns, title, dateRange, companyName, themeColor = '2E7D32', summaryData = null) => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Convert hex color to RGB
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 46, g: 125, b: 50 }; // Default green
    };
    
    const rgb = hexToRgb(themeColor.startsWith('#') ? themeColor : `#${themeColor}`);

    // Add professional header
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    // Company name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName || 'TLC Coaching Management System', pageWidth / 2, 15, { align: 'center' });
    
    // Report title
    doc.setFontSize(16);
    doc.text(title, pageWidth / 2, 25, { align: 'center' });
    
    // Date range
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${dateRange}`, pageWidth / 2, 32, { align: 'center' });
    doc.text(`Generated: ${moment().format('DD MMM YYYY HH:mm')}`, pageWidth / 2, 37, { align: 'center' });

    let currentY = 50;

    // Add summary if provided
    if (summaryData) {
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.rect(20, currentY, pageWidth - 40, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('SUMMARY', pageWidth / 2, currentY + 7, { align: 'center' });
        
        currentY += 20;
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        Object.entries(summaryData).forEach(([key, value]) => {
            if (typeof value === 'number') {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                doc.text(`${label}:`, 30, currentY);
                doc.text(formatCurrency(value), pageWidth - 30, currentY, { align: 'right' });
                currentY += 8;
            }
        });
        
        currentY += 10;
    }

    // Prepare table data
    const tableHeaders = columns.map(col => col.header);
    const tableData = data.map(row => 
        columns.map(col => {
            let value = row[col.key];
            
            if (col.format === 'currency') {
                return formatCurrency(value || 0);
            }
            
            if (col.key.includes('Date') || col.key.includes('date')) {
                return value ? moment(value).format('DD-MM-YYYY') : '';
            }
            
            return value || '';
        })
    );

    // Add table with professional styling
    autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        startY: currentY,
        styles: {
            font: 'helvetica',
            fontSize: 9,
            cellPadding: 3,
            lineColor: [200, 200, 200],
            lineWidth: 0.1
        },
        headStyles: {
            fillColor: [rgb.r, rgb.g, rgb.b],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 10
        },
        alternateRowStyles: {
            fillColor: [248, 249, 250]
        },
        columnStyles: columns.reduce((acc, col, index) => {
            if (col.format === 'currency' || col.align === 'right') {
                acc[index] = { halign: 'right', fontStyle: 'bold' };
            }
            return acc;
        }, {}),
        margin: { top: currentY, left: 20, right: 20, bottom: 30 },
        didDrawCell: (data) => {
            // Add subtle borders
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.1);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height);
        }
    });

    // Add footer
    const finalY = doc.lastAutoTable.finalY || currentY;
    doc.setFillColor(240, 240, 240);
    doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
    
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(
        `Report generated by TLC Coaching Management System on ${moment().format('DD MMM YYYY [at] HH:mm')}`, 
        pageWidth / 2, 
        pageHeight - 10, 
        { align: 'center' }
    );

    // Add page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
    }

    // Save the PDF
    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${moment().format('YYYY-MM-DD_HH-mm')}.pdf`;
    doc.save(fileName);
};

// Export multiple reports to a single Excel file with multiple sheets
export const exportMultipleReportsToExcel = async (reports, companyName) => {
    const workbook = new ExcelJS.Workbook();
    
    for (const report of reports) {
        const worksheet = workbook.addWorksheet(report.sheetName || 'Report');
        
        // Add header
        addExcelHeader(worksheet, report.title, report.dateRange, companyName, report.themeColor);
        
        // Add summary if provided
        let dataStartRow = 6;
        if (report.summaryData) {
            dataStartRow = addExcelSummary(worksheet, report.summaryData, dataStartRow);
        }
        
        // Add data
        const headerRow = worksheet.addRow(report.columns.map(c => c.header));
        headerRow.eachCell((cell, colNumber) => {
            cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${report.themeColor || '2E7D32'}` } };
            cell.alignment = { vertical: 'middle', horizontal: colNumber > 3 ? 'right' : 'left' };
        });
        
        // Add data rows
        report.data.forEach((row, index) => {
            const dataRow = worksheet.addRow(report.columns.map(col => {
                let value = row[col.key];
                if (col.format === 'currency') return value || 0;
                if (col.key.includes('Date') || col.key.includes('date')) {
                    return value ? moment(value).format('DD-MM-YYYY') : '';
                }
                return value || '';
            }));
            
            dataRow.eachCell((cell, colNumber) => {
                const column = report.columns[colNumber - 1];
                if (index % 2 === 0) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
                }
                if (column?.format === 'currency') {
                    cell.numFmt = '"PKR"#,##0.00';
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: column?.align || 'left' };
                }
            });
        });
        
        // Set column widths
        report.columns.forEach((col, index) => {
            worksheet.getColumn(index + 1).width = col.width || 15;
        });
    }
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `comprehensive_report_${moment().format('YYYY-MM-DD_HH-mm')}.xlsx`;
    saveAs(blob, fileName);
};

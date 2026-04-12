import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Puppeteer is optional — not available on Vercel/serverless environments
let puppeteer = null;
try {
  puppeteer = (await import('puppeteer')).default;
} catch (_) {
  // Chrome not installed (Vercel/serverless) — PDF generation will return 501
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PDFVoucherService {
  async generateVoucherPDF(voucherData, companyData, options = {}) {
    if (!puppeteer) throw new Error('PDF generation is not available in this environment (puppeteer/Chrome not installed)');
    try {
      const {
        copyType = 'both', // 'office', 'student', 'both'
        saveToFile = true,
        outputDir = './temp/vouchers'
      } = options;

      // Create output directory if it doesn't exist
      if (saveToFile && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();

      // Generate HTML content
      const htmlContent = await this.generateVoucherHTML(voucherData, companyData, copyType);

      // Set content and wait for load
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      // Generate PDF options
      const pdfOptions = {
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size: 10px; color: #666; text-align: center; width: 100%;">
            ${companyData.name} - Fee Voucher
          </div>
        `,
        footerTemplate: `
          <div style="font-size: 10px; color: #666; text-align: center; width: 100%;">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span>
          </div>
        `
      };

      let pdfBuffer;
      let filename = '';

      if (copyType === 'both') {
        // Generate both copies in one PDF with page break
        pdfOptions.displayHeaderFooter = false;
        pdfBuffer = await page.pdf(pdfOptions);
        filename = `Voucher_${voucherData.voucherNumber}_BothCopies_${Date.now()}.pdf`;
      } else {
        // Generate single copy
        pdfBuffer = await page.pdf(pdfOptions);
        filename = `Voucher_${voucherData.voucherNumber}_${copyType}Copy_${Date.now()}.pdf`;
      }

      await browser.close();

      // Save to file if requested
      let filePath = '';
      if (saveToFile) {
        filePath = path.join(outputDir, filename);
        fs.writeFileSync(filePath, pdfBuffer);
      }

      return {
        success: true,
        pdfBuffer: pdfBuffer,
        filename: filename,
        filePath: filePath,
        size: pdfBuffer.length
      };

    } catch (error) {
      console.error('Error generating PDF voucher:', error);
      throw error;
    }
  }

  async generateBulkVoucherPDF(vouchersData, companyData, options = {}) {
    if (!puppeteer) throw new Error('PDF generation is not available in this environment (puppeteer/Chrome not installed)');
    try {
      const {
        saveToFile = true,
        outputDir = './temp/vouchers'
      } = options;

      // Create output directory if it doesn't exist
      if (saveToFile && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();

      // Generate HTML for all vouchers
      let allHTML = '';
      for (const voucherData of vouchersData) {
        const voucherHTML = await this.generateVoucherHTML(voucherData, companyData, 'both');
        allHTML += voucherHTML + '<div style="page-break-after: always;"></div>';
      }

      // Remove the last page break
      allHTML = allHTML.replace('<div style="page-break-after: always;"></div>', '');

      await page.setContent(allHTML, { waitUntil: 'networkidle0' });

      const pdfOptions = {
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size: 10px; color: #666; text-align: center; width: 100%;">
            ${companyData.name} - Bulk Fee Vouchers
          </div>
        `,
        footerTemplate: `
          <div style="font-size: 10px; color: #666; text-align: center; width: 100%;">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span>
          </div>
        `
      };

      const pdfBuffer = await page.pdf(pdfOptions);
      await browser.close();

      const filename = `Bulk_Vouchers_${Date.now()}.pdf`;
      let filePath = '';

      if (saveToFile) {
        filePath = path.join(outputDir, filename);
        fs.writeFileSync(filePath, pdfBuffer);
      }

      return {
        success: true,
        pdfBuffer: pdfBuffer,
        filename: filename,
        filePath: filePath,
        size: pdfBuffer.length,
        voucherCount: vouchersData.length
      };

    } catch (error) {
      console.error('Error generating bulk PDF vouchers:', error);
      throw error;
    }
  }

  async generateVoucherHTML(voucherData, companyData, copyType) {
    const {
      voucher,
      calculation
    } = voucherData;

    const companyColors = companyData.colors || {
      primary: '#2563eb',
      secondary: '#64748b',
      accent: '#f59e0b',
      success: '#10b981',
      danger: '#ef4444'
    };

    const companyLogo = companyData.logo || '';
    const companyName = companyData.name || 'Coaching Center';
    const companyAddress = companyData.address || '';
    const companyPhone = companyData.phone || '';
    const companyEmail = companyData.email || '';

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Fee Voucher - ${voucher.voucherNumber}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
          }
          
          .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid ${companyColors.primary};
          }
          
          .logo {
            max-width: 120px;
            max-height: 60px;
            margin-bottom: 10px;
          }
          
          .company-name {
            font-size: 20px;
            font-weight: bold;
            color: ${companyColors.primary};
            margin-bottom: 5px;
          }
          
          .company-contact {
            font-size: 10px;
            color: #666;
          }
          
          .voucher-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding: 10px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 5px;
          }
          
          .voucher-number {
            font-size: 16px;
            font-weight: bold;
            color: ${companyColors.primary};
          }
          
          .voucher-date {
            font-size: 11px;
            color: #666;
          }
          
          .copy-label {
            font-size: 14px;
            font-weight: bold;
            padding: 5px 10px;
            border-radius: 3px;
            text-transform: uppercase;
          }
          
          .office-copy {
            background-color: ${companyColors.primary};
            color: white;
          }
          
          .student-copy {
            background-color: ${companyColors.success};
            color: white;
          }
          
          .student-info {
            margin-bottom: 20px;
            padding: 15px;
            background-color: #f1f5f9;
            border-radius: 5px;
          }
          
          .info-row {
            display: flex;
            margin-bottom: 8px;
          }
          
          .info-label {
            font-weight: bold;
            width: 80px;
            color: ${companyColors.secondary};
          }
          
          .info-value {
            flex: 1;
          }
          
          .fee-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          
          .fee-table th,
          .fee-table td {
            border: 1px solid #e2e8f0;
            padding: 8px;
            text-align: left;
          }
          
          .fee-table th {
            background-color: ${companyColors.primary};
            color: white;
            font-weight: bold;
          }
          
          .fee-table tr:nth-child(even) {
            background-color: #f8fafc;
          }
          
          .amount {
            text-align: right;
            font-weight: bold;
          }
          
          .totals {
            margin-bottom: 20px;
            padding: 15px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 5px;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          
          .total-row.grand-total {
            font-size: 14px;
            font-weight: bold;
            color: ${companyColors.primary};
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
          }
          
          .late-fee {
            color: ${companyColors.danger};
          }
          
          .status {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
          }
          
          .status.paid {
            background-color: ${companyColors.success};
            color: white;
          }
          
          .status.pending {
            background-color: ${companyColors.accent};
            color: white;
          }
          
          .status.overdue {
            background-color: ${companyColors.danger};
            color: white;
          }
          
          .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 10px;
            color: #666;
          }
          
          .page-break {
            page-break-before: always;
          }
          
          .notes {
            margin-top: 15px;
            padding: 10px;
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
    `;

    // Generate office copy
    if (copyType === 'office' || copyType === 'both') {
      html += `
        <div class="voucher-section">
          ${this.generateVoucherSection(voucher, calculation, companyData, 'office', companyColors)}
        </div>
      `;

      if (copyType === 'both') {
        html += '<div class="page-break"></div>';
      }
    }

    // Generate student copy
    if (copyType === 'student' || copyType === 'both') {
      html += `
        <div class="voucher-section">
          ${this.generateVoucherSection(voucher, calculation, companyData, 'student', companyColors)}
        </div>
      `;
    }

    html += `
      </body>
      </html>
    `;

    return html;
  }

  generateVoucherSection(voucher, calculation, companyData, copyType, colors) {
    const copyLabel = copyType === 'office' ? 'Office Copy' : 'Student Copy';
    const copyClass = copyType === 'office' ? 'office-copy' : 'student-copy';

    return `
      <div class="header">
        ${companyData.logo ? `<img src="${companyData.logo}" alt="${companyData.name}" class="logo">` : ''}
        <div class="company-name">${companyData.name}</div>
        <div class="company-contact">
          ${companyData.address ? `${companyData.address}<br>` : ''}
          ${companyData.phone ? `Phone: ${companyData.phone}<br>` : ''}
          ${companyData.email ? `Email: ${companyData.email}` : ''}
        </div>
      </div>

      <div class="voucher-header">
        <div>
          <div class="voucher-number">Voucher #: ${voucher.voucherNumber}</div>
          <div class="voucher-date">Generated: ${new Date(voucher.generatedDate).toLocaleDateString()}</div>
        </div>
        <div class="copy-label ${copyClass}">${copyLabel}</div>
      </div>

      <div class="student-info">
        <div class="info-row">
          <div class="info-label">Student:</div>
          <div class="info-value">${voucher.student.name}</div>
        </div>
        ${voucher.student.phone ? `
          <div class="info-row">
            <div class="info-label">Phone:</div>
            <div class="info-value">${voucher.student.phone}</div>
          </div>
        ` : ''}
        ${voucher.student.email ? `
          <div class="info-row">
            <div class="info-label">Email:</div>
            <div class="info-value">${voucher.student.email}</div>
          </div>
        ` : ''}
        <div class="info-row">
          <div class="info-label">Month:</div>
          <div class="info-value">${new Date(voucher.month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Due Date:</div>
          <div class="info-value">${new Date(voucher.dueDate).toLocaleDateString()}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Status:</div>
          <div class="info-value">
            <span class="status ${voucher.status}">${voucher.status}</span>
            ${calculation.voucher.isOverdue ? '<span class="status overdue">OVERDUE</span>' : ''}
          </div>
        </div>
      </div>

      <table class="fee-table">
        <thead>
          <tr>
            <th>Course</th>
            <th>Monthly Fee</th>
            <th>Discount</th>
            <th>Net Fee</th>
          </tr>
        </thead>
        <tbody>
          ${calculation.courseBreakdown.map(course => `
            <tr>
              <td>${course.courseName}</td>
              <td class="amount">Rs. ${course.monthlyFee.toFixed(2)}</td>
              <td class="amount">Rs. ${course.discount.toFixed(2)}</td>
              <td class="amount">Rs. ${course.netFee.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row">
          <span>Total Fee (Within Due Date):</span>
          <span class="amount">Rs. ${calculation.totals.totalWithinDueDate.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Late Fee (if after due date):</span>
          <span class="amount late-fee">Rs. ${calculation.totals.totalAfterDueDate - calculation.totals.totalWithinDueDate}</span>
        </div>
        <div class="total-row grand-total">
          <span>Total (After Due Date):</span>
          <span class="amount">Rs. ${calculation.totals.totalAfterDueDate.toFixed(2)}</span>
        </div>
        ${voucher.paidAmount > 0 ? `
          <div class="total-row">
            <span>Amount Paid:</span>
            <span class="amount">Rs. ${voucher.paidAmount.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>Balance Due:</span>
            <span class="amount">Rs. ${calculation.totals.balanceDue.toFixed(2)}</span>
          </div>
        ` : ''}
      </div>

      ${copyType === 'office' ? `
        <div class="notes">
          <strong>Office Use Only:</strong><br>
          Payment received: _________________ Date: _______________<br>
          Received by: _________________ Mode: _______________<br>
          Student copy stamped and returned: _________________
        </div>
      ` : `
        <div class="notes">
          <strong>Important Instructions:</strong><br>
          1. Please pay the fee before the due date to avoid late charges<br>
          2. Late fee of Rs. ${voucher.lateFeeAmount} will be applied after due date<br>
          3. Keep this receipt for your records<br>
          4. Contact office for any queries
        </div>
      `}

      <div class="footer">
        This is a computer generated voucher and does not require signature.<br>
        ${copyType === 'office' ? 'Office Copy - For Record Keeping' : 'Student Copy - Please Keep Safely'}
      </div>
    `;
  }
}

export default new PDFVoucherService();

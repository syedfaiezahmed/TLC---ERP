import pdfVoucherService from '../services/pdfVoucherService.js';
import voucherService from '../services/voucherService.js';
import feeCalculationService from '../services/feeCalculationService.js';
import Company from '../models/Company.js';
import fs from 'fs';
import path from 'path';

class PDFVoucherController {
  async generateVoucherPDF(req, res) {
    try {
      const { voucherId } = req.params;
      const { copyType = 'both', download = false } = req.query;
      const companyId = req.user.company;

      // Get voucher details
      const voucher = await voucherService.getVoucherDetails(companyId, voucherId);
      const calculation = await feeCalculationService.calculateFeeForVoucher(voucherId, companyId);
      
      // Get company settings
      const company = await Company.findById(companyId);

      const voucherData = {
        voucher: voucher,
        calculation: calculation
      };

      const options = {
        copyType: copyType,
        saveToFile: true,
        outputDir: './temp/vouchers'
      };

      const pdfResult = await pdfVoucherService.generateVoucherPDF(
        voucherData,
        company,
        options
      );

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfResult.size);
      
      if (download) {
        res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.filename}"`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${pdfResult.filename}"`);
      }

      // Send PDF buffer
      res.send(pdfResult.pdfBuffer);

    } catch (error) {
      console.error('Error generating voucher PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate voucher PDF',
        error: error.message
      });
    }
  }

  async generateBulkVoucherPDF(req, res) {
    try {
      const { voucherIds, copyType = 'both', download = false } = req.body;
      const companyId = req.user.company;

      if (!Array.isArray(voucherIds) || voucherIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Voucher IDs array is required'
        });
      }

      // Get all vouchers data
      const vouchersData = [];
      for (const voucherId of voucherIds) {
        try {
          const voucher = await voucherService.getVoucherDetails(companyId, voucherId);
          const calculation = await feeCalculationService.calculateFeeForVoucher(voucherId, companyId);
          
          vouchersData.push({
            voucher: voucher,
            calculation: calculation
          });
        } catch (error) {
          console.error(`Error preparing voucher ${voucherId}:`, error);
        }
      }

      if (vouchersData.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid vouchers found'
        });
      }

      // Get company settings
      const company = await Company.findById(companyId);

      const options = {
        saveToFile: true,
        outputDir: './temp/vouchers'
      };

      const pdfResult = await pdfVoucherService.generateBulkVoucherPDF(
        vouchersData,
        company,
        options
      );

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfResult.size);
      
      if (download) {
        res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.filename}"`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${pdfResult.filename}"`);
      }

      // Send PDF buffer
      res.send(pdfResult.pdfBuffer);

    } catch (error) {
      console.error('Error generating bulk voucher PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate bulk voucher PDF',
        error: error.message
      });
    }
  }

  async previewVoucherPDF(req, res) {
    try {
      const { voucherId } = req.params;
      const { copyType = 'both' } = req.query;
      const companyId = req.user.company;

      // Get voucher details
      const voucher = await voucherService.getVoucherDetails(companyId, voucherId);
      const calculation = await feeCalculationService.calculateFeeForVoucher(voucherId, companyId);
      
      // Get company settings
      const company = await Company.findById(companyId);

      const voucherData = {
        voucher: voucher,
        calculation: calculation
      };

      // Generate HTML preview (without PDF conversion)
      const htmlContent = await pdfVoucherService.generateVoucherHTML(
        voucherData,
        company,
        copyType
      );

      res.setHeader('Content-Type', 'text/html');
      res.send(htmlContent);

    } catch (error) {
      console.error('Error previewing voucher PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to preview voucher PDF',
        error: error.message
      });
    }
  }

  async downloadVoucherPDF(req, res) {
    try {
      const { voucherId } = req.params;
      const { copyType = 'both' } = req.query;
      const companyId = req.user.company;

      // Generate PDF with download flag
      req.query.download = true;
      return this.generateVoucherPDF(req, res);

    } catch (error) {
      console.error('Error downloading voucher PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to download voucher PDF',
        error: error.message
      });
    }
  }

  async emailVoucherPDF(req, res) {
    try {
      const { voucherId } = req.params;
      const { copyType = 'both', email, subject, message } = req.body;
      const companyId = req.user.company;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email address is required'
        });
      }

      // Get voucher details
      const voucher = await voucherService.getVoucherDetails(companyId, voucherId);
      const calculation = await feeCalculationService.calculateFeeForVoucher(voucherId, companyId);
      
      // Get company settings
      const company = await Company.findById(companyId);

      const voucherData = {
        voucher: voucher,
        calculation: calculation
      };

      const options = {
        copyType: copyType,
        saveToFile: false // Don't save to file for email
      };

      const pdfResult = await pdfVoucherService.generateVoucherPDF(
        voucherData,
        company,
        options
      );

      // In a real implementation, you would send email here
      // For now, we'll just return success with the PDF buffer
      res.json({
        success: true,
        message: 'Voucher PDF prepared for email',
        emailInfo: {
          to: email,
          subject: subject || `Fee Voucher - ${voucher.voucherNumber}`,
          message: message || 'Please find attached your fee voucher.',
          pdfSize: pdfResult.size
        },
        pdfBuffer: pdfResult.pdfBuffer // Include buffer for email service
      });

    } catch (error) {
      console.error('Error emailing voucher PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to email voucher PDF',
        error: error.message
      });
    }
  }

  async getVoucherPrintSettings(req, res) {
    try {
      const companyId = req.user.company;

      const company = await Company.findById(companyId);

      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      const printSettings = {
        company: {
          name: company.name,
          logo: company.logo,
          address: company.address,
          phone: company.phone,
          email: company.email,
          colors: company.colors || {
            primary: '#2563eb',
            secondary: '#64748b',
            accent: '#f59e0b',
            success: '#10b981',
            danger: '#ef4444'
          }
        },
        defaultSettings: {
          copyType: 'both',
          includeLateFee: true,
          includeCompanyDetails: true,
          includeStudentDetails: true,
          includePaymentInstructions: true
        }
      };

      res.json({
        success: true,
        settings: printSettings
      });

    } catch (error) {
      console.error('Error getting voucher print settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get voucher print settings',
        error: error.message
      });
    }
  }

  async updatePrintSettings(req, res) {
    try {
      const { colors, logo, printSettings } = req.body;
      const companyId = req.user.company;

      const company = await Company.findById(companyId);

      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      // Update company settings
      if (colors) {
        company.colors = { ...company.colors, ...colors };
      }

      if (logo) {
        company.logo = logo;
      }

      if (printSettings) {
        company.printSettings = { ...company.printSettings, ...printSettings };
      }

      await company.save();

      res.json({
        success: true,
        message: 'Print settings updated successfully',
        company: company
      });

    } catch (error) {
      console.error('Error updating print settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update print settings',
        error: error.message
      });
    }
  }

  async getGeneratedPDFs(req, res) {
    try {
      const companyId = req.user.company;
      const { page = 1, limit = 20 } = req.query;

      const outputDir = './temp/vouchers';
      const companyDir = path.join(outputDir, companyId);

      if (!fs.existsSync(companyDir)) {
        return res.json({
          success: true,
          pdfs: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          }
        });
      }

      const files = fs.readdirSync(companyDir)
        .filter(file => file.endsWith('.pdf'))
        .map(file => {
          const filePath = path.join(companyDir, file);
          const stats = fs.statSync(filePath);
          
          return {
            filename: file,
            filepath: filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);

      const total = files.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedFiles = files.slice(startIndex, endIndex);

      res.json({
        success: true,
        pdfs: paginatedFiles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Error getting generated PDFs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get generated PDFs',
        error: error.message
      });
    }
  }

  async deleteGeneratedPDF(req, res) {
    try {
      const { filename } = req.params;
      const companyId = req.user.company;

      const filePath = path.join('./temp/vouchers', companyId, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'PDF file not found'
        });
      }

      fs.unlinkSync(filePath);

      res.json({
        success: true,
        message: 'PDF file deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting generated PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete generated PDF',
        error: error.message
      });
    }
  }
}

export default new PDFVoucherController();

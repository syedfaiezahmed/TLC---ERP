import { createTheme, alpha } from '@mui/material/styles';

// ─── QuickBooks-Inspired Design System ───────────────────────────────────────
// Primary green matches Intuit / QuickBooks Online brand palette
const qbGreen      = '#2CA01C';   // QB primary green
const qbGreenDark  = '#1E7B14';   // Hover / dark variant
const qbGreenLight = '#4DBF3D';   // Light variant
const qbBlue       = '#0077C5';   // Secondary accent
const bgDefault    = '#F5F7FA';   // QB page background
const bgPaper      = '#FFFFFF';
const textPrimary  = '#3D3D3D';   // QB body text
const textSec      = '#6B7280';   // Muted text
const borderColor  = '#D0D5DD';   // Subtle borders
const successGreen = '#2CA01C';
const errorRed     = '#D92D20';
const warningAmb   = '#F59E0B';

const theme = createTheme({
  spacing: 8,
  palette: {
    mode: 'light',
    primary: {
      main:         qbGreen,
      light:        qbGreenLight,
      dark:         qbGreenDark,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main:         qbBlue,
      light:        '#3395D4',
      dark:         '#005A99',
      contrastText: '#FFFFFF',
    },
    success: {
      main:         successGreen,
      light:        '#4DBF3D',
      dark:         '#1E7B14',
      contrastText: '#FFFFFF',
    },
    error: {
      main:         errorRed,
      light:        '#F04438',
      dark:         '#B42318',
      contrastText: '#FFFFFF',
    },
    warning: {
      main:         warningAmb,
      light:        '#FBBF24',
      dark:         '#D97706',
      contrastText: '#FFFFFF',
    },
    info: {
      main:         qbBlue,
      light:        '#3395D4',
      dark:         '#005A99',
      contrastText: '#FFFFFF',
    },
    background: {
      default: bgDefault,
      paper:   bgPaper,
    },
    text: {
      primary:   textPrimary,
      secondary: textSec,
      disabled:  '#9DA4AE',
    },
    divider: borderColor,
  },
  typography: {
    fontFamily: '"Avenir Next", "Inter", "Roboto", -apple-system, BlinkMacSystemFont, sans-serif',
    h1: { fontWeight: 700, fontSize: '2rem',    letterSpacing: '-0.02em',  lineHeight: 1.2 },
    h2: { fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.015em', lineHeight: 1.2 },
    h3: { fontWeight: 700, fontSize: '1.5rem',  letterSpacing: '-0.01em',  lineHeight: 1.3 },
    h4: { fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.005em', lineHeight: 1.3 },
    h5: { fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.4 },
    h6: { fontWeight: 700, fontSize: '1rem',    lineHeight: 1.4 },
    subtitle1: { fontWeight: 600, fontSize: '0.875rem',   lineHeight: 1.5 },
    subtitle2: { fontWeight: 600, fontSize: '0.8125rem',  lineHeight: 1.5 },
    body1:     { fontSize: '0.875rem',  lineHeight: 1.6, fontWeight: 400 },
    body2:     { fontSize: '0.8125rem', lineHeight: 1.6, fontWeight: 400 },
    caption:   { fontSize: '0.75rem',  lineHeight: 1.5, fontWeight: 500 },
    button:    { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', letterSpacing: '0.01em' },
  },
  shape: { borderRadius: 6 },
  shadows: [
    'none',
    '0 1px 2px rgba(0,0,0,0.05)',
    '0 1px 4px rgba(0,0,0,0.07)',
    '0 2px 6px rgba(0,0,0,0.09)',
    '0 4px 10px rgba(0,0,0,0.10)',
    '0 6px 14px rgba(0,0,0,0.11)',
    '0 8px 18px rgba(0,0,0,0.12)',
    '0 12px 24px rgba(0,0,0,0.13)',
    '0 16px 32px rgba(0,0,0,0.14)',
    ...Array(16).fill('none'),
  ],
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true, size: 'medium' },
      styleOverrides: {
        root: {
          padding: '8px 18px',
          borderRadius: 6,
          minHeight: 36,
          fontWeight: 600,
          transition: 'all 0.18s ease',
          textTransform: 'none',
        },
        sizeSmall: { padding: '5px 12px', minHeight: 30, fontSize: '0.8125rem' },
        sizeLarge: { padding: '10px 22px', minHeight: 42, fontSize: '0.9375rem' },
        containedPrimary: {
          background: `linear-gradient(180deg, ${qbGreenLight} 0%, ${qbGreen} 100%)`,
          boxShadow: `0 1px 3px ${alpha(qbGreen, 0.25)}`,
          '&:hover': {
            background: `linear-gradient(180deg, ${qbGreen} 0%, ${qbGreenDark} 100%)`,
            boxShadow: `0 3px 8px ${alpha(qbGreen, 0.35)}`,
          },
        },
        outlined: {
          borderWidth: '1.5px',
          '&:hover': { borderWidth: '1.5px' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: `1px solid ${borderColor}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          backgroundImage: 'none',
          transition: 'box-shadow 0.18s ease, transform 0.18s ease',
          '&:hover': { boxShadow: '0 4px 14px rgba(0,0,0,0.10)' },
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', fullWidth: true, size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 6,
            backgroundColor: bgPaper,
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: qbGreen },
            '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(qbGreen, 0.12)}` },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: qbGreen },
          },
          '& .MuiInputLabel-root.Mui-focused': { color: qbGreen },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: borderColor,
          '&.Mui-checked': { color: qbGreen },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: { '&.Mui-checked': { color: qbGreen }, '&.Mui-checked + .MuiSwitch-track': { backgroundColor: qbGreen } },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: '#F9FAFB',
          color: textSec,
          fontWeight: 700,
          textTransform: 'uppercase',
          fontSize: '0.6875rem',
          letterSpacing: '0.05em',
          padding: '10px 16px',
          borderBottom: `2px solid ${borderColor}`,
          whiteSpace: 'nowrap',
        },
        root: {
          padding: '11px 16px',
          borderColor: alpha(borderColor, 0.6),
          fontSize: '0.8125rem',
          color: textPrimary,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: bgPaper,
          color: textPrimary,
          borderBottom: `1px solid ${borderColor}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          height: 56,
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: { minHeight: '56px !important' },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1C2B36',  // QB-style dark sidebar
          color: '#FFFFFF',
          borderRight: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 4,
          fontSize: '0.75rem',
          height: 24,
        },
        sizeSmall: { height: 20, fontSize: '0.6875rem' },
        colorPrimary: {
          backgroundColor: alpha(qbGreen, 0.12),
          color: qbGreenDark,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        rounded: { borderRadius: 8 },
        elevation1: { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
        elevation2: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 10, boxShadow: '0 10px 40px rgba(0,0,0,0.16)' },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1.125rem',
          fontWeight: 700,
          padding: '18px 24px',
          borderBottom: `1px solid ${borderColor}`,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: { root: { padding: '24px' } },
    },
    MuiDialogActions: {
      styleOverrides: { root: { padding: '14px 24px', borderTop: `1px solid ${borderColor}` } },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, backgroundColor: alpha(qbGreen, 0.1) },
        bar: { borderRadius: 4 },
        colorPrimary: { '& .MuiLinearProgress-bar': { backgroundColor: qbGreen } },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          '&.Mui-selected': { color: qbGreen },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { backgroundColor: qbGreen, height: 3, borderRadius: '3px 3px 0 0' },
      },
    },
  },
});

export default theme;

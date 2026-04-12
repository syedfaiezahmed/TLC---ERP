import { createTheme, alpha } from '@mui/material/styles';

/**
 * Premium Education ERP Design System
 * STRICT RULES: Max 20px border-radius | 8px spacing grid | Compact & Dense
 * Primary: Blue | Secondary: Orange (CTA only) | Professional SaaS Standard
 */

const primaryBlue = '#1E40AF';    // Blue 800 - Primary brand
const primaryBlueLight = '#3B82F6'; // Blue 500
const accentOrange = '#F97316';   // Orange 500 - CTA/Actions only
const accentOrangeDark = '#EA580C'; // Orange 600
const textPrimary = '#0F172A';    // Slate 900
const textSecondary = '#64748B';  // Slate 500
const bgDefault = '#F8FAFC';      // Slate 50
const bgPaper = '#FFFFFF';        // White
const borderColor = '#E2E8F0';    // Slate 200
const successGreen = '#10B981';   // Emerald 500
const errorRed = '#EF4444';       // Red 500
const warningAmber = '#F59E0B';   // Amber 500

const theme = createTheme({
  spacing: 8, // Strict 8px grid system
  palette: {
    mode: 'light',
    primary: {
      main: primaryBlue,
      light: primaryBlueLight,
      dark: '#1E3A8A',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: accentOrange,
      light: '#FB923C',
      dark: accentOrangeDark,
      contrastText: '#FFFFFF',
    },
    success: {
      main: successGreen,
      light: '#34D399',
      dark: '#059669',
      contrastText: '#FFFFFF',
    },
    error: {
      main: errorRed,
      light: '#F87171',
      dark: '#DC2626',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: warningAmber,
      light: '#FBBF24',
      dark: '#D97706',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#0EA5E9',
      light: '#38BDF8',
      dark: '#0284C7',
      contrastText: '#FFFFFF',
    },
    background: {
      default: bgDefault,
      paper: bgPaper,
    },
    text: {
      primary: textPrimary,
      secondary: textSecondary,
      disabled: '#94A3B8',
    },
    divider: borderColor,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", -apple-system, BlinkMacSystemFont, sans-serif',
    h1: { fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.025em', lineHeight: 1.2 },
    h2: { fontWeight: 800, fontSize: '1.75rem', letterSpacing: '-0.02em', lineHeight: 1.2 },
    h3: { fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.015em', lineHeight: 1.3 },
    h4: { fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.01em', lineHeight: 1.3 },
    h5: { fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.4 },
    h6: { fontWeight: 700, fontSize: '1rem', lineHeight: 1.4 },
    subtitle1: { fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.5 },
    subtitle2: { fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.5 },
    body1: { fontSize: '0.875rem', lineHeight: 1.6, fontWeight: 400 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.6, fontWeight: 400 },
    caption: { fontSize: '0.75rem', lineHeight: 1.5, fontWeight: 500 },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', letterSpacing: '0.01em' },
  },
  shape: {
    borderRadius: 6, // Default radius - NEVER exceed 20px anywhere
  },
  shadows: [
    'none',
    '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
    '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
    '0 2px 6px -1px rgba(0, 0, 0, 0.08)',
    '0 4px 8px -2px rgba(0, 0, 0, 0.1)',
    '0 6px 12px -3px rgba(0, 0, 0, 0.12)',
    '0 8px 16px -4px rgba(0, 0, 0, 0.14)',
    '0 12px 24px -6px rgba(0, 0, 0, 0.16)',
    '0 16px 32px -8px rgba(0, 0, 0, 0.18)',
    ...Array(16).fill('none'),
  ],
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        size: 'medium',
      },
      styleOverrides: {
        root: {
          padding: '8px 16px',
          borderRadius: 6,
          minHeight: 36,
          fontWeight: 600,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          textTransform: 'none',
        },
        sizeSmall: {
          padding: '6px 12px',
          minHeight: 32,
          fontSize: '0.8125rem',
        },
        sizeLarge: {
          padding: '10px 20px',
          minHeight: 42,
          fontSize: '0.9375rem',
        },
        containedPrimary: {
          boxShadow: '0 1px 3px rgba(30, 64, 175, 0.15)',
          '&:hover': {
            boxShadow: '0 4px 8px rgba(30, 64, 175, 0.25)',
          },
        },
        containedSecondary: {
          boxShadow: '0 1px 3px rgba(249, 115, 22, 0.15)',
          '&:hover': {
            boxShadow: '0 4px 8px rgba(249, 115, 22, 0.3)',
          },
        },
        outlined: {
          borderWidth: '1.5px',
          '&:hover': {
            borderWidth: '1.5px',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: `1px solid ${borderColor}`,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        fullWidth: true,
        size: 'small',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 6,
            backgroundColor: bgPaper,
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: primaryBlueLight,
            },
            '&.Mui-focused': {
              boxShadow: `0 0 0 3px ${alpha(primaryBlue, 0.08)}`,
            },
          },
          '& .MuiInputLabel-root': {
            fontWeight: 500,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: alpha(bgDefault, 0.6),
          color: textSecondary,
          fontWeight: 700,
          textTransform: 'uppercase',
          fontSize: '0.6875rem',
          letterSpacing: '0.05em',
          padding: '12px 16px',
          borderBottom: `2px solid ${borderColor}`,
          whiteSpace: 'nowrap',
        },
        root: {
          padding: '12px 16px',
          borderColor: alpha(borderColor, 0.5),
          fontSize: '0.8125rem',
          color: textPrimary,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(bgPaper, 0.85),
          backdropFilter: 'blur(12px)',
          color: textPrimary,
          borderBottom: `1px solid ${borderColor}`,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          height: 64,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0F172A',
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
          height: 26,
          letterSpacing: '0.01em',
        },
        sizeSmall: {
          height: 22,
          fontSize: '0.6875rem',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        rounded: {
          borderRadius: 8,
        },
        elevation1: {
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        },
        elevation2: {
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1.25rem',
          fontWeight: 700,
          padding: '20px 24px',
          borderBottom: `1px solid ${borderColor}`,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '24px',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '16px 24px',
          borderTop: `1px solid ${borderColor}`,
        },
      },
    },
  },
});

export default theme;

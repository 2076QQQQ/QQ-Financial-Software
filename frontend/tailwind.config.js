/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './*.{ts,tsx}',        // 👈 新增：扫描根目录下的文件
    './src/**/*.{ts,tsx}', // 👈 新增：以防万一你把文件放进了 src
    // 如果你的文件都在一个叫 frontend 的文件夹里，请加上这一行：
    './frontend/**/*.{ts,tsx}',
    "./*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
    border: 'var(--border)', // 👈 去掉了 hsl(...)
    input: 'var(--input)',
    ring: 'var(--ring)',
    background: 'var(--background)',
    foreground: 'var(--foreground)',
    primary: {
      DEFAULT: 'var(--primary)',
      foreground: 'var(--primary-foreground)',
    },
    secondary: {
      DEFAULT: 'var(--secondary)',
      foreground: 'var(--secondary-foreground)',
    },
    destructive: {
      DEFAULT: 'var(--destructive)',
      foreground: 'var(--destructive-foreground)',
    },
    muted: {
      DEFAULT: 'var(--muted)',
      foreground: 'var(--muted-foreground)',
    },
    accent: {
      DEFAULT: 'var(--accent)',
      foreground: 'var(--accent-foreground)',
    },
    popover: {
      DEFAULT: 'var(--popover)',
      foreground: 'var(--popover-foreground)',
    },
    card: {
      DEFAULT: 'var(--card)',
      foreground: 'var(--card-foreground)',
    },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
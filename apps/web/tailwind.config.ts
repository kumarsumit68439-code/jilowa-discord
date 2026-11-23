import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        discord: {
          bg: '#313338',
          darker: '#2b2d31',
          darkest: '#1e1f22',
          sidebar: '#1e1f22',
          channel: '#2b2d31',
          hover: '#35373c',
          active: '#404249',
          blurple: '#5865f2',
          green: '#23a559',
          red: '#f23f43',
          text: '#dbdee1',
          muted: '#949ba4',
          link: '#00a8fc',
        },
      },
    },
  },
  plugins: [],
};
export default config;

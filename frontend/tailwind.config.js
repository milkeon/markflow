/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e6f4ea',
          100: '#ceead6',
          200: '#a8dab5',
          300: '#82c996',
          400: '#5bb974',
          500: '#00875a', // 포레스트 그린
          600: '#006644',
          700: '#004d33',
          800: '#003322',
          900: '#001a11',
        },
        dark: {
          50: '#f6f6f6',
          100: '#e7e7e7',
          200: '#d1d1d1',
          300: '#b0b0b0',
          400: '#888888',
          500: '#6d6d6d',
          600: '#5d5d5d',
          700: '#4f4f4f',
          800: '#1b1b1f', // dark mode bg
          900: '#121214', // dark mode inner bg
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      zIndex: {
        level1: '10', // 맨 뒤의 배경 (예: 배경 데코 요소)
        level2: '20', // 헤더, 사이드, 히어로, 메인, 푸터 등 레이아웃 영역
        level3: '30', // 일반 버튼, 플로팅 툴바, 캔버스 내 조작계
        level4: '40', // 모달 배경 및 팝업창
        level5: '50', // 모달 내 영역 구분 및 내부 컴포넌트
        level6: '60', // 모달 내부 버튼, 최상단 토스트 알림 등
      }
    },
  },
  plugins: [],
}

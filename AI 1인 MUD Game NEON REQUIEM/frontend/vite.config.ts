import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// WHY: 기본 base '/'는 `/assets/...` 절대 경로를 씀. Live Server로 dist 상위를 연 경우·file://·하위 경로 배포 시 장면 PNG가 404(깨진 이미지)가 됨.
export default defineConfig({
  base: './',
  plugins: [
    react(),
  ],
})

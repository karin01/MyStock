// 좌표 중복 체크 스크립트
import { ROOMS } from './src/data/rooms.ts';
const seen = {};
const dups = [];
for (const r of ROOMS) {
  const key = `${r.mapX},${r.mapY}`;
  if (seen[key]) { dups.push(`CONFLICT (${r.mapX},${r.mapY}): ${seen[key]} & ${r.id}`); }
  else seen[key] = r.id;
}
if (dups.length === 0) console.log('✅ No duplicate coordinates!');
else dups.forEach(d => console.log('❌', d));

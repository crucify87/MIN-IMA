import { db } from './firebase';
import { collection, doc, writeBatch, getDocs, serverTimestamp, query, limit } from 'firebase/firestore';

const inventorySeed = [
  { sku: 'SKU-BF-4402', name: '프리미엄 등심 스테이크', category: '소고기', currentStock: 1240, unit: 'kg', loss: '1.2%', status: '정상', location: 'A창고, 3구역, 4번 선반', safetyStock: 500 },
  { sku: 'SKU-PK-8812', name: '돼지 삼겹살 슬라브', category: '돼지고기', currentStock: 125, unit: 'kg', loss: '4.8%', status: '재고 부족', location: 'B창고, 1구역', safetyStock: 600 },
  { sku: 'SKU-PY-1109', name: '유기농 닭가슴살', category: '가금류', currentStock: 840, unit: 'kg', loss: '2.1%', status: '정상', location: 'A창고, 2구역', safetyStock: 300 },
  { sku: 'SKU-BF-4410', name: '다짐육 소고기 80/20', category: '소고기', currentStock: 2100, unit: 'kg', loss: '0.8%', status: '정상', location: 'C창고, 5구역', safetyStock: 1000 },
];

const productionSeed = [
  // Specified entries removed per user request
];

const logisticsSeed = [
  { time: '08:45 AM', type: '입고', title: '프리미엄 소고기 하프', partner: '밸리 랜치 Co.', qty: '24 유닛 (3,200 KG)', status: '도크 4 • 하역 중', color: 'bg-emerald-500' },
  { time: '10:15 AM', type: '출고', title: '모둠 프라임 컷', partner: '메트로폴리탄 스테이크하우스 그룹', qty: '145 박스 (840 KG)', status: '도크 1 • 준비 중', color: 'bg-blue-500' },
  { time: '11:30 AM', type: '출고', title: '분쇄육 벌크 (산업용)', partner: '센트럴 물류 허브', qty: '1,200 KG (파렛트 적재)', status: '스케줄 확정 • 대기 중', color: 'bg-blue-500' },
];

export const seedDatabase = async () => {
  const batch = writeBatch(db);

  // Seed Inventory
  inventorySeed.forEach((item) => {
    const ref = doc(collection(db, 'inventory'));
    batch.set(ref, { ...item, updatedAt: serverTimestamp() });
  });

  // Seed Production
  productionSeed.forEach((p) => {
    const ref = doc(collection(db, 'production_batches'));
    batch.set(ref, { ...p, createdAt: serverTimestamp() });
  });

  // Seed Logistics
  logisticsSeed.forEach((l) => {
    const ref = doc(collection(db, 'logistics'));
    batch.set(ref, { ...l, createdAt: serverTimestamp() });
  });

  await batch.commit();
  console.log('Database seeded successfully');
};

export const isDatabaseEmpty = async () => {
  const q = query(collection(db, 'inventory'), limit(1));
  const snapshot = await getDocs(q);
  return snapshot.empty;
};

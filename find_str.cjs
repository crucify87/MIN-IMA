const fs = require('fs');
const file = './src/components/sections/LogisticsContent.tsx';
const content = fs.readFileSync(file, 'utf8');

const targetStr = "중량(KG/G/BOX/EA)";
const idx = content.indexOf(targetStr);
if (idx === -1) {
  console.log("Not found targetStr!");
} else {
  console.log("Found targetStr at index:", idx);
  // Let's print 120 characters before it:
  const before = content.substring(idx - 120, idx);
  console.log("BEFORE SUBSTRING (escaped):", JSON.stringify(before));
  // Let's also print 100 characters after:
  const after = content.substring(idx, idx + 100);
  console.log("AFTER SUBSTRING (escaped):", JSON.stringify(after));
}

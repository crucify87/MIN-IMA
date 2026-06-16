const fs = require('fs');

const file = './src/components/sections/LogisticsContent.tsx';
let content = fs.readFileSync(file, 'utf8');

// We normalized line endings to '\n' earlier.
const startStr = '              <div className="space-y-1 relative">\n                <label className="text-[10px] font-black text-outline uppercase tracking-wider ml-1">중량(KG/G/BOX/EA)</label>';
const startIndex = content.indexOf(startStr);

const endStr = '               <div className="space-y-1 relative">\n                <label className="text-[10px] font-black text-outline uppercase tracking-wider ml-1 flex items-center gap-1">\n                  거래처 (다중 선택 가능)';
const endIndex = content.indexOf(endStr);

if (startIndex === -1) {
  console.error("COULD NOT FIND START STR");
  process.exit(1);
}
if (endIndex === -1) {
  console.error("COULD NOT FIND END STR");
  process.exit(1);
}

const replacement = `              {form.type === '입고&출고' ? (
                <>
                  {/* 입고 영역 */}
                  <div className="space-y-1 relative">
                    <label className="text-[10px] font-black text-[#3b82f6] uppercase tracking-wider ml-1 flex items-center gap-1">
                      <span>입고 중량</span>
                      <span className="text-[9px] text-[#3b82f6]/70">({form.weightUnit || 'KG'})</span>
                    </label>
                    <div className="flex gap-2">
                      <input 
                         type="text" 
                         placeholder="입고 중량"
                         value={formatWithCommas(form.weightIn)} 
                         onChange={e => setForm({...form, weightIn: (() => {
                            const val = e.target.value;
                            let cleaned = val.replace(/(?!^)-/g, '').replace(/[^0-9.-]/g, '');
                            const parts = cleaned.split('.');
                            if (parts.length > 2) {
                              cleaned = parts[0] + '.' + parts.slice(1).join('');
                            }
                            const dotIndex = cleaned.indexOf('.');
                            if (dotIndex !== -1) {
                              cleaned = cleaned.substring(0, dotIndex + 1) + cleaned.substring(dotIndex + 1, dotIndex + 3);
                            }
                            return cleaned;
                          })()})} 
                         className="flex-1 h-12 px-4 bg-surface-container rounded-xl font-bold focus:ring-2 ring-[#3b82f6]/20 outline-none transition-all" 
                      />
                      <div className="relative w-32 shrink-0">
                        <input
                          type="text"
                          placeholder="단위"
                          value={form.weightUnit}
                          onChange={e => setForm({...form, weightUnit: e.target.value})}
                          onFocus={() => setShowWeightUnitDropdown(true)}
                          onBlur={() => setTimeout(() => setShowWeightUnitDropdown(false), 200)}
                          className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold text-xs focus:ring-2 ring-[#3b82f6]/20 outline-none transition-all pr-8 uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => setShowWeightUnitDropdown(!showWeightUnitDropdown)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-[#3b82f6] transition-colors"
                        >
                          <ChevronDown className="w-3 h-3 transition-transform" />
                        </button>
                        {showWeightUnitDropdown && (
                          <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-outline-variant rounded-xl shadow-xl z-[60] overflow-hidden divide-y divide-outline-variant/10 py-1">
                            {['KG', 'G', 'BOX', 'EA'].map(u => (
                              <button
                                key={u}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setForm({...form, weightUnit: u});
                                  setShowWeightUnitDropdown(false);
                                }}
                                className="w-full h-9 flex items-center px-4 text-xs font-bold text-slate-800 hover:bg-[#f1f4f9] hover:text-[#3b82f6] transition-colors text-left"
                              >
                                {u}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 relative">
                    <label className="text-[10px] font-black text-[#3b82f6] uppercase tracking-wider ml-1 flex items-center gap-1">
                      <span>입고 수량</span>
                      <span className="text-[9px] text-[#3b82f6]/70">({form.unit || 'BOX'})</span>
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={formatWithCommas(form.boxesIn)} 
                        onChange={e => setForm({...form, boxesIn: e.target.value.replace(/[^0-9]/g, '')})} 
                        className="flex-1 h-12 px-4 bg-surface-container rounded-xl font-bold focus:ring-2 ring-[#3b82f6]/20 outline-none transition-all" 
                        placeholder="입고 수량"
                      />
                      <div className="relative w-32 shrink-0">
                        <input
                          type="text"
                          placeholder="단위"
                          value={form.unit}
                          onChange={e => setForm({...form, unit: e.target.value})}
                          onFocus={() => setShowUnitDropdown(true)}
                          onBlur={() => setTimeout(() => setShowUnitDropdown(false), 200)}
                          className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold text-xs focus:ring-2 ring-[#3b82f6]/20 outline-none transition-all pr-8 uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => setShowUnitDropdown(!showUnitDropdown)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-[#3b82f6] transition-colors"
                        >
                          <ChevronDown className="w-3 h-3 transition-transform" />
                        </button>
                        {showUnitDropdown && (
                          <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-outline-variant rounded-xl shadow-xl z-[60] overflow-hidden divide-y divide-outline-variant/10 py-1">
                            {['EA', 'BOX', 'KG', 'G'].map(u => (
                              <button
                                 key={u}
                                 type="button"
                                 onMouseDown={(e) => {
                                   e.preventDefault();
                                   setForm({...form, unit: u});
                                   setShowUnitDropdown(false);
                                 }}
                                 className="w-full h-9 flex items-center px-4 text-xs font-bold text-slate-800 hover:bg-[#f1f4f9] hover:text-[#3b82f6] transition-colors text-left"
                               >
                                 {u}
                               </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 출고 영역 */}
                  <div className="space-y-1 relative">
                    <label className="text-[10px] font-black text-rose-500 uppercase tracking-wider ml-1 flex items-center gap-1">
                      <span>출고 중량</span>
                      <span className="text-[9px] text-rose-500/70">({form.weightUnit || 'KG'})</span>
                    </label>
                    <div className="flex gap-2">
                      <input 
                         type="text" 
                         placeholder="출고 중량"
                         value={formatWithCommas(form.weightOut)} 
                         onChange={e => setForm({...form, weightOut: (() => {
                            const val = e.target.value;
                            let cleaned = val.replace(/(?!^)-/g, '').replace(/[^0-9.-]/g, '');
                            const parts = cleaned.split('.');
                            if (parts.length > 2) {
                              cleaned = parts[0] + '.' + parts.slice(1).join('');
                            }
                            const dotIndex = cleaned.indexOf('.');
                            if (dotIndex !== -1) {
                              cleaned = cleaned.substring(0, dotIndex + 1) + cleaned.substring(dotIndex + 1, dotIndex + 3);
                            }
                            return cleaned;
                          })()})} 
                         className="flex-1 h-12 px-4 bg-surface-container rounded-xl font-bold focus:ring-2 ring-rose-500/20 outline-none transition-all" 
                      />
                      <div className="bg-slate-100 flex items-center justify-center rounded-xl w-32 shrink-0 h-12">
                        <span className="text-xs font-bold text-slate-500">{form.weightUnit}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 relative">
                    <label className="text-[10px] font-black text-rose-500 uppercase tracking-wider ml-1 flex items-center gap-1">
                      <span>출고 수량</span>
                      <span className="text-[9px] text-rose-500/70">({form.unit || 'BOX'})</span>
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={formatWithCommas(form.boxesOut)} 
                        onChange={e => setForm({...form, boxesOut: e.target.value.replace(/[^0-9]/g, '')})} 
                        className="flex-1 h-12 px-4 bg-surface-container rounded-xl font-bold focus:ring-2 ring-rose-500/20 outline-none transition-all" 
                        placeholder="출고 수량"
                      />
                      <div className="bg-slate-100 flex items-center justify-center rounded-xl w-32 shrink-0 h-12">
                        <span className="text-xs font-bold text-slate-500">{form.unit}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1 relative">
                    <label className="text-[10px] font-black text-outline uppercase tracking-wider ml-1">중량(KG/G/BOX/EA)</label>
                    <div className="flex gap-2">
                      <input 
                         type="text" 
                         placeholder="0"
                         value={formatWithCommas(form.weight)} 
                         onChange={e => setForm({...form, weight: (() => {
                            const val = e.target.value;
                            let cleaned = val.replace(/(?!^)-/g, '').replace(/[^0-9.-]/g, '');
                            const parts = cleaned.split('.');
                            if (parts.length > 2) {
                              cleaned = parts[0] + '.' + parts.slice(1).join('');
                            }
                            const dotIndex = cleaned.indexOf('.');
                            if (dotIndex !== -1) {
                              cleaned = cleaned.substring(0, dotIndex + 1) + cleaned.substring(dotIndex + 1, dotIndex + 3);
                            }
                            return cleaned;
                          })()})} 
                         className="flex-1 h-12 px-4 bg-surface-container rounded-xl font-bold focus:ring-2 ring-primary/20 outline-none transition-all" 
                      />
                      <div className="relative w-32 shrink-0">
                        <input
                          type="text"
                          placeholder="단위"
                          value={form.weightUnit}
                          onChange={e => setForm({...form, weightUnit: e.target.value})}
                          onFocus={() => setShowWeightUnitDropdown(true)}
                          onBlur={() => setTimeout(() => setShowWeightUnitDropdown(false), 200)}
                          className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold text-xs focus:ring-2 ring-primary/20 outline-none transition-all pr-8 uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => setShowWeightUnitDropdown(!showWeightUnitDropdown)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-primary transition-colors"
                        >
                          <ChevronDown className="w-3 h-3 transition-transform" />
                        </button>
                        {showWeightUnitDropdown && (
                          <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-outline-variant rounded-xl shadow-xl z-[60] overflow-hidden divide-y divide-outline-variant/10 py-1">
                            {['KG', 'G', 'BOX', 'EA'].map(u => (
                              <button
                                key={u}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setForm({...form, weightUnit: u});
                                  setShowWeightUnitDropdown(false);
                                }}
                                className="w-full h-9 flex items-center px-4 text-xs font-bold text-slate-800 hover:bg-[#f1f4f9] hover:text-primary transition-colors text-left"
                              >
                                {u}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 relative">
                    <label className="text-[10px] font-black text-outline uppercase tracking-wider ml-1">수량(EA/BOX/KG/G)</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={formatWithCommas(form.boxes)} 
                        onChange={e => setForm({...form, boxes: e.target.value.replace(/[^0-9]/g, '')})} 
                        className="flex-1 h-12 px-4 bg-surface-container rounded-xl font-bold focus:ring-2 ring-primary/20 outline-none transition-all" 
                        placeholder="0"
                      />
                      <div className="relative w-32 shrink-0">
                        <input
                          type="text"
                          placeholder="단위"
                          value={form.unit}
                          onChange={e => setForm({...form, unit: e.target.value})}
                          onFocus={() => setShowUnitDropdown(true)}
                          onBlur={() => setTimeout(() => setShowUnitDropdown(false), 200)}
                          className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold text-xs focus:ring-2 ring-primary/20 outline-none transition-all pr-8 uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => setShowUnitDropdown(!showUnitDropdown)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-primary transition-colors"
                        >
                          <ChevronDown className="w-3 h-3 transition-transform" />
                        </button>
                        {showUnitDropdown && (
                          <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-outline-variant rounded-xl shadow-xl z-[60] overflow-hidden divide-y divide-outline-variant/10 py-1">
                            {['EA', 'BOX', 'KG', 'G'].map(u => (
                              <button
                                  key={u}
                                 type="button"
                                 onMouseDown={(e) => {
                                   e.preventDefault();
                                   setForm({...form, unit: u});
                                   setShowUnitDropdown(false);
                                 }}
                                 className="w-full h-9 flex items-center px-4 text-xs font-bold text-slate-800 hover:bg-[#f1f4f9] hover:text-primary transition-colors text-left"
                               >
                                 {u}
                               </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
`;

const updatedContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync(file, updatedContent, 'utf8');
console.log('PROGRAMMATIC UPDATE OF LOGISTICS_CONTENT COMPLETE');

import React, { useState, useMemo, useRef } from "react";
import {
  ArrowLeft,
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  CalendarDays,
  X,
  History,
  Edit,
  Trash2,
  FileDown,
} from "lucide-react";
import { motion } from "motion/react";
import {
  doc,
  updateDoc,
  increment,
  serverTimestamp,
  collection,
  addDoc,
  deleteDoc,
  runTransaction,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../../lib/firebase";
import { handleFirestoreError } from "../../lib/firestoreUtils";
import { OperationType } from "../../types";
import { DeleteConfirmModal } from "../common/DeleteConfirmModal";

function ProductionContent({
  production,
  inventory,
  onNavigate,
  canEditItems,
}: any) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const today = new Date().toLocaleDateString("sv-SE");
  const [activeShift, setActiveShift] = useState("일간");
  const [filterStartDate, setFilterStartDate] = useState(today);
  const [filterEndDate, setFilterEndDate] = useState(today);
  const startDatePickerRef = useRef<HTMLInputElement>(null);
  const endDatePickerRef = useRef<HTMLInputElement>(null);

  const handleStartDateClick = () => {
    if (startDatePickerRef.current) {
      if ("showPicker" in startDatePickerRef.current) {
        try {
          (startDatePickerRef.current as any).showPicker();
        } catch (e) {
          startDatePickerRef.current.click();
        }
      } else {
        startDatePickerRef.current.click();
      }
    }
  };

  const handleEndDateClick = () => {
    if (endDatePickerRef.current) {
      if ("showPicker" in endDatePickerRef.current) {
        try {
          (endDatePickerRef.current as any).showPicker();
        } catch (e) {
          endDatePickerRef.current.click();
        }
      } else {
        endDatePickerRef.current.click();
      }
    }
  };
  const [line, setLine] = useState("삼산공장");
  const [logDate, setLogDate] = useState(
    new Date().toLocaleDateString("sv-SE"),
  );
  const [remarks, setRemarks] = useState("");

  const [rows, setRows] = useState([
    {
      id: Date.now(),
      title: "",
      rawMaterial: "",
      brand: "",
      rawQty: "",
      production: "",
      manufDate: new Date().toLocaleDateString("sv-SE"),
      expiryDate: "",
      linkType: "none",
    },
  ]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeBrandDropdown, setActiveBrandDropdown] = useState<number | null>(
    null,
  );
  const [activeRawDropdown, setActiveRawDropdown] = useState<number | null>(
    null,
  );
  const [activeItemDropdown, setActiveItemDropdown] = useState<number | null>(
    null,
  );

  const formRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target) return;

      if (activeItemDropdown !== null) {
        const itemContainer = document.querySelector(`.item-dropdown-container-${activeItemDropdown}`);
        if (itemContainer && !itemContainer.contains(target)) {
          setActiveItemDropdown(null);
        }
      }
      if (activeRawDropdown !== null) {
        const rawContainer = document.querySelector(`.raw-dropdown-container-${activeRawDropdown}`);
        if (rawContainer && !rawContainer.contains(target)) {
          setActiveRawDropdown(null);
        }
      }
      if (activeBrandDropdown !== null) {
        const brandContainer = document.querySelector(`.brand-dropdown-container-${activeBrandDropdown}`);
        if (brandContainer && !brandContainer.contains(target)) {
          setActiveBrandDropdown(null);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeItemDropdown, activeRawDropdown, activeBrandDropdown]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [loading, setLoading] = useState(false);

  const [filterLine, setFilterLine] = useState("전체");
  const [filterRawMaterial, setFilterRawMaterial] = useState("전체");
  const [filterBrandInProd, setFilterBrandInProd] = useState("전체");

  const rawMaterialsList = useMemo(() => {
    const rawSet = new Set<string>();
    production.forEach((p: any) => {
      if (p.rawMaterial) rawSet.add(p.rawMaterial);
    });
    return Array.from(rawSet).sort();
  }, [production]);

  const brandsList = useMemo(() => {
    const brandSet = new Set<string>();
    production.forEach((p: any) => {
      if (p.brand) brandSet.add(p.brand);
    });
    return Array.from(brandSet).sort();
  }, [production]);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    id: "",
    title: "",
  });

  const handleDownloadExcel = () => {
    try {
      const fileName = `생산현황_리포트_${filterStartDate}_to_${filterEndDate}.xlsx`;

      const data = filtered.map((item) => ({
        생산일자: item.manufDate,
        라인: item.line || "-",
        품목명: item.title,
        "원육 품명": item.rawMaterial || "-",
        브랜드: item.brand || "-",
        "투입량 (KG)": item.rawQty,
        "생산량 (KG)": item.production,
        "수율 (%)": item.yield?.toFixed(1) || "0",
        "로스 (%)": item.loss?.toFixed(1) || "0",
        소비기한: item.expiryDate || "-",
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "생산내역");
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error("Excel download failed:", error);
      alert("엑셀 다운로드 중 오류가 발생했습니다.");
    }
  };

  const formatWithCommas = (value: string | number) => {
    if (value === "" || value === null || value === undefined) return "";
    let str = String(value).replace(/[^0-9.-]/g, "");
    const parts = str.split(".");
    if (parts.length > 2) {
      str = parts[0] + "." + parts.slice(1).join("");
    }
    const dotIndex = str.indexOf(".");
    if (dotIndex !== -1) {
      const integerPart = str.substring(0, dotIndex);
      let decimalPart = str.substring(dotIndex + 1);
      decimalPart = decimalPart.substring(0, 2);
      const parsedInt = parseInt(integerPart.replace(/[^0-9-]/g, ""));
      const formattedInt = isNaN(parsedInt)
        ? integerPart.startsWith("-")
          ? "-"
          : ""
        : parsedInt.toLocaleString();
      return formattedInt + "." + decimalPart;
    } else {
      const parsed = parseInt(str.replace(/[^0-9-]/g, ""));
      if (isNaN(parsed)) return str.startsWith("-") ? "-" : "";
      return parsed.toLocaleString();
    }
  };

  const brands = useMemo(() => {
    const allBrands = inventory
      .filter((i: any) => i.isApproved !== false)
      .map((i: any) => i.brand)
      .filter(Boolean);
    return Array.from(new Set(allBrands)) as string[];
  }, [inventory]);

  const rawMaterials = useMemo(() => {
    return inventory.filter((i: any) => i.category === "원육" && i.isApproved !== false);
  }, [inventory]);

  const productItems = useMemo(() => {
    return inventory.filter((i: any) => i.category !== "원육" && i.isApproved !== false);
  }, [inventory]);

  const filtered = useMemo(() => {
    const isInRange = (dateStr: string) => {
      if (!dateStr) return false;
      return dateStr >= filterStartDate && dateStr <= filterEndDate;
    };

    const result = production.filter((p: any) => {
      const matchesSearch = (p.title || "")
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesDate = isInRange(p.manufDate);
      const matchesLine = filterLine === "전체" || p.line === filterLine;
      const matchesRaw = filterRawMaterial === "전체" || p.rawMaterial === filterRawMaterial;
      const matchesBrand = filterBrandInProd === "전체" || p.brand === filterBrandInProd;
      return matchesSearch && matchesDate && matchesLine && matchesRaw && matchesBrand;
    });

    // Sort by manufDate descending then createdAt (latest first)
    return [...result]
      .sort((a: any) => {
        const timeA = a.createdAt?.seconds || 0;
        return timeA; // Keep original sorting logic
      })
      .reverse(); // Latest first
  }, [
    production,
    search,
    filterStartDate,
    filterEndDate,
    activeShift,
    filterLine,
    filterRawMaterial,
    filterBrandInProd,
  ]);

  const stats = useMemo(() => {
    const count = filtered.length;
    const totalInput = filtered.reduce(
      (acc: number, curr: any) => acc + (Number(curr.rawQty) || 0),
      0,
    );
    const totalOutput = filtered.reduce(
      (acc: number, curr: any) => acc + (Number(curr.production) || 0),
      0,
    );
    const yieldRate = totalInput > 0 ? (totalOutput / totalInput) * 100 : 0;

    return [
      { label: "생산 건수", value: count, unit: "건" },
      {
        label: "총 투입량",
        value: Math.round(totalInput).toLocaleString(),
        unit: "KG",
      },
      {
        label: "총 생산량",
        value: Math.round(totalOutput).toLocaleString(),
        unit: "KG",
      },
      { label: "총 수율", value: yieldRate.toFixed(1), unit: "%" },
    ];
  }, [filtered]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStartDate, filterEndDate, activeShift, filterLine, filterRawMaterial, filterBrandInProd]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const Pagination = ({
    current,
    total,
    onChange,
  }: {
    current: number;
    total: number;
    onChange: (p: number) => void;
  }) => {
    if (total <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 mt-8 pb-4">
        <button
          disabled={current === 1}
          onClick={() => {
            onChange(current - 1);
            window.scrollTo({
              top:
                (document.getElementById("production-list")?.offsetTop || 0) -
                100,
              behavior: "smooth",
            });
          }}
          className="p-2 bg-white border border-outline-variant rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all active:scale-95"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: total }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => {
                onChange(p);
                window.scrollTo({
                  top:
                    (document.getElementById("production-list")?.offsetTop ||
                      0) - 100,
                  behavior: "smooth",
                });
              }}
              className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${current === p ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-white border border-outline-variant text-outline hover:border-primary hover:text-primary"}`}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          disabled={current === total}
          onClick={() => {
            onChange(current + 1);
            window.scrollTo({
              top:
                (document.getElementById("production-list")?.offsetTop || 0) -
                100,
              behavior: "smooth",
            });
          }}
          className="p-2 bg-white border border-outline-variant rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all active:scale-95"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const formStatistics = useMemo(() => {
    let totalRaw = 0;
    let totalProd = 0;
    const rawGroups: {
      [key: string]: {
        rawQty: number;
        production: number;
        items: { name: string; brand: string }[];
      };
    } = {};
    const productGroups: {
      [key: string]: {
        rawQty: number;
        production: number;
        materials: { name: string; brand: string }[];
      };
    } = {};

    rows.forEach((r, idx) => {
      const isRawLinked = idx > 0 && r.linkType === "raw";
      const isProductLinked = idx > 0 && r.linkType === "product";

      const rawNum = isRawLinked ? 0 : (Number(r.rawQty) || 0);
      const prodNum = isProductLinked ? 0 : (Number(r.production) || 0);
      totalRaw += rawNum;
      totalProd += prodNum;

      const rawKey = (r.rawMaterial || "").trim() || "미지정 원육";
      if (!rawGroups[rawKey]) {
        rawGroups[rawKey] = { rawQty: 0, production: 0, items: [] };
      }
      rawGroups[rawKey].rawQty += rawNum;
      rawGroups[rawKey].production += prodNum;
      if (
        r.title &&
        !rawGroups[rawKey].items.some((item) => item.name === r.title)
      ) {
        rawGroups[rawKey].items.push({ name: r.title, brand: r.brand || "" });
      }

      const prodKey = (r.title || "").trim() || "미지정 품목";
      if (!productGroups[prodKey]) {
        productGroups[prodKey] = { rawQty: 0, production: 0, materials: [] };
      }
      productGroups[prodKey].rawQty += rawNum;
      productGroups[prodKey].production += prodNum;
      if (
        r.rawMaterial &&
        !productGroups[prodKey].materials.some(
          (mat) => mat.name === r.rawMaterial,
        )
      ) {
        productGroups[prodKey].materials.push({
          name: r.rawMaterial,
          brand: r.brand || "",
        });
      }
    });

    const overallYield = totalRaw > 0 ? (totalProd / totalRaw) * 100 : 0;
    const overallLoss =
      totalRaw > 0 ? ((totalRaw - totalProd) / totalRaw) * 100 : 0;

    const groupCalculations = Object.entries(rawGroups).map(([rawMat, g]) => {
      const yld = g.rawQty > 0 ? (g.production / g.rawQty) * 100 : 0;
      const loss =
        g.rawQty > 0 ? ((g.rawQty - g.production) / g.rawQty) * 100 : 0;
      return {
        rawMaterial: rawMat,
        rawQty: g.rawQty,
        production: g.production,
        yieldRate: yld,
        lossRate: loss,
        items: g.items,
      };
    });

    const productCalculations = Object.entries(productGroups).map(
      ([pName, g]) => {
        const yld = g.rawQty > 0 ? (g.production / g.rawQty) * 100 : 0;
        const loss =
          g.rawQty > 0 ? ((g.rawQty - g.production) / g.rawQty) * 100 : 0;
        return {
          productName: pName,
          rawQty: g.rawQty,
          production: g.production,
          yieldRate: yld,
          lossRate: loss,
          materials: g.materials,
        };
      },
    );

    return {
      totalRaw,
      totalProd,
      overallYield,
      overallLoss,
      groupCalculations,
      productCalculations,
      hasMultiple: rows.length > 1,
    };
  }, [rows]);

  const addRow = () => {
    setRows([
      ...rows,
      {
        id: Date.now(),
        title: "",
        rawMaterial: "",
        brand: "",
        rawQty: "",
        production: "",
        manufDate: logDate,
        expiryDate: "",
        linkType: "none",
      },
    ]);
  };

  const removeRow = (id: number) => {
    setRows(rows.filter((r) => r.id !== id));
  };

  const updateRow = (id: number, field: string, value: any) => {
    setRows((prevRows) =>
      prevRows.map((r) => {
        if (r.id === id) {
          const updated = { ...r, [field]: value };
          if (field === "brand") {
            const newBrand = value;
            const rawInBrand = inventory.filter(
              (i: any) => i.category === "원육" && i.brand === newBrand
            );
            if (rawInBrand.length > 0) {
              const oldRawName = r.rawMaterial || "";
              const match = rawInBrand.find((i: any) => 
                i.name.toLowerCase().includes(oldRawName.toLowerCase()) || 
                oldRawName.toLowerCase().includes(i.name.toLowerCase())
              );
              if (match) {
                updated.rawMaterial = match.name;
              } else {
                updated.rawMaterial = rawInBrand[0].name;
              }
            } else {
              updated.rawMaterial = "";
            }
          }
          return updated;
        }
        return r;
      })
    );
  };

  const setExpiryShortcut = (
    rowId: number,
    manufDate: string,
    months: number,
  ) => {
    if (!manufDate) return;
    const date = new Date(manufDate);
    if (isNaN(date.getTime())) return;
    date.setMonth(date.getMonth() + months);
    date.setDate(date.getDate() - 1);
    const expiryDate = date.toISOString().split("T")[0];
    updateRow(rowId, "expiryDate", expiryDate);
  };

  const handleAdd = async (e: any) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const updateInventoryStock = async (
        name: string,
        diff: number,
        isRaw: boolean = false,
        brandName: string = "",
      ) => {
        if (!name) return { prevStock: 0, nextStock: 0 };
        const trimmedName = name.trim();
        const existingInList = inventory.find(
          (i: any) =>
            i.name.trim() === trimmedName &&
            (isRaw ? i.category === "원육" : i.category !== "원육") &&
            i.isApproved !== false,
        );

        let itemDocRef;
        if (existingInList) {
          itemDocRef = doc(db, "inventory", existingInList.id);
        } else {
          // Generate deterministic ID safe for Firestore path
          const safeCategory = isRaw ? "원육" : "완제품";
          const safeName = encodeURIComponent(trimmedName).replace(/\./g, '%2E');
          const deterministicId = `inv_${safeCategory}_${safeName}`;
          itemDocRef = doc(db, "inventory", deterministicId);
        }

        const result = await runTransaction(db, async (transaction) => {
          const docSnap = await transaction.get(itemDocRef);
          
          let prevStock = 0;
          if (docSnap.exists()) {
            const data = docSnap.data() as any;
            prevStock = Number(data.currentStock || 0);
            transaction.update(itemDocRef, {
              currentStock: prevStock + diff,
              updatedAt: serverTimestamp(),
            });
          } else {
            prevStock = 0;
            transaction.set(itemDocRef, {
              name: trimmedName,
              specs: '',
              currentStock: diff,
              boxes: 0,
              brand: brandName || '',
              category: isRaw ? '원육' : '완제품',
              sku: `${isRaw ? "R" : "P"}-${Math.random().toString(36).substring(7).toUpperCase()}`,
              unit: 'KG',
              minStock: 0,
              location: '미지정',
              isApproved: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          return {
            prevStock,
            nextStock: prevStock + diff
          };
        });

        return result;
      };

      if (editingId) {
        const row = rows[0];
        const isRawLinked = row.linkType === "raw";
        const isProductLinked = row.linkType === "product";

        const prodNum = isProductLinked ? 0 : Number(row.production) || 0;
        const rawNum = isRawLinked ? 0 : Number(row.rawQty) || 0;
        const lossRate = rawNum > 0 ? ((rawNum - prodNum) / rawNum) * 100 : 0;
        const yieldRate = rawNum > 0 ? (prodNum / rawNum) * 100 : 0;

        const oldRecord = production.find((p: any) => p.id === editingId);
        if (oldRecord) {
          // Revert old inventory change
          if (oldRecord.production > 0) {
            await updateInventoryStock(oldRecord.title, -oldRecord.production, false, oldRecord.brand);
          }
          if (oldRecord.rawQty > 0) {
            await updateInventoryStock(
              oldRecord.rawMaterial,
              oldRecord.rawQty,
              true,
              oldRecord.brand,
            );
          }
        }

        // Apply new inventory change with stock tracking
        let prodStockInfo = { prevStock: 0, nextStock: 0 };
        let rawStockInfo = { prevStock: 0, nextStock: 0 };

        if (prodNum > 0) {
          prodStockInfo = await updateInventoryStock(row.title, prodNum, false, row.brand);
        }
        if (rawNum > 0) {
          rawStockInfo = await updateInventoryStock(row.rawMaterial, -rawNum, true, row.brand);
        }

        // Clean up row data for Firestore
        const { id: _, ...cleanRow } = row;

        await updateDoc(doc(db, "production_batches", String(editingId)), {
          ...cleanRow,
          line,
          production: prodNum,
          rawQty: rawNum,
          yield: yieldRate,
          loss: lossRate,
          linkType: row.linkType || "none",
          remarks: remarks.trim(),
          prodPrevStock: prodStockInfo.prevStock,
          prodNextStock: prodStockInfo.nextStock,
          rawPrevStock: rawStockInfo.prevStock,
          rawNextStock: rawStockInfo.nextStock,
          updatedAt: serverTimestamp(),
        });

        alert("생산 실적 수정 완료");
        setEditingId(null);
        setShowForm(false);
        setRemarks("");
        setRows([
          {
            id: Date.now(),
            title: "",
            rawMaterial: "",
            brand: "",
            rawQty: "",
            production: "",
            manufDate: logDate,
            expiryDate: "",
            linkType: "none",
          },
        ]);
        return;
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const isRawLinked = i > 0 && row.linkType === "raw";
        const isProductLinked = i > 0 && row.linkType === "product";

        const resolvedTitle = isProductLinked ? rows[i - 1].title : row.title;
        const resolvedRawMaterial = isRawLinked ? rows[i - 1].rawMaterial : row.rawMaterial;
        const resolvedBrand = isRawLinked ? rows[i - 1].brand : (isProductLinked ? rows[i - 1].brand : row.brand);

        if (!resolvedTitle) continue;

        const prodNum = isProductLinked ? 0 : Number(row.production) || 0;
        const rawNum = isRawLinked ? 0 : Number(row.rawQty) || 0;

        if (i === 0 && (!row.rawQty || !row.production)) continue;

        const lossRate = rawNum > 0 ? ((rawNum - prodNum) / rawNum) * 100 : 0;
        const yieldRate = rawNum > 0 ? (prodNum / rawNum) * 100 : 0;

        // Apply inventory change with stock tracking
        let prodStockInfo = { prevStock: 0, nextStock: 0 };
        let rawStockInfo = { prevStock: 0, nextStock: 0 };

        if (prodNum > 0) {
          prodStockInfo = await updateInventoryStock(resolvedTitle, prodNum, false, resolvedBrand);
        }
        if (rawNum > 0) {
          rawStockInfo = await updateInventoryStock(resolvedRawMaterial, -rawNum, true, resolvedBrand);
        }

        // Clean up row data for Firestore
        const { id: _, ...cleanRow } = row;

        const itemMaster = inventory.find((it: any) => it.name === resolvedTitle);
        const partner = itemMaster?.partner || "";

        await addDoc(collection(db, "production_batches"), {
          ...cleanRow,
          title: resolvedTitle,
          rawMaterial: resolvedRawMaterial,
          brand: resolvedBrand,
          line,
          partner,
          production: prodNum,
          rawQty: rawNum,
          yield: yieldRate,
          loss: lossRate,
          linkType: row.linkType || "none",
          remarks: remarks.trim(),
          prodPrevStock: prodStockInfo.prevStock,
          prodNextStock: prodStockInfo.nextStock,
          rawPrevStock: rawStockInfo.prevStock,
          rawNextStock: rawStockInfo.nextStock,
          createdAt: serverTimestamp(),
        });
      }
      alert("생산 기록 등록 및 재고 가동 처리가 정상 조치되었습니다.");
      setShowForm(false);
      setRemarks("");
      setRows([
        {
          id: Date.now(),
          title: "",
          rawMaterial: "",
          brand: "",
          rawQty: "",
          production: "",
          manufDate: logDate,
          expiryDate: "",
          linkType: "none",
        },
      ]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "production_batches");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setLine(item.line || "삼산공장");
    setLogDate(item.manufDate);
    setRemarks(item.remarks || "");
    setRows([
      {
        id: Date.now(),
        title: item.title,
        rawMaterial: item.rawMaterial,
        brand: item.brand || "",
        rawQty: item.rawQty,
        production: item.production,
        manufDate: item.manufDate,
        expiryDate: item.expiryDate || "",
        linkType: item.linkType || "none",
      },
    ]);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string, title: string) => {
    if (!canEditItems || loading) return;

    setLoading(true);
    try {
      const record = production.find((p: any) => p.id === id);

      // Perform deletion of production batch record and roll back inventories inside a transaction
      await runTransaction(db, async (transaction) => {
        // Delete batch record
        transaction.delete(doc(db, "production_batches", String(id)));

        if (record) {
          // Revert finished item stock
          if (record.production > 0) {
            const trimmedTitle = record.title.trim();
            const itemInList = inventory.find(
              (i: any) =>
                i.name.trim() === trimmedTitle &&
                i.category !== "원육" &&
                i.isApproved !== false,
            );
            if (itemInList) {
              const itemRef = doc(db, "inventory", itemInList.id);
              const snap = await transaction.get(itemRef);
              if (snap.exists()) {
                const currentStock = Number(snap.data().currentStock || 0);
                transaction.update(itemRef, {
                  currentStock: currentStock - record.production,
                  updatedAt: serverTimestamp(),
                });
              }
            }
          }
          // Revert raw material stock
          if (record.rawQty > 0) {
            const trimmedRaw = record.rawMaterial.trim();
            const rawInList = inventory.find(
              (i: any) =>
                i.name.trim() === trimmedRaw &&
                i.category === "원육" &&
                i.isApproved !== false,
            );
            if (rawInList) {
              const rawRef = doc(db, "inventory", rawInList.id);
              const snap = await transaction.get(rawRef);
              if (snap.exists()) {
                const currentStock = Number(snap.data().currentStock || 0);
                transaction.update(rawRef, {
                  currentStock: currentStock + record.rawQty,
                  updatedAt: serverTimestamp(),
                });
              }
            }
          }
        }
      });

      if (editingId === id) {
        setEditingId(null);
        setShowForm(false);
      }
      alert("생산 기록이 성공적으로 삭제되었습니다.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "production_batches");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 md:gap-6 px-1 md:px-0">
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={() => onNavigate("dashboard")}
            className="p-2 md:p-3 bg-[#e8effd] hover:bg-[#d0e0fb] text-[#0f172a] rounded-full transition-colors shrink-0 active:scale-90"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl md:text-5xl font-black text-on-surface tracking-tighter">
            생산관리
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full xl:w-auto">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleDownloadExcel}
              className="flex-none flex items-center justify-center h-11 w-11 sm:w-auto sm:px-4 bg-white border border-outline-variant rounded-xl text-sm font-bold text-on-surface hover:border-primary hover:text-primary transition-all shadow-sm active:scale-95"
              title="엑셀 다운"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline font-black ml-2">
                엑셀 다운
              </span>
            </button>

            {canEditItems && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="h-11 px-4 sm:px-6 bg-[#0f172a] text-white rounded-xl font-black flex items-center justify-center gap-2 shadow-lg hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap flex-1 sm:flex-none"
              >
                {showForm ? (
                  <X className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {showForm ? "닫기" : "생산일지 등록"}
                </span>
                <span className="sm:hidden font-black">
                  {showForm ? "닫기" : "등록"}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Entry Form */}
      {showForm && (
        <motion.div
          ref={formRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-[32px] md:rounded-[48px] border border-outline-variant/30 shadow-2xl p-6 md:p-10 space-y-8 md:space-y-10"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0">
            <h2 className="text-2xl md:text-3xl font-black text-[#0f172a] tracking-tight">
              일지 정보 입력
            </h2>
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
              <div className="flex items-center gap-3">
                <span className="text-[10px] md:text-sm font-black text-outline uppercase whitespace-nowrap">
                  생산 일자:
                </span>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setLogDate(newDate);
                    setRows(rows.map((r) => ({ ...r, manufDate: newDate })));
                  }}
                  className="h-12 md:h-14 px-4 bg-white border border-outline-variant rounded-2xl font-black text-xs md:text-sm shadow-sm outline-none cursor-pointer hover:border-primary transition-all"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] md:text-sm font-black text-outline uppercase whitespace-nowrap">
                  생산 라인:
                </span>
                <select
                  value={line}
                  onChange={(e) => setLine(e.target.value)}
                  className="h-12 md:h-14 px-6 md:px-8 bg-white border border-outline-variant rounded-2xl font-black text-xs md:text-sm shadow-sm outline-none cursor-pointer hover:border-primary transition-all w-full md:w-auto"
                >
                  <option value="삼산공장">삼산공장</option>
                  <option value="언양공장 부속물">언양공장 부속물</option>
                  <option value="언양공장 식육가공">언양공장 식육가공</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="hidden">
              <p className="col-span-3 text-center text-[12px] font-black text-outline tracking-tight">
                품목명
              </p>
              <p className="col-span-3 text-center text-[12px] font-black text-outline tracking-tight">
                원육 품명
              </p>
              <p className="col-span-2 text-center text-[12px] font-black text-outline tracking-tight">
                브랜드
              </p>
              <p className="col-span-2 text-center text-[12px] font-black text-outline tracking-tight uppercase">
                투입량 (KG)
              </p>
              <p className="col-span-2 text-center text-[12px] font-black text-outline tracking-tight uppercase">
                생산량 (KG)
              </p>
            </div>

            {rows.map((row, index) => {
              const raw = Number(row.rawQty) || 0;
              const prod = Number(row.production) || 0;
              const yieldRate = raw > 0 ? (prod / raw) * 100 : 0;
              const lossRate = raw > 0 ? ((raw - prod) / raw) * 100 : 0;

              const resolvedRawItem = inventory.find(
                (i: any) => i.name === row.rawMaterial && i.category === "원육"
              );
              const dynamicRawUnit = (resolvedRawItem?.unit || "KG").toUpperCase();

              const resolvedProdItem = inventory.find(
                (i: any) => i.name === row.title && i.category !== "원육"
              );
              const dynamicProdUnit = (resolvedProdItem?.unit || "KG").toUpperCase();

              return (
                <div
                  key={row.id}
                  className="relative bg-[#f1f5f9] p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-outline-variant/30 space-y-4"
                >
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="absolute -top-2 -right-2 w-8 h-8 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all z-10"
                      title="행 삭제"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {/* Link Selection Options for Subsequent Rows */}
                  {index > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap bg-white/60 p-2 rounded-2xl max-w-max">
                      <span className="text-[10px] font-black text-slate-500 uppercase ml-1 mr-1">연계 설정:</span>
                      <button
                        type="button"
                        onClick={() => {
                          updateRow(row.id, "linkType", "none");
                        }}
                        className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${
                          row.linkType === "none" || !row.linkType
                            ? "bg-[#0f172a] text-white"
                            : "bg-white border border-outline-variant text-[#0f172a] hover:border-[#0f172a]"
                        }`}
                      >
                        개별 등록
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateRow(row.id, "linkType", "raw");
                          updateRow(row.id, "rawMaterial", rows[index - 1].rawMaterial);
                          updateRow(row.id, "brand", rows[index - 1].brand);
                          updateRow(row.id, "rawQty", "0");
                        }}
                        className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${
                          row.linkType === "raw"
                            ? "bg-blue-600 text-white"
                            : "bg-white border border-outline-variant text-blue-600 hover:border-blue-600"
                        }`}
                      >
                        원육 연계 (1:M 가공)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateRow(row.id, "linkType", "product");
                          updateRow(row.id, "title", rows[index - 1].title);
                          updateRow(row.id, "brand", rows[index - 1].brand);
                          updateRow(row.id, "production", "0");
                          updateRow(row.id, "expiryDate", rows[index - 1].expiryDate);
                        }}
                        className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${
                          row.linkType === "product"
                            ? "bg-rose-600 text-white"
                            : "bg-white border border-outline-variant text-rose-600 hover:border-rose-600"
                        }`}
                      >
                        품목 연계 (M:1 혼합)
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-3 space-y-1">
                      <label className="block text-xs font-black text-slate-500 ml-1">
                        품목명
                      </label>
                      <div className={`flex flex-col gap-1 w-full relative item-dropdown-container-${row.id}`}>
                        {index > 0 && row.linkType === "product" ? (
                          <div className="h-14 md:h-16 px-4 md:px-6 bg-rose-50/50 border border-rose-200 rounded-2xl flex items-center gap-2 font-bold text-rose-800 shadow-sm w-full">
                            <span className="text-[9px] font-black bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded uppercase">품목 연계됨</span>
                            <span className="truncate text-xs font-black">{rows[index - 1].title || "(위 행의 품목이 지정되지 않음)"}</span>
                          </div>
                        ) : (
                          <>
                            <input
                              placeholder="품목명 입력 또는 선택"
                              value={row.title}
                              onChange={(e) =>
                                updateRow(row.id, "title", e.target.value)
                              }
                              onFocus={() => setActiveItemDropdown(row.id)}
                              className="h-14 md:h-16 px-4 md:px-6 bg-white border border-outline-variant rounded-2xl font-bold outline-none focus:border-primary transition-all shadow-sm w-full"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setActiveItemDropdown(
                                  activeItemDropdown === row.id ? null : row.id,
                                )
                              }
                              className="absolute right-2 top-[calc(50%-12px)] md:top-[calc(50%-8px)] -translate-y-1/2 w-10 h-10 flex items-center justify-center text-outline hover:text-primary transition-colors"
                            >
                              <ChevronDown
                                className={`w-4 h-4 transition-transform ${activeItemDropdown === row.id ? "rotate-180" : ""}`}
                              />
                            </button>
                            {activeItemDropdown === row.id && (
                              <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white border border-outline-variant rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-outline-variant/10 animate-in fade-in slide-in-from-top-2 duration-200 max-h-56 overflow-y-auto">
                                {productItems.length > 0 ? (
                                  productItems
                                    .filter((item) =>
                                      item.name
                                        .toLowerCase()
                                        .includes(row.title.toLowerCase()),
                                    )
                                    .map((item: any) => (
                                      <button
                                        key={item.id}
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          updateRow(row.id, "title", item.name);
                                          if (item.brand)
                                            updateRow(row.id, "brand", item.brand);
                                          setActiveItemDropdown(null);
                                        }}
                                        className={`w-full h-11 flex flex-col justify-center px-5 text-left hover:bg-[#f1f4f9] transition-colors ${row.title === item.name ? "bg-primary/5" : ""}`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span
                                            className={`text-sm font-bold ${row.title === item.name ? "text-primary" : "text-slate-600"}`}
                                          >
                                            {item.name}
                                          </span>
                                          {row.title === item.name && (
                                            <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-black text-outline-variant">
                                            {item.category}
                                          </span>
                                          <span className="text-[10px] font-black text-primary/50">
                                            | {item.currentStock?.toLocaleString()}{" "}
                                            {(item.unit || "KG").toUpperCase()}
                                          </span>
                                        </div>
                                      </button>
                                    ))
                                ) : (
                                  <div className="px-5 py-4 text-[10px] font-bold text-outline text-center">
                                    등록된 완제품 품목이 없습니다
                                  </div>
                                )}
                                <div className="px-5 py-2 bg-slate-50 text-[9px] font-black text-outline/50 uppercase text-center border-t border-outline-variant/10">
                                  직접 입력 가능
                                </div>
                              </div>
                            )}
                            {row.title && (
                              <div className="px-2 flex items-center justify-between">
                                <span className="text-[10px] font-black text-outline uppercase shrink-0">
                                  생산품 재고
                                </span>
                                <span className="text-[10px] font-black text-emerald-600">
                                  {inventory
                                    .find((i: any) => i.name === row.title)
                                    ?.currentStock?.toLocaleString() || "0"}{" "}
                                  {dynamicProdUnit}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-3 space-y-1 relative">
                      <label className="block text-xs font-black text-slate-500 ml-1">
                        원육 품명
                      </label>
                      <div className={`flex flex-col gap-1 w-full relative raw-dropdown-container-${row.id}`}>
                        {index > 0 && row.linkType === "raw" ? (
                          <div className="h-14 md:h-16 px-4 md:px-6 bg-blue-50/50 border border-blue-200 rounded-2xl flex items-center gap-2 font-bold text-blue-800 shadow-sm w-full">
                            <span className="text-[9px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded uppercase">원육 연계됨</span>
                            <span className="truncate text-xs font-black">{rows[index - 1].rawMaterial || "(위 행의 원육이 지정되지 않음)"}</span>
                          </div>
                        ) : (
                          <>
                            <input
                              placeholder="원육 품명 선택 또는 입력"
                              value={row.rawMaterial}
                              onChange={(e) =>
                                updateRow(row.id, "rawMaterial", e.target.value)
                              }
                              onFocus={() => setActiveRawDropdown(row.id)}
                              className="h-14 md:h-16 px-4 md:px-6 bg-white border border-outline-variant rounded-2xl font-bold outline-none focus:border-primary transition-all shadow-sm w-full"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setActiveRawDropdown(
                                  activeRawDropdown === row.id ? null : row.id,
                                )
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-outline hover:text-primary transition-colors"
                            >
                              <ChevronDown
                                className={`w-4 h-4 transition-transform ${activeRawDropdown === row.id ? "rotate-180" : ""}`}
                              />
                            </button>
                            {activeRawDropdown === row.id && (
                              <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white border border-outline-variant rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-outline-variant/10 animate-in fade-in slide-in-from-top-2 duration-200 max-h-56 overflow-y-auto">
                                {(() => {
                                  const filteredRaw = rawMaterials.filter((item) => {
                                    const matchBrand = !row.brand || item.brand === row.brand;
                                    const matchSearch = item.name
                                      .toLowerCase()
                                      .includes((row.rawMaterial || "").toLowerCase());
                                    return matchBrand && matchSearch;
                                  });
                                  return filteredRaw.length > 0 ? (
                                    filteredRaw.map((item: any) => (
                                      <button
                                        key={item.id}
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          updateRow(
                                            row.id,
                                            "rawMaterial",
                                            item.name,
                                          );
                                          if (item.brand)
                                            updateRow(row.id, "brand", item.brand);
                                          setActiveRawDropdown(null);
                                        }}
                                        className={`w-full h-11 flex flex-col justify-center px-5 text-left hover:bg-[#f1f4f9] transition-colors ${row.rawMaterial === item.name ? "bg-primary/5" : ""}`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span
                                            className={`text-sm font-bold ${row.rawMaterial === item.name ? "text-primary" : "text-slate-600"}`}
                                          >
                                            {item.name}
                                          </span>
                                          {row.rawMaterial === item.name && (
                                            <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-black text-outline-variant">
                                            {item.brand || "브랜드 없음"}
                                          </span>
                                          <span className="text-[10px] font-black text-primary/50">
                                            |{" "}
                                            {Math.round(
                                              item.currentStock || 0,
                                            ).toLocaleString()}{" "}
                                            {(item.unit || "KG").toUpperCase()}
                                          </span>
                                        </div>
                                      </button>
                                    ))
                                  ) : (
                                    <div className="px-5 py-4 text-[10px] font-bold text-outline text-center">
                                      검색 Result가 없습니다
                                    </div>
                                  );
                                })()}
                                <div className="px-5 py-2 bg-slate-50 text-[9px] font-black text-outline/50 uppercase text-center border-t border-outline-variant/10">
                                  직접 입력 가능
                                </div>
                              </div>
                            )}
                            {row.rawMaterial && (
                              <div className="px-2 flex items-center justify-between mt-1">
                                <span className="text-[10px] font-black text-outline uppercase shrink-0">
                                  원육 재고
                                </span>
                                {(() => {
                                  const inv = inventory.find(
                                    (i: any) => i.name === row.rawMaterial,
                                  );
                                  const stock = inv?.currentStock || 0;
                                  const isLow = stock < (Number(row.rawQty) || 0);
                                  return (
                                    <span
                                      className={`text-[10px] font-black ${isLow ? "text-rose-600" : "text-blue-600"}`}
                                    >
                                      {Math.round(stock).toLocaleString()} {dynamicRawUnit}
                                    </span>
                                  );
                                })()}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2 space-y-1.5 relative">
                      <label className="block text-xs font-black text-slate-500 ml-1">
                        브랜드
                      </label>
                      <div className={`relative brand-dropdown-container-${row.id}`}>
                        {index > 0 && (row.linkType === "raw" || row.linkType === "product") ? (
                          <div className="h-14 md:h-16 px-4 md:px-6 bg-slate-50 border border-slate-200 text-slate-500 rounded-2xl flex items-center gap-2 font-bold shadow-sm w-full">
                            <span className="text-[8px] font-black bg-slate-200 text-slate-700 px-1 py-0.5 rounded uppercase">자동 연계</span>
                            <span className="truncate text-xs font-bold">{rows[index - 1].brand || "(없음)"}</span>
                          </div>
                        ) : (
                          <>
                            <input
                              placeholder="브랜드"
                              value={row.brand}
                              onChange={(e) =>
                                updateRow(row.id, "brand", e.target.value)
                              }
                              onFocus={() => setActiveBrandDropdown(row.id)}
                              className="h-14 md:h-16 px-4 md:px-6 bg-white border border-outline-variant rounded-2xl font-bold outline-none focus:border-primary transition-all shadow-sm w-full"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setActiveBrandDropdown(
                                  activeBrandDropdown === row.id ? null : row.id,
                                )
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-outline hover:text-primary transition-colors"
                            >
                              <ChevronDown
                                className={`w-4 h-4 transition-transform ${activeBrandDropdown === row.id ? "rotate-180" : ""}`}
                              />
                            </button>
                            {activeBrandDropdown === row.id && (
                              <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white border border-outline-variant rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-outline-variant/10 animate-in fade-in slide-in-from-top-2 duration-200 max-h-56 overflow-y-auto">
                                {(() => {
                                  const filteredBrands = brands.filter((b) =>
                                    b
                                      .toLowerCase()
                                      .includes((row.brand || "").toLowerCase()),
                                  );
                                  return filteredBrands.length > 0 ? (
                                    filteredBrands.map((b) => (
                                      <button
                                        key={b}
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          updateRow(row.id, "brand", b);
                                          setActiveBrandDropdown(null);
                                        }}
                                        className={`w-full h-11 flex items-center justify-between px-5 text-sm font-bold hover:bg-[#f1f4f9] transition-colors ${row.brand === b ? "bg-primary/5 text-primary" : "text-slate-600"}`}
                                      >
                                        <span>{b}</span>
                                        {row.brand === b && (
                                          <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                                        )}
                                      </button>
                                    ))
                                  ) : (
                                    <div className="px-5 py-4 text-[10px] font-bold text-outline text-center">
                                      검색 Result가 없습니다
                                    </div>
                                  );
                                })()}
                                <div className="px-5 py-2 bg-slate-50 text-[9px] font-black text-outline/50 uppercase text-center border-t border-outline-variant/10">
                                  직접 입력 가능
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 col-span-1 md:col-span-4">
                      <div className="space-y-1">
                        <label className="block text-xs font-black text-slate-500 ml-1">
                          투입량 ({dynamicRawUnit})
                        </label>
                        {index > 0 && row.linkType === "raw" ? (
                          <div className="h-14 md:h-16 bg-[#e0f2fe]/40 border border-sky-100 rounded-2xl flex flex-col justify-center items-center text-sky-700 shadow-sm w-full cursor-not-allowed">
                            <span className="font-extrabold text-[#0f172a] text-sm">0</span>
                            <span className="text-[8px] font-black text-sky-600 -mt-0.5 px-1 py-0.5 bg-sky-50 rounded">첫행에서 차감</span>
                          </div>
                        ) : (
                          <input
                            type="text"
                            placeholder="0"
                            value={formatWithCommas(row.rawQty)}
                            onChange={(e) =>
                              updateRow(
                                row.id,
                                "rawQty",
                                (() => {
                                  const val = e.target.value;
                                  let cleaned = val
                                    .replace(/(?!^)-/g, "")
                                    .replace(/[^0-9.-]/g, "");
                                  const parts = cleaned.split(".");
                                  if (parts.length > 2) {
                                    cleaned =
                                      parts[0] + "." + parts.slice(1).join("");
                                  }
                                  const dotIndex = cleaned.indexOf(".");
                                  if (dotIndex !== -1) {
                                    cleaned =
                                      cleaned.substring(0, dotIndex + 1) +
                                      cleaned.substring(dotIndex + 1, dotIndex + 3);
                                  }
                                  return cleaned;
                                })(),
                              )
                            }
                            className="h-14 md:h-16 px-4 md:px-6 bg-white border border-outline-variant rounded-2xl font-bold text-center outline-none focus:border-primary transition-all shadow-sm w-full"
                          />
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-black text-slate-500 ml-1">
                          생산량 ({dynamicProdUnit})
                        </label>
                        {index > 0 && row.linkType === "product" ? (
                          <div className="h-14 md:h-16 bg-[#fdf2f8]/40 border border-rose-100 rounded-2xl flex flex-col justify-center items-center text-rose-700 shadow-sm w-full cursor-not-allowed">
                            <span className="font-extrabold text-[#0f172a] text-sm">0</span>
                            <span className="text-[8px] font-black text-rose-600 -mt-0.5 px-1 py-0.5 bg-rose-50 rounded">첫행에 등록</span>
                          </div>
                        ) : (
                          <input
                            type="text"
                            placeholder="0"
                            value={formatWithCommas(row.production)}
                            onChange={(e) =>
                              updateRow(
                                row.id,
                                "production",
                                (() => {
                                  const val = e.target.value;
                                  let cleaned = val
                                    .replace(/(?!^)-/g, "")
                                    .replace(/[^0-9.-]/g, "");
                                  const parts = cleaned.split(".");
                                  if (parts.length > 2) {
                                    cleaned =
                                      parts[0] + "." + parts.slice(1).join("");
                                  }
                                  const dotIndex = cleaned.indexOf(".");
                                  if (dotIndex !== -1) {
                                    cleaned =
                                      cleaned.substring(0, dotIndex + 1) +
                                      cleaned.substring(dotIndex + 1, dotIndex + 3);
                                  }
                                  return cleaned;
                                })(),
                              )
                            }
                            className="h-14 md:h-16 px-4 md:px-6 bg-white border border-outline-variant rounded-2xl font-bold text-center outline-none focus:border-primary transition-all shadow-sm w-full"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="grid grid-cols-2 col-span-1 sm:col-span-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-emerald-700 uppercase ml-1">
                          생산 수율 (%)
                        </label>
                        <div className="h-14 md:h-16 flex items-center justify-center bg-emerald-50 rounded-2xl font-black text-xl md:text-3xl text-emerald-600 border border-emerald-100 shadow-sm">
                          {index > 0 && row.linkType === "raw" ? (
                            <span className="text-xs font-black text-blue-600">원육공유 1:M</span>
                          ) : index > 0 && row.linkType === "product" ? (
                            <span className="text-xs font-black text-rose-600">품목공유 M:1</span>
                          ) : (
                            `${yieldRate.toFixed(1)}%`
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-rose-700 uppercase ml-1">
                          로스 비율 (%)
                        </label>
                        <div className="h-14 md:h-16 flex items-center justify-center bg-rose-50 rounded-2xl font-black text-xl md:text-3xl text-rose-600 border border-rose-100 shadow-sm">
                          {index > 0 && row.linkType === "raw" ? (
                            <span className="text-xs font-black text-blue-650 bg-blue-50/50 px-2 py-1 rounded">원육 연계됨</span>
                          ) : index > 0 && row.linkType === "product" ? (
                            <span className="text-xs font-black text-rose-650 bg-rose-50/50 px-2 py-1 rounded">품목 연계됨</span>
                          ) : (
                            `${lossRate.toFixed(1)}%`
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white px-4 md:px-6 h-14 md:h-16 rounded-2xl border border-outline-variant shadow-sm self-start">
                      <span className="text-[10px] font-black text-outline whitespace-nowrap">
                        제조일자
                      </span>
                      <input
                        type="date"
                        value={row.manufDate}
                        onChange={(e) =>
                          updateRow(row.id, "manufDate", e.target.value)
                        }
                        className="flex-1 bg-transparent font-bold text-xs md:text-sm outline-none"
                      />
                      <CalendarDays className="w-4 h-4 text-outline-variant" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3 bg-white px-4 md:px-6 h-14 md:h-16 rounded-2xl border border-outline-variant shadow-sm">
                        <span className="text-[10px] font-black text-outline whitespace-nowrap">
                          소비기한
                        </span>
                        <input
                          type="date"
                          value={row.expiryDate}
                          onChange={(e) =>
                            updateRow(row.id, "expiryDate", e.target.value)
                          }
                          className="flex-1 bg-transparent font-bold text-xs md:text-sm outline-none"
                          placeholder="연도-월-일"
                        />
                        <CalendarDays className="w-4 h-4 text-outline-variant" />
                      </div>
                      <div className="grid grid-cols-5 gap-1 px-0.5 w-full">
                        {[1, 3, 6, 12, 24].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() =>
                              setExpiryShortcut(row.id, row.manufDate, m)
                            }
                            className="py-1 bg-white border border-outline-variant/30 rounded-lg text-[9px] md:text-[10px] font-black text-on-surface hover:border-primary hover:text-primary transition-all shadow-sm text-center truncate min-w-0"
                          >
                            {m >= 12 ? `${m / 12}년` : `${m}개월`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Integrated Yield and Loss Summary Card */}
          {formStatistics.totalRaw > 0 && (
            <div className="bg-[#f8fafc] border border-slate-200/80 rounded-[24px] p-6 space-y-5 shadow-sm animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
                  <h4 className="text-sm font-black text-slate-900">
                    통합 생산 분석 리포트
                  </h4>
                </div>
                <span className="text-[10px] font-black text-outline bg-slate-100 px-2 py-1 rounded">
                  실시간 계산
                </span>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-100/80 shadow-2xs">
                  <p className="text-[10px] font-bold text-outline uppercase tracking-tight">
                    통합 원육 투입량
                  </p>
                  <p className="text-lg font-black text-slate-800 mt-1">
                    {formStatistics.totalRaw.toLocaleString()}{" "}
                    <span className="text-xs font-bold text-outline">KG</span>
                  </p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100/80 shadow-2xs">
                  <p className="text-[10px] font-bold text-outline uppercase tracking-tight">
                    통합 완제품 생산량
                  </p>
                  <p className="text-lg font-black text-slate-800 mt-1">
                    {formStatistics.totalProd.toLocaleString()}{" "}
                    <span className="text-xs font-bold text-outline">KG</span>
                  </p>
                </div>
                <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100/50 shadow-2xs">
                  <p className="text-[10px] font-black text-emerald-800 uppercase tracking-tight">
                    통합 생산 수율
                  </p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">
                    {formStatistics.overallYield.toFixed(1)}{" "}
                    <span className="text-xs font-bold text-emerald-500">
                      %
                    </span>
                  </p>
                </div>
                <div className="bg-rose-50/40 p-4 rounded-xl border border-rose-100/50 shadow-2xs">
                  <p className="text-[10px] font-black text-rose-800 uppercase tracking-tight">
                    통합 로스 비율
                  </p>
                  <p className="text-2xl font-black text-rose-600 mt-1">
                    {formStatistics.overallLoss.toFixed(1)}{" "}
                    <span className="text-xs font-bold text-rose-500">%</span>
                  </p>
                </div>
              </div>

              {/* Grouped Raw Material Analysis */}
              {formStatistics.groupCalculations.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    원육별 통합 수율 분석
                  </h5>
                  <div className="divide-y divide-slate-100 bg-white border border-slate-100 rounded-xl overflow-hidden">
                    {formStatistics.groupCalculations.map((g, idx) => (
                      <div
                        key={idx}
                        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/30 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-800">
                              {g.rawMaterial}
                            </span>
                            <span className="text-[9px] font-bold text-primary bg-[#e8effd] px-1.5 py-0.5 rounded border border-primary/10">
                              생산 품목: {g.items.length}개
                            </span>
                          </div>
                          {g.items.length > 0 && (
                            <p className="text-[10px] text-slate-400 font-medium mt-1">
                              생산물 명단:{" "}
                              {g.items
                                .map(
                                  (it) =>
                                    `${it.name}${it.brand ? ` (${it.brand})` : ""}`,
                                )
                                .join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-right flex-wrap">
                          <div className="text-center md:text-right">
                            <span className="block text-[8px] font-bold text-outline uppercase tracking-wider">
                              투입 ➔ 생산
                            </span>
                            <span className="text-[11px] font-bold text-slate-700">
                              {g.rawQty.toLocaleString()} KG ➔{" "}
                              {g.production.toLocaleString()} KG
                            </span>
                          </div>
                          <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-xs font-black min-w-[75px] text-center">
                            수율 {g.yieldRate.toFixed(1)}%
                          </div>
                          <div className="bg-rose-50 text-rose-600 px-3 py-1 rounded-lg text-xs font-black min-w-[75px] text-center">
                            로스 {g.lossRate.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grouped Product Analysis */}
              {formStatistics.productCalculations &&
                formStatistics.productCalculations.length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-slate-200/60">
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      품목(제품)별 통합 수율 분석
                    </h5>
                    <div className="divide-y divide-slate-100 bg-white border border-slate-100 rounded-xl overflow-hidden">
                      {formStatistics.productCalculations.map((g, idx) => (
                        <div
                          key={idx}
                          className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/30 transition-colors"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-800">
                                {g.productName}
                              </span>
                              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/35">
                                투입 원육: {g.materials.length}종
                              </span>
                            </div>
                            {g.materials.length > 0 && (
                              <p className="text-[10px] text-slate-400 font-medium mt-1">
                                투입된 원육:{" "}
                                {g.materials
                                  .map(
                                    (m) =>
                                      `${m.name}${m.brand ? ` (${m.brand})` : ""}`,
                                  )
                                  .join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-right flex-wrap">
                            <div className="text-center md:text-right">
                              <span className="block text-[8px] font-bold text-outline uppercase tracking-wider">
                                합계 투입 ➔ 합계 생산
                              </span>
                              <span className="text-[11px] font-bold text-slate-700">
                                {g.rawQty.toLocaleString()} KG ➔{" "}
                                {g.production.toLocaleString()} KG
                              </span>
                            </div>
                            <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-xs font-black min-w-[75px] text-center">
                              수율 {g.yieldRate.toFixed(1)}%
                            </div>
                            <div className="bg-rose-50 text-rose-600 px-3 py-1 rounded-lg text-xs font-black min-w-[75px] text-center">
                              로스 {g.lossRate.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* 작업 특이사항 */}
          <div className="space-y-2 pt-2 text-left">
            <label className="text-[11px] font-black text-outline uppercase tracking-wider block">
              작업 특이사항
            </label>
            <textarea
              id="production-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="작업 중 특이사항이나 관리 사항이 있으면 여기에 입력해 주세요 (예: 원육 상태 양호, 온도 관리 주의 등)"
              className="w-full min-h-[80px] p-4 bg-slate-50 border border-outline-variant/40 rounded-2xl text-xs md:text-sm font-semibold text-[#0f172a] focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all resize-none"
            />
          </div>

          <div className="flex flex-col md:flex-row gap-6 pt-4">
            {!editingId && (
              <button
                onClick={addRow}
                className="flex-1 h-16 border-2 border-dashed border-outline-variant/50 rounded-2xl font-black text-[#0f172a] hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
              >
                <Plus className="w-6 h-6" /> 품목 추가 (행 추가)
              </button>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-6 pt-2">
            <button
              onClick={handleAdd}
              className="flex-[2] h-16 bg-[#0f172a] text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-900/10 hover:bg-slate-800 transition-all active:scale-95"
            >
              {editingId ? "수정 사항 저장" : `${rows.length}건 생산 등록`}
            </button>
            {editingId && (
              <>
                <button
                  onClick={() => {
                    const rec = production.find((p: any) => p.id === editingId);
                    if (rec) {
                      setDeleteModal({
                        isOpen: true,
                        id: editingId,
                        title: rec.title,
                      });
                    }
                  }}
                  className="flex-1 h-16 bg-rose-50 text-rose-600 rounded-2xl font-black text-lg hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" /> 삭제
                </button>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setShowForm(false);
                  }}
                  className="flex-1 h-16 bg-slate-100 text-slate-600 rounded-2xl font-black text-lg hover:bg-slate-200 transition-all"
                >
                  취소
                </button>
              </>
            )}
          </div>
          <DeleteConfirmModal
            isOpen={deleteModal.isOpen}
            onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
            onConfirm={() => handleDelete(deleteModal.id, deleteModal.title)}
            title="생산 기록 삭제"
            message={`${deleteModal.title} 생산 기록을 삭제하시겠습니까?\n\n※ 삭제 시 투입된 원육 재고가 복구되고, 생산된 완제품 재고가 차감됩니다. 연동된 물류 기록도 함께 삭제됩니다.`}
          />
        </motion.div>
      )}

      {/* Summary Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="bg-white p-3 md:p-8 rounded-[20px] md:rounded-[40px] shadow-sm border border-outline-variant/30 flex flex-col items-center justify-center gap-1 md:gap-4 transition-all hover:shadow-md min-h-[100px] md:min-h-[200px]"
          >
            <p className="text-[9px] md:text-[11px] font-black text-outline uppercase tracking-tight text-center truncate w-full px-1">
              {stat.label}
            </p>
            <div
              className={`flex items-baseline justify-center gap-1 md:gap-2 w-full overflow-hidden ${idx === 3 ? "text-emerald-600" : "text-[#0f172a]"}`}
            >
              <span className="text-xl md:text-5xl font-black tabular-nums tracking-tighter leading-none truncate">
                {stat.value}
              </span>
              <span className="text-[8px] md:text-sm font-black text-outline uppercase shrink-0">
                {stat.unit}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* Recent Production Log */}
      <section id="production-list" className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-2">
          <div className="flex items-center justify-between lg:justify-start gap-4">
            <div className="flex items-center gap-2">
              <h3 className="text-xl md:text-3xl font-black text-[#0f172a] tracking-tight whitespace-nowrap">
                생산리스트
              </h3>
              <span className="md:hidden px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-outline uppercase tracking-widest">
                LOGS
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 w-full lg:w-auto flex-1">
            <div className="relative lg:w-48">
              <select
                value={filterLine}
                onChange={(e) => setFilterLine(e.target.value)}
                className="w-full h-11 px-4 bg-white border border-outline-variant rounded-xl text-[11px] font-black appearance-none focus:border-primary outline-none shadow-sm cursor-pointer pr-10"
              >
                {[
                  "전체",
                  "삼산공장",
                  "언양공장 부속물",
                  "언양공장 식육가공",
                ].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown className="w-3.5 h-3.5 text-outline" />
              </div>
            </div>

            {/* 원육 필터 */}
            <div className="relative lg:w-44 animate-fade-in">
              <select
                value={filterRawMaterial}
                onChange={(e) => setFilterRawMaterial(e.target.value)}
                className="w-full h-11 px-4 bg-white border border-outline-variant rounded-xl text-[11px] font-black appearance-none focus:border-primary outline-none shadow-sm cursor-pointer pr-10 text-on-surface"
              >
                <option value="전체">원육 전체</option>
                {rawMaterialsList.map((rm) => (
                  <option key={rm} value={rm}>
                    {rm}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown className="w-3.5 h-3.5 text-outline" />
              </div>
            </div>

            {/* 브랜드 필터 */}
            <div className="relative lg:w-44 animate-fade-in">
              <select
                value={filterBrandInProd}
                onChange={(e) => setFilterBrandInProd(e.target.value)}
                className="w-full h-11 px-4 bg-white border border-outline-variant rounded-xl text-[11px] font-black appearance-none focus:border-primary outline-none shadow-sm cursor-pointer pr-10 text-on-surface"
              >
                <option value="전체">브랜드 전체</option>
                {brandsList.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown className="w-3.5 h-3.5 text-outline" />
              </div>
            </div>

            <div className="relative group flex-1 md:flex-none md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input
                type="text"
                placeholder="품목명 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-11 pl-11 pr-4 bg-white border border-outline-variant rounded-xl text-xs md:text-sm font-bold outline-none focus:border-primary transition-all shadow-sm"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
              <div className="relative group flex-1 sm:flex-none">
                <input
                  ref={startDatePickerRef}
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => {
                    setFilterStartDate(e.target.value);
                    setActiveShift("");
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 pointer-events-none appearance-none"
                />
                <button
                  onClick={handleStartDateClick}
                  className="w-full flex items-center justify-center gap-2 px-3 h-11 bg-white border border-outline-variant rounded-xl text-xs font-bold text-on-surface group-hover:border-primary group-hover:ring-2 group-hover:ring-primary/10 transition-all whitespace-nowrap cursor-pointer"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-primary" />
                  <span className="font-black">
                    {filterStartDate.split("-").slice(1).join("/")}
                  </span>
                </button>
              </div>

              <span className="text-outline font-black text-xs">~</span>

              <div className="relative group flex-1 sm:flex-none">
                <input
                  ref={endDatePickerRef}
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => {
                    setFilterEndDate(e.target.value);
                    setActiveShift("");
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 pointer-events-none appearance-none"
                />
                <button
                  onClick={handleEndDateClick}
                  className="w-full flex items-center justify-center gap-2 px-3 h-11 bg-white border border-outline-variant rounded-xl text-xs font-bold text-on-surface group-hover:border-primary group-hover:ring-2 group-hover:ring-primary/10 transition-all whitespace-nowrap cursor-pointer"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-primary" />
                  <span className="font-black">
                    {filterEndDate.split("-").slice(1).join("/")}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex-1 sm:flex-none flex bg-surface-container p-1 rounded-xl border border-outline-variant h-11 items-center shrink-0">
              {[
                {
                  label: "일간",
                  action: () => {
                    setFilterStartDate(today);
                    setFilterEndDate(today);
                  },
                },
                {
                  label: "주간",
                  action: () => {
                    const d = new Date();
                    d.setDate(d.getDate() - 7);
                    setFilterStartDate(d.toISOString().split("T")[0]);
                    setFilterEndDate(today);
                  },
                },
                {
                  label: "월간",
                  action: () => {
                    const d = new Date();
                    const first = new Date(d.getFullYear(), d.getMonth(), 1);
                    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                    setFilterStartDate(first.toISOString().split("T")[0]);
                    setFilterEndDate(last.toISOString().split("T")[0]);
                  },
                },
              ].map((shift) => (
                <button
                  key={shift.label}
                  onClick={() => {
                    setActiveShift(shift.label);
                    shift.action();
                  }}
                  className={`flex-1 sm:flex-none px-3 md:px-4 h-full rounded-lg text-[10px] md:text-xs font-black transition-all whitespace-nowrap flex items-center justify-center ${activeShift === shift.label ? "bg-primary text-white shadow-sm" : "text-outline hover:text-primary"}`}
                >
                  {shift.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[28px] md:rounded-[40px] border border-outline-variant overflow-hidden shadow-xl shadow-surface-container-high/50 p-1.5 md:p-0">
          <div className="w-full">
            {/* Desktop View Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead className="bg-[#f1f4f9] text-[10px] md:text-[11px] font-black text-outline uppercase tracking-widest border-b border-outline-variant">
                  <tr>
                    <th className="px-6 py-8">생산일자</th>
                    <th className="px-6 py-8">품목명 / 주거래처</th>
                    <th className="px-6 py-8">원육 품명/브랜드</th>
                    <th className="px-6 py-8">투입량</th>
                    <th className="px-6 py-8">생산량</th>
                    <th className="px-6 py-8">수율</th>
                    <th className="px-6 py-8">로스</th>
                    <th className="px-6 py-8">제조일자</th>
                    <th className="px-6 py-8">소비기한</th>
                    <th className="px-6 py-8">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {paginatedItems.map((item: any, idx: number) => {
                    const itemData = inventory.find(
                      (inv: any) => inv.name === item.title,
                    );
                    return (
                      <tr
                        key={item.id || idx}
                        className="hover:bg-surface-container/5 transition-colors"
                      >
                        <td className="px-6 py-6">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-black text-[#0f172a]">
                              {item.manufDate}
                            </span>
                            <span className="text-[10px] font-bold text-outline uppercase tracking-tight">
                              {item.line || "기본"} 라인
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-6 font-black text-[#0f172a]">
                          <div className="flex flex-col items-center">
                            <div className="font-black flex items-center justify-center gap-1.5 flex-wrap">
                              <span>{item.title}</span>
                              {item.linkType === "product" && (
                                <span className="px-1.5 py-0.5 text-[8px] font-black text-rose-600 bg-rose-50 border border-rose-200/50 rounded uppercase">품목 연계</span>
                              )}
                            </div>
                            <div className="flex flex-col items-center gap-0.5 mt-1">
                              <span className="text-[10px] font-bold text-outline">
                                {itemData?.specs || ""}
                              </span>
                              {item.partner && (
                                <span className="text-[9px] font-black text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 uppercase">
                                  @{item.partner}
                                </span>
                              )}
                            </div>
                            {item.remarks && (
                              <div className="mt-2 px-2.5 py-1.5 bg-amber-50/50 border border-amber-200/30 rounded-xl text-[10px] text-[#854d0e] font-medium max-w-[240px] break-all leading-normal text-left">
                                <span className="font-black text-[#854d0e] mr-1">특이사항:</span>{item.remarks}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-6 text-sm">
                          <div className="flex flex-col items-center">
                            <div className="font-bold text-[#0f172a] flex items-center justify-center gap-1 flex-wrap">
                              <span>{item.rawMaterial || "-"}</span>
                              {item.linkType === "raw" && (
                                <span className="px-1.5 py-0.5 text-[8px] font-black text-blue-600 bg-blue-50 border border-blue-200/50 rounded uppercase">원육 연계</span>
                              )}
                            </div>
                            <span className="text-[10px] text-outline-variant">
                              {item.brand || "-"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-6 font-bold text-outline-variant">
                          <div>
                            {item.linkType === "raw" ? (
                              <span className="text-[10px] text-sky-600 bg-sky-50/50 px-1.5 py-0.5 rounded font-bold">원육 공유</span>
                            ) : (
                              `${Math.round(item.rawQty || 0).toLocaleString()} KG`
                            )}
                          </div>
                          {item.rawPrevStock !== undefined && item.rawNextStock !== undefined && (
                            <div className="text-[10px] text-sky-600 font-extrabold mt-1 whitespace-nowrap">
                              재고: {Math.round(item.rawPrevStock).toLocaleString()} → {Math.round(item.rawNextStock).toLocaleString()} KG
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-6 font-black text-[#0f172a]">
                          <div>
                            {item.linkType === "product" ? (
                              <span className="text-[10px] text-rose-600 bg-rose-50/50 px-1.5 py-0.5 rounded font-bold">품목 공유</span>
                            ) : (
                              `${Math.round(item.production || 0).toLocaleString()} KG`
                            )}
                          </div>
                          {item.prodPrevStock !== undefined && item.prodNextStock !== undefined && (
                            <div className="text-[10px] text-emerald-600 font-extrabold mt-1 whitespace-nowrap">
                              재고: {Math.round(item.prodPrevStock).toLocaleString()} → {Math.round(item.prodNextStock).toLocaleString()} KG
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-6">
                          {item.linkType === "product" ? (
                            <span className="px-2 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg font-black text-[10px] uppercase font-bold">
                              품목공유
                            </span>
                          ) : item.linkType === "raw" ? (
                            <span className="px-2 py-1 bg-sky-50 text-sky-600 border border-sky-100 rounded-lg font-black text-[10px] uppercase font-bold">
                              원육공유
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-black text-xs">
                              {item.yield?.toFixed(1) || 0}%
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-6">
                          {item.linkType === "product" ? (
                            <span className="px-2 py-1 bg-slate-50 text-slate-400 rounded-lg font-black text-[10px] uppercase">
                              -
                            </span>
                          ) : item.linkType === "raw" ? (
                            <span className="px-2 py-1 bg-slate-50 text-slate-400 rounded-lg font-black text-[10px] uppercase">
                              -
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg font-black text-xs">
                              {item.loss?.toFixed(1) || 0}%
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-6 text-sm font-bold text-outline">
                          {item.manufDate}
                        </td>
                        <td className="px-6 py-6 text-sm font-bold text-outline">
                          {item.expiryDate || "-"}
                        </td>
                        <td className="px-6 py-6">
                          {canEditItems && (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEdit(item)}
                                disabled={loading}
                                className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all disabled:opacity-30"
                                title="수정"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteModal({
                                    isOpen: true,
                                    id: item.id,
                                    title: item.title,
                                  })
                                }
                                disabled={loading}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-30"
                                title="삭제"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 p-1">
              {paginatedItems.map((item: any, idx: number) => {
                const itemData = inventory.find(
                  (inv: any) => inv.name === item.title,
                );
                return (
                  <div
                    key={item.id || idx}
                    className="bg-white p-4 rounded-[24px] border border-outline-variant/60 shadow-sm space-y-3 relative overflow-hidden active:scale-[0.98] active:bg-slate-50 transition-all"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[8px] font-black text-primary font-mono bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                            {itemData?.sku || "SKU미정"}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[8px] font-black text-outline uppercase">
                            {item.line} 라인
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-[#0f172a] leading-snug break-all line-clamp-2">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-1.5 flex-wrap -mt-0.5">
                          {item.partner && (
                            <span className="text-[8px] font-black text-primary/70 bg-primary/5 px-2 py-0.5 rounded border border-primary/10 uppercase">
                              @{item.partner}
                            </span>
                          )}
                          <span className="text-[8px] font-black text-outline opacity-60">
                            {itemData?.specs || ""}
                          </span>
                          {item.rawMaterial && (
                            <span className="text-[8px] font-bold text-primary/70 bg-primary/5 px-1 rounded">
                              원육: {item.rawMaterial}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleEdit(item)}
                          className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl active:bg-primary/10 active:text-primary transition-all"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteModal({
                              isOpen: true,
                              id: item.id,
                              title: item.title,
                            })
                          }
                          className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-400 rounded-xl active:bg-rose-100 active:text-rose-600 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {item.remarks && (
                      <div className="bg-amber-50/55 border border-amber-200/30 p-3 rounded-2xl text-[11px] text-[#854d0e] font-medium break-all leading-normal text-left">
                        <span className="font-extrabold text-[#854d0e] mr-1">특이사항:</span>{item.remarks}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
                      <div className="bg-slate-50/70 p-2 rounded-xl flex flex-col justify-center">
                        <div className="text-[7px] font-black text-outline uppercase tracking-wider mb-0.5">
                          생산량
                        </div>
                        <div className="text-xs font-black text-on-surface truncate">
                          {Math.round(item.rawQty || 0).toLocaleString()}{" "}
                          <span className="text-[8px] opacity-40">→</span>{" "}
                          {Math.round(item.production || 0).toLocaleString()}
                          <span className="text-[8px] ml-0.5 font-bold">
                            KG
                          </span>
                        </div>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-xl flex flex-col justify-center">
                        <div className="text-[7px] font-black text-emerald-600 uppercase tracking-wider mb-0.5">
                          수율 (로스)
                        </div>
                        <div className="text-xs font-black text-emerald-700 font-black">
                          {item.yield?.toFixed(1)}%{" "}
                          <span className="text-[8px] text-rose-500 font-bold tracking-tighter">
                            ({item.loss?.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {(item.prodPrevStock !== undefined || item.rawPrevStock !== undefined) && (
                      <div className="bg-slate-50/70 p-2.5 rounded-2xl text-[10px] space-y-1 font-bold border border-outline-variant/30 text-left">
                        {item.rawPrevStock !== undefined && item.rawNextStock !== undefined && (
                          <div className="flex justify-between items-center text-slate-500">
                            <span>원육 재고 ({item.rawMaterial}):</span>
                            <span className="text-sky-600 font-extrabold">
                              {Math.round(item.rawPrevStock).toLocaleString()} → {Math.round(item.rawNextStock).toLocaleString()} KG
                            </span>
                          </div>
                        )}
                        {item.prodPrevStock !== undefined && item.prodNextStock !== undefined && (
                          <div className="flex justify-between items-center text-slate-500">
                            <span>제품 재고 ({item.title}):</span>
                            <span className="text-emerald-600 font-extrabold">
                              {Math.round(item.prodPrevStock).toLocaleString()} → {Math.round(item.prodNextStock).toLocaleString()} KG
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-tighter pt-1 opacity-60">
                      <div className="flex items-center gap-1">
                        <CalendarDays className="w-2.5 h-2.5" />
                        제조:{" "}
                        <span className="text-on-surface">
                          {item.manufDate}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <History className="w-2.5 h-2.5" />
                        기한:{" "}
                        <span className="text-on-surface">
                          {item.expiryDate || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination
              current={currentPage}
              total={totalPages}
              onChange={setCurrentPage}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default ProductionContent;

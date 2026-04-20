"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type AgeCategory = "dewasa (>18 Thn)" | "anak (<18 Thn)" | "";
type BalanceStatus = "Positif" | "Negatif" | "Seimbang";

type OfficerForm = {
  officerName: string;
};

type PatientForm = {
  name: string;
  age: string;
  ageCategory: AgeCategory;
  weight: string;
  height: string;
  temperature: string;
};

type FluidForm = {
  oral: string;
  infus: string;
  obat: string;
  transfusi: string;
  lainIntakeType: string;
  lainIntakeValue: string;
  urin: string;
  muntah: string;
  drainase: string;
  feses: string;
  lainOutputType: string;
  lainOutputValue: string;
  additionalNotes: string;
};

type OfficerErrors = {
  officerName?: string;
};

type PatientErrors = {
  name?: string;
  age?: string;
  ageCategory?: string;
  weight?: string;
  height?: string;
  temperature?: string;
};

type CalculationResult = {
  totalIntake: number;
  totalOutput: number;
  iwl: number;
  bsa: number | null;
  balanceStandard: number;
  balanceCorrected: number;
  statusStandard: BalanceStatus;
  statusCorrected: BalanceStatus;
  methodLabel: string;
  feverFactor: number;
};

const STORAGE_KEY = "kalbaca-web-v6-data";

const initialOfficerForm: OfficerForm = {
  officerName: "",
};

const initialPatientForm: PatientForm = {
  name: "",
  age: "",
  ageCategory: "",
  weight: "",
  height: "",
  temperature: "",
};

const initialFluidForm: FluidForm = {
  oral: "",
  infus: "",
  obat: "",
  transfusi: "",
  lainIntakeType: "",
  lainIntakeValue: "",
  urin: "",
  muntah: "",
  drainase: "",
  feses: "",
  lainOutputType: "",
  lainOutputValue: "",
  additionalNotes: "",
};

function toNumber(value: string) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMl(value: number) {
  return `${value.toFixed(1)} mL`;
}

function formatBsa(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  return `${value.toFixed(2)} m²`;
}

function getBalanceStatus(value: number): BalanceStatus {
  if (value > 0) return "Positif";
  if (value < 0) return "Negatif";
  return "Seimbang";
}

function getStatusClass(status: BalanceStatus) {
  if (status === "Positif") return "text-emerald-600";
  if (status === "Negatif") return "text-rose-600";
  return "text-amber-600";
}

function getInterpretationText(status: BalanceStatus) {
  if (status === "Positif") {
    return "Cenderung positif, perlu evaluasi klinis lanjutan.";
  }
  if (status === "Negatif") {
    return "Cenderung negatif, perlu verifikasi intake-output dan kondisi pasien.";
  }
  return "Seimbang, tetap lanjutkan monitoring klinis.";
}

function validateOfficer(officer: OfficerForm): OfficerErrors {
  const errors: OfficerErrors = {};

  if (!officer.officerName.trim()) {
    errors.officerName = "Nama petugas wajib diisi.";
  } else if (officer.officerName.trim().length < 2) {
    errors.officerName = "Nama petugas minimal 2 karakter.";
  } else if (officer.officerName.trim().length > 100) {
    errors.officerName = "Nama petugas terlalu panjang.";
  }

  return errors;
}

function validatePatient(patient: PatientForm): PatientErrors {
  const errors: PatientErrors = {};
  const age = toNumber(patient.age);
  const weight = toNumber(patient.weight);
  const height = toNumber(patient.height);
  const temperature = toNumber(patient.temperature);

  if (!patient.name.trim()) {
    errors.name = "Nama pasien wajib diisi.";
  } else if (patient.name.trim().length < 2) {
    errors.name = "Nama pasien minimal 2 karakter.";
  } else if (patient.name.trim().length > 100) {
    errors.name = "Nama pasien terlalu panjang.";
  }

  if (!patient.age.trim()) {
    errors.age = "Usia wajib diisi.";
  } else if (age <= 0) {
    errors.age = "Usia harus lebih dari 0 tahun.";
  } else if (age > 130) {
    errors.age = "Usia tidak valid.";
  }

  if (!patient.ageCategory) {
    errors.ageCategory = "Kategori usia wajib dipilih.";
  }

  if (!patient.weight.trim()) {
    errors.weight = "Berat badan wajib diisi.";
  } else if (weight <= 0) {
    errors.weight = "Berat badan harus lebih dari 0 kg.";
  } else if (weight > 300) {
    errors.weight = "Berat badan tidak boleh lebih dari 300 kg.";
  }

  if (!patient.height.trim()) {
    errors.height = "Tinggi badan wajib diisi.";
  } else if (height <= 0) {
    errors.height = "Tinggi badan harus lebih dari 0 cm.";
  } else if (height < 30 || height > 250) {
    errors.height = "Tinggi badan harus di antara 30 cm sampai 250 cm.";
  }

  if (!patient.temperature.trim()) {
    errors.temperature = "Suhu tubuh wajib diisi.";
  } else if (temperature < 30 || temperature > 45) {
    errors.temperature = "Suhu tubuh harus di antara 30°C sampai 45°C.";
  }

  return errors;
}

function hasErrors(errors: Record<string, string | undefined>) {
  return Object.values(errors).some(Boolean);
}

function sanitizeFileName(name: string) {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_");
}

function formatDateDisplay(date: Date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  return `${dd}/${mm}/${yyyy}, ${hh}:${min}:${ss}`;
}

function formatDateTimeForFile(date: Date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${dd}-${mm}-${yyyy} ${hh}-${min}`;
}

function toTitleCase(text: string) {
  return text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function loadImageAsDataUrl(src: string) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Gagal memuat gambar: ${src}`);
  }

  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function Home() {
  const [officer, setOfficer] = useState<OfficerForm>(initialOfficerForm);
  const [patient, setPatient] = useState<PatientForm>(initialPatientForm);
  const [fluid, setFluid] = useState<FluidForm>(initialFluidForm);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  const [saveMessage, setSaveMessage] = useState("Belum ada perubahan disimpan.");
  const [isExporting, setIsExporting] = useState(false);

  const officerErrors = useMemo(() => validateOfficer(officer), [officer]);
  const patientErrors = useMemo(() => validatePatient(patient), [patient]);

  const officerReady = !hasErrors(officerErrors);
  const patientReady = !hasErrors(patientErrors);
  const formReady = officerReady && patientReady;

  const weightNum = toNumber(patient.weight);
  const heightNum = toNumber(patient.height);
  const temperatureNum = toNumber(patient.temperature);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.officer) setOfficer(parsed.officer);
        if (parsed.patient) setPatient(parsed.patient);
        if (parsed.fluid) {
          setFluid({
            ...parsed.fluid,
            oral: parsed.fluid.oral === "0" ? "" : parsed.fluid.oral ?? "",
            infus: parsed.fluid.infus === "0" ? "" : parsed.fluid.infus ?? "",
            obat: parsed.fluid.obat === "0" ? "" : parsed.fluid.obat ?? "",
            transfusi: parsed.fluid.transfusi === "0" ? "" : parsed.fluid.transfusi ?? "",
            lainIntakeValue:
              parsed.fluid.lainIntakeValue === "0" ? "" : parsed.fluid.lainIntakeValue ?? "",
            urin: parsed.fluid.urin === "0" ? "" : parsed.fluid.urin ?? "",
            muntah: parsed.fluid.muntah === "0" ? "" : parsed.fluid.muntah ?? "",
            drainase: parsed.fluid.drainase === "0" ? "" : parsed.fluid.drainase ?? "",
            feses: parsed.fluid.feses === "0" ? "" : parsed.fluid.feses ?? "",
            lainOutputValue:
              parsed.fluid.lainOutputValue === "0" ? "" : parsed.fluid.lainOutputValue ?? "",
          });
        }
        if (parsed.result) setResult(parsed.result);
        setSaveMessage("Data terakhir berhasil dimuat dari penyimpanan lokal.");
      } catch {
        setSaveMessage("Data lokal ditemukan, tetapi gagal dibaca.");
      }
    }
    setLoadedFromStorage(true);
  }, []);

  useEffect(() => {
    if (!loadedFromStorage) return;

    const payload = {
      officer,
      patient,
      fluid,
      result,
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setSaveMessage("Perubahan tersimpan otomatis di browser.");
  }, [officer, patient, fluid, result, loadedFromStorage]);

  function setOfficerField<K extends keyof OfficerForm>(key: K, value: OfficerForm[K]) {
    setOfficer((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  }

  function setPatientField<K extends keyof PatientForm>(key: K, value: PatientForm[K]) {
    setPatient((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  }

  function setFluidField<K extends keyof FluidForm>(key: K, value: FluidForm[K]) {
    if (!formReady) return;
    setFluid((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  }

  function calculate() {
    const officerValidation = validateOfficer(officer);
    const patientValidation = validatePatient(patient);

    if (hasErrors(officerValidation) || hasErrors(patientValidation)) {
      alert("Lengkapi nama petugas dan data pasien terlebih dahulu sebelum menghitung.");
      return;
    }

    const totalIntake =
      toNumber(fluid.oral) +
      toNumber(fluid.infus) +
      toNumber(fluid.obat) +
      toNumber(fluid.transfusi) +
      toNumber(fluid.lainIntakeValue);

    const totalOutput =
      toNumber(fluid.urin) +
      toNumber(fluid.muntah) +
      toNumber(fluid.drainase) +
      toNumber(fluid.feses) +
      toNumber(fluid.lainOutputValue);

    const balanceStandard = totalIntake - totalOutput;

    let baseIwl = 0;
    let finalIwl = 0;
    let bsa: number | null = null;
    let methodLabel = "";

    if (patient.ageCategory === "dewasa (>18 Thn)") {
      baseIwl = 15 * weightNum;
      methodLabel = "Metode dewasa";
    } else {
      bsa = Math.sqrt((heightNum * weightNum) / 3600);
      baseIwl = 350 * bsa;
      methodLabel = "Metode anak (BSA)";
    }

    let feverFactor = 1;
    if (temperatureNum > 37) {
      feverFactor = 1 + 0.1 * (temperatureNum - 37);
    }

    finalIwl = baseIwl * feverFactor;
    const balanceCorrected = totalIntake - (totalOutput + finalIwl);

    setResult({
      totalIntake,
      totalOutput,
      iwl: finalIwl,
      bsa,
      balanceStandard,
      balanceCorrected,
      statusStandard: getBalanceStatus(balanceStandard),
      statusCorrected: getBalanceStatus(balanceCorrected),
      methodLabel,
      feverFactor,
    });
  }

  function resetAll() {
    setOfficer(initialOfficerForm);
    setPatient(initialPatientForm);
    setFluid(initialFluidForm);
    setResult(null);
    localStorage.removeItem(STORAGE_KEY);
    setSaveMessage("Semua data telah direset dan penyimpanan lokal dibersihkan.");
  }

  async function exportPDF() {
    const officerValidation = validateOfficer(officer);
    const patientValidation = validatePatient(patient);

    if (hasErrors(officerValidation) || hasErrors(patientValidation)) {
      alert("Lengkapi nama petugas dan data pasien terlebih dahulu sebelum export PDF.");
      return;
    }

    if (!result) {
      alert("Hitung balance cairan terlebih dahulu sebelum export PDF.");
      return;
    }

    setIsExporting(true);

    try {
      const jsPDFModule = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");

      const jsPDF = jsPDFModule.default;
      const autoTable = autoTableModule.default;

      const doc = new jsPDF("p", "mm", "a4");

      type RGB = readonly [number, number, number];

      const primary: RGB = [15, 23, 42];
      const blue: RGB = [37, 99, 235];
      const blueOverlay: RGB = [29, 78, 216];
      const cyanOverlay: RGB = [14, 165, 233];
      const lightBlue: RGB = [239, 246, 255];
      const lightGray: RGB = [248, 250, 252];
      const slate: RGB = [71, 85, 105];
      const border: RGB = [226, 232, 240];
      const success: RGB = [22, 163, 74];
      const danger: RGB = [220, 38, 38];
      const warning: RGB = [217, 119, 6];

      const setFill = (color: RGB) => doc.setFillColor(color[0], color[1], color[2]);
      const setDraw = (color: RGB) => doc.setDrawColor(color[0], color[1], color[2]);
      const setText = (color: RGB) => doc.setTextColor(color[0], color[1], color[2]);

      const now = new Date();
      const exportDateDisplay = formatDateDisplay(now);
      const exportDateForFile = formatDateTimeForFile(now);

      const patientName = patient.name?.trim() || "Tanpa_Nama";
      const safePatientName = sanitizeFileName(patientName);

      const totalIntake =
        toNumber(fluid.oral) +
        toNumber(fluid.infus) +
        toNumber(fluid.obat) +
        toNumber(fluid.transfusi) +
        toNumber(fluid.lainIntakeValue);

      const totalOutput =
        toNumber(fluid.urin) +
        toNumber(fluid.muntah) +
        toNumber(fluid.drainase) +
        toNumber(fluid.feses) +
        toNumber(fluid.lainOutputValue);

      const baseIwl =
        patient.ageCategory === "dewasa (>18 Thn)"
          ? 15 * weightNum
          : result.bsa
          ? 350 * result.bsa
          : 0;

      const statusColor: RGB =
        result.statusCorrected === "Positif"
          ? success
          : result.statusCorrected === "Negatif"
          ? danger
          : warning;

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const additionalNotes = fluid.additionalNotes.trim();
      const officerDisplayName = toTitleCase(officer.officerName);

      let logoDataUrl: string | null = null;
      let bgDataUrl: string | null = null;

      try {
        logoDataUrl = await loadImageAsDataUrl("/logo-rs.png");
      } catch {
        logoDataUrl = null;
      }

      try {
        bgDataUrl = await loadImageAsDataUrl("/rsup-m-jamil.jpg");
      } catch {
        bgDataUrl = null;
      }

      const headerX = 10;
      const headerY = 10;
      const headerW = 190;
      const headerH = 30;

      doc.saveGraphicsState();
      doc.roundedRect(headerX, headerY, headerW, headerH, 6, 6, "S");
      doc.clip();

      if (bgDataUrl) {
        doc.addImage(bgDataUrl, "JPEG", headerX, headerY, headerW, headerH);
      } else {
        setFill(blue);
        doc.rect(headerX, headerY, headerW, headerH, "F");
      }

      doc.setFillColor(blueOverlay[0], blueOverlay[1], blueOverlay[2]);
      doc.setGState(new (doc as any).GState({ opacity: 0.84 }));
      doc.rect(headerX, headerY, headerW, headerH, "F");

      doc.setFillColor(cyanOverlay[0], cyanOverlay[1], cyanOverlay[2]);
      doc.setGState(new (doc as any).GState({ opacity: 0.18 }));
      doc.rect(headerX, headerY, headerW, headerH, "F");

      doc.restoreGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
      setDraw(blue);
      doc.roundedRect(headerX, headerY, headerW, headerH, 6, 6, "S");

      doc.setFillColor(255, 255, 255);
      doc.setGState(new (doc as any).GState({ opacity: 0.96 }));
      doc.roundedRect(14, 14, 18, 18, 4, 4, "F");
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
      setDraw(border);
      doc.roundedRect(14, 14, 18, 18, 4, 4, "S");

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", 16, 16, 14, 14);
      } else {
        setText(blue);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("LOGO RS", 23, 24, { align: "center" });
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("LAPORAN BALANCE CAIRAN", 38, 21);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("RSUP Dr. M. Djamil Padang • KALBACA WEB", 38, 28);

      doc.setFillColor(255, 255, 255);
      doc.setGState(new (doc as any).GState({ opacity: 0.92 }));
      doc.roundedRect(150, 15, 44, 14, 4, 4, "F");
      doc.setGState(new (doc as any).GState({ opacity: 1 }));

      setText(blue);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Tanggal Export", 172, 20, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(exportDateDisplay, 172, 25, { align: "center" });

      setFill(lightBlue);
      doc.roundedRect(10, 46, 190, 38, 5, 5, "F");
      setDraw(border);
      doc.roundedRect(10, 46, 190, 38, 5, 5, "S");

      setText(primary);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("IDENTITAS PASIEN", 14, 54);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      doc.text("Nama Pasien", 14, 63);
      doc.text(`: ${patient.name || "-"}`, 43, 63);

      doc.text("Usia", 14, 70);
      doc.text(`: ${patient.age || "-"} tahun`, 43, 70);

      doc.text("Kategori Usia", 14, 77);
      doc.text(`: ${patient.ageCategory || "-"}`, 43, 77);

      doc.text("Berat Badan", 108, 63);
      doc.text(`: ${patient.weight || "-"} kg`, 137, 63);

      doc.text("Tinggi Badan", 108, 70);
      doc.text(`: ${patient.height || "-"} cm`, 137, 70);

      doc.text("Suhu Tubuh", 108, 77);
      doc.text(`: ${patient.temperature || "-"} °C`, 137, 77);

      setText(primary);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("RINGKASAN HASIL", 10, 94);

      const summaryCards = [
        { x: 10, y: 98, w: 58, h: 24, label: "Total Intake", value: formatMl(result.totalIntake) },
        { x: 72, y: 98, w: 58, h: 24, label: "Total Output", value: formatMl(result.totalOutput) },
        { x: 134, y: 98, w: 58, h: 24, label: "Estimasi IWL", value: formatMl(result.iwl) },
        { x: 10, y: 126, w: 58, h: 24, label: "BSA (Anak)", value: formatBsa(result.bsa) },
        { x: 72, y: 126, w: 58, h: 24, label: "Balance Standar", value: formatMl(result.balanceStandard) },
        { x: 134, y: 126, w: 58, h: 24, label: "Balance Terkoreksi", value: formatMl(result.balanceCorrected) },
      ];

      summaryCards.forEach((card) => {
        setFill(lightGray);
        doc.roundedRect(card.x, card.y, card.w, card.h, 4, 4, "F");
        setDraw(border);
        doc.roundedRect(card.x, card.y, card.w, card.h, 4, 4, "S");

        setText(slate);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(card.label, card.x + card.w / 2, card.y + 7, { align: "center" });

        setText(primary);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(card.value, card.x + card.w / 2, card.y + 16.5, { align: "center" });
      });

      setFill(statusColor);
      doc.roundedRect(10, 156, 190, 20, 5, 5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`STATUS BALANCE TERKOREKSI: ${result.statusCorrected.toUpperCase()}`, 105, 164, {
        align: "center",
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(getInterpretationText(result.statusCorrected), 105, 170, {
        align: "center",
      });

      setText(primary);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("RINCIAN KOMPONEN CAIRAN", 10, 186);

      autoTable(doc, {
        startY: 190,
        head: [["Kelompok", "Komponen", "Nilai"]],
        body: [
          ["Intake", "Oral", `${toNumber(fluid.oral).toFixed(1)} mL`],
          ["Intake", "Infus", `${toNumber(fluid.infus).toFixed(1)} mL`],
          ["Intake", "Obat Cair", `${toNumber(fluid.obat).toFixed(1)} mL`],
          ["Intake", "Transfusi", `${toNumber(fluid.transfusi).toFixed(1)} mL`],
          ["Intake", fluid.lainIntakeType || "Lainnya", `${toNumber(fluid.lainIntakeValue).toFixed(1)} mL`],
          ["Output", "Urin", `${toNumber(fluid.urin).toFixed(1)} mL`],
          ["Output", "Muntah", `${toNumber(fluid.muntah).toFixed(1)} mL`],
          ["Output", "Drainase", `${toNumber(fluid.drainase).toFixed(1)} mL`],
          ["Output", "Feses Cair", `${toNumber(fluid.feses).toFixed(1)} mL`],
          ["Output", fluid.lainOutputType || "Lainnya", `${toNumber(fluid.lainOutputValue).toFixed(1)} mL`],
        ],
        theme: "grid",
        headStyles: {
          fillColor: blue as any,
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: primary as any,
          valign: "middle",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 35, halign: "center" },
          1: { cellWidth: 105 },
          2: { cellWidth: 40, halign: "right", fontStyle: "bold" },
        },
        margin: { left: 10, right: 10 },
      });

      let nextY = (doc as any).lastAutoTable.finalY + 12;

      if (nextY > 220) {
        doc.addPage();
        nextY = 18;
      }

      setText(primary);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("RUMUS DAN VALIDASI HASIL", 10, nextY);

      const formulaLines: string[] = [
        `Balance Standar = Intake - Output = ${totalIntake.toFixed(1)} - ${totalOutput.toFixed(1)} = ${result.balanceStandard.toFixed(1)} mL`,
        `Balance Terkoreksi = Intake - (Output + IWL) = ${result.totalIntake.toFixed(1)} - (${result.totalOutput.toFixed(1)} + ${result.iwl.toFixed(1)}) = ${result.balanceCorrected.toFixed(1)} mL`,
      ];

      if (patient.ageCategory === "dewasa (>18 Thn)") {
        formulaLines.push(
          `IWL normal dewasa = 15 x BB = 15 x ${weightNum.toFixed(1)} = ${baseIwl.toFixed(1)} mL/hari`
        );
      } else {
        formulaLines.push(
          `BSA = sqrt[(TB x BB) / 3600] = sqrt[(${heightNum.toFixed(1)} x ${weightNum.toFixed(1)}) / 3600] = ${result.bsa?.toFixed(2) ?? "-"} m²`
        );
        formulaLines.push(
          `IWL normal anak = 350 x BSA = 350 x ${result.bsa?.toFixed(2) ?? "-"} = ${baseIwl.toFixed(1)} mL/hari`
        );
      }

      if (temperatureNum > 37) {
        formulaLines.push(
          `Koreksi demam = IWL x [1 + (0,1 x (Suhu - 37))] = ${baseIwl.toFixed(1)} x ${result.feverFactor.toFixed(2)} = ${result.iwl.toFixed(1)} mL/hari`
        );
      } else {
        formulaLines.push(`Tidak ada koreksi demam karena suhu <= 37°C. IWL akhir = ${result.iwl.toFixed(1)} mL/hari`);
      }

      const formulaText = formulaLines.map((line, index) => `${index + 1}. ${line}`);
      const wrappedFormulaLines = formulaText.flatMap((line) => doc.splitTextToSize(line, 176));
      const formulaBoxHeight = Math.max(34, wrappedFormulaLines.length * 5.2 + 10);

      setFill(lightGray);
      doc.roundedRect(10, nextY + 4, 190, formulaBoxHeight, 4, 4, "F");
      setDraw(border);
      doc.roundedRect(10, nextY + 4, 190, formulaBoxHeight, 4, 4, "S");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      setText(primary);
      doc.text(wrappedFormulaLines, 14, nextY + 12);

      let sectionY = nextY + 4 + formulaBoxHeight + 10;

      if (additionalNotes) {
        if (sectionY > 235) {
          doc.addPage();
          sectionY = 20;
        }

        setText(primary);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("CATATAN TAMBAHAN", 10, sectionY);

        const wrappedNotes = doc.splitTextToSize(additionalNotes, 176);
        const notesBoxHeight = Math.max(24, wrappedNotes.length * 5.2 + 10);

        setFill(lightBlue);
        doc.roundedRect(10, sectionY + 4, 190, notesBoxHeight, 4, 4, "F");
        setDraw(border);
        doc.roundedRect(10, sectionY + 4, 190, notesBoxHeight, 4, 4, "S");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        setText(primary);
        doc.text(wrappedNotes, 14, sectionY + 12);

        sectionY = sectionY + 4 + notesBoxHeight + 12;
      }

      if (sectionY + 48 > 270) {
        doc.addPage();
        sectionY = 20;
      }

      setText(primary);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("PENGESAHAN", 10, sectionY);

      setFill(lightBlue);
      doc.roundedRect(10, sectionY + 4, 190, 40, 5, 5, "F");
      setDraw(border);
      doc.roundedRect(10, sectionY + 4, 190, 40, 5, 5, "S");

      const signCenterX = 150;
      const titleY = sectionY + 16;
      const nameY = sectionY + 30;
      const lineY = sectionY + 34;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setText(primary);
      doc.text("Petugas Penanggung Jawab", signCenterX, titleY, {
        align: "center",
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text(`(${officerDisplayName})`, signCenterX, nameY, {
        align: "center",
      });

      setDraw(primary);
      doc.setLineWidth(0.4);
      doc.line(120, lineY, 180, lineY);

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        setDraw(border);
        doc.line(10, pageHeight - 10, 200, pageHeight - 10);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        setText(slate);
        doc.text(`Pasien: ${patient.name}`, 10, pageHeight - 5);
        doc.text(`Halaman ${i} / ${pageCount}`, pageWidth - 10, pageHeight - 5, {
          align: "right",
        });
      }

      const fileName = `Laporan_Balance_Cairan_${safePatientName}_(${exportDateForFile}).pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat membuat PDF.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <section
          className="relative overflow-hidden rounded-[32px] p-8 md:p-10 text-white shadow-xl mb-6"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(29,78,216,0.88) 0%, rgba(14,165,233,0.82) 52%, rgba(103,232,249,0.72) 100%), url('/rsup-m-jamil.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute right-[-60px] top-[-60px] h-56 w-56 rounded-full bg-white/10" />
          <div className="absolute right-[80px] bottom-[-80px] h-48 w-48 rounded-full bg-white/10" />

          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight">
                  KALBACA WEB
                </h1>
                <p className="mt-4 max-w-4xl text-sm md:text-lg leading-7 text-white/95">
                  Kalkulator Balance Cairan berbasis website untuk membantu
                  pencatatan intake-output yang lebih terstandar, menghitung
                  balance cairan lebih cepat, dan menambahkan estimasi IWL
                  normal maupun demam pada pasien dewasa dan anak.
                </p>
              </div>

              <div className="inline-flex items-center rounded-full border border-white/20 bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
                RSUP Dr. M. Djamil Padang
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-[28px] bg-white p-6 shadow-sm border border-white">
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-slate-800">Nama Petugas</h2>
              <p className="mt-2 text-slate-600 leading-7">
                Isi nama petugas penanggung jawab terlebih dahulu. Nama ini akan
                digunakan pada bagian pengesahan di hasil PDF.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <FormField label="Nama Petugas Penanggung Jawab" error={officerErrors.officerName}>
                <input
                  type="text"
                  placeholder="Masukkan nama petugas"
                  value={officer.officerName}
                  onChange={(e) => setOfficerField("officerName", e.target.value)}
                  className={inputClass(!!officerErrors.officerName)}
                  maxLength={100}
                />
              </FormField>
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-sm border border-white">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Data Pasien</h2>
                <p className="mt-2 text-slate-600 leading-7">
                  Isi data dasar pasien untuk menyesuaikan perhitungan IWL dan
                  balance cairan terkoreksi. Semua field wajib diisi sebelum
                  bagian pencatatan cairan bisa digunakan.
                </p>
              </div>
              <div className="whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                Langkah 1
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Nama Pasien" error={patientErrors.name}>
                <input
                  type="text"
                  placeholder="Masukkan nama pasien"
                  value={patient.name}
                  onChange={(e) => setPatientField("name", e.target.value)}
                  className={inputClass(!!patientErrors.name)}
                  maxLength={100}
                />
              </FormField>

              <FormField label="Usia (tahun)" error={patientErrors.age}>
                <input
                  type="number"
                  min={0}
                  max={130}
                  step={1}
                  placeholder="Contoh: 25"
                  value={patient.age}
                  onChange={(e) => setPatientField("age", e.target.value)}
                  className={inputClass(!!patientErrors.age)}
                />
              </FormField>

              <FormField label="Kategori Usia" error={patientErrors.ageCategory}>
                <select
                  value={patient.ageCategory}
                  onChange={(e) =>
                    setPatientField("ageCategory", e.target.value as AgeCategory)
                  }
                  className={inputClass(!!patientErrors.ageCategory)}
                >
                  <option value="">Pilih kategori usia</option>
                  <option value="dewasa (>18 Thn)">Dewasa (&gt;18 Thn)</option>
                  <option value="anak (<18 Thn)">Anak (&lt;18 Thn)</option>
                </select>
              </FormField>

              <FormField label="Berat Badan (kg)" error={patientErrors.weight}>
                <input
                  type="number"
                  min={0.1}
                  max={300}
                  step={0.1}
                  placeholder="Contoh: 60"
                  value={patient.weight}
                  onChange={(e) => setPatientField("weight", e.target.value)}
                  className={inputClass(!!patientErrors.weight)}
                />
              </FormField>

              <FormField label="Tinggi Badan (cm)" error={patientErrors.height}>
                <input
                  type="number"
                  min={30}
                  max={250}
                  step={0.1}
                  placeholder="Contoh: 170"
                  value={patient.height}
                  onChange={(e) => setPatientField("height", e.target.value)}
                  className={inputClass(!!patientErrors.height)}
                />
              </FormField>

              <FormField label="Suhu Tubuh (°C)" error={patientErrors.temperature}>
                <input
                  type="number"
                  min={30}
                  max={45}
                  step={0.1}
                  placeholder="Contoh: 36.8 atau 39"
                  value={patient.temperature}
                  onChange={(e) => setPatientField("temperature", e.target.value)}
                  className={inputClass(!!patientErrors.temperature)}
                />
              </FormField>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {saveMessage}
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-sm border border-white">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  Pencatatan Intake dan Output
                </h2>
                <p className="mt-2 text-slate-600 leading-7">
                  Format dibuat lebih rapi untuk mendukung pencatatan
                  terstandar dan mengurangi kesalahan input. Semua kolom angka
                  menggunakan satuan mL.
                </p>
              </div>
              <div className="whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                Langkah 2
              </div>
            </div>

            {!formReady && (
              <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                Input cairan dikunci sampai nama petugas dan semua data pasien lengkap dan valid.
              </div>
            )}

            <div
              className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 ${
                !formReady ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              <FluidGroup title="Intake">
                <FieldNumber label="Oral" value={fluid.oral} onChange={(v) => setFluidField("oral", v)} />
                <FieldNumber label="Infus" value={fluid.infus} onChange={(v) => setFluidField("infus", v)} />
                <FieldNumber label="Obat Cair" value={fluid.obat} onChange={(v) => setFluidField("obat", v)} />
              </FluidGroup>

              <FluidGroup title="Intake Lanjutan">
                <FieldNumber label="Transfusi" value={fluid.transfusi} onChange={(v) => setFluidField("transfusi", v)} />
                <FieldText
                  label="Jenis Intake Lainnya"
                  value={fluid.lainIntakeType}
                  onChange={(v) => setFluidField("lainIntakeType", v)}
                  placeholder="Contoh: Nutrisi Enteral"
                />
                <FieldNumber label="Nilai Intake Lainnya" value={fluid.lainIntakeValue} onChange={(v) => setFluidField("lainIntakeValue", v)} />
              </FluidGroup>

              <FluidGroup title="Output">
                <FieldNumber label="Urin" value={fluid.urin} onChange={(v) => setFluidField("urin", v)} />
                <FieldNumber label="Muntah" value={fluid.muntah} onChange={(v) => setFluidField("muntah", v)} />
              </FluidGroup>

              <FluidGroup title="Output Lanjutan">
                <FieldNumber label="Drainase" value={fluid.drainase} onChange={(v) => setFluidField("drainase", v)} />
                <FieldNumber label="Feses Cair" value={fluid.feses} onChange={(v) => setFluidField("feses", v)} />
              </FluidGroup>

              <FluidGroup title="Output Tambahan">
                <FieldText
                  label="Jenis Output Lainnya"
                  value={fluid.lainOutputType}
                  onChange={(v) => setFluidField("lainOutputType", v)}
                  placeholder="Contoh: Aspirasi Lambung"
                />
                <FieldNumber label="Nilai Output Lainnya" value={fluid.lainOutputValue} onChange={(v) => setFluidField("lainOutputValue", v)} />
              </FluidGroup>
            </div>

            <div className={`mt-5 ${!formReady ? "opacity-60 pointer-events-none" : ""}`}>
              <FormField label="Catatan Tambahan / Keterangan Tambahan">
                <textarea
                  placeholder="Isi jika ada catatan tambahan dari petugas. Jika kosong, tidak akan ditampilkan di PDF."
                  value={fluid.additionalNotes}
                  onChange={(e) => setFluidField("additionalNotes", e.target.value)}
                  rows={4}
                  className={`${inputClass(false)} resize-y min-h-[110px]`}
                  maxLength={1000}
                />
              </FormField>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={calculate}
                disabled={!formReady}
                className="rounded-2xl bg-blue-600 px-6 py-3 text-white font-bold shadow-md transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Hitung Balance Cairan
              </button>

              <button
                type="button"
                onClick={exportPDF}
                disabled={!result || !formReady || isExporting}
                className="rounded-2xl bg-emerald-600 px-6 py-3 text-white font-bold shadow-md transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isExporting ? "Sedang Export..." : "Export PDF"}
              </button>

              <button
                type="button"
                onClick={resetAll}
                className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-slate-700 font-bold transition hover:bg-slate-50"
              >
                Reset
              </button>
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-sm border border-white">
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-slate-800">
                Dashboard Hasil
              </h2>
              <p className="mt-2 text-slate-600 leading-7">
                Menampilkan hasil utama untuk mempercepat interpretasi dan validasi perhitungan.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <ResultCard label="Total Intake" value={result ? formatMl(result.totalIntake) : "0 mL"} />
              <ResultCard label="Total Output" value={result ? formatMl(result.totalOutput) : "0 mL"} />
              <ResultCard label="Estimasi IWL" value={result ? formatMl(result.iwl) : "0 mL"} />
              <ResultCard label="BSA (Anak)" value={result ? formatBsa(result.bsa) : "-"} />
              <ResultCard label="Balance Standar" value={result ? formatMl(result.balanceStandard) : "0 mL"} />
              <ResultCard label="Balance Terkoreksi" value={result ? formatMl(result.balanceCorrected) : "0 mL"} />
            </div>

            <div className="mt-5 rounded-3xl border border-blue-200 bg-blue-50 p-4 leading-7 text-slate-700">
              {!formReady ? (
                <p>Lengkapi nama petugas dan data pasien terlebih dahulu agar hasil dapat muncul.</p>
              ) : !result ? (
                <p>Status akan muncul setelah perhitungan.</p>
              ) : (
                <div>
                  <p className="font-bold text-slate-800">
                    {patient.name} - {result.methodLabel}
                  </p>
                  <p className="mt-1">
                    Status Balance Standar:{" "}
                    <span className={`font-bold ${getStatusClass(result.statusStandard)}`}>
                      {result.statusStandard}
                    </span>
                  </p>
                  <p>
                    Status Balance Terkoreksi:{" "}
                    <span className={`font-bold ${getStatusClass(result.statusCorrected)}`}>
                      {result.statusCorrected}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-sm border border-white">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-slate-800">
                Rumus yang Digunakan
              </h2>
              <p className="mt-2 text-slate-600 leading-7">
                Bagian ini berguna untuk memverifikasi hasil, memvalidasi perhitungan,
                dan memastikan rumus yang digunakan tampil transparan.
              </p>
            </div>

            {!result ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-500">
                Rumus dan hasil perhitungan akan muncul di sini setelah tombol hitung dijalankan.
              </div>
            ) : (
              <FormulaPanel
                patient={patient}
                fluid={fluid}
                result={result}
                weightNum={weightNum}
                heightNum={heightNum}
                temperatureNum={temperatureNum}
              />
            )}

            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-800 leading-8">
              Catatan: balance standar dihitung dari intake dikurangi output terukur.
              Balance terkoreksi menambahkan estimasi IWL untuk memberikan gambaran
              cairan yang lebih komprehensif.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function inputClass(hasError: boolean) {
  return `w-full rounded-2xl border bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 outline-none focus:ring-4 ${
    hasError
      ? "border-rose-400 focus:border-rose-400 focus:ring-rose-100"
      : "border-slate-300 focus:border-blue-400 focus:ring-blue-100"
  }`;
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      {children}
      <div className="mt-2 min-h-[20px] text-sm text-rose-600">{error || ""}</div>
    </div>
  );
}

function FluidGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 min-h-[360px]">
      <h3 className="text-lg font-bold text-blue-800 min-h-[56px]">{title}</h3>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function FieldNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const handleChange = (raw: string) => {
    const normalized = raw.replace(/,/g, ".");

    if (normalized === "") {
      onChange("");
      return;
    }

    if (/^\d*\.?\d*$/.test(normalized)) {
      onChange(normalized);
    }
  };

  return (
    <div>
      <label className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700 min-h-[20px]">
        <span>{label}</span>
        <span className="text-xs font-medium text-slate-500">mL</span>
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Contoh: 500"
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

function FieldText({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700 min-h-[20px]">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

function ResultCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 min-h-[128px] flex flex-col justify-between">
      <p className="text-sm font-semibold text-slate-500 text-center">{label}</p>
      <h3 className="mt-3 text-2xl md:text-3xl font-black text-slate-900 text-center">
        {value}
      </h3>
    </div>
  );
}

function FormulaPanel({
  patient,
  fluid,
  result,
  weightNum,
  heightNum,
  temperatureNum,
}: {
  patient: PatientForm;
  fluid: FluidForm;
  result: CalculationResult;
  weightNum: number;
  heightNum: number;
  temperatureNum: number;
}) {
  const totalIntake =
    toNumber(fluid.oral) +
    toNumber(fluid.infus) +
    toNumber(fluid.obat) +
    toNumber(fluid.transfusi) +
    toNumber(fluid.lainIntakeValue);

  const totalOutput =
    toNumber(fluid.urin) +
    toNumber(fluid.muntah) +
    toNumber(fluid.drainase) +
    toNumber(fluid.feses) +
    toNumber(fluid.lainOutputValue);

  const baseIwl =
    patient.ageCategory === "dewasa (>18 Thn)"
      ? 15 * weightNum
      : result.bsa
      ? 350 * result.bsa
      : 0;

  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-700 leading-8">
      <div className="space-y-6">
        <div>
          <h3 className="font-bold text-slate-800 text-xl">Balance Standar</h3>
          <p>
            Intake - Output = {totalIntake.toFixed(1)} - {totalOutput.toFixed(1)} ={" "}
            <span className="font-bold">{result.balanceStandard.toFixed(1)} mL</span>
          </p>
        </div>

        <div>
          <h3 className="font-bold text-slate-800 text-xl">Balance Terkoreksi</h3>
          <p>
            Intake - (Output + IWL) = {result.totalIntake.toFixed(1)} - (
            {result.totalOutput.toFixed(1)} + {result.iwl.toFixed(1)}) ={" "}
            <span className="font-bold">{result.balanceCorrected.toFixed(1)} mL</span>
          </p>
        </div>

        <div>
          <h3 className="font-bold text-slate-800 text-xl">Perhitungan IWL</h3>

          {patient.ageCategory === "dewasa (>18 Thn)" ? (
            <p>
              IWL normal dewasa = 15 × BB = 15 × {weightNum.toFixed(1)} ={" "}
              <span className="font-bold">{baseIwl.toFixed(1)} mL/hari</span>
            </p>
          ) : (
            <>
              <p>
                BSA = √[(TB × BB) / 3600] = √[({heightNum.toFixed(1)} ×{" "}
                {weightNum.toFixed(1)}) / 3600] ={" "}
                <span className="font-bold">{result.bsa?.toFixed(2)} m²</span>
              </p>
              <p>
                IWL normal anak = 350 × BSA = 350 × {result.bsa?.toFixed(2)} ={" "}
                <span className="font-bold">{baseIwl.toFixed(1)} mL/hari</span>
              </p>
            </>
          )}

          {temperatureNum > 37 ? (
            <p>
              Koreksi demam = IWL × [1 + (0,1 × (Suhu - 37))] = {baseIwl.toFixed(1)} ×{" "}
              {result.feverFactor.toFixed(2)} ={" "}
              <span className="font-bold">{result.iwl.toFixed(1)} mL/hari</span>
            </p>
          ) : (
            <p>
              Tidak ada koreksi demam karena suhu ≤ 37°C. Nilai IWL akhir ={" "}
              <span className="font-bold">{result.iwl.toFixed(1)} mL/hari</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
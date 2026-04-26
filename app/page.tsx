"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type AgeCategory = "dewasa (>18 Thn)" | "anak (<18 Thn)" | "";
type BalanceStatus = "Positif" | "Negatif" | "Seimbang";
type AppView = "home" | "tentang" | "profil";

type OfficerForm = {
  officerName: string;
};

type PatientForm = {
  name: string;
  age: string;
  ageCategory: AgeCategory;
  weight: string;
  temperature: string;
};

type AdditionalFluidItem = {
  id: string;
  type: string;
  value: string;
};

type FluidForm = {
  oral: string;
  infus: string;
  obat: string;
  transfusi: string;
  airMetabolisme: string;
  additionalIntakes: AdditionalFluidItem[];
  urin: string;
  muntah: string;
  drainase: string;
  feses: string;
  additionalOutputs: AdditionalFluidItem[];
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
  temperature?: string;
};

type CalculationResult = {
  totalIntake: number;
  totalOutput: number;
  iwlNormal: number;
  iwlFever: number | null;
  balanceStandard: number;
  balanceCorrected: number | null;
  statusStandard: BalanceStatus;
  statusCorrected: BalanceStatus | null;
  methodLabel: string;
  hasFever: boolean;
  feverAddition: number;
};

const STORAGE_KEY = "fluidacare-web-v8-data";
const MAX_ADDITIONAL_ITEMS = 5;

const initialOfficerForm: OfficerForm = {
  officerName: "",
};

const initialPatientForm: PatientForm = {
  name: "",
  age: "",
  ageCategory: "",
  weight: "",
  temperature: "",
};

function createAdditionalItem(): AdditionalFluidItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: "",
    value: "",
  };
}

const initialFluidForm: FluidForm = {
  oral: "",
  infus: "",
  obat: "",
  transfusi: "",
  airMetabolisme: "",
  additionalIntakes: [createAdditionalItem()],
  urin: "",
  muntah: "",
  drainase: "",
  feses: "",
  additionalOutputs: [createAdditionalItem()],
  additionalNotes: "",
};

function toNumber(value: string) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumAdditionalItems(items: AdditionalFluidItem[]) {
  return items.reduce((total, item) => total + toNumber(item.value), 0);
}

function formatMl(value: number) {
  return `${value.toFixed(1)} mL`;
}

function getBalanceStatus(value: number): BalanceStatus {
  if (value > 0) return "Positif";
  if (value < 0) return "Negatif";
  return "Seimbang";
}

function getStatusClass(status: BalanceStatus | null) {
  if (status === "Positif") return "text-emerald-600";
  if (status === "Negatif") return "text-rose-600";
  return "text-amber-600";
}

function getInterpretationText(status: BalanceStatus | null) {
  if (status === "Positif") return "Cenderung positif, perlu evaluasi klinis lanjutan.";
  if (status === "Negatif") return "Cenderung negatif, perlu verifikasi intake-output dan kondisi pasien.";
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
  return name.trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_");
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
  if (!response.ok) throw new Error(`Gagal memuat gambar: ${src}`);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function normalizeAdditionalItems(items: unknown): AdditionalFluidItem[] {
  if (!Array.isArray(items) || items.length === 0) return [createAdditionalItem()];

  return items.slice(0, MAX_ADDITIONAL_ITEMS).map((item, index) => {
    const safeItem = item as Partial<AdditionalFluidItem>;
    return {
      id: safeItem.id || `restored-${index}-${Math.random().toString(36).slice(2, 9)}`,
      type: safeItem.type ?? "",
      value: safeItem.value === "0" ? "" : safeItem.value ?? "",
    };
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
  const [isInfoMenuOpen, setIsInfoMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>("home");

  const officerErrors = useMemo(() => validateOfficer(officer), [officer]);
  const patientErrors = useMemo(() => validatePatient(patient), [patient]);

  const officerReady = !hasErrors(officerErrors);
  const patientReady = !hasErrors(patientErrors);
  const formReady = officerReady && patientReady;

  const weightNum = toNumber(patient.weight);
  const temperatureNum = toNumber(patient.temperature);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);

        if (parsed.officer) setOfficer(parsed.officer);
        if (parsed.patient) {
          setPatient({
            name: parsed.patient.name ?? "",
            age: parsed.patient.age ?? "",
            ageCategory: parsed.patient.ageCategory ?? "",
            weight: parsed.patient.weight ?? "",
            temperature: parsed.patient.temperature ?? "",
          });
        }

        if (parsed.fluid) {
          setFluid({
            oral: parsed.fluid.oral === "0" ? "" : parsed.fluid.oral ?? "",
            infus: parsed.fluid.infus === "0" ? "" : parsed.fluid.infus ?? "",
            obat: parsed.fluid.obat === "0" ? "" : parsed.fluid.obat ?? "",
            transfusi: parsed.fluid.transfusi === "0" ? "" : parsed.fluid.transfusi ?? "",
            airMetabolisme:
              parsed.fluid.airMetabolisme === "0" ? "" : parsed.fluid.airMetabolisme ?? "",
            additionalIntakes: normalizeAdditionalItems(
              parsed.fluid.additionalIntakes ??
                (parsed.fluid.lainIntakeType || parsed.fluid.lainIntakeValue
                  ? [
                      {
                        id: "legacy-intake-1",
                        type: parsed.fluid.lainIntakeType ?? "",
                        value:
                          parsed.fluid.lainIntakeValue === "0"
                            ? ""
                            : parsed.fluid.lainIntakeValue ?? "",
                      },
                    ]
                  : null)
            ),
            urin: parsed.fluid.urin === "0" ? "" : parsed.fluid.urin ?? "",
            muntah: parsed.fluid.muntah === "0" ? "" : parsed.fluid.muntah ?? "",
            drainase: parsed.fluid.drainase === "0" ? "" : parsed.fluid.drainase ?? "",
            feses: parsed.fluid.feses === "0" ? "" : parsed.fluid.feses ?? "",
            additionalOutputs: normalizeAdditionalItems(
              parsed.fluid.additionalOutputs ??
                (parsed.fluid.lainOutputType || parsed.fluid.lainOutputValue
                  ? [
                      {
                        id: "legacy-output-1",
                        type: parsed.fluid.lainOutputType ?? "",
                        value:
                          parsed.fluid.lainOutputValue === "0"
                            ? ""
                            : parsed.fluid.lainOutputValue ?? "",
                      },
                    ]
                  : null)
            ),
            additionalNotes: parsed.fluid.additionalNotes ?? "",
          });
        }

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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsInfoMenuOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  function updateAdditionalItem(
    group: "additionalIntakes" | "additionalOutputs",
    id: string,
    field: keyof Omit<AdditionalFluidItem, "id">,
    value: string
  ) {
    if (!formReady) return;

    setFluid((prev) => ({
      ...prev,
      [group]: prev[group].map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
    setResult(null);
  }

  function addAdditionalItem(group: "additionalIntakes" | "additionalOutputs") {
    if (!formReady) return;

    setFluid((prev) => {
      if (prev[group].length >= MAX_ADDITIONAL_ITEMS) return prev;
      return {
        ...prev,
        [group]: [...prev[group], createAdditionalItem()],
      };
    });
    setResult(null);
  }

  function removeAdditionalItem(group: "additionalIntakes" | "additionalOutputs", id: string) {
    if (!formReady) return;

    setFluid((prev) => {
      const filtered = prev[group].filter((item) => item.id !== id);
      return {
        ...prev,
        [group]: filtered.length > 0 ? filtered : [createAdditionalItem()],
      };
    });
    setResult(null);
  }

  function openMenuPage(view: Exclude<AppView, "home">) {
    setCurrentView(view);
    setIsInfoMenuOpen(false);
  }

  function backToHome() {
    setCurrentView("home");
    setIsInfoMenuOpen(false);
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
      toNumber(fluid.airMetabolisme) +
      sumAdditionalItems(fluid.additionalIntakes);

    const totalOutput =
      toNumber(fluid.urin) +
      toNumber(fluid.muntah) +
      toNumber(fluid.drainase) +
      toNumber(fluid.feses) +
      sumAdditionalItems(fluid.additionalOutputs);

    const ageNum = toNumber(patient.age);
    const hasFever = temperatureNum > 37;

    const iwlNormal =
      patient.ageCategory === "dewasa (>18 Thn)" ? 15 * weightNum : (30 - ageNum) * weightNum;

    const feverAddition = hasFever ? 200 * (temperatureNum - 37) : 0;
    const iwlFever = hasFever ? iwlNormal + feverAddition : null;

    const balanceStandard = totalIntake - (totalOutput + iwlNormal);
    const balanceCorrected =
      hasFever && iwlFever !== null ? totalIntake - (totalOutput + iwlFever) : null;

    setResult({
      totalIntake,
      totalOutput,
      iwlNormal,
      iwlFever,
      balanceStandard,
      balanceCorrected,
      statusStandard: getBalanceStatus(balanceStandard),
      statusCorrected: balanceCorrected !== null ? getBalanceStatus(balanceCorrected) : null,
      methodLabel:
        patient.ageCategory === "dewasa (>18 Thn)"
          ? "Metode dewasa: IWL 15 × BB"
          : "Metode anak: IWL (30 - usia) × BB",
      hasFever,
      feverAddition,
    });
  }

  function resetAll() {
    setOfficer(initialOfficerForm);
    setPatient(initialPatientForm);
    setFluid({
      ...initialFluidForm,
      additionalIntakes: [createAdditionalItem()],
      additionalOutputs: [createAdditionalItem()],
    });
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
        toNumber(fluid.airMetabolisme) +
        sumAdditionalItems(fluid.additionalIntakes);

      const totalOutput =
        toNumber(fluid.urin) +
        toNumber(fluid.muntah) +
        toNumber(fluid.drainase) +
        toNumber(fluid.feses) +
        sumAdditionalItems(fluid.additionalOutputs);

      const ageNum = toNumber(patient.age);
      const baseIwl = result.iwlNormal;
      const mainStatus = result.statusCorrected ?? result.statusStandard;
      const statusColor: RGB =
        mainStatus === "Positif" ? success : mainStatus === "Negatif" ? danger : warning;

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
      doc.text("RSUP Dr. M. Djamil Padang • FluidaCare", 38, 28);

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
      doc.roundedRect(10, 46, 190, 31, 5, 5, "F");
      setDraw(border);
      doc.roundedRect(10, 46, 190, 31, 5, 5, "S");

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

      doc.text("Kategori Usia", 92, 63);
      doc.text(`: ${patient.ageCategory || "-"}`, 121, 63);

      doc.text("Berat Badan", 92, 70);
      doc.text(`: ${patient.weight || "-"} kg`, 121, 70);

      doc.text("Suhu Tubuh", 150, 70);
      doc.text(`: ${patient.temperature || "-"} °C`, 175, 70);

      setText(primary);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("RINGKASAN HASIL", 10, 88);

      const summaryCards = [
        { x: 10, y: 92, w: 58, h: 24, label: "Total Intake", value: formatMl(result.totalIntake) },
        { x: 72, y: 92, w: 58, h: 24, label: "Total Output", value: formatMl(result.totalOutput) },
        { x: 134, y: 92, w: 58, h: 24, label: "IWL Normal", value: formatMl(result.iwlNormal) },
        {
          x: 10,
          y: 120,
          w: 58,
          h: 24,
          label: result.hasFever ? "IWL Demam" : "Status Demam",
          value: result.hasFever && result.iwlFever !== null ? formatMl(result.iwlFever) : "Tidak demam",
        },
        { x: 72, y: 120, w: 58, h: 24, label: "Balance Standar", value: formatMl(result.balanceStandard) },
        {
          x: 134,
          y: 120,
          w: 58,
          h: 24,
          label: result.hasFever ? "Balance Terkoreksi" : "Koreksi Demam",
          value: result.balanceCorrected !== null ? formatMl(result.balanceCorrected) : "Tidak muncul",
        },
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
      doc.roundedRect(10, 150, 190, 20, 5, 5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(
        `${result.hasFever ? "STATUS BALANCE TERKOREKSI" : "STATUS BALANCE"}: ${mainStatus.toUpperCase()}`,
        105,
        158,
        { align: "center" }
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(getInterpretationText(mainStatus), 105, 164, { align: "center" });

      setText(primary);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("RINCIAN KOMPONEN CAIRAN", 10, 180);

      const intakeRows = fluid.additionalIntakes
        .filter((item) => item.type.trim() || item.value.trim())
        .map((item, index) => [
          "Intake",
          item.type.trim() || `Lainnya ${index + 1}`,
          `${toNumber(item.value).toFixed(1)} mL`,
        ]);

      const outputRows = fluid.additionalOutputs
        .filter((item) => item.type.trim() || item.value.trim())
        .map((item, index) => [
          "Output",
          item.type.trim() || `Lainnya ${index + 1}`,
          `${toNumber(item.value).toFixed(1)} mL`,
        ]);

      autoTable(doc, {
        startY: 184,
        head: [["Kelompok", "Komponen", "Nilai"]],
        body: [
          ["Intake", "Oral", `${toNumber(fluid.oral).toFixed(1)} mL`],
          ["Intake", "Infus", `${toNumber(fluid.infus).toFixed(1)} mL`],
          ["Intake", "Obat Cair", `${toNumber(fluid.obat).toFixed(1)} mL`],
          ["Intake", "Transfusi", `${toNumber(fluid.transfusi).toFixed(1)} mL`],
          ["Intake", "Air Metabolisme", `${toNumber(fluid.airMetabolisme).toFixed(1)} mL`],
          ...intakeRows,
          ["Output", "Urin", `${toNumber(fluid.urin).toFixed(1)} mL`],
          ["Output", "Muntah", `${toNumber(fluid.muntah).toFixed(1)} mL`],
          ["Output", "Drainase", `${toNumber(fluid.drainase).toFixed(1)} mL`],
          ["Output", "Feses Cair", `${toNumber(fluid.feses).toFixed(1)} mL`],
          ...outputRows,
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

      const formulaLines: string[] = [];

      if (patient.ageCategory === "dewasa (>18 Thn)") {
        formulaLines.push(
          `IWL normal dewasa = 15 x BB = 15 x ${weightNum.toFixed(1)} = ${baseIwl.toFixed(1)} mL/hari`
        );
      } else {
        formulaLines.push(
          `IWL normal anak = (30 - usia) x BB = (30 - ${ageNum.toFixed(1)}) x ${weightNum.toFixed(1)} = ${baseIwl.toFixed(1)} mL/hari`
        );
      }

      formulaLines.push(
        `Balance cairan standar = Intake - (Output + IWL normal) = ${totalIntake.toFixed(1)} - (${totalOutput.toFixed(1)} + ${result.iwlNormal.toFixed(1)}) = ${result.balanceStandard.toFixed(1)} mL`
      );

      if (result.hasFever && result.iwlFever !== null && result.balanceCorrected !== null) {
        formulaLines.push(
          `IWL demam/koreksi = IWL normal + 200 x (Suhu - 37) = ${result.iwlNormal.toFixed(1)} + 200 x (${temperatureNum.toFixed(1)} - 37) = ${result.iwlFever.toFixed(1)} mL/hari`
        );
        formulaLines.push(
          `Balance cairan terkoreksi = Intake - (Output + IWL demam) = ${result.totalIntake.toFixed(1)} - (${result.totalOutput.toFixed(1)} + ${result.iwlFever.toFixed(1)}) = ${result.balanceCorrected.toFixed(1)} mL`
        );
      } else {
        formulaLines.push("Tidak ada koreksi demam karena suhu <= 37°C, sehingga bagian balance terkoreksi tidak ditampilkan.");
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
      doc.roundedRect(10, sectionY + 5, 190, 42, 5, 5, "F");
      setDraw(border);
      doc.roundedRect(10, sectionY + 5, 190, 42, 5, 5, "S");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      setText(primary);
      doc.text("Padang, " + exportDateDisplay.split(",")[0], 146, sectionY + 15, { align: "center" });
      doc.text("Petugas Penanggung Jawab", 146, sectionY + 22, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(officerDisplayName || "-", 146, sectionY + 42, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setText(slate);
      doc.text("Dokumen dibuat otomatis oleh FluidaCare.", 10, 288);

      doc.save(`Balance_Cairan_${safePatientName}_${exportDateForFile}.pdf`);
    } catch (error) {
      console.error(error);
      alert("Export PDF gagal. Pastikan paket jspdf dan jspdf-autotable sudah terpasang.");
    } finally {
      setIsExporting(false);
    }
  }

  if (currentView !== "home") {
    return <InfoPage variant={currentView} onBack={backToHome} />;
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <section
          className="relative mb-6 overflow-visible rounded-[32px] p-7 text-white shadow-xl md:p-10"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(29,78,216,0.88) 0%, rgba(14,165,233,0.82) 52%, rgba(103,232,249,0.72) 100%), url('/rsup-m-jamil.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="pointer-events-none absolute right-[-60px] top-[-60px] h-56 w-56 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute bottom-[-80px] right-[80px] h-48 w-48 rounded-full bg-white/10" />

          <div className="relative z-10 min-h-[170px] pr-0 md:pr-48">
            <h1 className="text-4xl font-black tracking-tight md:text-5xl">FluidaCare</h1>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-white/95 md:text-lg">
              Kalkulator balance cairan berbasis website untuk membantu pencatatan intake-output yang
              lebih terstandar, menghitung balance cairan lebih cepat, serta membantu koreksi demam.
            </p>

            <div className="mt-6 inline-flex items-center rounded-full border border-white/20 bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
              RSUP Dr. M. Djamil Padang
            </div>
          </div>

          <div className="absolute right-5 top-5 z-50 md:right-8 md:top-8">
            <button
              type="button"
              onClick={() => setIsInfoMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-3 rounded-2xl border border-white/40 bg-white/20 px-4 py-3 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-white/30"
              aria-label="Buka menu informasi"
            >
              <span className="flex flex-col gap-1">
                <span className="block h-0.5 w-5 rounded-full bg-white" />
                <span className="block h-0.5 w-5 rounded-full bg-white" />
                <span className="block h-0.5 w-5 rounded-full bg-white" />
              </span>
              <span>Menu</span>
            </button>

            {isInfoMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+12px)] z-50 w-[330px] max-w-[calc(100vw-2rem)] rounded-[28px] border border-slate-200 bg-white p-3 text-slate-800 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Menu Navigasi
                </p>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => openMenuPage("tentang")}
                    className="flex w-full items-start justify-between rounded-2xl border border-transparent bg-slate-50 px-4 py-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    <span className="pr-4">
                      <span className="block text-base font-extrabold text-slate-900">Tentang Aplikasi</span>
                      <span className="mt-1 block text-sm leading-6 text-slate-500">
                        Buka halaman informasi aplikasi.
                      </span>
                    </span>
                    <span className="mt-1 text-2xl text-slate-400">›</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openMenuPage("profil")}
                    className="flex w-full items-start justify-between rounded-2xl border border-transparent bg-slate-50 px-4 py-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    <span className="pr-4">
                      <span className="block text-base font-extrabold text-slate-900">Profil Pengembangan</span>
                      <span className="mt-1 block text-sm leading-6 text-slate-500">
                        Buka halaman profil pengembangan.
                      </span>
                    </span>
                    <span className="mt-1 text-2xl text-slate-400">›</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-white bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-slate-800">Nama Petugas</h2>
              <p className="mt-2 leading-7 text-slate-600">
                Isi nama petugas penanggung jawab terlebih dahulu. Nama ini akan digunakan pada bagian
                pengesahan di hasil PDF.
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

          <section className="rounded-[28px] border border-white bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Data Pasien</h2>
                <p className="mt-2 leading-7 text-slate-600">
                  Isi data dasar pasien untuk menyesuaikan perhitungan IWL dan balance cairan terkoreksi.
                  Semua field wajib diisi sebelum bagian pencatatan cairan bisa digunakan.
                </p>
              </div>
              <span className="shrink-0 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-700">
                Langkah 1
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="xl:col-span-2">
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
              </div>

              <FormField label="Usia (tahun)" error={patientErrors.age}>
                <input
                  type="number"
                  min={0}
                  max={130}
                  step={0.1}
                  placeholder="Contoh: 45"
                  value={patient.age}
                  onChange={(e) => setPatientField("age", e.target.value)}
                  className={inputClass(!!patientErrors.age)}
                />
              </FormField>

              <FormField label="Kategori Usia" error={patientErrors.ageCategory}>
                <select
                  value={patient.ageCategory}
                  onChange={(e) => setPatientField("ageCategory", e.target.value as AgeCategory)}
                  className={inputClass(!!patientErrors.ageCategory)}
                >
                  <option value="">Pilih kategori</option>
                  <option value="dewasa (>18 Thn)">Dewasa (&gt;18 Thn)</option>
                  <option value="anak (<18 Thn)">Anak (&lt;18 Thn)</option>
                </select>
              </FormField>

              <FormField label="Berat Badan (kg)" error={patientErrors.weight}>
                <input
                  type="number"
                  min={0}
                  max={300}
                  step={0.1}
                  placeholder="Contoh: 60"
                  value={patient.weight}
                  onChange={(e) => setPatientField("weight", e.target.value)}
                  className={inputClass(!!patientErrors.weight)}
                />
              </FormField>

              <FormField label="Suhu Tubuh (°C)" error={patientErrors.temperature}>
                <input
                  type="number"
                  min={30}
                  max={45}
                  step={0.1}
                  placeholder="Contoh: 37.8"
                  value={patient.temperature}
                  onChange={(e) => setPatientField("temperature", e.target.value)}
                  className={inputClass(!!patientErrors.temperature)}
                />
              </FormField>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
              {saveMessage}
            </div>
          </section>

          <section className="rounded-[28px] border border-white bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Pencatatan Cairan</h2>
                <p className="mt-2 leading-7 text-slate-600">
                  Catat seluruh intake dan output pasien. Kolom tambahan dapat dipakai sampai 5 jenis cairan
                  tambahan pada masing-masing kelompok.
                </p>
              </div>
              <span className="shrink-0 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-700">
                Langkah 2
              </span>
            </div>

            {!formReady && (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800">
                Lengkapi nama petugas dan data pasien terlebih dahulu agar bagian pencatatan cairan bisa
                digunakan.
              </div>
            )}

            <div className={`grid grid-cols-1 gap-5 lg:grid-cols-2 ${!formReady ? "pointer-events-none opacity-50" : ""}`}>
              <FluidGroup title="Intake" description="Masukkan seluruh cairan masuk pasien.">
                <FieldNumber label="Oral" value={fluid.oral} onChange={(v) => setFluidField("oral", v)} />
                <FieldNumber label="Infus" value={fluid.infus} onChange={(v) => setFluidField("infus", v)} />
                <FieldNumber label="Obat Cair" value={fluid.obat} onChange={(v) => setFluidField("obat", v)} />
                <FieldNumber label="Transfusi" value={fluid.transfusi} onChange={(v) => setFluidField("transfusi", v)} />
                <FieldNumber
                  label="Air Metabolisme"
                  value={fluid.airMetabolisme}
                  onChange={(v) => setFluidField("airMetabolisme", v)}
                />

                <AdditionalItems
                  title="Jenis Intake Lainnya"
                  group="additionalIntakes"
                  items={fluid.additionalIntakes}
                  onChange={updateAdditionalItem}
                  onAdd={addAdditionalItem}
                  onRemove={removeAdditionalItem}
                />
              </FluidGroup>

              <FluidGroup title="Output" description="Masukkan seluruh cairan keluar pasien.">
                <FieldNumber label="Urin" value={fluid.urin} onChange={(v) => setFluidField("urin", v)} />
                <FieldNumber label="Muntah" value={fluid.muntah} onChange={(v) => setFluidField("muntah", v)} />
                <FieldNumber label="Drainase" value={fluid.drainase} onChange={(v) => setFluidField("drainase", v)} />
                <FieldNumber label="Feses Cair" value={fluid.feses} onChange={(v) => setFluidField("feses", v)} />

                <AdditionalItems
                  title="Jenis Output Lainnya"
                  group="additionalOutputs"
                  items={fluid.additionalOutputs}
                  onChange={updateAdditionalItem}
                  onAdd={addAdditionalItem}
                  onRemove={removeAdditionalItem}
                />
              </FluidGroup>
            </div>

            <div className={`mt-5 ${!formReady ? "pointer-events-none opacity-50" : ""}`}>
              <label className="mb-2 block text-sm font-bold text-slate-700">Catatan Tambahan - Opsional</label>
              <textarea
                value={fluid.additionalNotes}
                onChange={(e) => setFluidField("additionalNotes", e.target.value)}
                placeholder="Masukkan catatan klinis tambahan jika diperlukan"
                rows={4}
                className="w-full resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </section>

          <section className="rounded-[28px] border border-white bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Hitung dan Export</h2>
                <p className="mt-2 leading-7 text-slate-600">
                  Balance terkoreksi hanya ditampilkan jika suhu pasien &gt; 37°C.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={calculate}
                  disabled={!formReady}
                  className="rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Hitung Balance
                </button>
                <button
                  type="button"
                  onClick={exportPDF}
                  disabled={!result || isExporting}
                  className="rounded-2xl bg-slate-900 px-6 py-3 font-bold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isExporting ? "Mengekspor..." : "Export PDF"}
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  className="rounded-2xl border border-slate-300 bg-white px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Reset
                </button>
              </div>
            </div>

            {result && (
              <div className="mt-6">
                <ResultPanel result={result} />
                <FormulaPanel result={result} fluid={fluid} patient={patient} />
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function InfoPage({
  variant,
  onBack,
}: {
  variant: Exclude<AppView, "home">;
  onBack: () => void;
}) {
  const isAbout = variant === "tentang";

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <section
          className="relative overflow-hidden rounded-[32px] p-6 text-white shadow-xl md:p-8"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(29,78,216,0.92) 0%, rgba(14,165,233,0.86) 55%, rgba(103,232,249,0.74) 100%), url('/rsup-m-jamil.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <button
            type="button"
            onClick={onBack}
            className="absolute right-5 top-5 rounded-2xl border border-white/30 bg-white/20 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-white/30"
          >
            Kembali ke Halaman Awal
          </button>

          <div className="pt-12 md:pt-4">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/80">FluidaCare</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight md:text-5xl">
              {isAbout ? "Tentang Aplikasi" : "Profil Pengembangan"}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/95 md:text-lg">
              {isAbout
                ? "Informasi tujuan, fungsi, dan batasan penggunaan aplikasi FluidaCare."
                : "Informasi pengembang, instansi, dan identitas pengembangan aplikasi."}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white bg-white p-5 shadow-sm md:p-7">
          {isAbout ? (
            <div className="space-y-5">
              <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5 leading-8 text-slate-700 md:p-6">
                <h2 className="text-2xl font-black text-slate-900">FluidaCare</h2>
                <p className="mt-4">
                  FluidaCare merupakan aplikasi kalkulator balance cairan yang dikembangkan secara mandiri
                  untuk membantu tenaga kesehatan melakukan pencatatan intake-output dan perhitungan
                  keseimbangan cairan pasien secara cepat, praktis, dan terstandar, khususnya di Instalasi
                  Gawat Darurat (IGD).
                </p>
                <p className="mt-3">
                  Aplikasi ini dibuat sebagai bentuk inovasi pelayanan keperawatan dan disusun berdasarkan
                  kebutuhan penggunaan di lapangan serta referensi ilmiah terkait manajemen cairan pasien.
                  Referensi penelitian terdahulu digunakan sebagai landasan akademik, bukan sebagai
                  penyalinan kode, desain, atau sistem.
                </p>
              </div>

              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 leading-8 text-amber-900 md:p-6">
                <h3 className="text-lg font-black">Keterangan Penggunaan</h3>
                <p className="mt-3">
                  Aplikasi ini merupakan alat bantu perhitungan dan tidak menggantikan penilaian klinis
                  tenaga kesehatan. Hasil perhitungan tetap perlu disesuaikan dengan kondisi pasien dan
                  kebijakan pelayanan setempat.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 md:p-6">
                <h2 className="text-2xl font-black text-slate-900">Identitas Pengembangan</h2>
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <ProfileInfo label="Pengembang" value="Ramona Hotnida Sari Nasution" />
                  <ProfileInfo label="Instansi" value="RSUP Dr. M. Djamil Padang" />
                  <ProfileInfo label="Tahun Pengembangan" value="2026" />
                  <ProfileInfo label="Nama Aplikasi" value="FluidaCare" />
                </div>
              </div>

              <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5 leading-8 text-slate-700 md:p-6">
                <h3 className="text-lg font-black text-slate-900">Ruang Lingkup</h3>
                <p className="mt-3">
                  Aplikasi ini difokuskan untuk membantu pencatatan intake-output, perhitungan IWL normal,
                  koreksi demam, serta interpretasi awal status balance cairan sebagai alat bantu kerja di
                  pelayanan.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ProfileInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}

function inputClass(hasError = false) {
  return `w-full rounded-2xl border bg-white px-4 py-3 text-slate-800 outline-none transition focus:ring-4 ${
    hasError ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100" : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
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
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-2 block text-sm font-semibold text-rose-600">{error}</span>}
    </label>
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
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      <div className="relative">
        <input
          type="number"
          min={0}
          step={0.1}
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 pr-14 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
          mL
        </span>
      </div>
    </label>
  );
}

function FluidGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
      <div className="mb-5">
        <h3 className="text-xl font-black text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function AdditionalItems({
  title,
  group,
  items,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  group: "additionalIntakes" | "additionalOutputs";
  items: AdditionalFluidItem[];
  onChange: (
    group: "additionalIntakes" | "additionalOutputs",
    id: string,
    field: keyof Omit<AdditionalFluidItem, "id">,
    value: string
  ) => void;
  onAdd: (group: "additionalIntakes" | "additionalOutputs") => void;
  onRemove: (group: "additionalIntakes" | "additionalOutputs", id: string) => void;
}) {
  const canAdd = items.length < MAX_ADDITIONAL_ITEMS;

  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h4 className="font-black text-slate-800">{title}</h4>
          <p className="mt-1 text-sm text-slate-500">Maksimal {MAX_ADDITIONAL_ITEMS} baris tambahan.</p>
        </div>
        <button
          type="button"
          onClick={() => onAdd(group)}
          disabled={!canAdd}
          className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          + Tambah
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_auto]">
            <input
              type="text"
              placeholder={`Jenis lainnya ${index + 1}`}
              value={item.type}
              onChange={(e) => onChange(group, item.id, "type", e.target.value)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
            <div className="relative">
              <input
                type="number"
                min={0}
                step={0.1}
                placeholder="0"
                value={item.value}
                onChange={(e) => onChange(group, item.id, "value", e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 pr-12 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                mL
              </span>
            </div>
            <button
              type="button"
              onClick={() => onRemove(group, item.id)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Hapus
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultPanel({ result }: { result: CalculationResult }) {
  const mainStatus = result.statusCorrected ?? result.statusStandard;

  return (
    <div className="rounded-[28px] border border-blue-100 bg-blue-50 p-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ResultCard label="Total Intake" value={formatMl(result.totalIntake)} />
        <ResultCard label="Total Output" value={formatMl(result.totalOutput)} />
        <ResultCard label="IWL Normal" value={formatMl(result.iwlNormal)} />
        <ResultCard
          label={result.hasFever ? "IWL Demam" : "Status Demam"}
          value={result.hasFever && result.iwlFever !== null ? formatMl(result.iwlFever) : "Tidak demam"}
        />
        <ResultCard label="Balance Standar" value={formatMl(result.balanceStandard)} status={result.statusStandard} />
        <ResultCard
          label={result.hasFever ? "Balance Terkoreksi" : "Koreksi Demam"}
          value={result.balanceCorrected !== null ? formatMl(result.balanceCorrected) : "Tidak muncul"}
          status={result.statusCorrected}
        />
      </div>

      <div className="mt-5 rounded-3xl bg-white p-5 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
          Status Balance Utama
        </p>
        <p className={`mt-2 text-3xl font-black ${getStatusClass(mainStatus)}`}>{mainStatus}</p>
        <p className="mt-2 text-slate-600">{getInterpretationText(mainStatus)}</p>
      </div>
    </div>
  );
}

function ResultCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: BalanceStatus | null;
}) {
  return (
    <div className="rounded-3xl border border-white bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${status ? getStatusClass(status) : "text-slate-900"}`}>
        {value}
      </p>
      {status && <p className={`mt-1 text-sm font-bold ${getStatusClass(status)}`}>{status}</p>}
    </div>
  );
}

function FormulaPanel({
  result,
  fluid,
  patient,
}: {
  result: CalculationResult;
  fluid: FluidForm;
  patient: PatientForm;
}) {
  const ageNum = toNumber(patient.age);
  const weightNum = toNumber(patient.weight);
  const temperatureNum = toNumber(patient.temperature);

  return (
    <div className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5">
      <h3 className="text-xl font-black text-slate-900">Rumus Perhitungan</h3>

      <div className="mt-4 space-y-4 leading-8 text-slate-700">
        <div>
          <h4 className="font-bold text-slate-800">Total Intake</h4>
          <p>
            Oral + Infus + Obat Cair + Transfusi + Air Metabolisme + Intake Lainnya ={" "}
            <span className="font-bold">{result.totalIntake.toFixed(1)} mL</span>
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-800">Total Output</h4>
          <p>
            Urin + Muntah + Drainase + Feses Cair + Output Lainnya ={" "}
            <span className="font-bold">{result.totalOutput.toFixed(1)} mL</span>
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-800">IWL Normal</h4>
          {patient.ageCategory === "dewasa (>18 Thn)" ? (
            <p>
              IWL normal dewasa = 15 × BB = 15 × {weightNum.toFixed(1)} ={" "}
              <span className="font-bold">{result.iwlNormal.toFixed(1)} mL/hari</span>
            </p>
          ) : (
            <p>
              IWL normal anak = (30 - usia) × BB = (30 - {ageNum.toFixed(1)}) ×{" "}
              {weightNum.toFixed(1)} ={" "}
              <span className="font-bold">{result.iwlNormal.toFixed(1)} mL/hari</span>
            </p>
          )}
        </div>

        {result.hasFever && result.iwlFever !== null ? (
          <div>
            <h4 className="font-bold text-slate-800">IWL Demam/Koreksi</h4>
            <p>
              IWL normal + 200 × (Suhu - 37) = {result.iwlNormal.toFixed(1)} + 200 × (
              {temperatureNum.toFixed(1)} - 37) ={" "}
              <span className="font-bold">{result.iwlFever.toFixed(1)} mL/hari</span>
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
            Tidak ada koreksi demam karena suhu pasien ≤ 37°C.
          </div>
        )}

        <div>
          <h4 className="font-bold text-slate-800">Balance Standar</h4>
          <p>
            Intake - (Output + IWL normal) = {result.totalIntake.toFixed(1)} - (
            {result.totalOutput.toFixed(1)} + {result.iwlNormal.toFixed(1)}) ={" "}
            <span className="font-bold">{result.balanceStandard.toFixed(1)} mL</span>
          </p>
        </div>

        {result.hasFever && result.iwlFever !== null && result.balanceCorrected !== null && (
          <div>
            <h4 className="font-bold text-slate-800">Balance Terkoreksi</h4>
            <p>
              Intake - (Output + IWL demam) = {result.totalIntake.toFixed(1)} - (
              {result.totalOutput.toFixed(1)} + {result.iwlFever.toFixed(1)}) ={" "}
              <span className="font-bold">{result.balanceCorrected.toFixed(1)} mL</span>
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="font-bold text-slate-800">{result.methodLabel}</p>
          <p>
            Status Balance Standar:{" "}
            <span className={`font-bold ${getStatusClass(result.statusStandard)}`}>
              {result.statusStandard}
            </span>
          </p>
          {result.statusCorrected && (
            <p>
              Status Balance Terkoreksi:{" "}
              <span className={`font-bold ${getStatusClass(result.statusCorrected)}`}>
                {result.statusCorrected}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

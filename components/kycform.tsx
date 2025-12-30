// components/KycForm.tsx
"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Client Side Supabase (Hanya untuk Upload Storage)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);

export default function KycForm() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // --- STYLE DEFINITIONS (Sama seperti sebelumnya) ---
  const fileButtonStyle: React.CSSProperties = {
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.5rem 1rem",
    borderRadius: 8,
    backgroundColor: "#f59e0b",
    color: "white",
    fontWeight: 600,
    boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
    border: "1px solid rgba(0,0,0,0.05)",
  };

  const uploadButtonStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.6rem 1rem",
    borderRadius: 8,
    backgroundColor: "#2563eb",
    color: "white",
    fontWeight: 700,
    boxShadow: "0 10px 24px rgba(0,0,0,0.16)",
    border: "none",
    transition: "background-color 120ms ease, transform 120ms ease",
  };

  const uploadButtonHoverStyle: React.CSSProperties = { backgroundColor: "#1d4ed8" };
  const uploadButtonActiveStyle: React.CSSProperties = { backgroundColor: "#1e40af", transform: "translateY(1px)" };

  // --- LOGIKA UTAMA ---
  const handleUpload = async () => {
    if (!file) return alert("Mohon pilih file dulu!");
    setLoading(true);

    try {
      // 1. UPLOAD FILE (Dilakukan di Client supaya cepat & hemat bandwidth server)
      // Kita perlu ID sementara di sini cuma buat nama folder
      const TEMP_ID = "00000000-0000-0000-0000-000000000000";
      const filePath = `${TEMP_ID}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("ktp") // Pastikan nama bucket sesuai ('ktp' atau 'kyc-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. PANGGIL API UNTUK SIMPAN DATABASE
      // Kita kirim filePath-nya saja ke server
      const response = await fetch("/api/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_path: filePath }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal menghubungi server");
      }

      alert("KYC Berhasil Disimpan!");
      setFile(null); // Reset form

    } catch (error: any) {
      console.error(error);
      alert("Gagal: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 border rounded shadow max-w-md bg-white text-black">
      <h2 className="text-xl font-bold mb-4">Verifikasi Identitas (KYC)</h2>

      <label className="block mb-2">Foto KTP</label>
      <div className="flex items-center gap-3 mb-4">
        <label htmlFor="ktpUpload" style={fileButtonStyle}>
          Pilih Foto KTP
        </label>
        <input
          id="ktpUpload"
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <span className="text-sm text-gray-700 truncate" style={{ maxWidth: "60%" }}>
          {file ? file.name : "Belum ada file"}
        </span>
      </div>

      <button
        onClick={handleUpload}
        disabled={loading}
        style={{
          ...uploadButtonStyle,
          ...(loading ? { backgroundColor: "#9ca3af", cursor: "not-allowed" } : {}),
        }}
        onMouseEnter={(e) => !loading && Object.assign(e.currentTarget.style, uploadButtonHoverStyle)}
        onMouseLeave={(e) => !loading && Object.assign(e.currentTarget.style, uploadButtonStyle)}
        onMouseDown={(e) => !loading && Object.assign(e.currentTarget.style, uploadButtonActiveStyle)}
        onMouseUp={(e) => !loading && Object.assign(e.currentTarget.style, uploadButtonHoverStyle)}
      >
        {loading ? "Mengupload..." : "Kirim Data KYC"}
      </button>
    </div>
  );
}

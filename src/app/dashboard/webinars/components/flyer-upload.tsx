"use client";
import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import toast from "react-hot-toast";
import { uploadWebinarFlyer } from "@/utils/api";

// Marketing adds only the flyer image; the website pop-up shows it as the webinar announcement.
export default function FlyerUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Flyer must be under 5 MB");
      return;
    }
    setUploading(true);
    try {
      const res = await uploadWebinarFlyer(file);
      const url = res.data?.url;
      if (!url) throw new Error("No URL returned");
      onChange(url);
      toast.success("Flyer uploaded");
    } catch {
      toast.error("Flyer upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Webinar flyer" className="max-h-48 rounded-md border border-gray-200" />
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Remove flyer"
            className="absolute -top-2 -right-2 rounded-full bg-white border border-gray-300 p-1 shadow"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60"
        >
          <ImagePlus size={18} />
          {uploading ? "Uploading..." : "Upload flyer image"}
        </button>
      )}
    </div>
  );
}

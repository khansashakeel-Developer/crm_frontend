"use client";
import { X, ArrowLeft, Eye, EyeOff } from "lucide-react";
import Input from "@/app/component/ui/inputField";
import Select from "@/app/component/ui/select";
import Textarea from "@/app/component/ui/textarea";
import Checkbox from "@/app/component/ui/checkbox";
import Button from "@/app/component/ui/button";
import { useState } from "react";
import { ModalField, ModalProps } from "@/types/ui";
import UploadInput from "../upload-input";
import SearchableSelect from "../searchable-select";
import ProgramMultiSelect from "../program-multi-select";

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  fields,
  initialValues = {},
  onSubmit,
  isLoading = false,
  mode = "add",
  step,
  onBack,
  // ✅ Tabs ke liye naye props
  tabs,
  zIndex = 50,
  children,
}: ModalProps) {
  // const [form, setForm] = useState<Record<string, string | boolean>>(
  //   fields.reduce((acc, field) => {
  //     acc[field.name] = initialValues[field.name] ?? (field.type === "checkbox" ? false : "");
  //     return acc;
  //   }, {} as Record<string, string | boolean>)
  // );
  // ✅ Fix — pehle initialValues se seed karo, phir fields se
  const [form, setForm] = useState<Record<string, string | boolean | string[]>>(() => {
    const allFields = tabs
      ? tabs.flatMap((t) => t.fields)
      : fields;

    const base = allFields.reduce((acc, field) => {
      acc[field.name] = field.type === "checkbox" ? false : "";
      return acc;
    }, {} as Record<string, string | boolean | string[]>);

    return { ...base, ...initialValues };
  });

  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  // ✅ Active tab state
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.key || "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const togglePassword = (name: string) => {
    setShowPasswords((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  if (!isOpen) return null;

  // ✅ Active tab ki fields aur onSubmit
  const currentTab = tabs?.find((t) => t.key === activeTab);

  // const activeFields = tabs ? (currentTab?.fields || []) : fields;
  // const activeFields = tabs
  //   ? (currentTab?.fields || [])
  //   : fields.filter((field) => {
  //     if (mode === "edit") {
  //       const value = initialValues?.[field.name];
  //       return value !== undefined && value !== null && value !== "";
  //     }
  //     return true; // add mode → show all fields
  //   });

  const activeFields = (tabs
    ? (currentTab?.fields || [])
    : fields
  ).filter((field) => !field.visible || field.visible(form));

  // const handleSubmit = () => {
  //   if (tabs && currentTab?.onSubmit) {
  //     currentTab.onSubmit(form);
  //   } else {
  //     onSubmit(form);
  //   }
  // };

  const handleSubmit = () => {
    // Validate required fields
    const activeFieldList = tabs ? (currentTab?.fields || []) : fields;
    const newErrors: Record<string, string> = {};

    activeFieldList.forEach((field) => {
      if (field.required) {
        const val = form[field.name];
        const isEmpty = Array.isArray(val) ? val.length === 0 : (!val || (typeof val === "string" && val.trim() === ""));
        if (isEmpty) newErrors[field.name] = `${field.label.replace("*", "").trim()} is required`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return; // stop submission
    }

    setErrors({});

    if (tabs && currentTab?.onSubmit) {
      currentTab.onSubmit(form as Record<string, string | boolean>);
    } else {
      onSubmit(form as Record<string, string | boolean>);
    }
  };


  const renderField = (field: ModalField) => {
    switch (field.type) {
      case "input":
        const isPasswordField = field.inputType === "password";
        const isVisible = showPasswords[field.name];
        return (
          <Input
            key={field.name}
            label={field.label}
            type={isPasswordField ? (isVisible ? "text" : "password") : (field.inputType || "text")}
            placeholder={field.placeholder}
            value={form[field.name] as string}
            // onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
            error={errors[field.name]}
            onChange={(e) => {
              setForm({ ...form, [field.name]: e.target.value });
              if (errors[field.name]) setErrors({ ...errors, [field.name]: "" });
            }}
            disabled={field.disabled}
            autoComplete={isPasswordField ? "new-password" : "off"}
            rightIcon={
              isPasswordField ? (
                <button
                  type="button"
                  onClick={() => togglePassword(field.name)}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              ) : undefined
            }
          />
        );
      case "select":
        return (
          <Select
            key={field.name}
            label={field.label}
            options={field.options || []}
            value={form[field.name] as string}
            defaultValue={field.defaultValue as string}
            // onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
            error={errors[field.name]}
            onChange={(e) => {
              setForm({ ...form, [field.name]: e.target.value });
              if (errors[field.name]) setErrors({ ...errors, [field.name]: "" });
            }}
            disabled={field?.disabled}
          />
        );
      case "searchable-select":
        return (
          <SearchableSelect
            key={field.name}
            label={field.label}
            options={field.options || []}
            value={form[field.name] as string}
            defaultValue={field.defaultValue as string}
            error={errors[field.name]}
            onChange={(e) => {
              setForm({ ...form, [field.name]: e.target.value });
              if (errors[field.name]) setErrors({ ...errors, [field.name]: "" });
            }}
            disabled={field?.disabled}
          />
        );
      case "textarea":
        return (
          <Textarea
            key={field.name}
            label={field.label}
            placeholder={field.placeholder}
            value={form[field.name] as string}
            // onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
            error={errors[field.name]}
            onChange={(e) => {
              setForm({ ...form, [field.name]: e.target.value });
              if (errors[field.name]) setErrors({ ...errors, [field.name]: "" });
            }}
            disabled={field.disabled}
          />
        );
      case "checkbox":
        return (
          <Checkbox
            key={field.name}
            label={field.label}
            checked={form[field.name] as boolean}
            onChange={(e) => setForm({ ...form, [field.name]: e.target.checked })}
            disabled={field.disabled}
          />
        );
      case "uploadInput":
        return (
          <UploadInput
            key={field.name}
            label={field.label}
            value={form[field.name] as string}
            // type={form["content_type"] as any}
            type={
              (field.uploadType ||
                form["content_type"]) as
              "audio" | "video" | "document"
            }

            // ✅ only URL
            onChange={(url) =>
              setForm({
                ...form,
                content_url: url,
              })
            }

            // ✅ duration yahan handle karo
            onUploadComplete={(data) => {
              setForm((prev) => ({
                ...prev,
                content_url: data.url,

                ...(data.duration && {
                  duration_minutes: Math.ceil(data.duration).toString(),
                }),
              }));
            }}
          />
        );
      case "custom":
        return (
          <div key={field.name}>
            {field.render
              ? field.render(
                form[field.name] as string | boolean,
                (updatedValue) => setForm({ ...form, [field.name]: updatedValue })
              )
              : null}
          </div>
        );
      case "multi-select":
        return (
          <ProgramMultiSelect
            key={field.name}
            programs={(field.options || []).map((o) => ({ _id: o.value, name: o.label }))}
            selected={(form[field.name] as string[]) || []}
            onToggle={(id) => {
              const current = (form[field.name] as string[]) || [];
              const updated = current.includes(id)
                ? current.filter((x) => x !== id)
                : [...current, id];
              setForm({ ...form, [field.name]: updated });
              if (errors[field.name]) setErrors({ ...errors, [field.name]: "" });
            }}
          />
        );
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      style={{ zIndex }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">

        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition">
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
              {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        {/* ✅ Tabs — sirf tab mode mein dikhenge */}
        {tabs && (
          <div className="flex border-b px-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-3 px-4 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab.key
                  ? "border-yellow-400 text-yellow-600"
                  : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Fields */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {activeFields.map((field) => renderField(field))}
          {children}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            fullWidth
            isLoading={isLoading}
            loadingText={
              mode === "edit" ? "Saving..." :
                step === "forgot" ? "Sending OTP..." :
                  step === "reset" ? "Resetting..." :
                    "Adding..."
            }
            onClick={handleSubmit}
          >
            {mode === "edit" ? "Save Changes" :
              step === "forgot" ? "Send OTP" :
                step === "reset" ? "Reset Password" :
                  "Add"}
          </Button>
        </div>

      </div>
    </div>
  );
}
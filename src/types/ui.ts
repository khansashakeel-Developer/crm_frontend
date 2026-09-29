import { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { FieldError } from "react-hook-form";

export type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  // error?: FieldError;
  rightIcon?: React.ReactNode;
  disabled?: boolean;
  error?: string | { message?: string };
  bg?: string;
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  loadingText?: string;
  variant?: "primary" | "secondary" | "danger" | "blue" | "black";
  fullWidth?: boolean;
};

export type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};


export type Option = {
  label: string;
  value: string;
  disabled?: boolean;
};

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: Option[];
  // error?: FieldError;
  error?: string | { message?: string };
  bg?: string;
  placeholder?: string;
};

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  // error?: FieldError;
  error?: string | { message?: string };
};

export type FieldType = "input" | "select" | "searchable-select" | "textarea" | "checkbox" | "uploadInput" | "custom" | "multi-select" ;

export type ModalField = {
  name: string;
  label: string;
  type: FieldType;
  defaultValue?: string | boolean | string[];
  placeholder?: string;
  inputType?: string; // "text" | "email" | "password" | "number"
  options?: { label: string; value: string, disabled?: boolean }[]; // select ke liye
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  visible?: (form: Record<string, any>) => boolean;
  uploadType?: "audio" | "video" | "document",
  render?: (value: string | boolean | string[], onChange: (updatedValue: string | boolean | string[]) => void) => React.ReactNode; // custom field ke liye
};

export type ModalTab = {
  key: string;
  label: string;
  fields: ModalField[];
  onSubmit?: (data: Record<string, string | boolean>) => void;
};

export type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  subtitle?: string;
  title: string;
  fields: ModalField[];
  initialValues?: Record<string, string | boolean>;
  onSubmit: (data: Record<string, string | boolean>) => void;
  isLoading?: boolean;
  mode?: "add" | "edit";
  step?: "forgot" | "reset";
  onBack?: () => void;
  tabs?: ModalTab[];
  zIndex?: number;
  children?: React.ReactNode;  
  // type?: "input" | "select" | "searchable-select" | "textarea" | "checkbox" | "uploadInput" | "custom" | "multi-select";
};


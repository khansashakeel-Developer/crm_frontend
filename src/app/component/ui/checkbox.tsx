import { CheckboxProps } from "@/types/ui";
import { InputHTMLAttributes } from "react";



export default function Checkbox({ label, ...props }: CheckboxProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          {...props}
          className="peer sr-only"
        />
        <div className="w-5 h-5 rounded border-2 border-gray-300 peer-checked:bg-yellow-400 peer-checked:border-yellow-400 peer-checked:[&>svg]:block transition flex items-center justify-center">
          <svg className="w-3 h-3 text-gray-900 hidden peer-checked:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
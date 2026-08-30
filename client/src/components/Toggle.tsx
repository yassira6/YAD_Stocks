interface Props {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-brand-600" : "bg-ink-700"
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[1.375rem] rtl:-translate-x-[1.375rem]" : "translate-x-1 rtl:-translate-x-1"
        }`}
      />
    </button>
  );
}

import { Paperclip } from "lucide-react";

export function AddressQuestion({
  disabled,
  onChange,
  placeholder,
  value,
}: {
  disabled: boolean;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div className="relative flex-1">
      <button
        aria-label="Attach file"
        className="absolute left-4 top-1/2 flex -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        disabled
        type="button"
      >
        <Paperclip aria-hidden className="h-5 w-5" />
      </button>
      <input
        className="w-full rounded-full border border-border bg-card py-4 pl-12 pr-4 text-base text-foreground shadow-[0_4px_12px_rgba(0,0,0,0.03)] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary-accent focus:ring-2 focus:ring-primary-accent/10 disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted-foreground"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}

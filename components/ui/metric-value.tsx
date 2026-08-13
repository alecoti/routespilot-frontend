export function MetricValue({
  label,
  suffix,
  value,
}: {
  label: string;
  suffix?: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-l-2 border-primary pl-4">
      <span className="font-display text-4xl font-semibold leading-none text-foreground md:text-5xl">
        {value}
        {suffix ? (
          <span className="ml-1 align-baseline text-xl text-muted-foreground md:text-2xl">
            {suffix}
          </span>
        ) : null}
      </span>
      <span className="font-display text-sm font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

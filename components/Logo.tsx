import { useId } from "react";

type MarkProps = {
  size?: number | string;
  plate?: string;
  rim?: string;
  className?: string;
  title?: string;
};

/** O prato com uma mordida: o "o" do Fominha e o ícone do app. */
export function PlateMark({
  size = 48,
  plate = "#d33d15",
  rim = "#faf8f5",
  className,
  title,
}: MarkProps) {
  const maskId = `bite-${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <mask id={maskId}>
          <rect width="48" height="48" fill="#fff" />
          <circle cx="41" cy="8" r="7.5" fill="#000" />
          <circle cx="46.5" cy="18.5" r="5.5" fill="#000" />
          <circle cx="31.5" cy="3" r="5.5" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        <circle cx="24" cy="24" r="22" fill={plate} />
        <circle cx="24" cy="24" r="13" fill="none" stroke={rim} strokeWidth="3.5" />
      </g>
    </svg>
  );
}

type WordmarkProps = {
  className?: string;
  plate?: string;
  rim?: string;
};

/** "fominha" com o prato mordido no lugar do "o". Tamanho vem do font-size da className. */
export function Wordmark({ className = "text-3xl", plate, rim }: WordmarkProps) {
  return (
    <span
      role="img"
      aria-label="Fominha"
      className={`inline-flex items-baseline font-display font-extrabold leading-none tracking-tight ${className}`}
    >
      f
      <PlateMark size="0.62em" plate={plate} rim={rim} className="mx-[0.03em]" />
      minha
    </span>
  );
}

type BrandSignatureProps = {
  compact?: boolean;
  subtitle?: string;
};

export function BrandSignature({ compact = false, subtitle = "BUSINESS OS" }: BrandSignatureProps) {
  return (
    <span className={`brandSignature${compact ? " brandSignatureCompact" : ""}`}>
      <span className="brandEmblem" aria-hidden="true">
        <i />
        <i />
      </span>
      <span className="brandSignatureText">
        <strong>Leopard Speed</strong>
        <small>{subtitle}</small>
      </span>
    </span>
  );
}

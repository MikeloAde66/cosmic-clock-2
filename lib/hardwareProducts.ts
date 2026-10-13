// Hardware teaser catalog for components/ProductsSection.tsx's Continuous
// Stack grid. Intentionally empty — HydroNode Pro and the other early
// hardware placeholders were retired (their detail/checkout components
// deleted), leaving Star Tracker PRO as the only real hardware product,
// which ProductsSection hardcodes separately rather than listing here.
export interface HardwareProduct {
  id: string;
  name: string;
  heroTagline: string;
  heroImageSrc: string;
  delisted?: boolean;
}

export const HARDWARE_PRODUCTS: HardwareProduct[] = [];

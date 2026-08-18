import HardwareProductDetail from '@/components/HardwareProductDetail';
import { HARDWARE_PRODUCTS } from '@/lib/hardwareProducts';

const product = HARDWARE_PRODUCTS.find((p) => p.id === 'builder-kit')!;

export default function BuilderKitPage() {
  return <HardwareProductDetail product={product} />;
}

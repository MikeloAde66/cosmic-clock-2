import HardwareProductDetail from '@/components/HardwareProductDetail';
import { HARDWARE_PRODUCTS } from '@/lib/hardwareProducts';

const product = HARDWARE_PRODUCTS.find((p) => p.id === 'hydronode-pro')!;

export default function HydroNodeProPage() {
  return <HardwareProductDetail product={product} />;
}

import HardwareProductDetail from '@/components/HardwareProductDetail';
import { HARDWARE_PRODUCTS } from '@/lib/hardwareProducts';

const product = HARDWARE_PRODUCTS.find((p) => p.id === 'aione-core')!;

export default function AiOneCorePage() {
  return <HardwareProductDetail product={product} />;
}

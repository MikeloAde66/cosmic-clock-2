import HardwarePreorderThankYou from '@/components/HardwarePreorderThankYou';
import { HARDWARE_PRODUCTS } from '@/lib/hardwareProducts';

const product = HARDWARE_PRODUCTS.find((p) => p.id === 'hydronode-pro')!;

export default function HydroNodeProThankYouPage() {
  return <HardwarePreorderThankYou product={product} />;
}

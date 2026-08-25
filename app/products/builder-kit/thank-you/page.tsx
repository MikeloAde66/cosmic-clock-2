import HardwarePreorderThankYou from '@/components/HardwarePreorderThankYou';
import { HARDWARE_PRODUCTS } from '@/lib/hardwareProducts';

const product = HARDWARE_PRODUCTS.find((p) => p.id === 'builder-kit')!;

export default function BuilderKitThankYouPage() {
  return <HardwarePreorderThankYou product={product} />;
}

import HardwarePreorderThankYou from '@/components/HardwarePreorderThankYou';
import { HARDWARE_PRODUCTS } from '@/lib/hardwareProducts';

const product = HARDWARE_PRODUCTS.find((p) => p.id === 'aione-core')!;

export default function AiOneCoreThankYouPage() {
  return <HardwarePreorderThankYou product={product} />;
}

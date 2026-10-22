import Trainer from '@/components/flightAcademy/Trainer';

// One Flight Academy lesson: the real Spectre-AI GCS simulator with the
// instructor rail beside it. The lesson id comes from the URL so every
// lesson is linkable (e.g. /flight-school/train/evaluation).
export default async function TrainPage({ params }: { params: Promise<{ lesson: string }> }) {
  const { lesson } = await params;
  return <Trainer lessonId={lesson} />;
}

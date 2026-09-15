export interface CosmicData {
  kaliYugaYear: number;
  kaliYugaTotal: number;
  kaliYugaProgressPercent: string;
  earthAgeYears: number;
}

export function calculateCosmicTime(): CosmicData {
  const currentYear = new Date().getFullYear();
  const startYear = -3102;
  const kaliYugaYear = currentYear - startYear;
  const kaliYugaTotal = 432000;
  const progress = ((kaliYugaYear / kaliYugaTotal) * 100).toFixed(4);

  return {
    kaliYugaYear,
    kaliYugaTotal,
    kaliYugaProgressPercent: progress,
    earthAgeYears: 4540000000,
  };
}

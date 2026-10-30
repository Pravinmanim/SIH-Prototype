export type Language = 'en' | 'ta' | 'hi';

export type TranslationDictionary = Record<string, string>;

export interface TranslationCompletenessReport {
  totalKeys: number;
  missingInTa: string[];
  missingInHi: string[];
  coverageTa: number;
  coverageHi: number;
}

export type OutreachTemplate =
  | 'initial-pitch'
  | 'follow-up-1'
  | 'follow-up-2'
  | 'final-follow-up';

export interface SequenceStep {
  stepNumber: number;
  delayDays: number;
  template: OutreachTemplate;
  subject: string;
}

/** The 4-step cold email sequence (Day 0, 3, 7, 14). */
export const SEQUENCE_STEPS: readonly SequenceStep[] = [
  {
    stepNumber: 1,
    delayDays: 0,
    template: 'initial-pitch',
    subject: 'I built a website for {{businessName}}',
  },
  {
    stepNumber: 2,
    delayDays: 3,
    template: 'follow-up-1',
    subject: 'Did you get a chance to look?',
  },
  {
    stepNumber: 3,
    delayDays: 7,
    template: 'follow-up-2',
    subject: 'Your demo site expires in 7 days',
  },
  {
    stepNumber: 4,
    delayDays: 14,
    template: 'final-follow-up',
    subject: 'Last chance before I take it down',
  },
];

export const DAY_MS = 24 * 60 * 60 * 1000;

export function stepByNumber(stepNumber: number): SequenceStep | undefined {
  return SEQUENCE_STEPS.find((s) => s.stepNumber === stepNumber);
}

export interface LevelOption {
  value: string;
  label: string;
}

export const LEVELS: LevelOption[] = [
  { value: "kindergarten", label: "Kindergarten" },
  { value: "grade1", label: "1st Grade" },
  { value: "grade2", label: "2nd Grade" },
  { value: "grade3", label: "3rd Grade" },
  { value: "grade4", label: "4th Grade" },
  { value: "grade5", label: "5th Grade" },
  { value: "grade6", label: "6th Grade" },
  { value: "grade7", label: "7th Grade" },
  { value: "grade8", label: "8th Grade" },
  { value: "grade9", label: "9th Grade" },
  { value: "grade10", label: "10th Grade" },
  { value: "grade11", label: "11th Grade" },
  { value: "grade12", label: "12th Grade" },
  { value: "collegeFreshman", label: "College Freshman" },
  { value: "collegeSophomore", label: "College Sophomore" },
  { value: "collegeJunior", label: "College Junior" },
  { value: "collegeSenior", label: "College Senior" },
];

const labelByValue = new Map(LEVELS.map((l) => [l.value, l.label]));
export function levelLabel(value: string | undefined | null): string {
  if (!value) return "—";
  return labelByValue.get(value) ?? value;
}

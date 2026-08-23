import type { DemoExample } from './contracts'

export const fallbackExamples: DemoExample[] = [
  {
    id: 'exact-kannada',
    label: 'Exact Kannada',
    query: {
      name: 'ಅನನ್ಯಾ ಗೌಡ',
      relative_name: 'ರಮೇಶ್ ಗೌಡ',
      locality: 'ಚೆನ್ನಾಪುರ',
      age: 28,
    },
    expected_state: 'possible_match',
    expected_record_id: 'SYN-KA-A',
  },
  {
    id: 'romanized-typo',
    label: 'Romanized typo',
    query: {
      name: 'Ananya Gowdaa',
      relative_name: 'Ramesh Gowda',
      locality: 'Chennapura',
      age: 28,
    },
    expected_state: 'possible_match',
    expected_record_id: 'SYN-KA-A',
  },
  {
    id: 'needs-refinement',
    label: 'Needs refinement',
    query: { name: 'Kavya Nayak' },
    refinement: {
      relative_name: 'Sunil Nayak',
      locality: 'Beluru',
      age: 31,
    },
    expected_state: 'needs_more_detail',
    expected_refined_state: 'possible_match',
    expected_record_id: 'SYN-KA-C',
  },
  {
    id: 'no-confident-match',
    label: 'No confident match',
    query: { name: 'Nandini Meridian', locality: 'Imaginary Nagar' },
    expected_state: 'no_confident_result',
  },
]

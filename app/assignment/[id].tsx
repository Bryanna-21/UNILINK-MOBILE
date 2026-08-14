import { useLocalSearchParams } from 'expo-router';
import { ShellScreen } from '../../src/components/ShellScreen';

// STATUS: SHELL — no Assignment model, no submission/grading routes.

export default function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ShellScreen
      title="Assignment"
      subtitle={`Assignment ID: ${id ?? 'unknown'} — placeholder`}
      sections={[
        {
          title: 'Details',
          items: ['Due date', 'Instructions', 'Attachments'],
          backendNote: 'Needs: Assignment model.',
        },
        {
          title: 'Submission',
          items: ['Submit work', 'View grade & feedback'],
          backendNote: 'Needs: Submission model + file upload handling + grading route for lecturers.',
        },
      ]}
    />
  );
}

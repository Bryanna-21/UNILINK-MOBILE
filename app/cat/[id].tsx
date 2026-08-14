import { useLocalSearchParams } from 'expo-router';
import { ShellScreen } from '../../src/components/ShellScreen';

// STATUS: SHELL — no CAT model on the backend.

export default function CatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ShellScreen
      title="CAT"
      subtitle={`CAT ID: ${id ?? 'unknown'} — placeholder`}
      sections={[
        {
          title: 'Details',
          items: ['Date & time', 'Venue', 'Coverage / topics'],
          backendNote: 'Needs: CAT model, linked to Course/Unit.',
        },
        {
          title: 'Results',
          items: ['Score', 'Feedback'],
          backendNote: 'Needs: Result model + a route for lecturers to publish scores.',
        },
      ]}
    />
  );
}

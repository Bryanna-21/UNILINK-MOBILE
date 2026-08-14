import { useLocalSearchParams } from 'expo-router';
import { ShellScreen } from '../../src/components/ShellScreen';

// STATUS: SHELL — no PastPaper model or file storage exists.
// Same architecture dependency as Notes: needs a real decision on
// where files live (Mongo GridFS / S3 / Cloudinary) before this can
// be more than a placeholder.

export default function PastPaperScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ShellScreen
      title="Past Paper"
      subtitle={`Paper ID: ${id ?? 'unknown'} — placeholder`}
      sections={[
        {
          title: 'Paper',
          items: ['Year', 'Course/Unit', 'PDF viewer', 'Download for offline'],
          backendNote: 'Needs: PastPaper model + file storage decision + react-native-pdf (not installed).',
        },
        {
          title: 'Marking Scheme',
          items: ['Available separately, if uploaded'],
          backendNote: 'Needs: same storage decision, linked to the paper.',
        },
      ]}
    />
  );
}
